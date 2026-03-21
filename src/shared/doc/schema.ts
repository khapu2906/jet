import { resolver } from "hono-openapi";
import type { OpenAPIV3_1 } from "openapi-types";
import type { BaseSchema } from "valibot";

/**
 * Convert Valibot schema → OpenAPI SchemaObject
 * (hide resolver typing mismatch)
 */
export function toOpenAPISchema<T extends BaseSchema<any, any, any>>(
	schema: T,
): OpenAPIV3_1.SchemaObject {
	return resolver(schema) as unknown as OpenAPIV3_1.SchemaObject;
}
