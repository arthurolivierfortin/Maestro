// @ts-nocheck
/**
 * Maestro Code — Interactive TUI (Phase 42)
 *
 * Architecture: Monitor + AgentPanel.
 * Uses the same page/detail routing as maestro-monitor (Home, Spaces, Foundry,
 * Catalog, Models + SessionMonitor detail view), but adds:
 * - TaskInputBar for task submission
 * - AgentPanel inside SessionMonitor (conversation log, agent state)
 * - SessionManager for automatic session lifecycle
 * - Demo mode (--demo flag)
 *
 * Navigation: same as monitor — h/s/f/c/m page hotkeys, Tab for panels,
 * Esc to go back, q to quit.
 */

import { createElement as h, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { render, useApp, useStdout, Box, Text, useInput } from 'ink';
import { setTerminalBg, resetTerminalBg, palette } from '@maestro/tui/theme';
import type { PageName } from './theme.ts';

import { SessionMonitor } from './components/SessionMonitor.ts';
import { HomeScreen } from './components/HomeScreen.ts';
import { SpacesScreen } from './components/SpacesScreen.ts';
import { FoundryScreen } from './components/FoundryScreen.ts';
import { CatalogScreen } from './components/CatalogScreen.ts';
import { ModelsScreen } from './components/ModelsScreen.ts';
import { WorkspaceDetail } from './components/WorkspaceDetail.ts';
import { RepoDetail } from './components/RepoDetail.ts';
import { ModelDetail } from './components/ModelDetail.ts';
import { BlockDetail } from './components/BlockDetail.ts';
import { TaskInputBar } from './components/TaskInputBar.ts';
import { ConversationLog } from './components/ConversationLog.ts';
import { AgentScreen } from './components/AgentScreen.ts';
import { StatusBar } from './components/StatusBar.ts';

import type { IApiClient } from '@maestro/tui/types';

import { DemoApiClient } from './mocks/DemoApiClient.ts';
import { SessionManager, ts } from './services/SessionManager.ts';
import type { LogLine, InteractiveOptions, Widget } from './services/SessionManager.ts';
import { useInputHistory } from './hooks/useInputHistory.ts';

// ── FullscreenBox ──────────────────────────────────────────────

const FullscreenBox = ({ children }: { children: any }) => {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);

  useEffect(() => {
    const onResize = () => {
      if (stdout.rows) setRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  return h(Box, { flexDirection: 'column', width: '100%', height: rows }, children);
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
      return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingX: 1, marginY: 1 },
        h(Text, { color: 'cyan', bold: true }, 'Progress'),
        h(Text, null, widget.content),
        ...(widget.params.phases || []).map((phase: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: phase.status === 'completed' ? 'green' : phase.status === 'in_progress' ? 'yellow' : 'gray' },
              phase.status === 'completed' ? '  [done] ' : phase.status === 'in_progress' ? '  [>>]   ' : '  [  ]   '
            ),
            h(Text, null, `${phase.name}${phase.detail ? ` — ${phase.detail}` : ''}`)
          )
        )
      );
    case 'confirmation':
      return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', paddingX: 1, marginY: 1 },
        h(Text, { color: 'yellow', bold: true }, 'Confirmation required'),
        h(Text, null, widget.content),
        h(Text, { color: 'gray', dimColor: true }, `Action: ${widget.params.action || 'N/A'}`),
        h(Text, { color: 'gray', dimColor: true }, `Consequence: ${widget.params.consequence || 'N/A'}`),
        h(Text, { color: 'cyan' }, 'Type "yes" or "no" to respond.')
      );
    case 'option-select':
      return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'magenta', paddingX: 1, marginY: 1 },
        h(Text, { color: 'magenta', bold: true }, widget.params.prompt || 'Choose:'),
        h(Text, null, widget.content),
        ...(widget.params.options || []).map((opt: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: 'cyan' }, `  [${opt.id}] `),
            h(Text, null, opt.label),
            opt.description ? h(Text, { color: 'gray', dimColor: true }, ` — ${opt.description}`) : null
          )
        ),
        h(Text, { color: 'cyan' }, 'Type the option ID to select.')
      );
    case 'plan-view':
      return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'green', paddingX: 1, marginY: 1 },
        h(Text, { color: 'green', bold: true }, 'Implementation Plan'),
        ...(widget.params.steps || []).map((step: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: step.status === 'done' ? 'green' : step.status === 'in_progress' ? 'yellow' : 'gray' },
              step.status === 'done' ? '  [done] ' : step.status === 'in_progress' ? '  [>>]   ' : '  [  ]   '
            ),
            h(Text, null, step.description),
            step.domain ? h(Text, { color: 'gray', dimColor: true }, ` (${step.domain})`) : null
          )
        )
      );
    case 'test-results':
      return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'green', paddingX: 1, marginY: 1 },
        h(Text, { color: 'green', bold: true }, 'Test Results'),
        ...(widget.params.suites || []).map((suite: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: suite.failed > 0 ? 'red' : 'green' }, `  ${suite.name}: `),
            h(Text, { color: 'green' }, `${suite.passed} passed`),
            suite.failed > 0 ? h(Text, { color: 'red' }, ` / ${suite.failed} failed`) : null
          )
        )
      );
    default:
      return h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 1, marginY: 1 },
        h(Text, { color: 'gray' }, `[${widget.type}] ${widget.content}`)
      );
  }
};

// ── NoBackendScreen ─────────────────────────────────────────────

const NoBackendScreen = () => {
  const { exit } = useApp();
  useInput((input, key) => {
    if ((input === 'c' && key.ctrl) || input === 'q') exit();
  });

  return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'red', padding: 1, width: 60 },
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

// ── Types ──────────────────────────────────────────────────────

interface DetailView {
  type: 'session' | 'workspace' | 'repo' | 'model' | 'block';
  id: string;
}

interface NavStackEntry extends DetailView {
  state?: any;
}

interface PageNavEntry {
  type: 'page';
  page: PageName;
  state?: any;
}

// ── Root App Component ─────────────────────────────────────────

const App = ({ apiClient: clientProp, sessionManager: smProp, demoMode, repoPath, noBell }: {
  apiClient: IApiClient | null;
  sessionManager: SessionManager | null;
  demoMode?: boolean;
  repoPath?: string;
  noBell?: boolean;
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // ── Demo mode setup ──
  const [demoSetup] = useState(() => {
    if (demoMode) {
      const client = new DemoApiClient();
      return { client, sm: new SessionManager({ apiClient: client }) };
    }
    return null;
  });
  const sessionManager = demoMode ? (demoSetup?.sm || null) : (smProp || null);
  const apiClient = demoMode ? (demoSetup?.client || null) : clientProp;

  // ── Connection status polling ──
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>(
    demoMode ? 'connected' : 'connecting'
  );
  const [connLatency, setConnLatency] = useState(demoMode ? 12 : 0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(demoMode ? new Date() : null);
  useEffect(() => {
    if (demoMode || !apiClient) return;
    const check = async () => {
      const start = Date.now();
      try {
        await apiClient.getHealth();
        setConnLatency(Date.now() - start);
        setLastRefresh(new Date());
        setConnectionStatus('connected');
      } catch {
        setConnectionStatus('error');
      }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [demoMode, apiClient]);

  // ── Monitor-style navigation (from monitor App.ts) ──
  const [navStack, setNavStack] = useState<(NavStackEntry | PageNavEntry)[]>([]);
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [currentPage, setCurrentPage] = useState<PageName>('agent');
  const [restoredState, setRestoredState] = useState<any>(null);

  const detailViewRef = useRef(detailView);
  const currentPageRef = useRef(currentPage);
  const navStackRef = useRef(navStack);
  detailViewRef.current = detailView;
  currentPageRef.current = currentPage;
  navStackRef.current = navStack;

  // ── Agent state ──
  const [lines, setLines] = useState<LogLine[]>([
    { text: 'Maestro Code', color: 'cyan', bold: true },
    { text: 'Type a task and press Enter.', color: 'gray', dim: true },
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [agentState, setAgentState] = useState<'idle' | 'working' | 'completed' | 'error'>('idle');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const history = useInputHistory();
  const [inputFocused, setInputFocused] = useState(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Input focus management ──
  // Slash-to-focus model: '/' activates input bar, Escape returns to navigation.
  // This runs alongside page hooks; it only toggles the isActive flags.
  useInput((input, key) => {
    if (!inputFocused && input === '/') {
      setInputFocused(true);
      return;
    }
    if (inputFocused && key.escape) {
      setInputFocused(false);
      return;
    }
  }, { isActive: true });

  // ── Add line (FIFO 500) ──
  const MAX_LINES = 500;
  const addLine = useCallback((line: LogLine) => {
    setLines(prev => {
      const next = [...prev, line];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (sessionManager) {
        sessionManager.stopPolling();
        sessionManager.stopWidgetPolling();
      }
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
      }
    };
  }, [sessionManager]);

  // ── Terminal bell ──
  const bell = useCallback((count: number) => {
    if (noBell) return;
    for (let i = 0; i < count; i++) stdout.write('\x07');
  }, [noBell, stdout]);

  // ── Bell on state transitions ──
  const prevAgentState = useRef(agentState);
  useEffect(() => {
    const prev = prevAgentState.current;
    prevAgentState.current = agentState;
    if (prev === agentState) return;
    if (prev === 'working' && (agentState === 'completed' || agentState === 'idle')) bell(1);
    if (agentState === 'error') bell(2);
  }, [agentState, bell]);

  // ── Navigation callbacks (monitor pattern) ──
  const navigateTo = useCallback((targetView: DetailView, sourceState?: any) => {
    const dv = detailViewRef.current;
    const cp = currentPageRef.current;
    const entry = dv
      ? { ...dv, state: sourceState || null }
      : { type: 'page' as const, page: cp, state: sourceState || null };
    setNavStack(stack => {
      const next = [...stack, entry];
      return next.length > 20 ? next.slice(-20) : next;
    });
    setDetailView(targetView);
    setRestoredState(null);
  }, []);

  const handleSessionSelect = useCallback((sessionId: string, sourceState?: any) => {
    navigateTo({ type: 'session', id: sessionId }, sourceState);
  }, [navigateTo]);

  const handleWorkspaceSelect = useCallback((workspaceId: string, sourceState?: any) => {
    navigateTo({ type: 'workspace', id: workspaceId }, sourceState);
  }, [navigateTo]);

  const handleRepoSelect = useCallback((repoId: string, sourceState?: any) => {
    navigateTo({ type: 'repo', id: repoId }, sourceState);
  }, [navigateTo]);

  const handleModelSelect = useCallback((modelId: string, sourceState?: any) => {
    navigateTo({ type: 'model', id: modelId }, sourceState);
  }, [navigateTo]);

  const handleBlockSelect = useCallback((blockId: string, sourceState?: any) => {
    navigateTo({ type: 'block', id: blockId }, sourceState);
  }, [navigateTo]);

  const handleBack = useCallback(() => {
    const stack = navStackRef.current;
    if (stack.length > 0) {
      const prev = stack[stack.length - 1];
      setNavStack(stack.slice(0, -1));
      if (prev.type === 'page') {
        setDetailView(null);
        setCurrentPage((prev as PageNavEntry).page);
      } else {
        setDetailView({ type: prev.type as any, id: (prev as NavStackEntry).id });
      }
      setRestoredState(prev.state || null);
    } else if (detailViewRef.current) {
      setDetailView(null);
      setRestoredState(null);
    } else {
      exit();
    }
  }, [exit]);

  const handleQuit = useCallback(() => {
    if (sessionManager) sessionManager.stopPolling();
    exit();
  }, [exit, sessionManager]);

  const handleNavigate = useCallback((page: PageName) => {
    setCurrentPage(page);
    setNavStack([]);
    setDetailView(null);
    setRestoredState(null);
  }, []);

  // ── Handle task submit ──
  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();

    // Return to navigation mode after submitting
    setInputFocused(false);

    // Slash commands
    if (trimmed === '/quit' || trimmed === '/q') { handleQuit(); return; }

    // Push to input history
    history.push(input);

    // Branch 1: responding to interactive widget
    if (pendingInteractive) {
      addLine({ text: `> ${input}`, color: 'green' });
      if (sessionManager) {
        sessionManager.sendWidgetResponse(input, pendingInteractive.id, addLine);
      }
      setPendingInteractive(null);
      setCurrentWidget(null);
      return;
    }

    // Branch 2: session running — send as user message
    if (busy && sessionManager?.getSessionId()) {
      sessionManager.sendMessage(input, addLine);
      return;
    }

    // Branch 3: send message to agent (persistent session)
    addLine({ text: `> ${input}`, color: 'green', bold: true });

    if (sessionManager) {
      // Clear any pending completed→idle timer when starting a new task
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }

      sessionManager.submitTask(input, addLine, (b) => {
        setBusy(b);
        if (!b) {
          sessionManager.stopWidgetPolling();
          // Show 'completed' state for 3s before returning to 'idle'
          setAgentState('completed');
          completedTimerRef.current = setTimeout(() => {
            setAgentState('idle');
            completedTimerRef.current = null;
          }, 3000);
        } else {
          setAgentState('working');
        }
      }).then(() => {
        const id = sessionManager.getSessionId();
        if (id) {
          setCurrentSessionId(id);
          sessionManager.startWidgetPolling(addLine, setCurrentWidget, setPendingInteractive);
        }
      });
    }
  }, [addLine, sessionManager, busy, pendingInteractive, history, handleQuit]);

  // ── Auto-start demo session ──
  const autoStarted = useRef(false);
  useEffect(() => {
    if (demoMode && sessionManager && !autoStarted.current) {
      autoStarted.current = true;
      handleSubmit('Add login page');
    }
  }, [demoMode, sessionManager, handleSubmit]);

  // ── Render detail views ──
  if (detailView) {
    const detailProps = {
      apiClient,
      onExit: handleBack,
      onQuit: handleQuit,
      onNavigate: handleNavigate,
      onSessionSelect: handleSessionSelect,
      initialState: restoredState,
    };

    let detailComponent;
    switch (detailView.type) {
      case 'session':
        detailComponent = h(SessionMonitor, {
          sessionId: detailView.id,
          apiClient,
          onExit: handleBack,
          onQuit: handleQuit,
          onNavigate: handleNavigate,
          agentLines: lines,
          agentState,
        });
        break;
      case 'workspace':
        detailComponent = h(WorkspaceDetail, { workspaceId: detailView.id, ...detailProps });
        break;
      case 'repo':
        detailComponent = h(RepoDetail, { repoId: detailView.id, ...detailProps });
        break;
      case 'model':
        detailComponent = h(ModelDetail, { modelId: detailView.id, apiClient, onExit: handleBack, onQuit: handleQuit, onNavigate: handleNavigate });
        break;
      case 'block':
        detailComponent = h(BlockDetail, { blockId: detailView.id, ...detailProps });
        break;
      default:
        detailComponent = h(SessionMonitor, { sessionId: detailView.id, apiClient, onExit: handleBack, onQuit: handleQuit, onNavigate: handleNavigate });
    }

    return h(FullscreenBox, null,
      detailComponent,
      h(StatusBar, { currentPage: 'session', isDetailView: true, connectionStatus, latency: connLatency, lastRefresh }),
    );
  }

  // ── Render page views ──
  const pageProps = {
    apiClient,
    onNavigate: handleNavigate,
    onSessionSelect: handleSessionSelect,
    onWorkspaceSelect: handleWorkspaceSelect,
    onRepoSelect: handleRepoSelect,
    onQuit: handleQuit,
    initialState: restoredState,
    keyboardActive: !inputFocused,
  };

  let pageComponent;
  switch (currentPage) {
    case 'agent':
      pageComponent = h(AgentScreen, {
        ...pageProps,
        lines,
        agentState,
        sessionId: currentSessionId,
        busy,
        keyboardActive: !inputFocused,
        lastOutput: sessionManager?.getLastOutput() || null,
      });
      break;
    case 'spaces':
      pageComponent = h(SpacesScreen, pageProps);
      break;
    case 'foundry':
      pageComponent = h(FoundryScreen, { ...pageProps, onBlockSelect: handleBlockSelect });
      break;
    case 'catalog':
      pageComponent = h(CatalogScreen, { ...pageProps, onBlockSelect: handleBlockSelect });
      break;
    case 'models':
      pageComponent = h(ModelsScreen, { ...pageProps, onModelSelect: handleModelSelect });
      break;
    case 'home':
    default:
      pageComponent = h(HomeScreen, pageProps);
      break;
  }

  return h(FullscreenBox, null,
    pageComponent,
    currentPage === 'agent'
      ? h(TaskInputBar, {
          onSubmit: handleSubmit,
          disabled: false,
          placeholder: busy ? 'Send a message to the agent...' : 'Describe your task...',
          onUpArrow: history.prev,
          onDownArrow: history.next,
          captureInput: inputFocused,
        })
      : null,
    h(StatusBar, { currentPage, connectionStatus, latency: connLatency, lastRefresh }),
  );
};

// ── Public entry point ──────────────────────────────────────────

async function startInteractive(options: InteractiveOptions = {}): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error('Interactive mode requires a terminal (TTY).');
    process.exit(1);
  }

  setTerminalBg(palette.bg);

  const sessionManager = options.apiClient ? new SessionManager(options) : null;
  const demoMode = (options as any).demo || false;
  const noBell = (options as any).noBell || false;

  // No API client and no demo mode → show error
  const apiClient = options.apiClient || null;
  const rootComponent = (!apiClient && !demoMode)
    ? h(NoBackendScreen)
    : h(App, { apiClient, sessionManager, demoMode, repoPath: options.repoPath, noBell });

  const instance = render(rootComponent, { exitOnCtrlC: true });

  try {
    await instance.waitUntilExit();
  } finally {
    resetTerminalBg();
  }
}

export { startInteractive, App, ConversationLog, TaskInputBar, SessionManager, WidgetRenderer };
export type { LogLine, LogLine as InteractiveLogLine, InteractiveOptions, Widget };
