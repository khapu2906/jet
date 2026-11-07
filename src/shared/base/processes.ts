import { Container } from "@khapu2906/treasure-chest";
import { AppRegistry } from "@shared/registry";
import { Logger } from "@shared/logger";
import {
	EventBusKey,
	createEventBus,
	type EventBus,
} from "@shared/event-manager";
import type { Module, ModuleConstructor } from "./modules";
import { ModuleLoader } from "./module-loader";

export abstract class BaseProcess<T = void> {
	protected _app!: T;

	protected _modules: ModuleConstructor[] = [];

	// One child per process: with PROCESS_TYPE=* core bindings must not clobber
	// each other (treasure-chest resolves the first binding for a key). The
	// root stays the shared parent for any future cross-process singleton.
	protected readonly _container: Container =
		AppRegistry.rootContainer.createChild();

	protected readonly _loader = new ModuleLoader(this._container, (m) =>
		AppRegistry.setModule(m.name, m),
	);

	// Owned per process: cleanup stops exactly the bus this process started.
	private _eventBus: EventBus | null = null;

	/**
	 * Bind process-specific singletons. Called before modules load.
	 */
	protected abstract _registerCoreDependencies(): void | Promise<void>;

	/**
	 * Build the process app from its activated root modules (imports
	 * included, in load order). Runs once, after every `register()`/`onInit()`.
	 */
	protected abstract _build(modules: Module[]): Promise<T>;

	/**
	 * Opt-in: create, bind and start this process's EventBus. Call it from
	 * `_registerCoreDependencies()`; processes that don't use events skip it.
	 */
	protected async _enableEventBus(): Promise<void> {
		const eventBus = createEventBus();
		this._eventBus = eventBus;
		this._container.singleton(EventBusKey, () => eventBus);
		await eventBus.start();
	}

	async bootstrap(): Promise<T> {
		await this._registerCoreDependencies();

		this._app = await this._build(await this._loader.load(this._modules));
		return this._app;
	}

	/**
	 * Process-specific shutdown that must run before modules are torn down
	 * (stop taking new work: cron ticks, consumers).
	 */
	protected async _onCleanup(): Promise<void> {}

	async cleanup(): Promise<void> {
		try {
			await this._eventBus?.stop();
		} catch (error) {
			Logger.error(`Error stopping EventBus: ${error}`);
		}

		await this._onCleanup();

		await this._loader.cleanup((module, error) =>
			Logger.error(`Module cleanup error (${module.name}): ${error}`),
		);
	}
}

export class Runner {
	constructor(
		private readonly _bootstrap: () => Promise<() => Promise<void>>,
	) {}

	/**
	 * Bootstraps the process and returns its stop function.
	 * Signal handling (SIGTERM/SIGINT) is coordinated centrally in
	 * src/index.ts so multiple processes sharing one Node process
	 * (PROCESS_TYPE=*) shut down together instead of racing each
	 * other to call process.exit().
	 */
	async run(): Promise<() => Promise<void>> {
		return this._bootstrap();
	}
}
