import "dotenv/config";
import * as v from "valibot";
import { envNumber, nodeEnv, parseEnv } from "./env";

const AppEnvSchema = v.object({
	APP_NAME: v.optional(v.string(), "Jet Framework"),
	APP_VERSION: v.optional(v.string(), "1.0.0"),
	APP_HOST: v.optional(v.string(), "0.0.0.0"),
	PORT: envNumber(2906),
});

const appEnv = parseEnv(AppEnvSchema);

export const appConfig = {
	appName: appEnv.APP_NAME,
	appVersion: appEnv.APP_VERSION,
	hostname: appEnv.APP_HOST,
	port: appEnv.PORT,
	nodeEnv,
};

export type AppConfig = typeof appConfig;
