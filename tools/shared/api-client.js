/**
 * Maestro API Client
 * Unified client for accessing the Maestro backend API
 * 
 * Usage:
 *   const client = new MaestroApiClient('http://localhost:5000');
 *   const blocks = await client.listBlocks();
 */

class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = details.code || null;
  }

  static async fromResponse(response) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = { error: response.statusText };
    }
    return new ApiError(
      response.status,
      body.message || body.error || `HTTP ${response.status}`,
      body.details || {}
    );
  }
}

class MaestroApiClient {
  constructor(baseUrl = 'http://localhost:5000', options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.debug = options.debug || false;
  }

  async _fetch(method, path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const fetchOptions = {
      method,
      headers,
      timeout: this.timeout,
      ...options
    };

    if (options.body) {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    let lastError;
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        if (this.debug) {
          console.debug(`[Maestro API] ${method} ${path}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          throw await ApiError.fromResponse(response);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return await response.text();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except 429 and 503
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        // Retry on connection errors, timeouts, and server errors
        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          if (this.debug) console.debug(`[Maestro API] Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // ===== HEALTH & STATUS =====

  async getHealth() {
    return this._fetch('GET', '/api/discovery/health');
  }

  async getCapabilities() {
    return this._fetch('GET', '/api/discovery/capabilities');
  }

  async getConfig() {
    return this._fetch('GET', '/api/discovery/config');
  }

  // ===== BLOCKS =====

  async listBlocks(filter = {}) {
    const params = new URLSearchParams();
    if (filter.type) params.set('type', filter.type);
    if (filter.capability) params.set('capability', filter.capability);

    const queryString = params.toString();
    const path = `/api/blocks${queryString ? `?${queryString}` : ''}`;
    return this._fetch('GET', path);
  }

  async getBlock(id) {
    return this._fetch('GET', `/api/blocks/${id}`);
  }

  async searchBlocks(query) {
    if (!query) throw new Error('Search query is required');
    return this._fetch('GET', `/api/discovery/blocks/search?q=${encodeURIComponent(query)}`);
  }

  async getBlocksByType(type) {
    return this._fetch('GET', `/api/discovery/blocks/by-type/${encodeURIComponent(type)}`);
  }

  async getBlocksByCapability(capability) {
    return this._fetch('GET', `/api/discovery/blocks/by-capability/${encodeURIComponent(capability)}`);
  }

  async createBlock(block) {
    if (!block || !block.name || !block.type) {
      throw new Error('Block must have name and type');
    }
    return this._fetch('POST', '/api/blocks', { body: block });
  }

  async updateBlock(id, updates) {
    if (!id) throw new Error('Block ID is required');
    return this._fetch('PUT', `/api/blocks/${id}`, { body: updates });
  }

  async deleteBlock(id) {
    if (!id) throw new Error('Block ID is required');
    return this._fetch('DELETE', `/api/blocks/${id}`);
  }

  async getBlockContent(id, filePath) {
    if (!id) throw new Error('Block ID is required');
    const path = filePath ? `/api/blocks/${id}/content/${filePath}` : `/api/blocks/${id}/content`;
    return this._fetch('GET', path);
  }

  async updateBlockContent(id, filePath, content) {
    if (!id) throw new Error('Block ID is required');
    return this._fetch('PUT', `/api/blocks/${id}/content/${filePath}`, {
      body: content,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // ===== WORKFLOWS =====

  async executeWorkflow(id, options = {}) {
    if (!id) throw new Error('Workflow ID is required');
    return this._fetch('POST', `/api/workflows/${id}/execute`, {
      body: options
    });
  }

  async getExecutionStatus(executionId) {
    if (!executionId) throw new Error('Execution ID is required');
    return this._fetch('GET', `/api/executions/${executionId}`);
  }

  async cancelExecution(executionId) {
    if (!executionId) throw new Error('Execution ID is required');
    return this._fetch('POST', `/api/executions/${executionId}/cancel`);
  }

  // ===== HELPER METHODS =====

  async checkBackendReady() {
    try {
      const health = await this.getHealth();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  async getApiUrl() {
    return this.baseUrl;
  }
}

// Export for CommonJS and ESM
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MaestroApiClient, ApiError };
}
