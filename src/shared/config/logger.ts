import * as v from "valibot";
import type { LogConfig } from "meo-meo-logger";
import { parseEnv } from "./env";

const LoggerEnvSchema = v.object({
	LOG_LEVEL: v.optional(v.picklist(["debug", "info", "warn", "error"]), "info"),
	LOG_MODE: v.optional(v.picklist(["json", "pretty"])),
	SERVICE_NAME: v.optional(v.string(), "app"),
	NODE_ENV: v.optional(
		v.picklist(["development", "production", "test"]),
		"development",
	),
});

const loggerEnv = parseEnv(LoggerEnvSchema);

export const loggerConfig: LogConfig = {
	level: loggerEnv.LOG_LEVEL as LogConfig["level"],
	mode: (loggerEnv.LOG_MODE ??
		(loggerEnv.NODE_ENV === "production"
			? "json"
			: "pretty")) as LogConfig["mode"],
	serviceName: loggerEnv.SERVICE_NAME,
	transports: [],
};
