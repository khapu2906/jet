import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError, isOperationalError } from '@shared/errors';
import type { ErrorDetails } from '@shared/errors';
import type { ErrorResponse } from '@shared/types/response';
import { Logger } from '@shared/logger';

interface ValiErrorIssue {
  path?: string[];
  message: string;
}

interface ValiError extends Error {
  issues?: ValiErrorIssue[];
}

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
export async function errorHandler(err: Error, c: Context) {
  // Log error for debugging
  Logger.error(`[${c.req.method}] ${c.req.path} — ${err.name}: ${err.message}${process.env.NODE_ENV === 'development' && err.stack ? `\n${err.stack}` : ''}`);

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let details: ErrorDetails | undefined = undefined;

  // Handle custom AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }

  // Handle Valibot validation errors
  else if (err.name === 'ValiError') {
    statusCode = 422;
    message = 'Validation failed';
    const valiErr = err as ValiError;
    details = valiErr.issues?.map((e) => ({
      field: e.path?.join('.') || 'unknown',
      message: e.message,
    }));
  }
  // Handle other known errors
  else if (err.message) {
    message = err.message;
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: err.name || 'Error',
    message,
    timestamp: new Date().toISOString(),
    path: c.req.path,
  };

  // Add details if available
  if (details) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && !isOperationalError(err)) {
    errorResponse.stack = err.stack;
  }

  return c.json(errorResponse, statusCode as ContentfulStatusCode);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (c: Context) => Promise<Response | void>
) {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      return errorHandler(error as Error, c);
    }
  };
}
