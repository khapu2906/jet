import { Hono } from "hono";
import { validator } from "hono-openapi";
import type { Container } from "@khapu2906/treasure-chest";
import { AuthServiceKey, type IAuthService } from "./contracts";
import {
	LoginDto,
	LoginResponseDto,
	RegisterDto,
	RegisterResponseDto,
} from "./dto";
import { describeRoute } from "@shared/doc";
import { docs } from "./doc";
import { success } from "@/shared/utils/response";

export function createAuthRoutes(container: Container): Hono {
	const service = container.resolve<IAuthService>(AuthServiceKey);
	const app = new Hono();

	app.post(
		"/register",
		describeRoute(docs.register),
		validator("json", RegisterDto),
		async (c) => {
			const body = c.req.valid("json");
			const result = await service.register(body);
			return c.json(success(RegisterResponseDto, result));
			return c.json(result, 201);
		},
	);

	app.post(
		"/login",
		describeRoute(docs.login),
		validator("json", LoginDto),
		async (c) => {
			const body = c.req.valid("json");
			const result = await service.login(body);
			return c.json(success(LoginResponseDto, result));
		},
	);

	return app;
}
