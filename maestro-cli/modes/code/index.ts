/**
 * Phase 28-B: maestro code mode entry point
 *
 * Starts the interactive TUI mode (like Claude Code, but Maestro).
 * Creates a session, launches the Ink app, and manages lifecycle.
 */

import { render } from 'ink';
import { createElement as h } from 'react';
import { CodeApp } from './CodeApp.ts';

export interface CodeModeOptions {
  agent?: string;
  repo?: string;
  session?: string;
}

export async function startCodeMode(apiClient: any, options: CodeModeOptions = {}): Promise<void> {
  // Validate terminal
  if (!process.stdout.isTTY) {
    console.error('Error: maestro code requires a TTY terminal.');
    process.exit(1);
  }

  let sessionId = options.session;

  // Create a session if none provided
  if (!sessionId) {
    try {
      const result = await apiClient.createSession?.({
        type: 'project',
        name: `Code Mode - ${new Date().toISOString().slice(0, 10)}`,
        repo: options.repo || process.cwd(),
      });
      sessionId = result?.id || result?.sessionId;

      if (sessionId) {
        await apiClient.startSession?.(sessionId);
      }
    } catch (err: any) {
      console.error(`Failed to create session: ${err.message || err}`);
      console.error('You can provide an existing session with --session <id>');
      process.exit(1);
    }
  }

  if (!sessionId) {
    console.error('Error: no session ID. Provide --session <id> or ensure the API is running.');
    process.exit(1);
  }

  // Set terminal background
  const { setTerminalBg, resetTerminalBg } = await import('../../../shared/theme/terminal.ts');
  setTerminalBg();

  const cleanup = () => {
    resetTerminalBg();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Render the Ink app
  const { unmount, waitUntilExit } = render(
    h(CodeApp, {
      apiClient,
      sessionId,
      agentId: options.agent,
      onExit: () => {
        unmount();
        cleanup();
      },
    })
  );

  try {
    await waitUntilExit();
  } finally {
    resetTerminalBg();
  }
}
