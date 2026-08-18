# Architecture — Reference

For the internal lifecycle, request flow, and design principles, see `docs/deeper/architecture.md`.

## Multi-Process Design

The application supports three process types, controlled by the `PROCESS_TYPE` environment variable:

```
PROCESS_TYPE=http         # HTTP API server (default)
PROCESS_TYPE=worker      # Background job consumer
PROCESS_TYPE=scheduler   # Scheduled job trigger service
```

All processes share the same module system and dependency injection container, but initialize different runtime infrastructure depending on their role. See `docs/apply/http.md`, `docs/apply/worker.md`, `docs/apply/scheduler.md` for each.

## Worker Scaling

To scale background processing, run multiple `worker` instances. Jobs are distributed across all workers to ensure horizontal scalability.

```yaml
worker:
  environment:
    PROCESS_TYPE: worker
  deploy:
    replicas: 4
```

> Note: Job distribution behavior depends on the underlying queue system (e.g. PgBoss / Redis queue). Ensure your job system supports concurrency and deduplication. See `docs/deeper/worker.md` for the current state of the event bus transport.

## Directory Layout

```
src/
├── index.ts                   # Entry point: selects process type
├── processes/
│   ├── http.ts                # HTTP API server process
│   ├── worker.ts             # Background job worker process
│   └── scheduler.ts          # Scheduled job process
│
├── modules/
│   ├── auth/                 # Authentication module
│   ├── user-scheduler/      # Scheduler-based user jobs
│   └── system/              # Health check / system utilities
│
└── shared/
    ├── base/
    │   ├── modules.ts        # Base Module abstraction
    │   └── processes.ts      # BaseProcess + Runner abstraction
    │
    ├── factory.ts           # AppFactory / container bootstrap
    ├── auth/                # JWT, RBAC, auth middleware
    ├── config/              # Environment configuration
    ├── db/                  # Drizzle ORM instance + schema
    ├── doc/                 # API documentation (Swagger/OpenAPI)
    ├── dto/                 # Shared DTO definitions
    ├── event-manager/       # Event bus abstraction
    ├── middleware/          # Global middleware stack
    ├── errors/              # Error types + handlers
    ├── logger/              # Logging system
    ├── storage/             # Storage abstraction layer
    ├── scheduler/           # Scheduler abstraction layer
    └── utils/               # Shared utilities
```
