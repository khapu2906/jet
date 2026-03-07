import type {
	PaginationParams,
	PaginationMeta,
	PaginatedResponse,
	PaginationOptions,
} from '../types/pagination';

/**
 * Default pagination configuration
 */
const DEFAULT_OPTIONS: Required<PaginationOptions> = {
	defaultPage: 1,
	defaultPageSize: 10,
	maxPageSize: 100,
	minPageSize: 1,
};

/**
 * Parse and validate pagination query parameters
 *
 * @example
 * const params = parsePageParams('2', '20');
 * // Returns: { page: 2, pageSize: 20, offset: 20 }
 *
 * @param page - Page number from query string
 * @param pageSize - Page size from query string
 * @param options - Optional configuration
 * @returns Parsed and validated pagination parameters
 */
export function parsePageParams(
	page?: string,
	pageSize?: string,
	options?: PaginationOptions
): PaginationParams {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Parse page number
	let parsedPage = page ? parseInt(page, 10) : opts.defaultPage;
	if (isNaN(parsedPage) || parsedPage < 1) {
		parsedPage = opts.defaultPage;
	}

	// Parse and validate page size
	let parsedPageSize = pageSize ? parseInt(pageSize, 10) : opts.defaultPageSize;
	if (isNaN(parsedPageSize) || parsedPageSize < opts.minPageSize) {
		parsedPageSize = opts.defaultPageSize;
	}
	if (parsedPageSize > opts.maxPageSize) {
		parsedPageSize = opts.maxPageSize;
	}

	// Calculate offset
	const offset = (parsedPage - 1) * parsedPageSize;

	return {
		page: parsedPage,
		pageSize: parsedPageSize,
		offset,
	};
}

/**
 * Calculate database offset from page and pageSize
 *
 * @example
 * calculateOffset(1, 10); // 0
 * calculateOffset(3, 20); // 40
 *
 * @param page - Current page number (1-indexed)
 * @param pageSize - Number of items per page
 * @returns Offset for database query (0-indexed)
 */
export function calculateOffset(page: number, pageSize: number): number {
	return (page - 1) * pageSize;
}

/**
 * Calculate total number of pages
 *
 * @example
 * calculateTotalPages(95, 10); // 10
 * calculateTotalPages(100, 10); // 10
 * calculateTotalPages(101, 10); // 11
 *
 * @param totalCount - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages
 */
export function calculateTotalPages(totalCount: number, pageSize: number): number {
	return Math.ceil(totalCount / pageSize);
}

/**
 * Build pagination metadata for response
 *
 * @example
 * const meta = buildPaginationMeta({ page: 2, pageSize: 10 }, 95);
 * // Returns: { page: 2, page_size: 10, total_count: 95, total_pages: 10, has_next: true, has_prev: true }
 *
 * @param params - Pagination parameters
 * @param totalCount - Total number of items
 * @returns Pagination metadata object
 */
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

/**
 * Create a standardized paginated response
 *
 * @example
 * const response = createPaginatedResponse(
 *   [item1, item2, item3],
 *   { page: 1, pageSize: 10 },
 *   25
 * );
 * // Returns: { data: [...], pagination: {...} }
 *
 * @param items - Array of items for current page
 * @param params - Pagination parameters
 * @param totalCount - Total number of items
 * @returns Paginated response with data and pagination metadata
 */
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
