/**
 * Level 1 — Template Import Tests
 *
 * Cases 1.12-1.13: import maestro-assistant template, verify entry points.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { getTestClient, importTemplate } from '../../src/test-harness.js';
import { MaestroClient } from '@maestro/client';

describe('Template Import (Level 1)', () => {
  let client: MaestroClient;
  const cleanupIds: string[] = [];

  afterAll(async () => {
    if (client) {
      for (const id of cleanupIds) {
        try { await client.sessions.delete(id); } catch {}
      }
    }
  });

  it('1.12 — import maestro-assistant template sets variables and entry points', async () => {
    client = getTestClient();

    const session = await client.sessions.create({ name: 'test-template-import', repositoryPath: process.cwd() });
    cleanupIds.push(session.id);

    const result = await importTemplate(client, session.id, 'maestro-assistant');

    // Template has variables and entry points
    expect(result.variables).toBeGreaterThan(0);
    expect(result.entryPoints).toBe(3); // message, new-conversation, clear-conversation

    // Verify variables were set
    const vars = await client.variables.getAll(session.id) as Record<string, unknown>;
    expect(vars.sessionMode).toBe('assistant');
    expect(vars._activeConversation).toBe('');
    expect(Array.isArray(vars._executionLog)).toBe(true);
    expect(Array.isArray(vars._executionTree)).toBe(true);
  });

  it('1.13 — entry points are registered after import', async () => {
    client = getTestClient();

    const session = await client.sessions.create({ name: 'test-entry-points', repositoryPath: process.cwd() });
    cleanupIds.push(session.id);

    await importTemplate(client, session.id, 'maestro-assistant');

    // Get session and check entry points
    const fetched = await client.sessions.get(session.id) as any;

    // Entry points should be in the session data
    // The exact field name depends on the backend API response
    const entryPoints = fetched.entryPoints || fetched.entry_points;
    expect(entryPoints).toBeDefined();

    // Should have the 3 expected entry points
    const epNames = Object.keys(entryPoints);
    expect(epNames).toContain('message');
    expect(epNames).toContain('new-conversation');
    expect(epNames).toContain('clear-conversation');
  });
});
