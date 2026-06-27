import * as v from "valibot";

export const ErrorDetailsDto = v.union([
	v.record(v.string(), v.unknown()),
	v.array(
		v.object({
			field: v.string(),
			message: v.string(),
		}),
	),
	v.string(),
]);

export type ErrorDetails = v.InferOutput<typeof ErrorDetailsDto>;

/**
 * Standard error response
 */
export const ErrorResponseDto = v.object({
	error: v.string(),
	message: v.optional(v.string()),
	timestamp: v.string(),
	path: v.optional(v.string()),
	stack: v.optional(v.string()),
	details: v.optional(ErrorDetailsDto),
});

export type ErrorResponse = v.InferOutput<typeof ErrorResponseDto>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createSuccessResponseDto = <T extends v.BaseSchema<any, any, any>>(
	dataSchema: T,
) => {
	return v.object({
		data: dataSchema,
		message: v.optional(v.string()),
		timestamp: v.string(),
	});
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SuccessResponse<T extends v.BaseSchema<any, any, any>> =
	v.InferOutput<ReturnType<typeof createSuccessResponseDto<T>>>;
