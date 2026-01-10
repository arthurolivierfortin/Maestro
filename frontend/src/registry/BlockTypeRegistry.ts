/**
 * Block Type Registry
 *
 * Singleton registry for block type metadata and validation.
 */

import type { Block, BlockType } from '../types/block.types';
import type {
  BlockTypeInfo,
  IBlockTypeRegistry,
  ValidationResult,
} from '../types/block-registry.types';
import { blockTypeDefinitions } from './blockTypeDefinitions';

/**
 * Singleton Block Type Registry
 */
class BlockTypeRegistryImpl implements IBlockTypeRegistry {
  private types: Map<BlockType, BlockTypeInfo> = new Map();
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    // Register all default block types
    blockTypeDefinitions.forEach((info) => {
      this.types.set(info.type, info);
    });

    this.initialized = true;
  }

  register(info: BlockTypeInfo): void {
    this.types.set(info.type, info);
  }

  get(type: BlockType): BlockTypeInfo | undefined {
    return this.types.get(type);
  }

  getAll(): BlockTypeInfo[] {
    return Array.from(this.types.values());
  }

  canContain(parentType: BlockType, childType: BlockType): boolean {
    const parentInfo = this.get(parentType);
    if (!parentInfo) return false;

    // Atomic blocks cannot contain children
    if (parentInfo.isAtomic) return false;

    // Check if child is in allowed children list
    return parentInfo.allowedChildren.includes(childType);
  }

  getDefaultBlock(type: BlockType): Omit<Block, 'id' | 'parentId' | 'metadata'> {
    const typeInfo = this.get(type);
    if (!typeInfo) {
      throw new Error(`Unknown block type: ${type}`);
    }

    return {
      name: `New ${typeInfo.label}`,
      blockType: type,
      isAtomic: typeInfo.isAtomic,
      children: typeInfo.isAtomic ? undefined : [],
      config: typeInfo.defaultConfig,
      inputs: [...typeInfo.defaultInputs],
      outputs: [...typeInfo.defaultOutputs],
      position: { x: 0, y: 0 },
    };
  }

  validateConfig(type: BlockType, config: unknown): ValidationResult {
    const typeInfo = this.get(type);
    if (!typeInfo) {
      return {
        isValid: false,
        errors: [{ field: 'type', message: `Unknown block type: ${type}` }],
      };
    }

    const errors = [];

    // Basic type check
    if (!config || typeof config !== 'object') {
      errors.push({ field: 'config', message: 'Config must be an object' });
      return { isValid: false, errors };
    }

    const cfg = config as Record<string, unknown>;

    // Check type field
    if (cfg.type !== type) {
      errors.push({
        field: 'type',
        message: `Config type must match block type: ${type}`,
      });
    }

    // Type-specific validation
    switch (type) {
      case 'agent':
        if (!cfg.agentType || typeof cfg.agentType !== 'string') {
          errors.push({ field: 'agentType', message: 'Agent type is required' });
        }
        break;

      case 'task':
        if (!cfg.description || typeof cfg.description !== 'string') {
          errors.push({ field: 'description', message: 'Task description is required' });
        }
        break;

      case 'tool':
        if (!cfg.toolType || typeof cfg.toolType !== 'string') {
          errors.push({ field: 'toolType', message: 'Tool type is required' });
        }
        break;

      case 'prompt':
        if (!cfg.template || typeof cfg.template !== 'string') {
          errors.push({ field: 'template', message: 'Prompt template is required' });
        }
        break;

      case 'instruction':
        if (!cfg.filePath || typeof cfg.filePath !== 'string') {
          errors.push({ field: 'filePath', message: 'File path is required' });
        }
        break;

      case 'decision':
        if (!cfg.condition || typeof cfg.condition !== 'string') {
          errors.push({ field: 'condition', message: 'Condition is required' });
        }
        break;

      case 'validator':
        if (!cfg.validationType || typeof cfg.validationType !== 'string') {
          errors.push({
            field: 'validationType',
            message: 'Validation type is required',
          });
        }
        break;

      case 'trigger':
        if (!cfg.triggerType || typeof cfg.triggerType !== 'string') {
          errors.push({ field: 'triggerType', message: 'Trigger type is required' });
        }
        break;

      case 'workflow':
        // Workflow config is mostly optional
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const BlockTypeRegistry = new BlockTypeRegistryImpl();
