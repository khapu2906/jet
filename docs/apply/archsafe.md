# Architecture Enforcement (ArchSafe) — How To

`archsafe.config.mts` (repo root) encodes the module folder/dependency rules from
`docs/llm/code-pattern.md` §1 as checked rules, not just written convention.

## Running it

```bash
npm run arch:check      # npx archsafe --config archsafe.config.mts
npm run arch:baseline   # snapshot current violations, to adopt gradually on existing code
```

Not wired into CI or a pre-commit hook yet — run it manually before committing changes that
touch module boundaries, or ask whoever sets up CI to add `npm run arch:check` as a step.

## Keeping `CLAUDE.md` in sync

```bash
npx archsafe agent-rules --config archsafe.config.mts --write CLAUDE.md
```

Regenerates the block between `<!-- archsafe:start -->`/`<!-- archsafe:end -->` in `CLAUDE.md`
from the current config — run this after editing `archsafe.config.mts`. Everything else in
`CLAUDE.md` (the hand-written intro) is left untouched; running it twice with no config changes
produces byte-identical output.

## Adding a module that matches the enforced shape

Follow `docs/llm/code-pattern.md` §1's folder layout exactly — `archsafe.config.mts` never needs
editing for a new module. `FEATURE_MODULES` is read from `src/modules/*` at check time (every
folder there counts), and the layer globs (`routes.ts`, `service.ts`, `contracts/service.ts`,
`repository.ts`, `contracts/repository.ts`, `module.ts`) apply to any module using those file
names. If it doesn't need a repository (e.g. a module like `system` that's mostly read-only),
just omit those files — the layer simply stays empty, no rule changes needed.

To expose something to other modules, add a `contracts/index.ts` barrel re-exporting only what
should be public (see `docs/llm/code-pattern.md` §1) — no `archsafe.config.mts` change needed
for that either, since `.public("module.ts", "contracts/index.ts")` already covers whatever the
barrel re-exports, transitively.

## What's enforced, in plain terms

Run `npx archsafe agent-rules --config archsafe.config.mts` for the always-current, auto-generated
version of this list (also what's synced into `CLAUDE.md`). Summarized:

| Rule | Meaning |
|---|---|
| `routes` ↛ `service`, `repositoryContract`, `repository` | Routes may only depend on `contracts/service.ts` (`IAuthService`) |
| `service` ↛ `routes`, `repository` | Service may only depend on `contracts/repository.ts` (`IAuthRepository`), never the concrete repository class |
| `repository` ↛ `routes`, `service`, `serviceContract` | Repository doesn't reach upward at all |
| `routes`/`service` ↛ `pg`, `drizzle-orm` (packages) | Only `repository.ts` may talk to the DB driver |
| `routes`/`service` ↛ `shared.db` | ...including this app's own `@shared/db` wrapper — no bypassing `repository.ts` |
| Config domains (`shared/config/*.ts`) never depend on each other | Each depends only on `env.ts` |
| No feature module depends back on `shared/` or `processes/` | Dependency direction is one-way |
| `I*Repository`/`I*Service` interfaces must live in `contracts/repository.ts`/`contracts/service.ts` | Catches the interface ending up in the wrong file, anywhere in the repo |
| Cross-module access — allowed, not forbidden | A module *can* depend on another's `contracts/index.ts` (e.g. via `getImportModules()`) and, transitively, whatever that barrel re-exports — nothing else in that module is reachable |

For why each of these exists (including two bypasses that were found and fixed during
development, and what the tool still *can't* catch), see `docs/deeper/archsafe.md`.
