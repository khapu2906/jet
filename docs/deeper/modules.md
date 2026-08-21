# Module System — Under the Hood

For the practical how-to (creating/registering a module, built-in routes), see `docs/apply/modules.md`.

## Module Lifecycle

```
share()      → (when imported by another module, or called by your own register()) bind this
               module's exposed services into the shared container
register()   → bind this module's own dependencies to the container
onInit()     → post-registration hook
bootstrap()  → mount routes / start consumers
onDestroy()  → cleanup on SIGTERM/SIGINT
```

`getImportModules()` runs earliest of all — at construction time (`Module`'s constructor calls
`_setupContainer()`, which instantiates every imported module and calls its `share()`
immediately) — so imported modules' bindings are already available in the container before
`register()`/`onInit()` run on the importing module.

The public API a process calls is actually `__init()` (register → onInit, recursing into
imports first) and `cleanup()` (onDestroy, recursing into imports in reverse, then
`container.dispose()`) — `register()`/`onInit()`/`onDestroy()` are the hooks you override,
`__init()`/`cleanup()` are the orchestration around them and are idempotent (guarded by
internal `_initialized`/`_destroyed` flags), so calling `cleanup()` twice is safe.

## Accessing Services Across Modules — why prefer `getImportModules()`

`getImportModules()` works even when `OtherModule` is *also* independently registered as its
own top-level module elsewhere (mounting its own routes) — you get your own **private
instance** of its service. This is safe as long as that service is stateless (e.g. it wraps a
repository backed by a root-container singleton `Database`, not in-memory state) — two
instances backed by the same DB connection behave identically to callers. This is the
convention used throughout the codebase.

The escape hatch, `AppRegistry.getModule()`, instead retrieves the *exact same* instance of an
already-initialized top-level module — only needed if the target service is genuinely
stateful and callers must share one instance (e.g. an in-memory cache or connection pool that
would duplicate resources if instantiated twice). Its ordering requirement (`OtherModule` must
appear earlier in `_modules[]`) is the main reason `getImportModules()` is preferred by
default — it has no such ordering constraint, since the DI container resolves it eagerly at
construction time regardless of array order.

## The DI container underneath: `@khapu2906/treasure-chest`

`this.container` (and `AppRegistry.rootContainer`) is an instance of `Container` from this
package. `Module`'s `container.bind(...)`/`.singleton(...)` calls used throughout the codebase
are only two of several lifecycles it actually supports:

| Method | Lifecycle | New instance when? |
|---|---|---|
| `bind(key, factory)` | transient | every `resolve()` call |
| `singleton(key, factory)` | singleton | once, cached for the container's lifetime |
| `scoped(key, factory, dispose)` | scoped | once per `createScope()`/`withScope()` — `dispose` runs when the scope ends |
| `lazy(key, factory, lifecycle)` | lazy | never until `.value` is accessed on the resolved wrapper |

None of `scoped`/`lazy` are currently used in this codebase (every binding you'll find is
`singleton` or `bind`), but they're available if a future feature needs per-request state
(`scoped`, cleaned up automatically) or an expensive service that shouldn't construct until
first used (`lazy`).

**Resolution order**: `resolve(key)` searches the current container first, then walks up
`parent` containers (this is what makes a module's child container able to resolve
root-container singletons like `DbKey`/`EventBusKey` without rebinding them). It also detects
circular dependencies via an internal resolution stack and throws rather than infinite-looping
or silently returning `undefined`.

**Contextual binding** (`container.when(context).needs(depKey).give(factory)`) lets two
different consumers resolve different implementations of the same key — not used anywhere in
this codebase yet, but available for e.g. swapping a mock implementation in for one specific
caller during tests without a global rebind.

**Disposal**: `container.dispose()` (called by `Module.cleanup()` and by each process's own
`cleanup()`) tears down scoped instances registered with a `dispose` callback. This is separate
from — and runs after — each module's own `onDestroy()` hook; `onDestroy()` is for
application-level cleanup (closing a subscription, flushing a buffer), while
`container.dispose()` is the DI container reclaiming anything it tracked a disposer for.
