import {
	Worker,
	isMainThread,
	workerData,
	parentPort,
} from "node:worker_threads";
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

async function startWorkerProcess(
	threadId: number,
): Promise<() => Promise<void>> {
	const proc = new WorkerProcess();
	Logger.info(`Worker thread #${threadId} bootstrapping...`);
	await proc.bootstrap();
	Logger.info(`Worker thread #${threadId} started`);
	return () => proc.cleanup();
}

/**
 * When spawned as a worker thread — auto-start and listen for shutdown signal
 */
if (!isMainThread) {
	const threadId = (workerData as { threadId: number })?.threadId ?? 0;

	startWorkerProcess(threadId)
		.then((cleanup) => {
			parentPort?.on("message", async (msg) => {
				if (msg === "shutdown") {
					await cleanup();
					process.exit(0);
				}
			});
		})
		.catch((err) => {
			Logger.error(`Worker thread #${threadId} failed to start: ${err}`);
			process.exit(1);
		});
}

// In dev (.ts), explicitly load tsx/cjs so worker threads resolve path aliases.
// In prod (.js), compiled files need no loader.
const workerExecArgv = __filename.endsWith(".ts")
	? ["--require", "tsx/cjs"]
	: process.execArgv;

function spawnThread(
	id: number,
	threads: Map<number, Worker>,
	threadFile: string,
): void {
	const worker = new Worker(threadFile, {
		workerData: { threadId: id },
		execArgv: workerExecArgv,
	});

	threads.set(id, worker);

	worker.on("error", (err) => {
		Logger.error(`Worker thread #${id} error: ${err}`);
	});

	worker.on("exit", (code) => {
		threads.delete(id);
		if (code !== 0) {
			Logger.warn(`Worker thread #${id} exited (code ${code}), restarting...`);
			spawnThread(id, threads, threadFile);
		}
	});
}

export const runner = new Runner(async () => {
	const threadCount = Math.max(
		1,
		parseInt(process.env.WORKER_THREADS || "1", 10),
	);

	LoggerUI.banner({
		name: "Event Worker",
		environment: process.env.NODE_ENV || "development",
		port: 0,
	});

	// Single thread mode — run directly in current process
	if (threadCount === 1) {
		return startWorkerProcess(0);
	}

	// Multi-thread mode — spawn N worker threads
	Logger.info(`Spawning ${threadCount} worker threads...`);

	const threads = new Map<number, Worker>();

	for (let i = 0; i < threadCount; i++) {
		spawnThread(i, threads, __filename);
	}

	Logger.info(`${threadCount} worker threads running`);

	return async () => {
		Logger.info("Shutting down worker threads...");

		const exits = Array.from(threads.entries()).map(
			([id, worker]) =>
				new Promise<void>((resolve) => {
					worker.once("exit", () => resolve());
					worker.postMessage("shutdown");
					// Force terminate if thread doesn't exit cleanly within 5s
					setTimeout(() => {
						if (threads.has(id)) worker.terminate();
					}, 5000).unref();
				}),
		);

		await Promise.all(exits);
		Logger.info("All worker threads stopped");
	};
});
