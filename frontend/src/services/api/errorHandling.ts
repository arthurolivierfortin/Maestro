/**
 * API Error Handling Utilities
 * 
 * Provides error handling, retry logic, and user-friendly error messages
 * for backend API communication.
 */

/**
 * Custom API error class with status code and details
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  /**
   * Check if error is a network error (0)
   */
  isNetworkError(): boolean {
    return this.status === 0;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    if (this.isNetworkError()) {
      return 'Cannot connect to the backend. Please ensure the server is running and try again.';
    }
    
    if (this.status === 404) {
      return 'The requested resource was not found.';
    }
    
    if (this.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    
    if (this.status === 401) {
      return 'Authentication required. Please sign in.';
    }
    
    if (this.isServerError()) {
      return 'A server error occurred. Please try again later.';
    }
    
    return this.message || 'An unexpected error occurred.';
  }
}

/**
 * Check if error is a 404 Not Found error
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Check if error is a network/connection error
 */
export function isConnectionError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 0) {
    return true;
  }
  
  if (error instanceof Error) {
    return error.message.includes('ECONNREFUSED') ||
           error.message.includes('Network Error') ||
           error.message.includes('Failed to fetch');
  }
  
  return false;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.getUserMessage();
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @returns Promise with the operation result
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) - these won't succeed on retry
      if (error instanceof ApiError && error.isClientError()) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt >= maxRetries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

/**
 * Retry with custom retry condition
 * 
 * @param operation - The async operation to retry
 * @param shouldRetry - Function to determine if operation should be retried
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelayMs - Initial delay in milliseconds
 */
export async function withRetryIf<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error) || attempt >= maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}
