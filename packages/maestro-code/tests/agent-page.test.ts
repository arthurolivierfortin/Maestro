// @ts-nocheck
/**
 * Tests for AgentPage — 3 visual states: idle, working, completed.
 *
 * Also tests MascotteFull, MascotteCompact, ConversationLog standalone.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── MascotteFull Tests ────────────────────────────────────────

describe('MascotteFull', () => {
  afterEach(() => cleanup());

  it('renders idle state with "Agent ready"', async () => {
    const { MascotteFull } = await import('../components/MascotteFull.ts');
    const { lastFrame } = render(h(MascotteFull, { state: 'idle' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Agent ready');
  });

  it('renders working state with "Agent working"', async () => {
    const { MascotteFull } = await import('../components/MascotteFull.ts');
    const { lastFrame } = render(h(MascotteFull, { state: 'working' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Agent working');
  });

  it('renders celebrating state with "Task completed"', async () => {
    const { MascotteFull } = await import('../components/MascotteFull.ts');
    const { lastFrame } = render(h(MascotteFull, { state: 'celebrating' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Task completed');
  });

  it('renders custom status text', async () => {
    const { MascotteFull } = await import('../components/MascotteFull.ts');
    const { lastFrame } = render(h(MascotteFull, { state: 'idle', statusText: 'Custom status' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Custom status');
  });
});

// ── MascotteCompact Tests ─────────────────────────────────────

describe('MascotteCompact', () => {
  afterEach(() => cleanup());

  it('renders idle with mini face and label', async () => {
    const { MascotteCompact } = await import('../components/MascotteCompact.ts');
    const { lastFrame } = render(h(MascotteCompact, { state: 'idle' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Agent idle');
  });

  it('renders working with spinner indicator', async () => {
    const { MascotteCompact } = await import('../components/MascotteCompact.ts');
    const { lastFrame } = render(h(MascotteCompact, { state: 'working' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Agent working');
  });

  it('renders celebrating state', async () => {
    const { MascotteCompact } = await import('../components/MascotteCompact.ts');
    const { lastFrame } = render(h(MascotteCompact, { state: 'celebrating' }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Task completed');
  });

  it('shows session ID when provided', async () => {
    const { MascotteCompact } = await import('../components/MascotteCompact.ts');
    const { lastFrame } = render(h(MascotteCompact, {
      state: 'working',
      sessionId: 'abcdef12-3456-7890-abcd-ef1234567890',
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('session:abcdef12');
  });

  it('shows status text', async () => {
    const { MascotteCompact } = await import('../components/MascotteCompact.ts');
    const { lastFrame } = render(h(MascotteCompact, {
      state: 'working',
      statusText: 'Implementing auth...',
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Implementing auth...');
  });
});

// ── ConversationLog Tests ─────────────────────────────────────

describe('ConversationLog', () => {
  afterEach(() => cleanup());

  it('shows "Waiting for input..." when no lines', async () => {
    const { ConversationLog } = await import('../components/ConversationLog.ts');
    const { lastFrame } = render(h(ConversationLog, { lines: [], height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Waiting for input...');
  });

  it('renders log lines', async () => {
    const { ConversationLog } = await import('../components/ConversationLog.ts');
    const lines = [
      { text: 'Hello world' },
      { text: 'Second line', color: 'green' },
    ];
    const { lastFrame } = render(h(ConversationLog, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Hello world');
    expect(frame).toContain('Second line');
  });

  it('renders timestamps', async () => {
    const { ConversationLog } = await import('../components/ConversationLog.ts');
    const lines = [
      { text: 'Log entry', timestamp: '12:34:56' },
    ];
    const { lastFrame } = render(h(ConversationLog, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('12:34:56');
    expect(frame).toContain('Log entry');
  });

  it('renders user messages with prefix', async () => {
    const { ConversationLog } = await import('../components/ConversationLog.ts');
    const lines = [
      { text: '> Add login page', color: 'green', bold: true },
    ];
    const { lastFrame } = render(h(ConversationLog, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Add login page');
  });
});

// ── AgentPage State Tests ──────────────────────────────────────

describe('AgentPage', () => {
  afterEach(() => cleanup());

  it('renders idle state with MascotteFull', async () => {
    const { AgentPage } = await import('../pages/AgentPage.ts');
    const { lastFrame } = render(h(AgentPage, {
      agentState: 'idle',
      lines: [],
      busy: false,
      connected: true,
      latency: 15,
      sessionId: null,
      height: 20,
      onSubmit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Agent ready');
    expect(frame).toContain('Backend');
  });

  it('renders working state with MascotteCompact and log', async () => {
    const { AgentPage } = await import('../pages/AgentPage.ts');
    const lines = [
      { text: '> Add login page', color: 'green', bold: true },
      { text: 'Creating session...', color: 'gray', dim: true },
    ];
    const { lastFrame } = render(h(AgentPage, {
      agentState: 'working',
      lines,
      busy: true,
      connected: true,
      latency: 15,
      sessionId: 'test-1234-5678',
      height: 20,
      onSubmit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Agent working');
    expect(frame).toContain('Creating session');
  });

  it('renders completed/celebrating state', async () => {
    const { AgentPage } = await import('../pages/AgentPage.ts');
    const lines = [
      { text: '> Add login page', color: 'green', bold: true },
      { text: 'Task completed', color: 'green', bold: true },
    ];
    const { lastFrame } = render(h(AgentPage, {
      agentState: 'idle',
      lines,
      busy: false,
      connected: true,
      latency: 15,
      sessionId: 'test-1234-5678',
      height: 20,
      onSubmit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Task completed');
  });

  it('shows system status in idle state', async () => {
    const { AgentPage } = await import('../pages/AgentPage.ts');
    const { lastFrame } = render(h(AgentPage, {
      agentState: 'idle',
      lines: [],
      busy: false,
      connected: false,
      latency: 0,
      sessionId: null,
      height: 20,
      onSubmit: vi.fn(),
    }));
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Backend');
  });
});

// ── deriveVisualState Tests ─────────────────────────────────────

describe('deriveVisualState', () => {
  it('returns "idle" when agent is idle and not busy', async () => {
    const { deriveVisualState } = await import('../pages/AgentPage.ts');
    expect(deriveVisualState('idle', false, [])).toBe('idle');
  });

  it('returns "working" when agent is working', async () => {
    const { deriveVisualState } = await import('../pages/AgentPage.ts');
    expect(deriveVisualState('working', true, [])).toBe('working');
  });

  it('returns "working" when busy even if agent is idle', async () => {
    const { deriveVisualState } = await import('../pages/AgentPage.ts');
    expect(deriveVisualState('idle', true, [])).toBe('working');
  });

  it('returns "celebrating" when last line says task completed', async () => {
    const { deriveVisualState } = await import('../pages/AgentPage.ts');
    const lines = [
      { text: '> Add login page' },
      { text: 'Task completed', color: 'green' },
    ];
    expect(deriveVisualState('idle', false, lines)).toBe('celebrating');
  });
});
