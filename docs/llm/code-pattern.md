# Code Pattern — Shared Coding Conventions

> This document describes conventions **derived from and verified against this repository's
> actual code** (mainly the `auth` module, the only fully-built feature module here as of this
> writing) — not aspirational or copied from another project. Where a convention is a
> recommendation rather than something already applied somewhere in this codebase, it's marked
> explicitly. See also `docs/apply/` (practical API reference) and `docs/deeper/` (internal
> mechanics/rationale) for the framework itself — this file is about conventions for code you
> *add on top of* the framework.

## 1. Module Folder Structure

Each module (1 bounded context) is 1 folder under `src/modules/`, at most 8 core files, each
file with exactly 1 responsibility. This is exactly how `src/modules/auth/` is built today:

```
modules/<name>/
├── contracts.ts   # DI keys (Symbol) + interface IXRepository / IXService — the contract between layers
├── model.ts       # Domain model — plain TS class, carries business behavior (see §2)
├── dto.ts         # Valibot schema for request/response — validates + auto-infers the TS type
├── repository.ts  # Data access — implements IXRepository, works directly with Drizzle, translates DB rows ↔ domain model
├── service.ts     # Business logic — implements IXService, throws AppError subclasses, does NOT touch SQL
├── routes.ts      # Hono routes — calls the service, contains NO business logic
├── doc.ts         # OpenAPI description object (tag, request, response schema) for hono-openapi
└── module.ts      # Wiring: register() binds DI, bootstrap() mounts routes, getImportModules() declares dependencies on other modules
```

**Optional extra files**: route-level helpers that don't belong in `service.ts` (business logic)
or `model.ts` (domain behavior) get their own single-purpose file, named for what they do — not
a catch-all `utils.ts` grab-bag. The one existing precedent: `auth/utils.ts` — password hashing
only, a single cohesive concern (despite the generic name, it isn't a dumping ground). Only add
a file like this once `routes.ts`/`service.ts` actually accumulates a helper of that kind —
don't create it empty ahead of time.

**One-way dependency principle**: `routes.ts` → `service.ts` → `repository.ts` → DB. There is no
reverse direction; `routes.ts` must not call `repository.ts` directly; `repository.ts` must know
nothing about `service.ts`.

## 2. Three Layers of Data Representation: Schema (ORM) ≠ Domain Model ≠ DTO

These three concepts are easy to confuse because fields often share the same name, but they
belong to 3 layers with entirely different responsibilities:

| Layer | File | Knows about | Used by | Created by |
|---|---|---|---|---|
| **Schema (ORM/persistence)** | `shared/db/schema/*.ts` (`pgTable`) | Columns, SQL types, FK, indexes — **no behavior** | `repository.ts` | Drizzle, maps 1-1 to the Postgres table |
| **Domain Model** | `modules/*/model.ts` (plain TS class) | Business rules/behavior | `service.ts` | `repository.ts`, built from a Drizzle row |
| **DTO** | `modules/*/dto.ts` (Valibot) | Shape of the HTTP request/response | `routes.ts` | Valibot, from the HTTP body/query |

The existing example, `auth/model.ts`:

```ts
export class AuthCredential {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly username: string | null,
    readonly passwordHash: string,
    readonly failedLoginAttempts: number,
    readonly lockedUntil: Date | null,
    readonly lastLoginAt: Date | null,
  ) {}

  get isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }

  get nextLockUntil(): Date | null {
    return this.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_DURATION_MS)
      : null;
  }
}
```

`AuthCredential` imports nothing from Drizzle, yet has behavior (`isLocked`, `nextLockUntil`)
that encodes business rules — this is what distinguishes a domain model from a plain "data bag."

**Rule**: `repository.ts` is the **only place** allowed to translate between a Drizzle row and a
domain model (`new XModel(row.a, row.b, ...)`) — see `AuthRepository.findCredentialByEmail()`
for the applied pattern. `service.ts` never sees a Drizzle row; `routes.ts` never sees a domain
model directly (it must go through a DTO in the response).

## 3. Error Handling Convention

`AppError` and its subclasses (`shared/errors/extensions.err.ts`) are the only errors that
should reach `routes.ts` — see `docs/apply/responses.md` for the full list
(`BadRequestError`/`UnauthorizedError`/`ForbiddenError`/`NotFoundError`/`ConflictError`/
`ValidationError`/`RateLimitError`/`InternalServerError`/`ServiceUnavailableError`) and how the
shared `errorHandler` normalizes anything else into one.

**Recommendation, not yet applied anywhere in this codebase**: `auth/repository.ts` today lets
raw Postgres errors (e.g. a unique-constraint violation on `authCredentials.email` or
`identities.(provider, providerUserId)` — both are real `uniqueIndex`es in the schema) propagate
up unmapped, where the generic `errorHandler` turns any non-`AppError` into a generic 500. If a
future module needs a more specific status code for a DB constraint violation (e.g. 409 instead
of 500 on a duplicate), catch it in `repository.ts` and map it there — don't let `service.ts` or
`routes.ts` inspect Postgres error codes directly:

| Postgres SQLSTATE | Meaning | Suggested `AppError` |
|---|---|---|
| `23505` | unique_violation | `ConflictError` (409) |
| `23503` | foreign_key_violation | `BadRequestError` (400) |
| `23P01` | exclusion_violation (GiST) | `ConflictError` (409) |
| `23514` | check_violation | `BadRequestError` (400) |

**Fail-fast principle** (general, applies regardless of the table above): any validation that
`service.ts` **can know in advance** — a business rule that doesn't require a DB query to
determine — should throw before calling the repository, avoiding a wasted DB round-trip for an
error that was already knowable.

## 4. Concurrency-Safety Principle: let the DB constraint be the arbiter, don't "check then act"

**Applied in this codebase**: `authCredentials.email` and `identities.(provider,
providerUserId)` are both enforced by a Postgres `uniqueIndex`, not by a `SELECT` check before
`INSERT` in `AuthRepository.createUserWithIdentityAndCredential()`. This is deliberate — the
"check then act" approach always has a race window between the two steps (two concurrent
registration requests for the same email could both pass a `SELECT ... WHERE email = ?` check
before either has inserted), no matter how "safe" the code looks. Whenever a new invariant must
hold under concurrency, push that guarantee down to a DB constraint (unique/exclusion) rather
than a `SELECT`-then-`INSERT` in application code.

There's no idempotency-key mechanism (dedup of retried POST/PATCH requests by a client-supplied
key) in this codebase yet. If a module needs one, the shape to follow is: a DB table with a
unique constraint on `(clientId, key)`, a repository with `claim()`/`complete()`/`release()`, and
a middleware that claims the key via `INSERT ... ON CONFLICT DO NOTHING` before calling the
service — same "let the constraint arbitrate" principle as above, just for cross-request
deduplication instead of a single insert.

## 5. Dependency Injection for Middleware & Shared Components

**A middleware/component that needs a shared instance must NOT `import` a bare module-level
singleton and use it directly** — it must be registered in the DI container and resolved from
it, exactly like how `repository.ts` receives `Database` via its constructor. Reasons:

- **Testable with mocks** — a component that receives its dependency as a constructor/factory
  parameter can be given a mock in a test without needing the real infrastructure behind it.
- **Consistent lifecycle** — every cross-cutting service in this codebase (DB, event bus,
  storage, rate limiting) is bound once in `HttpProcess._registerCoreDependencies()` and
  resolved by whichever module needs it; a bare `export const x = new X()` sits outside that
  lifecycle and is invisible to it.

**Applied example**: `RateLimitRegistry` (`src/shared/middleware/rate-limit-registry.ts`). It
used to be a bare exported singleton; it's now bound as a container singleton and resolved by
name, matching every other cross-cutting service:

```ts
// src/processes/http.ts — _registerCoreDependencies()
this._container.singleton(RateLimitRegistryKey, () => new RateLimitRegistry());

// src/modules/auth/module.ts — register()
const rateLimitRegistry = this.container.resolve<RateLimitRegistry>(RateLimitRegistryKey);
rateLimitRegistry.register("/auth/login", { limit: 10, windowMs: 60_000 });
```

See `docs/deeper/middleware.md` ("Rate Limiting: the per-route override system") for why the
class itself also splits `register()` (config time) from `build()` (once, at bootstrap) from
`resolve()` (hot request path, pure lookup, no construction) — the same DI discipline applied
one level deeper, inside the class.

## 6. Request Validation Convention

Use the shared middleware `validate(schema, source)` + `getValidatedData<T>(c)` from
`shared/middleware/validator.ts` for **new** modules — do not use `hono-openapi`'s
`validator()`/`c.req.valid()` for runtime validation, even though both work technically:

```ts
import { validate, getValidatedData } from "@shared/middleware/validator";

app.post(
  "/items",
  describeRoute(docs.create),          // OpenAPI doc — a separate layer, unrelated to runtime validation
  validate(CreateItemDto, "body"),     // the actual runtime validation — throws ValidationError (422) on failure
  async (c) => {
    const body = getValidatedData<CreateItemType>(c);
    // ...
  },
);
```

If the route needs auth, `shared/auth/middleware.ts` exports `authenticate(provider)` — it
exists and is exported, but has **no call site anywhere in this codebase yet** (`/auth/register`
and `/auth/login` are intentionally public; no other route currently requires auth). Confirm its
exact usage against `shared/auth/middleware.ts` directly before relying on it.

**Why `validate()` over `hono-openapi`'s `validator()`**: `validate()` is a project-authored
middleware that throws a `ValidationError` (from `shared/errors`) which flows through the shared
`errorHandler` — a 100% consistent error format with every other error in the app (`error`,
`message`, `timestamp`, `path`, `details`), independent of how an external package happens to
format its own validation errors.

The `source` parameter is `"body" | "query" | "params" | "header"` (note `"params"` is plural,
unlike `hono-openapi`). `describeRoute()` (OpenAPI docs) is unaffected — it's an independent
documentation layer that generates the spec for Swagger UI, not where runtime validation
happens.

> `modules/auth/routes.ts` — the one existing module — still uses `hono-openapi`'s `validator()`
> directly (predates this convention). Treat it as legacy, not a pattern to copy; new modules
> use `validate()`/`getValidatedData()`.

## 7. Testing — not set up yet

There is a `tests/` folder at the project root, but it's currently **empty**, and no test
runner is installed (`vitest` is not in `package.json`, and there's no `test` script). Don't
assume Vitest, a `tests/unit`+`tests/integration` split, or any test-specific `tsconfig` exists
in this repo — none of that is wired up today, unlike everything else in this document. Only
one `tsconfig.json` exists.

If/when testing is set up for this project, keep tests out of `src/` (a separate `tests/` tree
mirroring `src/`'s structure is the intended shape, importing via the `@modules/*`/`@shared/*`
path aliases already configured in `tsconfig.json` — never a relative import like `./service`),
and prefer mocking the `IXRepository`/`IXService` interfaces from each module's `contracts.ts`
over mocking modules directly, consistent with the DI principle in §5.
