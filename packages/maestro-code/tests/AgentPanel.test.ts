/**
 * Tests for AgentPanel component (Phase 42).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

describe('AgentPanel', () => {
  afterEach(() => cleanup());

  it('shows idle state badge when idle', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const { lastFrame } = render(h(AgentPanel, {
      lines: [],
      agentState: 'idle',
      sessionId: null,
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('idle');
    expect(frame).toContain('○');
  });

  it('shows working state badge', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const { lastFrame } = render(h(AgentPanel, {
      lines: [{ text: 'Creating session...' }],
      agentState: 'working',
      sessionId: 'abcdef12-3456-7890-abcd-ef1234567890',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('working');
    expect(frame).toContain('●');
    expect(frame).toContain('abcdef12');
  });

  it('shows completed state badge', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const { lastFrame } = render(h(AgentPanel, {
      lines: [{ text: 'Task completed', color: 'green' }],
      agentState: 'completed',
      sessionId: 'abcdef12-3456-7890-abcd-ef1234567890',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('completed');
    expect(frame).toContain('✓');
  });

  it('shows error state badge', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const { lastFrame } = render(h(AgentPanel, {
      lines: [{ text: 'Error: Connection refused', color: 'red' }],
      agentState: 'error',
      sessionId: null,
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('error');
    expect(frame).toContain('✗');
  });

  it('renders conversation log lines', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const lines = [
      { text: '> Add login page', color: 'green', bold: true },
      { text: 'Creating session...', timestamp: '13:02:02' },
      { text: 'Session started', color: 'cyan' },
    ];
    const { lastFrame } = render(h(AgentPanel, {
      lines,
      agentState: 'working',
      sessionId: 'abcdef12-3456',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Add login page');
    expect(frame).toContain('Creating session...');
    expect(frame).toContain('Session started');
  });

  it('shows short session ID (first 8 chars)', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const { lastFrame } = render(h(AgentPanel, {
      lines: [],
      agentState: 'idle',
      sessionId: 'deadbeef-1234-5678-9abc-def012345678',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('session:deadbeef');
    expect(frame).not.toContain('def012345678');
  });

  it('hides session ID when null', async () => {
    const { AgentPanel } = await import('../components/AgentPanel.ts');
    const { lastFrame } = render(h(AgentPanel, {
      lines: [],
      agentState: 'idle',
      sessionId: null,
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).not.toContain('session:');
  });
});
