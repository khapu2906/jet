import { rateLimiter } from "hono-rate-limiter";
import type { Context, MiddlewareHandler, Next } from "hono";

export interface RateLimitDefaults {
	windowMs: number;
	limit: number;
	keyGenerator: (c: Context) => string;
}

export interface RateLimitOverride {
	/** Set to `false` to bypass rate limiting entirely for this prefix. */
	enabled?: boolean;
	windowMs?: number;
	limit?: number;
	keyGenerator?: (c: Context) => string;
}

const PASS_THROUGH: MiddlewareHandler = (_c: Context, next: Next) => next();

/** DI key — resolve this from the container, don't import a module-level singleton. */
export const RateLimitRegistryKey = Symbol("RateLimitRegistry");

/**
 * Holds per-route-prefix rate limit overrides registered by individual
 * modules (during their `register()`, before the server starts accepting
 * traffic) and builds the actual `hono-rate-limiter` middleware instances
 * from them exactly once via `build()`.
 *
 * `resolve()` — called on the hot request path by the global `rateLimit`
 * middleware — is a pure lookup: no construction, no cache mutation. All
 * limiter instances (each backed by their own in-memory hit counter) are
 * constructed up front by `build()`, not lazily on first matching request.
 */
export class RateLimitRegistry {
	private readonly _overrides = new Map<string, RateLimitOverride>();
	private readonly _limiters = new Map<string, MiddlewareHandler>();
	private _defaultLimiter: MiddlewareHandler = PASS_THROUGH;
	private _built = false;

	/**
	 * Register a rate limit override for all routes whose path starts with
	 * `pathPrefix`. The longest matching prefix wins. Must be called before
	 * `build()` (i.e. during module `register()`, not from a request handler).
	 */
	register(pathPrefix: string, override: RateLimitOverride): void {
		if (this._built) {
			throw new Error(
				`RateLimitRegistry.register("${pathPrefix}") called after build() — ` +
					"register overrides during module register(), before the server starts serving requests.",
			);
		}
		this._overrides.set(pathPrefix, override);
	}

	/**
	 * Construct every registered override's middleware instance (plus the
	 * default) once. Call exactly once, after all modules have finished
	 * registering overrides and before the server starts accepting traffic.
	 */
	build(defaults: RateLimitDefaults): void {
		this._defaultLimiter = this._createLimiter(undefined, defaults);
		for (const [prefix, override] of this._overrides) {
			this._limiters.set(prefix, this._createLimiter(override, defaults));
		}
		this._built = true;
	}

	/**
	 * Resolve the middleware to apply for `path` — pure lookup against the
	 * instances `build()` already constructed. Safe to call per-request.
	 */
	resolve(path: string): MiddlewareHandler {
		if (!this._built) return PASS_THROUGH;

		const prefix = this._matchPrefix(path);
		return (prefix && this._limiters.get(prefix)) || this._defaultLimiter;
	}

	/** Constructs a single limiter middleware instance from one override (or the defaults). */
	private _createLimiter(
		override: RateLimitOverride | undefined,
		defaults: RateLimitDefaults,
	): MiddlewareHandler {
		if (override?.enabled === false) return PASS_THROUGH;

		return rateLimiter({
			windowMs: override?.windowMs ?? defaults.windowMs,
			limit: override?.limit ?? defaults.limit,
			standardHeaders: "draft-6",
			keyGenerator: override?.keyGenerator ?? defaults.keyGenerator,
		});
	}

	private _matchPrefix(path: string): string | undefined {
		let best: string | undefined;
		for (const prefix of this._overrides.keys()) {
			if (path.startsWith(prefix) && (!best || prefix.length > best.length)) {
				best = prefix;
			}
		}
		return best;
	}
}
