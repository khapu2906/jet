/**
 * Centralized exports for shared utilities
 */

// Middleware
export {
  getUserId,
  getUserEmail,
  getUserRole,
  getEmailVerified,
  errorHandler,
} from './middleware';

// Validation utilities (for backward compatibility)
export {
  validate,
  getValidatedData,
  validateMultiple,
  type ValidationSource,
} from './middleware/validator';

// Errors
export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  isOperationalError,
} from './errors';

// Types
export type {
  ErrorResponse,
  SuccessResponse,
  ValidationErrorDetail,
  PaginationMeta,
  PaginatedResponse,
} from './types/response';

// File utilities
export {
  isImageFile,
  isPdfFile,
  isPdfUrl,
  isVideoFile,
  getFileType,
  supportsTinEye,
  supportsVisionAnalysis,
  IMAGE_EXTENSIONS,
  PDF_EXTENSION,
  VIDEO_EXTENSIONS,
} from './utils/file-utils';
