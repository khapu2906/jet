import { BaseProcess, Runner } from "@/shared/base/processes";

import { Logger, LoggerUI } from "@shared/logger";
import { SchedulerManager } from "@/shared/scheduler/manager";
import { SchedulerKey, type ISchedulerManager } from "@/shared/scheduler/contracts";
import { DemoSchedulerModule } from "@/modules/demo-scheduler/module";

class SchedulerProcess extends BaseProcess<void> {
	protected _modules = [DemoSchedulerModule];

	protected async _registerCoreDependencies() {
		await this._enableEventBus();
		this._container.singleton(SchedulerKey, () => new SchedulerManager());
	}

	protected async _onCleanup(): Promise<void> {
		try {
			await this._container.resolve<ISchedulerManager>(SchedulerKey).stop();
		} catch (error) {
			Logger.error(`Error stopping Scheduler: ${error}`);
		}
	}

	protected async _build(): Promise<void> {
		const jobs =
			this._container.resolve<ISchedulerManager>(SchedulerKey).listJobs();

		Logger.info("Scheduler process started");
		Logger.info(
			`Loaded ${this._modules.length} modules, ${jobs.length} jobs registered`,
		);
		Logger.info(`Active jobs: ${jobs.join(", ")}`);
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
