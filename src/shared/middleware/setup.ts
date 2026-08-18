import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { config } from "@/shared/config";
import { Logger } from "@shared/logger";

/**
 * Configure security headers middleware
 * SECURITY: Enhanced with additional modern security headers
 */
export function setupSecurityHeaders() {
	return async (c: Context, next: Next) => {
		// Basic security headers via Hono's secureHeaders
		// crossOriginResourcePolicy: false — secureHeaders sets headers AFTER next() (see setHeaders())
		// so it would override the per-route CORP we set in the callback. Managed manually below.
		const secureHeadersMiddleware = secureHeaders({
			xFrameOptions: "DENY",
			xContentTypeOptions: "nosniff",
			xXssProtection: "1; mode=block",
			referrerPolicy: "strict-origin-when-cross-origin",
			strictTransportSecurity:
				config.nodeEnv === "production"
					? "max-age=31536000; includeSubDomains; preload"
					: undefined,
			crossOriginResourcePolicy: false, // managed manually below (per-route)
			// CSP is handled separately - don't set it here to avoid conflicts
		});

		await secureHeadersMiddleware(c, async () => {
			// Additional modern security headers not covered by secureHeaders()
			// Achieves 100% parity with Helmet.js + additional headers

			// Permissions-Policy: Control browser features
			c.header(
				"Permissions-Policy",
				"camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
			);

			// Cross-Origin policies for enhanced isolation.
			// COEP: only set for non-storage routes since COEP on resource responses
			// doesn't make sense and can conflict with the browser isolation model.
			if (!c.req.path.startsWith("/storage")) {
				c.header("Cross-Origin-Embedder-Policy", "require-corp");
				c.header("Cross-Origin-Opener-Policy", "same-origin");
			}
			// CORP: cross-origin for /storage so the FE (different port) can load media files.
			c.header(
				"Cross-Origin-Resource-Policy",
				c.req.path.startsWith("/storage") ? "cross-origin" : "same-origin",
			);

			// Prevent Flash/PDF policies
			c.header("X-Permitted-Cross-Domain-Policies", "none");

			// IE compatibility mode
			c.header("X-UA-Compatible", "IE=edge");

			// Helmet.js parity - Additional headers
			// X-DNS-Prefetch-Control: Prevents browsers from DNS prefetching
			c.header("X-DNS-Prefetch-Control", "off");

			// X-Download-Options: IE-specific, prevents opening downloads in site's context
			c.header("X-Download-Options", "noopen");

			// Origin-Agent-Cluster: Better process isolation for browsers
			c.header("Origin-Agent-Cluster", "?1");

			// Remove server identity header (security through obscurity - minor but helps)
			c.header("X-Powered-By", "");
			c.res.headers.delete("X-Powered-By"); // Ensure it's removed

			await next();
		});
	};
}

/**
 * Configure CORS middleware
 * SECURITY: Never allow wildcard origin (*) with credentials: true
 */
export function setupCors() {
	return cors({
		origin: (origin) => {
			const allowedOrigins = config.security.corsOrigins;

			// SECURITY FIX: Reject wildcard with credentials
			// This prevents CSRF attacks with authenticated requests
			if (allowedOrigins.includes("*")) {
				Logger.warn(
					"SECURITY WARNING: CORS wildcard (*) is enabled. This should only be used for public APIs without credentials.",
				);
				// For public APIs without authentication, disable credentials
				// For authenticated APIs, this should never return origin
				return null;
			}

			// Only allow explicitly listed origins
			return allowedOrigins.includes(origin) ? origin : null;
		},
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"X-Request-ID",
			"X-User-Id",
			"X-User-Email",
			"X-User-Role",
		],
		exposeHeaders: ["X-Request-ID"],
		credentials: true,
		maxAge: 86400,
	});
}

/**
 * Configure Content Security Policy middleware
 * SECURITY: More restrictive CSP, removed unsafe-eval
 */
export function setupContentSecurityPolicy() {
	return async (c: Context, next: Next) => {
		// Content Security Policy - More restrictive for Swagger UI docs
		if (c.req.path.startsWith("/docs")) {
			// SECURITY IMPROVEMENT: Removed 'unsafe-eval'
			// If Swagger UI breaks, consider:
			// 1. Hosting Swagger assets locally instead of CDN
			// 2. Using CSP nonces for inline scripts
			// 3. Restricting /docs to internal network only
			c.header(
				"Content-Security-Policy",
				"default-src 'self'; " +
					"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " + // Removed unsafe-eval
					"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
					"img-src 'self' data: https://cdn.jsdelivr.net https://validator.swagger.io; " +
					"font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
					"connect-src 'self' https://cdn.jsdelivr.net; " +
					"frame-src 'none'; " +
					"object-src 'none'; " +
					"base-uri 'self'; " + // Prevent base tag hijacking
					"form-action 'self'", // Only allow forms to submit to same origin
			);
		} else {
			// Strict CSP for all other routes (API endpoints)
			c.header(
				"Content-Security-Policy",
				"default-src 'self'; " +
					"script-src 'none'; " + // No scripts on API endpoints
					"style-src 'none'; " + // No styles on API endpoints
					"img-src 'none'; " + // No images on API endpoints
					"connect-src 'self'; " + // Allow API calls to self
					"frame-src 'none'; " +
					"object-src 'none'; " +
					"base-uri 'none'; " +
					"form-action 'none'",
			);
		}
		return next();
	};
}

/**
 * Configure logging middleware
 */
export function setupLogging() {
	return async (c: Context, next: Next) => {
		const start = Date.now();
		const requestId = c.get("requestId") || "unknown";

		// Log incoming request
		if (config.logger.level === "debug") {
			Logger.debug(`[${requestId}] → ${c.req.method} ${c.req.path}`);
		}

		await next();

		// Log response
		const duration = Date.now() - start;
		const status = c.res.status;
		const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

		const logMessage = `[${requestId}] ← ${c.req.method} ${c.req.path} ${status} ${duration}ms`;

		switch (level) {
			case "error":
				Logger.error(logMessage);
				break;
			case "warn":
				Logger.warn(logMessage);
				break;
			default:
				if (config.logger.level === "debug" || config.logger.level === "info") {
					Logger.info(logMessage);
				}
		}
	};
}
