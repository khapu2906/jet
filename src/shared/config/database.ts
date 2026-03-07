export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean | { rejectUnauthorized: boolean; ca?: string };
  maxConnections: number;
  debug: boolean;
};

/**
 * Database configuration with security best practices
 * SECURITY:
 * - SSL enabled by default in production
 * - No hardcoded credentials (fails fast if missing in production)
 * - Validates required environment variables
 */
export const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user:
    process.env.DB_USER ||
    (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: DB_USER must be set in production environment');
      }
      return 'postgres';
    })(),
  password:
    process.env.DB_PASSWORD ||
    (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: DB_PASSWORD must be set in production environment');
      }
      console.warn('⚠️  WARNING: Using default database password for development only');
      return 'postgres';
    })(),
  database: process.env.DB_NAME || 'Flint-ai-ai',
  // SECURITY FIX: Enable SSL in production
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          ca: process.env.DB_SSL_CA, // Optional: CA certificate
        }
      : process.env.DB_SSL === 'true', // Allow explicit SSL in development
  maxConnections: 10,
  debug: process.env.DB_DEBUG === 'true' ? true : false,
};
