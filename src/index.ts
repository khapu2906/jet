import { Logger } from "@shared/logger";
import type { Runner } from "@shared/base/processes";

const PROCESS_REGISTRY: Record<string, () => Promise<{ runner: Runner }>> = {
	api: () => import("./processes/main"),
	worker: () => import("./processes/worker"),
};

async function main() {
	const processType = process.env.PROCESS_TYPE ?? "api";

	if (!(processType in PROCESS_REGISTRY)) {
		Logger.error(
			`Unknown PROCESS_TYPE="${processType}". Valid: ${Object.keys(PROCESS_REGISTRY).join(", ")}`,
		);
		process.exit(1);
	}

	const { runner } = await PROCESS_REGISTRY[processType]();
	await runner.run();
}

main().catch((error) => {
	Logger.error("Failed to start process: " + error.message);
	if (error.stack) {
		console.error(error.stack);
	}
	process.exit(1);
});
