import { Hono } from "hono";
import { Module } from "@shared/base/modules";
import { HealthService } from "./health";

export class SystemModule extends Module {
	readonly name = "system";

	register(): void {}

	bootstrap(): Hono {
		const app = new Hono();

		app.get("/health", async (c) => {
			const health = await HealthService.check();
			const status = health.status === "unhealthy" ? 503 : 200;
			return c.json(health, status);
		});

		app.get("/health/live", async (c) =>
			c.json(await HealthService.liveness()),
		);

		app.get("/health/ready", async (c) =>
			c.json(await HealthService.readiness()),
		);

		return app;
	}
}
