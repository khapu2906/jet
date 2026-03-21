import { ErrorDetails } from "@shared/dto";
import { AppError, DefaultErrorName } from "./base.err";

/**
 * 400 Bad Request - Client sent invalid data
 */
export class BadRequestError extends AppError {
	constructor(message: string = "Bad request", details?: ErrorDetails) {
		super(message, 400, true, details);
		this.name = DefaultErrorName.BAD_REQUEST_ERR;
		Object.setPrototypeOf(this, BadRequestError.prototype);
	}
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
	constructor(message: string = "Unauthorized", details?: ErrorDetails) {
		super(message, 401, true, details);
		this.name = DefaultErrorName.UNAUTHORIZED_ERR;
		Object.setPrototypeOf(this, UnauthorizedError.prototype);
	}
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends AppError {
	constructor(message: string = "Forbidden", details?: ErrorDetails) {
		super(message, 403, true, details);
		this.name = DefaultErrorName.FORBIDDEN_ERR;
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
	constructor(message: string = "Resource not found", details?: ErrorDetails) {
		super(message, 404, true, details);
		this.name = DefaultErrorName.NOT_FOUND_ERR;
		Object.setPrototypeOf(this, NotFoundError.prototype);
	}
}

/**
 * 409 Conflict - Resource conflict (duplicate, state conflict)
 */
export class ConflictError extends AppError {
	constructor(message: string = "Resource conflict", details?: ErrorDetails) {
		super(message, 409, true, details);
		this.name = DefaultErrorName.CONFLICT_ERR;
		Object.setPrototypeOf(this, ConflictError.prototype);
	}
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export class ValidationError extends AppError {
	constructor(message: string = "Validation failed", details?: ErrorDetails) {
		super(message, 422, true, details);
		this.name = DefaultErrorName.VALIDATION_ERR;
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
	constructor(message: string = "Too many requests", details?: ErrorDetails) {
		super(message, 429, true, details);
		this.name = DefaultErrorName.RATE_LIMIT_ERR;
		Object.setPrototypeOf(this, RateLimitError.prototype);
	}
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends AppError {
	constructor(
		message: string = "Internal server error",
		details?: ErrorDetails,
	) {
		super(message, 500, false, details);
		this.name = DefaultErrorName.INTERNAL_SERVER_ERR;
		Object.setPrototypeOf(this, InternalServerError.prototype);
	}
}

/**
 * 503 Service Unavailable - External service unavailable
 */
export class ServiceUnavailableError extends AppError {
	constructor(message: string = "Service unavailable") {
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
