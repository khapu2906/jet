import { Worker } from "node:worker_threads";
import path from "node:path";
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

import {
	EventBus,
	EventBusKey,
	createEventBus,
	createEventBusWithOverrides,
} from "@shared/event-manager";
import { config } from "@shared/config";
import { errorHandler } from "@/shared/errors/handler.err";

const embeddedWorkerThreads = Math.max(
	0,
	parseInt(process.env.EMBEDDED_WORKER_THREADS || "0", 10),
);

/**
 * Application bootstrapper
 */
class MainProcess extends BaseProcess<Hono> {
	protected _modules: ModuleConstructor[] = [SystemModule, AuthModule];

	private readonly _moduleInstances = AppFactory.importModuleInstances;

	private readonly _moduleOrder: Module[] = [];

	/**
	 * Bootstrap application
	 */
	async bootstrap(): Promise<Hono> {
		// 1. Register core dependencies
		this._registerCoreDependencies();

		// 2. Register all modules
		await this._initModules();

		await this._startInfrastructure();

		// 4. Create Hono app
		this._app = new Hono();

		// 5. Setup global middleware
		this._setupMiddleware();
		// 6. Setup system routes FIRST (favicon, docs) - must come before modules
		this._setupSystemRoutes();

		// 7. Bootstrap all modules (after system routes so system routes take precedence)
		await this._bootstrapModules();

		return this._app;
	}

	/**
	 * Cleanup all modules and core resources
	 */
	async cleanup() {
		Logger.info("Shutting down gracefully...");

		// Stop EventBus first
		try {
			const eventBus = this._container.resolve<EventBus>(EventBusKey);
			await eventBus.stop();
		} catch (error) {
			Logger.error(`Error stopping EventBus: ${error}`);
		}

		// Cleanup modules in reverse order
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

	/**
	 * Register core dependencies
	 */
	protected _registerCoreDependencies() {
		this._container.singleton(DbKey, () => db);

		this._container.singleton(EventBusKey, () =>
			embeddedWorkerThreads > 0
				? createEventBusWithOverrides({ role: "publisher" })
				: createEventBus(),
		);
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

	/**
	 * Setup global middleware
	 */
	private _setupMiddleware() {
		this._app.use("*", requestId());

		// CORS middleware
		this._app.use("*", setupCors());

		// Security headers
		this._app.use("*", setupSecurityHeaders());

		// Content Security Policy
		this._app.use("*", setupContentSecurityPolicy());

		// Logging middleware
		this._app.use("*", setupLogging());

		// Rate limiting
		this._app.use("*", rateLimit);

		// Error handler
		this._app.onError(errorHandler);
	}

	/**
	 * Setup system routes (health, docs)
	 */
	private _setupSystemRoutes() {
		// Handle favicon.ico request (no auth required)
		this._app.get("/favicon.ico", (c) => c.notFound());

		if (process.env.NODE_ENV === "development") {
			this._app.get("/docs/json", createOpenAPISpec(this._app));
			this._app.get("/docs/ui", swaggerUIRoute);
		}
	}

	/**
	 * Bootstrap all modules
	 */
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

	// Spawn embedded worker threads if configured
	const threads = new Map<number, Worker>();

	if (embeddedWorkerThreads > 0) {
		const workerFile = path.join(
			path.dirname(__filename),
			`worker${path.extname(__filename)}`,
		);

		Logger.info(`Spawning ${embeddedWorkerThreads} embedded worker thread(s)...`);

		const workerExecArgv = __filename.endsWith(".ts")
			? ["--require", "tsx/cjs"]
			: process.execArgv;

		const spawnThread = (id: number) => {
			const worker = new Worker(workerFile, {
				workerData: { threadId: id },
				execArgv: workerExecArgv,
			});

			threads.set(id, worker);

			worker.on("error", (err) => {
				Logger.error(`Embedded worker thread #${id} error: ${err}`);
			});

			worker.on("exit", (code) => {
				threads.delete(id);
				if (code !== 0) {
					Logger.warn(`Embedded worker thread #${id} exited (code ${code}), restarting...`);
					spawnThread(id);
				}
			});
		};

		for (let i = 0; i < embeddedWorkerThreads; i++) {
			spawnThread(i);
		}

		Logger.info(`${embeddedWorkerThreads} embedded worker thread(s) running`);
	}

	return async () => {
		Logger.info("Shutting down gracefully...");

		// Stop embedded worker threads first
		if (threads.size > 0) {
			const exits = Array.from(threads.entries()).map(
				([id, worker]) =>
					new Promise<void>((resolve) => {
						worker.once("exit", () => resolve());
						worker.postMessage("shutdown");
						setTimeout(() => {
							if (threads.has(id)) worker.terminate();
						}, 5000).unref();
					}),
			);
			await Promise.all(exits);
		}

		(
			server as unknown as { closeAllConnections?: () => void }
		).closeAllConnections?.();
		server.close();
		await proc.cleanup();
	};
});
