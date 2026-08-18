# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions
prior to 0.1.11 predate this file and aren't documented in detail here — see `git log` for
that history.

## [0.1.15] - 2026-08-18

### Added
- `docs/apply/` and `docs/deeper/` — documentation split by intent: `apply/` for practical
  API/config reference used while writing code, `deeper/` for internal mechanics and design
  rationale. Covers `http`, `worker`, `scheduler`, `auth`, `middleware`, `modules`, and
  `architecture`.
- Per-route rate limit overrides for `POST /auth/register` (5 requests/min) and
  `POST /auth/login` (10 requests/min) — tighter than the app-wide default, since both are
  unauthenticated endpoints with no user identity to key a limit by.

### Changed
- `RateLimitRegistry` (`src/shared/middleware/rate-limit-registry.ts`) is now a DI
  container-managed singleton (`RateLimitRegistryKey`), resolved the same way as
  `DbKey`/`EventBusKey`, instead of a bare module-level `export const`. Its lifecycle is split
  into three explicit phases — `register()` (module init time) → `build()` (once, during
  `HttpProcess._setupMiddleware()`) → `resolve()` (pure lookup on the hot request path, no
  construction or cache mutation as a side effect of handling a request).
- `src/shared/config/`: extracted `NODE_ENV` parsing into the dependency-free `env.ts` leaf
  module. `auth.ts`, `database.ts`, `logger.ts`, and `security.ts` now import `nodeEnv` from
  there directly instead of importing the whole `appConfig` object just to read one field.
  `config.security` and `config.logger` are now nested the same way as `config.database` and
  `config.auth`, instead of being spread flat (and, for `security`, silently duplicated —
  `security.ts` previously re-parsed `CORS_ORIGINS`/`RATE_LIMIT_*` independently of `app.ts`
  without ever being wired into the exported `config`).
- Graceful shutdown:
  - `src/processes/http.ts` — the HTTP server now stops accepting new connections
    (`server.close()`) and lets in-flight requests finish before force-closing anything;
    previously it force-closed every connection immediately on `SIGTERM`, cutting off requests
    already in progress. Idle keep-alive connections are closed proactively (polled every
    250ms) instead of waiting out the full 3s grace period regardless of how fast requests
    actually finished.
  - `src/index.ts` / `src/shared/base/processes.ts` — shutdown across multiple process roles
    (`PROCESS_TYPE=*`) is now coordinated by a single handler that waits for every role's
    cleanup before exiting, with a re-entrancy guard against duplicate signals. Previously each
    role registered its own `SIGTERM` handler and called `process.exit()` independently —
    whichever finished first could kill the process mid-cleanup for the others.
- `docs/llm/code-pattern.md` rewritten to match this repository's actual code. The previous
  version referenced modules (`scheduling`, `catalog`, `vehicles`), files
  (`shared/idempotency/`, `code-architecture.md`), and infrastructure (a 3-way `tsconfig`
  split, a configured Vitest setup) that don't exist in this repository.

### Fixed
- Removed a duplicate `createSuccessResponseDto` definition in `src/shared/utils/pagination.ts`
  that shadowed the real one in `src/shared/dto/responses.dto.ts` and was never imported
  anywhere.
- Replaced every `any` generic constraint in `src/shared/` (`v.BaseSchema<any, any, any>`,
  7 occurrences across 4 files) with Valibot's own `v.GenericSchema` — no `eslint-disable`
  needed for any of them anymore.
- `POST /auth/register` now actually returns `201 Created`. The handler had an unreachable
  `return c.json(result, 201)` after an earlier `return`, so the endpoint always fell back to
  the default `200` regardless of the `201` declared in its OpenAPI doc.

## [0.1.11] - 2026-08-17

### Fixed
- Graceful shutdown race condition when running multiple process roles in one Node process
  (`PROCESS_TYPE=*`): each role used to install its own `SIGTERM`/`SIGINT` handler and call
  `process.exit()` independently — whichever finished cleanup first killed the whole process,
  cutting off the others mid-cleanup.
- HTTP server no longer drops in-flight requests on shutdown — it used to force-close every
  connection (`closeAllConnections()`) before stopping new traffic, aborting requests already
  being handled.

### Changed
- Added a proper multi-stage production `Dockerfile` (deps → build → migration →
  production-deps → runtime), running as a non-root user, with `CMD` in exec form so `node`
  runs as PID 1 and receives `SIGTERM` directly from `docker stop`.
- Removed `docker-entrypoint.sh`; DB migrations now run as a separate `migration` build target
  executed by the deploy pipeline instead of on every container start.
- Migrated package management from Yarn to npm (`yarn.lock` removed).
