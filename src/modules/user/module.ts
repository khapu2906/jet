import { Hono } from "hono";
import type { Container } from "@khapu2906/treasure-chest";
import { Module } from "@shared/base/modules";
import { AuthModule } from "../auth/module";
import { AuthServiceKey } from "../auth/contracts/service";
import { UserService } from "./service";
import { UserServiceKey } from "./contracts/service";
import { createUserRoutes } from "./routes";

export class UserModule extends Module {
	readonly name = "user";

	// auth's public surface (AuthServiceKey) is bound into this module's
	// container by the loader, from AuthModule.share(to).
	readonly imports = [AuthModule];

	register(): void {
		// Private deps only. UserServiceKey is public, so it is bound in
		// share(to) below, not here.
	}

	share(to: Container): void {
		to.bind(
			UserServiceKey,
			() => new UserService(this._container.resolve(AuthServiceKey)),
		);
	}

	start() {
		const app = new Hono();
		app.route("/users", createUserRoutes(this._container));
		return app;
	}
}
