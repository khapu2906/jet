import type { OpenAPIV3_1 } from "openapi-types";
import type { GenericSchema } from "valibot";
import { toOpenAPISchema } from "./schema";

export function schemaToParameters(
	schema: GenericSchema,
	location: "query" | "path" = "query",
): OpenAPIV3_1.ParameterObject[] {
	const root = toOpenAPISchema(schema);

	const properties: Record<string, unknown> = {};
	const required = new Set<string>();

	const collect = (s: OpenAPIV3_1.SchemaObject) => {
		if (s.type === "object" && s.properties) {
			Object.assign(properties, s.properties);

			for (const key of s.required ?? []) {
				required.add(key);
			}
		}

		if ("allOf" in s && Array.isArray(s.allOf)) {
			for (const child of s.allOf) {
				collect(child as OpenAPIV3_1.SchemaObject);
			}
		}
	};

	collect(root);

	return Object.entries(properties).map(([name, propertySchema]) => ({
		name,
		in: location,
		// OpenAPI bắt buộc path params phải required=true
		required: location === "path" ? true : required.has(name),
		schema: propertySchema as
			| OpenAPIV3_1.SchemaObject
			| OpenAPIV3_1.ReferenceObject,
	})) as OpenAPIV3_1.ParameterObject[];
}
