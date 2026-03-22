/**
 * Tests for Phase 63-C: Chat-first mode migration.
 *
 * Verifies:
 * 1. Slash commands inject correct widget types
 * 2. Unknown commands show error
 * 3. --classic flag renders classic layout
 * 4. Chat-first mode omits NavBar and page hotkeys
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { FocusProvider } from '../hooks/useFocusProvider.ts';
import type { ChatWidget, WidgetType } from '../types/widgets.ts';
import type { LogLine } from '../services/SessionManager.ts';

// -- Helpers ---------------------------------------------------------------

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// -- Mock API client -------------------------------------------------------

const createMockApiClient = () => ({
  getHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  getLLMHealth: vi.fn().mockResolvedValue({ activeModel: 'claude-sonnet-4-6' }),
  listSessions: vi.fn().mockResolvedValue([
    { id: 'session-1234-5678', name: 'Test Session', status: 'running', variables: {} },
  ]),
  listBlocks: vi.fn().mockResolvedValue([
    { id: 'block-1', name: 'test-block', blockType: 'agent', fitness: 0.75 },
  ]),
  listLLMModels: vi.fn().mockResolvedValue([
    { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet', category: 'anthropic', isAvailable: true },
  ]),
  getLLMStats: vi.fn().mockResolvedValue({ totalRequests: 100, totalTokens: 50000 }),
  listProjects: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue([]),
  getBlock: vi.fn().mockResolvedValue({ id: 'block-1', name: 'test-block', blockType: 'agent' }),
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'test-repo', rootPath: '/tmp/test' }),
  getLLMQueueStats: vi.fn().mockResolvedValue(null),
  getCostsSummary: vi.fn().mockResolvedValue({ today: { totalCost: 0 } }),
  getCostsLimits: vi.fn().mockResolvedValue({}),
  setCostsLimits: vi.fn().mockResolvedValue({}),
  getSession: vi.fn().mockResolvedValue({}),
});

// -- Slash command integration tests using App component -------------------

describe('Chat-first slash commands', () => {
  afterEach(() => cleanup());

  it('/status injects StatusWidget into conversation', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(App as any, { apiClient, sessionManager: null, demoMode: false, hasProviders: true }),
      ),
    );
    await delay(100);

    // In chat-first mode, input is always active — type command directly
    for (const c of '/status') stdin.write(c);
    stdin.write('\r');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('System Status');
  });

  it('/spaces injects SessionsWidget into conversation', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(App as any, { apiClient, sessionManager: null, demoMode: false, hasProviders: true }),
      ),
    );
    await delay(100);

    // In chat-first mode, input is always active — type command directly
    for (const c of '/spaces') stdin.write(c);
    stdin.write('\r');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Sessions');
  });

  it('/catalog agents injects CatalogWidget with filter', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(App as any, { apiClient, sessionManager: null, demoMode: false, hasProviders: true }),
      ),
    );
    await delay(100);

    // In chat-first mode, input is always active — type command directly
    for (const c of '/catalog agents') stdin.write(c);
    stdin.write('\r');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Catalog');
  });

  it('/models injects ModelsWidget', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(App as any, { apiClient, sessionManager: null, demoMode: false, hasProviders: true }),
      ),
    );
    await delay(100);

    // In chat-first mode, input is always active — type command directly
    for (const c of '/models') stdin.write(c);
    stdin.write('\r');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Models');
  });

  it('unknown command /xyz shows error message', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(App as any, { apiClient, sessionManager: null, demoMode: false, hasProviders: true }),
      ),
    );
    await delay(100);

    // In chat-first mode, input is always active — type command directly
    for (const c of '/xyz') stdin.write(c);
    stdin.write('\r');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Unknown command');
    expect(frame).toContain('/help');
  });
});

// -- Chat-first vs classic mode tests ------------------------------------

describe('Chat-first mode layout', () => {
  afterEach(() => cleanup());

  it('default mode does NOT render NavBar', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(App as any, { apiClient, sessionManager: null, demoMode: false, hasProviders: true }),
      ),
    );
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    // NavBar renders MAESTRO title bar with page tab hotkeys (H/A/S/F/C/M)
    // In chat-first mode, these should NOT appear
    // Check for ACTIONS panel (which only appears in classic AgentScreen)
    expect(frame).not.toContain('ACTIONS');
    // But should have agent status and conversation
    expect(frame).toContain('AGENT STATUS');
    expect(frame).toContain('CONVERSATION');
  });

  it('default mode renders ChatFirstScreen with full-width conversation', async () => {
    const { ChatFirstScreen } = await import('../components/ChatFirstScreen.ts');
    const lines: LogLine[] = [
      { text: 'Hello world' },
      { text: 'Test message' },
    ];
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(ChatFirstScreen, {
          apiClient: createMockApiClient(),
          onQuit: () => {},
          lines,
          agentState: 'idle',
          sessionId: null,
          busy: false,
        }),
      ),
    );
    await delay(50);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('CONVERSATION');
    expect(frame).toContain('AGENT STATUS');
    // Should NOT contain ACTIONS panel (that's in the old AgentScreen)
    expect(frame).not.toContain('ACTIONS');
  });

  it('--classic flag renders NavBar and page layout', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(App as any, {
          apiClient,
          sessionManager: null,
          demoMode: false,
          hasProviders: true,
          classic: true,
        }),
      ),
    );
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    // Classic mode should render AgentScreen which has the ACTIONS panel
    expect(frame).toContain('ACTIONS');
  });
});

// -- HelpOverlay mode tests ------------------------------------------------

describe('HelpOverlay modes', () => {
  afterEach(() => cleanup());

  it('chat-first mode shows Slash Commands and Widget Shortcuts sections', async () => {
    const { HelpOverlay } = await import('../components/HelpOverlay.ts');
    const { lastFrame } = render(
      h(HelpOverlay, { classic: false }),
    );
    await delay(50);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Slash Commands');
    expect(frame).toContain('Widget Shortcuts');
    expect(frame).toContain('Navigation Commands');
    // Should NOT contain page navigation section
    expect(frame).not.toContain('Page Navigation');
  });

  it('classic mode shows Page Navigation section', async () => {
    const { HelpOverlay } = await import('../components/HelpOverlay.ts');
    const { lastFrame } = render(
      h(HelpOverlay, { classic: true, currentPage: 'agent' }),
    );
    await delay(50);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Page Navigation');
    // Should NOT contain Widget Shortcuts (that's chat-first only)
    expect(frame).not.toContain('Widget Shortcuts');
  });
});

// -- ChatStatusBar tests ---------------------------------------------------

describe('ChatStatusBar', () => {
  afterEach(() => cleanup());

  it('shows session count badge when sessions exist', async () => {
    const { ChatStatusBar } = await import('../components/ChatStatusBar.ts');
    const apiClient = createMockApiClient();
    const { lastFrame } = render(
      h(ChatStatusBar, {
        connectionStatus: 'connected',
        latency: 15,
        lastRefresh: new Date(),
        apiClient,
      }),
    );
    // Wait for session count polling
    await delay(200);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('1 session');
  });

  it('shows default shortcuts when no widget is focused', async () => {
    const { ChatStatusBar } = await import('../components/ChatStatusBar.ts');
    const { lastFrame } = render(
      h(ChatStatusBar, {
        connectionStatus: 'connected',
        focusedWidgetId: null,
      }),
    );
    await delay(50);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('/help');
    expect(frame).toContain('commands');
    expect(frame).toContain('quit');
  });

  it('shows widget shortcuts when a widget is focused', async () => {
    const { ChatStatusBar } = await import('../components/ChatStatusBar.ts');
    const { lastFrame } = render(
      h(ChatStatusBar, {
        connectionStatus: 'connected',
        focusedWidgetId: 'w-1-12345',
      }),
    );
    await delay(50);

    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Esc');
    expect(frame).toContain('close');
    expect(frame).toContain('j/k');
    expect(frame).toContain('nav');
  });
});

// -- Hotkey suppression tests ----------------------------------------------

describe('Hotkey suppression in chat-first mode', () => {
  afterEach(() => cleanup());

  it('h/a/s/f/c/m hotkeys do NOT navigate pages in chat-first mode', async () => {
    const { App } = await import('../App.ts');
    const apiClient = createMockApiClient();
    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(App as any, {
          apiClient,
          sessionManager: null,
          demoMode: false,
          hasProviders: true,
          classic: false,
        }),
      ),
    );
    await delay(100);

    // Press 's' (would navigate to Spaces in classic mode)
    stdin.write('s');
    await delay(100);

    const frame = stripAnsi(lastFrame() || '');
    // Should still show chat-first layout (AGENT STATUS), not Spaces page
    expect(frame).toContain('AGENT STATUS');
    // Should NOT show SpacesScreen content like "REPOS" tab header
    expect(frame).not.toContain('REPOS');
  });
});

// -- Widget injection from agent responses ---------------------------------

describe('Agent widget injection via [widget:TYPE] markers', () => {
  it('parseWidgetMarker detects [widget:models] pattern', async () => {
    const { parseWidgetMarker } = await import('../services/SessionManager.ts');

    const result = parseWidgetMarker('Here are the available models: [widget:models]');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('models');
    expect(result!.props).toEqual({});
    expect(result!.cleanLine).toBe('Here are the available models:');
  });

  it('parseWidgetMarker detects [widget:catalog:initialFilter=agent] with props', async () => {
    const { parseWidgetMarker } = await import('../services/SessionManager.ts');

    const result = parseWidgetMarker('[widget:catalog:initialFilter=agent]');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('catalog');
    expect(result!.props).toEqual({ initialFilter: 'agent' });
    expect(result!.cleanLine).toBe('');
  });

  it('parseWidgetMarker returns null for lines without markers', async () => {
    const { parseWidgetMarker } = await import('../services/SessionManager.ts');

    expect(parseWidgetMarker('Just a normal line of text')).toBeNull();
    expect(parseWidgetMarker('')).toBeNull();
    expect(parseWidgetMarker('No widgets here [bold]')).toBeNull();
  });

  it('parseWidgetMarker handles multi-prop markers', async () => {
    const { parseWidgetMarker } = await import('../services/SessionManager.ts');

    const result = parseWidgetMarker('[widget:session-monitor:sessionId=abc-123,tab=logs]');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('session-monitor');
    expect(result!.props).toEqual({ sessionId: 'abc-123', tab: 'logs' });
  });

  it('addWidget is called when agent response contains [widget:TYPE]', async () => {
    // Simulate the widget injection flow: agent output -> parseWidgetMarker -> addWidget
    const { parseWidgetMarker } = await import('../services/SessionManager.ts');

    const agentOutput = 'Here are your models:\n[widget:models]\nAnything else?';
    const outputLines = agentOutput.split('\n');

    const injectedWidgets: { type: string; props: Record<string, any> }[] = [];
    const addedLines: string[] = [];

    const mockAddWidget = (type: string, props: Record<string, any>) => {
      injectedWidgets.push({ type, props });
      return `w-mock-${injectedWidgets.length}`;
    };
    const mockAddLine = (line: { text: string }) => {
      addedLines.push(line.text);
    };

    for (const line of outputLines) {
      const marker = parseWidgetMarker(line);
      if (marker && mockAddWidget) {
        mockAddWidget(marker.type, marker.props);
        if (marker.cleanLine) {
          mockAddLine({ text: `  ${marker.cleanLine}` });
        }
      } else {
        mockAddLine({ text: `  ${line}` });
      }
    }

    expect(injectedWidgets).toHaveLength(1);
    expect(injectedWidgets[0].type).toBe('models');
    expect(addedLines).toEqual([
      '  Here are your models:',
      '  Anything else?',
    ]);
  });
});
