import { Logger } from "@/shared/logger";
import type { IDemoJob } from "./contracts";

export class DemoJob implements IDemoJob {
	constructor() {}

	async sayHello() {
		Logger.info(`Jet say "Hello World!"`);
	}
}
