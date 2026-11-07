import { SchedulerKey, type ISchedulerManager } from "@/shared/scheduler/contracts";
import { Module } from "@shared/base/modules";
import { IDemoJob, DemoJobKey } from "./contracts";
import { DemoJob } from "./job";

export class DemoSchedulerModule extends Module {
	readonly name = "demo-scheduler";

	register(): void {
		this._container.singleton(DemoJobKey, () => new DemoJob());
	}

	async onInit(): Promise<void> {
		const scheduler = this._container.resolve<ISchedulerManager>(SchedulerKey);
		const demoJob = this._container.resolve<IDemoJob>(DemoJobKey);

		scheduler.register({
			name: "demo-say-hello-every-minute",
			cron: "* * * * *", // every minute —
			handler: () => demoJob.sayHello(),
		});
	}
}
