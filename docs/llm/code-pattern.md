# Code Pattern — Shared Coding Conventions

> This document describes **general conventions**, not tied to any specific feature — applicable to the `scheduling`/`catalog`/`vehicles` modules (see `code-architecture.md`) as well as any module added later. Derived from conventions already present in the Jet framework's `auth` module — no new conventions invented, just systematized for consistency.

## 1. Module Folder Structure

Each module (1 bounded context) is 1 folder under `src/modules/`, at most 8 files, each file with exactly 1 responsibility:

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

**Optional extra files**: route-level helpers that don't belong in `service.ts` (business logic) or `model.ts` (domain behavior) get their own single-purpose file, named for what they do — not a catch-all `utils.ts` (that's a grab-bag and violates the 1-file-1-responsibility rule above). Precedent:
- `auth/utils.ts` — password hashing (a single cohesive concern; not a grab-bag, despite the name).
- `scheduling/mapper.ts` — `toDto()`, domain model → response DTO.
- `scheduling/guards.ts` — `canManageAnyAppointment()`, a route-level RBAC permission check reading Hono's `Context` (distinct from the shared `@shared/auth/authorization.ts`, which only the guard calls into).

Only add one of these once `routes.ts` actually accumulates a helper of that kind — don't create it empty ahead of time.

**One-way dependency principle**: `routes.ts` → `service.ts` → `repository.ts` → DB. There is no reverse direction; `routes.ts` must not call `repository.ts` directly; `repository.ts` must know nothing about `service.ts`.

## 2. Three Layers of Data Representation: Schema (ORM) ≠ Domain Model ≠ DTO

These three concepts are easy to confuse because fields often share the same name, but they belong to 3 layers with entirely different responsibilities:

| Layer | File | Knows about | Used by | Created by |
|---|---|---|---|---|
| **Schema (ORM/persistence)** | `shared/db/schema/*.ts` (`pgTable`) | Columns, SQL types, FK, indexes — **no behavior** | `repository.ts` | Drizzle, maps 1-1 to the Postgres table |
| **Domain Model** | `modules/*/model.ts` (plain TS class) | Business rules/behavior | `service.ts` | `repository.ts`, built from a Drizzle row |
| **DTO** | `modules/*/dto.ts` (Valibot) | Shape of the HTTP request/response | `routes.ts` | Valibot, from the HTTP body/query |

An existing example in the codebase — `auth/model.ts`:

```ts
export class AuthCredential {
  constructor(readonly id: string, readonly email: string, /* ... */ readonly lockedUntil: Date | null) {}

  get isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }
}
```

`AuthCredential` imports nothing from Drizzle, yet has behavior (`isLocked`) that encodes a business rule — this is what distinguishes a domain model from a plain "data bag." A concrete applied example (the `Appointment` domain model) is in `code-architecture.md` §2.

**Rule**: `repository.ts` is the **only place** allowed to translate between a Drizzle row and a domain model (`new XModel(row.a, row.b, ...)`). `service.ts` never sees a Drizzle row; `routes.ts` never sees a domain model directly (it must go through a DTO in the response).

## 3. Error Handling Convention

`repository.ts` catches Postgres errors at the lowest layer and maps them to an existing `AppError` subclass (`shared/errors/extensions.err.ts`) — **raw SQL errors must never leak up to `service.ts` or `routes.ts`**:

| Postgres SQLSTATE | Meaning | AppError |
|---|---|---|
| `23505` | unique_violation | `ConflictError` (409) — unless it's an idempotency claim, see §4 |
| `23503` | foreign_key_violation | `BadRequestError` (400) |
| `23P01` | exclusion_violation (GiST) | `ConflictError` (409) |
| `23514` | check_violation | `BadRequestError` (400) |

**Fail-fast principle**: any validation that `service.ts` **can know in advance** (a business rule that doesn't require a DB query to determine) must throw an error **before** calling the `repository`, avoiding a wasted DB round-trip for an error that could be known ahead of time. A concrete applied example (`AppointmentRepository`) is in `code-architecture.md` §4.

## 4. Concurrency-Safety Principle: let the DB constraint be the arbiter, don't "check then act"

A principle applied throughout: **whenever an invariant must hold under concurrency (multiple simultaneous requests), push that guarantee down to a DB constraint (unique/exclusion) rather than doing your own `SELECT` check followed by `INSERT`/`UPDATE`** — the "check then act" approach always has a race window between the two steps, no matter how "safe" the code looks.

This principle is applied to the **Idempotency-Key** mechanism — a shared mechanism for any POST/PATCH endpoint that needs to guard against duplicates caused by client retries. It is split into 3 files following the same repository/contracts pattern already used for modules (§1), **not** a single standalone middleware file:

```
shared/db/schema/idempotencyKeys.ts   # key, customerId, endpoint, requestHash, status(PENDING|DONE), responseBody(jsonb), statusCode, createdAt
                                       # UNIQUE(customerId, key)
shared/idempotency/contracts.ts       # IIdempotencyRepository + IdempotencyRepositoryKey
shared/idempotency/repository.ts      # IdempotencyRepository — receives Database via constructor, claim/complete/release/findExisting
shared/idempotency/middleware.ts      # idempotencyMiddleware(repo: IIdempotencyRepository) — receives repo via parameter, see §5
```

The "claim-first" flow:

1. `repo.claim(customerId, key, endpoint, requestHash)` → `INSERT INTO idempotency_keys ... ON CONFLICT DO NOTHING RETURNING id`.
2. If the insert succeeds (a row is returned) → this request is the sole owner of the key → it proceeds to the controller → the service processes it normally, **with no awareness of idempotency** (single responsibility).
3. Once the response comes back after `next()`: if it is **5xx** (a system/transient error) → `repo.release(id)` — **delete** the claim rather than saving it, because a 5xx error must not permanently "freeze" a key, and a subsequent request must be able to retry cleanly. Only when the response is **2xx or 4xx** (a deterministic outcome — the same input will always produce the same result) is `repo.complete(id, responseBody, statusCode)` called.
4. If the insert fails (because another request already claimed the key — using `ON CONFLICT DO NOTHING` instead of catching the `23505` exception, which is cleaner) → `repo.findExisting(customerId, key)`:
   - If `requestHash` doesn't match (same key but a different payload) → `409 Conflict` reporting misuse of the key, not processed.
   - If `status='DONE'` → return the saved response directly (true idempotency, without calling the service again).
   - If still `PENDING` → return `409 Conflict`, telling the client to retry later.

This middleware can be attached to **any** POST/PATCH route by adding just 1 line, without modifying the service layer. This same principle is also why the PostgreSQL Exclusion Constraint was chosen over pessimistic locking to prevent double-booking — see the full comparison in `architecture.md` §4. A concrete applied example (attaching the middleware to `POST /appointments`) is in `code-architecture.md` §6.

## 5. Dependency Injection for Middleware & Shared Components

**A middleware/component that needs access to the DB or a service must NOT `import { db } from "@shared/db"` and use it directly** — it must receive that dependency via a parameter (factory) or via the DI container, exactly like how `repository.ts` receives `Database` via its constructor. Reasons:

- **Testable with mocks** — `idempotencyMiddleware(repo: IIdempotencyRepository)` receives an interface, so unit tests (§7) can inject a mock repo directly, without needing a real Postgres instance and without having to mock the `@shared/db` module via `vi.mock()` (fragile, hard to read).
- **Consistent with the entire codebase** — every `repository.ts` under `modules/*/` receives `Database` via its constructor (§1); middleware is cross-cutting but follows the same principle, and should not be an exception.

Concretely applied to Idempotency: `IdempotencyRepositoryKey` is bound at the **root container** (`src/processes/http.ts` → `_registerCoreDependencies()`, alongside `DbKey`/`EventBusKey`) because it is shared app-wide infrastructure, not belonging to any specific module. A module's `routes.ts` that needs it calls `container.resolve<IIdempotencyRepository>(IdempotencyRepositoryKey)` and then passes it into `idempotencyMiddleware(repo)` when registering the route — the container is always available because `routes.ts` already receives `container: Container` as a parameter by convention (§1).

## 6. Request Validation Convention

Use the shared middleware `validate(schema, source)` + `getValidatedData<T>(c)` from `shared/middleware/validator.ts` — **do not** use `hono-openapi`'s `validator()`/`c.req.valid()` for runtime validation, even though both work technically:

```ts
import { validate, getValidatedData } from "@shared/middleware/validator";

app.post(
  "/vehicles",
  requireAuth,
  describeRoute(docs.register),      // OpenAPI doc — a separate layer, unrelated to runtime validation
  validate(CreateVehicleDto, "body"), // the actual runtime validation — throws ValidationError (422) on failure
  async (c) => {
    const body = getValidatedData<CreateVehicleType>(c);
    ...
  },
);
```

**Why choose `validate()` over `hono-openapi`'s `validator()`**: `validate()` is a project-authored middleware that throws a `ValidationError` (from `shared/errors`) which flows through the shared `errorHandler` — giving a 100% consistent error format with every other error in the app (`error`, `message`, `timestamp`, `path`, `details`). It doesn't depend on how an external package handles/formats validation errors on its own, avoiding two parallel error-handling paths for validation in the same codebase.

The `source` parameter is `"body" | "query" | "params" | "header"` (note `"params"` is plural, unlike `hono-openapi`). `describeRoute()` (OpenAPI docs) remains unchanged — it is an independent documentation layer that generates the spec for Swagger UI, not the place where runtime validation happens.

> `modules/auth/routes.ts` (pre-existing code, not written as part of this scope) still uses `hono-openapi`'s `validator()` — treated as legacy, not to be replicated. New modules always use `validate()`/`getValidatedData()`.

## 7. Testing Convention

Uses **Vitest** (`vitest run` / `vitest` watch mode). Tests live in the **`tests/` folder at the project root, completely separate from `src/`** — no `*.spec.ts` files placed next to the file under test in `src/modules/`, to avoid mixing business code and tests when browsing folders. The `tests/` structure mirrors `src/`:

```
tests/
├── unit/
│   ├── modules/<name>/{model,service}.spec.ts   # mirrors src/modules/<name>/
│   └── shared/<name>/*.spec.ts                   # mirrors src/shared/<name>/
└── integration/
    └── modules/<name>/*.integration.spec.ts
```

Imports in test files always go through the path alias (`@modules/...`, `@shared/...`), never a relative import like `./service` — since tests no longer sit next to the source.

Split into 2 tiers, applied to every module:

1. **Unit tests** (`tests/unit/**/*.spec.ts`) — mock `IXRepository` via the interface from `contracts.ts` (no real Postgres needed, runs fast). Test every business rule/behavior in `service.ts` and `model.ts`. Also applies to cross-cutting shared components (e.g. `tests/unit/shared/idempotency/middleware.spec.ts` — injecting a mock `IIdempotencyRepository` following the DI principle in §5, spinning up a small Hono app to test the middleware in isolation from any business module).
2. **Integration tests** (`tests/integration/**/*.integration.spec.ts`) — run against a real Postgres instance (via the existing `docker-compose.yml`). **This tier is mandatory whenever an invariant is enforced by a DB constraint** (unique/exclusion) — because only an experimental test with real concurrency can prove the constraint actually works; mocks cannot simulate a race condition at the SQL layer. A concrete example (testing the exclusion constraint with 2 concurrent `INSERT`s) is in `code-architecture.md` §7.3.

3 tsconfig files split by purpose, to avoid a conflict between "the editor needs to see both `src/` and `tests/`" and "the production build needs a strict `rootDir`":

- `tsconfig.base.json` — shared compilerOptions (paths, strict, target...), no `include`/`rootDir`/`outDir`.
- `tsconfig.json` — the **default**, automatically picked up by editors (VS Code, WebStorm, etc.). `include`s both `src/**` and `tests/**`, `noEmit: true`. `npm run typecheck` runs against this exact config.
- `tsconfig.build.json` — used only for `npm run build` (`tsc -p tsconfig.build.json`), `include`s only `src/**`, has `rootDir`/`outDir` to preserve the correct `dist/` structure.

**Why `tsconfig.build.json` is split out instead of sharing `tsconfig.json` for the build too**: if a single tsconfig both `include`s `tests/` and has `rootDir: "./src"`, `tsc` will report an error because files under `tests/` fall outside `rootDir` — so it must be split so that the production build (strict rootDir) and typecheck/editor (covering both src and tests) don't conflict with each other.

> **A real-world lesson**: initially only a separate `tsconfig.test.json` was added for `tests/`, keeping the root `tsconfig.json` with only `include: src/**`. This made `npm run typecheck:tests` (CLI) run cleanly, but the **editor** (VS Code, etc.) only automatically recognizes the default `tsconfig.json` — opening a file under `tests/` would report `Cannot find module '@shared/db'` even though the CLI reported no errors, because the editor fell back to an "inferred project" with no path-alias mapping. This was discovered by actually opening a test file in the editor, not just by running the CLI — the lesson: **verify the editor experience, not just the CLI**, whenever a configuration involves tooling that humans interact with directly.
