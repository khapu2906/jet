# Module System — How To

## Scaffolding a New Module

`scripts/make/module.js` generates a working module skeleton from a stub under `stubs/`, so a
new module starts from the same shape as `auth`/`demo-scheduler` instead of hand-copied
boilerplate:

```bash
npm run make:http -- billing-report       # -> src/modules/billing-report/
npm run make:worker -- order-sync         # -> src/modules/order-sync-worker/
npm run make:scheduler -- cleanup-tmp     # -> src/modules/cleanup-tmp-scheduler/
```

| Type | Stub | Generates | Suffix |
|---|---|---|---|
| `http` | `stubs/http-module/` | `contracts/{index,service,repository}.ts`, `model.ts`, `dto.ts`, `repository.ts` (in-memory placeholder), `service.ts`, `routes.ts`, `doc.ts`, `module.ts` | none |
| `worker` | `stubs/worker-module/` | `handlers/*.handler.ts` (implements `EventHandler`), `module.ts`, plus `shared/event-manager/events/<name>.event.ts` (example event) | `-worker` |
| `scheduler` | `stubs/scheduler-module/` | `contracts.ts`, `job.ts`, `module.ts` | `-scheduler` |

The name is normalized to kebab/camel/Pascal case automatically (`order-sync` and `OrderSync`
produce the same output). The generator refuses to run if the target directory already exists,
and prints the exact import + `_modules[]` line to add to the corresponding
`src/processes/{http,worker,scheduler}.ts` — it does not edit that file for you, since it's
hand-written wiring the generator shouldn't guess at.

The `http` stub's `repository.ts` is an in-memory `Map`, not Drizzle — replace it once the module
has a real table under `shared/db/schema` (see `docs/llm/code-pattern.md` §2). For `worker`, the
event definition lands in `shared/event-manager/events/` (not inside the module folder) —
consistent with every other event in the codebase living in that shared catalog, not scattered
per-consumer; the generator also appends its export to that folder's `index.ts` barrel. It's a
starting example — delete the file and its barrel export if the module only handles events
another module already defines.

## Creating a Module

```ts
import { Hono } from "hono"
import type { Container } from "@khapu2906/treasure-chest"
import { Module } from "@shared/base/modules"

export class MyModule extends Module {
  readonly name = "my"

  // Modules you depend on — pass the CLASS. Loaded before this module,
  // whatever order _modules[] is in.
  readonly imports = [OtherModule]

  // Private: what THIS module needs. Bind into your own container only.
  register(): void {
    this._container.bind(MyRepositoryKey, (c) => new MyRepository(c.resolve(DbKey)))
  }

  // Public: what modules importing you may resolve. Bind into `to` — the
  // importer's container — so the instance belongs to the importer.
  share(to: Container): void {
    to.bind(MyServiceKey, () => new MyService(
      this._container.resolve(MyRepositoryKey),   // private dep, from your own container
      to.resolve(OtherServiceKey),               // dep from a module you import
    ))
  }

  // Side effects. Runs only when this module is listed in _modules[],
  // never when another module merely imports it.
  async onInit(): Promise<void> {}

  // Mount routes, return Hono app. Runs only for _modules[] entries.
  start() {
    const app = new Hono()
    app.route("/my", createMyRoutes(this._container))
    return app
  }

  // Cleanup on shutdown (activated modules only)
  async onDestroy() {}
}
```

## Registering a Module

Add the **class** to the process's `_modules` — the loader constructs it with its own child
container, so never pass an instance:

```ts
// src/processes/http.ts
protected _modules: ModuleConstructor[] = [
  SystemModule,
  AuthModule,
  MyModule,   // ← add here
]
```

Only modules listed here are activated (`onInit()` + `start()`). Modules reached through
`imports` are loaded and wired, but not activated.

## Accessing Services Across Modules

Two methods, one rule: **`register()` is private, `share(to)` is public.** A module
sees another module's service only if it imports it and the other module binds that
key into its `to` in `share(to)`.

```ts
// other/module.ts
share(to: Container): void {
  to.bind(OtherServiceKey, () => new OtherService(/* private deps from this._container */))
}

// my/module.ts
readonly imports = [OtherModule]
// ...then in register()/start(): this._container.resolve<IOtherService>(OtherServiceKey)
```

- The importer owns the service: `share(to)` writes into the importer's container,
  and its `singleton`/`bind` lifecycle is decided there.
- A key not put into `to` never reaches the importer — private is enforced at runtime,
  not just by ArchSafe.
- An import cycle fails at startup with the full path, e.g. `a -> b -> a`.
- Importing a module does not activate it: `onInit()` and `start()` run only for
  modules listed in the process's `_modules[]`.
- `register()` is pure wiring; put side effects in `onInit()` so importing a module
  is cheap and cannot crash on a process-specific dependency.
- Depend on the other module's `contracts/index.ts` only (ArchSafe enforces this).

**Removed in 0.3.0:** `getImportModules()` — use the `imports` field instead, and move public
bindings out of `register()` into `share(to)`. `AppRegistry.getModule()`/`getContainer()` are
deprecated: bind shared singletons once in the process's `_registerCoreDependencies()` and
resolve them from the container instead.

## Built-in Modules

### SystemModule

Routes:
- `GET /health` — Full health status (DB + uptime)
- `GET /health/live` — Liveness probe (always 200 if process is running)
- `GET /health/ready` — Readiness probe (503 if DB is down)

### AuthModule

Routes:
- `POST /auth/register`
- `POST /auth/login`

Services registered:
- `TokenIssuer` → `InternalAuthProvider`
- `AuthRepository` → `AuthRepository`
- `AuthService` → `AuthService`

## Validation Middleware

Use the `validate` helper inside route handlers:

```ts
import { validate, getValidatedData } from "@shared/middleware/validator"

app.post("/route", validate(MySchema, "body"), async (c) => {
  const data = getValidatedData<MySchema>(c)
  // ...
})
```

Multi-source validation:

```ts
app.get("/route",
  validateMultiple([
    { schema: QuerySchema, source: "query" },
    { schema: HeaderSchema, source: "header" },
  ]),
  async (c) => { ... }
)
```
