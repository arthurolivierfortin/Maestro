/**
 * Level 1 — Block Discovery Tests
 *
 * Cases 1.9-1.11: list blocks, filter by type, find by ID.
 */

import { describe, it, expect } from 'vitest';
import { getTestClient } from '../../src/test-harness.js';

describe('Block Discovery (Level 1)', () => {
  it('1.9 — list blocks returns >100 blocks', async () => {
    const client = getTestClient();
    const blocks = await client.blocks.list();

    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(100);
  });

  it('1.10 — filter blocks by type "workflow" returns only workflows', async () => {
    const client = getTestClient();
    const workflows = await client.blocks.list({ type: 'workflow' });

    expect(Array.isArray(workflows)).toBe(true);
    expect(workflows.length).toBeGreaterThan(0);

    for (const block of workflows) {
      expect(block.blockType).toBe('workflow');
    }
  });

  it('1.11 — find conversation block by ID', async () => {
    const client = getTestClient();

    // The conversation block should exist in the system blocks
    const blocks = await client.blocks.list();
    const conversation = blocks.find((b: any) => b.id === 'conversation' || b.blockType === 'conversation');

    expect(conversation).toBeDefined();
  });
});
