# Module System

## Creating a Module

```ts
import { Module, type ModuleConstructor } from "@shared/base/modules"

export class MyModule extends Module {
  // Declare dependencies on other modules — pass the CLASS, not an instance
  // (the base Module class instantiates it for you, sharing your container)
  protected getImportModules(): ModuleConstructor[] {
    return [OtherModule]
  }

  // Bind services this module exposes to other modules (via getImportModules())
  // — called automatically when another module imports this one, and by your
  // own register() below when this module is bootstrapped as a top-level module.
  override share(): void {
    this.container.bind(MyServiceKey, (c) => new MyService(c.resolve(OtherServiceKey)))
  }

  // Bind the rest of this module's own dependencies to the DI container
  register(): void {
    this.share()
  }

  // Mount routes, return Hono app
  bootstrap() {
    const app = new Hono()
    const service = this.container.resolve(MyServiceKey)

    app.get("/my-route", (c) => c.json({ ok: true }))
    return app
  }

  // Cleanup on shutdown
  async onDestroy() {
    // close connections, etc.
  }
}
```

## Registering a Module

Add it to the process:

```ts
// src/processes/main.ts
protected get _modules() {
  return [
    new SystemModule(),
    new AuthModule(),
    new MyModule(),   // ← add here
  ]
}
```

## Module Lifecycle

```
share()      → (when imported by another module, or called by your own register()) bind this
               module's exposed services into the shared container
register()   → bind this module's own dependencies to the container
onInit()     → post-registration hook
bootstrap()  → mount routes / start consumers
onDestroy()  → cleanup on SIGTERM/SIGINT
```

`getImportModules()` runs earliest of all — at construction time — so imported modules'
`share()` bindings are already available in the container before `register()`/`onInit()` run.

## Accessing Services Across Modules

**Preferred: declare the dependency in `getImportModules()`.** The base `Module` class
instantiates the listed module, sharing your own container with it, and calls its `share()`
immediately so its bindings become available to you:

```ts
protected getImportModules(): ModuleConstructor[] {
  return [OtherModule]
}
// ...then anywhere after: this.container.resolve<IOtherService>(OtherServiceKey)
```

This works even when `OtherModule` is *also* independently registered as its own top-level
module elsewhere (mounting its own routes) — you'll get your own private instance of its
service, which is safe as long as that service is stateless (wraps a repository backed by a
root-container singleton `Database`, not in-memory state). This is the convention used
throughout the codebase — don't reach for the escape hatch below unless you have a concrete
reason.

**Escape hatch: `AppFactory.getModule()`.** Retrieves the *exact same* instance of an
already-initialized top-level module (not a new copy) — only needed if the target service is
genuinely stateful and callers must share one instance:

```ts
import { AppFactory } from "@shared/factory"

const otherModule = AppFactory.getModule("other") // module.name, not the class
if (!otherModule) throw new Error("OtherModule must be registered before this module in _modules[]")
const otherService = otherModule.getContainer().resolve<IOtherService>(OtherServiceKey)
```

Note this only works if `OtherModule` is listed **before** the calling module in the process's
`_modules[]` array — `getImportModules()` has no such ordering requirement, which is the main
reason to prefer it.

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
