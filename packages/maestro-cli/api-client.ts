/**
 * CLI API Client — typed adapter wrapping @maestro/client.
 *
 * Provides the same flat method API as the old api-client.js,
 * but delegates to the typed MaestroClient SDK internally.
 * This file exists because cli.ts (5000+ lines, @ts-nocheck) uses
 * flat method calls extensively. A full rewrite of cli.ts is out of
 * scope for Phase 37 — it will use the typed SDK methods directly
 * when cli.ts is itself rewritten in a future phase.
 */

import {
  MaestroClient,
  ApiError,
  type MaestroClientOptions,
} from '@maestro/client';

class MaestroApiClient {
  private _client: MaestroClient;

  constructor(baseUrl = 'http://localhost:5000', options: any = {}) {
    this._client = new MaestroClient({
      baseUrl,
      timeout: options.timeout,
      retryAttempts: options.retryAttempts,
      retryDelay: options.retryDelay,
      debug: options.debug,
      apiKey: options.apiKey,
    });
  }

  // ── Raw HTTP (used by cli.ts for endpoints without dedicated methods) ──

  async _fetch(method: string, path: string, options: any = {}) {
    return this._client.http.request(method, path, options);
  }

  async get(path: string) { return this._client.http.get(path); }
  async post(path: string, body?: any) { return this._client.http.post(path, body); }
  async put(path: string, body?: any) { return this._client.http.put(path, body); }
  async delete(path: string) { return this._client.http.del(path); }

  // ── Health ──
  async getHealth() { return this._client.health.check(); }
  async getCapabilities() { return this._client.health.capabilities(); }
  async getConfig() { return this._client.health.config(); }
  async checkBackendReady() { return this._client.health.isReady(); }
  async getApiUrl() { return this._client.baseUrl; }

  // ── Blocks ──
  async listBlocks(filter: any = {}) { return this._client.blocks.list(filter); }
  async getBlock(id: string) { return this._client.blocks.get(id); }
  async createBlock(block: any) { return this._client.blocks.create(block); }
  async updateBlock(id: string, updates: any) { return this._client.blocks.update(id, updates); }
  async deleteBlock(id: string) { return this._client.blocks.delete(id); }
  async getBlockChildren(id: string, recursive = true) { return this._client.blocks.children(id, recursive); }
  async getBlockContent(id: string, filePath?: string) { return this._client.blocks.content(id, filePath); }
  async updateBlockContent(id: string, filePath: string, content: string) { return this._client.blocks.updateContent(id, filePath, content); }
  async getBlockMetrics(id: string) { return this._client.blocks.metrics(id); }
  async recordBlockRun(id: string, data: any) { return this._client.blocks.recordRun(id, data); }
  async getTopBlocks(options: any = {}) { return this._client.blocks.top(options); }
  async designateBlock(id: string, designation: string) { return this._client.blocks.designate(id, designation); }
  async searchBlocks(query: string) { return this._client.blocks.search(query); }
  async getBlocksByType(type: string) { return this._client.blocks.byType(type); }
  async getBlocksByCapability(cap: string) { return this._client.blocks.byCapability(cap); }

  // ── Sessions ──
  async listSessions(filter: any = {}) { return this._client.sessions.list(filter); }
  async getSession(id: string) { return this._client.sessions.get(id); }
  async createSession(request: any) { return this._client.sessions.create(request); }
  async startSession(id: string) { return this._client.sessions.start(id); }
  async pauseSession(id: string) { return this._client.sessions.pause(id); }
  async resumeSession(id: string) { return this._client.sessions.resume(id); }
  async stopSession(id: string) { return this._client.sessions.stop(id); }
  async deleteSession(id: string) { return this._client.sessions.delete(id); }
  async takeControlSession(id: string, authority = 'human') { return this._client.sessions.takeControl(id, authority); }
  async executeSessionCommand(id: string, command: string, args?: any) { return this._client.sessions.exec(id, command, args); }
  async getSessionEvents(id: string, options: any = {}) { return this._client.sessions.events(id, options); }
  async getSessionCommands(id: string, options: any = {}) { return this._client.sessions.commands(id, options); }
  async cancelSession(id: string) { return this._client.sessions.stop(id); }
  async getSessionDiff(id: string) { return this._client.sessions.exec(id, 'diff'); }
  async runSessionTests(id: string, testCommand?: string) { return this._client.sessions.exec(id, testCommand ? `test ${testCommand}` : 'test'); }
  async commitSession(id: string, request: { message: string }) { return this._client.sessions.exec(id, `commit -m "${request.message}"`); }

  // ── Workspaces ──
  async listWorkspaces() { return this._client.workspaces.list(); }
  async getWorkspace(id: string) { return this._client.workspaces.get(id); }

  // ── Projects ──
  async listProjects() { return this._client.projects.list(); }
  async getProject(id: string) { return this._client.projects.get(id); }
  async createProject(project: any) { return this._client.projects.create(project); }
  async updateProject(id: string, updates: any) { return this._client.projects.update(id, updates); }
  async deleteProject(id: string) { return this._client.projects.delete(id); }
  async openProject(rootPath: string) { return this._client.projects.open(rootPath); }
  async bindProject(options: any) { return this._client.projects.bind(options); }
  async getProjectBlocks(projectId: string) { return this._client.projects.blocks(projectId); }
  async discoverProjects() { return this._client.projects.discover(); }
  async getContainerStatus(id: string) { return this._client.projects.containerStatus(id); }
  async startContainer(id: string) { return this._client.projects.startContainer(id); }
  async stopContainer(id: string) { return this._client.projects.stopContainer(id); }
  async restartContainer(id: string) { return this._client.projects.restartContainer(id); }
  async getContainerLogs(id: string, options: any = {}) { return this._client.projects.containerLogs(id, options); }
  async getFileAccessRules(id: string) { return this._client.projects.fileAccessRules(id); }
  async updateFileAccessRules(id: string, rules: any) { return this._client.projects.updateFileAccessRules(id, rules); }
  async getBlockPermissions(id: string) { return this._client.projects.blockPermissions(id); }
  async updateBlockPermissions(id: string, perms: any) { return this._client.projects.updateBlockPermissions(id, perms); }

  // ── Workflows ──
  async executeWorkflow(id: string, options: any = {}) { return this._client.workflows.execute(id, options); }
  async getExecutionStatus(executionId: string) { return this._client.workflows.executionStatus(executionId); }
  async cancelExecution(executionId: string) { return this._client.workflows.cancelExecution(executionId); }

  // ── LLM Provider ──
  async getLLMHealth() { return this._client.llm.health(); }
  async getLLMStatus() { return this._client.llm.status(); }
  async getLLMCapabilities() { return this._client.llm.capabilities(); }
  async getActiveProvider() { return this._client.llm.activeProvider(); }
  async listLLMModels(category?: string) { return this._client.llm.models(category); }
  async getLocalModels() { return this._client.llm.localModels(); }
  async getRegistryModels(category?: string) { return this._client.llm.registryModels(category); }
  async switchModel(modelId: string, use8bit = false) { return this._client.llm.switchModel(modelId, use8bit); }
  async loadModel(modelId: string, use8bit = false) { return this._client.llm.loadModel(modelId, use8bit); }
  async getAzureConfig() { return this._client.llm.azureConfig(); }
  async saveAzureConfig(config: any) { return this._client.llm.saveAzureConfig(config); }
  async testAzureConnection(config: any = {}) { return this._client.llm.testAzureConnection(config); }
  async chatCompletion(messages: any[], options: any = {}) { return this._client.llm.complete(messages, options); }

  // ── Metrics ──
  async listExecutionMetrics(filter: any = {}) { return this._client.metrics.executions(filter); }
  async getExecutionMetrics(id: string) { return this._client.metrics.execution(id); }
  async getWorkflowMetrics(id: string) { return this._client.metrics.workflow(id); }
  async getAggregatedMetrics(filter: any = {}) { return this._client.metrics.aggregated(filter); }
  async getTrainingRunMetrics(runId: string) { return this._client.metrics.trainingRun(runId); }

  // ── Training ──
  async listTrainingConfigs() { return this._client.training.listConfigs(); }
  async getTrainingConfig(id: string) { return this._client.training.getConfig(id); }
  async createTrainingConfig(config: any) { return this._client.training.createConfig(config); }
  async updateTrainingConfig(id: string, updates: any) { return this._client.training.updateConfig(id, updates); }
  async deleteTrainingConfig(id: string) { return this._client.training.deleteConfig(id); }
  async listTrainingRuns(filter: any = {}) { return this._client.training.listRuns(filter); }
  async getTrainingRun(id: string) { return this._client.training.getRun(id); }
  async startTrainingRun(request: any) { return this._client.training.startRun(request); }
  async pauseTrainingRun(id: string) { return this._client.training.pauseRun(id); }
  async resumeTrainingRun(id: string) { return this._client.training.resumeRun(id); }
  async cancelTrainingRun(id: string) { return this._client.training.cancelRun(id); }

  // ── Block Testing ──
  async listBlockTestRuns(filter: any = {}) { return this._client.testing.listRuns(filter); }
  async getBlockTestRun(id: string) { return this._client.testing.getRun(id); }
  async createBlockTestRun(request: any) { return this._client.testing.createRun(request); }
  async deleteBlockTestRun(id: string) { return this._client.testing.deleteRun(id); }
  async submitBlockTestEvaluation(runId: string, eval_: any) { return this._client.testing.evaluate(runId, eval_); }
  async submitBulkBlockTestEvaluation(runId: string, evals: any[]) { return this._client.testing.evaluateBulk(runId, evals); }
  async getBlockTestPendingEvaluations(runId: string) { return this._client.testing.pendingEvaluations(runId); }
  async submitBlockImprovement(runId: string, suggestions: string[]) { return this._client.testing.improve(runId, suggestions); }
  async compareBlockTestRuns(runIds: string[]) { return this._client.testing.compare(runIds); }
  // Legacy aliases
  async listToolTestRuns(filter: any = {}) { return this.listBlockTestRuns(filter); }
  async getToolTestRun(id: string) { return this.getBlockTestRun(id); }
  async createToolTestRun(request: any) { return this.createBlockTestRun(request); }
  async submitToolTestEvaluation(runId: string, eval_: any) { return this.submitBlockTestEvaluation(runId, eval_); }
  async getPendingEvaluations(runId: string) { return this.getBlockTestPendingEvaluations(runId); }
  async deleteToolTestRun(id: string) { return this.deleteBlockTestRun(id); }

  // ── Foundry ──
  async getFoundryOverview(projectPath?: string) { return this._client.foundry.overview(projectPath); }
  async getFoundryLeaderboard(limit = 10, projectPath?: string) { return this._client.foundry.leaderboard(limit, projectPath); }
  async getFoundryRelationships(projectPath?: string) { return this._client.foundry.relationships(projectPath); }
  async promoteToFoundry(request: any, projectPath?: string) { return this._client.foundry.promote(request, projectPath); }

  // ── Auth ──
  async getAuthStatus() { return this._client.auth.status(); }
  async authSetup(name = 'admin') { return this._client.auth.setup(name); }
  async createApiKey(request: any) { return this._client.auth.createKey(request); }
  async listApiKeys() { return this._client.auth.listKeys(); }
  async revokeApiKey(id: string) { return this._client.auth.revokeKey(id); }
  async validateApiKey() { return this._client.auth.validate(); }

  // ── Runs ──
  async listRuns(filter: any = {}) { return this._client.runs.list(filter); }
  async getRun(id: string, projectPath?: string) { return this._client.runs.get(id, projectPath); }

  // ── Filesystem ──
  async listDirectory(path?: string) { return this._client.filesystem.list(path); }
  async getCommonDirectories() { return this._client.filesystem.commonDirectories(); }
}

export { MaestroApiClient, ApiError };
