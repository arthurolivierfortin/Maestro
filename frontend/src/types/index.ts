/**
 * Type definitions barrel export
 *
 * Central export point for all type definitions.
 */

export * from './workflow.types';
export * from './node.types';
export * from './agent.types';
export * from './execution.types';
export * from './model.types';

// Block types (Phase 4b) - These types have some name overlaps with existing types
// Position is also defined in node.types
// WorkflowVariable is also defined in workflow.types
// ValidationError is also defined in workflow.types
export type {
  BlockType,
  Port,
  BlockMetadata,
  Block,
  BlockConfig,
  WorkflowBlockConfig,
  TaskBlockConfig,
  CommandBlockConfig,
  ToolBlockConfig, // Deprecated alias for CommandBlockConfig
  PromptBlockConfig,
  InstructionBlockConfig,
  DecisionBlockConfig,
  ValidatorBlockConfig,
  TriggerBlockConfig,
  PromptVariable,
} from './block.types';

export type { BlockTypeInfo, ValidationResult, IBlockTypeRegistry } from './block-registry.types';

// Metrics types (Phase 9)
export * from './metrics.types';

// Training types (Phase 9)
export * from './training.types';
