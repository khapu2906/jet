# Module System — How To

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

## Accessing Services Across Modules

**Preferred: declare the dependency in `getImportModules()`.**

```ts
protected getImportModules(): ModuleConstructor[] {
  return [OtherModule]
}
// ...then anywhere after: this.container.resolve<IOtherService>(OtherServiceKey)
```

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
reason to prefer it. See `docs/deeper/modules.md` for why.

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
