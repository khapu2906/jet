import { Hono } from "hono";
import { validator } from "hono-openapi";
import type { Container } from "@khapu2906/treasure-chest";
import { UserServiceKey, type IUserService } from "./contracts/service";
import { CreateUserDto, CreateUserResponseDto } from "./dto";
import { success } from "@/shared/utils/response";

export function createUserRoutes(container: Container): Hono {
	const service = container.resolve<IUserService>(UserServiceKey);
	const app = new Hono();

	app.post(
		"/register",
		validator("json", CreateUserDto),
		async (c) => {
			const body = c.req.valid("json");
			const result = await service.createUser(body);
			return c.json(success(CreateUserResponseDto, result), 201);
		},
	);

	return app;
}
