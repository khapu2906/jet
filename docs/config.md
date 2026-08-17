
# Configuration Reference

All config is loaded from environment variables at startup. Invalid values cause a fatal error with a clear message.

## App

| Env Var              | Default       | Description                                                   |
| -------------------- | ------------- | ------------------------------------------------------------- |
| `NODE_ENV`           | `development` | `development` | `production` | `staging`                      |
| `PORT`               | `2906`        | HTTP server port                                              |
| `APP_HOST`           | `0.0.0.0`     | Bind address                                                  |
| `CORS_ORIGINS`       | see below     | Comma-separated allowed origins                               |
| `LOG_LEVEL`          | `info`        | `debug` | `info` | `warn` | `error`                           |
| `LOG_MODE`           | auto          | `json` (production default) or `pretty` (development default) |
| `RATE_LIMIT_ENABLED` | `true`        | Toggle rate limiting (disabled only if `"false"`)             |
| `RATE_LIMIT_MAX`     | `100`         | Requests per window                                           |
| `RATE_LIMIT_WINDOW`  | `15m`         | Window duration (e.g. `1h`, `30s`)                            |

`CORS_ORIGINS` defaults:

* Development: `http://localhost:3000,http://localhost:3001`
* Production: empty (must be set explicitly)

---

## Database

| Env Var                      | Default       | Description                          |
| ---------------------------- | ------------- | ------------------------------------ |
| `DB_HOST`                    | `localhost`   | PostgreSQL host                      |
| `DB_PORT`                    | `5432`        | PostgreSQL port                      |
| `DB_USER`                    | `postgres`    | Database user                        |
| `DB_PASSWORD`                | `postgres`    | Database password                    |
| `DB_NAME`                    | `Flint-ai-ai` | Database name                        |
| `DB_SSL`                     | `false`       | Enable SSL (non-production only)     |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true`        | Verify certificate (production only) |
| `DB_SSL_CA`                  | —             | CA certificate content               |
| `DB_DEBUG`                   | `false`       | Log all SQL queries                  |

**Production requirement:**

* `DB_USER` must be set
* `DB_PASSWORD` must be set
  Otherwise app will fail on startup.

---

## Authentication

| Env Var                  | Default      | Description              |
| ------------------------ | ------------ | ------------------------ |
| `JWT_SECRET`             | `dev-secret` | Signing secret           |
| `JWT_EXPIRES_IN`         | `1h`         | Access token expiration  |
| `JWT_REFRESH_SECRET`     | —            | Refresh token secret     |
| `JWT_REFRESH_EXPIRES_IN` | `7d`         | Refresh token expiration |

**Production rule:**

* `JWT_SECRET` must NOT be `dev-secret` (fatal error)

---

## Event Bus

| Env Var                              | Default     | Description                                 |
| ------------------------------------ | ----------- | ------------------------------------------- |
| `EVENT_BUS_TYPE`                     | `memory`    | Only `memory` supported                     |
| `EVENT_BUS_ROLE`                     | `both`      | `both` | `publisher` | `consumer`           |
| `EVENT_BUS_WORKERS`                  | `*`         | Worker filter (`*` or comma-separated list) |
| `EVENT_BUS_EVENTS`                   | `*`         | Event filter (`*` or comma-separated list)  |
| `EVENT_BUS_DEBUG`                    | `false`     | Enable debug logs                           |
| `EVENT_BUS_MAX_RETRIES`              | `3`         | Retry count on failure                      |
| `EVENT_BUS_RETRY_DELAY`              | `5000`      | Retry delay (ms)                            |
| `REDIS_HOST`                         | `localhost` | Redis host                                  |
| `REDIS_PORT`                         | `6379`      | Redis port                                  |
| `EVENT_BUS_EVENT_TTL`                | `24 hours`  | Event expiration                            |
| `EVENT_BUS_ARCHIVE_INTERVAL`         | `1 hour`    | Archive interval                            |
| `EVENT_BUS_DELETE_ARCHIVED_INTERVAL` | `7 days`    | Cleanup interval                            |

**Notes:**

* `CLUSTER_ENABLED` exists in runtime but is not validated in schema
* Only `memory` transport is currently supported

---

## Process

| Env Var        | Default | Description      |
| -------------- | ------- | ---------------- |
| `PROCESS_TYPE` | `*`   | `http`,`worker`,`scheduler`, `*` |

---

## Storage

| Env Var                   | Default                         | Description                                         |
| ------------------------- | ------------------------------- | --------------------------------------------------- |
| `STORAGE_PROVIDER`        | `local`                         | Storage provider                                    |
| `STORAGE_LOCAL_DIR`       | `.tmp/storage`                  | Local storage directory (resolved to absolute path) |
| `STORAGE_LOCAL_BASE_URL`  | `http://localhost:2906/storage` | Base URL                                            |
| `STORAGE_LOCAL_SECRET`    | `change-me-in-production`       | Signing secret                                      |
| `DEFAULT_STORAGE_EXPIRES` | `300`                           | Default expiry time (seconds)                       |

---

**Storage behavior:**

* If `STORAGE_LOCAL_DIR` is empty → fallback to:

  ```
  <cwd>/.tmp/storage
  ```

---

## Logger

| Env Var        | Default | Description                                  |
| -------------- | ------- | -------------------------------------------- |
| `LOG_LEVEL`    | `info`  | Log level                                    |
| `LOG_MODE`     | auto    | `json` (production) | `pretty` (development) |
| `SERVICE_NAME` | `app`   | Service name in logs                         |

---

## Summary Notes

* All envs are validated at startup using `valibot`
* Invalid configuration causes **fatal error**
* Some production-only checks:

  * Missing DB credentials → crash
  * Default JWT secret → crash
* Rate limiting is enabled unless explicitly `"false"`
