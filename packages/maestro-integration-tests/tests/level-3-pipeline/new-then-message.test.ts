/**
 * Level 3 — New Conversation Then Message Tests
 *
 * Cases 3.7-3.8: After new-conversation, send a message.
 * The message should use the NEW conversation (not the old one).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, importTemplate } from '../../src/test-harness.js';
import { waitForWorkflowComplete } from '../../src/poll.js';
import { assertNoNodeErrors, assertNoLogErrors, extractVar } from '../../src/assertions.js';
import { MaestroClient } from '@maestro/client';

describe('New Conversation Then Message (Level 3)', () => {
  let client: MaestroClient;
  let sessionId: string;
  let messageVars: Record<string, unknown>;
  let newConversationId: string;

  beforeAll(async () => {
    client = getTestClient();

    const session = await client.sessions.create({
      name: 'test-new-then-message',
      repositoryPath: process.cwd(),
    });
    sessionId = session.id;
    await importTemplate(client, sessionId, 'maestro-assistant');
    await client.sessions.start(sessionId);

    // First: create a new conversation
    await client.sessions.invoke(sessionId, 'new-conversation');
    const vars1 = await waitForWorkflowComplete(client, sessionId);
    newConversationId = extractVar(vars1, '_activeConversation') as string;

    // Then: send a message using this conversation
    await client.sessions.invoke(sessionId, 'message', {
      message: 'Message after new-conversation',
    });
    messageVars = await waitForWorkflowComplete(client, sessionId, { timeoutMs: 60000 });
  });

  afterAll(async () => {
    if (sessionId) {
      try { await client.sessions.delete(sessionId); } catch {}
    }
  });

  it('3.7 — message uses the new conversation (same _activeConversation)', async () => {
    const messageConversationId = extractVar(messageVars, '_activeConversation') as string;

    expect(newConversationId.length).toBeGreaterThan(0);
    expect(messageConversationId).toBe(newConversationId);
  });

  it('3.8 — message input is received by the workflow', async () => {
    // The workflow should have executed without errors, meaning the {{message}}
    // template variable was resolved correctly
    const tree = extractVar(messageVars, '_executionTree');
    const log = extractVar(messageVars, '_executionLog');

    assertNoNodeErrors(tree);
    assertNoLogErrors(log);
  });
});
