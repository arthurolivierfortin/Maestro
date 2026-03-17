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
  contract?: string;
}

export interface BlockDefinition {
  id: string;
  name: string;
  blockType: string;
  version: string;
  isAtomic: boolean;
  description?: string;
  capabilities?: string[];
  contract?: string;
  inputs?: BlockPort[];
  outputs?: BlockPort[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Contracts ───────────────────────────────────────────────

export interface ContractFeature {
  description: string;
  requires: string[];
  weight: number;
  minimumScore: number;
  tests: ContractTest[];
}

export interface ContractTest {
  id: string;
  description: string;
  prompt?: string;
  turns?: { prompt: string; check?: Record<string, unknown> }[];
  check?: Record<string, unknown>;
}

export interface ContractDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  requiredCapabilities: string[];
  minimumFitness: number;
  features: Record<string, ContractFeature>;
}

export interface ContractTestResult {
  contractId: string;
  contractVersion: string;
  blockId: string;
  fitness: number;
  performanceScore: number;
  fitnessBreakdown: FitnessBreakdown | null;
  passed: boolean;
  meetsRequiredCapabilities: boolean;
  features: FeatureTestResult[];
  testResults: SingleTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  estimatedCostUsd: number;
  failureReasons: string[];
}

export interface FeatureTestResult {
  featureId: string;
  description: string;
  active: boolean;
  score: number;
  weight: number;
  minimumScore: number;
  meetsThreshold: boolean;
  testsPassed: number;
  testsTotal: number;
}

export interface SingleTestResult {
  testId: string;
  featureId: string;
  description: string | null;
  passed: boolean;
  skipped: boolean;
  checkType: string | null;
  response: string | null;
  failureReason: string | null;
  durationMs: number;
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
  parentId?: string;
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
  status?: string;
  activeModel?: string | null;
  modelsLoaded?: number;
  device?: string;
  cudaAvailable?: boolean;
  cudaDeviceName?: string | null;
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
  isAvailable?: boolean;
  inputTokenPricePerMillion?: number | null;
  outputTokenPricePerMillion?: number | null;
}

export interface LLMProviderStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  avgLatencyMs: number;
  perModel: PerModelStats[];
}

export interface PerModelStats {
  model: string;
  requests: number;
  avgLatencyMs: number;
  totalTokens: number;
  rpm: number;
}

export interface LLMQueueStats {
  activeModel?: string | null;
  depth: number;
  avgWaitMs: number;
  totalEnqueued: number;
  totalProcessed: number;
  depthByModel: Record<string, number>;
}

export interface LLMPerformanceProfile {
  model: string;
  requestCount: number;
  avgResponseTimeMs: number;
  avgTokensPerRequest: number;
  avgLoadTimeMs: number;
}

export interface LLMSwitchEvent {
  timestamp: string;
  action: string;
  target: string;
  score: number;
  reason?: string | null;
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

// ── Fitness ──────────────────────────────────────────────────

export interface FitnessScore {
  performance: number;
  specialization: number;
  composability: number;
  economicCost: number;
  computeCost: number;
  hardwareCost: number;
  lambda: number;
  modelId: string;
  taskType: string;
  totalFitness: number;
  calculatedAt: string;
}

export interface FitnessBreakdown {
  performance: number;
  specialization: number;
  composability: number;
  economicCost: number;
  computeCost: number;
  hardwareCost: number;
  totalFitness: number;
  numerator: number;
  combinedCost: number;
}

export interface FitnessConfig {
  lambda: number;
  vramWeight: number;
  ramWeight: number;
  gpuWeight: number;
  baselineCostPerMillion: number;
  retryPenaltyFactor: number;
  minimumFitnessThreshold: number;
  maximumFitnessScore: number;
  performanceWeight: number;
  specializationWeight: number;
  composabilityWeight: number;
  updatedAt: string;
}

export interface CalculateFitnessRequest {
  executionId?: string;
  modelId: string;
  taskType?: string;
  metrics?: WorkflowExecutionMetrics;
}

export interface WorkflowExecutionMetrics {
  [key: string]: unknown;
}

export interface ModelFitnessRanking {
  rank: number;
  modelId: string;
  displayName: string;
  provider: string;
  averageFitness: number;
  executionCount: number;
  bestFitness: number;
  taskType?: string;
  breakdown?: FitnessBreakdown;
  updatedAt: string;
}

export interface AggregateFitnessStats {
  averageFitness: number;
  minFitness: number;
  maxFitness: number;
  fitnessVariance: number;
  fitnessStdDev: number;
  sampleCount: number;
  averageBreakdown?: FitnessBreakdown;
}

// ── Block Dependency Tree ────────────────────────────────────

export interface BlockDependencyManifest {
  blockId: string;
  blockType: string;
  model: string | null;
  planningModel: string | null;
  isAtomic: boolean;
  children: BlockDependencyManifest[];
}

export interface ModelRequirement {
  model: string;
  blockIds: string[];
}

export interface MissingDependency {
  blockRef: string;
  referencedBy: string;
  nodeId: string;
}

export interface DependencyValidationResult {
  isValid: boolean;
  missingBlocks: MissingDependency[];
  circularReferences: string[];
}

// ── SignalR Events ───────────────────────────────────────────

export interface SignalROptions {
  hubUrl: string;
  autoReconnect?: boolean;
}

export type EventCallback<T = unknown> = (data: T) => void;
