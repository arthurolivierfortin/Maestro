/**
 * Services barrel export
 */

export * from './api';
export * from './workflowService';
export * from './signalRService';
export { blockService, isUsingMockBackend as isBlockServiceUsingMock } from './blockService';
export { modelService, isUsingMockBackend as isModelServiceUsingMock } from './modelService';
export * from './discoveryService';

// Metrics and Training services (Phase 9)
export { metricsService } from './metricsService';
export { trainingService } from './trainingService';

// Block Testing service
export { testService } from './testService';

// Fitness service (Phase 11)
export { fitnessService } from './fitnessService';

// System Block service (Phase 2 - System Blocks)
export { systemBlockService } from './systemBlockService';

// Workspace service (Phase 3 - Workspaces)
export { workspaceService } from './workspaceService';

// Experiment service (Phase 7 - Training Strategies)
export { experimentService } from './experimentService';

// Session service (Phase 7.5 - Generic Sessions)
export { sessionService } from './sessionService';
