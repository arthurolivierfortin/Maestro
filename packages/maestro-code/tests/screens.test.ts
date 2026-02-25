// @ts-nocheck
/**
 * Tests for Maestro Code screens and navigation.
 * Verifies each screen renders, navigation works, and widgets display correctly.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

function typeText(stdin: any, text: string) {
  for (const ch of text) stdin.write(ch);
}

const ENTER = '\r';
const ESC = '\x1B';
const TAB = '\t';

// ── Screen rendering ────────────────────────────────────────

describe('CatalogBrowser', () => {
  afterEach(() => cleanup());

  it('renders with no API client (shows loading/error)', async () => {
    const { CatalogBrowser } = await import('../screens/CatalogBrowser.ts');
    const { lastFrame } = render(h(CatalogBrowser, {
      apiClient: null,
      onNavigate: vi.fn(),
      onBack: vi.fn(),
      onQuit: vi.fn(),
      height: 20,
    }));
    const frame = stripAnsi(lastFrame() || '');
    // Should render without crashing
    expect(frame.length).toBeGreaterThan(0);
  });

  it('renders with mock API returning blocks', async () => {
    const mockClient = {
      _fetch: vi.fn().mockResolvedValue({
        blocks: [
          { id: 'test-block', name: 'Test Block', blockType: 'tool', version: '1.0.0' },
          { id: 'agent-block', name: 'Agent Block', blockType: 'agent', version: '2.0.0' },
        ],
      }),
    };
    const { CatalogBrowser } = await import('../screens/CatalogBrowser.ts');
    const { lastFrame } = render(h(CatalogBrowser, {
      apiClient: mockClient,
      onNavigate: vi.fn(),
      onBack: vi.fn(),
      onQuit: vi.fn(),
      height: 20,
    }));

    await delay(200); // Wait for async data fetch

    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });
});

describe('SessionBrowser', () => {
  afterEach(() => cleanup());

  it('renders with no API client', async () => {
    const { SessionBrowser } = await import('../screens/SessionBrowser.ts');
    const { lastFrame } = render(h(SessionBrowser, {
      apiClient: null,
      onNavigate: vi.fn(),
      onBack: vi.fn(),
      onQuit: vi.fn(),
      height: 20,
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });
});

describe('ModelsBrowser', () => {
  afterEach(() => cleanup());

  it('renders with no API client', async () => {
    const { ModelsBrowser } = await import('../screens/ModelsBrowser.ts');
    const { lastFrame } = render(h(ModelsBrowser, {
      apiClient: null,
      onBack: vi.fn(),
      onQuit: vi.fn(),
      height: 20,
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });
});

describe('HelpOverlay', () => {
  afterEach(() => cleanup());

  it('renders keyboard shortcuts', async () => {
    const { HelpOverlay } = await import('../screens/HelpOverlay.ts');
    const { lastFrame } = render(h(HelpOverlay, { onClose: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('HELP');
    expect(frame).toContain('Agent');
  });
});

describe('WelcomeScreen', () => {
  afterEach(() => cleanup());

  it('renders welcome with init/skip/help options', async () => {
    const { WelcomeScreen } = await import('../screens/WelcomeScreen.ts');
    const { lastFrame } = render(h(WelcomeScreen, {
      onInit: vi.fn(),
      onSkip: vi.fn(),
      onHelp: vi.fn(),
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Welcome');
  });
});

// ── Widget rendering ────────────────────────────────────────

describe('WidgetRenderer', () => {
  afterEach(() => cleanup());

  it('renders message widget', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = { id: 'w1', type: 'message', content: 'Hello from agent', params: {} };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Hello from agent');
    expect(frame).toContain('Agent');
  });

  it('renders progress widget with phases', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = {
      id: 'w2', type: 'progress', content: 'Working...',
      params: {
        phases: [
          { name: 'Prepare', status: 'completed' },
          { name: 'Plan', status: 'in_progress' },
          { name: 'Implement', status: 'pending' },
        ],
      },
    };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Progress');
    expect(frame).toContain('Prepare');
    expect(frame).toContain('Plan');
    expect(frame).toContain('Implement');
  });

  it('renders confirmation widget', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = {
      id: 'w3', type: 'confirmation', content: 'Delete all files?',
      params: { action: 'delete', consequence: 'irreversible' },
    };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Confirmation');
    expect(frame).toContain('Delete all files?');
    expect(frame).toContain('delete');
    expect(frame).toContain('yes');
  });

  it('renders option-select widget', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = {
      id: 'w4', type: 'option-select', content: 'Choose approach:',
      params: {
        prompt: 'Implementation strategy',
        options: [
          { id: 'a', label: 'Simple', description: 'Quick and dirty' },
          { id: 'b', label: 'Complex', description: 'Full featured' },
        ],
      },
    };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Implementation strategy');
    expect(frame).toContain('Simple');
    expect(frame).toContain('Complex');
  });

  it('renders plan-view widget', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = {
      id: 'w5', type: 'plan-view', content: '',
      params: {
        steps: [
          { description: 'Create file', status: 'done', domain: 'fs' },
          { description: 'Run tests', status: 'in_progress' },
          { description: 'Deploy', status: 'pending' },
        ],
      },
    };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Implementation Plan');
    expect(frame).toContain('Create file');
    expect(frame).toContain('Run tests');
    expect(frame).toContain('Deploy');
  });

  it('renders test-results widget', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = {
      id: 'w6', type: 'test-results', content: '',
      params: {
        suites: [
          { name: 'Unit Tests', passed: 10, failed: 0 },
          { name: 'Integration', passed: 5, failed: 2 },
        ],
      },
    };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Test Results');
    expect(frame).toContain('Unit Tests');
    expect(frame).toContain('10 passed');
    expect(frame).toContain('2 failed');
  });

  it('renders unknown widget type gracefully', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const widget = { id: 'w7', type: 'custom-thing', content: 'Some data', params: {} };
    const { lastFrame } = render(h(WidgetRenderer, { widget, onResponse: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('custom-thing');
    expect(frame).toContain('Some data');
  });

  it('returns null for null widget', async () => {
    const { WidgetRenderer } = await import('../App.ts');
    const { lastFrame } = render(h(WidgetRenderer, { widget: null, onResponse: vi.fn() }));
    const frame = lastFrame() || '';
    // Null widget = empty render
    expect(frame.trim()).toBe('');
  });
});

// ── Navigation integration ──────────────────────────────────

describe('InteractiveApp navigation', () => {
  afterEach(() => cleanup());

  it('starts on agent screen by default', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null }));
    const frame = stripAnsi(lastFrame() || '');
    // Agent screen shows the output panel and input
    expect(frame).toContain('Maestro Interactive Mode');
    expect(frame).toContain('Describe your task...');
  });

  it('starts on welcome screen when isFirstRun', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, {
      sessionManager: null,
      isFirstRun: true,
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Welcome');
  });

  it('navigates to help via /help slash command', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame, stdin } = render(h(InteractiveApp, { sessionManager: null }));

    await delay();
    typeText(stdin, '/help');
    stdin.write(ENTER);
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('HELP');
    expect(frame).toContain('Agent');
  });

  it('navigates to catalog via /c shortcut', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame, stdin } = render(h(InteractiveApp, { sessionManager: null }));

    await delay();
    typeText(stdin, '/c');
    stdin.write(ENTER);
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    // Should be on catalog screen (CATALOG in panel title)
    expect(frame).toContain('CATALOG');
  });

  it('shows SpatialStatusBar with page name', async () => {
    const { InteractiveApp } = await import('../App.ts');
    const { lastFrame } = render(h(InteractiveApp, { sessionManager: null }));
    const frame = stripAnsi(lastFrame() || '');
    // SpatialStatusBar shows the current page name
    expect(frame).toContain('Agent');
  });
});

// ── AgentActivity panel ─────────────────────────────────────

describe('AgentActivity', () => {
  afterEach(() => cleanup());

  it('renders working state', async () => {
    const { AgentActivity } = await import('../panels/AgentActivity.ts');
    const { lastFrame } = render(h(AgentActivity, {
      agentState: 'working',
      taskSummary: 'Creating files...',
      sessionId: 'test-session-id',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });

  it('renders idle state', async () => {
    const { AgentActivity } = await import('../panels/AgentActivity.ts');
    const { lastFrame } = render(h(AgentActivity, {
      agentState: 'idle',
    }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });
});

// ── AgentBadge ──────────────────────────────────────────────

describe('AgentBadge', () => {
  afterEach(() => cleanup());

  it('renders in working state', async () => {
    const { AgentBadge } = await import('../panels/AgentBadge.ts');
    const { lastFrame } = render(h(AgentBadge, { agentState: 'working', busy: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });

  it('renders in idle state', async () => {
    const { AgentBadge } = await import('../panels/AgentBadge.ts');
    const { lastFrame } = render(h(AgentBadge, { agentState: 'idle', busy: false }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame.length).toBeGreaterThan(0);
  });
});
