import "dotenv/config";
import * as v from "valibot";
import { envNumber, nodeEnv, parseEnv } from "./env";

const SecurityEnvSchema = v.object({
	// Frontend / CORS
	CORS_ORIGINS: v.optional(v.string()),

	// Rate limit
	RATE_LIMIT_ENABLED: v.optional(v.string()),
	RATE_LIMIT_MAX: envNumber(100),
	RATE_LIMIT_WINDOW: v.optional(v.string(), "15m"),
});

const securityEnv = parseEnv(SecurityEnvSchema);

export const securityConfig = {
	corsOrigins: securityEnv.CORS_ORIGINS
		? securityEnv.CORS_ORIGINS.split(",").map((o) => o.trim())
		: nodeEnv === "production"
			? []
			: ["http://localhost:3000", "http://localhost:3001"],

	rateLimitEnabled: securityEnv.RATE_LIMIT_ENABLED !== "false",
	rateLimitMax: securityEnv.RATE_LIMIT_MAX,
	rateLimitWindow: securityEnv.RATE_LIMIT_WINDOW,
};

export type SecurityConfig = typeof securityConfig;
