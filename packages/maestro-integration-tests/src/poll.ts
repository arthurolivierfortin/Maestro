/**
 * Polling utilities for integration tests.
 *
 * Workflows execute asynchronously — after invoking an entry point,
 * we need to poll session variables to detect completion.
 */

import { MaestroClient } from '@maestro/client';

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Poll until a predicate returns true (or a non-nullish value).
 * Throws if timeout is exceeded.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  options: PollOptions = {}
): Promise<T> {
  const { intervalMs = 500, timeoutMs = 30000 } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

/**
 * Wait until the session's _activeWorkflow variable is empty (workflow completed).
 * Returns the final value of all session variables.
 */
export async function waitForWorkflowComplete(
  client: MaestroClient,
  sessionId: string,
  options: PollOptions = {}
): Promise<Record<string, unknown>> {
  const { intervalMs = 500, timeoutMs = 30000 } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const vars = await client.variables.getAll(sessionId) as Record<string, unknown>;
    const activeWorkflow = vars._activeWorkflow;
    // Workflow is complete when _activeWorkflow is empty string or undefined
    if (activeWorkflow === '' || activeWorkflow === undefined || activeWorkflow === null) {
      return vars;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }

  // Timeout — return what we have for debugging
  const finalVars = await client.variables.getAll(sessionId) as Record<string, unknown>;
  throw new Error(
    `Workflow did not complete within ${timeoutMs}ms. ` +
    `_activeWorkflow = "${finalVars._activeWorkflow}"`
  );
}
