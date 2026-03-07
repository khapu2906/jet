import { db } from "@shared/db";
import { BaseProcess, Runner } from "@/shared/base/processes";
import type { ModuleConstructor } from "@/shared/base/modules";
import { Logger, LoggerUI } from "@shared/logger";
import { AppFactory } from "@shared/factory";
import {
	EventBus,
	EventBusKey,
	createConsumerEventBus,
} from "@shared/event-manager";

/**
 * Worker process bootstrapper
 * Consumer-only mode — registers event handlers without HTTP server
 */
class WorkeProcess extends BaseProcess<void> {
	protected _modules: ModuleConstructor[] = [];

	/**
	 * Bootstrap worker process
	 */
	async bootstrap(): Promise<void> {
		Logger.info("🔧 Bootstrapping worker process (consumer-only mode)...");

		// 1. Register core dependencies
		this._registerCoreDependencies();

		// 2. Initialize all modules (they will register their event handlers)
		this._initModules();

		// 3. Start EventBus to begin consuming events
		const eventBus: EventBus = AppFactory.rootContainer.resolve(EventBusKey);
		await eventBus.start();

		Logger.info("✅ Worker process started — consuming events from queue");
		Logger.info(`📦 Loaded ${this._modules.length} modules`);
		Logger.info(`🎯 EventBus role: consumer`);
	}

	/**
	 * Cleanup all modules and core resources
	 */
	async cleanup(): Promise<void> {
		Logger.info("🧹 Worker shutting down gracefully...");

		// Stop EventBus first
		try {
			const eventBus = AppFactory.rootContainer.resolve<EventBus>(EventBusKey);
			await eventBus.stop();
			Logger.info("✅ EventBus stopped");
		} catch (error) {
			Logger.error(`❌ Error stopping EventBus: ${error}`);
		}

		// Cleanup modules in reverse order
		const moduleInstances = Array.from(
			AppFactory.importModuleInstances.values(),
		).reverse();

		for (const module of moduleInstances) {
			if (module.cleanup) {
				try {
					await module.cleanup();
					Logger.info(`✅ Cleaned up ${module.name}`);
				} catch (error) {
					Logger.error(`❌ Error cleaning up ${module.name}: ${error}`);
				}
			}
		}

		Logger.info("✅ Worker stopped");
	}

	/**
	 * Register core dependencies
	 */
	protected _registerCoreDependencies() {
		AppFactory.rootContainer.singleton("db", () => db);

		// Create EventBus in consumer mode
		AppFactory.rootContainer.singleton(EventBusKey, () =>
			createConsumerEventBus(),
		);
	}

	/**
	 * Initialize all modules
	 * Modules will register their event handlers during registration
	 */
	protected _initModules() {
		this._modules.forEach((ModuleClass) => {
			const instance = new ModuleClass(AppFactory.rootContainer.createChild());

			// Register module dependencies and handlers
			instance.register();

			AppFactory.setModule(instance.name, instance);
		});
	}
}

export const runner = new Runner(async () => {
	const proc = new WorkeProcess();

	LoggerUI.banner({
		name: 'Event Worker',
		environment: process.env.NODE_ENV || 'development',
		port: 0,
	});

	await proc.bootstrap();

	return async () => {
		await proc.cleanup();
	};
});
