import { createMiddleware } from "hono/factory";
import type { AuthProvider } from "@shared/auth/providers/base";
import type { RBACUser } from "@fire-shield/core";
import { Logger } from "@shared/logger";
import { UnauthorizedError } from "@shared/errors";

/**
 * Extracts and verifies token from Authorization header.
 * Pass an AuthProvider from DI (preferred) or omit to use the default internal provider.
 */
export const authenticate = (provider: AuthProvider) =>
	createMiddleware(async (c, next) => {
		const authHeader = c.req.header("Authorization");

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			Logger.warn(`Auth header missing or invalid: ${authHeader}`);
			return c.json({ error: "Missing or invalid authorization header" }, 401);
		}

		const idToken = authHeader.substring(7);

		try {
			const userContext = await provider.verify(idToken);

			if (!userContext) {
				Logger.warn("Token invalid or expired");
				throw new UnauthorizedError("Auth invalid");
			}

			c.set("currentUser", {
				id: userContext.userId,
				roles: [userContext.userRole],
				emailVerified: userContext.emailVerified,
			} as RBACUser);

			c.set("userId", userContext.userId);
			c.set("userEmail", userContext.userEmail);
			c.set("userRole", userContext.userRole);
			c.set("emailVerified", userContext.emailVerified);

			Logger.info(
				`Token verified for user: ${userContext.userId}, role: ${userContext.userRole}`,
			);

			await next();
		} catch (error) {
			const errMessage =
				error instanceof Error ? error.message : "Unknown error";
			const errStack = error instanceof Error ? error.stack : undefined;
			Logger.error(
				`Token verification failed: ${errMessage}${errStack ? `\n${errStack}` : ""}`,
			);

			throw new UnauthorizedError(`Invalid or expired token`, errMessage);
		}
	});
