/**
 * Standardized Pagination Types
 * Used across all modules for consistent pagination
 */

/**
 * Query parameters from request (string format from URL)
 */
export interface PaginationQuery {
	page?: string;
	page_size?: string;
}

/**
 * Parsed and validated pagination parameters
 */
export interface PaginationParams {
	page: number;
	pageSize: number;
	offset: number;
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
	page: number;
	page_size: number;
	total_count: number;
	total_pages: number;
	has_next: boolean;
	has_prev: boolean;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationMeta;
}

/**
 * Options for pagination configuration
 */
export interface PaginationOptions {
	defaultPage?: number;
	defaultPageSize?: number;
	maxPageSize?: number;
	minPageSize?: number;
}
