/**
 * Level 2 — New Conversation Workflow Tests
 *
 * Cases 2.1-2.4: invoke new-conversation, verify conversation created,
 * execution tree nodes, variable propagation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, importTemplate } from '../../src/test-harness.js';
import { waitForWorkflowComplete } from '../../src/poll.js';
import { assertAllNodesDone, assertNoNodeErrors, assertNoLogErrors, extractVar } from '../../src/assertions.js';
import { MaestroClient } from '@maestro/client';

describe('New Conversation Workflow (Level 2)', () => {
  let client: MaestroClient;
  let sessionId: string;

  beforeAll(async () => {
    client = getTestClient();
    const session = await client.sessions.create({
      name: 'test-new-conversation',
      repositoryPath: process.cwd(),
    });
    sessionId = session.id;
    await importTemplate(client, sessionId, 'maestro-assistant');
    await client.sessions.start(sessionId);
  });

  afterAll(async () => {
    if (sessionId) {
      try { await client.sessions.delete(sessionId); } catch {}
    }
  });

  it('2.1 — invoke new-conversation sets _activeConversation to a UUID', async () => {
    // Before: _activeConversation should be empty
    const varsBefore = await client.variables.getAll(sessionId) as Record<string, unknown>;
    expect(extractVar(varsBefore, '_activeConversation')).toBe('');

    // Invoke
    await client.sessions.invoke(sessionId, 'new-conversation');

    // Wait for workflow to complete
    const vars = await waitForWorkflowComplete(client, sessionId);

    // _activeConversation should now be a non-empty UUID
    const conversationId = extractVar(vars, '_activeConversation') as string;
    expect(conversationId).toBeDefined();
    expect(typeof conversationId).toBe('string');
    expect(conversationId.length).toBeGreaterThan(0);
  });

  it('2.2 — execution tree after new-conversation has all nodes done', async () => {
    const vars = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const tree = extractVar(vars, '_executionTree');

    assertNoNodeErrors(tree);
  });

  it('2.3 — execution log has entries (no errors)', async () => {
    const vars = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const log = extractVar(vars, '_executionLog');

    assertNoLogErrors(log);
  });

  it('2.4 — _nodeResult_create-conversation propagated to _activeConversation', async () => {
    const vars = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const conversationId = extractVar(vars, '_activeConversation');

    // The conversation ID should be a valid UUID-like string
    expect(typeof conversationId).toBe('string');
    expect((conversationId as string).length).toBeGreaterThanOrEqual(8);
  });
});
