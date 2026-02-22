// @ts-nocheck
/**
 * Unit tests for adapt-optimize module (Phase 39).
 *
 * Tests manifest extraction, model detection, block variant helper,
 * and strategy logic. Does NOT require backend/LLM-Provider running.
 *
 * Run: cd packages/maestro-cli && npx vitest run tests/adapt-optimize.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  extractManifest,
  flattenModels,
  collectModelBlocks,
  detectModels,
  withBlockVariant,
  STRATEGIES,
} = require('../adapt-optimize.ts');

// ── Mock API Client ─────────────────────────────────────────────

function createMockClient(blocks: Record<string, any> = {}, models: any[] = []) {
  const createdBlocks: Record<string, any> = {};

  return {
    getBlock: async (id: string) => {
      if (createdBlocks[id]) return createdBlocks[id];
      if (blocks[id]) return blocks[id];
      throw new Error(`Block not found: ${id}`);
    },
    createBlock: async (block: any) => {
      createdBlocks[block.id] = block;
      return block;
    },
    deleteBlock: async (id: string) => {
      delete createdBlocks[id];
    },
    listLLMModels: async () => models,
    _fetch: async (method: string, path: string, opts?: any) => {
      if (method === 'GET' && path.startsWith('/api/blocks/')) {
        const id = path.replace('/api/blocks/', '');
        if (createdBlocks[id]) return createdBlocks[id];
        if (blocks[id]) return blocks[id];
        throw new Error(`Block not found: ${id}`);
      }
      if (method === 'POST' && path.includes('/execute')) {
        return { success: true, outputs: { result: 'ok' }, totalTokens: 100, estimatedCostUsd: 0.001 };
      }
      throw new Error(`Unmocked: ${method} ${path}`);
    },
    executeWorkflow: async () => ({
      success: true, outputs: { summary: 'done' }, totalTokens: 500, estimatedCostUsd: 0.01,
    }),
  };
}

// ── Test Blocks ─────────────────────────────────────────────────

const TEST_BLOCKS: Record<string, any> = {
  'simple-agent': {
    id: 'simple-agent',
    blockType: 'agent',
    config: {
      model: 'claude-sonnet-4-6',
      temperature: 0,
    },
  },
  'composite-agent': {
    id: 'composite-agent',
    blockType: 'agent',
    config: {
      maxIterations: 10,
      nodes: [
        {
          id: 'reasoning',
          blockRef: 'inference',
          config: { model: 'claude-sonnet-4-6', planningModel: 'claude-opus-4-6' },
        },
      ],
    },
  },
  'inference': {
    id: 'inference',
    blockType: 'inference',
    config: {},
  },
  'test-workflow': {
    id: 'test-workflow',
    blockType: 'workflow',
    config: {
      nodes: [
        { id: 'step1', blockRef: 'simple-agent', inputs: {} },
        { id: 'step2', blockRef: 'haiku-agent', inputs: {} },
        {
          id: 'retry-loop',
          type: 'while',
          nodes: [
            { id: 'inner', blockRef: 'validator-block', inputs: {} },
          ],
        },
        {
          id: 'gate',
          type: 'conditional',
          then: { blockRef: 'committer-block', inputs: {} },
          else: { nodes: [{ id: 'fallback', blockRef: 'fallback-block', inputs: {} }] },
        },
      ],
    },
  },
  'haiku-agent': {
    id: 'haiku-agent',
    blockType: 'agent',
    config: { model: 'claude-haiku-4-5-20251001' },
  },
  'validator-block': {
    id: 'validator-block',
    blockType: 'validator',
    config: {},
  },
  'committer-block': {
    id: 'committer-block',
    blockType: 'agent',
    config: { model: 'claude-sonnet-4-6' },
  },
  'fallback-block': {
    id: 'fallback-block',
    blockType: 'tool',
    config: {},
  },
};

// ── Tests ───────────────────────────────────────────────────────

describe('extractManifest', () => {
  it('should extract model from a simple agent', async () => {
    const client = createMockClient(TEST_BLOCKS);
    const manifest = await extractManifest('simple-agent', client);

    expect(manifest.blockId).toBe('simple-agent');
    expect(manifest.model).toBe('claude-sonnet-4-6');
    expect(manifest.planningModel).toBeNull();
    expect(manifest.childBlocks).toHaveLength(0);
  });

  it('should extract models from a composite agent with config.nodes', async () => {
    const client = createMockClient(TEST_BLOCKS);
    const manifest = await extractManifest('composite-agent', client);

    expect(manifest.blockId).toBe('composite-agent');
    expect(manifest.model).toBeNull(); // No top-level model
    expect(manifest.childBlocks.length).toBeGreaterThan(0);

    // Should find the inline node model
    const nodeChild = manifest.childBlocks.find(c => c.model === 'claude-sonnet-4-6');
    expect(nodeChild).toBeDefined();
  });

  it('should recursively extract from a workflow with nested nodes', async () => {
    const client = createMockClient(TEST_BLOCKS);
    const manifest = await extractManifest('test-workflow', client);

    expect(manifest.blockId).toBe('test-workflow');
    expect(manifest.blockType).toBe('workflow');

    // Flatten to check all discovered models
    const flat = flattenModels(manifest);
    expect(Object.keys(flat)).toContain('claude-sonnet-4-6');
    expect(Object.keys(flat)).toContain('claude-haiku-4-5-20251001');
  });

  it('should handle circular references gracefully', async () => {
    const blocks = {
      'block-a': { id: 'block-a', blockType: 'workflow', config: { nodes: [{ blockRef: 'block-b' }] } },
      'block-b': { id: 'block-b', blockType: 'workflow', config: { nodes: [{ blockRef: 'block-a' }] } },
    };
    const client = createMockClient(blocks);
    const manifest = await extractManifest('block-a', client);

    // Should not infinite loop
    expect(manifest.blockId).toBe('block-a');
  });

  it('should handle missing blocks gracefully', async () => {
    const client = createMockClient({});
    const manifest = await extractManifest('nonexistent', client);

    expect(manifest.blockId).toBe('nonexistent');
    expect(manifest.blockType).toBe('unknown');
    expect(manifest.model).toBeNull();
  });
});

describe('flattenModels', () => {
  it('should flatten a manifest tree into model → blocks map', async () => {
    const client = createMockClient(TEST_BLOCKS);
    const manifest = await extractManifest('test-workflow', client);
    const flat = flattenModels(manifest);

    expect(flat['claude-sonnet-4-6']).toBeDefined();
    expect(flat['claude-sonnet-4-6']).toContain('simple-agent');
    expect(flat['claude-sonnet-4-6']).toContain('committer-block');
    expect(flat['claude-haiku-4-5-20251001']).toContain('haiku-agent');
  });

  it('should include planning models', async () => {
    const client = createMockClient(TEST_BLOCKS);
    const manifest = await extractManifest('composite-agent', client);
    const flat = flattenModels(manifest);

    expect(flat['claude-opus-4-6']).toBeDefined();
    expect(flat['claude-opus-4-6'].some(b => b.includes('planning'))).toBe(true);
  });
});

describe('collectModelBlocks', () => {
  it('should collect unique blocks with direct model references', async () => {
    const client = createMockClient(TEST_BLOCKS);
    const manifest = await extractManifest('test-workflow', client);
    const blocks = collectModelBlocks(manifest);

    expect(blocks.length).toBeGreaterThan(0);
    const blockIds = blocks.map(b => b.blockId);
    expect(blockIds).toContain('simple-agent');
    expect(blockIds).toContain('haiku-agent');
    expect(blockIds).toContain('committer-block');

    // Should not include blocks without models (validator, tool)
    expect(blockIds).not.toContain('validator-block');
    expect(blockIds).not.toContain('fallback-block');
  });

  it('should deduplicate blocks', async () => {
    const blocks = {
      'wf': {
        id: 'wf', blockType: 'workflow', config: {
          nodes: [
            { blockRef: 'simple-agent' },
            { blockRef: 'simple-agent' }, // duplicate
          ],
        },
      },
      ...TEST_BLOCKS,
    };
    const client = createMockClient(blocks);
    const manifest = await extractManifest('wf', client);
    const collected = collectModelBlocks(manifest);
    const ids = collected.map(b => b.blockId);
    expect(ids.filter(id => id === 'simple-agent')).toHaveLength(1);
  });
});

describe('detectModels', () => {
  it('should detect available models by exact match', async () => {
    const models = [
      { modelId: 'claude-sonnet-4-6', provider: 'ClaudeCode', isLocal: false },
      { modelId: 'qwen-2.5-coder-1.5b', provider: 'Local', isLocal: true },
    ];
    const client = createMockClient({}, models);
    const result = await detectModels(['claude-sonnet-4-6', 'claude-opus-4-6'], client);

    expect(result).toHaveLength(2);
    expect(result[0].modelId).toBe('claude-sonnet-4-6');
    expect(result[0].available).toBe(true);
    expect(result[0].provider).toBe('ClaudeCode');
    expect(result[1].modelId).toBe('claude-opus-4-6');
    expect(result[1].available).toBe(false);
  });

  it('should detect models by fuzzy prefix match', async () => {
    const models = [
      { modelId: 'claude-sonnet-4-6', provider: 'ClaudeCode' },
    ];
    const client = createMockClient({}, models);
    const result = await detectModels(['claude-sonnet'], client);

    expect(result[0].available).toBe(true);
  });

  it('should handle LLM-Provider not running', async () => {
    const client = {
      listLLMModels: async () => { throw new Error('Connection refused'); },
    };
    const result = await detectModels(['claude-sonnet-4-6'], client);
    expect(result[0].available).toBe(false);
  });
});

describe('withBlockVariant', () => {
  // Helper: find the variant file path (same logic as withBlockVariant)
  function getVariantDir() {
    const fs = require('fs');
    const path = require('path');
    return path.resolve(__dirname, '../../../content/system/blocks/_variants');
  }

  // Manual cleanup after each test (withBlockVariant does best-effort cleanup
  // but Windows file locks can prevent immediate deletion)
  function cleanupVariant(variantId: string | null) {
    if (!variantId) return;
    const fs = require('fs');
    const path = require('path');
    const variantFile = path.join(getVariantDir(), `${variantId}.block.json`);
    try { fs.unlinkSync(variantFile); } catch { /* already cleaned */ }
    try {
      const dir = getVariantDir();
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) fs.rmdirSync(dir);
    } catch { /* ignore */ }
  }

  it('should create a variant file with correct content and return fn result', async () => {
    const client = createMockClient(TEST_BLOCKS);

    let variantIdSeen: string | null = null;
    try {
      const result = await withBlockVariant(
        'simple-agent',
        { 'config.model': 'claude-haiku' },
        client,
        async (variantId) => {
          variantIdSeen = variantId;
          expect(variantId).toContain('simple-agent--variant-');
          // Variant exists as a file on disk — verify content
          const fs = require('fs');
          const path = require('path');
          const variantFile = path.join(getVariantDir(), `${variantId}.block.json`);
          expect(fs.existsSync(variantFile)).toBe(true);
          const data = JSON.parse(fs.readFileSync(variantFile, 'utf-8'));
          expect(data.config.model).toBe('claude-haiku');
          expect(data.id).toBe(variantId);
          return { ok: true };
        },
        { skipDiscovery: true }
      );

      expect(result).toEqual({ ok: true });
    } finally {
      cleanupVariant(variantIdSeen);
    }
  });

  it('should propagate errors from fn', async () => {
    const client = createMockClient(TEST_BLOCKS);

    let variantIdSeen: string | null = null;
    try {
      await expect(
        withBlockVariant('simple-agent', { 'config.model': 'x' }, client, async (variantId) => {
          variantIdSeen = variantId;
          throw new Error('test error');
        }, { skipDiscovery: true })
      ).rejects.toThrow('test error');
    } finally {
      cleanupVariant(variantIdSeen);
    }
  });

  it('should apply nested mutations', async () => {
    const client = createMockClient(TEST_BLOCKS);

    let variantIdSeen: string | null = null;
    try {
      await withBlockVariant(
        'simple-agent',
        { 'config.model': 'new-model', 'config.temperature': 0.5 },
        client,
        async (variantId) => {
          variantIdSeen = variantId;
          const fs = require('fs');
          const path = require('path');
          const variantFile = path.join(getVariantDir(), `${variantId}.block.json`);
          const data = JSON.parse(fs.readFileSync(variantFile, 'utf-8'));
          expect(data.config.model).toBe('new-model');
          expect(data.config.temperature).toBe(0.5);
        },
        { skipDiscovery: true }
      );
    } finally {
      cleanupVariant(variantIdSeen);
    }
  });
});

describe('STRATEGIES', () => {
  it('should have model-downgrade and temperature-tuning registered', () => {
    expect(STRATEGIES['model-downgrade']).toBeDefined();
    expect(STRATEGIES['temperature-tuning']).toBeDefined();
    expect(typeof STRATEGIES['model-downgrade']).toBe('function');
    expect(typeof STRATEGIES['temperature-tuning']).toBe('function');
  });
});
