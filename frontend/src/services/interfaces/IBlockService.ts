/**
 * Block Service Interface
 *
 * Defines all operations for block CRUD and discovery.
 * Phase 4f.6 - Missing CRUD Functionality
 * Phase 4f.8 - Self-Improvement Preparation
 */

import type { Block, BlockType } from '../../types/block.types';

/**
 * Result type for operations that can fail
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Block creation request
 */
export interface CreateBlockRequest {
  name: string;
  blockType: BlockType;
  parentId?: string | null;
  config?: any;
  tags?: string[];
  description?: string;
}

/**
 * Block update request
 */
export interface UpdateBlockRequest {
  name?: string;
  config?: any;
  tags?: string[];
  description?: string;
  status?: 'draft' | 'active' | 'archived';
}

/**
 * Block Discovery Service Interface
 *
 * For self-improving workflows to discover and query available blocks.
 */
export interface IBlockDiscoveryService {
  /**
   * Get all available blocks
   */
  getAllBlocks(): Promise<Block[]>;

  /**
   * Get blocks filtered by type
   */
  getBlocksByType(blockType: BlockType): Promise<Block[]>;

  /**
   * Get blocks filtered by capability/tag
   */
  getBlocksByCapability(capability: string): Promise<Block[]>;

  /**
   * Search blocks by query string
   */
  searchBlocks(query: string): Promise<Block[]>;

  /**
   * Get block metadata by ID
   */
  getBlockMetadata(id: string): Promise<Block | null>;

  /**
   * Get available capabilities across all blocks
   */
  getAvailableCapabilities(): Promise<string[]>;
}

/**
 * Block Service Interface
 *
 * Complete CRUD operations for blocks.
 */
export interface IBlockService extends IBlockDiscoveryService {
  /**
   * Create a new block
   */
  createBlock(request: CreateBlockRequest): Promise<OperationResult<Block>>;

  /**
   * Get a block by ID
   */
  getBlock(id: string): Promise<OperationResult<Block>>;

  /**
   * Update a block
   */
  updateBlock(id: string, updates: UpdateBlockRequest): Promise<OperationResult<Block>>;

  /**
   * Delete a block
   */
  deleteBlock(id: string): Promise<OperationResult<void>>;

  /**
   * Duplicate a block
   */
  duplicateBlock(id: string): Promise<OperationResult<Block>>;

  /**
   * Export a block as JSON
   */
  exportBlock(id: string): Promise<OperationResult<string>>;

  /**
   * Import a block from JSON
   */
  importBlock(json: string, parentId?: string | null): Promise<OperationResult<Block>>;

  /**
   * Get blocks that reference this block
   */
  getBlockUsages(id: string): Promise<Block[]>;

  /**
   * Check if a block can be safely deleted
   */
  canDeleteBlock(id: string): Promise<{ canDelete: boolean; usageCount: number }>;
}
