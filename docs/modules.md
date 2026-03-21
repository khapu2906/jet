# Module System

## Creating a Module

```ts
import { Module } from "@shared/base/modules"

export class MyModule extends Module {
  // Declare dependencies on other modules
  getImportModules() {
    return [new OtherModule()]
  }

  // Bind services to DI container
  async register() {
    this.container.bind(MyServiceKey).to(MyService)
  }

  // Mount routes, return Hono app
  async bootstrap() {
    const app = new Hono()
    const service = this.container.get(MyServiceKey)

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
register()   → bind services to container
onInit()     → post-registration hook
bootstrap()  → mount routes / start consumers
onDestroy()  → cleanup on SIGTERM/SIGINT
```

## Accessing Services Across Modules

Cross-module access uses `AppFactory`:

```ts
import { AppFactory } from "@shared/factory"

const otherService = AppFactory.getModule(OtherModule)
  .getContainer()
  .get(OtherServiceKey)
```

Or declare the other module in `getImportModules()` — its container becomes available as a parent container.

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
