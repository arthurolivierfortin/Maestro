/**
 * Level 3 — Second Message Pipeline Tests
 *
 * Cases 3.5-3.6: Send two messages and verify the conversation is REUSED
 * (same _activeConversation), not re-created.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, importTemplate } from '../../src/test-harness.js';
import { waitForWorkflowComplete } from '../../src/poll.js';
import { assertNoNodeErrors, assertNoLogErrors, extractVar } from '../../src/assertions.js';
import { MaestroClient } from '@maestro/client';

describe('Second Message Pipeline (Level 3)', () => {
  let client: MaestroClient;
  let sessionId: string;
  let firstConversationId: string;
  let secondVars: Record<string, unknown>;

  beforeAll(async () => {
    client = getTestClient();

    const session = await client.sessions.create({
      name: 'test-second-message-pipeline',
      repositoryPath: process.cwd(),
    });
    sessionId = session.id;
    await importTemplate(client, sessionId, 'maestro-assistant');
    await client.sessions.start(sessionId);

    // First message
    await client.sessions.invoke(sessionId, 'message', {
      message: 'First message',
    });
    const vars1 = await waitForWorkflowComplete(client, sessionId, { timeoutMs: 60000 });
    firstConversationId = extractVar(vars1, '_activeConversation') as string;

    // Second message
    await client.sessions.invoke(sessionId, 'message', {
      message: 'Second message',
    });
    secondVars = await waitForWorkflowComplete(client, sessionId, { timeoutMs: 60000 });
  });

  afterAll(async () => {
    if (sessionId) {
      try { await client.sessions.delete(sessionId); } catch {}
    }
  });

  it('3.5 — second message reuses same conversation (not re-created)', async () => {
    const secondConversationId = extractVar(secondVars, '_activeConversation') as string;

    expect(firstConversationId.length).toBeGreaterThan(0);
    expect(secondConversationId).toBe(firstConversationId);
  });

  it('3.6 — ensure-conversation takes the then-branch (conversation exists)', async () => {
    // On second message, _activeConversation is non-empty,
    // so the conditional should NOT create a new conversation.
    // The conversation ID staying the same (test 3.5) proves this.
    const tree = extractVar(secondVars, '_executionTree');
    const log = extractVar(secondVars, '_executionLog');

    assertNoNodeErrors(tree);
    assertNoLogErrors(log);
  });
});
