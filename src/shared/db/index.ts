import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

import { config } from "./../config"

// Database connection
export const connectionString = `postgresql://${config.database.user || 'postgres'}:${config.database.password || ''
  }@${config.database.host || 'localhost'}:${config.database.port || '5432'}/${config.database.database || 'Flint-ai'
  }`;

// Create postgres client
export const client = postgres(connectionString, {
  max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  idle_timeout: 20,
  connect_timeout: 10,
  debug: (connectionId, query) => {
    if (config.database.debug) {
      console.log(`[Connect] ${connectionId} - [SQL]`, query);
    }
  },
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
