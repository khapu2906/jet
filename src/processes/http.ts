import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { db, DbKey } from "@shared/db";
import { createOpenAPISpec, swaggerUIRoute } from "@/shared/doc/openapi";
import type { Module, ModuleConstructor } from "@/shared/base/modules";

import { BaseProcess, Runner } from "@/shared/base/processes";
import type { ServerType } from "@hono/node-server";
import { Logger, LoggerUI } from "@shared/logger";

import { requestId } from "hono/request-id";

import { AuthModule } from "@/modules/auth/module";
import { SystemModule } from "@/modules/system/module";
import { UserModule } from "@/modules/user/module";

import {
	createRateLimitMiddleware,
	RateLimitRegistry,
	RateLimitRegistryKey,
	setupCors,
	setupSecurityHeaders,
	setupContentSecurityPolicy,
	setupLogging,
} from "@shared/middleware";

import { config } from "@shared/config";
import { errorHandler } from "@/shared/errors/handler.err";
import { storageConfig } from "@/shared/config/storage";
import { LocalStorage, StorageKey } from "@/shared/storage";

/**
 * Application bootstrapper
 */
class HttpProcess extends BaseProcess<Hono> {
	protected _modules: ModuleConstructor[] = [
		SystemModule,
		AuthModule,
		UserModule,
	];

	/** Only root modules mount routes; imported modules are loaded, not bootstrapped. */
	protected async _build(modules: Module[]): Promise<Hono> {
		const app = new Hono();
		this._app = app;

		this._setupMiddleware();
		this._setupSystemRoutes();

		for (const module of modules) {
			const router = await module.start();

			// Process-defined artifact: this process only mounts Hono apps and
			// ignores anything meant for another runtime.
			if (router instanceof Hono) app.route("/", router);
		}

		return app;
	}

	protected async _registerCoreDependencies() {
		await this._enableEventBus();
		this._container.singleton(DbKey, () => db);
		this._container.singleton(StorageKey, () => new LocalStorage(
			storageConfig.local.dir,
			storageConfig.local.baseUrl,
			storageConfig.local.secret
		), () => storageConfig.provider === "local")
		const rateLimitRegistry = new RateLimitRegistry();
		this._container.singleton(RateLimitRegistryKey, () => rateLimitRegistry);
	}

	private _setupMiddleware() {
		this._app.use("*", requestId());
		this._app.use("*", setupCors());
		this._app.use("*", setupSecurityHeaders());
		this._app.use("*", setupContentSecurityPolicy());
		this._app.use("*", setupLogging());

		// Built once here, after every module's onInit() has already run — so
		// all per-route overrides registered via RateLimitRegistry.register()
		// are already in place before this middleware is constructed.
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
