import "dotenv/config";
import { dbConfig } from "./database";
import { authConfig } from "./auth";
export { loggerConfig } from "./logger";

/**
 * Environment configuration
 * Simple validation for required environment variables
 */
function getConfig() {
	const config = {
		// Server
		hostname: process.env.APP_HOST || "0.0.0.0",
		port: parseInt(process.env.PORT || "8000", 10),
		nodeEnv:
			(process.env.NODE_ENV as "development" | "production" | "test") ||
			"development",

		// Email
		email: {
			provider: (process.env.EMAIL_PROVIDER as "resend" | "smtp") || "resend",
			smtpHost: process.env.SMTP_HOST,
			smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
			smtpUser: process.env.SMTP_USER,
			smtpPass: process.env.SMTP_PASS,
			fromEmail: process.env.FROM_EMAIL || "noreply@Flint.app",
		},

		frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

		// SECURITY: Default to localhost only, never wildcard in production
		corsOrigins: process.env.CORS_ORIGINS
			? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
			: process.env.NODE_ENV === "production"
				? [] // Empty array = no origins allowed, must be explicitly configured
				: ["http://localhost:3000", "http://localhost:3001"], // Dev defaults
		rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
		rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
		rateLimitWindow: process.env.RATE_LIMIT_WINDOW || "15m",

		logLevel:
			(process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",

		// Cluster (ALB - Auto Load Balancing)
		clusterEnabled: process.env.CLUSTER_ENABLED === "true",
		cluster: {
			max: parseInt(process.env.CLUSTER_MAX_WORKERS || "0", 10), // 0 = CPU cores
			min: parseInt(process.env.CLUSTER_MIN_WORKERS || "2", 10), // minimum workers alive
			idleTime: parseInt(process.env.CLUSTER_IDLE_TIME || "30000", 10), // ms before killing idle worker
			log: process.env.CLUSTER_LOG === "true",
		},
	};

	return config;
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig() {
	const config = getConfig();

	// Initialize external services
	return {
		...config,
		database: dbConfig,
		auth: authConfig,
	};
}

/**
 * Configuration singleton
 */
export type AppConfig = ReturnType<typeof loadConfig>;
export const config = loadConfig();

/**
 * Environment helpers
 */
export const isDevelopment = () => config.nodeEnv === "development";
export const isProduction = () => config.nodeEnv === "production";
export const isTest = () => config.nodeEnv === "test";
