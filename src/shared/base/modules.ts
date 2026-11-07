import type { Hono } from "hono";
import { Container } from "@khapu2906/treasure-chest";

export type ModuleConstructor = new (container: Container) => Module;

export abstract class Module {
	abstract readonly name: string;

	/** Modules this one depends on (classes). Loaded before this module. */
	readonly imports: ModuleConstructor[] = [];

	protected container: Container;

	constructor(container: Container) {
		this.container = container;
	}

	/**
	 * Private wiring: bind what THIS module needs into its own container.
	 * Pure bindings only — no side effects (put those in onInit()).
	 */
	register(): void | Promise<void> {}

	/**
	 * Public surface: bind the keys another module may consume into `to`
	 * (the importer's container). Resolve private deps from `this.container`.
	 */
	share(_to: Container): void | Promise<void> {}

	/**
	 * Side effects. Runs only for modules listed in a process's `_modules`,
	 * never for modules that are merely imported.
	 */
	async onInit(): Promise<void> {}

	/**
	 * Mount routes / start consumers. Runs only for `_modules` entries.
	 */
	bootstrap(): Hono | void | Promise<Hono | void> {
		return undefined;
	}

	/**
	 * Cleanup for modules that were activated (see onInit()).
	 */
	async onDestroy(): Promise<void> {}

	getContainer() {
		return this.container;
	}
}
