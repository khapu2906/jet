import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { config } from "./config";

// Create a function that returns the OpenAPI route handler
export const createOpenAPISpec = (app: Hono) => {
	return openAPIRouteHandler(app, {
		documentation: {
			openapi: "3.1.0",
			info: {
				title: "Jet",
				version: "1.0.0",
				description: "",
				contact: {
					name: "Jet",
				},
			},
			servers: [
				{
					url: `http://localhost:${config.port}`,
					description: "Development server",
				},
			],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
						description: "JWT token obtained from authentication service",
					},
				},
			},
			security: [
				{
					bearerAuth: [],
				},
				{
					headerAuth: [],
				},
			],
		},
	});
};

// Swagger UI route handler
export const swaggerUIRoute = swaggerUI({
	url: "/docs/json",
	title: "Flint AI Backend API",
});
