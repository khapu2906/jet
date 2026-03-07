import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

import { config } from "./../config";
import { Logger } from "./../logger";

// Database connection
export const connectionString = `postgresql://${config.database.user || "postgres"}:${
	config.database.password || ""
}@${config.database.host || "localhost"}:${config.database.port || "5432"}/${
	config.database.database || "Flint-ai"
}`;

// Create pg pool
export const client = new Pool({
	connectionString,
	max: parseInt(process.env.DB_POOL_SIZE || "10", 10),
	idleTimeoutMillis: 20000,
	connectionTimeoutMillis: 10000,
});

// Create drizzle instance
export const db = drizzle(client, {
	schema,
	logger: config.database.debug
		? { logQuery: (query) => Logger.debug(`[SQL] ${query}`) }
		: false,
});

// Export types
export type Database = typeof db;
export type DbTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

export const DbKey = Symbol("Database");
