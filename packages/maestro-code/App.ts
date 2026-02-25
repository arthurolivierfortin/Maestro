// @ts-nocheck
/**
 * Maestro Interactive Mode — Agent-First TUI (Phase 40-PRE-A)
 *
 * Multi-screen navigator with the Agent as home screen.
 * Screens: Agent (home), Catalog, Sessions, Models, Help, Welcome.
 *
 * Navigation:
 * - Agent screen: slash commands (/catalog, /sessions, /models, /help)
 * - Browser screens: letter shortcuts (A/C/S/M/?), Esc=back
 * - Global: Ctrl+C=quit, Ctrl+V=voice, Tab=cycle screens
 */

import { createElement as h, useState, useCallback, useEffect, useRef } from 'react';
import { render, useApp, useStdout, Box, Text, useInput } from 'ink';
import { NavBar, Shortcut } from '@maestro/tui/components';
import { setTerminalBg, resetTerminalBg, palette } from '@maestro/tui/theme';
import { useAnimationTick } from '@maestro/tui/hooks';
import { spinnerFrame, breathingDot } from '@maestro/tui/theme';
import type { PanelId } from './layouts/FlipperLayout.ts';
import { AgentBadge } from './panels/AgentBadge.ts';
import { FlipperLayout } from './layouts/FlipperLayout.ts';
import { CatalogBrowser } from './screens/CatalogBrowser.ts';
import { SessionBrowser } from './screens/SessionBrowser.ts';
import { ModelsBrowser } from './screens/ModelsBrowser.ts';
import { BlockDetailScreen } from './screens/BlockDetailScreen.ts';
import { SessionDetailScreen } from './screens/SessionDetailScreen.ts';
import { ModelDetailScreen } from './screens/ModelDetailScreen.ts';
import { HelpOverlay } from './screens/HelpOverlay.ts';
import { WelcomeScreen } from './screens/WelcomeScreen.ts';
import { SplashScreen } from './screens/SplashScreen.ts';
import { useNavigation } from './hooks/useNavigation.ts';
import { useInputHistory } from './hooks/useInputHistory.ts';
import { CODE_PAGES, screenToPageKey } from './types.ts';
import type { Screen } from './types.ts';

// ── Types ──────────────────────────────────────────────────────

export interface LogLine {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  timestamp?: string;
}

interface InteractiveOptions {
  apiClient?: any;
  repoPath?: string;
  template?: string;
  entryPoint?: string;
  importSessionTemplate?: (sessionId: string, templateName: string) => Promise<void>;
  isFirstRun?: boolean;
  demo?: boolean;
}

interface Widget {
  type: string;
  content: string;
  params: Record<string, any>;
  id: string;
  interactive?: boolean;
  timestamp?: string;
}

// ── Timestamp helper ──────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

// ── Session Manager ───────────────────────────────────────────
// Manages the Maestro session lifecycle outside of React state.

class SessionManager {
  private client: any;
  private repoPath: string;
  private template: string;
  private entryPoint: string;
  private importTemplate: (sessionId: string, templateName: string) => Promise<void>;
  private sessionId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private widgetPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastWidgetId: string | null = null;

  constructor(options: InteractiveOptions) {
    this.client = options.apiClient;
    this.repoPath = options.repoPath || process.cwd();
    this.template = options.template || 'project-autonomous';
    this.entryPoint = options.entryPoint || 'dev';
    this.importTemplate = options.importSessionTemplate || (async () => {});
  }

  async submitTask(
    task: string,
    addLine: (line: LogLine) => void,
    setBusy: (b: boolean) => void
  ): Promise<void> {
    setBusy(true);

    try {
      // 1. Create session
      addLine({ text: 'Creating session...', color: 'gray', dim: true, timestamp: ts() });
      const path = require('path');
      const session = await this.client.createSession({
        repositoryPath: this.repoPath,
        authority: 'human',
        name: `${path.basename(this.repoPath)} - ${task.slice(0, 60)}`,
      });
      this.sessionId = session.id;
      addLine({ text: `Session: ${session.id.slice(0, 8)}`, color: 'gray', timestamp: ts() });

      // 2. Import template
      addLine({ text: `Importing template: ${this.template}`, color: 'gray', dim: true, timestamp: ts() });
      await this.importTemplate(this.sessionId, this.template);

      // 3. Start session
      await this.client.startSession(this.sessionId);
      addLine({ text: 'Session started', color: 'gray', timestamp: ts() });

      // 4. Invoke entry point
      const inputs: Record<string, string> = { repoPath: this.repoPath, task };
      addLine({ text: `Invoking: ${this.entryPoint}`, color: 'cyan', bold: true, timestamp: ts() });
      await this.client._fetch('POST', `/api/sessions/${this.sessionId}/invoke/${this.entryPoint}`, {
        body: { inputs }
      });

      // 5. Start polling for completion
      this.startPolling(addLine, setBusy);

    } catch (err: any) {
      addLine({ text: `Error: ${err.message || err}`, color: 'red', bold: true, timestamp: ts() });
      addLine({ text: '' });
      setBusy(false);
    }
  }

  private startPolling(addLine: (line: LogLine) => void, setBusy: (b: boolean) => void) {
    // Completion-only polling. Execution tree, log entries, and LLM activity
    // are displayed by FlipperLayout's context panels (WorkflowTree, ExecutionLog,
    // LLMActivity) which poll session data independently via useApiData.
    this.pollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};
        const tree: any[] = vars._executionTree || [];

        // Check if workflow is done
        const status = session.status || session.containerStatus;
        const allDone = tree.length > 0 && tree.every(n => n.status === 'completed' || n.status === 'done' || n.status === 'error' || n.status === 'skipped');
        if (allDone || status === 'completed' || status === 'idle') {
          this.stopPolling();
          const hasErrors = tree.some(n => n.status === 'error');
          if (hasErrors) {
            addLine({ text: 'Task completed with errors', color: 'red', bold: true, timestamp: ts() });
          } else if (tree.length > 0) {
            addLine({ text: 'Task completed', color: 'green', bold: true, timestamp: ts() });
          }
          addLine({ text: '' });
          setBusy(false);
        }
      } catch (err: any) {
        // Poll errors are non-fatal — session may still be running
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.stopWidgetPolling();
  }

  async sendMessage(message: string, addLine: (line: LogLine) => void): Promise<void> {
    if (!this.sessionId) return;

    try {
      await this.client._fetch('PUT',
        `/api/sessions/${this.sessionId}/variables/_userMessage`,
        { body: { value: { text: message, time: new Date().toISOString() } } }
      );
      addLine({ text: `> ${message}`, color: 'green', bold: true, timestamp: ts() });
    } catch (err: any) {
      addLine({ text: `Error sending message: ${err.message}`, color: 'red', timestamp: ts() });
    }
  }

  startWidgetPolling(
    addLine: (line: LogLine) => void,
    setWidget: (w: Widget | null) => void,
    setPendingInteractive: (w: Widget | null) => void
  ): void {
    this.widgetPollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};
        const widgetReq = vars._widgetRequest;

        if (widgetReq && widgetReq.widget && widgetReq.widget.id !== this.lastWidgetId) {
          this.lastWidgetId = widgetReq.widget.id;
          const widget = widgetReq.widget as Widget;
          setWidget(widget);

          if (!widget.interactive) {
            addLine({
              text: `[${widget.type}] ${widget.content}`,
              color: 'blue',
              timestamp: widget.timestamp || ts(),
            });
          } else {
            setPendingInteractive(widget);
          }
        }
      } catch {
        // Non-fatal
      }
    }, 500);
  }

  async sendWidgetResponse(
    response: string,
    widgetId: string,
    addLine: (line: LogLine) => void
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      await this.client._fetch('PUT',
        `/api/sessions/${this.sessionId}/variables/_widgetResponse`,
        { body: { value: { response, widgetId } } }
      );
      addLine({ text: `  Response: ${response}`, color: 'cyan', timestamp: ts() });
    } catch (err: any) {
      addLine({ text: `Error sending response: ${err.message}`, color: 'red', timestamp: ts() });
    }
  }

  stopWidgetPolling(): void {
    if (this.widgetPollTimer) {
      clearInterval(this.widgetPollTimer);
      this.widgetPollTimer = null;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// ── OutputPanel (exported for tests — FlipperLayout uses its own copy) ──

const OutputPanel = ({ lines, height }: { lines: LogLine[]; height: number }) => {
  const maxLines = Math.max(height - 2, 1);
  const visible = lines.slice(-maxLines);

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: 'gray',
    paddingX: 1,
    height,
    overflow: 'hidden',
  },
    ...visible.map((line, i) =>
      h(Box, { key: i },
        line.timestamp
          ? h(Text, { color: 'gray', dimColor: true }, `${line.timestamp} `)
          : null,
        h(Text, {
          color: (line.color || 'white') as any,
          bold: line.bold,
          dimColor: line.dim,
        }, line.text)
      )
    ),
    visible.length === 0
      ? h(Text, { color: 'gray', dimColor: true }, 'Waiting for input...')
      : null
  );
};

// ── RichStatusBar ─────────────────────────────────────────────
// Connection status, latency, session, focused panel, context-aware shortcuts.

const RichStatusBar = ({
  sessionId,
  busy,
  voiceActive,
  connected,
  latency,
  focusedPanel,
  zoomedPanel,
  screenType,
}: {
  sessionId: string | null;
  busy: boolean;
  voiceActive?: boolean;
  connected: boolean | null;
  latency: number;
  focusedPanel: PanelId | null;
  zoomedPanel: PanelId | null;
  screenType: string;
}) => {
  const tick = useAnimationTick(120);

  // Connection indicator
  const connStatus = connected === null ? 'connecting' : connected ? 'connected' : 'error';
  const connColor = connStatus === 'connected' ? 'green' : connStatus === 'error' ? 'red' : 'yellow';
  const connIcon = connStatus === 'connecting'
    ? spinnerFrame(tick)
    : connStatus === 'connected'
      ? breathingDot(tick)
      : '✗';

  const sessionLabel = sessionId ? `session:${sessionId.slice(0, 8)}` : '';
  const latencyLabel = latency > 0 ? `${latency}ms` : '';

  // Context-aware shortcuts
  const shortcuts = [];

  if (zoomedPanel) {
    // Zoomed mode
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'unzoom' }));
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '↑↓', label: 'scroll' }));
    if (zoomedPanel === 'tree') {
      shortcuts.push(h(Shortcut, { key: 'sc-lr', k: '←→', label: 'expand' }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'Ctrl+C', label: 'quit' }));
  } else if (screenType === 'agent' && focusedPanel && focusedPanel !== 'hero') {
    // Agent screen, context panel focused
    shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'next' }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'input' }));
    shortcuts.push(h(Shortcut, { key: 'sc-z', k: 'z', label: 'zoom' }));
    if (focusedPanel === 'tree') {
      shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '↑↓←→', label: 'tree' }));
    } else {
      shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '↑↓', label: 'scroll' }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help' }));
  } else if (screenType === 'agent') {
    // Agent screen, hero focused (or idle)
    if (sessionId) {
      shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'panels' }));
      shortcuts.push(h(Shortcut, { key: 'sc-d', k: 'Ctrl+D', label: 'session' }));
    }
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help' }));
    shortcuts.push(h(Shortcut, { key: 'sc-q', k: 'Ctrl+C', label: 'quit' }));
  } else {
    // Browser screens
    shortcuts.push(h(Shortcut, { key: 'sc-tab', k: 'Tab', label: 'screen' }));
    shortcuts.push(h(Shortcut, { key: 'sc-arrows', k: '↑↓', label: 'nav' }));
    shortcuts.push(h(Shortcut, { key: 'sc-enter', k: 'Enter', label: 'open' }));
    shortcuts.push(h(Shortcut, { key: 'sc-esc', k: 'Esc', label: 'back' }));
    shortcuts.push(h(Shortcut, { key: 'sc-?', k: '?', label: 'help' }));
  }

  // Focus/zoom indicator
  const focusInfo = zoomedPanel
    ? h(Text, { color: 'yellow', bold: true }, `▣ ${zoomedPanel.toUpperCase()}`)
    : focusedPanel && focusedPanel !== 'hero'
      ? h(Text, { color: 'cyan' }, `◈ ${focusedPanel.toUpperCase()}`)
      : null;

  return h(Box, {
    paddingX: 1,
    height: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    // Left: connection + latency + session + voice
    h(Box, { flexDirection: 'row' },
      h(Text, { color: connColor }, connIcon),
      h(Text, null, ' '),
      h(Text, { color: 'gray', dimColor: true }, connStatus),
      latencyLabel ? h(Text, { color: 'gray', dimColor: true }, `  ${latencyLabel}`) : null,
      sessionLabel ? h(Text, { color: 'gray', dimColor: true }, `  ${sessionLabel}`) : null,
      voiceActive ? h(Text, { color: 'magenta', bold: true }, '  VOICE') : null,
    ),

    // Center: focus/zoom info
    focusInfo,

    // Right: shortcuts
    h(Box, { flexDirection: 'row' },
      ...shortcuts.map((sc, i) =>
        i < shortcuts.length - 1
          ? h(Box, { key: `sc-wrap-${i}`, flexDirection: 'row' }, sc, h(Text, null, ' '))
          : sc
      ),
    ),
  );
};

// ── WidgetRenderer ──────────────────────────────────────────────

const WidgetRenderer = ({ widget, onResponse }: { widget: Widget | null; onResponse: (response: string) => void }) => {
  if (!widget) return null;

  switch (widget.type) {
    case 'message':
      return h(Box, { borderStyle: 'round', borderColor: 'blue', paddingX: 1, marginY: 1 },
        h(Text, { color: 'blue', bold: true }, 'Agent: '),
        h(Text, null, widget.content)
      );

    case 'progress':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'cyan',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'cyan', bold: true }, 'Progress'),
        h(Text, null, widget.content),
        ...(widget.params.phases || []).map((phase: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: phase.status === 'completed' ? 'green'
                : phase.status === 'in_progress' ? 'yellow'
                : 'gray',
            },
              phase.status === 'completed' ? '  [done] '
                : phase.status === 'in_progress' ? '  [>>]   '
                : '  [  ]   '
            ),
            h(Text, null, `${phase.name}${phase.detail ? ` — ${phase.detail}` : ''}`)
          )
        )
      );

    case 'confirmation':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'yellow',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'yellow', bold: true }, 'Confirmation required'),
        h(Text, null, widget.content),
        h(Text, { color: 'gray', dimColor: true },
          `Action: ${widget.params.action || 'N/A'}`
        ),
        h(Text, { color: 'gray', dimColor: true },
          `Consequence: ${widget.params.consequence || 'N/A'}`
        ),
        h(Text, { color: 'cyan' }, 'Type "yes" or "no" to respond.')
      );

    case 'option-select':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'magenta',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'magenta', bold: true }, widget.params.prompt || 'Choose:'),
        h(Text, null, widget.content),
        ...(widget.params.options || []).map((opt: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: 'cyan' }, `  [${opt.id}] `),
            h(Text, null, opt.label),
            opt.description
              ? h(Text, { color: 'gray', dimColor: true }, ` — ${opt.description}`)
              : null
          )
        ),
        h(Text, { color: 'cyan' }, 'Type the option ID to select.')
      );

    case 'plan-view':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'green',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'green', bold: true }, 'Implementation Plan'),
        ...(widget.params.steps || []).map((step: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: step.status === 'done' ? 'green'
                : step.status === 'in_progress' ? 'yellow'
                : 'gray',
            },
              step.status === 'done' ? '  [done] '
                : step.status === 'in_progress' ? '  [>>]   '
                : '  [  ]   '
            ),
            h(Text, null, step.description),
            step.domain
              ? h(Text, { color: 'gray', dimColor: true }, ` (${step.domain})`)
              : null
          )
        )
      );

    case 'test-results':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'green',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'green', bold: true }, 'Test Results'),
        ...(widget.params.suites || []).map((suite: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: suite.failed > 0 ? 'red' : 'green',
            }, `  ${suite.name}: `),
            h(Text, { color: 'green' }, `${suite.passed} passed`),
            suite.failed > 0
              ? h(Text, { color: 'red' }, ` / ${suite.failed} failed`)
              : null
          )
        )
      );

    default:
      return h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 1, marginY: 1 },
        h(Text, { color: 'gray' }, `[${widget.type}] ${widget.content}`)
      );
  }
};

// ── InputPrompt (exported for tests — FlipperLayout uses its own copy) ──

const InputPrompt = ({ onSubmit, disabled, placeholder, onUpArrow, onDownArrow }: {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUpArrow?: () => string | null;
  onDownArrow?: () => string | null;
}) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const valueRef = useRef('');
  const cursorRef = useRef(0);

  useInput((input, key) => {
    if (disabled) return;

    let v = valueRef.current;
    let c = cursorRef.current;

    if (key.return) {
      if (v.trim()) {
        onSubmit(v.trim());
        v = '';
        c = 0;
      }
    } else if (key.upArrow && onUpArrow) {
      const hist = onUpArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.downArrow && onDownArrow) {
      const hist = onDownArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.backspace || key.delete) {
      if (c > 0) {
        v = v.slice(0, c - 1) + v.slice(c);
        c = c - 1;
      }
    } else if (key.leftArrow) {
      c = Math.max(0, c - 1);
    } else if (key.rightArrow) {
      c = Math.min(v.length, c + 1);
    } else if (input === 'a' && key.ctrl) {
      c = 0;
    } else if (input === 'e' && key.ctrl) {
      c = v.length;
    } else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
      v = v.slice(0, c) + input + v.slice(c);
      c = c + input.length;
    }

    valueRef.current = v;
    cursorRef.current = c;
    setValue(v);
    setCursor(c);
  });

  const prompt = disabled ? '...' : '>';
  const promptColor = disabled ? 'gray' : 'green';

  return h(Box, {
    borderStyle: 'round',
    borderColor: disabled ? 'gray' : 'cyan',
    paddingX: 1,
    flexShrink: 0,
  },
    h(Text, { color: promptColor, bold: true }, `${prompt} `),
    h(Text, null,
      value || h(Text, { color: 'gray', dimColor: true }, placeholder || 'Describe your task...')
    )
  );
};

// ── Slash commands → navigation targets ───────────────────────

const SLASH_COMMANDS: Record<string, Screen | 'session-current'> = {
  '/catalog': { type: 'catalog' },
  '/c': { type: 'catalog' },
  '/sessions': { type: 'sessions' },
  '/s': { type: 'sessions' },
  '/models': { type: 'models' },
  '/m': { type: 'models' },
  '/help': { type: 'help' },
  '/?': { type: 'help' },
  '/agent': { type: 'agent' },
  '/a': { type: 'agent' },
  '/home': { type: 'agent' },
  '/session': 'session-current',
};

// ── Tab cycle order ───────────────────────────────────────────

const SCREEN_CYCLE: Screen[] = [
  { type: 'agent' },
  { type: 'catalog' },
  { type: 'sessions' },
  { type: 'models' },
];

// ── NoBackendScreen ─────────────────────────────────────────────
// Shown when backend is not available and --demo was NOT passed.

const NoBackendScreen = () => {
  const { exit } = useApp();
  useInput((input, key) => {
    if ((input === 'c' && key.ctrl) || input === 'q') exit();
  });

  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    padding: 2,
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: 'red',
      padding: 1,
      width: 60,
    },
      h(Text, { color: 'red', bold: true }, 'Backend Not Available'),
      h(Box, { height: 1 }),
      h(Text, null, 'Maestro backend is not running. The interactive mode'),
      h(Text, null, 'requires the backend to create sessions and execute tasks.'),
      h(Box, { height: 1 }),
      h(Text, { color: 'cyan', bold: true }, 'To start the backend:'),
      h(Text, { color: 'gray' }, '  powershell -File dev-scripts/dev-start.ps1'),
      h(Box, { height: 1 }),
      h(Text, { color: 'cyan', bold: true }, 'To run in demo mode (UI preview):'),
      h(Text, { color: 'gray' }, '  maestro code --demo'),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, 'Press q or Ctrl+C to quit.'),
    ),
  );
};

// ── Root App ───────────────────────────────────────────────────

const InteractiveApp = ({ sessionManager, apiClient, isFirstRun, repoPath, demoMode }: {
  sessionManager: SessionManager | null;
  apiClient?: any;
  isFirstRun?: boolean;
  repoPath?: string;
  demoMode?: boolean;
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);

  // ── Navigation ──
  const nav = useNavigation(isFirstRun ? 'welcome' : 'agent');
  const history = useInputHistory();

  // ── Agent conversation state ──
  const [lines, setLines] = useState<LogLine[]>([
    { text: demoMode ? 'Maestro Interactive Mode [DEMO]' : 'Maestro Interactive Mode', color: 'cyan', bold: true },
    { text: 'Type a task and press Enter. Ctrl+C to quit. Ctrl+V to toggle voice mode.', color: 'gray', dim: true },
    ...(demoMode ? [{ text: 'Demo mode — no real execution. Use for UI preview only.', color: 'yellow', dim: true }] : []),
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [latency, setLatency] = useState(0);
  const [activePanelFocus, setActivePanelFocus] = useState<PanelId | null>(null);
  const [activeZoom, setActiveZoom] = useState<PanelId | null>(null);

  // ── Resize + cleanup ──
  useEffect(() => {
    const onResize = () => {
      if (stdout.rows) setRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
      if (sessionManager) {
        sessionManager.stopPolling();
        sessionManager.stopWidgetPolling();
      }
    };
  }, [stdout, sessionManager]);

  // ── Health check (startup + periodic) ──
  useEffect(() => {
    if (!apiClient) { setConnected(false); return; }
    const check = async () => {
      const t0 = Date.now();
      try {
        await apiClient._fetch('GET', '/api/health');
        setLatency(Date.now() - t0);
        setConnected(true);
      } catch {
        setConnected(false);
        setLatency(0);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [apiClient]);

  // ── Global keyboard ──
  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      if (sessionManager) sessionManager.stopPolling();
      exit();
    }
    if (input === 'v' && key.ctrl) {
      setVoiceMode(v => !v);
    }
    // Ctrl+D: jump to session detail
    if (input === 'd' && key.ctrl && currentSessionId) {
      nav.navigate({ type: 'session-detail', id: currentSessionId });
      return;
    }
    // Tab: cycle screens (only when NOT on agent screen — FlipperLayout handles Tab there)
    if (key.tab && nav.userScreen.type !== 'agent') {
      const currentType = nav.userScreen.type;
      const currentIdx = SCREEN_CYCLE.findIndex(s => s.type === currentType);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % SCREEN_CYCLE.length : 0;
      nav.navigate(SCREEN_CYCLE[nextIdx]);
    }
    // Non-agent screens: letter shortcuts for navigation
    if (nav.userScreen.type !== 'agent') {
      const lower = (input || '').toLowerCase();
      if (lower === 'a') nav.navigate({ type: 'agent' });
      else if (lower === 'c' && !key.ctrl) nav.navigate({ type: 'catalog' });
      else if (lower === 's') nav.navigate({ type: 'sessions' });
      else if (lower === 'm') nav.navigate({ type: 'models' });
      else if (input === '?') nav.navigate({ type: 'help' });
    }
  });

  // ── Add line (FIFO 500) ──
  const MAX_LINES = 500;
  const addLine = useCallback((line: LogLine) => {
    setLines(prev => {
      const next = [...prev, line];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  // ── Init project (.maestro/) from WelcomeScreen ──
  const handleInit = useCallback(() => {
    const initPath = repoPath || process.cwd();
    const maestroDir = require('path').join(initPath, '.maestro');
    const fs = require('fs');
    try {
      const dirs = ['blocks', 'docs', 'logs', 'artifacts', 'metrics', 'sandboxes'];
      fs.mkdirSync(maestroDir, { recursive: true });
      dirs.forEach((d: string) => fs.mkdirSync(require('path').join(maestroDir, d), { recursive: true }));
      const config = { template: 'project-autonomous', model: 'auto', stack: 'unknown' };
      fs.writeFileSync(require('path').join(maestroDir, 'config.json'), JSON.stringify(config, null, 2));
      fs.writeFileSync(require('path').join(maestroDir, 'aliases.json'), JSON.stringify({}, null, 2));
      fs.writeFileSync(require('path').join(maestroDir, 'README.md'), '# Maestro Project\n\nInitialized by `maestro code`.\n');
      addLine({ text: `Initialized .maestro/ in ${initPath}`, color: 'green', bold: true });
    } catch (err: any) {
      addLine({ text: `Failed to initialize: ${err.message}`, color: 'red' });
    }
    nav.navigate({ type: 'agent' });
  }, [repoPath, nav, addLine]);

  // ── Handle submit ──
  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();

    // Slash commands → navigation
    const slashTarget = SLASH_COMMANDS[trimmed];
    if (slashTarget === 'session-current') {
      if (currentSessionId) {
        nav.navigate({ type: 'session-detail', id: currentSessionId });
      } else {
        addLine({ text: 'No active session. Start a task first.', color: 'yellow' });
      }
      return;
    }
    if (slashTarget) {
      nav.navigate(slashTarget as Screen);
      return;
    }
    if (trimmed === '/back') { nav.goBack(); return; }
    if (trimmed === '/join' || trimmed === '/j') { nav.joinAgent(); return; }
    if (trimmed === '/quit' || trimmed === '/q') {
      if (sessionManager) sessionManager.stopPolling();
      exit();
      return;
    }

    // Push to input history
    history.push(input);

    // Branch 1: User responding to an interactive widget
    if (pendingInteractive) {
      addLine({ text: `> ${input}`, color: 'green' });
      if (sessionManager) {
        sessionManager.sendWidgetResponse(input, pendingInteractive.id, addLine);
      }
      setPendingInteractive(null);
      setCurrentWidget(null);
      return;
    }

    // Branch 2: Session running — send as user message
    if (busy && sessionManager?.getSessionId()) {
      sessionManager.sendMessage(input, addLine);
      return;
    }

    // Branch 3: First message — create session (existing behavior)
    addLine({ text: `> ${input}`, color: 'green', bold: true });

    if (sessionManager) {
      sessionManager.submitTask(input, addLine, (b) => {
        setBusy(b);
        if (!b) {
          setCurrentSessionId(null);
          sessionManager.stopWidgetPolling();
          nav.setAgentState('idle');
        } else {
          setCurrentSessionId(sessionManager.getSessionId());
          sessionManager.startWidgetPolling(addLine, setCurrentWidget, setPendingInteractive);
          nav.setAgentState('working');
        }
      });
    } else if (demoMode) {
      // Demo mode (--demo flag) — mock execution for UI preview
      setBusy(true);
      nav.setAgentState('working');
      addLine({ text: '[DEMO] Processing...', color: 'gray', dim: true, timestamp: ts() });
      setTimeout(() => {
        addLine({ text: '[DEMO] Done (no real execution)', color: 'yellow', timestamp: ts() });
        addLine({ text: '' });
        setBusy(false);
        nav.setAgentState('idle');
      }, 1000);
    }
  }, [addLine, sessionManager, busy, pendingInteractive, nav, history, exit]);

  // ── Layout ──
  const currentPage = screenToPageKey(nav.userScreen);
  const contentHeight = Math.max(rows - 4, 5);

  return h(Box, { flexDirection: 'column', width: '100%', height: rows },
    // NavBar
    h(NavBar, {
      pages: CODE_PAGES,
      currentPage,
      title: demoMode ? 'MAESTRO [DEMO]' : 'MAESTRO',
      badge: h(AgentBadge, { agentState: nav.agentState, busy }),
    }),

    // Screen content (varies by current screen)
    renderScreen(nav.userScreen, contentHeight),

    // StatusBar (always visible)
    h(RichStatusBar, {
      sessionId: currentSessionId,
      busy,
      voiceActive: voiceMode,
      connected,
      latency,
      focusedPanel: activePanelFocus,
      zoomedPanel: activeZoom,
      screenType: nav.userScreen.type,
    }),
  );

  function renderScreen(screen: Screen, contentHeight: number) {
    switch (screen.type) {
      case 'agent':
        return renderAgentContent();
      case 'catalog':
        return h(CatalogBrowser, {
          apiClient, onNavigate: nav.navigate,
          onBack: nav.goBack, onQuit: () => exit(),
          height: contentHeight,
        });
      case 'sessions':
        return h(SessionBrowser, {
          apiClient, onNavigate: nav.navigate,
          onBack: nav.goBack, onQuit: () => exit(),
          height: contentHeight,
        });
      case 'models':
        return h(ModelsBrowser, {
          apiClient, onNavigate: nav.navigate,
          onBack: nav.goBack, onQuit: () => exit(),
          height: contentHeight,
        });
      case 'block-detail':
        return h(BlockDetailScreen, {
          blockId: screen.id,
          apiClient, onNavigate: nav.navigate,
          onBack: nav.goBack, onQuit: () => exit(),
          height: contentHeight,
        });
      case 'session-detail':
        return h(SessionDetailScreen, {
          sessionId: screen.id,
          apiClient, onNavigate: nav.navigate,
          onBack: nav.goBack, onQuit: () => exit(),
          height: contentHeight,
        });
      case 'model-detail':
        return h(ModelDetailScreen, {
          modelId: screen.id,
          apiClient,
          onBack: nav.goBack, onQuit: () => exit(),
          height: contentHeight,
        });
      case 'help':
        return h(HelpOverlay, { onClose: nav.goBack });
      case 'welcome':
        return h(WelcomeScreen, {
          onInit: handleInit,
          onSkip: () => nav.navigate({ type: 'agent' }),
          onHelp: () => nav.navigate({ type: 'help' }),
        });
      default:
        return renderAgentContent();
    }
  }

  function renderAgentContent() {
    return h(FlipperLayout, {
      sessionId: currentSessionId,
      apiClient,
      lines,
      busy,
      agentState: nav.agentState,
      agentIsHere: nav.agentIsHere,
      taskSummary: busy ? 'Working...' : undefined,
      currentWidget,
      pendingInteractive,
      voiceMode,
      onSubmit: handleSubmit,
      onUpArrow: history.prev,
      onDownArrow: history.next,
      widgetRenderer: WidgetRenderer,
      height: contentHeight,
      onPanelFocus: setActivePanelFocus,
      onZoom: setActiveZoom,
    });
  }
};

// ── Root wrapper (splash → main app transition) ──────────────

const RootApp = ({ sessionManager, apiClient, noSplash, isFirstRun, repoPath, demoMode }: {
  sessionManager: SessionManager | null;
  apiClient?: any;
  noSplash?: boolean;
  isFirstRun?: boolean;
  repoPath?: string;
  demoMode?: boolean;
}) => {
  const [showSplash, setShowSplash] = useState(!noSplash);

  if (showSplash) {
    return h(SplashScreen, { onDone: () => setShowSplash(false) });
  }

  // No API client and no --demo flag → show error screen
  if (!apiClient && !demoMode) {
    return h(NoBackendScreen);
  }

  return h(InteractiveApp, { sessionManager, apiClient, isFirstRun, repoPath, demoMode });
};

// ── Public entry point ─────────────────────────────────────────

async function startInteractive(options: InteractiveOptions = {}): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error('Interactive mode requires a terminal (TTY).');
    process.exit(1);
  }

  // Apply terminal background color
  setTerminalBg(palette.bg);

  // Create session manager if API client is provided
  const sessionManager = options.apiClient ? new SessionManager(options) : null;
  const noSplash = (options as any).noSplash || false;
  const isFirstRun = (options as any).isFirstRun || false;
  const demoMode = (options as any).demo || false;

  const instance = render(
    h(RootApp, { sessionManager, apiClient: options.apiClient, noSplash, isFirstRun, repoPath: options.repoPath, demoMode }),
    { exitOnCtrlC: true }
  );

  await instance.waitUntilExit();

  // Reset terminal background on exit
  resetTerminalBg();
}

export { startInteractive, InteractiveApp, OutputPanel, InputPrompt, RichStatusBar, SessionManager, WidgetRenderer };
export type { LogLine as InteractiveLogLine, InteractiveOptions, Widget };
