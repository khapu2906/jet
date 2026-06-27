import schedule, { Job } from "node-schedule";
import { Logger } from "@shared/logger";

export const SchedulerKey = "SchedulerManager";

export interface JobDefinition {
	name: string;
	cron: string; // e.g. "0 * * * *"
	handler: () => Promise<void> | void;
	runOnStart?: boolean; // chạy ngay khi khởi động
}

export class SchedulerManager {
	private _jobs = new Map<string, Job>();

	constructor() {}

	register(def: JobDefinition): void {
		if (this._jobs.has(def.name)) {
			Logger.warn(`[Scheduler] Job "${def.name}" already registered, skipping`);
			return;
		}

		const job = schedule.scheduleJob(def.name, def.cron, async () => {
			Logger.info(`[Scheduler] Running job: ${def.name}`);
			try {
				await def.handler();
				Logger.info(`[Scheduler] Job "${def.name}" completed`);
			} catch (err) {
				Logger.error(`[Scheduler] Job "${def.name}" failed: ${err}`);
			}
		});

		this._jobs.set(def.name, job);
		Logger.info(`[Scheduler] Registered job "${def.name}" → ${def.cron}`);

		if (def.runOnStart) {
			Promise.resolve(def.handler()).catch((err) =>
				Logger.error(`[Scheduler] runOnStart failed for "${def.name}": ${err}`),
			);
		}
	}

	async stop(): Promise<void> {
		await schedule.gracefulShutdown();
		this._jobs.clear();
		Logger.info("[Scheduler] All jobs stopped");
	}

	listJobs(): string[] {
		return Array.from(this._jobs.keys());
	}
}
