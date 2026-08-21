import { BaseProcess, Runner } from "@/shared/base/processes";
import type { ModuleConstructor } from "@/shared/base/modules";
import { Logger, LoggerUI } from "@shared/logger";
import { AppRegistry } from "@shared/registry";
import { createEventBus, EventBus, EventBusKey } from "@/shared/event-manager";
import { SchedulerManager } from "@/shared/scheduler/manager";
import { SchedulerKey, type ISchedulerManager } from "@/shared/scheduler/contracts";
import { DemoSchedulerModule } from "@/modules/demo-scheduler/module";

class SchedulerProcess extends BaseProcess<void> {
	protected _modules: ModuleConstructor[] = [DemoSchedulerModule];

	async bootstrap(): Promise<void> {
		this._registerCoreDependencies();
		this._initModules();

		const eventBus: EventBus = this._container.resolve(EventBusKey);
		await eventBus.start();

		const scheduler =
			AppRegistry.rootContainer.resolve<ISchedulerManager>(SchedulerKey);
		const jobs = scheduler.listJobs();

		Logger.info("Scheduler process started");
		Logger.info(
			`Loaded ${this._modules.length} modules, ${jobs.length} jobs registered`,
		);
		Logger.info(`Active jobs: ${jobs.join(", ")}`);
	}

	async cleanup(): Promise<void> {
		try {
			const scheduler =
				AppRegistry.rootContainer.resolve<ISchedulerManager>(SchedulerKey);
			await scheduler.stop();

			const eventBus = this._container.resolve<EventBus>(EventBusKey);
			await eventBus.stop();
		} catch (error) {
			Logger.error(`Error stopping Scheduler: ${error}`);
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
		const schedulerManager = new SchedulerManager();
		this._container.singleton(SchedulerKey, () => schedulerManager);
		this._container.singleton(EventBusKey, () => eventBus);
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
	const proc = new SchedulerProcess();
	LoggerUI.banner({
		name: "Scheduler",
		environment: process.env.NODE_ENV || "development",
		port: 0,
	});
	await proc.bootstrap();
	return () => proc.cleanup();
});
