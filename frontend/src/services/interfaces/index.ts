/**
 * Service Interfaces Index
 *
 * Re-exports all service interfaces for convenient imports.
 */

export type {
  IModelService,
  CreateModelDto,
  UpdateModelDto,
  ConnectionTestResult,
} from './IModelService';

export type {
  IBlockService,
  CreateBlockDto,
  UpdateBlockDto,
  BlockUsage,
} from './IBlockService';

export type {
  IBlockDiscoveryService,
  BlockFilter,
  BlockSummary,
  BlockSchema,
  WorkflowContext,
  BlockSuggestion,
  BlockStats,
  Execution,
} from './IBlockDiscoveryService';
