import { db } from "@shared/db";

export interface HealthCheck {
	status: "up" | "down";
	message?: string;
	responseTime?: number;
}

export interface HealthStatus {
	status: "healthy" | "degraded" | "unhealthy";
	timestamp: string;
	uptime: number;
	service: string;
	version: string;
	checks: {
		database: HealthCheck;
	};
}

export class HealthService {
	private static startTime = Date.now();

	static async check(): Promise<HealthStatus> {
		const database = await this.checkDatabase();
		const overallStatus = database.status === "up" ? "healthy" : "unhealthy";

		return {
			status: overallStatus,
			timestamp: new Date().toISOString(),
			uptime: Math.floor((Date.now() - this.startTime) / 1000),
			service: process.env.SERVICE_NAME || "app",
			version: process.env.npm_package_version || "1.0.0",
			checks: { database },
		};
	}

	static async liveness(): Promise<{ status: string }> {
		return { status: "alive" };
	}

	static async readiness(): Promise<HealthStatus> {
		const health = await this.check();
		if (health.checks.database.status === "down") {
			throw new Error("Service not ready: database is down");
		}
		return health;
	}

	private static async checkDatabase(): Promise<HealthCheck> {
		const start = Date.now();
		try {
			await db.execute("SELECT 1 as health" as never);
			return { status: "up", responseTime: Date.now() - start };
		} catch (error) {
			return {
				status: "down",
				message:
					error instanceof Error ? error.message : "Database connection failed",
				responseTime: Date.now() - start,
			};
		}
	}
}
