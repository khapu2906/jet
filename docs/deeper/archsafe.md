# Architecture Enforcement (ArchSafe) — Under the Hood

For how to run it and what's currently enforced, see `docs/apply/archsafe.md`. This page is
about how the tool actually works, verified by reading `@archsafe/core`'s and
`@archsafe/typescript`'s real source (not just its `.d.ts`) and by deliberately introducing
violations to confirm what does and doesn't get caught — including two real gaps this ruleset
had at earlier points, both fixed and re-verified.

## The model: Architecture (what code *should* belong to) vs. Source (what it *does* belong to)

`archsafe.config.mts` builds a tree of `Layer`/`Module` elements, each with a glob relative to
its parent's base path (`.layer("service", "service.ts")` inside `.module("auth", "modules/auth", ...)`
matches `modules/auth/service.ts`). Separately, `@archsafe/typescript` statically analyzes every
`.ts` file and builds a `DependencyGraph` of typed edges between symbols. `classify()` then maps
every file to the *most specific* matching element — specificity is glob length after stripping
wildcard characters, so a module's own `"contracts/service.ts"` (a literal path, zero wildcards)
always beats a broader `"**"` catch-all. Two `.layer()` calls with the *same name* but different
globs (e.g. `.layer("repository", "repository.ts")` and a hypothetical second call with the same
name) just feed two globs into one `qualifiedName` — confirmed by testing, not just reading the
type signature.

`validate()` then walks every graph edge and checks it against `forbid`/`allow`/`moduleBoundary`/
`forbidPackages` rules, using `ancestorNames()` — which includes both an element's short `.name`
**and** its full `qualifiedName`, walking up through every parent. This has one real consequence
worth knowing: **a `forbid` naming a parent Module also covers everything nested inside it** —
`forbid("shared", "auth")` matches an edge into `shared.db` or `shared.config.cfg-app` just as
much as one into bare `shared`, with no need to repeat the rule for every child layer.

## Why `service`/`repository` are split into contract + implementation layers

This wasn't the original shape. Earlier iterations went through, in order:

1. **One shared `contracts.ts`** per module holding both `IAuthRepository` and `IAuthService`.
   Bypass found: `routes.ts` could `container.resolve<IAuthRepository>(AuthRepositoryKey)`
   directly — `contracts.ts` classified as the catch-all `"internal"` layer, invisible to
   `forbid(routes, repository)`. Confirmed by deliberately adding exactly that constructor
   injection to `routes.ts` and re-running `archsafe` — zero violations.
2. **Contract merged into its own implementation file** (`IAuthRepository` declared directly in
   `repository.ts`). Fixed the bypass above (now classified as `"repository"`, caught correctly)
   but reintroduced the *editor-autocomplete* problem: the concrete class sits right next to the
   interface in the same file, one accidental `import { AuthRepository }` away.
3. **Separate `contracts/repository.ts` / `contracts/service.ts` files**, each declaring only the
   `Symbol` key + interface, glob'd onto the *same layer name* as their implementation
   (`.layer("repository", "repository.ts").layer("repository", "contracts/repository.ts")`).
   Fixes both problems for repository — but this exposed a **third** bypass, specific to
   `service`: since `routes → service` is the intended, allowed direction, merging
   `contracts/service.ts` and `service.ts` onto one layer name meant that permission silently
   also allowed `routes.ts` to import the concrete `AuthService` class. Confirmed the same way —
   added `import { AuthService } from "./service"` to `routes.ts`, zero violations.
4. **Current shape**: `service`/`serviceContract` and `repository`/`repositoryContract` are four
   distinct layers, not two. `repositoryContract` and `service` (and `repository`) are all
   equally forbidden to `routes.ts` — only `serviceContract` is reachable. Re-verified: injecting
   `AuthService` (concrete) into `routes.ts` now produces `auth.routes must not depend on
   auth.service`; injecting `IAuthService` (contract, what the real code does) stays clean.

## `moduleBoundary` / `.public(...)`

Declaring `.public("module.ts", "contracts/index.ts")` on a module auto-enables `moduleBoundary`
for it (no separate rule needed) — `validator.ts` builds a `modulePublicFiles` set per module and
flags any edge from outside the module into a file not in that set. Public-file resolution is
**transitive through re-exports**: `classify.ts` follows a public file's `export { X } from "./y"`
/`export * from "./y"` chain, so a symbol only reachable via a public barrel still counts as public
even though it's physically declared elsewhere.

This is what `auth/contracts/index.ts` relies on: it's declared public, and does
`export * from "./service"` — nothing else — so `classify.ts`'s traversal adds
`contracts/service.ts` to the same public set purely because the barrel re-exports it.
`contracts/repository.ts` is never re-exported from anywhere public, so it stays unreachable.
Adding a second public contract later is a one-line change to the barrel; `archsafe.config.mts`
never needs to change, since it only names the barrel file, not each thing inside it.

**The transitive resolution does not require going through the barrel at import time** — it only
expands *which files count as public*. A consumer that imports `contracts/service.ts` directly,
skipping `contracts/index.ts` entirely, is equally allowed, because by the time `validate()` runs,
`contracts/service.ts` is already in the public set regardless of which file the edge's source
actually imported from. Confirmed with three cross-module test edges from
`demo-scheduler/module.ts`: importing `IAuthService` via the barrel (`.../contracts`) → clean;
importing the exact same symbol directly from `.../contracts/service` → also clean; importing
`IAuthRepository` from `.../contracts/repository` → `Module boundary violation: ... reaches into
auth outside its public API`. The barrel is a convention for consumers to follow (one clean
import path, one place that documents what's public) and the single point of control for module
authors (what to re-export) — not an additional enforcement boundary beyond what `.public(...)`
already provides.

## `mustResideIn`: a name-pattern placement check, independent of the layer tree

`interfaces().matching("I*Repository").mustResideIn("modules/*/contracts/repository.ts")` doesn't
care about `forbid`/`allow` at all — it just scans every symbol in the whole source model (not
scoped to `FEATURE_MODULES`) and flags any interface matching the glob-style name pattern (`*`
matches any run of non-`/` characters, same matcher as path globs) that isn't physically located
at the required path. This is what catches a *brand new* module reintroducing bypass #1 above
(a shared `contracts.ts`) even before anything actually imports the misplaced interface —
placement is checked on its own, not just consumption.

## What the tool cannot see: value-level / untyped code

`@archsafe/typescript`'s analyzer creates a graph edge in exactly four cases: a type reference
(`: SomeType`), a constructor parameter's type (`injects`), an `extends`/`implements` clause, and
an identifier resolving to an **external** package import. A plain `new AuthRepository(db)` —
using the class as a value, with no type annotation anywhere referencing it — triggers none of
these. Confirmed empirically: adding `const raw = new AuthRepository(...)` (with `AuthRepository`
imported by value, never typed) to `routes.ts` produced **zero new graph edges** and, unsurprisingly,
zero violations.

`files().in(...).mustNotImport(...)` looks like it might close this gap (file-level, not
type-level, per its own docs) — it doesn't, currently. `validator.ts` only evaluates it against
edges of `type: "imports"`, and the analyzer only ever produces that edge type for **external**
package identifiers (never for a plain internal `import { X } from "./y"`, typed or not). The
upstream docs' own example (an internal file blocked via `mustNotImport`) only passes because its
matching unit test hand-constructs that edge directly — the real TypeScript analyzer never emits
it. Confirmed by reading `analyzer.ts` and cross-checking against `validator.test.ts`.

**Net effect**: this ruleset (and the tool in general, as of the version in use here) enforces
discipline for anything that goes through a **type** — which covers this codebase's actual DI
convention (constructor injection, `container.resolve<Interface>(Key)`) — but a deliberate,
untyped bypass is still only caught by code review, not tooling.

## Config domain layer naming: a real collision, not hypothetical

Config domain layers are named `cfg-app`, `cfg-auth`, etc. — not `app`, `auth`. Using bare `auth`
collided with the `FEATURE_MODULES` short name `"auth"`: because `ancestorNames()` matches by
short `.name` as well as `qualifiedName`, `forbid("shared", "auth")` (meant to block `shared/`
from depending back on the `modules/auth` feature module) was *also* matching
`shared.config.auth`, producing a confusing extra violation
(`shared must not depend on auth`) alongside the real, specific one. Reproduced deliberately,
fixed by prefixing every config domain layer name.

## Not wired into CI or a pre-commit hook

`npm run arch:check` is a manual script today. A violation is only caught when someone runs it —
same caveat the tool's own `docs/ai-agents.md` calls out ("otherwise it finds out the same way a
human would: archsafe fails in CI, after the code is already written").
