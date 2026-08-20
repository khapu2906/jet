import { Hono } from "hono";
import { Module } from "@shared/base/modules";
import { AuthRepository } from "./repository";
import { AuthRepositoryKey } from "./contracts/repository";
import { AuthService } from "./service";
import { AuthServiceKey } from "./contracts/service";
import { createAuthRoutes } from "./routes";
import { TokenIssuerKey, InternalAuthProvider } from "@/shared/auth/providers";
import { DbKey } from "@shared/db";
import { RateLimitRegistry, RateLimitRegistryKey } from "@shared/middleware";

export class AuthModule extends Module {
	readonly name = "auth";

	register(): void {
		this.container.bind(TokenIssuerKey, () => new InternalAuthProvider());

		this.container.bind(AuthRepositoryKey, (c) => {
			return new AuthRepository(c.resolve(DbKey));
		});

		this.container.bind(
			AuthServiceKey,
			(c) =>
				new AuthService(
					c.resolve(AuthRepositoryKey),
					c.resolve(TokenIssuerKey),
				),
		);

		// Registration/login are unauthenticated by nature (no user identity to
		// key a rate limit by yet), so they get a tighter, IP-keyed limit than
		// the app-wide default — otherwise a script can spam account creation
		// well within the generic per-IP quota.
		const rateLimitRegistry =
			this.container.resolve<RateLimitRegistry>(RateLimitRegistryKey);
		rateLimitRegistry.register("/auth/register", { limit: 5, windowMs: 60_000 });
		rateLimitRegistry.register("/auth/login", { limit: 10, windowMs: 60_000 });
	}

	bootstrap() {
		const app = new Hono();
		app.route("/auth", createAuthRoutes(this.container));
		return app;
	}
}
