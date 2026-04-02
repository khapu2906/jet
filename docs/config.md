# Configuration Reference

All config is loaded from environment variables at startup. Invalid values cause a fatal error with a clear message.

## App

| Env Var | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `2906` | HTTP server port |
| `APP_HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGINS` | see below | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_MODE` | auto | `json` (prod) or `pretty` (dev), override with `LOG_MODE` |
| `SERVICE_NAME` | `app` | Service name in logs |

`CORS_ORIGINS` defaults:
- Development: `http://localhost:3000,http://localhost:3001`
- Production: empty (must be set explicitly)

## Database

| Env Var | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `jet-db` | Database name |
| `DB_SSL` | `false` | Enable SSL (`true` in production) |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Verify certificate |
| `DB_SSL_CA` | — | CA certificate content |
| `DB_DEBUG` | `false` | Log all SQL queries |

## Authentication

| Env Var | Default | Description |
|---|---|---|
| `JWT_SECRET` | `dev-secret` | Signing secret — **must be set in production** |
| `JWT_EXPIRES_IN` | `1h` | Access token expiration |
| `JWT_REFRESH_SECRET` | — | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiration |

## Rate Limiting

| Env Var | Default | Description |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | Toggle on/off |
| `RATE_LIMIT_MAX` | `100` | Requests per window |
| `RATE_LIMIT_WINDOW` | `15m` | Window duration (e.g. `1h`, `30s`) |

## Event Bus

| Env Var | Default | Description |
|---|---|---|
| `EVENT_BUS_TYPE` | `memory` | `memory` or `pgboss` |
| `EVENT_BUS_ROLE` | `both` | `both` \| `publisher` \| `consumer` |
| `EVENT_BUS_EVENTS` | `*` | Comma-separated event names or `*` |
| `EVENT_BUS_DEBUG` | — | Set to `true` for verbose logs |
| `EVENT_BUS_MAX_RETRIES` | `3` | Retry count on handler failure |
| `EVENT_BUS_RETRY_DELAY` | `5000` | Delay between retries (ms) |
| `EVENT_BUS_EVENT_TTL` | `24 hours` | Event expiry duration |
| `CLUSTER_ENABLED` | — | Forces `pgboss` when set to `true` |

## Process

| Env Var | Default | Description |
|---|---|---|
| `PROCESS_TYPE` | `api` | `api` \| `worker` |
| `WORKER_THREADS` | `1` | Number of worker threads per instance (worker process only) |
| `EMBEDDED_WORKER_THREADS` | `0` | Spawn N consumer threads inside the API process (disables consuming on main thread) |
