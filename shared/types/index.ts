/**
 * Barrel export for shared types.
 */

export type {
  SessionStatus,
  PhaseStatus,
  ExecutionNodeStatus,
  ExecutionNodeType,
  PhaseResult,
  Phase,
  ExecutionNode,
  ExecutionTree,
  CommandHistoryEntry,
  LLMActivityEntry,
  ExecutionLogEntry,
  Artifact,
  ActiveBlock,
  MonitorDescriptor,
  Widget,
  WorkflowConfig,
  SessionVariables,
  Session,
} from './session.js';

export type {
  BlockType,
  FitnessDimensions,
  TaskFitnessDimensions,
  TaskFitness,
  Block,
} from './block.js';

export type {
  WorkspaceSettings,
  Workspace,
} from './workspace.js';

export type {
  MaestroInfo,
  Project,
} from './project.js';

export type {
  LLMHealth,
  LLMModel,
  LLMStatus,
  TaskFitnessEntry,
  ModelPerformance,
} from './llm.js';

export type {
  HealthResponse,
  IApiClient,
} from './api-client.js';

// Phase 23: Widget and Page types
export type {
  WidgetDefinition,
  WidgetInstance,
  DataSourceConfig,
  LayoutZone,
  PageLayout,
} from './widget.js';

export type {
  PageDefinition,
  NavigationState,
  NavigationEntry,
  DetailView,
  BreadcrumbItem,
} from './page.js';
