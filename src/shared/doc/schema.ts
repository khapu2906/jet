import { toJsonSchema } from "@valibot/to-json-schema";
import type { OpenAPIV3_1 } from "openapi-types";
import type { BaseSchema } from "valibot";

/**
 * Convert Valibot schema → OpenAPI SchemaObject.
 *
 * Deliberately does NOT use hono-openapi's `resolver()`. `resolver()` returns a lazy descriptor
 * (`{ vendor, validate, toJSONSchema, toOpenAPISchema }`) that only gets resolved into an actual
 * JSON Schema by hono-openapi's own spec generator — and only for `responses`
 * (`resolveResponseSchemas()`), never for `requestBody`/`parameters` built by our own
 * `describeRoute()` wrapper (see `builder.ts`/`params.ts`). That asymmetry meant every route using
 * the shared `validate()` middleware (i.e. everything except the pre-existing `auth` module, which
 * happens to use hono-openapi's own `validator()`) rendered `requestBody`/`parameters` in
 * `/docs/json` as the unresolved descriptor — serialized to just `{"vendor":"valibot"}` once
 * `JSON.stringify` drops the function properties. `toJsonSchema()` (from `@valibot/to-json-schema`,
 * already a dependency) converts synchronously and directly, with no dependency on which
 * middleware/branch hono-openapi's spec generator happens to take.
 */
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toOpenAPISchema<T extends BaseSchema<any, any, any>>(
	schema: T,
): OpenAPIV3_1.SchemaObject {
	const { $schema: _$schema, ...jsonSchema } = toJsonSchema(schema);
	return jsonSchema as OpenAPIV3_1.SchemaObject;
}
