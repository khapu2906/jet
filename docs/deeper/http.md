# HTTP Process — Under the Hood

For the system routes table and config, see `docs/apply/http.md`.

## Bootstrap Sequence

```
1. _registerCoreDependencies()  → bind DB, create + bind EventBus
2. _startInfrastructure()       → eventBus.start()
3. _initModules()               → register() + onInit() for each module in _modules[]
4. _setupMiddleware()           → global middleware stack (see docs/deeper/middleware.md)
5. _setupSystemRoutes()         → /favicon.ico, /docs/*, /storage/*
6. _bootstrapModules()          → module.bootstrap() → mount each module's router
7. serve()                      → start listening on config.hostname:config.port
```

## Graceful Shutdown

On `SIGTERM`/`SIGINT`, the process stops in two phases so an in-flight request is never cut off mid-response:

```
1. server.close()              → stop accepting new connections; requests
                                  already in progress keep running to completion
2. closeIdleConnections()      → polled every 250ms, closes keep-alive sockets
                                  as soon as they go idle (no need to wait out
                                  the full grace period for fast requests)
3. after 3s (grace period)     → any connection still open is force-closed via
                                  closeAllConnections()
4. proc.cleanup()              → eventBus.stop(), then each module's cleanup()
                                  in reverse registration order, then
                                  container.dispose()
```

The 3s grace period matters because Node's `server.close()` alone waits for **every** socket
to close — with HTTP keep-alive, a socket that just finished a response stays open waiting for
the next request, so without a force-close fallback the server would hang indefinitely on
shutdown. Polling `closeIdleConnections()` (rather than calling it once) is what lets fast
requests close out well before the full grace period elapses, instead of every shutdown taking
the full 3s regardless of how quickly in-flight work actually finished.

Shutdown across all process roles (when running `PROCESS_TYPE=*` in one Node process) is
coordinated centrally by `src/index.ts`: it waits for every role's stop function before
exiting, guards against duplicate signals, and force-exits after a shared 5s timeout if any
role's cleanup hangs. This exists specifically to avoid a race where, previously, each role
registered its own `SIGTERM` handler and called `process.exit()` independently — whichever
role finished cleanup first would kill the whole process mid-cleanup for the others.

## Storage: how the signed URL scheme actually works

`LocalStorage` (`src/shared/storage/providers/local.ts`), mounted at `/storage/*` when
`STORAGE_PROVIDER=local`, doesn't gate access with auth headers — it uses self-contained signed
URLs so a link can be handed to a browser/CDN directly:

```
signature = HMAC-SHA256(STORAGE_LOCAL_SECRET, `${key}:${expires}`)
url        = `${baseUrl}/${key}?expires=${expires}&signature=${signature}`
```

On `GET /storage/*`, the handler recomputes the same HMAC from the requested `key` + `expires`
query param and compares it to the provided `signature` with `timingSafeEqual` (not `===`) —
the same timing-attack rationale as password verification in `docs/deeper/auth.md`. Requests
past `expires` (or with a missing/short/mismatched signature) get `403`, never touching disk.

**Caveat for anyone adding an upload endpoint:** `_filePath()` builds the on-disk path with
plain `path.join(this._dir, key)`, which does **not** neutralize `..` segments —
`join("/data/storage", "../../etc/passwd")` resolves outside `_dir`. Nothing in the codebase
currently calls `storage.upload()`/`getSignedUrl()` with a client-supplied `key` (the module is
mounted but unused so far), so this isn't exploitable today — but it means the first module
that wires up file uploads must generate `key` itself (e.g. a UUID + fixed extension) rather
than deriving it from user-supplied input (a filename, a path parameter, etc.) unsanitized.
