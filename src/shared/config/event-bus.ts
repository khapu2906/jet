import * as v from "valibot";
import type { EventBusConfig } from "@event-bus-manager/core";
import { envNumber, parseEnv } from "./env";

const EventBusEnvSchema = v.object({
	EVENT_BUS_TYPE: v.optional(v.picklist(["memory"]), "memory"),
	EVENT_BUS_ROLE: v.optional(
		v.picklist(["both", "publisher", "consumer"]),
		"both",
	),
	EVENT_BUS_WORKERS: v.optional(v.string(), "*"),
	EVENT_BUS_EVENTS: v.optional(v.string(), "*"),
	EVENT_BUS_DEBUG: v.optional(v.string(), "false"),
	EVENT_BUS_MAX_RETRIES: envNumber(3),
	EVENT_BUS_RETRY_DELAY: envNumber(5000),
	EVENT_BUS_CONCURRENCY: envNumber(1),
	REDIS_HOST: v.optional(v.string(), "localhost"),
	REDIS_PORT: envNumber(6379),
});

const env = parseEnv(EventBusEnvSchema);

const resolveList = (val: string): "*" | string[] =>
	val.trim() === "*"
		? "*"
		: val
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);

export interface EngMasEventBusConfig extends EventBusConfig {
	redis: {
		host: string;
		port: number;
	};
}

export const eventBusConfig: EngMasEventBusConfig = {
	type: env.EVENT_BUS_TYPE,
	role: env.EVENT_BUS_ROLE,
	workers: resolveList(env.EVENT_BUS_WORKERS),
	events: resolveList(env.EVENT_BUS_EVENTS),
	concurrency: env.EVENT_BUS_CONCURRENCY,
	debug: env.EVENT_BUS_DEBUG === "true",
	async: {
		maxRetries: env.EVENT_BUS_MAX_RETRIES,
		retryDelay: env.EVENT_BUS_RETRY_DELAY,
		eventTTL: process.env.EVENT_BUS_EVENT_TTL || "24 hours",
		archiveInterval: process.env.EVENT_BUS_ARCHIVE_INTERVAL || "1 hour",
		deleteArchivedInterval:
			process.env.EVENT_BUS_DELETE_ARCHIVED_INTERVAL || "7 days",
	},
	redis: {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
	},
};
