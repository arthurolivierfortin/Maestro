/**
 * Block Discovery Service Interface
 *
 * Provides programmatic access to block discovery, recommendations,
 * and execution insights for self-improving workflows.
 */

import type { Block, BlockType } from '@/types/block.types';

/**
 * Filter options for listing blocks
 */
export interface BlockFilter {
  type?: BlockType;
  capability?: string;
  status?: 'draft' | 'active' | 'archived';
  tags?: string[];
}

/**
 * Summary information about a block
 */
export interface BlockSummary {
  id: string;
  name: string;
  type: BlockType;
  capabilities: string[];
  description?: string;
}

/**
 * Input/output schema for a block
 */
export interface BlockSchema {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
}

/**
 * Context for block suggestions
 */
export interface WorkflowContext {
  workflowType?: string;
  currentBlocks?: string[];
  desiredCapability?: string;
  recentUsage?: string[];
}

/**
 * Block suggestion with relevance score
 */
export interface BlockSuggestion {
  block: BlockSummary;
  relevanceScore: number;
  reason: string;
}

/**
 * Block usage statistics
 */
export interface BlockStats {
  executionCount: number;
  successRate: number;
  averageDurationMs: number;
  lastExecuted?: string;
}

/**
 * Execution record
 */
export interface Execution {
  id: string;
  blockId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  durationMs?: number;
}

/**
 * Block Discovery Service Interface
 */
export interface IBlockDiscoveryService {
  /**
   * List available blocks with optional filtering
   */
  listAvailableBlocks(filter?: BlockFilter): Promise<BlockSummary[]>;

  /**
   * Get capabilities of a specific block
   */
  getBlockCapabilities(blockId: string): Promise<string[]>;

  /**
   * Get input/output schema for a block
   */
  getBlockSchema(blockId: string): Promise<BlockSchema>;

  /**
   * Get AI-powered block suggestions based on workflow context
   */
  suggestBlocks(context: WorkflowContext): Promise<BlockSuggestion[]>;

  /**
   * Find blocks with similar functionality
   */
  findSimilarBlocks(blockId: string): Promise<Block[]>;

  /**
   * Get usage statistics for a block
   */
  getBlockStats(blockId: string): Promise<BlockStats>;

  /**
   * Get recent execution history for a block
   */
  getRecentExecutions(blockId: string, limit?: number): Promise<Execution[]>;
}
