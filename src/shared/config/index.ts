import { appConfig } from "./app";
import { dbConfig } from "./database";
import { authConfig } from "./auth";
import { securityConfig } from "./security";
import { loggerConfig } from "./logger";

export { appConfig, dbConfig, authConfig, securityConfig, loggerConfig };

export const config = {
	...appConfig,
	database: dbConfig,
	auth: authConfig,
	security: securityConfig,
	logger: loggerConfig,
};

export type Config = typeof config;

export const isDevelopment = () => config.nodeEnv === "development";
export const isProduction = () => config.nodeEnv === "production";
export const isStaging = () => config.nodeEnv === "staging";
