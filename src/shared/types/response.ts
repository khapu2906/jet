import type { ErrorDetails } from '../errors';

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

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T = unknown> {
  data: T[];
  meta: PaginationMeta;
  timestamp: string;
}
