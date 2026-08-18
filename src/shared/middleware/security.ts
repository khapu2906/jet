import type { Context, MiddlewareHandler, Next } from "hono";
import { config } from "@shared/config";
import type { RateLimitDefaults, RateLimitRegistry } from "./rate-limit-registry";

function parseTimeWindow(window: string): number {
	const match = window.match(/^(\d+)([smh])$/);
	if (!match) return 15 * 60 * 1000;

	const value = parseInt(match[1]);
	switch (match[2]) {
		case "s":
			return value * 1000;
		case "m":
			return value * 60 * 1000;
		case "h":
			return value * 60 * 60 * 1000;
		default:
			return 15 * 60 * 1000;
	}
}

/**
 * Decode JWT payload without signature verification.
 * Only used to extract `sub` (Cognito user ID) as a stable rate-limit key.
 * Security note: this is NOT for authorization — the full token is verified
 * later by the authenticate middleware.
 */
function extractSubFromJwt(authHeader: string | undefined): string | null {
	if (!authHeader?.startsWith("Bearer ")) return null;
	try {
		const payloadB64 = authHeader.slice(7).split(".")[1];
		if (!payloadB64) return null;
		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
		return typeof payload?.sub === "string" ? payload.sub : null;
	} catch {
		return null;
	}
}

const defaultKeyGenerator = (c: Context): string => {
	// 1. Authenticated — derive key from Cognito sub inside the signed JWT
	const sub = extractSubFromJwt(c.req.header("Authorization"));
	if (sub) return `user:${sub}`;

	// 2. Unauthenticated — use real client IP
	//    X-Forwarded-For may be "client, proxy1, proxy2" — leftmost is the real client
	const forwardedFor = c.req.header("X-Forwarded-For")?.split(",")[0].trim();
	const realIp = c.req.header("X-Real-IP");
	const socketIp = (
		c.env as { incoming?: { socket?: { remoteAddress?: string } } }
	)?.incoming?.socket?.remoteAddress;

	return forwardedFor || realIp || socketIp || "anonymous";
};

const rateLimitDefaults: RateLimitDefaults = {
	windowMs: parseTimeWindow(config.security.rateLimitWindow),
	limit: config.security.rateLimitMax,
	keyGenerator: defaultKeyGenerator,
};

/**
 * Builds the global rate limiting middleware from a container-managed
 * `RateLimitRegistry`. Call once, from `HttpProcess._setupMiddleware()`,
 * after all modules have finished registering their per-route overrides
 * (during `_initModules()` → module `register()`) — this is what triggers
 * `registry.build()`, constructing every limiter instance up front so the
 * request path only ever does a pure lookup, never lazy construction.
 *
 * Controlled by RATE_LIMIT_ENABLED / RATE_LIMIT_MAX / RATE_LIMIT_WINDOW env vars.
 *
 * Default key resolution order:
 *   1. Authenticated  → `user:<cognito_sub>` (extracted from Bearer JWT, cannot be spoofed)
 *   2. Unauthenticated → real IP from X-Forwarded-For / X-Real-IP / TCP socket
 *   3. Fallback        → 'anonymous' (all unknown clients share one bucket)
 *
 * Modules can register a per-route override (different limit/window/keyGenerator,
 * or `{ enabled: false }` to bypass entirely) via
 * `container.resolve<RateLimitRegistry>(RateLimitRegistryKey).register(prefix, override)`
 * during their own `register()`. The longest matching path prefix wins;
 * unmatched paths fall back to the defaults above.
 *
 * NOTE: Uses the default in-memory store. For multi-process / clustered deployments
 * replace with a shared store (e.g. hono-rate-limiter Redis adapter).
 */
export function createRateLimitMiddleware(
	registry: RateLimitRegistry,
): MiddlewareHandler {
	if (!config.security.rateLimitEnabled) {
		return (_c: Context, next: Next) => next();
	}

	registry.build(rateLimitDefaults);
	return (c: Context, next: Next) => registry.resolve(c.req.path)(c, next);
}
