export const SchedulerKey = Symbol("SchedulerManager");

export interface JobDefinition {
	name: string;
	cron: string; // e.g. "0 * * * *"
	handler: () => Promise<void> | void;
	runOnStart?: boolean; // run once immediately on registration
}

export interface ISchedulerManager {
	register(def: JobDefinition): void;
	stop(): Promise<void>;
	listJobs(): string[];
}
