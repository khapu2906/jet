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
	createRateLimitMiddleware,
	RateLimitRegistry,
	RateLimitRegistryKey,
	setupCors,
	setupSecurityHeaders,
	setupContentSecurityPolicy,
	setupLogging,
} from "@shared/middleware";

import { EventBus, EventBusKey, createEventBus } from "@shared/event-manager";
import { config } from "@shared/config";
import { errorHandler } from "@/shared/errors/handler.err";
import { storageConfig } from "@/shared/config/storage";
import { LocalStorage, StorageKey } from "@/shared/storage";

/**
 * Application bootstrapper
 */
class HttpProcess extends BaseProcess<Hono> {
	protected _modules: ModuleConstructor[] = [SystemModule, AuthModule];

	private readonly _moduleInstances = AppFactory.importModuleInstances;

	private readonly _moduleOrder: Module[] = [];

	async bootstrap(): Promise<Hono> {
		this._app = new Hono();
		this._registerCoreDependencies();
		await this._startInfrastructure();

		await this._initModules();
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
		const eventBus = createEventBus();
		this._container.singleton(EventBusKey, () => eventBus);
		this._container.singleton(StorageKey, () => new LocalStorage(
			storageConfig.local.dir,
			storageConfig.local.baseUrl,
			storageConfig.local.secret
		), () => storageConfig.provider === "local")
		const rateLimitRegistry = new RateLimitRegistry();
		this._container.singleton(RateLimitRegistryKey, () => rateLimitRegistry);
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

		// Built once here, after every module's register() has already run
		// (see _initModules() above) — so all per-route overrides registered
		// via RateLimitRegistry.register() are already in place before this
		// middleware is constructed.
		const rateLimitRegistry =
			this._container.resolve<RateLimitRegistry>(RateLimitRegistryKey);
		this._app.use("*", createRateLimitMiddleware(rateLimitRegistry));

		this._app.onError(errorHandler);
	}

	private _setupSystemRoutes() {
		this._app.get("/favicon.ico", (c) => c.notFound());

		if (process.env.NODE_ENV === "development") {
			this._app.get("/docs/json", createOpenAPISpec(this._app));
			this._app.get("/docs/ui", swaggerUIRoute);
		}

		if (storageConfig.provider === "local") {
			const localStorage = this._container.resolve<LocalStorage>(StorageKey);
			this._app.route("/storage", localStorage.createRouter("/storage"));
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
	const proc = new HttpProcess();

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
		await closeServer(server);
		await proc.cleanup();
	};
});

/**
 * Stop accepting new connections and let in-flight requests finish.
 * Only force-closes remaining sockets after the grace period, so a
 * SIGTERM doesn't cut off a request that's already being handled.
 */
const DRAIN_GRACE_PERIOD_MS = 3000;

function closeServer(server: ServerType): Promise<void> {
	return new Promise((resolve) => {
		const closeIdle = () =>
			(
				server as unknown as { closeIdleConnections?: () => void }
			).closeIdleConnections?.();

		const graceTimer = setTimeout(() => {
			Logger.info(
				"Drain grace period elapsed, forcing remaining connections closed",
			);
			(
				server as unknown as { closeAllConnections?: () => void }
			).closeAllConnections?.();
		}, DRAIN_GRACE_PERIOD_MS);

		server.close(() => {
			clearTimeout(graceTimer);
			clearInterval(idlePoll);
			resolve();
		});

		// Close connections as soon as they go idle (request finished, no
		// keep-alive traffic) instead of waiting out the whole grace period.
		closeIdle();
		const idlePoll = setInterval(closeIdle, 250);
	});
}
