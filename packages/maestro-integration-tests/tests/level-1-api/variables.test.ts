/**
 * Level 1 — Variable Tests
 *
 * Cases 1.5-1.8: set/get/delete variables with different types.
 * Case 1.6 specifically tests for the JsonElement corruption bug.
 *
 * Note: GET /api/sessions/{id}/variables/{key} returns { key, value },
 * not the raw value. We extract .value for assertions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient } from '../../src/test-harness.js';
import { MaestroClient } from '@maestro/client';

/** Extract the value from a variable response (API returns { key, value }). */
function extractValue(response: unknown): unknown {
  if (response && typeof response === 'object' && 'value' in response) {
    return (response as any).value;
  }
  return response;
}

describe('Variables (Level 1)', () => {
  let client: MaestroClient;
  let sessionId: string;

  beforeAll(async () => {
    client = getTestClient();
    const session = await client.sessions.create({ name: 'test-variables', repositoryPath: process.cwd() });
    sessionId = session.id;
  });

  afterAll(async () => {
    if (sessionId) {
      try { await client.sessions.delete(sessionId); } catch {}
    }
  });

  it('1.5 — set and get a string variable', async () => {
    await client.variables.set(sessionId, 'testString', 'hello world');
    const raw = await client.variables.get(sessionId, 'testString');
    const value = extractValue(raw);

    expect(value).toBe('hello world');
  });

  it('1.6 — set and get a JSON object variable (JsonElement corruption test)', async () => {
    const obj = {
      name: 'test',
      nested: { key: 'value', count: 42 },
      tags: ['a', 'b', 'c'],
    };

    await client.variables.set(sessionId, 'testObject', obj);
    const raw = await client.variables.get(sessionId, 'testObject');
    const value = extractValue(raw) as any;

    // This is the critical test — without NormalizeObjectValue(), objects
    // become corrupted nested arrays [[],[],...] instead of proper objects.
    expect(value).toBeDefined();
    expect(typeof value).toBe('object');
    expect(value.name).toBe('test');
    expect(value.nested).toBeDefined();
    expect(value.nested.key).toBe('value');
    expect(value.nested.count).toBe(42);
    expect(Array.isArray(value.tags)).toBe(true);
    expect(value.tags).toEqual(['a', 'b', 'c']);
  });

  it('1.7 — set and get an array variable', async () => {
    const arr = [1, 'two', { three: 3 }, [4, 5]];

    await client.variables.set(sessionId, 'testArray', arr);
    const raw = await client.variables.get(sessionId, 'testArray');
    const value = extractValue(raw) as any;

    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(4);
    expect(value[0]).toBe(1);
    expect(value[1]).toBe('two');
    expect(value[2]).toEqual({ three: 3 });
    expect(value[3]).toEqual([4, 5]);
  });

  it('1.8 — delete a variable', async () => {
    await client.variables.set(sessionId, 'testDelete', 'to-be-deleted');

    // Verify it exists
    const raw = await client.variables.get(sessionId, 'testDelete');
    const before = extractValue(raw);
    expect(before).toBe('to-be-deleted');

    // Delete
    await client.variables.delete(sessionId, 'testDelete');

    // Get should fail
    await expect(
      client.variables.get(sessionId, 'testDelete')
    ).rejects.toThrow();
  });
});
