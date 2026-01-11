/**
 * Mock Block Service
 *
 * In-memory implementation for development and testing.
 * Phase 4f.6 - Missing CRUD Functionality
 * Phase 4f.8 - Self-Improvement Preparation
 */

import type {
  IBlockService,
  CreateBlockRequest,
  UpdateBlockRequest,
  OperationResult,
} from '../interfaces/IBlockService';
import type { Block, BlockType } from '../../types/block.types';
import { useBlockStore } from '../../store/blockStore';

/**
 * Simulate network delay
 */
async function delay(ms: number = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock Block Service Implementation
 */
class MockBlockService implements IBlockService {
  /**
   * Get all blocks
   */
  async getAllBlocks(): Promise<Block[]> {
    await delay(100);
    return useBlockStore.getState().getAllBlocks();
  }

  /**
   * Get blocks by type
   */
  async getBlocksByType(blockType: BlockType): Promise<Block[]> {
    await delay(100);
    return useBlockStore.getState().getBlocksByType(blockType);
  }

  /**
   * Get blocks by capability
   */
  async getBlocksByCapability(capability: string): Promise<Block[]> {
    await delay(100);
    return useBlockStore.getState().getBlocksByCapability(capability);
  }

  /**
   * Search blocks
   */
  async searchBlocks(query: string): Promise<Block[]> {
    await delay(100);
    return useBlockStore.getState().searchBlocks(query);
  }

  /**
   * Get block metadata
   */
  async getBlockMetadata(id: string): Promise<Block | null> {
    await delay(50);
    return useBlockStore.getState().getBlock(id) || null;
  }

  /**
   * Get available capabilities
   */
  async getAvailableCapabilities(): Promise<string[]> {
    await delay(100);
    const blocks = useBlockStore.getState().getAllBlocks();
    const capabilities = new Set<string>();

    blocks.forEach((block) => {
      // Add tags as capabilities
      block.metadata.tags?.forEach((tag) => capabilities.add(tag));

      // Add type-specific capabilities
      if (block.config.type === 'agent') {
        const agentConfig = block.config as any;
        if (agentConfig.agentType) {
          capabilities.add(agentConfig.agentType.toLowerCase());
        }
      }
      if (block.config.type === 'tool') {
        const toolConfig = block.config as any;
        if (toolConfig.toolType) {
          capabilities.add(toolConfig.toolType.toLowerCase());
        }
      }
    });

    return Array.from(capabilities).sort();
  }

  /**
   * Create a new block
   */
  async createBlock(request: CreateBlockRequest): Promise<OperationResult<Block>> {
    await delay(200);

    try {
      // Validation
      if (!request.name || !request.blockType) {
        return {
          success: false,
          error: 'Name and block type are required',
        };
      }

      // Create block using store
      const store = useBlockStore.getState();
      const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newBlock: Block = {
        id: blockId,
        name: request.name,
        blockType: request.blockType,
        isAtomic: ['prompt', 'instruction', 'tool', 'decision', 'validator', 'trigger'].includes(
          request.blockType
        ),
        config: request.config || { type: request.blockType },
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
        parentId: request.parentId || null,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user',
          description: request.description,
          tags: request.tags || [],
          status: 'active',
        },
      };

      store.addBlock(request.parentId || null, newBlock);

      return {
        success: true,
        data: newBlock,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create block',
      };
    }
  }

  /**
   * Get a block by ID
   */
  async getBlock(id: string): Promise<OperationResult<Block>> {
    await delay(100);

    const block = useBlockStore.getState().getBlock(id);

    if (!block) {
      return {
        success: false,
        error: `Block ${id} not found`,
      };
    }

    return {
      success: true,
      data: block,
    };
  }

  /**
   * Update a block
   */
  async updateBlock(id: string, updates: UpdateBlockRequest): Promise<OperationResult<Block>> {
    await delay(150);

    try {
      const store = useBlockStore.getState();
      const existing = store.getBlock(id);

      if (!existing) {
        return {
          success: false,
          error: `Block ${id} not found`,
        };
      }

      // Build updates
      const blockUpdates: Partial<Block> = {};

      if (updates.name !== undefined) blockUpdates.name = updates.name;
      if (updates.config !== undefined) blockUpdates.config = updates.config;

      if (updates.tags !== undefined || updates.description !== undefined || updates.status !== undefined) {
        blockUpdates.metadata = {
          ...existing.metadata,
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.tags !== undefined && { tags: updates.tags }),
          ...(updates.status !== undefined && { status: updates.status }),
          updatedAt: new Date().toISOString(),
        };
      }

      store.updateBlock(id, blockUpdates);

      const updated = store.getBlock(id);

      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update block',
      };
    }
  }

  /**
   * Delete a block
   */
  async deleteBlock(id: string): Promise<OperationResult<void>> {
    await delay(100);

    try {
      const store = useBlockStore.getState();
      const block = store.getBlock(id);

      if (!block) {
        return {
          success: false,
          error: `Block ${id} not found`,
        };
      }

      // Check for usages
      const usages = await this.getBlockUsages(id);
      if (usages.length > 0) {
        return {
          success: false,
          error: `Cannot delete block: it is used by ${usages.length} other block(s)`,
        };
      }

      store.removeBlock(id);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete block',
      };
    }
  }

  /**
   * Duplicate a block
   */
  async duplicateBlock(id: string): Promise<OperationResult<Block>> {
    await delay(150);

    try {
      const store = useBlockStore.getState();
      const duplicated = store.duplicateBlock(id);

      if (!duplicated) {
        return {
          success: false,
          error: `Block ${id} not found`,
        };
      }

      return {
        success: true,
        data: duplicated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to duplicate block',
      };
    }
  }

  /**
   * Export a block as JSON
   */
  async exportBlock(id: string): Promise<OperationResult<string>> {
    await delay(100);

    try {
      const store = useBlockStore.getState();
      const json = store.exportBlock(id);

      if (!json) {
        return {
          success: false,
          error: `Block ${id} not found`,
        };
      }

      return {
        success: true,
        data: json,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export block',
      };
    }
  }

  /**
   * Import a block from JSON
   */
  async importBlock(json: string, parentId?: string | null): Promise<OperationResult<Block>> {
    await delay(150);

    try {
      const store = useBlockStore.getState();
      const block = store.importBlock(json, parentId || null);

      if (!block) {
        return {
          success: false,
          error: 'Failed to parse block JSON',
        };
      }

      return {
        success: true,
        data: block,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import block',
      };
    }
  }

  /**
   * Get blocks that reference this block
   */
  async getBlockUsages(id: string): Promise<Block[]> {
    await delay(100);

    const store = useBlockStore.getState();
    const allBlocks = store.getAllBlocks();

    // Find blocks that have this block as a child
    const usages = allBlocks.filter((block) => {
      // Check if this block is in children
      if (block.children?.some((child) => child.id === id)) {
        return true;
      }

      // Check connections
      if (block.connections?.some((conn) => conn.sourceBlockId === id || conn.targetBlockId === id)) {
        return true;
      }

      return false;
    });

    return usages;
  }

  /**
   * Check if a block can be safely deleted
   */
  async canDeleteBlock(id: string): Promise<{ canDelete: boolean; usageCount: number }> {
    const usages = await this.getBlockUsages(id);
    return {
      canDelete: usages.length === 0,
      usageCount: usages.length,
    };
  }
}

// Singleton instance
let instance: MockBlockService | null = null;

/**
 * Get the mock block service instance
 */
export function getMockBlockService(): IBlockService {
  if (!instance) {
    instance = new MockBlockService();
  }
  return instance;
}
