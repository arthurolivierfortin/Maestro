/**
 * Block Service Interface
 *
 * Defines all operations for block management.
 * Both mock and real implementations MUST implement this interface.
 */

import type { Block, BlockType, BlockStatus } from '../../types/block.types';

/**
 * DTO for creating a new block
 */
export interface CreateBlockDto {
  id?: string;
  name: string;
  blockType: BlockType;
  isAtomic: boolean;
  config: any; // Type will vary based on blockType
  inputs?: any[];
  outputs?: any[];
  capabilities?: string[];
  position?: { x: number; y: number };
  metadata?: {
    description?: string;
    tags?: string[];
    status?: BlockStatus;
  };
}

/**
 * DTO for updating an existing block
 */
export interface UpdateBlockDto {
  name?: string;
  config?: any;
  inputs?: any[];
  outputs?: any[];
  capabilities?: string[];
  position?: { x: number; y: number };
  metadata?: {
    description?: string;
    tags?: string[];
    status?: BlockStatus;
  };
}

/**
 * Block usage information (where a block is referenced)
 */
export interface BlockUsage {
  blockId: string;
  blockName: string;
  blockType: BlockType;
  usageType: 'parent' | 'child' | 'connection' | 'reference';
  context?: string;
}

/**
 * Block Service Interface
 *
 * All block service implementations (mock and real) MUST implement this interface.
 */
export interface IBlockService {
  // ===== CRUD Operations =====
  
  /** Get all blocks */
  getAll(): Promise<Block[]>;

  /** Get a specific block by ID, returns null if not found */
  getById(id: string): Promise<Block | null>;

  /** Create a new block */
  create(dto: CreateBlockDto): Promise<Block>;

  /** Update an existing block */
  update(id: string, updates: UpdateBlockDto): Promise<Block>;

  /** Delete a block */
  delete(id: string): Promise<void>;

  // ===== Query Operations =====
  
  /** Get blocks by type */
  getByType(type: BlockType): Promise<Block[]>;

  /** Get blocks by capability */
  getByCapability(capability: string): Promise<Block[]>;

  /** Search blocks by name, description, or tags */
  search(query: string): Promise<Block[]>;

  /** Find where a block is used (dependencies) */
  findUsages(blockId: string): Promise<BlockUsage[]>;

  // ===== Action Operations =====
  
  /** Duplicate a block with a new ID */
  duplicate(id: string): Promise<Block>;

  /** Export a block as JSON string */
  exportAsJson(id: string): Promise<string>;

  /** Import a block from JSON string */
  importFromJson(json: string): Promise<Block>;
}
