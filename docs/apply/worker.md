# Worker Process — How To

Entry point: `src/processes/worker.ts` (`WorkerProcess`). Selected via `PROCESS_TYPE=worker`.

Ships with **no modules registered by default** (`_modules: []`) — it's a scaffold. Add subscriber modules by extending that array.

For the bootstrap sequence, the cross-process transport limitation, and graceful shutdown internals, see `docs/deeper/worker.md` — read it before you rely on publish/subscribe working across separate `http`/`worker` processes.

## EventBus

Type from `@event-bus-manager/core` (re-exported by `@shared/event-manager`):

| Method | Description |
|---|---|
| `start()` / `stop()` | Lifecycle |
| `publish(event: DomainEvent)` | Emit an event, returns handler IDs that received it |
| `subscribe(handler: EventHandler)` | Register a consumer for `handler.eventName` + `handler.eventVersion` |
| `registerRemoteHandler(...)` | Declare a queue target without creating a local consumer (publisher-role services) |

Configured entirely via env vars — see `config.md` → **Event Bus**.

## Existing Event Definitions

`src/shared/event-manager/events/` — defined but not yet published/subscribed anywhere in the codebase; use these as the pattern for new events.

| Event | Name | Payload |
|---|---|---|
| `UserCreated` | `user.created` v1 | `{ email, username }` |
| `UserUpdated` | `user.updated` v1 | `{ email, username }` |
| `AuthResetedPassword` | `auth.password-reseted` v1 | `{ email, username, resetLink }` |

## Subscribing to Events

```ts
import { EventBus, EventBusKey, type DomainEvent, type PayloadOf } from "@shared/event-manager";
import { UserCreated } from "@shared/event-manager/events";
import { Module } from "@shared/base/modules";

export class WelcomeEmailModule extends Module {
  readonly name = "welcome-email";

  register(): void {
    const eventBus = this.container.resolve<EventBus>(EventBusKey);

    eventBus.subscribe({
      eventName: UserCreated.name,
      eventVersion: UserCreated.version,
      handlerName: "welcome-email.send",
      handle: async (event: DomainEvent<PayloadOf<typeof UserCreated>>) => {
        // send the welcome email using event.payload.email
      },
    });
  }

  bootstrap(): void {}
}
```

Register the module by adding it to `WorkerProcess._modules` in `src/processes/worker.ts`.

## Publishing Events

From any module (typically in the HTTP process, e.g. after user registration):

```ts
import { createEvent } from "@shared/event-manager";
import { UserCreated } from "@shared/event-manager/events";

await eventBus.publish(createEvent(UserCreated, { email, username }));
```
