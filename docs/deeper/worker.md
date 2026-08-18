# Worker Process — Under the Hood

For the EventBus API, existing event definitions, and how to subscribe/publish, see `docs/apply/worker.md`.

## Bootstrap Sequence

```
1. _registerCoreDependencies()  → create + bind EventBus (db singleton also bound, currently unused)
2. _initModules()               → register() for each module in _modules[] (subscriptions
                                   are set up here, during module.register())
3. eventBus.start()
```

## The in-memory transport does not cross process boundaries

Only `EVENT_BUS_TYPE=memory` is currently supported (`redis`/queue fields exist in
`EventBusConfig` for a future backend, but no such backend is registered yet via
`registerEventBus()`).

**Important:** each process (`http`, `worker`, `scheduler`) calls `createEventBus()`
independently in its own `_registerCoreDependencies()` and gets its **own, separate**
in-memory bus instance — even when they all run in the same `PROCESS_TYPE=*` Node process.
With the current `memory` transport, publishing an event in the HTTP process does **not**
reach the worker process, because there is no shared object or channel between the two
`EventBus` instances — they're just two independent in-process pub/sub registries that happen
to share the same event/handler *names*, not the same subscriber list.

Cross-process delivery requires a real distributed backend (Redis/BullMQ/PgBoss, as mentioned
in the README) implemented against the same `EventBus` interface and registered via
`registerEventBus()` — until then, publish and subscribe only make sense within the same
process (e.g. a module that both publishes and consumes its own event, or tests).

## What `InMemoryEventBus` actually does when you publish

As of `@event-bus-manager/core` 0.2.2 (bumped from 0.1.12 — see `CHANGELOGS.md` in the
`event-bus-manager` repo), retry/concurrency infrastructure and an inbox dedup guard were
added to the shared `CoreEventBus` base class. Reading the actual implementation (not just the
changelog prose) matters, because it's easy to assume these apply uniformly to every
transport — they don't yet, for `memory`:

```ts
// CoreEventBus (shared by every transport)
protected async _executeHandlers(event: DomainEvent, handlers: EventHandler[]): Promise<void> {
  const results = await Promise.allSettled(
    handlers.map((h) => this._guardedHandle(event, h)),
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      this.logger.error(`Handler "${handlers[i]!.handlerName}" failed: ${result.reason}`);
    }
  });
}

// InMemoryEventBus
protected async _publishInternal(event: DomainEvent): Promise<string[]> {
  const handlers = this.handlers.get(this._eventKey(event.name, event.version)) || [];
  await this._executeHandlers(event, handlers);
  return [event.id];
}
```

Three things worth knowing before you rely on this in production:

- **Retry infrastructure exists now, but the `memory` transport doesn't call it.**
  `CoreEventBus._resolveRetryPolicy(handler)` (merges a handler's `EventHandler.retry` override
  over the bus-level `EVENT_BUS_MAX_RETRIES`/`EVENT_BUS_RETRY_DELAY` defaults) is a real method
  now — but `_executeHandlers`/`_guardedHandle` above never call it; they run each handler
  exactly once via `Promise.allSettled` and just log a rejection. Per the changelog, retry was
  wired in **per-transport**, into `@event-bus-manager/bullmq`'s real `Queue`/`Worker`
  `attempts`/`backoff` options and `@event-bus-manager/pgboss`'s `retryLimit`/`retryDelay` —
  not into the shared base class's generic executor. So with the `memory` transport (still the
  only one this app uses), a handler that throws still simply drops that delivery, silently
  from the publisher's point of view (`publish()` resolves successfully regardless).
  `EVENT_BUS_MAX_RETRIES`/`EVENT_BUS_RETRY_DELAY` become live the moment a real queue-backed
  transport is installed and registered — no application code change needed on the publish/
  subscribe side, since `EventHandler.retry` is just an optional per-handler override.
- **`subscribe()` no longer silently drops a `role="publisher"` bus's handler — but that fix
  is invisible on the `memory` transport specifically.** Previously `subscribe()` warned and
  returned immediately for `role: "publisher"`. Now it always calls `registerRemoteHandler()`
  first (recording the route, needed by transports that route jobs to a remote queue), and only
  skips the *local* `this.handlers.set(...)` registration for `role: "publisher"`.
  `InMemoryEventBus._publishInternal` only ever reads `this.handlers` — it never consults
  `remoteHandlers`/`_resolvePublishTargets` — so for this app's `memory` transport, a
  `role: "publisher"` bus still delivers nothing locally either way; the fix only matters once
  a transport that actually reads `remoteHandlers` (BullMQ/PgBoss) is in play.
- **`subscribe()` still silently no-ops if the handler is filtered out — unchanged.** If
  `EVENT_BUS_EVENTS` or `EVENT_BUS_WORKERS` is set to an explicit list (not `"*"`) that doesn't
  include this event/handler name, `subscribe()` returns early before even reaching the
  role/remote-handler logic above — without throwing or logging. A module can look correctly
  wired (calls `subscribe()`, no errors) and still never receive the event, purely because of
  an env var elsewhere. Worth checking first if a subscriber "isn't firing."
- **`role` still gates `publish` at the bus level.** `EVENT_BUS_ROLE=consumer` makes `publish()`
  throw. Default is `"both"`.

## Scaling

Run multiple `worker` instances to scale event/job processing horizontally (see README). Once
a real distributed transport is wired in, the transport itself is responsible for ensuring
each event is delivered to only one worker replica (typical queue semantics: one consumer
group, competing consumers) — the in-memory transport has no such guarantee since it isn't
shared across processes in the first place (see above), so today, scaling worker replicas only
helps if each replica's own in-process publishers/subscribers are independently useful (e.g.
CPU-bound work triggered by something other than cross-process events).

## Graceful Shutdown

On `SIGTERM`/`SIGINT`:

```
1. eventBus.stop()
2. module.cleanup()   → for each module, in reverse registration order
```
