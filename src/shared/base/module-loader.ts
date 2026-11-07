import type { Container } from "@khapu2906/treasure-chest";
import type { Module, ModuleConstructor } from "./modules";

/**
 * Loads modules for one process.
 *
 * - Each module gets its own child container: `register()` bindings are private.
 * - `share(to)` writes a module's public surface into the importer's container,
 *   so those instances belong to the importer, not to the exporter.
 * - Imports load first, whatever order `roots` is in.
 * - `onInit()`/`start()` run only for `roots`, never for imported modules.
 */
export class ModuleLoader {
	private readonly _instances: Module[] = [];

	constructor(
		private readonly _root: Container,
		private readonly _onCreate?: (module: Module) => void,
	) {}

	/** Returns the activated root modules, in `roots` order. */
	async load(roots: ModuleConstructor[]): Promise<Module[]> {
		const activated: Module[] = [];

		for (const ctor of roots) {
			const module = await this._build(ctor, []);
			// Root has no importer: expose its own public surface to itself,
			// then run side effects.
			await module.share(module.getContainer());
			await module.onInit();
			activated.push(module);
		}

		return activated;
	}

	/** Cleans up every module (roots + imports) in reverse init order. */
	async cleanup(onError?: (module: Module, error: unknown) => void): Promise<void> {
		for (const module of [...this._instances].reverse()) {
			try {
				await module.onDestroy();
				await module.getContainer().dispose();
			} catch (error) {
				onError?.(module, error);
			}
		}
		this._instances.length = 0;
	}

	private async _build(
		ctor: ModuleConstructor,
		stack: ModuleConstructor[],
	): Promise<Module> {
		if (stack.includes(ctor)) {
			throw new Error(
				`Module import cycle: ${[...stack, ctor].map((c) => c.name).join(" -> ")}`,
			);
		}

		const module = new ctor(this._root.createChild());
		this._onCreate?.(module);

		for (const depCtor of module.imports) {
			const dep = await this._build(depCtor, [...stack, ctor]);
			await dep.share(module.getContainer());
		}

		await module.register();
		this._instances.push(module);
		return module;
	}
}
