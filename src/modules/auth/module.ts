import { Hono } from "hono";
import { Container } from "@khapu2906/treasure-chest";
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
		// Private: only auth's own container sees these.
		this.container.bind(TokenIssuerKey, () => new InternalAuthProvider());
		this.container.bind(AuthRepositoryKey, (c) =>
			new AuthRepository(c.resolve(DbKey)),
		);
	}

	share(to: Container): void {
		// Public: whatever module imports auth gets AuthServiceKey.
		to.bind(AuthServiceKey, () =>
			new AuthService(
				this.container.resolve(AuthRepositoryKey),
				this.container.resolve(TokenIssuerKey),
			),
		);
	}

	async onInit(): Promise<void> {
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
