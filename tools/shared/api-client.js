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

  // ===== PROJECTS =====

  async listProjects() {
    return this._fetch('GET', '/api/projects');
  }

  async getProject(id) {
    if (!id) throw new Error('Project ID is required');
    return this._fetch('GET', `/api/projects/${id}`);
  }

  async createProject(project) {
    if (!project || !project.name || !project.rootPath) {
      throw new Error('Project must have name and rootPath');
    }
    return this._fetch('POST', '/api/projects', { body: project });
  }

  async updateProject(id, updates) {
    if (!id) throw new Error('Project ID is required');
    return this._fetch('PUT', `/api/projects/${id}`, { body: updates });
  }

  async deleteProject(id) {
    if (!id) throw new Error('Project ID is required');
    return this._fetch('DELETE', `/api/projects/${id}`);
  }

  async openProject(rootPath) {
    if (!rootPath) throw new Error('Root path is required');
    return this._fetch('POST', '/api/projects/open', { body: { rootPath } });
  }

  async bindProject(options) {
    if (!options || !options.rootPath) throw new Error('Root path is required');
    return this._fetch('POST', '/api/projects/bind', { body: options });
  }

  async getProjectBlocks(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('GET', `/api/projects/${projectId}/blocks`);
  }

  async discoverProjects() {
    return this._fetch('POST', '/api/projects/discover');
  }

  // ===== PROJECT CONTAINERS =====

  async getContainerStatus(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('GET', `/api/projects/${projectId}/status`);
  }

  async startContainer(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('POST', `/api/projects/${projectId}/start`);
  }

  async stopContainer(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('POST', `/api/projects/${projectId}/stop`);
  }

  async restartContainer(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('POST', `/api/projects/${projectId}/restart`);
  }

  async getContainerLogs(projectId, options = {}) {
    if (!projectId) throw new Error('Project ID is required');
    const params = new URLSearchParams();
    if (options.lines) params.set('lines', options.lines);
    if (options.since) params.set('since', options.since);
    const queryString = params.toString();
    return this._fetch('GET', `/api/projects/${projectId}/logs${queryString ? `?${queryString}` : ''}`);
  }

  // ===== PROJECT PERMISSIONS =====

  async getFileAccessRules(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('GET', `/api/projects/${projectId}/file-rules`);
  }

  async updateFileAccessRules(projectId, rules) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('PUT', `/api/projects/${projectId}/file-rules`, { body: rules });
  }

  async getBlockPermissions(projectId) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('GET', `/api/projects/${projectId}/block-permissions`);
  }

  async updateBlockPermissions(projectId, permissions) {
    if (!projectId) throw new Error('Project ID is required');
    return this._fetch('PUT', `/api/projects/${projectId}/block-permissions`, { body: permissions });
  }

  // ===== FILE SYSTEM =====

  async listDirectory(path) {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return this._fetch('GET', `/api/filesystem/list${params}`);
  }

  async getCommonDirectories() {
    return this._fetch('GET', '/api/filesystem/common-directories');
  }

  // ===== TRAINING =====

  async listTrainingConfigs() {
    return this._fetch('GET', '/api/training/configurations');
  }

  async getTrainingConfig(id) {
    if (!id) throw new Error('Configuration ID is required');
    return this._fetch('GET', `/api/training/configurations/${id}`);
  }

  async createTrainingConfig(config) {
    if (!config) throw new Error('Configuration is required');
    return this._fetch('POST', '/api/training/configurations', { body: config });
  }

  async updateTrainingConfig(id, updates) {
    if (!id) throw new Error('Configuration ID is required');
    return this._fetch('PUT', `/api/training/configurations/${id}`, { body: updates });
  }

  async deleteTrainingConfig(id) {
    if (!id) throw new Error('Configuration ID is required');
    return this._fetch('DELETE', `/api/training/configurations/${id}`);
  }

  async listTrainingRuns(filter = {}) {
    const params = new URLSearchParams();
    if (filter.configId) params.set('configId', filter.configId);
    if (filter.workflowId) params.set('workflowId', filter.workflowId);
    if (filter.status) params.set('status', filter.status);
    const queryString = params.toString();
    return this._fetch('GET', `/api/training/runs${queryString ? `?${queryString}` : ''}`);
  }

  async getTrainingRun(id) {
    if (!id) throw new Error('Run ID is required');
    return this._fetch('GET', `/api/training/runs/${id}`);
  }

  async startTrainingRun(request) {
    if (!request || !request.configurationId) throw new Error('Configuration ID is required');
    return this._fetch('POST', '/api/training/runs', { body: request });
  }

  async pauseTrainingRun(id) {
    if (!id) throw new Error('Run ID is required');
    return this._fetch('POST', `/api/training/runs/${id}/pause`);
  }

  async resumeTrainingRun(id) {
    if (!id) throw new Error('Run ID is required');
    return this._fetch('POST', `/api/training/runs/${id}/resume`);
  }

  async cancelTrainingRun(id) {
    if (!id) throw new Error('Run ID is required');
    return this._fetch('POST', `/api/training/runs/${id}/cancel`);
  }

  // ===== METRICS =====

  async listExecutionMetrics(filter = {}) {
    const params = new URLSearchParams();
    if (filter.workflowId) params.set('workflowId', filter.workflowId);
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    if (filter.limit) params.set('limit', filter.limit);
    const queryString = params.toString();
    return this._fetch('GET', `/api/metrics/executions${queryString ? `?${queryString}` : ''}`);
  }

  async getExecutionMetrics(executionId) {
    if (!executionId) throw new Error('Execution ID is required');
    return this._fetch('GET', `/api/metrics/executions/${executionId}`);
  }

  async getWorkflowMetrics(workflowId) {
    if (!workflowId) throw new Error('Workflow ID is required');
    return this._fetch('GET', `/api/metrics/workflows/${workflowId}`);
  }

  async getAggregatedMetrics(filter = {}) {
    const params = new URLSearchParams();
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    if (filter.groupBy) params.set('groupBy', filter.groupBy);
    const queryString = params.toString();
    return this._fetch('GET', `/api/metrics/aggregated${queryString ? `?${queryString}` : ''}`);
  }

  async getTrainingRunMetrics(runId) {
    if (!runId) throw new Error('Training run ID is required');
    return this._fetch('GET', `/api/metrics/training-runs/${runId}`);
  }

  // ===== LLM PROVIDER =====

  async getLLMHealth() {
    return this._fetch('GET', '/api/llm/health');
  }

  async listLLMModels() {
    return this._fetch('GET', '/api/llm/models');
  }

  async getLLMStatus() {
    return this._fetch('GET', '/api/llm/status');
  }

  // ===== RUNS / EXECUTION HISTORY =====

  async listRuns(filter = {}) {
    const params = new URLSearchParams();
    if (filter.workflowId) params.set('workflowId', filter.workflowId);
    if (filter.blockId) params.set('blockId', filter.blockId);
    if (filter.status) params.set('status', filter.status);
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    if (filter.limit) params.set('limit', filter.limit.toString());
    const queryString = params.toString();
    return this._fetch('GET', `/api/execution${queryString ? `?${queryString}` : ''}`);
  }

  async getRun(id) {
    if (!id) throw new Error('Run ID is required');
    return this._fetch('GET', `/api/execution/${id}`);
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
