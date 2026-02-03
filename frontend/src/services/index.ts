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

// Session services (Phase 11 - Composable Session Architecture)
export { sandboxImageService } from './sandboxImageService';
export { sessionTemplateService } from './sessionTemplateService';
export { sessionService } from './sessionService';
export { sessionCategoryService } from './sessionCategoryService';
