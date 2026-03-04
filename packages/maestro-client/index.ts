// @maestro/client — TypeScript SDK for the Maestro API

export { MaestroClient } from './src/client.js';
export { HttpTransport } from './src/http.js';
export { ApiError, ConnectionError, TimeoutError } from './src/errors.js';
export { ClientBlockRegistry } from './src/client-blocks.js';
export { SignalRClient } from './src/realtime/signalr-client.js';
export { HUB_NAMES } from './src/realtime/events.js';

// Re-export all types
export type {
  MaestroClientOptions,
  HealthResponse,
  BlockDefinition,
  BlockFilter,
  BlockPort,
  BlockMetrics,
  TopBlocksOptions,
  Session,
  SessionCreateRequest,
  SessionFilter,
  SessionEventsOptions,
  SessionCommandsOptions,
  VariableValue,
  Workspace,
  Project,
  ProjectCreateRequest,
  ContainerLogsOptions,
  SessionTemplate,
  LLMHealthResponse,
  LLMModel,
  LLMCompletionRequest,
  LLMProviderStats,
  PerModelStats,
  LLMQueueStats,
  LLMPerformanceProfile,
  LLMSwitchEvent,
  MetricsFilter,
  AggregatedMetricsFilter,
  WorkflowExecuteOptions,
  ExecutionStatus,
  TrainingConfig,
  TrainingRunFilter,
  TrainingRunRequest,
  BlockTestRunFilter,
  BlockTestRunRequest,
  BlockTestEvaluation,
  FoundryOverview,
  FoundryLeaderboard,
  AuthStatus,
  ApiKey,
  ApiKeyCreateRequest,
  RunFilter,
  ClientBlockHandler,
  SignalROptions,
  EventCallback,
} from './src/types.js';

export type {
  BlockUpdatedEvent,
  ExecutionUpdatedEvent,
  SessionUpdatedEvent,
  WorkspaceUpdatedEvent,
  HubName,
} from './src/realtime/events.js';
