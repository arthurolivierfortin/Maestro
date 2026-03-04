/**
 * Tests for Maestro Code — Phase 42 architecture (Monitor + AgentPanel).
 * Uses ink-testing-library to render Ink components without a TTY.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

// Strip ANSI escape codes for text assertions
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// Wait for React effects to flush (useEffect runs async after render)
const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// Send text character by character (Ink's useInput processes one keypress per read)
function typeText(stdin: any, text: string) {
  for (const ch of text) {
    stdin.write(ch);
  }
}

// Ink key sequences
const ENTER = '\r';
const BACKSPACE = '\x7F';

// ── ConversationLog Tests ─────────────────────────────────────

describe('ConversationLog', () => {
  afterEach(() => cleanup());

  it('shows "Waiting for input..." when no lines', async () => {
    const { ConversationLog } = await import('../App.ts');
    const { lastFrame } = render(h(ConversationLog, { lines: [], height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Waiting for input...');
  });

  it('renders log lines', async () => {
    const { ConversationLog } = await import('../App.ts');
    const lines = [
      { text: 'Hello world' },
      { text: 'Second line', color: 'green' },
    ];
    const { lastFrame } = render(h(ConversationLog, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Hello world');
    expect(frame).toContain('Second line');
  });

  it('renders timestamps when present', async () => {
    const { ConversationLog } = await import('../App.ts');
    const lines = [
      { text: 'Log entry', timestamp: '12:34:56' },
    ];
    const { lastFrame } = render(h(ConversationLog, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('12:34:56');
    expect(frame).toContain('Log entry');
  });

  it('scrolls — only shows last N lines that fit', async () => {
    const { ConversationLog } = await import('../App.ts');
    // height=5, border takes 2 lines → maxLines = 3
    const lines = Array.from({ length: 10 }, (_, i) => ({ text: `Line ${i}` }));
    const { lastFrame } = render(h(ConversationLog, { lines, height: 5 }));
    const frame = stripAnsi(lastFrame() || '');
    // Should show last 3 lines (maxLines = height - 2 = 3)
    expect(frame).toContain('Line 9');
    expect(frame).toContain('Line 8');
    expect(frame).toContain('Line 7');
    expect(frame).not.toContain('Line 0');
  });
});

// ── TaskInputBar Tests ──────────────────────────────────────────

describe('TaskInputBar', () => {
  afterEach(() => cleanup());

  it('shows "Press / to type..." when unfocused', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(TaskInputBar, { onSubmit }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Press / to type...');
  });

  it('shows placeholder when focused', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(TaskInputBar, { onSubmit, captureInput: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('shows custom placeholder when focused', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(TaskInputBar, { onSubmit, placeholder: 'Custom...', captureInput: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Custom...');
  });

  it('shows ">" prompt when focused', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(TaskInputBar, { onSubmit, captureInput: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('>');
  });

  it('shows "..." prompt when disabled', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(TaskInputBar, { onSubmit, disabled: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('...');
  });

  it('accepts typed characters when focused', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit, captureInput: true }));

    await delay();
    typeText(stdin, 'hello');
    await delay();

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hello');
  });

  it('calls onSubmit on Enter and clears input', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit, captureInput: true }));

    await delay();
    typeText(stdin, 'my task');
    await delay();
    stdin.write(ENTER);
    await delay();

    expect(onSubmit).toHaveBeenCalledWith('my task');

    // Input should be cleared — placeholder should be back
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('does not submit empty input on Enter', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { stdin } = render(h(TaskInputBar, { onSubmit, captureInput: true }));

    await delay();
    stdin.write(ENTER);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores input when disabled', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit, disabled: true, captureInput: true }));

    await delay();
    typeText(stdin, 'hello');
    stdin.write(ENTER);

    expect(onSubmit).not.toHaveBeenCalled();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).not.toContain('hello');
  });

  it('handles backspace', async () => {
    const { TaskInputBar } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit, captureInput: true }));

    await delay();
    typeText(stdin, 'hello');
    stdin.write(BACKSPACE);
    await delay();

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hell');
    expect(frame).not.toContain('hello');
  });
});

// ── App Tests ───────────────────────────────────────────────────

describe('App', () => {
  afterEach(() => cleanup());

  it('renders agent page with TaskInputBar', async () => {
    const { App } = await import('../App.ts');
    const { lastFrame } = render(h(App, {
      apiClient: null, sessionManager: null, demoMode: true,
    }));

    await delay(500);
    const frame = stripAnsi(lastFrame() || '');
    // TaskInputBar visible — demo mode auto-starts task so it shows busy state
    expect(frame).toContain('Agent is working...');
  });

  it('shows TaskInputBar with / prompt (unfocused)', async () => {
    const { App } = await import('../App.ts');
    const { lastFrame } = render(h(App, {
      apiClient: null, sessionManager: null, demoMode: true,
    }));

    await delay(200);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('/');
  });

  it('in demo mode, auto-starts task and stays on agent page', async () => {
    const { App } = await import('../App.ts');
    const { lastFrame } = render(h(App, {
      apiClient: null, sessionManager: null, demoMode: true,
    }));

    // Demo mode auto-submits "Add login page" — stays on Agent page (no auto-navigate)
    await delay(1000);

    const frame = stripAnsi(lastFrame() || '');
    // Agent page with CONVERSATION panel
    expect(frame).toContain('CONVERSATION');
    // Agent status shows working state
    expect(frame).toContain('AGENT STATUS');
    // TaskInputBar visible at bottom — busy state during demo auto-task
    expect(frame).toContain('Agent is working...');
  });
});

// SessionManager tests moved to tests/SessionManager.test.ts (Phase 46-B)
