import { Hono } from "hono";
import { Module } from "@shared/base/modules";
import { AuthRepositoryKey, AuthServiceKey } from "./contracts";
import { AuthRepository } from "./repository";
import { AuthService } from "./service";
import { createAuthRoutes } from "./routes";
import { TokenIssuerKey, InternalAuthProvider } from "@/shared/auth/providers";
import { DbKey } from "@shared/db";

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
	}

	bootstrap() {
		const app = new Hono();
		app.route("/auth", createAuthRoutes(this.container));
		return app;
	}
}
