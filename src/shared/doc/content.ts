import type { OpenAPIV3_1 } from "openapi-types";
import type { BaseSchema } from "valibot";
import { toOpenAPISchema } from "./schema";

/**
 * Build application/json content
 */
export function jsonContent<T extends BaseSchema<any, any, any>>(schema: T) {
	return {
		"application/json": {
			schema: toOpenAPISchema(schema),
		},
	} satisfies Record<string, OpenAPIV3_1.MediaTypeObject>;
}
