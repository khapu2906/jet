# Architecture Overview

## Multi-Process Design

The app supports two process types, controlled by the `PROCESS_TYPE` env var:

```
PROCESS_TYPE=api     # HTTP server (default)
PROCESS_TYPE=worker  # Background job consumer
```

Both processes share the same module system and dependency injection container but initialize different infrastructure.

## Application Lifecycle

```
index.ts
  └─ PROCESS_TYPE → MainProcess | WorkerProcess
        └─ BaseProcess
              1. _registerCoreDependencies()   ← DB, EventBus
              2. _initModules()                ← register() + onInit()
              3. bootstrap()                   ← start server / start consumer
              4. SIGTERM/SIGINT → cleanup()    ← graceful shutdown
```

## Module System

Each feature is encapsulated in a `Module` class:

```ts
class AuthModule extends Module {
  register()    // bind services to DI container
  bootstrap()   // mount routes, return Hono app
  onDestroy()   // cleanup resources
}
```

Modules declare their dependencies via `getImportModules()` — the framework resolves and initializes them automatically, sharing parent containers.

## Dependency Injection

Uses the `treasure-chest` library. Services are bound to containers using Symbol keys:

```ts
container.bind(AuthServiceKey).to(AuthService)
```

Modules have child containers that inherit from the root container, enabling cross-module resolution while keeping boundaries clean.

## Request Flow (API Process)

```
HTTP Request
  → Request ID
  → CORS
  → Security Headers
  → CSP
  → Logging
  → Rate Limit
  → Route Handler
      → Validation Middleware
      → Controller (Service call)
      → Response
  → Error Handler (on exception)
```

## Directory Layout

```
src/
├── index.ts                   # Entry: selects process type
├── processes/
│   ├── main.ts                # API server process
│   └── worker.ts              # Background job process
├── modules/
│   ├── auth/                  # Auth feature module
│   └── system/                # Health check module
└── shared/
    ├── base/
    │   ├── modules.ts         # Abstract Module base class
    │   └── processes.ts       # Abstract BaseProcess + Runner
    ├── factory.ts             # AppFactory: global container registry
    ├── auth/                  # JWT, RBAC, middleware
    ├── config/                # All env-based config
    ├── db/                    # Drizzle instance + schema
    ├── event-manager/         # Event bus abstraction
    ├── middleware/            # Global middleware
    └── errors/                # Error types + handler
```
