// ── Client Options ────────────────────────────────────────────

export interface MaestroClientOptions {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  debug?: boolean;
  apiKey?: string | null;
  headers?: Record<string, string>;
}

// ── Health ────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
  [key: string]: unknown;
}

export interface CapabilitiesResponse {
  [key: string]: unknown;
}

export interface ConfigResponse {
  [key: string]: unknown;
}

// ── Blocks ───────────────────────────────────────────────────

export interface BlockFilter {
  type?: string;
  capability?: string;
  designation?: string;
  category?: string;
}

export interface BlockDefinition {
  id: string;
  name: string;
  blockType: string;
  version: string;
  isAtomic: boolean;
  description?: string;
  inputs?: BlockPort[];
  outputs?: BlockPort[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BlockPort {
  id: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface BlockMetrics {
  blockId: string;
  successRate?: number;
  avgDurationMs?: number;
  totalRuns?: number;
  [key: string]: unknown;
}

export interface TopBlocksOptions {
  designation?: string;
  type?: string;
  limit?: number;
}

export interface BlockRunData {
  [key: string]: unknown;
}

// ── Sessions ─────────────────────────────────────────────────

export interface SessionFilter {
  status?: string;
  projectId?: string;
  limit?: number;
}

export interface SessionCreateRequest {
  projectId?: string;
  repositoryPath?: string;
  authority?: string;
  name?: string;
  workflowId?: string;
  task?: string;
  context?: string;
  access?: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
  runTests?: boolean;
  testCommand?: string;
  runLinter?: boolean;
  linterCommand?: string;
  maxSteps?: number;
  timeoutMs?: number;
  inputs?: Record<string, unknown>;
}

export interface Session {
  id: string;
  name?: string;
  status?: string;
  containerStatus?: string;
  variables?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SessionEventsOptions {
  limit?: number;
  offset?: number;
  filter?: string;
}

export interface SessionCommandsOptions {
  limit?: number;
  offset?: number;
}

// ── Variables ────────────────────────────────────────────────

export type VariableValue = unknown;

// ── Workspaces ───────────────────────────────────────────────

export interface Workspace {
  id: string;
  name?: string;
  sessions?: string[];
  [key: string]: unknown;
}

// ── Projects ─────────────────────────────────────────────────

export interface ProjectCreateRequest {
  name: string;
  rootPath: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  [key: string]: unknown;
}

export interface ContainerLogsOptions {
  lines?: number;
  since?: string;
}

// ── Templates ────────────────────────────────────────────────

export interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

// ── LLM Provider ─────────────────────────────────────────────

export interface LLMHealthResponse {
  [key: string]: unknown;
}

export interface LLMModel {
  modelId: string;
  name: string;
  description?: string;
  category?: string;
  size?: string;
  parametersB?: number;
  contextLength?: number;
  vramFp16Gb?: number;
  vramInt8Gb?: number;
  vramInt4Gb?: number;
  capabilities?: string[];
  license?: string;
  recommended?: boolean;
  canRunFp16?: boolean;
  canRunInt8?: boolean;
  canRunInt4?: boolean;
  recommendedPrecision?: string;
  quantizationRequired?: string;
  vramRequired?: number;
  isLocal?: boolean;
}

export interface LLMCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ── Metrics ──────────────────────────────────────────────────

export interface MetricsFilter {
  workflowId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AggregatedMetricsFilter {
  workflowId?: string;
  startDate?: string;
  endDate?: string;
}

// ── Workflows ────────────────────────────────────────────────

export interface WorkflowExecuteOptions {
  inputs?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Training ─────────────────────────────────────────────────

export interface TrainingConfig {
  id: string;
  [key: string]: unknown;
}

export interface TrainingRunFilter {
  configId?: string;
  workflowId?: string;
  status?: string;
}

export interface TrainingRunRequest {
  configurationId: string;
  [key: string]: unknown;
}

// ── Block Testing ────────────────────────────────────────────

export interface BlockTestRunFilter {
  blockId?: string;
  blockType?: string;
  status?: string;
}

export interface BlockTestRunRequest {
  blockId: string;
  [key: string]: unknown;
}

export interface BlockTestEvaluation {
  [key: string]: unknown;
}

// ── Foundry ──────────────────────────────────────────────────

export interface FoundryOverview {
  [key: string]: unknown;
}

export interface FoundryLeaderboard {
  [key: string]: unknown;
}

// ── Auth ─────────────────────────────────────────────────────

export interface AuthStatus {
  authenticated: boolean;
  [key: string]: unknown;
}

export interface ApiKeyCreateRequest {
  name?: string;
  [key: string]: unknown;
}

export interface ApiKey {
  id: string;
  [key: string]: unknown;
}

// ── Runs ─────────────────────────────────────────────────────

export interface RunFilter {
  projectId?: string;
  projectPath?: string;
  status?: string;
  limit?: number;
}

// ── Client-Side Block Execution ──────────────────────────────

export interface ClientBlockHandler {
  execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ── Execution ────────────────────────────────────────────────

export interface ExecutionStatus {
  id: string;
  status: string;
  [key: string]: unknown;
}

// ── SignalR Events ───────────────────────────────────────────

export interface SignalROptions {
  hubUrl: string;
  autoReconnect?: boolean;
}

export type EventCallback<T = unknown> = (data: T) => void;
