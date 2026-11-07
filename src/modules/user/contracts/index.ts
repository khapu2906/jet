// Cross-module public surface of the user module. Only what is re-exported
// here (transitively) is reachable by another module via `imports` +
// UserModule.share(to). See docs/deeper/modules.md.
export * from "./service";
