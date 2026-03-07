import type { ErrorDetails } from "../errors";

/**
 * Standard API response types
 */

/**
 * Error response format
 */
export interface ErrorResponse {
	error: string;
	message?: string;
	details?: ErrorDetails;
	timestamp: string;
	path?: string;
	stack?: string;
}

/**
 * Success response format
 */
export interface SuccessResponse<T = unknown> {
	data: T;
	message?: string;
	timestamp: string;
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
	field: string;
	message: string;
	value?: unknown;
}

export type { PaginationMeta, PaginatedResponse } from "../utils/pagination";
