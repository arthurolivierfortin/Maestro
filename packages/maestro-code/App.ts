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
import { HelpOverlay } from './components/HelpOverlay.ts';
import { ProviderSetupScreen } from './components/ProviderSetupScreen.ts';
import { AssistantSelector } from './components/AssistantSelector.ts';

import type { IApiClient } from '@maestro/tui/types';
import type { IMaestroCodeApiClient, InteractiveOptions } from './types.ts';

import { DemoApiClient } from './mocks/DemoApiClient.ts';
import { SessionManager, ts } from './services/SessionManager.ts';
import type { LogLine, Widget } from './services/SessionManager.ts';
import { useInputHistory } from './hooks/useInputHistory.ts';

// ── Create-agent argument parser ────────────────────────────────

export function parseCreateAgent(input: string): { description: string; contract: string; model: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/);
  let description = '';
  let contract = '';
  let model = '';

  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === '--contract' && i + 1 < tokens.length) {
      contract = tokens[i + 1];
      i += 2;
    } else if (tokens[i] === '--model' && i + 1 < tokens.length) {
      model = tokens[i + 1];
      i += 2;
    } else {
      description += (description ? ' ' : '') + tokens[i];
      i++;
    }
  }

  if (!description) return null;
  return { description, contract, model };
}

// ── FullscreenBox ──────────────────────────────────────────────

const FullscreenBox = ({ children }: { children: any }) => {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);

  useEffect(() => {
    const onResize = () => {
      if (stdout.rows) setRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
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

interface AppProps {
  apiClient: IApiClient | null;
  sessionManager: SessionManager | null;
  demoMode?: boolean;
  repoPath?: string;
  noBell?: boolean;
  hasProviders?: boolean;
  ensureBackendFn?: () => Promise<{ apiClient: IMaestroCodeApiClient; sidecar: any }>;
  saveProviders?: (providers: Record<string, any>) => void;
  readProviders?: () => Record<string, any> | null;
  importSessionTemplate?: (sessionId: string, templateName: string, options?: { quiet?: boolean }) => Promise<void>;
  template?: string;
  entryPoint?: string;
}

const App = ({ apiClient: clientProp, sessionManager: smProp, demoMode, repoPath, noBell, hasProviders: hasProvidersProp, ensureBackendFn, saveProviders, readProviders, importSessionTemplate, template, entryPoint }: AppProps) => {
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
  // ── Provider setup state ──
  const [providersReady, setProvidersReady] = useState(hasProvidersProp !== false || !!demoMode);
  const [assistantReady, setAssistantReady] = useState(hasProvidersProp !== false || !!demoMode);
  const [liveApiClient, setLiveApiClient] = useState<IApiClient | null>(clientProp);
  const [liveSessionManager, setLiveSessionManager] = useState<SessionManager | null>(smProp);

  const sessionManager = demoMode ? (demoSetup?.sm || null) : (liveSessionManager || null);
  const apiClient = demoMode ? (demoSetup?.client || null) : liveApiClient;

  // Handle provider setup completion — save config and start backend
  const [setupInProgress, setSetupInProgress] = useState(false);
  const handleProviderSetupComplete = useCallback(async (providers: Record<string, any>) => {
    setSetupInProgress(true);
    try {
      // Save providers config via callback (avoids cross-package dependency)
      if (saveProviders) {
        saveProviders(providers);
      }
      setCurrentProviders(providers);

      // Start backend with new provider config
      if (ensureBackendFn) {
        const { apiClient: newClient } = await ensureBackendFn();
        if (newClient) {
          setLiveApiClient(newClient);
          setLiveSessionManager(new SessionManager({ apiClient: newClient, repoPath, importSessionTemplate, template, entryPoint }));
        }
      }

      setProvidersReady(true);
    } catch (err: any) {
      // Even if backend start fails, mark as ready so user can see the TUI
      setProvidersReady(true);
    } finally {
      setSetupInProgress(false);
    }
  }, [ensureBackendFn, saveProviders, repoPath, importSessionTemplate, template, entryPoint]);

  // ── Provider config for Models page ──
  const [currentProviders, setCurrentProviders] = useState<Record<string, any> | null>(() => {
    return readProviders ? readProviders() : null;
  });
  const [showReconfigure, setShowReconfigure] = useState(false);

  // ── Assistant selection handler ──
  const handleAssistantSelect = useCallback((blockId: string) => {
    // Save assistant choice via provider config (add _selectedAssistant)
    if (saveProviders && currentProviders) {
      saveProviders({ ...currentProviders, _selectedAssistant: blockId });
    }
    setActiveAgent(blockId);
    setAssistantReady(true);
  }, [saveProviders, currentProviders]);

  const handleReconfigure = useCallback(() => {
    setShowReconfigure(true);
  }, []);

  const handleReconfigureComplete = useCallback((providers: Record<string, any>) => {
    if (saveProviders) saveProviders(providers);
    setCurrentProviders(providers);
    setShowReconfigure(false);
  }, [saveProviders]);

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
    { text: 'Welcome to Maestro Code. Press / to type a task.', color: 'gray', dim: true },
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [agentState, setAgentState] = useState<'idle' | 'working' | 'completed' | 'error'>('idle');
  const [activeAgent, setActiveAgent] = useState<string | null>(() => {
    // Load saved assistant choice from provider config
    const cfg = readProviders ? readProviders() : null;
    return (cfg as any)?._selectedAssistant || null;
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const history = useInputHistory();
  const [inputFocused, setInputFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs for Ctrl+C handler (assigned after handleCancel is defined below) ──
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const handleCancelRef = useRef<(() => void) | null>(null);

  // ── Input focus management + Ctrl+C interception ──
  // Slash-to-focus model: '/' activates input bar, Escape returns to navigation.
  // Ctrl+C when busy → cancel task; Ctrl+C when idle → quit.
  useInput((input, key) => {
    // Ctrl+C: cancel task if busy, otherwise quit
    if (input === 'c' && key.ctrl) {
      if (busyRef.current && handleCancelRef.current) {
        handleCancelRef.current();
      } else {
        handleQuit();
      }
      return;
    }
    // ? key toggles help overlay (when not typing)
    if (!inputFocused && input === '?') {
      setShowHelp(prev => !prev);
      return;
    }
    // Escape closes help overlay first, then unfocuses input
    if (showHelp && key.escape) {
      setShowHelp(false);
      return;
    }
    if (!inputFocused && input === '/' && currentPageRef.current === 'agent') {
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

  // ── Load conversation history on startup ──
  const historyLoaded = useRef(false);
  useEffect(() => {
    if (!sessionManager || demoMode || historyLoaded.current) return;
    historyLoaded.current = true;
    sessionManager.loadConversationHistory().then(historyLines => {
      if (historyLines.length > 0) {
        setLines([
          { text: 'Maestro Code', color: 'cyan', bold: true },
          { text: 'Previous session restored. Press / to continue.', color: 'gray', dim: true },
          { text: '' },
          ...historyLines,
        ]);
      }
    }).catch(() => { /* non-fatal */ });
  }, [sessionManager, demoMode]);

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

  // ── Cancel current task ──
  const handleCancel = useCallback(() => {
    if (!busy || !sessionManager) return;
    sessionManager.cancelTask(addLine, setBusy);
    if (completedTimerRef.current) {
      clearTimeout(completedTimerRef.current);
      completedTimerRef.current = null;
    }
    setAgentState('idle');
  }, [busy, sessionManager, addLine]);
  handleCancelRef.current = handleCancel;

  // ── Slash command dispatch ──
  const slashCommands: Record<string, () => void> = useMemo(() => ({
    '/quit': () => handleQuit(),
    '/q': () => handleQuit(),
    '/stop': () => handleCancel(),
    '/help': () => {
      addLine({ text: '' });
      addLine({ text: 'Available commands:', color: 'cyan', bold: true, timestamp: ts() });
      addLine({ text: '  /help    — Show this help message', color: 'white' });
      addLine({ text: '  /status  — Show session and connection status', color: 'white' });
      addLine({ text: '  /new     — Start a new conversation (keeps history)', color: 'white' });
      addLine({ text: '  /clear   — Clear conversation and start fresh', color: 'white' });
      addLine({ text: '  /stop    — Cancel the current task', color: 'white' });
      addLine({ text: '  /purge   — Delete all idle/completed sessions', color: 'white' });
      addLine({ text: '  /agent        — Show or switch active agent (/agent compact)', color: 'white' });
      addLine({ text: '  /create-agent — Create an agent via block-forge workflow', color: 'white' });
      addLine({ text: '  /quit         — Quit Maestro Code', color: 'white' });
      addLine({ text: '' });
      addLine({ text: 'Keyboard:', color: 'cyan', bold: true });
      addLine({ text: '  /        — Focus input bar', color: 'white' });
      addLine({ text: '  Escape   — Return to navigation', color: 'white' });
      addLine({ text: '  ?        — Toggle keyboard shortcuts overlay', color: 'white' });
      addLine({ text: '  Ctrl+C   — Cancel task (when busy) or quit', color: 'white' });
      addLine({ text: '' });
      addLine({ text: 'Pages:', color: 'cyan', bold: true });
      addLine({ text: '  h Home  a Agent  s Spaces  f Foundry  c Catalog  m Models', color: 'white' });
      addLine({ text: '' });
    },
    '/new': () => {
      if (!sessionManager) return;
      // Reset session so next message creates a fresh one (handles dead sessions)
      sessionManager.resetSession();
      setAgentState('idle');
      setCurrentSessionId(null);
      setLines([
        { text: 'Maestro Code', color: 'cyan', bold: true },
        { text: 'New conversation started.', color: 'green' },
        { text: '' },
      ]);
    },
    '/clear': () => {
      if (!sessionManager) return;
      addLine({ text: '' });
      addLine({ text: 'Clearing conversation...', color: 'cyan', timestamp: ts() });
      sessionManager.invokeEntryPoint('clear-conversation', addLine).then(() => {
        setLines([
          { text: 'Maestro Code', color: 'cyan', bold: true },
          { text: 'Conversation cleared.', color: 'green' },
          { text: '' },
        ]);
      });
    },
    '/purge': () => {
      if (!apiClient) return;
      addLine({ text: '' });
      addLine({ text: 'Purging idle sessions...', color: 'cyan', timestamp: ts() });
      (async () => {
        try {
          const sessions = await apiClient.listSessions();
          const idleStatuses = ['idle', 'created', 'completed'];
          const toDelete = (sessions || []).filter(
            s => idleStatuses.includes((s.status || '').toLowerCase())
          );
          let deleted = 0;
          for (const s of toDelete) {
            try {
              await (apiClient as IMaestroCodeApiClient)._fetch('DELETE', `/api/sessions/${s.id}`);
              deleted++;
            } catch { /* skip */ }
          }
          addLine({ text: `Purged ${deleted} session(s).`, color: 'green', bold: true, timestamp: ts() });
          addLine({ text: '' });
        } catch (err: any) {
          addLine({ text: `Error: ${err.message || err}`, color: 'red', timestamp: ts() });
        }
      })();
    },
    '/status': () => {
      addLine({ text: '' });
      addLine({ text: 'Status:', color: 'cyan', bold: true, timestamp: ts() });
      const sid = sessionManager?.getSessionId();
      addLine({ text: `  Session:  ${sid ? sid.slice(0, 8) : 'No active session'}`, color: 'white' });
      addLine({ text: `  Template: ${sessionManager ? 'maestro-assistant' : 'N/A'}`, color: 'white' });
      addLine({ text: `  Repo:     ${sessionManager?.getRepoPath() || 'N/A'}`, color: 'white' });
      if (sid && apiClient) {
        (async () => {
          try {
            const session = await apiClient.getSession(sid);
            const status = session?.status || session?.containerStatus || 'unknown';
            const convId = session?.variables?._activeConversation;
            addLine({ text: `  Status:   ${status}`, color: 'white' });
            addLine({ text: `  Conversation: ${convId || 'None'}`, color: 'white' });
          } catch {
            addLine({ text: `  Status:   (could not fetch)`, color: 'yellow' });
          }
          addLine({ text: '' });
        })();
      } else {
        addLine({ text: '' });
      }
    },
  }), [handleQuit, handleCancel, addLine, sessionManager, apiClient]);

  // ── Handle task submit ──
  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();

    // Return to navigation mode after submitting
    setInputFocused(false);

    // Slash commands — dispatch via map
    const cmd = slashCommands[trimmed];
    if (cmd) { cmd(); return; }

    // Parametric slash commands

    // /create-agent — must be checked BEFORE /agent
    if (trimmed.startsWith('/create-agent')) {
      const rawArg = input.trim().slice('/create-agent'.length).trim();
      const parsed = parseCreateAgent(rawArg);
      if (!parsed) {
        addLine({ text: '' });
        addLine({ text: 'Usage: /create-agent <description> [--contract <id>] [--model <id>]', color: 'yellow', timestamp: ts() });
        addLine({ text: '  Example: /create-agent An agent that reviews TypeScript code --contract code-reviewer', color: 'gray' });
        addLine({ text: '' });
        return;
      }
      const { description, contract, model } = parsed;
      addLine({ text: '' });
      addLine({ text: 'Creating agent via block-forge workflow...', color: 'cyan', bold: true, timestamp: ts() });
      addLine({ text: `  Description: ${description}`, color: 'white' });
      if (contract) addLine({ text: `  Contract:    ${contract}`, color: 'white' });
      if (model) addLine({ text: `  Model:       ${model}`, color: 'white' });
      addLine({ text: '' });

      (async () => {
        try {
          const createOpts = {
            repositoryPath: sessionManager?.getRepoPath() || 'C:\\Meastro',
            authority: 'human',
            name: `Block Forge - ${description.slice(0, 40)}`,
          };
          const session = await (apiClient as IMaestroCodeApiClient).createSession(createOpts);

          // Import block-forge template and start
          await (apiClient as IMaestroCodeApiClient)._fetch('POST', `/api/sessions/${session.id}/import-template/block-forge`);
          await (apiClient as IMaestroCodeApiClient)._fetch('POST', `/api/sessions/${session.id}/start`);

          // Invoke the default entry point
          await (apiClient as IMaestroCodeApiClient)._fetch('POST', `/api/sessions/${session.id}/invoke/default`, {
            body: { inputs: { description, contractId: contract, targetModel: model } },
          });

          addLine({ text: `Block-forge session started (${session.id.slice(0, 8)})`, color: 'green', timestamp: ts() });
          addLine({ text: '  Polling for completion...', color: 'gray' });

          // Poll for completion
          const poll = setInterval(async () => {
            try {
              const s = await (apiClient as IMaestroCodeApiClient).getSession(session.id);
              const status = ((s as any).status || '').toLowerCase();
              if (status === 'completed' || status === 'idle' || status === 'error') {
                clearInterval(poll);
                const vars = (s as any).variables || {};
                const fitness = vars.fitness || 'N/A';
                const blockId = vars.blockId || 'N/A';
                const published = vars.published || 'false';
                addLine({ text: '' });
                addLine({ text: 'Block Forge Complete', color: 'cyan', bold: true, timestamp: ts() });
                addLine({ text: `  Block:     ${blockId}`, color: 'white' });
                addLine({ text: `  Fitness:   ${fitness}`, color: published === 'true' ? 'green' : 'yellow' });
                addLine({ text: `  Published: ${published === 'true' ? 'Yes' : 'No (below threshold)'}`, color: published === 'true' ? 'green' : 'red' });
                addLine({ text: '' });
              }
            } catch { /* polling error — ignore */ }
          }, 3000);
          // Timeout after 15 minutes
          setTimeout(() => clearInterval(poll), 15 * 60 * 1000);
        } catch (err: any) {
          addLine({ text: `Error: ${err.message || err}`, color: 'red', timestamp: ts() });
        }
      })();
      return;
    }

    if (trimmed.startsWith('/agent')) {
      const arg = input.trim().slice(6).trim(); // preserve original case for block IDs
      if (!arg) {
        // Show current agent
        if (sessionManager) {
          sessionManager.getVariable('_activeAgent').then((v: any) => {
            addLine({ text: '' });
            addLine({ text: `Active agent: ${v || 'system:maestro-assistant (default)'}`, color: 'cyan', timestamp: ts() });
            addLine({ text: '' });
          });
        } else {
          addLine({ text: 'No session manager available.', color: 'yellow', timestamp: ts() });
        }
      } else {
        // Switch agent — resolve shorthand to full block ID
        const blockId = arg.includes(':') ? arg : `system:maestro-assistant-${arg}`;
        const label = arg === 'default' ? 'system:maestro-assistant' : blockId;
        const resolvedId = arg === 'default' ? 'system:maestro-assistant' : blockId;
        if (sessionManager) {
          sessionManager.setVariable('_activeAgent', resolvedId).then(() => {
            setActiveAgent(resolvedId);
            addLine({ text: '' });
            addLine({ text: `Switched agent to: ${label}`, color: 'green', bold: true, timestamp: ts() });
            addLine({ text: '  Next message will use this agent.', color: 'gray' });
            addLine({ text: '' });
          }).catch((err: any) => {
            addLine({ text: `Error switching agent: ${err.message}`, color: 'red', timestamp: ts() });
          });
        }
      }
      return;
    }

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
          const hadErrors = sessionManager.getLastHadErrors();
          // Show 'error' or 'completed' state before returning to 'idle'
          // Errors stay visible longer (10s) for readability; success is brief (3s)
          setAgentState(hadErrors ? 'error' : 'completed');
          const delay = hadErrors ? 10_000 : 3000;
          completedTimerRef.current = setTimeout(() => {
            setAgentState('idle');
            completedTimerRef.current = null;
          }, delay);
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
  }, [addLine, sessionManager, busy, pendingInteractive, history, slashCommands]);

  // ── Auto-start demo session ──
  const autoStarted = useRef(false);
  useEffect(() => {
    if (demoMode && sessionManager && !autoStarted.current) {
      autoStarted.current = true;
      handleSubmit('Add login page');
    }
  }, [demoMode, sessionManager, handleSubmit]);

  // ── Render provider setup screen if no providers configured ──
  if (!providersReady) {
    if (setupInProgress) {
      return h(FullscreenBox, null,
        h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
          h(Text, { color: 'cyan', bold: true }, 'Starting Maestro services...'),
          h(Text, { color: 'gray', dimColor: true }, 'This may take a few seconds.'),
        ),
      );
    }
    return h(FullscreenBox, null,
      h(ProviderSetupScreen, {
        onComplete: handleProviderSetupComplete,
        onSkip: () => setProvidersReady(true),
      }),
    );
  }

  // ── Render assistant selection (after provider setup, before main TUI) ──
  if (providersReady && !assistantReady && apiClient) {
    return h(FullscreenBox, null,
      h(AssistantSelector, {
        apiClient: apiClient as IMaestroCodeApiClient,
        onSelect: handleAssistantSelect,
        onSkip: () => setAssistantReady(true),
      }),
    );
  }

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
        detailComponent = h(SessionMonitor as any, { sessionId: detailView.id, apiClient, onExit: handleBack, onQuit: handleQuit, onNavigate: handleNavigate });
    }

    // Detail components render their own StatusBar — no global one here
    return h(FullscreenBox, null,
      detailComponent,
    );
  }

  // ── Render reconfigure overlay ──
  if (showReconfigure) {
    return h(FullscreenBox, null,
      h(ProviderSetupScreen, {
        onComplete: handleReconfigureComplete,
        onSkip: () => setShowReconfigure(false),
        existingProviders: currentProviders,
      }),
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
  if (showHelp) {
    pageComponent = h(HelpOverlay, { currentPage, onClose: () => setShowHelp(false) });
  } else {
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
          repoPath: sessionManager?.getRepoPath() || repoPath || null,
          activeAgent,
        });
        break;
      case 'spaces':
        pageComponent = h(SpacesScreen as any, pageProps);
        break;
      case 'foundry':
        pageComponent = h(FoundryScreen as any, { ...pageProps, onBlockSelect: handleBlockSelect });
        break;
      case 'catalog':
        pageComponent = h(CatalogScreen as any, { ...pageProps, onBlockSelect: handleBlockSelect });
        break;
      case 'models':
        pageComponent = h(ModelsScreen as any, {
          ...pageProps,
          onModelSelect: handleModelSelect,
          providers: currentProviders,
          onReconfigure: handleReconfigure,
        });
        break;
      case 'home':
      default:
        pageComponent = h(HomeScreen, pageProps);
        break;
    }
  }

  return h(FullscreenBox, null,
    pageComponent,
    currentPage === 'agent' && !showHelp
      ? h(TaskInputBar, {
          onSubmit: handleSubmit,
          disabled: busy && !pendingInteractive,
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
  const demoMode = options.demo || false;
  const noBell = options.noBell || false;
  const hasProviders = options.hasProviders === true;
  const sidecar = options.sidecar || null;
  const ensureBackendFn = options.ensureBackendFn || null;

  // No API client, no demo mode, and providers already configured → show error
  const apiClient = options.apiClient || null;
  const needsSetup = !hasProviders && !demoMode;
  const rootComponent = (!apiClient && !demoMode && !needsSetup)
    ? h(NoBackendScreen)
    : h(App, {
        apiClient, sessionManager, demoMode, repoPath: options.repoPath, noBell,
        hasProviders, ensureBackendFn,
        saveProviders: options.saveProviders || null,
        readProviders: options.readProviders || null,
        importSessionTemplate: options.importSessionTemplate || null,
        template: options.template || null,
        entryPoint: options.entryPoint || null,
      } as AppProps);

  const instance = render(rootComponent, { exitOnCtrlC: false });

  try {
    await instance.waitUntilExit();
  } finally {
    resetTerminalBg();
    // Stop sidecar on TUI exit to prevent orphan processes
    if (sidecar) {
      try { await sidecar.stop(); } catch {}
      console.log('  Maestro services stopped.');
    }
  }
}

export { startInteractive, App, ConversationLog, TaskInputBar, SessionManager, WidgetRenderer };
export type { LogLine, LogLine as InteractiveLogLine, InteractiveOptions, Widget };
