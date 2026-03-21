# Middleware

All middleware is applied globally in `MainProcess.bootstrap()` in this order:

1. Request ID
2. CORS
3. Security Headers
4. Content Security Policy
5. Logging
6. Rate Limiting
7. Error Handler (catch-all)

## Request ID

Attaches a unique `X-Request-ID` to every request. Used by logging and exposed in response headers.

## CORS

```
Allowed methods:  GET, POST, PUT, DELETE, PATCH, OPTIONS
Allowed headers:  Content-Type, Authorization, X-Request-ID, X-User-Id, X-User-Email, X-User-Role
Exposed headers:  X-Request-ID
Credentials:      enabled
Max age:          86400s
```

Origins are validated dynamically. Wildcard `*` is rejected when credentials are enabled.

Configuration:

| Env Var | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` (dev) / `` (prod) | Allowed origins |

## Security Headers

Applied to all responses:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000` (production only) |
| `Permissions-Policy` | Disables camera, mic, geolocation, payment, USB, sensors |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

## Content Security Policy

- **`/docs/*`** routes: relaxed policy (allows Swagger UI CDN assets)
- **All other routes**: strict policy — no inline scripts, no eval, no external resources

## Logging

Logs every request with:
- Method, path, status code, duration (ms)
- Request ID
- Log level based on status: `5xx` → error, `4xx` → warn, `2xx` → info

Controlled by `LOG_LEVEL` env var.

## Rate Limiting

| Env Var | Default | Description |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | Toggle rate limiting |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `15m` | Time window (e.g. `1h`, `30s`) |

Key resolution order:
1. Authenticated users → `user:{sub}` (from JWT)
2. Unauthenticated → real IP from `X-Forwarded-For`
3. Fallback → `anonymous`

Uses `hono-rate-limiter` with draft-6 rate limit response headers.

## Error Handler

Centralized catch-all. Maps error types to HTTP responses:

| Error Type | Status |
|---|---|
| `ValidationError` | 422 |
| `UnauthorizedError` | 401 |
| `ConflictError` | 409 |
| Unhandled | 500 |
