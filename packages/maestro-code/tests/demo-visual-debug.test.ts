// @ts-nocheck
/**
 * Demo mode cockpit test: verifies that the FlipperLayout panels render
 * with actual data from the mock demo client.
 * Run with: npx vitest run tests/demo-visual-debug.test.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

describe('Demo mode cockpit', () => {
  afterEach(() => cleanup());

  it('renders populated panels after mock data arrives', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null, demoMode: true }));

    // Wait for auto-start + session creation + first data poll (2s interval)
    await delay(3000);
    const frame = stripAnsi(lastFrame() || '');

    // Execution tree should have real nodes (not "no active workflow")
    expect(frame).toContain('Prepare');
    expect(frame).not.toContain('(no active workflow)');

    // Log panel should have entries (not "no log entries yet")
    expect(frame).toContain('[info]');
    expect(frame).not.toContain('(no log entries yet)');

    // LLM panel should have entries (not "no LLM calls yet")
    expect(frame).toContain('Analyze');
    expect(frame).not.toContain('(no LLM calls yet)');

    // Metrics panel should show fitness
    expect(frame).toMatch(/\d+%/);

    // StatusBar should show session id
    expect(frame).toContain('session:demo-');
  }, 15000);
});
