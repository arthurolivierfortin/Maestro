/**
 * Block Type Registry Types
 *
 * Defines the metadata and registry structure for block types.
 */

import type { BlockType, BlockConfig, Port } from './block.types';

/**
 * Validation result for block configuration
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Block type metadata and rules
 */
export interface BlockTypeInfo {
  type: BlockType;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Hex color
  isAtomic: boolean;
  allowedChildren: BlockType[]; // Which types can be nested inside
  allowedParents: BlockType[]; // Which types can contain this
  defaultConfig: BlockConfig;
  defaultInputs: Port[];
  defaultOutputs: Port[];
}

/**
 * Block Type Registry Interface
 */
export interface IBlockTypeRegistry {
  /**
   * Register a block type
   */
  register(info: BlockTypeInfo): void;

  /**
   * Get block type info by type
   */
  get(type: BlockType): BlockTypeInfo | undefined;

  /**
   * Get all registered block types
   */
  getAll(): BlockTypeInfo[];

  /**
   * Check if a parent type can contain a child type
   */
  canContain(parentType: BlockType, childType: BlockType): boolean;

  /**
   * Get default block instance for a type
   */
  getDefaultBlock(
    type: BlockType
  ): Omit<import('./block.types').Block, 'id' | 'parentId' | 'metadata'>;

  /**
   * Validate block configuration
   */
  validateConfig(type: BlockType, config: unknown): ValidationResult;
}
