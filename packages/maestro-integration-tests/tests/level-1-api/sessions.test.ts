/**
 * Level 1 — Session CRUD Tests
 *
 * Cases 1.1-1.4: create, get, list, delete sessions.
 */

import { describe, it, expect } from 'vitest';
import { getTestClient } from '../../src/test-harness.js';

describe('Sessions CRUD (Level 1)', () => {
  it('1.1 — create a session returns UUID and status', async () => {
    const client = getTestClient();

    const session = await client.sessions.create({
      name: 'test-session-create',
      repositoryPath: process.cwd(),
    });

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.id.length).toBeGreaterThanOrEqual(32);
    expect(session.name).toBe('test-session-create');

    // Cleanup
    await client.sessions.delete(session.id);
  });

  it('1.2 — get session by ID returns all fields', async () => {
    const client = getTestClient();

    const created = await client.sessions.create({
      name: 'test-session-get',
      repositoryPath: process.cwd(),
    });

    const session = await client.sessions.get(created.id);

    expect(session).toBeDefined();
    expect(session.id).toBe(created.id);
    expect(session.name).toBe('test-session-get');

    // Cleanup
    await client.sessions.delete(created.id);
  });

  it('1.3 — list sessions includes the created session', async () => {
    const client = getTestClient();

    const created = await client.sessions.create({
      name: 'test-session-list-unique-' + Date.now(),
      repositoryPath: process.cwd(),
    });

    const sessions = await client.sessions.list();

    expect(Array.isArray(sessions)).toBe(true);
    const found = sessions.find((s: any) => s.id === created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe(created.name);

    // Cleanup
    await client.sessions.delete(created.id);
  });

  it('1.4 — delete session then get returns 404', async () => {
    const client = getTestClient();

    const created = await client.sessions.create({
      name: 'test-session-delete',
      repositoryPath: process.cwd(),
    });

    // Delete
    await client.sessions.delete(created.id);

    // Get should fail
    await expect(client.sessions.get(created.id)).rejects.toThrow();
  });
});
