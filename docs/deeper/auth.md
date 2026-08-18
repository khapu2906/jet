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
