# Scheduler Process — Under the Hood

For the `SchedulerManager` API and how to define a job, see `docs/apply/scheduler.md`.

## Bootstrap Sequence

```
1. _registerCoreDependencies()  → create + bind EventBus, create + bind SchedulerManager
2. _initModules()               → register() for each module in _modules[] (jobs are
                                   registered here, synchronously, during module.register())
3. eventBus.start()
4. Log loaded modules + registered job names
```

`_modules` currently includes only `DemoSchedulerModule` (a working example).

`SchedulerKey`/`ISchedulerManager` live in `shared/scheduler/contracts.ts`, separate from the
concrete `SchedulerManager` class in `manager.ts` — the same contract-vs-implementation split
used inside feature modules (see `docs/llm/code-pattern.md` §1), applied here to a shared
service instead of a module. `_registerCoreDependencies()` still constructs the concrete class
(`new SchedulerManager()`) since that's the one place actually allowed to, but every consumer
resolves the interface.

## Overlapping runs are not prevented

`node-schedule`'s `Job` tracks how many invocations of itself are currently running
(`triggeredJobs()`/`trackInvocation()`), but that's bookkeeping, not a lock — it does **not**
skip or queue a new firing just because the previous one hasn't finished. `SchedulerManager.register()`
doesn't add its own guard either: it schedules `def.handler` as-is. So a job whose cron
(`"* * * * *"`, every minute) fires more often than its `handler` reliably completes will have
two (or more) invocations running concurrently, each independently logged as
"Running job" / "Job completed". If a job's side effects aren't safe to run concurrently with
itself (e.g. it writes to the same DB row without a constraint, or calls a rate-limited
external API), the job's own `handler` is responsible for guarding against that — e.g. a
lightweight in-memory flag (`if (running) return`) for single-instance jobs, or the same
Postgres advisory lock mentioned below for multi-replica ones.

## Scaling — why this process does not scale horizontally by default

`node-schedule` runs entirely in-process — there is no distributed lock or leader election
between instances. **Run exactly one scheduler instance.** Running multiple replicas of the
scheduler process will fire every job that many times concurrently, on every tick, since each
replica has no knowledge of the others. This is different from the worker process, which is
designed to be scaled horizontally (its unit of work — a consumed event — is meant to be
picked up by exactly one consumer, whereas a cron trigger fires unconditionally on a timer in
every replica that has it registered).

If you need scheduler high-availability, add distributed locking (e.g. a Postgres advisory
lock acquired at the top of each job's `handler`, released when it finishes) before running
more than one replica — the lock, not the process count, is what would make it safe to scale.

## Graceful Shutdown

On `SIGTERM`/`SIGINT`:

```
1. scheduler.stop()   → node-schedule gracefulShutdown(): waits for any job
                         currently executing to finish, then cancels all
                         scheduled triggers
2. eventBus.stop()
3. module.cleanup()   → for each module, in reverse registration order
```

Waiting for the in-flight job to finish (rather than cancelling it outright) matters because
job handlers are typically not idempotent-safe to interrupt mid-way — better to let a job that
already started finish once than to abort it and risk a partial side effect.
