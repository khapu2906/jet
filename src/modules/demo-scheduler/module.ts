import { SchedulerKey, type ISchedulerManager } from "@/shared/scheduler/contracts";
import { Module } from "@shared/base/modules";
import { IDemoJob, DemoJobKey } from "./contracts";
import { DemoJob } from "./job";

export class DemoSchedulerModule extends Module {
	readonly name = "demo-scheduler";

	register(): void {
		const scheduler = this.container.resolve<ISchedulerManager>(SchedulerKey);

		this.container.singleton(DemoJobKey, () => new DemoJob());

		const demoJob = this.container.resolve<IDemoJob>(DemoJobKey);

		scheduler.register({
			name: "demo-say-hello-every-minute",
			cron: "* * * * *", // every minute —
			handler: () => demoJob.sayHello(),
		});
	}

	bootstrap(): void {}
}
