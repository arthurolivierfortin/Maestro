import { ApiError, ConnectionError } from './errors.js';

export interface HttpTransportOptions {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  debug: boolean;
  apiKey: string | null;
  headers: Record<string, string>;
}

/**
 * Low-level HTTP transport with retry, timeout, and auth header injection.
 * Every domain module receives an HttpTransport instance.
 */
export class HttpTransport {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly debug: boolean;
  private readonly apiKey: string | null;
  private readonly extraHeaders: Record<string, string>;

  constructor(opts: HttpTransportOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.timeout = opts.timeout;
    this.retryAttempts = opts.retryAttempts;
    this.retryDelay = opts.retryDelay;
    this.debug = opts.debug;
    this.apiKey = opts.apiKey;
    this.extraHeaders = opts.headers;
  }

  /** Base URL this transport is connected to. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...this.extraHeaders,
      ...(options.headers ?? {}),
    };

    const fetchOptions: RequestInit = { method, headers };

    if (options.body !== undefined) {
      fetchOptions.body =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        if (this.debug) {
          console.debug(
            `[Maestro SDK] ${method} ${path}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`,
          );
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        fetchOptions.signal = controller.signal;

        let response: Response;
        try {
          response = await fetch(url, fetchOptions);
        } catch (err: unknown) {
          clearTimeout(timer);
          if ((err as Error)?.name === 'AbortError') {
            throw new ConnectionError(`Request to ${path} timed out after ${this.timeout}ms`);
          }
          throw new ConnectionError(`Failed to connect to ${url}: ${(err as Error).message}`, err);
        }
        clearTimeout(timer);

        if (!response.ok) {
          throw await ApiError.fromResponse(response);
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return (await response.json()) as T;
        }
        return (await response.text()) as unknown as T;
      } catch (error: unknown) {
        lastError = error;

        // Don't retry on 4xx (except 429)
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          if (this.debug) console.debug(`[Maestro SDK] Retrying after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  del<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
