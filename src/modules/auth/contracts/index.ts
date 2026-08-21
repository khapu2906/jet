// The module's cross-module public surface — what another module is
// allowed to depend on via getImportModules() + AuthModule.share() (see
// docs/deeper/modules.md). Add a new re-export here to make a contract
// public; archsafe.config.mts does not need to change (it only declares
// this file itself as public — ArchSafe resolves everything re-exported
// from it as public too, transitively, see docs/deeper/archsafe.md).
//
// repository.ts is deliberately NOT re-exported here — no module may
// reach auth's data layer, only its service.
export * from "./service";
