import * as v from "valibot";

/**
 * Helper to coerce a string env var to number with a default fallback.
 */
export const envNumber = (fallback: number) =>
	v.optional(
		v.pipe(
			v.union([v.string(), v.number()]),
			v.transform(Number),
			v.number(),
			v.minValue(0),
		),
		fallback,
	);

/**
 * Parse and validate a subset of process.env against a valibot schema.
 * Throws a human-readable error listing all invalid fields.
 */
export function parseEnv<
	TEntries extends v.ObjectEntries,
	TMessage extends v.ErrorMessage<v.ObjectIssue> | undefined,
>(schema: v.ObjectSchema<TEntries, TMessage>): v.InferOutput<typeof schema> {
	const result = v.safeParse(schema, process.env);

	if (!result.success) {
		const issues = v.flatten(result.issues);
		const lines = Object.entries(issues.nested ?? {})
			.map(([key, msgs]) => `  ${key}: ${(msgs as string[]).join(", ")}`)
			.join("\n");
		throw new Error(`FATAL: Invalid environment variables:\n${lines}`);
	}

	return result.output;
}
