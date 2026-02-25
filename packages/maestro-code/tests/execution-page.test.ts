// @ts-nocheck
/**
 * Tests for ExecutionPage — wrapper around SessionMonitor.
 *
 * Tests the no-session state (message + navigation hint)
 * and the with-session state (SessionMonitor rendered).
 *
 * SessionMonitor is mocked to avoid network calls / polling.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

// Mock SessionMonitor to avoid real polling / network calls.
// Use vi.hoisted to get access to createElement before the mock factory runs.
const { mockSessionMonitor } = vi.hoisted(() => {
  return {
    mockSessionMonitor: vi.fn(),
  };
});

vi.mock('@maestro/monitor/components/SessionMonitor.ts', () => ({
  SessionMonitor: mockSessionMonitor,
}));

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── ExecutionPage Tests ───────────────────────────────────────

describe('ExecutionPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockSessionMonitor.mockImplementation((props: any) => {
      const parts = ['SessionMonitor:' + props.sessionId];
      if (props.onExit) parts.push('hasOnExit');
      if (props.onQuit) parts.push('hasOnQuit');
      return h(Text, null, parts.join(' | '));
    });
  });

  it('shows "No active session" when sessionId is null', async () => {
    const { ExecutionPage } = await import('../pages/ExecutionPage.ts');
    const { lastFrame } = render(h(ExecutionPage, {
      sessionId: null,
      apiClient: {},
      height: 20,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No active session');
    expect(frame).toContain('Agent page');
    expect(frame).toContain('Ctrl+Down');
  });

  it('shows "No active session" when apiClient is null', async () => {
    const { ExecutionPage } = await import('../pages/ExecutionPage.ts');
    const { lastFrame } = render(h(ExecutionPage, {
      sessionId: 'test-1234',
      apiClient: null,
      height: 20,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('No active session');
  });

  it('renders SessionMonitor when sessionId is present', async () => {
    const { ExecutionPage } = await import('../pages/ExecutionPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(ExecutionPage, {
      sessionId: 'abc-1234-5678',
      apiClient: mockClient,
      height: 20,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('SessionMonitor:abc-1234-5678');
  });

  it('passes onExit and onQuit to SessionMonitor', async () => {
    const { ExecutionPage } = await import('../pages/ExecutionPage.ts');
    const mockClient = { _fetch: vi.fn() };
    const { lastFrame } = render(h(ExecutionPage, {
      sessionId: 'abc-1234-5678',
      apiClient: mockClient,
      height: 20,
      onExit: () => {},
      onQuit: () => {},
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hasOnExit');
    expect(frame).toContain('hasOnQuit');
  });

  it('does not render SessionMonitor in no-session state', async () => {
    const { ExecutionPage } = await import('../pages/ExecutionPage.ts');
    const { lastFrame } = render(h(ExecutionPage, {
      sessionId: null,
      apiClient: null,
      height: 20,
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).not.toContain('SessionMonitor:');
    expect(frame).toContain('No active session');
  });
});
