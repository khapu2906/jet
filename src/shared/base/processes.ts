import { Container } from "@khapu2906/treasure-chest";
import { AppRegistry } from "@shared/registry";
import type { ModuleConstructor } from "./modules";

export abstract class BaseProcess<T = void> {
	protected _app!: T;

	protected _modules: ModuleConstructor[] = [];

	protected readonly _container: Container = AppRegistry.rootContainer;

	/**
	 * Bootstrap the application
	 */
	abstract bootstrap(): Promise<T>;

	/**
	 * Cleanup resources gracefully
	 */
	abstract cleanup(): Promise<void>;

	/**
	 * Register core dependencies into the container
	 */
	protected abstract _registerCoreDependencies(): void;

	/**
	 * Initialize all modules
	 */
	protected abstract _initModules(): void | Promise<void>;
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
