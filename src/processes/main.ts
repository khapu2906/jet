import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { db, DbKey } from "@shared/db";
import { createOpenAPISpec, swaggerUIRoute } from "@/shared/doc/openapi";
import { Module, type ModuleConstructor } from "@/shared/base/modules";
import { BaseProcess, Runner } from "@/shared/base/processes";
import type { ServerType } from "@hono/node-server";
import { Logger, LoggerUI } from "@shared/logger";
import { AppFactory } from "@shared/factory";
import { requestId } from "hono/request-id";

import { AuthModule } from "@/modules/auth/module";
import { SystemModule } from "@/modules/system/module";

import {
	rateLimit,
	setupCors,
	setupSecurityHeaders,
	setupContentSecurityPolicy,
	setupLogging,
} from "@shared/middleware";

import { EventBus, EventBusKey, createEventBus } from "@shared/event-manager";
import { config } from "@shared/config";
import { errorHandler } from "@/shared/errors/handler.err";

/**
 * Application bootstrapper
 */
class MainProcess extends BaseProcess<Hono> {
	protected _modules: ModuleConstructor[] = [SystemModule, AuthModule];

	private readonly _moduleInstances = AppFactory.importModuleInstances;

	private readonly _moduleOrder: Module[] = [];

	async bootstrap(): Promise<Hono> {
		this._registerCoreDependencies();
		await this._initModules();
		await this._startInfrastructure();

		this._app = new Hono();
		this._setupMiddleware();
		this._setupSystemRoutes();
		await this._bootstrapModules();

		return this._app;
	}

	async cleanup() {
		Logger.info("Shutting down gracefully...");

		try {
			const eventBus = this._container.resolve<EventBus>(EventBusKey);
			await eventBus.stop();
		} catch (error) {
			Logger.error(`Error stopping EventBus: ${error}`);
		}

		const reverse = [...this._moduleOrder].reverse();

		for (const module of reverse) {
			try {
				await module.cleanup();
				await module.getContainer()?.dispose?.();
			} catch (err) {
				Logger.error(`Module cleanup error (${module.name}): ${err}`);
			}
		}

		await this._container.dispose();
	}

	protected _registerCoreDependencies() {
		this._container.singleton(DbKey, () => db);
		this._container.singleton(EventBusKey, () => createEventBus());
	}

	protected async _initModules() {
		for (const ModuleClass of this._modules) {
			const childContainer = this._container.createChild();
			const instance = new ModuleClass(childContainer);

			this._moduleInstances.set(instance.name, instance);
			this._moduleOrder.push(instance);

			await instance.__init();
		}
	}

	private async _startInfrastructure() {
		const eventBus: EventBus = this._container.resolve(EventBusKey);
		await eventBus.start();
	}

	private _setupMiddleware() {
		this._app.use("*", requestId());
		this._app.use("*", setupCors());
		this._app.use("*", setupSecurityHeaders());
		this._app.use("*", setupContentSecurityPolicy());
		this._app.use("*", setupLogging());
		this._app.use("*", rateLimit);
		this._app.onError(errorHandler);
	}

	private _setupSystemRoutes() {
		this._app.get("/favicon.ico", (c) => c.notFound());

		if (process.env.NODE_ENV === "development") {
			this._app.get("/docs/json", createOpenAPISpec(this._app));
			this._app.get("/docs/ui", swaggerUIRoute);
		}
	}

	private async _bootstrapModules() {
		for (const module of this._moduleOrder) {
			const router = await module.bootstrap();

			if (router) {
				this._app.route("/", router);
			}
		}
	}
}

export const runner = new Runner(async () => {
	const proc = new MainProcess();

	LoggerUI.banner({
		name: "Api Server",
		environment: config.nodeEnv,
		port: config.port,
	});

	const app = await proc.bootstrap();

	const server = serve({
		fetch: app.fetch,
		hostname: config.hostname,
		port: config.port,
	}) as ServerType;

	server.on("error", (err: NodeJS.ErrnoException) => {
		if (err.code === "EADDRINUSE") {
			Logger.error(
				`Port ${config.port} is already in use. Run: lsof -ti:${config.port} | xargs kill`,
			);
			process.exit(1);
		}
		throw err;
	});

	LoggerUI.serverReady({
		port: config.port,
		routes: [
			{ label: "API Docs", path: "/docs/ui", icon: "📚" },
			{ label: "Health", path: "/health", icon: "🏥" },
			{ label: "Liveness", path: "/health/live", icon: "❤️" },
			{ label: "Readiness", path: "/health/ready", icon: "✔️" },
		],
	});

	return async () => {
		Logger.info("Shutting down gracefully...");
		(
			server as unknown as { closeAllConnections?: () => void }
		).closeAllConnections?.();
		server.close();
		await proc.cleanup();
	};
});
