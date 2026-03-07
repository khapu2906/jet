import * as v from 'valibot';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PaginationQuery {
	page?: string;
	page_size?: string;
}

export interface PaginationParams {
	page: number;
	pageSize: number;
	offset: number;
}

export interface PaginationMeta {
	page: number;
	page_size: number;
	total_count: number;
	total_pages: number;
	has_next: boolean;
	has_prev: boolean;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationMeta;
}

export interface PaginationOptions {
	defaultPage?: number;
	defaultPageSize?: number;
	maxPageSize?: number;
	minPageSize?: number;
}

// ─────────────────────────────────────────────────────────────
// Valibot schemas
// ─────────────────────────────────────────────────────────────

export const PaginationQuerySchema = v.object({
	page: v.optional(v.string(), '1'),
	page_size: v.optional(v.string(), '10'),
});

export type PaginationQueryInput = v.InferInput<typeof PaginationQuerySchema>;

export const PaginationMetaSchema = v.object({
	page: v.pipe(v.number(), v.integer(), v.minValue(1)),
	page_size: v.pipe(v.number(), v.integer(), v.minValue(1)),
	total_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
	total_pages: v.pipe(v.number(), v.integer(), v.minValue(0)),
	has_next: v.boolean(),
	has_prev: v.boolean(),
});

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<PaginationOptions> = {
	defaultPage: 1,
	defaultPageSize: 10,
	maxPageSize: 100,
	minPageSize: 1,
};

export function parsePageParams(
	page?: string,
	pageSize?: string,
	options?: PaginationOptions
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

export function calculateOffset(page: number, pageSize: number): number {
	return (page - 1) * pageSize;
}

export function calculateTotalPages(totalCount: number, pageSize: number): number {
	return Math.ceil(totalCount / pageSize);
}

export function buildPaginationMeta(
	params: Pick<PaginationParams, 'page' | 'pageSize'>,
	totalCount: number
): PaginationMeta {
	const totalPages = calculateTotalPages(totalCount, params.pageSize);

	return {
		page: params.page,
		page_size: params.pageSize,
		total_count: totalCount,
		total_pages: totalPages,
		has_next: params.page < totalPages,
		has_prev: params.page > 1,
	};
}

export function createPaginatedResponse<T>(
	items: T[],
	params: Pick<PaginationParams, 'page' | 'pageSize'>,
	totalCount: number
): PaginatedResponse<T> {
	return {
		data: items,
		pagination: buildPaginationMeta(params, totalCount),
	};
}
