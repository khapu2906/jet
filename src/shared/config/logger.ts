import * as v from "valibot";
import type { LogConfig } from "meo-meo-logger";
import { nodeEnv, parseEnv } from "./env";

const LoggerEnvSchema = v.object({
	LOG_LEVEL: v.optional(v.picklist(["debug", "info", "warn", "error"]), "info"),
	LOG_MODE: v.optional(v.picklist(["json", "pretty"])),
	SERVICE_NAME: v.optional(v.string(), "app"),
});

const loggerEnv = parseEnv(LoggerEnvSchema);

export const loggerConfig: LogConfig = {
	level: loggerEnv.LOG_LEVEL as LogConfig["level"],
	mode: (loggerEnv.LOG_MODE ??
		(nodeEnv === "production" ? "json" : "pretty")) as LogConfig["mode"],
	serviceName: loggerEnv.SERVICE_NAME,
	transports: [],
};
