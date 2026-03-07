import * as v from "valibot";
import { envNumber, parseEnv } from "./env";
import { Logger } from "@shared/logger";

const DatabaseEnvSchema = v.object({
	DB_HOST: v.optional(v.string(), "localhost"),
	DB_PORT: envNumber(5432),
	DB_USER: v.optional(v.string(), "postgres"),
	DB_PASSWORD: v.optional(v.string(), "postgres"),
	DB_NAME: v.optional(v.string(), "Flint-ai-ai"),
	DB_SSL: v.optional(v.string()),
	DB_SSL_REJECT_UNAUTHORIZED: v.optional(v.string()),
	DB_SSL_CA: v.optional(v.string()),
	DB_DEBUG: v.optional(v.string()),
	NODE_ENV: v.optional(
		v.picklist(["development", "production", "test"]),
		"development",
	),
});

const dbEnv = parseEnv(DatabaseEnvSchema);

if (dbEnv.NODE_ENV === "production") {
	const missing: string[] = [];
	if (!process.env.DB_USER) missing.push("DB_USER");
	if (!process.env.DB_PASSWORD) missing.push("DB_PASSWORD");
	if (missing.length > 0) {
		throw new Error(
			`FATAL: Missing required env vars in production: ${missing.join(", ")}`,
		);
	}
} else if (!process.env.DB_PASSWORD) {
	Logger.warn("Using default database password for development only");
}

export const dbConfig = {
	host: dbEnv.DB_HOST,
	port: dbEnv.DB_PORT,
	user: dbEnv.DB_USER,
	password: dbEnv.DB_PASSWORD,
	database: dbEnv.DB_NAME,
	ssl:
		dbEnv.NODE_ENV === "production"
			? {
					rejectUnauthorized: dbEnv.DB_SSL_REJECT_UNAUTHORIZED !== "false",
					ca: dbEnv.DB_SSL_CA,
				}
			: dbEnv.DB_SSL === "true",
	maxConnections: 10,
	debug: dbEnv.DB_DEBUG === "true",
};

export type DatabaseConfig = typeof dbConfig;
