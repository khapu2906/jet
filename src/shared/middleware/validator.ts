import { type Context, type Next } from "hono";
import * as v from "valibot";
import { ValidationError } from "@shared/errors";

/**
 * Validation source types
 */
export type ValidationSource = "body" | "query" | "params" | "header";

/**
 * Validation middleware factory
 * Validates request data against Valibot schema
 */
export function validate(
	schema: v.GenericSchema,
	source: ValidationSource = "body",
) {
	return async (c: Context, next: Next) => {
		try {
			let data: unknown;

			// Extract data based on source
			switch (source) {
				case "body":
					data = await c.req.json();
					break;
				case "query":
					data = c.req.query();
					break;
				case "params":
					data = c.req.param();
					break;
				case "header": {
					const headerData: Record<string, string> = {};
					c.req.raw.headers.forEach((value, key) => {
						headerData[key] = value;
					});
					data = headerData;
					break;
				}
				default:
					throw new Error(`Invalid validation source: ${source}`);
			}

			// Validate data
			const validatedData = v.parse(schema, data);

			// Store validated data in context
			c.set("validatedData", validatedData);

			await next();
		} catch (error: unknown) {
			if (error instanceof v.ValiError) {
				const details = error.issues.map((e) => ({
					field: e.path?.map((p: { key: unknown }) => p.key).join(".") || "",
					message: e.message,
					value: e.input,
				}));

				throw new ValidationError("Validation failed", details);
			}
			throw error;
		}
	};
}

/**
 * Get validated data from context
 */
export function getValidatedData<T = unknown>(c: Context): T {
	return c.get("validatedData") as T;
}

/**
 * Validate multiple sources
 */
export function validateMultiple(
	validations: Array<{ schema: v.GenericSchema; source: ValidationSource }>,
) {
	return async (c: Context, next: Next) => {
		const validatedData: Record<string, unknown> = {};

		for (const validation of validations) {
			try {
				let data: unknown;

				// Extract data based on source
				switch (validation.source) {
					case "body":
						data = await c.req.json();
						break;
					case "query":
						data = c.req.query();
						break;
					case "params":
						data = c.req.param();
						break;
					case "header": {
						const headerData: Record<string, string> = {};
						c.req.raw.headers.forEach((value, key) => {
							headerData[key] = value;
						});
						data = headerData;
						break;
					}
				}

				// Validate and store
				validatedData[validation.source] = v.parse(validation.schema, data);
			} catch (error: unknown) {
				if (error instanceof v.ValiError) {
					const details = error.issues.map((e) => ({
						field: `${validation.source}.${e.path?.map((p: { key: unknown }) => p.key).join(".") || ""}`,
						message: e.message,
					}));

					throw new ValidationError("Validation failed", details);
				}
				throw error;
			}
		}

		// Store all validated data
		c.set("validatedData", validatedData);

		await next();
	};
}
