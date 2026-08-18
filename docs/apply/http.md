# HTTP Process — How To

Entry point: `src/processes/http.ts` (`HttpProcess`). Selected via `PROCESS_TYPE=http` (the default when unset).

For the bootstrap sequence and graceful shutdown internals, see `docs/deeper/http.md`.

## System Routes

| Route | Condition | Purpose |
|---|---|---|
| `GET /favicon.ico` | always | Returns 404 (avoids noisy 500s from browser favicon requests) |
| `GET /docs/json` | `NODE_ENV=development` | OpenAPI 3.1 spec, generated from mounted routes |
| `GET /docs/ui` | `NODE_ENV=development` | Swagger UI, backed by `/docs/json` |
| `/storage/*` | `STORAGE_PROVIDER=local` | Mounts `LocalStorage`'s router for serving/signing local files |

Health check routes (`/health`, `/health/live`, `/health/ready`) are registered by `SystemModule` — see `docs/apply/modules.md`.

`_modules` currently includes `SystemModule` and `AuthModule`. Add more by extending this array — see `docs/apply/modules.md`.

## Configuration

Relevant env vars: `PORT`, `APP_HOST` (hostname), `NODE_ENV`. Full reference in `config.md`.
