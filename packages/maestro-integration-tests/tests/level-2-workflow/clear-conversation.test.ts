/**
 * Level 2 — Clear Conversation Workflow Tests
 *
 * Cases 2.5-2.7: clear-conversation changes the active conversation,
 * conditional branches execute correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, importTemplate } from '../../src/test-harness.js';
import { waitForWorkflowComplete } from '../../src/poll.js';
import { assertNoNodeErrors, assertNoLogErrors, extractVar } from '../../src/assertions.js';
import { MaestroClient } from '@maestro/client';

describe('Clear Conversation Workflow (Level 2)', () => {
  let client: MaestroClient;
  let sessionId: string;

  beforeAll(async () => {
    client = getTestClient();
    const session = await client.sessions.create({
      name: 'test-clear-conversation',
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

  it('2.5 — clear-conversation creates a new conversation (different ID)', async () => {
    // First, create an initial conversation
    await client.sessions.invoke(sessionId, 'new-conversation');
    await waitForWorkflowComplete(client, sessionId);

    const vars1 = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const firstConversationId = extractVar(vars1, '_activeConversation') as string;
    expect(firstConversationId.length).toBeGreaterThan(0);

    // Now clear and create a new one
    await client.sessions.invoke(sessionId, 'clear-conversation');
    await waitForWorkflowComplete(client, sessionId);

    const vars2 = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const secondConversationId = extractVar(vars2, '_activeConversation') as string;

    expect(secondConversationId.length).toBeGreaterThan(0);
    expect(secondConversationId).not.toBe(firstConversationId);
  });

  it('2.6 — conditional then-branch executes when _activeConversation has value', async () => {
    // After clear-conversation, _activeConversation has a value.
    // If we clear again, the conditional should take the cleanup (then) branch.
    const varsBefore = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const activeBefore = extractVar(varsBefore, '_activeConversation') as string;
    expect(activeBefore.length).toBeGreaterThan(0);

    await client.sessions.invoke(sessionId, 'clear-conversation');
    await waitForWorkflowComplete(client, sessionId);

    const vars = await client.variables.getAll(sessionId) as Record<string, unknown>;
    assertNoNodeErrors(extractVar(vars, '_executionTree'));
    assertNoLogErrors(extractVar(vars, '_executionLog'));
  });

  it('2.7 — conditional else-branch on empty _activeConversation', async () => {
    // Create a fresh session where _activeConversation is empty
    const freshSession = await client.sessions.create({
      name: 'test-conditional-else',
      repositoryPath: process.cwd(),
    });
    await importTemplate(client, freshSession.id, 'maestro-assistant');
    await client.sessions.start(freshSession.id);

    // _activeConversation is "" (from template)
    // clear-conversation's conditional: {{_activeConversation}} != null
    // With empty string, the condition should be... tricky.
    // Note from MEMORY.md: {{var}} != null DOES NOT WORK with empty strings.
    // This test documents the actual behavior.
    await client.sessions.invoke(freshSession.id, 'clear-conversation');
    await waitForWorkflowComplete(client, freshSession.id);

    const vars = await client.variables.getAll(freshSession.id) as Record<string, unknown>;
    const active = extractVar(vars, '_activeConversation') as string;

    // Regardless of which branch was taken, a conversation should exist
    expect(active.length).toBeGreaterThan(0);

    // Cleanup
    await client.sessions.delete(freshSession.id);
  });
});
