import { Hono } from "hono";
import { validator } from "hono-openapi";
import type { Container } from "@khapu2906/treasure-chest";
import { AuthServiceKey, type IAuthService } from "./contracts";
import { LoginDto, RegisterDto } from "./dto";

export function createAuthRoutes(container: Container): Hono {
	const service = container.resolve<IAuthService>(AuthServiceKey);
	const app = new Hono();

	app.post("/register", validator("json", RegisterDto), async (c) => {
		const body = c.req.valid("json");
		const result = await service.register(body);
		return c.json(result, 201);
	});

	app.post("/login", validator("json", LoginDto), async (c) => {
		const body = c.req.valid("json");
		const result = await service.login(body);
		return c.json(result);
	});

	return app;
}
