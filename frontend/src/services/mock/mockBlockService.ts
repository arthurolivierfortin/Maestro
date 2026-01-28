/**
 * Mock Block Service
 *
 * In-memory implementation of IBlockService for development and testing.
 * Integrates with blockStore for state management and simulates network latency.
 */

import type {
  IBlockService,
  CreateBlockDto,
  UpdateBlockDto,
  BlockUsage,
} from '../interfaces/IBlockService';
import type { Block, BlockType } from '../../types/block.types';
import { useBlockStore } from '../../store/blockStore';
import { delay } from './utils/delay';
import { createNotFoundError, createValidationError } from './utils/errors';

/**
 * Mock Block Service Implementation
 */
class MockBlockService implements IBlockService {
  /**
   * Get reference to block store
   */
  private getStore() {
    return useBlockStore.getState();
  }

  async getAll(): Promise<Block[]> {
    await delay(100, 300);
    return this.getStore().getAllBlocks();
  }

  async getById(id: string): Promise<Block | null> {
    await delay(50, 150);
    const block = this.getStore().getBlock(id);
    return block ? { ...block } : null;
  }

  async create(dto: CreateBlockDto): Promise<Block> {
    await delay(200, 400);

    // Validate required fields
    if (!dto.name?.trim()) {
      throw createValidationError('Block name is required');
    }
    if (!dto.blockType) {
      throw createValidationError('Block type is required');
    }

    // Generate ID if not provided
    const id = dto.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check for duplicate ID
    if (this.getStore().getBlock(id)) {
      throw createValidationError(`Block with ID ${id} already exists`);
    }

    const now = new Date().toISOString();

    // Create new block
    const newBlock: Block = {
      id,
      name: dto.name,
      blockType: dto.blockType,
      isAtomic: dto.isAtomic,
      config: dto.config || { type: dto.blockType },
      inputs: dto.inputs || [],
      outputs: dto.outputs || [],
      capabilities: dto.capabilities || [],
      position: dto.position || { x: 0, y: 0 },
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: 'user',
        description: dto.metadata?.description || '',
        tags: dto.metadata?.tags || [],
        status: dto.metadata?.status || 'active',
      },
    };

    // Add to store (null parent = root level)
    this.getStore().addBlock(null, newBlock);

    return { ...newBlock };
  }

  async update(id: string, updates: UpdateBlockDto): Promise<Block> {
    await delay(150, 300);

    const existing = this.getStore().getBlock(id);
    if (!existing) {
      throw createNotFoundError('Block', id);
    }

    // Apply updates
    const updatedBlock: Block = {
      ...existing,
      ...(updates.name && { name: updates.name }),
      ...(updates.config && { config: { ...existing.config, ...updates.config } }),
      ...(updates.inputs && { inputs: updates.inputs }),
      ...(updates.outputs && { outputs: updates.outputs }),
      ...(updates.capabilities && { capabilities: updates.capabilities }),
      ...(updates.position && { position: updates.position }),
      metadata: {
        ...existing.metadata,
        ...(updates.metadata?.description !== undefined && {
          description: updates.metadata.description,
        }),
        ...(updates.metadata?.tags && { tags: updates.metadata.tags }),
        ...(updates.metadata?.status && { status: updates.metadata.status }),
        updatedAt: new Date().toISOString(),
      },
    };

    // Update in store
    this.getStore().updateBlock(id, updatedBlock);

    return { ...updatedBlock };
  }

  async delete(id: string): Promise<void> {
    await delay(100, 200);

    if (!this.getStore().getBlock(id)) {
      throw createNotFoundError('Block', id);
    }

    this.getStore().removeBlock(id);
  }

  async getByType(type: BlockType): Promise<Block[]> {
    await delay(100, 200);
    return this.getStore().getBlocksByType(type);
  }

  async getByCapability(capability: string): Promise<Block[]> {
    await delay(100, 200);
    return this.getStore().getBlocksByCapability(capability);
  }

  async search(query: string): Promise<Block[]> {
    await delay(150, 300);
    return this.getStore().searchBlocks(query);
  }

  async findUsages(blockId: string): Promise<BlockUsage[]> {
    await delay(200, 400);

    const block = this.getStore().getBlock(blockId);
    if (!block) {
      throw createNotFoundError('Block', blockId);
    }

    const usages: BlockUsage[] = [];
    const allBlocks = this.getStore().getAllBlocks();

    // Find parent relationships
    if (block.parentId) {
      const parent = this.getStore().getBlock(block.parentId);
      if (parent) {
        usages.push({
          blockId: parent.id,
          blockName: parent.name,
          blockType: parent.blockType,
          usageType: 'parent',
          context: `Block is a child of ${parent.name}`,
        });
      }
    }

    // Find child relationships
    if (block.children) {
      block.children.forEach((child) => {
        usages.push({
          blockId: child.id,
          blockName: child.name,
          blockType: child.blockType,
          usageType: 'child',
          context: `Block contains ${child.name}`,
        });
      });
    }

    // Find connection references
    allBlocks.forEach((b) => {
      if (b.connections) {
        const relatedConnections = b.connections.filter(
          (conn) => conn.sourceBlockId === blockId || conn.targetBlockId === blockId
        );

        relatedConnections.forEach((conn) => {
          usages.push({
            blockId: b.id,
            blockName: b.name,
            blockType: b.blockType,
            usageType: 'connection',
            context: `Connected via ${conn.label || 'unnamed connection'}`,
          });
        });
      }
    });

    // Find command references in inference configs (if any have tool references)
    allBlocks
      .filter((b) => b.blockType === 'inference')
      .forEach((inference) => {
        const config = inference.config as any;
        if (config.tools?.includes(blockId)) {
          usages.push({
            blockId: inference.id,
            blockName: inference.name,
            blockType: inference.blockType,
            usageType: 'reference',
            context: `Used as a command in inference ${inference.name}`,
          });
        }
      });

    return usages;
  }

  async duplicate(id: string): Promise<Block> {
    await delay(200, 400);

    const original = this.getStore().getBlock(id);
    if (!original) {
      throw createNotFoundError('Block', id);
    }

    const duplicated = this.getStore().duplicateBlock(id);
    if (!duplicated) {
      throw new Error(`Failed to duplicate block ${id}`);
    }

    return { ...duplicated };
  }

  async exportAsJson(id: string): Promise<string> {
    await delay(100, 200);

    const json = this.getStore().exportBlock(id);
    if (!json) {
      throw createNotFoundError('Block', id);
    }

    return json;
  }

  async importFromJson(json: string): Promise<Block> {
    await delay(200, 400);

    try {
      const block = this.getStore().importBlock(json);
      if (!block) {
        throw createValidationError('Failed to import block from JSON');
      }
      return { ...block };
    } catch (error) {
      throw createValidationError(`Invalid JSON format: ${(error as Error).message}`);
    }
  }
}

/**
 * Singleton instance
 */
let instance: MockBlockService | null = null;

/**
 * Get mock block service instance
 */
export function getMockBlockService(): IBlockService {
  if (!instance) {
    instance = new MockBlockService();
  }
  return instance;
}
