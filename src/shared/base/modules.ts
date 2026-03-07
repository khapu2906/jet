import type { Hono } from "hono";
import { Container } from "@khapu2906/treasure-chest";

export type ModuleConstructor = new (baseContainer?: Container) => Module;

export abstract class Module {
	abstract readonly name: string;

	protected container!: Container;

	public readonly importModuleInstances = new Map<string, Module>();

	private _initialized = false;
	private _destroyed = false;

	constructor(baseContainer?: Container) {
		this._setupContainer(baseContainer);
	}

	protected getImportModules(): ModuleConstructor[] {
		return [];
	}

	/**
	 * Register dependencies
	 */
	abstract register(): void | Promise<void>;

	/**
	 * Share bindings
	 */
	public share(): void | Promise<void> {}

	/**
	 * Optional lifecycle hook
	 */
	public async onInit(): Promise<void> {}

	/**
	 * Setup routes
	 */
	abstract bootstrap(): Hono | void | Promise<Hono | void>;

	/**
	 * Optional lifecycle hook
	 */
	public async onDestroy(): Promise<void> {}

	/**
	 * Internal init guard
	 */
	async __init() {
		if (this._initialized) return;

		// init imports first
		for (const [, mod] of this.importModuleInstances) {
			await mod.__init();
		}

		await this.register();

		await this.onInit();

		this._initialized = true;
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		if (this._destroyed) return;

		// destroy imports first (reverse order safer)
		const imports = Array.from(this.importModuleInstances.values()).reverse();

		for (const mod of imports) {
			await mod.cleanup();
		}

		await this.onDestroy();

		await this.container.dispose();

		this._destroyed = true;
	}

	getInfo() {
		return {
			name: this.name,
			hasRegister: this.register !== Module.prototype.register,
			hasShare: this.share !== Module.prototype.share,
			hasBootstrap: this.bootstrap !== Module.prototype.bootstrap,
			importedModules: Array.from(this.importModuleInstances.keys()),
		};
	}

	getContainer() {
		return this.container;
	}

	private _setupContainer(baseContainer?: Container) {
		const myContainer = baseContainer || new Container();
		this.container = myContainer;

		const modulesToImport = this.getImportModules();

		for (const ModuleClass of modulesToImport) {
			const instance = new ModuleClass(this.container);

			instance.share();

			this.importModuleInstances.set(instance.name, instance);
		}
	}
}
