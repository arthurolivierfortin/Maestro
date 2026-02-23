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
import { NavBar } from '@maestro/tui/components';
import { AgentActivity } from './panels/AgentActivity.ts';
import { CatalogBrowser } from './screens/CatalogBrowser.ts';
import { SessionBrowser } from './screens/SessionBrowser.ts';
import { ModelsBrowser } from './screens/ModelsBrowser.ts';
import { HelpOverlay } from './screens/HelpOverlay.ts';
import { WelcomeScreen } from './screens/WelcomeScreen.ts';
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
  private lastLogCount = 0;
  private lastTreeHash = '';
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

      // 5. Start polling for updates
      this.lastLogCount = 0;
      this.lastTreeHash = '';
      this.startPolling(addLine, setBusy);

    } catch (err: any) {
      addLine({ text: `Error: ${err.message || err}`, color: 'red', bold: true, timestamp: ts() });
      addLine({ text: '' });
      setBusy(false);
    }
  }

  private startPolling(addLine: (line: LogLine) => void, setBusy: (b: boolean) => void) {
    this.pollTimer = setInterval(async () => {
      try {
        const session = await this.client.getSession(this.sessionId);
        const vars = session.variables || {};

        // Check execution log for new entries
        const log: any[] = vars._executionLog || [];
        if (log.length > this.lastLogCount) {
          const newEntries = log.slice(this.lastLogCount);
          for (const entry of newEntries) {
            const level = entry.level || 'info';
            const color = level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'white';
            addLine({ text: entry.msg || entry.message || JSON.stringify(entry), color, timestamp: entry.time || ts() });
          }
          this.lastLogCount = log.length;
        }

        // Check execution tree for status changes
        const tree: any[] = vars._executionTree || [];
        const treeHash = JSON.stringify(tree.map(n => `${n.name}:${n.status}`));
        if (treeHash !== this.lastTreeHash) {
          this.lastTreeHash = treeHash;
          // Show node status updates
          for (const node of tree) {
            if (node.status === 'running') {
              addLine({ text: `  ▶ ${node.name}`, color: 'cyan', timestamp: ts() });
            } else if (node.status === 'completed') {
              addLine({ text: `  ✓ ${node.name}`, color: 'green', timestamp: ts() });
            } else if (node.status === 'error') {
              addLine({ text: `  ✗ ${node.name}: ${node.error || 'failed'}`, color: 'red', timestamp: ts() });
            }
          }
        }

        // Check if workflow is done
        const status = session.status || session.containerStatus;
        const allDone = tree.length > 0 && tree.every(n => n.status === 'completed' || n.status === 'error' || n.status === 'skipped');
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

// ── OutputPanel ────────────────────────────────────────────────

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

// ── StatusBar ─────────────────────────────────────────────────

const StatusBar = ({ sessionId, busy, voiceActive }: { sessionId: string | null; busy: boolean; voiceActive?: boolean }) => {
  const sessionLabel = sessionId ? `Session: ${sessionId.slice(0, 8)}` : 'No session';
  const statusLabel = busy ? 'Running...' : 'Ready';
  const statusColor = busy ? 'yellow' : 'green';

  return h(Box, { paddingX: 1, justifyContent: 'space-between' },
    h(Box, null,
      h(Text, { color: 'gray', dimColor: true }, sessionLabel),
      voiceActive ? h(Text, { color: 'magenta', bold: true }, ' VOICE') : null
    ),
    h(Text, { color: statusColor, dimColor: !busy }, statusLabel)
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

// ── InputPrompt ────────────────────────────────────────────────

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

const SLASH_COMMANDS: Record<string, Screen> = {
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
};

// ── Tab cycle order ───────────────────────────────────────────

const SCREEN_CYCLE: Screen[] = [
  { type: 'agent' },
  { type: 'catalog' },
  { type: 'sessions' },
  { type: 'models' },
];

// ── Root App ───────────────────────────────────────────────────

const InteractiveApp = ({ sessionManager, apiClient }: {
  sessionManager: SessionManager | null;
  apiClient?: any;
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);

  // ── Navigation ──
  const nav = useNavigation();
  const history = useInputHistory();

  // ── Agent conversation state ──
  const [lines, setLines] = useState<LogLine[]>([
    { text: 'Maestro Interactive Mode', color: 'cyan', bold: true },
    { text: 'Type a task and press Enter. Ctrl+C to quit. Ctrl+V to toggle voice mode.', color: 'gray', dim: true },
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);

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

  // ── Global keyboard ──
  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      if (sessionManager) sessionManager.stopPolling();
      exit();
    }
    if (input === 'v' && key.ctrl) {
      setVoiceMode(v => !v);
    }
    // Tab: cycle screens
    if (key.tab) {
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

  // ── Handle submit ──
  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();

    // Slash commands → navigation
    const slashTarget = SLASH_COMMANDS[trimmed];
    if (slashTarget) {
      nav.navigate(slashTarget);
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
    } else {
      // Demo mode (no API client)
      setBusy(true);
      nav.setAgentState('working');
      addLine({ text: 'Processing... (demo mode — no API)', color: 'gray', dim: true, timestamp: ts() });
      setTimeout(() => {
        addLine({ text: 'Done (no real execution in demo mode)', color: 'yellow', timestamp: ts() });
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
      title: 'MAESTRO',
    }),

    // Screen content (varies by current screen)
    nav.userScreen.type === 'agent'
      ? renderAgentContent()
      : nav.userScreen.type === 'catalog'
        ? h(CatalogBrowser, {
            apiClient, onNavigate: nav.navigate,
            onBack: nav.goBack, onQuit: () => exit(),
            height: contentHeight,
          })
        : nav.userScreen.type === 'sessions'
          ? h(SessionBrowser, {
              apiClient, onNavigate: nav.navigate,
              onBack: nav.goBack, onQuit: () => exit(),
              height: contentHeight,
            })
          : nav.userScreen.type === 'models'
            ? h(ModelsBrowser, {
                apiClient,
                onBack: nav.goBack, onQuit: () => exit(),
                height: contentHeight,
              })
            : nav.userScreen.type === 'help'
              ? h(HelpOverlay, { onClose: nav.goBack })
              : nav.userScreen.type === 'welcome'
                ? h(WelcomeScreen, {
                    onInit: () => nav.navigate({ type: 'agent' }),
                    onSkip: () => nav.navigate({ type: 'agent' }),
                    onHelp: () => nav.navigate({ type: 'help' }),
                  })
                : renderAgentContent(),

    // StatusBar (always visible)
    h(StatusBar, { sessionId: currentSessionId, busy, voiceActive: voiceMode }),
  );

  function renderAgentContent() {
    const outputHeight = Math.max(contentHeight - 5 - (currentWidget ? 8 : 0), 3);

    return h(Box, { flexDirection: 'column', flexGrow: 1 },
      // Agent activity overlay (when agent is here and active)
      nav.agentIsHere && nav.agentState !== 'idle'
        ? h(AgentActivity, {
            agentState: nav.agentState,
            taskSummary: busy ? 'Working...' : undefined,
            sessionId: currentSessionId,
          })
        : null,

      // Output
      h(OutputPanel, { lines, height: outputHeight }),

      // Widget
      currentWidget ? h(WidgetRenderer, { widget: currentWidget, onResponse: () => {} }) : null,

      // Input
      h(InputPrompt, {
        onSubmit: handleSubmit,
        disabled: false,
        placeholder: pendingInteractive
          ? 'Respond to the widget above...'
          : voiceMode
            ? 'Listening...'
            : busy
              ? 'Send a message to the agent...'
              : 'Describe your task...',
        onUpArrow: history.prev,
        onDownArrow: history.next,
      }),
    );
  }
};

// ── Public entry point ─────────────────────────────────────────

async function startInteractive(options: InteractiveOptions = {}): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error('Interactive mode requires a terminal (TTY).');
    process.exit(1);
  }

  // Create session manager if API client is provided
  const sessionManager = options.apiClient ? new SessionManager(options) : null;

  const instance = render(
    h(InteractiveApp, { sessionManager, apiClient: options.apiClient }),
    { exitOnCtrlC: true }
  );

  await instance.waitUntilExit();
}

export { startInteractive, InteractiveApp, OutputPanel, InputPrompt, StatusBar, SessionManager, WidgetRenderer };
export type { LogLine as InteractiveLogLine, InteractiveOptions, Widget };
