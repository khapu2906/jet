import { db } from "@shared/db";
import { BaseProcess, Runner } from "@/shared/base/processes";
import type { ModuleConstructor } from "@/shared/base/modules";
import { Logger, LoggerUI } from "@shared/logger";
import { AppRegistry } from "@shared/registry";
import { EventBus, EventBusKey, createEventBus } from "@shared/event-manager";

class WorkerProcess extends BaseProcess<void> {
	protected _modules: ModuleConstructor[] = [];

	async bootstrap(): Promise<void> {
		this._registerCoreDependencies();
		this._initModules();

		const eventBus: EventBus = AppRegistry.rootContainer.resolve(EventBusKey);
		await eventBus.start();

		Logger.info("Worker process started — consuming events from queue");
		Logger.info(`Loaded ${this._modules.length} modules`);
	}

	async cleanup(): Promise<void> {
		try {
			const eventBus = AppRegistry.rootContainer.resolve<EventBus>(EventBusKey);
			await eventBus.stop();
		} catch (error) {
			Logger.error(`Error stopping EventBus: ${error}`);
		}

		const moduleInstances = Array.from(
			AppRegistry.importModuleInstances.values(),
		).reverse();

		for (const module of moduleInstances) {
			if (module.cleanup) {
				try {
					await module.cleanup();
				} catch (error) {
					Logger.error(`Error cleaning up ${module.name}: ${error}`);
				}
			}
		}
	}

	protected _registerCoreDependencies() {
		const eventBus = createEventBus();
		AppRegistry.rootContainer.singleton("db", () => db);
		AppRegistry.rootContainer.singleton(EventBusKey, () => eventBus);
	}

	protected _initModules() {
		this._modules.forEach((ModuleClass) => {
			const instance = new ModuleClass(AppRegistry.rootContainer.createChild());
			instance.register();
			AppRegistry.setModule(instance.name, instance);
		});
	}
}

export const runner = new Runner(async () => {
	const proc = new WorkerProcess();

	LoggerUI.banner({
		name: "Event Worker",
		environment: process.env.NODE_ENV || "development",
		port: 0,
	});

	await proc.bootstrap();

	return () => proc.cleanup();
});
