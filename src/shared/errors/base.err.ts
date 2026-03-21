/**
 * Custom error classes for the application
 */

import { ErrorDetails } from "@shared/dto";

export enum DefaultErrorName {
	BAD_REQUEST_ERR = "BadRequest",
	UNAUTHORIZED_ERR = "Unauthorized",
	FORBIDDEN_ERR = "Forbidden",
	NOT_FOUND_ERR = "NotFound",
	CONFLICT_ERR = "Conflict",
	VALIDATION_ERR = "ValidationError",
	RATE_LIMIT_ERR = "RateLimitError",
	INTERNAL_SERVER_ERR = "InternalServerError",
	SERVICE_UNAVAILABLE_ERR = "ServiceUnavailable",
}

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;
	public readonly details?: ErrorDetails;

	constructor(
		message: string,
		statusCode: number = 500,
		isOperational: boolean = true,
		details?: ErrorDetails,
	) {
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
