/**
 * API error returned by the Maestro backend (HTTP 4xx/5xx).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown>;
  readonly code: string | null;

  constructor(status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = (details.code as string) ?? null;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = { error: response.statusText };
    }
    return new ApiError(
      response.status,
      (body.message as string) ?? (body.error as string) ?? `HTTP ${response.status}`,
      (body.details as Record<string, unknown>) ?? {},
    );
  }
}

/**
 * Thrown when the SDK cannot connect to the backend at all.
 */
export class ConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Thrown when a request exceeds the configured timeout.
 */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}
