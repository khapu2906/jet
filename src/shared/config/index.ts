import { appConfig } from "./app";
import { dbConfig } from "./database";
import { authConfig } from "./auth";

export { loggerConfig } from "./logger";
export { appConfig, dbConfig, authConfig };

export const config = {
	...appConfig,
	database: dbConfig,
	auth: authConfig,
};

export type Config = typeof config;

export const isDevelopment = () => config.nodeEnv === "development";
export const isProduction = () => config.nodeEnv === "production";
export const isTest = () => config.nodeEnv === "test";
