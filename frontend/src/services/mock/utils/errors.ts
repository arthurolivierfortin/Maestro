/**
 * Error Utilities for Mock Services
 *
 * Creates realistic error responses that match backend error formats.
 */

/**
 * API Error class that mimics backend error responses
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Create a 404 Not Found error
 */
export function createNotFoundError(resourceType: string, id: string): ApiError {
  return new ApiError(`${resourceType} with ID '${id}' not found`, 404, 'NOT_FOUND', {
    resourceType,
    id,
  });
}

/**
 * Create a 400 Validation error
 */
export function createValidationError(message: string, fields?: Record<string, string>): ApiError {
  return new ApiError(message, 400, 'VALIDATION_ERROR', { fields });
}

/**
 * Create a 409 Conflict error (duplicate)
 */
export function createConflictError(resourceType: string, field: string, value: string): ApiError {
  return new ApiError(`${resourceType} with ${field} '${value}' already exists`, 409, 'CONFLICT', {
    resourceType,
    field,
    value,
  });
}

/**
 * Create a 500 Internal Server error
 */
export function createServerError(message: string = 'Internal server error'): ApiError {
  return new ApiError(message, 500, 'INTERNAL_ERROR');
}

/**
 * Create a 503 Service Unavailable error
 */
export function createServiceUnavailableError(service: string, reason?: string): ApiError {
  return new ApiError(
    `Service '${service}' is currently unavailable${reason ? `: ${reason}` : ''}`,
    503,
    'SERVICE_UNAVAILABLE',
    { service, reason }
  );
}
