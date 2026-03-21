import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError, isOperationalError, ValidationError } from "@shared/errors";
import { Logger } from "@shared/logger";
import { ValiError } from "valibot";
import { ErrorDetails, ErrorResponse } from "@shared/dto";

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
export async function errorHandler(error: Error, c: Context) {
	const err = normalizeError(error);
	// Log error for debugging
	Logger.error(
		`[${c.req.method}] ${c.req.path} — ${err.name}: ${err.message}${
			process.env.NODE_ENV === "development" && err.stack
				? `\n${err.stack}`
				: ""
		}`,
	);

	const response: ErrorResponse = {
		error: err.name,
		message: err.message,
		timestamp: new Date().toISOString(),
		path: c.req.path,
	};

	if (err.details) {
		response.details = err.details;
	}

	// Chỉ expose stack khi KHÔNG phải operational error
	if (process.env.NODE_ENV === "development" && !isOperationalError(err)) {
		response.stack = err.stack;
	}

	return c.json(response, err.statusCode as ContentfulStatusCode);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn: (c: Context) => Promise<Response | void>) {
	return async (c: Context) => {
		try {
			return await fn(c);
		} catch (error) {
			return errorHandler(error as Error, c);
		}
	};
}

/**
 * Normalize all error into AppError
 */
function normalizeError(error: unknown): AppError {
	// AppError (đã chuẩn)
	if (error instanceof AppError) {
		return error;
	}

	// Validation (Valibot)
	if (error instanceof ValiError) {
		const details: ErrorDetails = error.issues?.map((e) => ({
			field: e.path?.join(".") || "unknown",
			message: e.message,
		}));

		return new ValidationError("Validation failed", details);
	}

	// Unknown error
	if (error instanceof Error) {
		return new AppError(error.message || "Internal server error", 500);
	}

	// Non-error throw (string, number...)
	return new AppError("Internal server error", 500);
}
