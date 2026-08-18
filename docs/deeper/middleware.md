# Middleware — Under the Hood

For the actual header values/config knobs, see `docs/apply/middleware.md`.

## Execution Order

All middleware is applied globally in `HttpProcess._setupMiddleware()`, in this fixed order:

```
1. Request ID
2. CORS
3. Security Headers
4. Content Security Policy
5. Logging
6. Rate Limiting
7. Error Handler (catch-all, via app.onError() — wraps everything above)
```

This order is not arbitrary:

- **Request ID first** — every middleware and log line after it (and the error handler, if
  something throws) needs the ID already attached to the context to include it.
- **CORS before everything else in the chain** — Hono's `cors()` middleware answers `OPTIONS`
  preflight requests itself and returns without calling `next()`, so a preflight request never
  reaches security headers, logging, or rate limiting at all. If CORS ran later, preflight
  requests would incur (and count against) all of that unnecessarily.
- **Rate Limiting last, right before the route handler** — a request only consumes a client's
  quota once it has already passed CORS/security checks. Placing it earlier would mean
  requests that CORS or a security layer would reject anyway still burn through the client's
  rate limit budget.
- **Error Handler is registered via `app.onError()`, not as a positional middleware** — it
  wraps the entire chain, so an exception thrown by CORS, security headers, logging, rate
  limiting, or the route handler is all normalized the same way (see `docs/apply/responses.md`
  for the error shape).

## CORS: why wildcard silently returns `null`

`setupCors()` (`src/shared/middleware/setup.ts`) passes a function to Hono's `cors()` `origin`
option rather than a static list, specifically to reject `CORS_ORIGINS=*` when credentials are
enabled:

```ts
origin: (origin) => {
  if (allowedOrigins.includes("*")) {
    Logger.warn("SECURITY WARNING: CORS wildcard (*) is enabled...");
    return null; // never reflect the request's Origin back
  }
  return allowedOrigins.includes(origin) ? origin : null;
},
credentials: true,
```

Browsers refuse `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true`
— sending both would make the browser drop the credentialed response anyway. Rather than
special-case `credentials` per-origin, this middleware always runs with `credentials: true`
and instead treats `*` in config as a misconfiguration: it logs a warning and returns `null`
(deny) for every origin, so a config mistake fails closed (no CORS access at all) instead of
silently disabling credentials or reflecting an attacker-controlled `Origin` header.

## Content Security Policy: two policies, not one

`setupContentSecurityPolicy()` branches on `c.req.path.startsWith("/docs")`:

- **`/docs/*`** allows `'unsafe-inline'` scripts/styles and the `cdn.jsdelivr.net` /
  `fonts.googleapis.com` origins — Swagger UI's bundled assets need inline `<script>`/`<style>`
  and load its JS/CSS/fonts from that CDN. `'unsafe-eval'` is deliberately **not** included
  (the in-code comment calls this out as a hardening step versus a more permissive default) —
  if a future Swagger UI version needs `eval`, the fix path noted in the source is to self-host
  the assets or use CSP nonces instead of loosening this further.
- **Every other route** gets a maximally strict policy: `script-src 'none'`, `style-src 'none'`,
  `img-src 'none'`, `object-src 'none'`, `form-action 'none'`. This is a JSON API — no page on
  it is expected to load a script, stylesheet, or image at all, so the policy denies all of
  them outright rather than allowlisting specific sources.

## Security Headers: the extra layer beyond Hono's `secureHeaders()`

`setupSecurityHeaders()` doesn't rely on `secureHeaders()` alone — it calls it for the
"standard" headers (`X-Frame-Options`, `X-Content-Type-Options`, HSTS, etc.) with
`crossOriginResourcePolicy: false`, then sets several more headers manually **inside** the
`next()` callback passed to it. That ordering is deliberate, not incidental: `secureHeaders()`
applies its headers *after* `next()` resolves (see its `setHeaders()` internals), so if CORP
were left enabled inside `secureHeaders()`'s own config it would run after — and overwrite —
the per-route CORP value this middleware sets manually. The manual block also branches CORP
and COEP/COOP on `/storage`:

- `/storage/*` → `Cross-Origin-Resource-Policy: cross-origin` (so a frontend on a different
  origin/port can actually load the media it points to), and COEP/COOP are skipped entirely
  for that path (both would be meaningless/conflicting on a raw file response).
- everything else → `Cross-Origin-Resource-Policy: same-origin` plus
  `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin`,
  the standard "cross-origin isolation" trio.

## Rate Limiting: the per-route override system

`docs/apply/middleware.md` documents the app-wide defaults, but there's a whole extension
point behind them that isn't a config value at all: `RateLimitRegistry`
(`src/shared/middleware/rate-limit-registry.ts`) — a container-managed service, not a
module-level singleton. `HttpProcess._registerCoreDependencies()` binds it:

```ts
this._container.singleton(RateLimitRegistryKey, () => new RateLimitRegistry());
```

Any module resolves it the same way it resolves `DbKey`/`EventBusKey`, and calls `register()`
**during its own `register()`** (i.e. before the server starts accepting traffic):

```ts
const rateLimitRegistry = this.container.resolve<RateLimitRegistry>(RateLimitRegistryKey);
rateLimitRegistry.register("/auth/login", {
  limit: 10,
  windowMs: 60_000,
  // or: enabled: false to bypass entirely for this prefix
});
```

`AuthModule` is the one consumer today: `/auth/register` gets `limit: 5, windowMs: 60_000` and
`/auth/login` gets `limit: 10, windowMs: 60_000` — both tighter than the app-wide default,
specifically because these two routes are unauthenticated by nature (no user identity yet to
key a limit by), so the generic per-IP default would let a script spam account creation /
login attempts well within budget. See `docs/apply/middleware.md` for the values.

**Why `register()`/`build()`/`resolve()` are three separate steps, not one.** Earlier this
class lazily built (and cached) each prefix's `hono-rate-limiter` instance the first time a
matching request came in — i.e. the hot request path did construction *and* mutated shared
cache state as a side effect of handling a request. That's technically race-free under Node's
single-threaded synchronous execution, but it's a fragile invariant (it would become a real
race if the construction path ever went async — `hono-rate-limiter`'s `keyGenerator` type
already supports returning a `Promise`, this codebase's just doesn't use one yet) and it means
the *first* request to hit each new prefix pays a construction cost the rest don't. The fix
splits the lifecycle into three explicit phases:

1. `register(prefix, override)` — called by modules during their own `register()`. Throws if
   called after `build()`, since that would mean a request already arrived before this module's
   overrides existed.
2. `build(defaults)` — called exactly once, in `HttpProcess._setupMiddleware()`, **after**
   `_initModules()` has already run every module's `register()`. Constructs every
   `hono-rate-limiter` instance (default + every override) up front.
3. `resolve(path)` — called per-request by the middleware `createRateLimitMiddleware()`
   returns. Pure `Map` lookup against what `build()` already constructed — no construction, no
   mutation, safe on the hot path regardless of what the underlying limiter library's
   construction path does in the future.

Two things worth knowing about the default key resolution
(`defaultKeyGenerator` in `security.ts`):

- **The JWT `sub` is decoded, not verified, purely to pick a rate-limit bucket.** It
  base64url-decodes the payload segment of the `Authorization: Bearer` token *without*
  checking the signature — explicitly documented in the source as "not for authorization,"
  since the real `authenticate` middleware verifies the token properly later in the request.
  This is intentional and safe for its narrow purpose (bucketing) but would be a real bug if
  ever repurposed to make an authorization decision.
- **The rate limit store is in-memory and per-process.** `hono-rate-limiter` here uses its
  default in-memory store, not shared across processes — exactly the same shape of limitation
  as the `EventBus` memory transport (see `docs/deeper/worker.md`). Running N replicas of the
  `http` process means each replica enforces `RATE_LIMIT_MAX` independently, so the effective
  limit for a client hitting a load-balanced pool is closer to `RATE_LIMIT_MAX × N`, not
  `RATE_LIMIT_MAX`. A shared store (e.g. the Redis adapter `hono-rate-limiter` ships) is
  necessary before this guarantee holds across more than one replica.
