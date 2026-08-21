# Jet Framework docs

Docs are split into **apply/** (how-to, copy-pasteable code) and **deeper/** (why, internal
mechanics/rationale) — one pair per topic:

- **[Getting Started](apply/getting-started.md)** — starting a *new* project from a tagged Jet
  release (`degit`, tarball, or `git clone`), as opposed to developing Jet itself.
- **[Architecture](apply/architecture.md)** ([deeper](deeper/architecture.md)) — process types
  (`http`/`worker`/`scheduler`), directory layout, request/worker/scheduler flow.
- **[Modules](apply/modules.md)** ([deeper](deeper/modules.md)) — the `Module` lifecycle, DI
  container, cross-module access (`getImportModules()` vs the `AppRegistry.getModule()` escape
  hatch).
- **[Auth](apply/auth.md)** ([deeper](deeper/auth.md)) — JWT payload, RBAC, register/login flow,
  adding a new auth provider.
- **[HTTP](apply/http.md)** ([deeper](deeper/http.md)) — HTTP process bootstrap, middleware
  order, graceful shutdown.
- **[Middleware](apply/middleware.md)** ([deeper](deeper/middleware.md)) — CORS, CSP, rate
  limiting, security headers.
- **[Worker](apply/worker.md)** ([deeper](deeper/worker.md)) — event bus, subscribing handlers,
  retry/delivery semantics.
- **[Scheduler](apply/scheduler.md)** ([deeper](deeper/scheduler.md)) — defining a cron job,
  concurrency safety, graceful shutdown.
- **[ArchSafe](apply/archsafe.md)** ([deeper](deeper/archsafe.md)) — the architecture rules
  enforced against this codebase, how to run/extend them.
- **[Responses](apply/responses.md)**, **[Database](apply/database.md)**,
  **[Config](apply/config.md)** — reference only, no deeper counterpart yet.

For conventions to follow when *adding* code on top of the framework (module folder shape, error
handling, DI for shared components, etc.), see **[AI code patterns](llm/code-pattern.md)** — also
what `CLAUDE.md` at the repo root is generated from.

For installation and running the server locally, see the root
[README](https://github.com/khapu2906/jet#getting-started).
