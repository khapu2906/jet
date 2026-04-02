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

class WorkerProcess extends BaseProcess<void> {
	protected _modules: ModuleConstructor[] = [];

	async bootstrap(): Promise<void> {
		this._registerCoreDependencies();
		this._initModules();

		const eventBus: EventBus = AppFactory.rootContainer.resolve(EventBusKey);
		await eventBus.start();

		Logger.info("Worker process started — consuming events from queue");
		Logger.info(`Loaded ${this._modules.length} modules`);
	}

	async cleanup(): Promise<void> {
		try {
			const eventBus = AppFactory.rootContainer.resolve<EventBus>(EventBusKey);
			await eventBus.stop();
		} catch (error) {
			Logger.error(`Error stopping EventBus: ${error}`);
		}

		const moduleInstances = Array.from(
			AppFactory.importModuleInstances.values(),
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
		AppFactory.rootContainer.singleton("db", () => db);
		AppFactory.rootContainer.singleton(EventBusKey, () =>
			createConsumerEventBus(),
		);
	}

	protected _initModules() {
		this._modules.forEach((ModuleClass) => {
			const instance = new ModuleClass(AppFactory.rootContainer.createChild());
			instance.register();
			AppFactory.setModule(instance.name, instance);
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
