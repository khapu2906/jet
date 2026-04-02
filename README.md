# Jet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A modular TypeScript backend framework built on [Hono](https://hono.dev), with PostgreSQL, Drizzle ORM, and built-in event-driven architecture.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Web Framework**: Hono
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT + RBAC(Fire Shield)
- **Validation**: Valibot
- **Event Bus**: In-memory or pg-boss
- **Job Queue**: pg-boss
- **DI Container**: treasure-chest

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL (or Docker)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Start PostgreSQL via Docker
docker compose up -d

# Create database
pnpm run db:setup

# Run migrations
pnpm run db:migrate

# Start dev server
pnpm run dev
```

Server runs on `http://localhost:2906` by default.

## Scripts

### Development

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled output |
| `pnpm serve` | Build + start |
| `pnpm typecheck` | Type check without emitting |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Auto-fix lint issues |

### Database

| Command | Description |
|---|---|
| `pnpm db:setup` | Create database if not exists |
| `pnpm db:generate` | Generate migration files from schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema directly (no migration) |
| `pnpm db:status` | Check tables and migration status |
| `pnpm db:reset` | Drop all tables and types |
| `pnpm db:check` | Validate migration files |
| `pnpm db:test` | Test database connection |

## Project Structure

```
src/
├── index.ts                # Entry point
├── modules/                # Feature modules
│   ├── auth/               # Authentication module
│   └── system/             # Health checks
├── processes/
│   ├── main.ts             # API server process
│   └── worker.ts           # Background job worker
└── shared/                 # Shared infrastructure
    ├── auth/               # JWT, RBAC, middleware
    ├── config/             # App, auth, DB config
    ├── db/                 # Drizzle instance + schema
    ├── event-manager/      # Event bus
    ├── middleware/          # CORS, logging, rate limit, CSP
    └── errors/             # Error handling
```

## Environment Variables

See `.env.example` for all available options.

Key variables:

```env
NODE_ENV=development
PORT=2906

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=jet-db

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# Event Bus: "memory" or "pgboss"
EVENT_BUS_TYPE=memory
```

## Multi-Process Mode

The app can run as an API server or background worker:

```env
PROCESS_TYPE=api     # default — HTTP server
PROCESS_TYPE=worker  # background job processor
```

The worker process supports multi-threading via `WORKER_THREADS`:

```env
WORKER_THREADS=4     # spawn 4 independent consumer threads
```

Threads and instances scale independently — `WORKER_THREADS=4` across 3 instances gives 12 concurrent consumers on the same PgBoss queue.

## API Docs

In development mode, Swagger UI is available at:

```
http://localhost:2906/docs
```

## Documentation

| Doc | Description |
|---|---|
| [Architecture](docs/architecture.md) | Overview, lifecycle, request flow |
| [Modules](docs/modules.md) | Module system, DI, creating new modules |
| [Auth](docs/auth.md) | JWT, RBAC, register/login flow |
| [Responses](docs/responses.md) | Response format, error types, error handling |
| [Middleware](docs/middleware.md) | CORS, CSP, rate limiting, security headers |
| [Event Bus](docs/event-bus.md) | In-memory vs pg-boss, publish/subscribe |
| [Database](docs/database.md) | Schema, migrations, adding new tables |
| [Config](docs/config.md) | All environment variables and defaults |
