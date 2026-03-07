import "dotenv/config";
import * as v from "valibot";
import { envNumber, parseEnv } from "./env";

const AppEnvSchema = v.object({
	APP_HOST: v.optional(v.string(), "0.0.0.0"),
	PORT: envNumber(2906),
	NODE_ENV: v.optional(
		v.picklist(["development", "production", "test"]),
		"development",
	),

	// Frontend / CORS
	CORS_ORIGINS: v.optional(v.string()),

	// Logger
	LOG_LEVEL: v.optional(v.picklist(["debug", "info", "warn", "error"]), "info"),

	// Rate limit
	RATE_LIMIT_ENABLED: v.optional(v.string()),
	RATE_LIMIT_MAX: envNumber(100),
	RATE_LIMIT_WINDOW: v.optional(v.string(), "15m"),
});

const appEnv = parseEnv(AppEnvSchema);

export const appConfig = {
	hostname: appEnv.APP_HOST,
	port: appEnv.PORT,
	nodeEnv: appEnv.NODE_ENV,

	corsOrigins: appEnv.CORS_ORIGINS
		? appEnv.CORS_ORIGINS.split(",").map((o) => o.trim())
		: appEnv.NODE_ENV === "production"
			? []
			: ["http://localhost:3000", "http://localhost:3001"],

	logLevel: appEnv.LOG_LEVEL,

	rateLimitEnabled: appEnv.RATE_LIMIT_ENABLED !== "false",
	rateLimitMax: appEnv.RATE_LIMIT_MAX,
	rateLimitWindow: appEnv.RATE_LIMIT_WINDOW,
};

export type AppConfig = typeof appConfig;
