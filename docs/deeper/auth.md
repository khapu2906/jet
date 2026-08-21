# Authentication & Authorization — Under the Hood

For the JWT payload shape, RBAC tables, config, and how to add a provider, see
`docs/apply/auth.md`.

## Overview

Auth flow is JWT-based with an internal provider (email/password). Designed to support
multiple providers via the `identities` table — a user can have several `identities` rows
(one per provider) all linked to the same `users.id`, which is why registration writes to
three tables instead of one (see below).

## Registration Flow

```
POST /auth/register
  → Validate (email, password ≥8 chars, optional username)
  → Hash password (scrypt + random salt)
  → Atomic DB transaction:
      1. INSERT users
      2. INSERT auth_credentials
      3. INSERT identities (links user ↔ credentials, provider="INTERNAL")
  → Return JWT token
```

## Login Flow

```
POST /auth/login
  → Validate (email, password)
  → Find credentials by email
  → Check account lock (lockedUntil > now → reject)
  → Verify password (timing-safe comparison)
  → On failure: increment failedLoginAttempts
                if attempts ≥ 5 → lock for 15 minutes
  → On success: reset failedLoginAttempts
                generate JWT
  → Return token + user info
```

The failed-attempt lockout is stateful per `auth_credentials` row — it resets to `0` only on a
successful login, so an attacker (or a broken client retry loop) that repeatedly fails will
trip the 15-minute lock well before a meaningful brute-force attempt completes.

## Password Hashing

Uses Node.js `crypto.scrypt` with random salt:

```
format: "${salt}:${hash}"  (hex-encoded, 16-byte salt, 64-byte key)
```

Verification uses `timingSafeEqual` to prevent timing attacks — a naive `===` comparison on
the derived hash would leak how many leading bytes matched via response-time differences,
letting an attacker binary-search the correct hash byte by byte.

## Multi-Provider Design — why each step in `docs/apply/auth.md` is shaped that way

`IAuthProvider` (verify an incoming credential) and `ITokenIssuer` (issue this app's own JWT)
are deliberately two separate interfaces, not one. `InternalAuthProvider` implements both
because, for email+password, *this app itself* is the identity source — it both checks the
password and issues the session token. An external provider (Google, Firebase, ...) only ever
does the first half: it verifies a credential *that provider issued*, and this app still needs
its own `ITokenIssuer` (i.e. still `InternalAuthProvider`, reused) to mint its own session JWT
afterward. A new provider implementing `ITokenIssuer` too would mean it can also mint tokens
this app trusts — almost never what you want; keep that half exclusively `InternalAuthProvider`'s
job unless a provider is deliberately replacing this app's own session tokens entirely.

**Why `AuthProviderKey` sometimes binds at the process root instead of inside `AuthModule`**:
DI visibility. A binding made in `AuthModule.register()` only exists in `auth`'s own child
container — another module can still reach it via `getImportModules()`, but that's extra
ceremony for something meant to be used by *every* route across the app that needs
authentication. Binding it in `HttpProcess._registerCoreDependencies()` instead puts it in the
root container everything already inherits from, the same tier as `DbKey`/`EventBusKey` — this
matches the actual precedent in the sibling codebase this pattern was verified against: its
main user-facing provider is root-bound, while a *second*, narrower provider (service-to-service
auth, below) is bound inside the auth module specifically, since only a couple of routes need it.

**Two patterns from that reference implementation, not yet needed in this codebase but worth
knowing before you do:**

- **Wrap a provider for local dev instead of forking its logic.** A decorator class implements
  `IAuthProvider` (and `ITokenIssuer`, if the wrapped provider needs it) by holding a reference
  to the *real* provider: check for a special dev-only token prefix and return a fixed mock
  identity if it matches, otherwise delegate to the wrapped provider unchanged. Composed at bind
  time (`enableDevMock ? new DevMockProvider(real) : real`), so the real provider's own code
  never branches on environment — the decorator is the only thing that knows dev mode exists,
  and removing it later is a one-line change at the bind site, nothing to hunt down.
- **`IAuthProvider` doesn't have to mean JWT at all.** A provider authenticating *services*
  rather than end users can extract a static header (e.g. a shared secret) from the request and
  verify it against a fixed in-memory registry of known callers — same two-method interface,
  completely different mechanism, no token library involved. Useful for internal/webhook routes
  that legitimate external users should never be able to reach, gated by
  `authenticate(systemProvider)` instead of the user-facing one.
