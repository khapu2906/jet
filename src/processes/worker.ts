import { db } from "@shared/db";
import { BaseProcess, Runner } from "@/shared/base/processes";

import { Logger, LoggerUI } from "@shared/logger";

class WorkerProcess extends BaseProcess<void> {
	protected _modules = [];

	protected async _registerCoreDependencies() {
		await this._enableEventBus();
		this._container.singleton("db", () => db);
	}

	protected async _build(): Promise<void> {
		Logger.info("Worker process started — consuming events from queue");
		Logger.info(`Loaded ${this._modules.length} modules`);
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
