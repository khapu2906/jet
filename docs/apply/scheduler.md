# Scheduler Process — How To

Entry point: `src/processes/scheduler.ts` (`SchedulerProcess`). Selected via `PROCESS_TYPE=scheduler`.

For the bootstrap sequence, scaling caveats, and graceful shutdown internals, see `docs/deeper/scheduler.md`.

## SchedulerManager

Resolved from the container via `SchedulerKey` (`@shared/scheduler/manager`).

| Method | Description |
|---|---|
| `register(def: JobDefinition)` | Schedules a cron job. No-ops with a warning if `def.name` is already registered. |
| `stop()` | Gracefully shuts down all jobs (`node-schedule`'s `gracefulShutdown()` — waits for any in-flight run to finish) |
| `listJobs()` | Returns the list of registered job names |

`JobDefinition`:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique job name |
| `cron` | `string` | Cron expression, e.g. `"0 * * * *"` |
| `handler` | `() => Promise<void> \| void` | Job body |
| `runOnStart` | `boolean` (optional) | Also run once immediately on registration, in addition to the cron schedule |

## Defining a Job

```ts
// src/modules/demo-scheduler/module.ts
export class DemoSchedulerModule extends Module {
  readonly name = "demo-scheduler";

  register(): void {
    const scheduler = this.container.resolve<SchedulerManager>(SchedulerKey);

    scheduler.register({
      name: "demo-say-hello-every-minute",
      cron: "* * * * *",
      handler: () => demoJob.sayHello(),
    });
  }

  bootstrap(): void {}
}
```

Register the module by adding it to `SchedulerProcess._modules` in `src/processes/scheduler.ts`.

> Before scaling this process to more than one replica, read the **Scaling** section in `docs/deeper/scheduler.md` — it is not safe by default.
