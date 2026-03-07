import * as v from 'valibot';

/**
 * Reusable Valibot schemas for pagination
 */

/**
 * Pagination query schema for request validation
 * Query params are always strings from URL
 */
export const PaginationQuerySchema = v.object({
	page: v.optional(v.string(), '1'),
	page_size: v.optional(v.string(), '10'),
});

export type PaginationQueryInput = v.InferInput<typeof PaginationQuerySchema>;

/**
 * Pagination metadata schema for response validation
 */
export const PaginationMetaSchema = v.object({
	page: v.pipe(v.number(), v.integer(), v.minValue(1)),
	page_size: v.pipe(v.number(), v.integer(), v.minValue(1)),
	total_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
	total_pages: v.pipe(v.number(), v.integer(), v.minValue(0)),
	has_next: v.boolean(),
	has_prev: v.boolean(),
});

export type PaginationMetaOutput = v.InferOutput<typeof PaginationMetaSchema>;
