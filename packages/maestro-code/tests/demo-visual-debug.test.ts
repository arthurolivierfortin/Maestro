// @ts-nocheck
/**
 * Demo mode test: verifies that the AgentPage renders correctly
 * with the mock demo client in working state.
 * Run with: npx vitest run tests/demo-visual-debug.test.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

describe('Demo mode AgentPage', () => {
  afterEach(() => cleanup());

  it('renders working state with conversation log after auto-start', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null, demoMode: true }));

    // Wait for auto-start + session creation + first data poll
    await delay(3000);
    const frame = stripAnsi(lastFrame() || '');

    // AgentPage working state: MascotteCompact header visible
    expect(frame).toContain('Agent working');

    // ConversationLog shows session activity
    expect(frame).toContain('Creating session');
    expect(frame).toContain('Session started');
    expect(frame).toContain('Invoking');

    // StatusBar should show session id
    expect(frame).toContain('session:demo-');

    // DEMO marker visible
    expect(frame).toContain('DEMO');
  }, 15000);
});
