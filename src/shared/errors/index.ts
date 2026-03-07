/**
 * Custom error classes for the application
 */

export type ErrorDetails = Record<string, unknown> | Array<{ field: string; message: string }> | string;

export enum DefaultErrorName {
  BAD_REQUEST_ERR         = 'BadRequest',
  UNAUTHORIZED_ERR        = 'Unauthorized',
  FORBIDDEN_ERR           = 'Forbidden',
  NOT_FOUND_ERR           = 'NotFound',
  CONFLICT_ERR            = 'Conflict',
  VALIDATION_ERR          = 'ValidationError',
  RATE_LIMIT_ERR          = 'RateLimitError',
  INTERNAL_SERVER_ERR     = 'InternalServerError',
  SERVICE_UNAVAILABLE_ERR = 'ServiceUnavailable',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: ErrorDetails) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

/**
 * 400 Bad Request - Client sent invalid data
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: ErrorDetails) {
    super(message, 400, true, details);
    this.name = DefaultErrorName.BAD_REQUEST_ERR;
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true);
    this.name = DefaultErrorName.UNAUTHORIZED_ERR;
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true);
    this.name = DefaultErrorName.FORBIDDEN_ERR;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true);
    this.name = DefaultErrorName.NOT_FOUND_ERR;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource conflict (duplicate, state conflict)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: ErrorDetails) {
    super(message, 409, true, details);
    this.name = DefaultErrorName.CONFLICT_ERR;
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: ErrorDetails) {
    super(message, 422, true, details);
    this.name = DefaultErrorName.VALIDATION_ERR;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true);
    this.name = DefaultErrorName.RATE_LIMIT_ERR;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: ErrorDetails) {
    super(message, 500, false, details);
    this.name = DefaultErrorName.INTERNAL_SERVER_ERR;
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 503 Service Unavailable - External service unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, true);
    this.name = DefaultErrorName.SERVICE_UNAVAILABLE_ERR;
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Helper function to check if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
