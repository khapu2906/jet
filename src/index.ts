import "dotenv/config";
import { Logger } from "@shared/logger";
import type { Runner } from "@shared/base/processes";

const PROCESS_REGISTRY: Record<string, () => Promise<{ runner: Runner }>> = {
	http: () => import("./processes/http"),
	worker: () => import("./processes/worker"),
	scheduler: () => import("./processes/scheduler"),
};

async function runOne(processType: string): Promise<void> {
	const { runner } = await PROCESS_REGISTRY[processType]();
	Logger.info(`[${processType}] starting...`);
	await runner.run();
	Logger.info(`[${processType}] finished.`);
}

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

	const types =
		processType === "*"
			? Object.keys(PROCESS_REGISTRY)
			: processType
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean);

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
