import { db } from '../db';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  checks: {
    database: HealthCheck;
    redis?: HealthCheck;
    polar?: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'up' | 'down';
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

/**
 * Health check service
 */
export class HealthService {
  private static startTime = Date.now();

  /**
   * Perform comprehensive health check
   */
  static async check(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      // Add more checks as needed
      // this.checkRedis(),
      // this.checkPolar(),
    ]);

    const [database] = checks.map((result) =>
      result.status === 'fulfilled' ? result.value : { status: 'down', message: 'Check failed' }
    ) as [HealthCheck];

    // Determine overall status
    const allChecks = [database];
    const unhealthy = allChecks.filter((check) => check.status === 'down');
    const overallStatus = unhealthy.length === 0 ? 'healthy' : unhealthy.length === allChecks.length ? 'unhealthy' : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      service: 'cofit-backend-hono',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database,
      },
    };
  }

  /**
   * Check database connectivity
   */
  private static async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Simple query to check connection
      await db.execute('SELECT 1 as health');
      const responseTime = Date.now() - start;

      return {
        status: 'up',
        responseTime,
        message: 'Database connection is healthy',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database connection failed',
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private static async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // TODO: Implement Redis health check when Redis client is available
      // await redisClient.ping();

      return {
        status: 'up',
        responseTime: Date.now() - start,
        message: 'Redis connection is healthy',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Redis connection failed',
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Check Polar API connectivity
   */
  private static async checkPolar(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // TODO: Implement Polar health check
      // const response = await polarClient.ping();

      return {
        status: 'up',
        responseTime: Date.now() - start,
        message: 'Polar API is accessible',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Polar API connection failed',
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Simple liveness check
   * Returns 200 if service is running
   */
  static async liveness(): Promise<{ status: string }> {
    return { status: 'alive' };
  }

  /**
   * Readiness check
   * Returns 200 only if all critical services are available
   */
  static async readiness(): Promise<HealthStatus> {
    const health = await this.check();

    // Only database is critical for readiness
    if (health.checks.database.status === 'down') {
      throw new Error('Service not ready: database is down');
    }

    return health;
  }
}
