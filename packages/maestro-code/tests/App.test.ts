// @ts-nocheck
/**
 * Tests for Maestro Interactive Mode components.
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

// ── OutputPanel Tests ─────────────────────────────────────────

describe('OutputPanel', () => {
  afterEach(() => cleanup());

  it('shows "Waiting for input..." when no lines', async () => {
    const { OutputPanel } = await import('../App.ts');
    const { lastFrame } = render(h(OutputPanel, { lines: [], height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Waiting for input...');
  });

  it('renders log lines', async () => {
    const { OutputPanel } = await import('../App.ts');
    const lines = [
      { text: 'Hello world' },
      { text: 'Second line', color: 'green' },
    ];
    const { lastFrame } = render(h(OutputPanel, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Hello world');
    expect(frame).toContain('Second line');
  });

  it('renders timestamps when present', async () => {
    const { OutputPanel } = await import('../App.ts');
    const lines = [
      { text: 'Log entry', timestamp: '12:34:56' },
    ];
    const { lastFrame } = render(h(OutputPanel, { lines, height: 10 }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('12:34:56');
    expect(frame).toContain('Log entry');
  });

  it('scrolls — only shows last N lines that fit', async () => {
    const { OutputPanel } = await import('../App.ts');
    // height=5, border takes 2 lines → maxLines = 3
    const lines = Array.from({ length: 10 }, (_, i) => ({ text: `Line ${i}` }));
    const { lastFrame } = render(h(OutputPanel, { lines, height: 5 }));
    const frame = stripAnsi(lastFrame() || '');
    // Should show last 3 lines (maxLines = height - 2 = 3)
    expect(frame).toContain('Line 9');
    expect(frame).toContain('Line 8');
    expect(frame).toContain('Line 7');
    expect(frame).not.toContain('Line 0');
  });
});

// ── RichStatusBar Tests ───────────────────────────────────────

describe('RichStatusBar', () => {
  afterEach(() => cleanup());

  it('shows connection status and help shortcut when idle', async () => {
    const { RichStatusBar } = await import('../App.ts');
    const { lastFrame } = render(h(RichStatusBar, {
      sessionId: null, busy: false,
      connected: true, latency: 0,
      focusedPanel: null, zoomedPanel: null,
      screenType: 'agent',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('connected');
    expect(frame).toContain('?');
  });

  it('shows short session ID when present', async () => {
    const { RichStatusBar } = await import('../App.ts');
    const { lastFrame } = render(h(RichStatusBar, {
      sessionId: 'abcdef12-3456-7890-abcd-ef1234567890',
      busy: false,
      connected: true, latency: 42,
      focusedPanel: null, zoomedPanel: null,
      screenType: 'agent',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('abcdef12');
    expect(frame).toContain('42ms');
  });

  it('shows panel focus indicator when a panel is focused', async () => {
    const { RichStatusBar } = await import('../App.ts');
    const { lastFrame } = render(h(RichStatusBar, {
      sessionId: 'abcdef12-3456-7890-abcd-ef1234567890',
      busy: true,
      connected: true, latency: 10,
      focusedPanel: 'tree', zoomedPanel: null,
      screenType: 'agent',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('TREE');
    expect(frame).toContain('zoom');
  });
});

// ── InputPrompt Tests ─────────────────────────────────────────

describe('InputPrompt', () => {
  afterEach(() => cleanup());

  it('shows placeholder when empty', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(InputPrompt, { onSubmit }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('shows custom placeholder', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(InputPrompt, { onSubmit, placeholder: 'Custom...' }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Custom...');
  });

  it('shows ">" prompt when not disabled', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(InputPrompt, { onSubmit }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('>');
  });

  it('shows "..." prompt when disabled', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame } = render(h(InputPrompt, { onSubmit, disabled: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('...');
  });

  it('accepts typed characters', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(InputPrompt, { onSubmit }));

    await delay(); // Wait for useEffect to register stdin listener
    typeText(stdin, 'hello');
    await delay(); // Wait for React to re-render with new state

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hello');
  });

  it('calls onSubmit on Enter and clears input', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(InputPrompt, { onSubmit }));

    await delay();
    typeText(stdin, 'my task');
    await delay(); // Let React flush state updates from typing
    stdin.write(ENTER);
    await delay();

    expect(onSubmit).toHaveBeenCalledWith('my task');

    // Input should be cleared — placeholder should be back
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('does not submit empty input on Enter', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { stdin } = render(h(InputPrompt, { onSubmit }));

    await delay();
    stdin.write(ENTER);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores input when disabled', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(InputPrompt, { onSubmit, disabled: true }));

    await delay();
    typeText(stdin, 'hello');
    stdin.write(ENTER);

    expect(onSubmit).not.toHaveBeenCalled();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).not.toContain('hello');
  });

  it('handles backspace', async () => {
    const { InputPrompt } = await import('../App.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(InputPrompt, { onSubmit }));

    await delay();
    typeText(stdin, 'hello');
    stdin.write(BACKSPACE);
    await delay();

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hell');
    expect(frame).not.toContain('hello');
  });
});

// ── InteractiveApp Tests ──────────────────────────────────────

describe('InteractiveApp', () => {
  afterEach(() => cleanup());

  it('renders welcome message', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Maestro Interactive Mode');
    expect(frame).toContain('Type a task and press Enter');
  });

  it('shows input prompt', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('shows rich status bar with connection status and shortcuts', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null }));
    const frame = stripAnsi(lastFrame() || '');
    // StatusBar shows connection status + help shortcut
    expect(frame).toContain('connecting');
    expect(frame).toContain('?');
  });

  it('echoes submitted task in output', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame, stdin } = render(h(InteractiveApp, { sessionManager: null }));

    await delay();
    typeText(stdin, 'Add login page');
    stdin.write(ENTER);
    await delay();

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('> Add login page');
  });

  it('in demo mode, auto-starts and shows cockpit layout', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null, demoMode: true }));

    // Demo mode auto-starts a mock session — wait for cockpit to render
    await delay(1000);

    const frame = stripAnsi(lastFrame() || '');
    // NavBar shows DEMO marker
    expect(frame).toContain('DEMO');
    // StatusBar shows active session
    expect(frame).toContain('session:demo-');
    // Cockpit panels should be visible (FlipperLayout active mode)
    expect(frame).toContain('LOG');
    expect(frame).toContain('LLM');
  });
});

// ── SessionManager Tests ──────────────────────────────────────

describe('SessionManager', () => {
  let mockClient: any;
  let mockImportTemplate: any;

  beforeEach(() => {
    mockClient = {
      createSession: vi.fn().mockResolvedValue({ id: 'sess-1234-5678-abcd-ef0123456789' }),
      startSession: vi.fn().mockResolvedValue({}),
      getSession: vi.fn().mockResolvedValue({
        status: 'idle',
        variables: { _executionTree: [], _executionLog: [] },
      }),
      _fetch: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    mockImportTemplate = vi.fn().mockResolvedValue(undefined);
  });

  it('creates session, imports template, starts, and invokes', async () => {
    const { SessionManager } = await import('../App.ts');
    const sm = new SessionManager({
      apiClient: mockClient,
      repoPath: '/test/project',
      template: 'project-autonomous',
      entryPoint: 'dev',
      importSessionTemplate: mockImportTemplate,
    });

    const addLine = vi.fn();
    const setBusy = vi.fn();

    await sm.submitTask('Add README', addLine, setBusy);

    // Should have called createSession
    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryPath: '/test/project',
        authority: 'human',
      })
    );

    // Should have imported template
    expect(mockImportTemplate).toHaveBeenCalledWith('sess-1234-5678-abcd-ef0123456789', 'project-autonomous');

    // Should have started session
    expect(mockClient.startSession).toHaveBeenCalledWith('sess-1234-5678-abcd-ef0123456789');

    // Should have invoked entry point
    expect(mockClient._fetch).toHaveBeenCalledWith(
      'POST',
      '/api/sessions/sess-1234-5678-abcd-ef0123456789/invoke/dev',
      expect.objectContaining({
        body: { inputs: { repoPath: '/test/project', task: 'Add README' } },
      })
    );

    // Should have set busy
    expect(setBusy).toHaveBeenCalledWith(true);

    // Should have added progress lines
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ text: 'Creating session...' }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Session:') }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ text: 'Session started' }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ text: 'Invoking: dev' }));

    // Cleanup polling
    sm.stopPolling();
  });

  it('handles API error gracefully', async () => {
    const { SessionManager } = await import('../App.ts');
    mockClient.createSession.mockRejectedValue(new Error('Connection refused'));

    const sm = new SessionManager({
      apiClient: mockClient,
      repoPath: '/test/project',
      importSessionTemplate: mockImportTemplate,
    });

    const addLine = vi.fn();
    const setBusy = vi.fn();

    await sm.submitTask('fail task', addLine, setBusy);

    // Should show error
    expect(addLine).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Error: Connection refused', color: 'red' })
    );

    // Should release busy state
    expect(setBusy).toHaveBeenCalledWith(false);
  });

  it('detects workflow completion via polling', async () => {
    vi.useFakeTimers();
    const { SessionManager } = await import('../App.ts');

    // First poll: running (no addLine — FlipperLayout handles display)
    // Second poll: completed → completion detected
    let pollCount = 0;
    mockClient.getSession.mockImplementation(async () => {
      pollCount++;
      if (pollCount === 1) {
        return {
          status: 'running',
          variables: {
            _executionTree: [{ name: 'Plan', status: 'running' }],
            _executionLog: [{ msg: 'Planning started', level: 'info', time: '10:00:00' }],
          },
        };
      }
      return {
        status: 'idle',
        variables: {
          _executionTree: [{ name: 'Plan', status: 'completed' }],
          _executionLog: [
            { msg: 'Planning started', level: 'info', time: '10:00:00' },
            { msg: 'Plan done', level: 'info', time: '10:00:05' },
          ],
        },
      };
    });

    const sm = new SessionManager({
      apiClient: mockClient,
      repoPath: '/test/project',
      importSessionTemplate: mockImportTemplate,
    });

    const addLine = vi.fn();
    const setBusy = vi.fn();

    await sm.submitTask('plan task', addLine, setBusy);

    // First poll (2s) — running, no completion yet
    await vi.advanceTimersByTimeAsync(2100);

    // Second poll — should detect completion
    await vi.advanceTimersByTimeAsync(2100);

    expect(addLine).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Task completed', color: 'green' })
    );
    expect(setBusy).toHaveBeenCalledWith(false);

    vi.useRealTimers();
  });

  it('stores session ID', async () => {
    const { SessionManager } = await import('../App.ts');
    const sm = new SessionManager({
      apiClient: mockClient,
      repoPath: '/test/project',
      importSessionTemplate: mockImportTemplate,
    });

    expect(sm.getSessionId()).toBeNull();

    await sm.submitTask('test', vi.fn(), vi.fn());
    expect(sm.getSessionId()).toBe('sess-1234-5678-abcd-ef0123456789');

    sm.stopPolling();
  });
});
