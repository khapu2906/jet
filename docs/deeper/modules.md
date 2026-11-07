# Module System — Under the Hood

For the practical how-to (creating/registering a module, built-in routes), see `docs/apply/modules.md`.

## Module Lifecycle

```
register()   → bind this module's private deps into its own container
share(to)    → bind this module's public surface into the importer's container
onInit()     → side effects (activated modules only)
start()      → hand the process something to run (activated modules only)
onDestroy()  → cleanup on SIGTERM/SIGINT (activated modules only)
```

Loading is done by `ModuleLoader` (`src/shared/base/module-loader.ts`), shared by the http,
worker and scheduler processes. It walks `imports` depth-first, gives every module its **own
child container** of the process's container, and orders loading so imports come first. For each
import it calls the dependency's `share(to)` with the importer's container:

```ts
dep.share(importer.container)   // dep chooses what it exposes; everything else stays private
```

So scope is real, not convention: whatever the dependency does not bind into `to` never
reaches the importer, and the lifecycle (`singleton`/`bind`) of the shared service is decided
inside `share(to)`, i.e. by the importer's container. Cleanup runs in reverse order and one
module failing does not stop the rest.

The loader calls `register()` + `share()` on every loaded module, then `onInit()` on the
activated roots. `start()` is called by the process, which decides what to do with the
returned value: the http process mounts it if it is a Hono app (and ignores artifacts meant
for another runtime), so `shared/base` never imports an app framework. `onDestroy()` +
`container.dispose()` are called by `ModuleLoader.cleanup()`.

## Accessing Services Across Modules — `imports` + `share(to)`

Why this shape: the original `getImportModules()` + `share()` passed the importer's container
straight into the dependency, so a dependency's `register()` bindings leaked into the importer
and side effects ran once per copy. The first rewrite (`exports` + bridging) fixed the leak
but moved ownership to the exporter, so a shared service no longer belonged to the importer.
`share(to)` keeps the old ownership model and the new boundary: `register()` is private,
`share(to)` is the public surface, and instances written into `to` belong to the importer.

Two layers enforce boundaries and they complement each other: ArchSafe stops the *static*
import of anything but `contracts/index.ts`; `share(to)` stops the *runtime* `resolve()` of
anything not explicitly bound into `to`.

A stateful exporter (in-memory cache, pool) should be bound once in the process container
(`_registerCoreDependencies()`), like `DbKey`/`EventBusKey`, not shared via `share(to)` — that
way every importer resolves the same singleton through the parent chain. `share(to)` gives each importer its own
instance, which is fine for stateless services. Not covered: restricting individual methods
of a shared service; the unit of scope is the service key.

## The DI container underneath: `@khapu2906/treasure-chest`

`this._container` (and `AppRegistry.rootContainer`) is an instance of `Container` from this
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
process-container singletons like `DbKey`/`EventBusKey` without rebinding them). It also detects
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
