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
