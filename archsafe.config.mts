/**
 * @link https://archsafe.vercel.app
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  architecture,
  forbid,
  forbidPackages,
  interfaces,
  noCycles,
} from "@archsafe/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Feature modules under src/modules/* — every folder there, auto-discovered
// so a new module never needs this file edited just to be picked up. Each
// one is wired into a process (see src/processes/http.ts) purely through
// its module.ts — nothing else in the module is meant to be reachable from
// outside it.
const FEATURE_MODULES = readdirSync(join(__dirname, "src/modules"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// A module's contract/implementation pair, e.g. "service" expands to two
// layers: "serviceContract" (contracts/service.ts — interface + Symbol key
// only) and "service" (service.ts — the concrete class). Kept as two
// layers, not one, specifically so the forbid rules below can say "routes
// may depend on serviceContract but not on service" — see the comment on
// those rules for why that distinction matters. Add a kind here (e.g.
// "cache") if a module ever needs a third contract-backed layer.
const CONTRACT_KINDS = ["service", "repository"] as const;

const archBuilder = architecture("Jet Framework");

// Globs below are relative to `rootDir` ("./src"), not the repo root —
// ArchSafe's rootDir mode reports every file path relative to rootDir itself.
for (const name of FEATURE_MODULES) {
  archBuilder.module(name, `modules/${name}`, (m) => {
    let module = m.layer("routes", "routes.ts");
    for (const kind of CONTRACT_KINDS) {
      module = module
        .layer(`${kind}Contract`, `contracts/${kind}.ts`)
        .layer(kind, `${kind}.ts`);
    }
    return (
      module
        // Catch-all for everything else in the module (module.ts, dto.ts,
        // model.ts, utils.ts, doc.ts, job.ts, ...). A module's own "bucket"
        // only matches a file literally named after its basePath, so
        // without this every file above would be classified into NO
        // element at all and every rule would silently stop seeing it —
        // including moduleBoundary, since module.ts (the declared public
        // entry) would itself be unclassified.
        .layer("internal", "**")
        // Public API of this module, enforced automatically (moduleBoundary)
        // the moment .public(...) is declared — no separate forbid rules
        // needed for cross-module access. module.ts is how a *process*
        // mounts the module; contracts/service.ts is how *another module*
        // is meant to depend on it (via getImportModules() + share(), see
        // docs/deeper/modules.md) — repository.ts/contracts/repository.ts/
        // service.ts/routes.ts are never public, on purpose: no module may
        // reach another module's data layer or concrete service class,
        // only its service contract. Declaring a path that doesn't exist
        // in a given module (e.g. demo-scheduler has no contracts/service.ts
        // yet) is harmless — it just never matches anything.
        .public("module.ts", "contracts/service.ts")
    );
  });
}

// Domain config files under src/shared/config/*.ts. Each one must depend
// only on env.ts (parses NODE_ENV once) — never on each other, and never
// on the composition root app.ts — so no domain implicitly requires
// another domain's env vars to already be resolved. See docs/deeper/*.md
// and CHANGELOG.md 0.1.15 for why this was tightened.
const CONFIG_DOMAINS = [
  "app",
  "auth",
  "database",
  "event-bus",
  "logger",
  "security",
  "storage",
] as const;

// Rule matching walks each element's ancestor chain by BOTH its short
// `.name` and its qualifiedName (see @archsafe/core's `ancestorNames()`),
// so a layer named e.g. "auth" here would collide with the FEATURE_MODULES
// "auth" (`modules/auth`) short name and make `forbid("shared", "auth")`
// below silently also match `shared.config.auth` — confirmed by actually
// triggering it during testing. Prefixed to guarantee no collision with
// FEATURE_MODULES or any other layer name in this tree, now or later.
const configLayer = (domain: string) => `cfg-${domain}`;

archBuilder
  // Cross-cutting infrastructure shared by every module/process.
  .module("shared", "shared", (m) =>
    m
      // The DB layer — only a module's repository.ts (unrestricted, see
      // rules below) is meant to reach this directly.
      .layer("db", "db/**")
      .module("config", "config", (cm) => {
        for (const name of CONFIG_DOMAINS) {
          cm = cm.layer(configLayer(name), `${name}.ts`);
        }
        // env.ts (the one thing every domain may depend on) + index.ts
        // (the composition root that imports every domain) fall in here.
        return cm.layer("rest", "**");
      })
      // Everything else under shared/ (errors, middleware, doc, auth,
      // storage, scheduler, event-manager, logger, base, utils, factory.ts).
      .layer("rest", "**"),
  )
  // Composition roots (http/worker/scheduler entrypoints) that wire
  // modules + shared together. Nothing should depend on these.
  .layer("processes", "processes/**");

const jetArchitecture = archBuilder.build();

const rules = [
  // Strict one-way layering inside a module: routes -> serviceContract ->
  // service -> repositoryContract -> repository. Every consumer only ever
  // sees a contract, never the concrete class on the other side of it —
  // routes.ts can depend on serviceContract but not on service (the
  // concrete AuthService) or on either repository layer at all; service.ts
  // can depend on repositoryContract but not on repository (the concrete
  // AuthRepository). Only module.ts (the "internal" catch-all, unrestricted
  // here) constructs the concrete classes, to wire them into the container.
  // (A module missing one of these files just never populates that layer —
  // harmless, and forward-compatible if e.g. "system" grows a repository.)
  ...FEATURE_MODULES.flatMap((name) => [
		forbid(`${name}.routes`, `${name}.service`),
    
    forbid(`${name}.routes`, `${name}.repositoryContract`),
    forbid(`${name}.routes`, `${name}.repository`),
		forbid(`${name}.service`, `${name}.routes`),
    
    forbid(`${name}.service`, `${name}.repository`),
    forbid(`${name}.repository`, `${name}.routes`),
    forbid(`${name}.repository`, `${name}.service`),
    forbid(`${name}.repository`, `${name}.serviceContract`),

		// The repository layer is the only place allowed to talk to a DB
    // driver directly — routes/services must go through it. Blocking just
    // the raw driver packages has a hole: nothing stops routes.ts/service.ts
    // from importing this app's own `@shared/db` wrapper directly instead
    // (skipping the repository entirely) — so also forbid reaching the
    // dedicated `shared.db` layer from those two, on top of the packages.
    forbidPackages(`${name}.routes`, "pg", "drizzle-orm"),
    forbidPackages(`${name}.service`, "pg", "drizzle-orm"),

		forbid(`${name}.routes`, "shared.db"),
    forbid(`${name}.service`, "shared.db"),
  ]),

  // Config domains (src/shared/config/*.ts) never import each other —
  // each depends only on env.ts (see `config/env.ts`'s `nodeEnv` export).
  // Catches a regression of the exact bug fixed in 0.1.15: security.ts
  // used to duplicate CORS/rate-limit env parsing that app.ts also did,
  // and every domain imported `appConfig` from app.ts just to read
  // `.nodeEnv`, coupling every domain to the "app" domain's unrelated
  // fields.
  ...CONFIG_DOMAINS.flatMap((from) =>
    CONFIG_DOMAINS.filter((to) => to !== from).map((to) =>
      forbid(
        `shared.config.${configLayer(from)}`,
        `shared.config.${configLayer(to)}`,
      ),
    ),
  ),

  // Modules are decoupled by default: `.public("module.ts", "contracts/index.ts")`
  // above means moduleBoundary is auto-enforced for every FEATURE_MODULE —
  // another module (or anything else) reaching into routes.ts/service.ts/
  // repository.ts/contracts/repository.ts is a violation with no rule needed
  // here. What IS allowed (deliberately, not by omission): one module
  // depending on another's contracts/index.ts (or, transitively, whatever
  // it re-exports, e.g. contracts/service.ts) via getImportModules(), for
  // a case like a future `user` module needing auth's IAuthService. No
  // module currently does this — event-driven (@shared/event-manager) is
  // still the default choice for anything that doesn't need a synchronous
  // answer.

  // Dependency direction is one-way: shared infra and processes are
  // depended *on*, they never depend back on a feature module, and
  // shared infra never depends on the composition root.
  ...FEATURE_MODULES.map((name) => forbid("shared", name)),
  ...FEATURE_MODULES.map((name) => forbid(name, "processes")),
  forbid("shared", "processes"),

  noCycles("module"),

  // Guardrail against the exact bypass this ruleset used to have: routes.ts
  // resolving IAuthRepository straight from the container, skipping
  // service.ts entirely. forbid(routes, repositoryContract) above only
  // catches that if the interface is physically classified into the
  // "repositoryContract"/"serviceContract" layer — which requires it to
  // actually live in contracts/repository.ts / contracts/service.ts (see
  // the layer defs above), not a flat contracts.ts shared by both (that
  // would classify as "internal", invisible to those forbid rules), and
  // not inside repository.ts/service.ts themselves (that would classify as
  // "repository"/"service" — also not what routes.ts is allowed to touch).
  // This is a name-pattern check across the whole source tree, not scoped
  // to FEATURE_MODULES, so it also catches a brand new module that
  // reintroduces either mistake.
  interfaces()
    .matching("I*Repository")
    .mustResideIn("modules/*/contracts/repository.ts"),
  interfaces()
    .matching("I*Service")
    .mustResideIn("modules/*/contracts/service.ts"),
];

export default {
  architecture: jetArchitecture,
  rules,
  // resolved relative to this config file
  rootDir: "./src",
};
