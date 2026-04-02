# Event Bus

## Overview

Pluggable event bus with two backends:

| Backend | Use Case |
|---|---|
| `memory` | Single-process, development |
| `pgboss` | Multi-process, production, durable |

Controlled by `EVENT_BUS_TYPE` env var. Automatically switches to `pgboss` when `CLUSTER_ENABLED=true`.

## Roles

| Role | Publish | Subscribe |
|---|---|---|
| `both` | Yes | Yes |
| `publisher` | Yes | No |
| `consumer` | No | Yes |

- **API process** → `both` (publishes domain events, can also subscribe)
- **API process** (split deployment) → `publisher` (separate worker handles consuming)
- **Worker process** → `consumer` (subscribes only)

## Creating Events

```ts
import { createEvent } from "@shared/event-manager/event"

const event = createEvent("user.registered", {
  userId: "abc",
  email: "user@example.com",
})
// → { name, payload, occurredAt: Date }
```

## Publishing Events

```ts
const eventBus = container.get(EventBusKey)
await eventBus.publish(event)
```

## Subscribing to Events

Implement `EventHandler` and register in your module:

```ts
class UserRegisteredHandler implements EventHandler {
  eventName = "user.registered"

  async handle(event: DomainEvent<{ userId: string }>) {
    // send welcome email, etc.
  }
}

// in Module.register():
const eventBus = container.get(EventBusKey)
eventBus.subscribe(new UserRegisteredHandler())
```

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `EVENT_BUS_TYPE` | `memory` | `memory` or `pgboss` |
| `EVENT_BUS_ROLE` | `both` | `both`, `publisher`, `consumer` |
| `EVENT_BUS_EVENTS` | `*` | Comma-separated event names or `*` |
| `EVENT_BUS_DEBUG` | — | Set to `true` for verbose logging |
| `EVENT_BUS_MAX_RETRIES` | `3` | Retry count on failure (pgboss only) |
| `EVENT_BUS_RETRY_DELAY` | `5000` | Delay between retries in ms |
| `EVENT_BUS_EVENT_TTL` | `24 hours` | Event time-to-live |

## Error Isolation

Handlers are run with `Promise.allSettled()` — one failing handler does not affect others.

## pgboss Notes

- Queue name = event name
- Events are persisted in PostgreSQL (survives restarts)
- Supports retry with configurable delay
- Archive interval: `1 hour` by default
- Archived events deleted after: `7 days` by default

## Worker Scaling

With `pgboss`, multiple consumers (threads or processes) can poll the same queue simultaneously. PgBoss uses `FOR UPDATE SKIP LOCKED` internally — jobs are never processed twice regardless of how many consumers are running.

```
# 4 threads × 3 instances = 12 concurrent consumers on the same queue
WORKER_THREADS=4
# scale instances via Docker / Kubernetes / PM2
```

See [Architecture](./architecture.md#worker-threading) for full details.
