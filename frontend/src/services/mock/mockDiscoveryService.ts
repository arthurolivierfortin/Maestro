/**
 * Mock Block Discovery Service
 * 
 * Provides mock implementation of block discovery for development and testing.
 */

import type {
  IBlockDiscoveryService,
  BlockFilter,
  BlockSummary,
  BlockSchema,
  WorkflowContext,
  BlockSuggestion,
  BlockStats,
  Execution,
} from '../interfaces/IBlockDiscoveryService';
import type { Block } from '@/types/block.types';
import { useBlockStore } from '@/store/blockStore';

/**
 * Simulated network delay
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock Discovery Service Implementation
 */
class MockDiscoveryService implements IBlockDiscoveryService {
  async listAvailableBlocks(filter?: BlockFilter): Promise<BlockSummary[]> {
    await delay(150);
    
    const blocks = useBlockStore.getState().blocks;
    let filtered = blocks;

    // Apply filters
    if (filter?.type) {
      filtered = filtered.filter(b => b.blockType === filter.type);
    }
    if (filter?.capability) {
      filtered = filtered.filter(b => 
        b.capabilities?.includes(filter.capability!)
      );
    }
    if (filter?.status) {
      filtered = filtered.filter(b => b.status === filter.status);
    }
    if (filter?.tags && filter.tags.length > 0) {
      filtered = filtered.filter(b =>
        filter.tags!.some(tag => b.tags?.includes(tag))
      );
    }

    // Convert to summaries
    return filtered.map(b => ({
      id: b.id,
      name: b.name,
      type: b.blockType,
      capabilities: b.capabilities || [],
      description: b.description,
    }));
  }

  async getBlockCapabilities(blockId: string): Promise<string[]> {
    await delay(100);
    
    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) {
      throw new Error(`Block with ID '${blockId}' not found`);
    }

    return block.capabilities || [];
  }

  async getBlockSchema(blockId: string): Promise<BlockSchema> {
    await delay(100);
    
    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) {
      throw new Error(`Block with ID '${blockId}' not found`);
    }

    // Mock schema based on block type
    return {
      inputs: {
        input: { type: 'string', required: true },
      },
      outputs: {
        output: { type: 'string' },
      },
    };
  }

  async suggestBlocks(context: WorkflowContext): Promise<BlockSuggestion[]> {
    await delay(200);
    
    const blocks = useBlockStore.getState().blocks;
    const suggestions: BlockSuggestion[] = [];

    // Simple suggestion logic based on context
    for (const block of blocks) {
      let score = 0;
      let reason = '';

      // Score based on desired capability
      if (context.desiredCapability && block.capabilities?.includes(context.desiredCapability)) {
        score += 50;
        reason = `Has capability: ${context.desiredCapability}`;
      }

      // Score based on workflow type
      if (context.workflowType && block.tags?.includes(context.workflowType)) {
        score += 30;
        reason += reason ? ` and matches workflow type` : `Matches workflow type`;
      }

      // Score based on recent usage
      if (context.recentUsage?.includes(block.id)) {
        score += 20;
        reason += reason ? ` and recently used` : `Recently used`;
      }

      if (score > 0) {
        suggestions.push({
          block: {
            id: block.id,
            name: block.name,
            type: block.blockType,
            capabilities: block.capabilities || [],
            description: block.description,
          },
          relevanceScore: score,
          reason: reason || 'General match',
        });
      }
    }

    // Sort by relevance score
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return suggestions.slice(0, 10); // Return top 10
  }

  async findSimilarBlocks(blockId: string): Promise<Block[]> {
    await delay(150);
    
    const blocks = useBlockStore.getState().blocks;
    const targetBlock = blocks.find(b => b.id === blockId);
    
    if (!targetBlock) {
      throw new Error(`Block with ID '${blockId}' not found`);
    }

    // Find similar blocks based on type and capabilities
    const similar = blocks.filter(b => {
      if (b.id === blockId) return false;
      
      // Same type
      if (b.blockType === targetBlock.blockType) return true;
      
      // Overlapping capabilities
      const overlap = b.capabilities?.filter(c => 
        targetBlock.capabilities?.includes(c)
      );
      return overlap && overlap.length > 0;
    });

    return similar.slice(0, 5); // Return top 5
  }

  async getBlockStats(blockId: string): Promise<BlockStats> {
    await delay(100);
    
    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) {
      throw new Error(`Block with ID '${blockId}' not found`);
    }

    // Mock statistics
    return {
      executionCount: Math.floor(Math.random() * 100),
      successRate: 85 + Math.random() * 15, // 85-100%
      averageDurationMs: 100 + Math.random() * 900, // 100-1000ms
      lastExecuted: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async getRecentExecutions(blockId: string, limit: number = 10): Promise<Execution[]> {
    await delay(150);
    
    const block = useBlockStore.getState().blocks.find(b => b.id === blockId);
    if (!block) {
      throw new Error(`Block with ID '${blockId}' not found`);
    }

    // Mock execution history
    const executions: Execution[] = [];
    const count = Math.min(limit, 5);

    for (let i = 0; i < count; i++) {
      const startedAt = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
      const durationMs = 100 + Math.random() * 900;
      const completedAt = new Date(new Date(startedAt).getTime() + durationMs).toISOString();
      const status: 'completed' | 'failed' = Math.random() > 0.15 ? 'completed' : 'failed';

      executions.push({
        id: `exec-${i}`,
        blockId,
        startedAt,
        completedAt: status === 'completed' ? completedAt : undefined,
        status,
        durationMs: status === 'completed' ? durationMs : undefined,
      });
    }

    return executions;
  }
}

// Singleton instance
let instance: MockDiscoveryService | null = null;

/**
 * Get mock discovery service instance
 */
export function getMockDiscoveryService(): IBlockDiscoveryService {
  if (!instance) {
    instance = new MockDiscoveryService();
  }
  return instance;
}
