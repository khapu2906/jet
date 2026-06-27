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

/**
 * Holds per-route-prefix rate limit overrides registered by individual
 * modules. The global `rateLimit` middleware resolves the longest matching
 * prefix at request time and falls back to the app-wide defaults when no
 * override matches.
 */
export class RateLimitRegistry {
	private readonly _overrides = new Map<string, RateLimitOverride>();
	private readonly _limiters = new Map<string, MiddlewareHandler>();

	/**
	 * Register a rate limit override for all routes whose path starts with
	 * `pathPrefix`. The longest matching prefix wins.
	 */
	register(pathPrefix: string, override: RateLimitOverride): void {
		this._overrides.set(pathPrefix, override);
	}

	/**
	 * Resolve the middleware to apply for `path`, building (and caching) it
	 * from the matching override, or from `defaults` when no override matches.
	 */
	resolve(path: string, defaults: RateLimitDefaults): MiddlewareHandler {
		const prefix = this._matchPrefix(path);
		const cacheKey = prefix ?? "";

		const cached = this._limiters.get(cacheKey);
		if (cached) return cached;

		const built = this._build(
			prefix ? this._overrides.get(prefix) : undefined,
			defaults,
		);
		this._limiters.set(cacheKey, built);
		return built;
	}

	private _build(
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

export const rateLimitRegistry = new RateLimitRegistry();
