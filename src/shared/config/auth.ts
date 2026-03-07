import * as v from "valibot";
import { parseEnv } from "./env";
import { Logger } from "@shared/logger";

const AuthEnvSchema = v.object({
	JWT_SECRET: v.optional(v.string(), "dev-secret"),
	JWT_EXPIRES_IN: v.optional(v.string(), "1h"),
	JWT_REFRESH_SECRET: v.optional(v.string()),
	JWT_REFRESH_EXPIRES_IN: v.optional(v.string(), "7d"),
	NODE_ENV: v.optional(
		v.picklist(["development", "production", "test"]),
		"development",
	),
});

const authEnv = parseEnv(AuthEnvSchema);

if (authEnv.NODE_ENV === "production" && authEnv.JWT_SECRET === "dev-secret") {
	throw new Error("FATAL: JWT_SECRET must be set in production");
} else if (authEnv.JWT_SECRET === "dev-secret") {
	Logger.warn("Using default JWT secret for development only");
}

export const authConfig = {
	jwtSecret: authEnv.JWT_SECRET,
	jwtExpiresIn: authEnv.JWT_EXPIRES_IN,
	jwtRefreshSecret: authEnv.JWT_REFRESH_SECRET,
	jwtRefreshExpiresIn: authEnv.JWT_REFRESH_EXPIRES_IN,
};

export type AuthConfig = typeof authConfig;
