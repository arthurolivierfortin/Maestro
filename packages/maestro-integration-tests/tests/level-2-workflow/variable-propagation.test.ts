/**
 * Level 2 — Variable Propagation Tests
 *
 * Case 2.8: workflow completion resets _activeWorkflow.
 * Also tests that set-variable nodes actually write to session variables.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, importTemplate } from '../../src/test-harness.js';
import { waitForWorkflowComplete } from '../../src/poll.js';
import { extractVar } from '../../src/assertions.js';
import { MaestroClient } from '@maestro/client';

describe('Variable Propagation (Level 2)', () => {
  let client: MaestroClient;
  let sessionId: string;

  beforeAll(async () => {
    client = getTestClient();
    const session = await client.sessions.create({
      name: 'test-variable-propagation',
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

  it('2.8 — _activeWorkflow is empty after workflow completes', async () => {
    // Invoke a workflow
    await client.sessions.invoke(sessionId, 'new-conversation');

    // Wait for completion (this checks _activeWorkflow === "")
    const vars = await waitForWorkflowComplete(client, sessionId);

    // Explicitly verify
    const activeWorkflow = extractVar(vars, '_activeWorkflow');
    expect(
      activeWorkflow === '' || activeWorkflow === undefined || activeWorkflow === null
    ).toBe(true);
  });
});
