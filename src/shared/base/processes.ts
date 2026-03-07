import { Container } from "@khapu2906/treasure-chest";
import { AppFactory } from "@shared/factory";
import type { ModuleConstructor } from "./modules";

export abstract class BaseProcess<T = void> {
	protected _app!: T;

	protected _modules: ModuleConstructor[] = [];

	protected readonly _container: Container = AppFactory.rootContainer;

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

	async run(): Promise<void> {
		const stop = await this._bootstrap();

		const shutdown = async () => {
			// Force exit after 5s to guarantee port is released for tsx watch restarts
			const timer = setTimeout(() => process.exit(1), 5000);
			timer.unref();
			await stop();
			clearTimeout(timer);
			process.exit(0);
		};

		process.on("SIGTERM", shutdown);
		process.on("SIGINT", shutdown);
	}
}
