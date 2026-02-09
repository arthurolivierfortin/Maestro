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

  // ===== GENERIC HTTP METHODS =====
  // These allow direct API calls for endpoints not yet wrapped in dedicated methods

  /**
   * Generic GET request
   * @param {string} path - API path (e.g., '/api/fitness/config')
   */
  async get(path) {
    return this._fetch('GET', path);
  }

  /**
   * Generic POST request
   * @param {string} path - API path
   * @param {object} body - Request body
   */
  async post(path, body = {}) {
    return this._fetch('POST', path, { body });
  }

  /**
   * Generic PUT request
   * @param {string} path - API path
   * @param {object} body - Request body
   */
  async put(path, body = {}) {
    return this._fetch('PUT', path, { body });
  }

  /**
   * Generic DELETE request
   * @param {string} path - API path
   */
  async delete(path) {
    return this._fetch('DELETE', path);
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

  async getBlockChildren(id, recursive = true) {
    if (!id) throw new Error('Block ID is required');
    return this._fetch('GET', `/api/blocks/${id}/children?recursive=${recursive}`);
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
    return this._fetch('POST', `/api/training/configurations/${request.configurationId}/runs`, { body: request });
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
    if (filter.workflowId) params.set('workflowId', filter.workflowId);
    if (filter.startDate) params.set('startDate', filter.startDate);
    if (filter.endDate) params.set('endDate', filter.endDate);
    const queryString = params.toString();
    return this._fetch('GET', `/api/metrics/aggregate${queryString ? `?${queryString}` : ''}`);
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
    if (filter.projectId) params.set('projectId', filter.projectId);
    if (filter.projectPath) params.set('projectPath', filter.projectPath);
    if (filter.status) params.set('status', filter.status);
    if (filter.limit) params.set('limit', filter.limit.toString());
    const queryString = params.toString();
    return this._fetch('GET', `/api/runs${queryString ? `?${queryString}` : ''}`);
  }

  async getRun(id, projectPath = null) {
    if (!id) throw new Error('Run ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/runs/${id}${queryString ? `?${queryString}` : ''}`);
  }

  // ===== AGENT FOUNDRY =====

  async getFoundryOverview(projectPath = null) {
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/foundry/overview${queryString ? `?${queryString}` : ''}`);
  }

  async getFoundryLeaderboard(limit = 10, projectPath = null) {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (projectPath) params.set('projectPath', projectPath);
    return this._fetch('GET', `/api/foundry/leaderboard?${params.toString()}`);
  }

  async getFoundryRelationships(projectPath = null) {
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/foundry/relationships${queryString ? `?${queryString}` : ''}`);
  }

  async promoteToFoundry(request, projectPath = null) {
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('POST', `/api/foundry/promote${queryString ? `?${queryString}` : ''}`, { body: request });
  }

  // ===== AGENTS =====

  async listAgents(filter = {}) {
    const params = new URLSearchParams();
    if (filter.projectPath) params.set('projectPath', filter.projectPath);
    if (filter.category) params.set('category', filter.category);
    const queryString = params.toString();
    return this._fetch('GET', `/api/agents${queryString ? `?${queryString}` : ''}`);
  }

  async getAgent(id, projectPath = null) {
    if (!id) throw new Error('Agent ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/agents/${id}${queryString ? `?${queryString}` : ''}`);
  }

  async createAgent(agent, projectPath = null) {
    if (!agent || !agent.name) throw new Error('Agent must have a name');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('POST', `/api/agents${queryString ? `?${queryString}` : ''}`, { body: agent });
  }

  async updateAgent(id, updates, projectPath = null) {
    if (!id) throw new Error('Agent ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('PUT', `/api/agents/${id}${queryString ? `?${queryString}` : ''}`, { body: updates });
  }

  async deleteAgent(id, projectPath = null) {
    if (!id) throw new Error('Agent ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('DELETE', `/api/agents/${id}${queryString ? `?${queryString}` : ''}`);
  }

  async getAgentMetrics(id, projectPath = null) {
    if (!id) throw new Error('Agent ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/agents/${id}/metrics${queryString ? `?${queryString}` : ''}`);
  }

  async recordAgentRun(id, result, projectPath = null) {
    if (!id) throw new Error('Agent ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('POST', `/api/agents/${id}/runs${queryString ? `?${queryString}` : ''}`, { body: result });
  }

  async getAgentTools(id, projectPath = null) {
    if (!id) throw new Error('Agent ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/agents/${id}/tools${queryString ? `?${queryString}` : ''}`);
  }

  async getTopAgents(limit = 10, projectPath = null) {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (projectPath) params.set('projectPath', projectPath);
    return this._fetch('GET', `/api/agents/top?${params.toString()}`);
  }

  // ===== TOOLS =====

  async listTools(filter = {}) {
    const params = new URLSearchParams();
    if (filter.projectPath) params.set('projectPath', filter.projectPath);
    if (filter.category) params.set('category', filter.category);
    const queryString = params.toString();
    return this._fetch('GET', `/api/tools${queryString ? `?${queryString}` : ''}`);
  }

  async getTool(id, projectPath = null) {
    if (!id) throw new Error('Tool ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/tools/${id}${queryString ? `?${queryString}` : ''}`);
  }

  async createTool(tool, projectPath = null) {
    if (!tool || !tool.name) throw new Error('Tool must have a name');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('POST', `/api/tools${queryString ? `?${queryString}` : ''}`, { body: tool });
  }

  async updateTool(id, updates, projectPath = null) {
    if (!id) throw new Error('Tool ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('PUT', `/api/tools/${id}${queryString ? `?${queryString}` : ''}`, { body: updates });
  }

  async deleteTool(id, projectPath = null) {
    if (!id) throw new Error('Tool ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('DELETE', `/api/tools/${id}${queryString ? `?${queryString}` : ''}`);
  }

  async getToolMetrics(id, projectPath = null) {
    if (!id) throw new Error('Tool ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('GET', `/api/tools/${id}/metrics${queryString ? `?${queryString}` : ''}`);
  }

  async recordToolRun(id, result, projectPath = null) {
    if (!id) throw new Error('Tool ID is required');
    const params = new URLSearchParams();
    if (projectPath) params.set('projectPath', projectPath);
    const queryString = params.toString();
    return this._fetch('POST', `/api/tools/${id}/runs${queryString ? `?${queryString}` : ''}`, { body: result });
  }

  async getTopTools(limit = 10, projectPath = null) {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (projectPath) params.set('projectPath', projectPath);
    return this._fetch('GET', `/api/tools/top?${params.toString()}`);
  }

  // ===== BLOCK TESTING (Generic for all block types: tool, agent, workflow, task) =====

  async listBlockTestRuns(filter = {}) {
    const params = new URLSearchParams();
    if (filter.blockId) params.set('blockId', filter.blockId);
    if (filter.blockType) params.set('blockType', filter.blockType);
    if (filter.status) params.set('status', filter.status);
    const queryString = params.toString();
    return this._fetch('GET', `/api/blocktest/runs${queryString ? `?${queryString}` : ''}`);
  }

  async getBlockTestRun(id) {
    if (!id) throw new Error('Test run ID is required');
    return this._fetch('GET', `/api/blocktest/runs/${id}`);
  }

  async createBlockTestRun(request) {
    if (!request || !request.blockId) throw new Error('Block ID is required');
    return this._fetch('POST', '/api/blocktest/runs', { body: request });
  }

  async submitBlockTestEvaluation(runId, evaluation) {
    if (!runId) throw new Error('Run ID is required');
    return this._fetch('POST', `/api/blocktest/runs/${runId}/evaluate`, { body: evaluation });
  }

  async submitBulkBlockTestEvaluation(runId, evaluations) {
    if (!runId) throw new Error('Run ID is required');
    return this._fetch('POST', `/api/blocktest/runs/${runId}/evaluate/bulk`, { body: { evaluations } });
  }

  async getBlockTestPendingEvaluations(runId) {
    if (!runId) throw new Error('Run ID is required');
    return this._fetch('GET', `/api/blocktest/runs/${runId}/pending`);
  }

  async submitBlockImprovement(runId, suggestions) {
    if (!runId) throw new Error('Run ID is required');
    return this._fetch('POST', `/api/blocktest/runs/${runId}/improve`, { body: { suggestions } });
  }

  async compareBlockTestRuns(runIds) {
    if (!runIds || runIds.length === 0) throw new Error('Run IDs are required');
    return this._fetch('GET', `/api/blocktest/compare?runIds=${runIds.join(',')}`);
  }

  async deleteBlockTestRun(id) {
    if (!id) throw new Error('Test run ID is required');
    return this._fetch('DELETE', `/api/blocktest/runs/${id}`);
  }

  // Legacy aliases (deprecated - use block* methods instead)
  async listToolTestRuns(filter = {}) { return this.listBlockTestRuns(filter); }
  async getToolTestRun(id) { return this.getBlockTestRun(id); }
  async createToolTestRun(request) { return this.createBlockTestRun(request); }
  async submitToolTestEvaluation(runId, evaluation) { return this.submitBlockTestEvaluation(runId, evaluation); }
  async getPendingEvaluations(runId) { return this.getBlockTestPendingEvaluations(runId); }
  async deleteToolTestRun(id) { return this.deleteBlockTestRun(id); }

  // ===== INTERACTIVE SESSIONS (Session Server Architecture) =====

  /**
   * List all sessions with optional filtering.
   * @param {Object} filter - Optional filters: status, projectId, limit
   */
  async listSessions(filter = {}) {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.projectId) params.set('projectId', filter.projectId);
    if (filter.limit) params.set('limit', filter.limit.toString());
    const queryString = params.toString();
    return this._fetch('GET', `/api/sessions${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a session by ID.
   * @param {string} id - Session ID
   */
  async getSession(id) {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('GET', `/api/sessions/${id}`);
  }

  /**
   * Create a new interactive session.
   * @param {Object} request - Session creation request
   * @param {string} [request.projectId] - Project ID (optional if repositoryPath provided)
   * @param {string} [request.repositoryPath] - Repository path (optional if projectId provided)
   * @param {string} request.authority - Authority type: "human", "ai:<name>", "agent:<id>" (default: "human")
   * @param {string} request.name - Session name (optional)
   * @param {string} request.workflowId - Workflow ID (optional)
   * @param {string} request.task - Task description (optional)
   * @param {string} request.context - Additional context (optional)
   * @param {string} request.access - Access level: "readonly", "sandbox", "controlled", "full" (default: "controlled")
   * @param {string[]} request.allowedPaths - Allowed file paths (optional)
   * @param {string[]} request.deniedPaths - Denied file paths (optional)
   * @param {boolean} request.runTests - Whether to run tests on commit (default: false)
   * @param {string} request.testCommand - Custom test command (optional)
   * @param {boolean} request.runLinter - Whether to run linter on commit (default: false)
   * @param {string} request.linterCommand - Custom linter command (optional)
   * @param {number} request.maxSteps - Maximum execution steps (default: 50)
   * @param {number} request.timeoutMs - Timeout in milliseconds (default: 600000)
   * @param {Object} request.inputs - Input variables for the session (optional)
   */
  async createSession(request) {
    if (!request || (!request.projectId && !request.repositoryPath)) {
      throw new Error('Session requires either projectId or repositoryPath');
    }
    return this._fetch('POST', '/api/sessions', { body: request });
  }

  /**
   * Start a session.
   * @param {string} id - Session ID
   */
  async startSession(id) {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('POST', `/api/sessions/${id}/start`);
  }

  /**
   * Pause a running session.
   * @param {string} id - Session ID
   */
  async pauseSession(id) {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('POST', `/api/sessions/${id}/pause`);
  }

  /**
   * Resume a paused session.
   * @param {string} id - Session ID
   */
  async resumeSession(id) {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('POST', `/api/sessions/${id}/resume`);
  }

  /**
   * Stop a session.
   * @param {string} id - Session ID
   */
  async stopSession(id) {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('POST', `/api/sessions/${id}/stop`);
  }

  /**
   * Take control of a session (transfer authority).
   * @param {string} id - Session ID
   * @param {string} authority - New authority: "human", "ai:<name>", "agent:<id>" (default: "human")
   */
  async takeControlSession(id, authority = 'human') {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('POST', `/api/sessions/${id}/take-control`, {
      body: { authority }
    });
  }

  /**
   * Execute a command within a session.
   * Commands can be:
   * - Shell commands: ls, cd, git, etc.
   * - Maestro commands: blocks, agents, monitor, permissions, diff, test, lint, commit
   * - Control commands: /pause, /resume, /exit, /status, /history, /help
   * @param {string} id - Session ID
   * @param {string} command - Command to execute
   * @param {Object} args - Optional command arguments
   */
  async executeSessionCommand(id, command, args = null) {
    if (!id) throw new Error('Session ID is required');
    if (!command) throw new Error('Command is required');
    const body = { command };
    if (args) body.args = args;
    return this._fetch('POST', `/api/sessions/${id}/exec`, { body });
  }

  /**
   * Get session events with pagination.
   * @param {string} id - Session ID
   * @param {Object} options - Pagination options: limit, offset, filter
   */
  async getSessionEvents(id, options = {}) {
    if (!id) throw new Error('Session ID is required');
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.filter) params.set('filter', options.filter);
    const queryString = params.toString();
    return this._fetch('GET', `/api/sessions/${id}/events${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get session command history.
   * @param {string} id - Session ID
   * @param {Object} options - Pagination options: limit, offset
   */
  async getSessionCommands(id, options = {}) {
    if (!id) throw new Error('Session ID is required');
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    const queryString = params.toString();
    return this._fetch('GET', `/api/sessions/${id}/commands${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Delete a session.
   * @param {string} id - Session ID
   */
  async deleteSession(id) {
    if (!id) throw new Error('Session ID is required');
    return this._fetch('DELETE', `/api/sessions/${id}`);
  }

  // Legacy session methods (deprecated - use new session server methods)
  async getSessionDiff(id) {
    // Use executeSessionCommand with 'diff' command
    return this.executeSessionCommand(id, 'diff');
  }

  async runSessionTests(id, testCommand = null) {
    // Use executeSessionCommand with 'test' command
    const command = testCommand ? `test ${testCommand}` : 'test';
    return this.executeSessionCommand(id, command);
  }

  async commitSession(id, request) {
    if (!request || !request.message) throw new Error('Commit message is required');
    // Use executeSessionCommand with 'commit' command
    return this.executeSessionCommand(id, `commit -m "${request.message}"`);
  }

  async cancelSession(id) {
    // Use stopSession
    return this.stopSession(id);
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
