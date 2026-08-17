import "dotenv/config";
import { Logger } from "@shared/logger";
import type { Runner } from "@shared/base/processes";

const PROCESS_REGISTRY: Record<string, () => Promise<{ runner: Runner }>> = {
	http: () => import("./processes/http"),
	worker: () => import("./processes/worker"),
	scheduler: () => import("./processes/scheduler"),
};

const SHUTDOWN_TIMEOUT_MS = 5000;

const stopHandlers: Array<{ type: string; stop: () => Promise<void> }> = [];
let isShuttingDown = false;

async function runOne(processType: string): Promise<void> {
	const { runner } = await PROCESS_REGISTRY[processType]();
	Logger.info(`[${processType}] starting...`);
	const stop = await runner.run();
	stopHandlers.push({ type: processType, stop });
	Logger.info(`[${processType}] started.`);
}

async function shutdown(signal: string): Promise<void> {
	if (isShuttingDown) return;
	isShuttingDown = true;

	Logger.info(`Received ${signal}, shutting down gracefully...`);

	// Force exit if any process's cleanup hangs, so the port/handles are
	// always released (e.g. for tsx watch restarts or orchestrator restarts).
	const timer = setTimeout(() => {
		Logger.error(
			`Shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`,
		);
		process.exit(1);
	}, SHUTDOWN_TIMEOUT_MS);
	timer.unref();

	const results = await Promise.allSettled(
		stopHandlers.map(({ type, stop }) =>
			stop().catch((error) => {
				Logger.error(`[${type}] shutdown error: ${error}`);
				throw error;
			}),
		),
	);

	clearTimeout(timer);
	process.exit(results.some((r) => r.status === "rejected") ? 1 : 0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function runSelected(types: string[]): Promise<void> {
	Logger.info(`Running processes: ${types.join(", ")}`);
	const results = await Promise.allSettled(types.map(runOne));
	let hasError = false;
	for (const [i, result] of results.entries()) {
		if (result.status === "rejected") {
			Logger.error(
				`[${types[i]}] failed: ${result.reason?.message ?? result.reason}`,
			);
			if (result.reason?.stack) Logger.error(result.reason.stack);
			hasError = true;
		}
	}
	if (hasError) process.exit(1);
}

async function main() {
	const processType = process.env.PROCESS_TYPE ?? "api";

	const types = [
		...new Set(
			processType === "*"
				? Object.keys(PROCESS_REGISTRY)
				: processType
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean),
		),
	];

	const invalid = types.filter((t) => !(t in PROCESS_REGISTRY));
	if (invalid.length > 0) {
		Logger.error(
			`Unknown PROCESS_TYPE="${invalid.join(", ")}". Valid: ${Object.keys(PROCESS_REGISTRY).join(", ")}, *`,
		);
		process.exit(1);
	}

	if (types.length === 1) {
		await runOne(types[0]);
	} else {
		await runSelected(types);
	}
}

main().catch((error) => {
	Logger.error("Failed to start process: " + error.message);
	if (error.stack) Logger.error(error.stack);
	process.exit(1);
});
