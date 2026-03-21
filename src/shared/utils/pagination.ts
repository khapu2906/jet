import * as v from "valibot";

// Query DTO (schema-first)
export const PaginationQueryDto = v.object({
	page: v.optional(v.string()),
	pageSize: v.optional(v.string()),
});
export type PaginationQueryInput = v.InferInput<typeof PaginationQueryDto>;

// Core DTOs (schema = type)
export const PaginationMetaDto = v.object({
	page: v.pipe(v.number(), v.integer(), v.minValue(1)),
	pageSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
	totalCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
	totalPages: v.pipe(v.number(), v.integer(), v.minValue(0)),
	hasNext: v.boolean(),
	hasPrev: v.boolean(),
});
export type PaginationMeta = v.InferOutput<typeof PaginationMetaDto>;

// Generic Paginated DTO (flat)
export const createPaginatedResponseDto = <
	T extends v.BaseSchema<any, any, any>,
>(
	itemSchema: T,
) =>
	v.object({
		data: v.array(itemSchema),
		pagination: PaginationMetaDto,
		message: v.optional(v.string()),
		timestamp: v.string(),
	});

// Generic Success DTO
export const createSuccessResponseDto = <T extends v.BaseSchema<any, any, any>>(
	dataSchema: T,
) =>
	v.object({
		data: dataSchema,
		message: v.optional(v.string()),
		timestamp: v.string(),
	});

// Internal types (derived)
export type PaginationParams = {
	page: number;
	pageSize: number;
	offset: number;
};

export interface PaginationOptions {
	defaultPage?: number;
	defaultPageSize?: number;
	maxPageSize?: number;
	minPageSize?: number;
}

// Constants
const DEFAULT_OPTIONS: Required<PaginationOptions> = {
	defaultPage: 1,
	defaultPageSize: 10,
	maxPageSize: 100,
	minPageSize: 1,
};

// Core logic
export function parsePageParams(
	page?: string,
	pageSize?: string,
	options?: PaginationOptions,
): PaginationParams {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	let parsedPage = page ? parseInt(page, 10) : opts.defaultPage;
	if (isNaN(parsedPage) || parsedPage < 1) {
		parsedPage = opts.defaultPage;
	}

	let parsedPageSize = pageSize ? parseInt(pageSize, 10) : opts.defaultPageSize;

	if (isNaN(parsedPageSize) || parsedPageSize < opts.minPageSize) {
		parsedPageSize = opts.defaultPageSize;
	}

	if (parsedPageSize > opts.maxPageSize) {
		parsedPageSize = opts.maxPageSize;
	}

	return {
		page: parsedPage,
		pageSize: parsedPageSize,
		offset: (parsedPage - 1) * parsedPageSize,
	};
}

// Validate + parse query
export function parsePaginationQuery(
	input: unknown,
	options?: PaginationOptions,
): PaginationParams {
	const query = v.parse(PaginationQueryDto, input);
	return parsePageParams(query.page, query.pageSize, options);
}

export function calculateTotalPages(
	totalCount: number,
	pageSize: number,
): number {
	return Math.ceil(totalCount / pageSize);
}

export function buildPaginationMeta(
	params: Pick<PaginationParams, "page" | "pageSize">,
	totalCount: number,
): PaginationMeta {
	const totalPages = calculateTotalPages(totalCount, params.pageSize);

	return {
		page: params.page,
		pageSize: params.pageSize,
		totalCount,
		totalPages,
		hasNext: params.page < totalPages,
		hasPrev: params.page > 1,
	};
}
