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
import { FocusProvider, useFocusContext } from './hooks/useFocusProvider.ts';
import { useManagedInput } from './hooks/useManagedInput.ts';

import { SessionMonitor } from './components/SessionMonitor.ts';
import { WorkspaceDetail } from './components/WorkspaceDetail.ts';
import { RepoDetail } from './components/RepoDetail.ts';
import { ModelDetail } from './components/ModelDetail.ts';
import { BlockDetail } from './components/BlockDetail.ts';
import { TaskInputBar } from './components/TaskInputBar.ts';
import { ConversationLog } from './components/ConversationLog.ts';
import { AgentScreen } from './components/AgentScreen.ts';
import { ChatFirstScreen } from './components/ChatFirstScreen.ts';
import { StatusBar } from './components/StatusBar.ts';
import { ChatStatusBar } from './components/ChatStatusBar.ts';
import { HelpOverlay } from './components/HelpOverlay.ts';
import { ProviderSetupScreen } from './components/ProviderSetupScreen.ts';
import { AssistantSelector } from './components/AssistantSelector.ts';

// Legacy page components — only used in --classic mode
import { HomeScreen } from './components/legacy/HomeScreen.ts';
import { SpacesScreen } from './components/legacy/SpacesScreen.ts';
import { FoundryScreen } from './components/legacy/FoundryScreen.ts';
import { CatalogScreen } from './components/legacy/CatalogScreen.ts';
import { ModelsScreen } from './components/legacy/ModelsScreen.ts';

import type { IApiClient } from '@maestro/tui/types';
import type { IMaestroCodeApiClient, InteractiveOptions } from './types.ts';

import { DemoApiClient } from './mocks/DemoApiClient.ts';
import { SessionManager, ts } from './services/SessionManager.ts';
import type { LogLine, Widget } from './services/SessionManager.ts';
import type { ChatWidget, WidgetType } from './types/widgets.ts';
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

// ── Playground command parser ──────────────────────────────────

export interface PlaygroundParsed {
  action: 'select-model' | 'playground';
  modelId?: string;
}

export function parsePlayground(input: string): PlaygroundParsed | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/playground')) return null;
  // Reject flag-like args (e.g. /playground --invalid)
  const rest = trimmed.slice('/playground'.length).trim();
  if (rest.startsWith('-')) return null;
  if (!rest) return { action: 'select-model' };
  return { action: 'playground', modelId: rest };
}

// ── Costs command parser ───────────────────────────────────────

export function parseCostsCommand(input: string): { action: string; limits?: Record<string, number>; enforcement?: string; autoResume?: boolean } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/costs')) return null;
  const rest = trimmed.slice('/costs'.length).trim();

  // /costs or /costs summary
  if (!rest || rest === 'summary') return { action: 'summary' };

  // /costs limits
  if (rest === 'limits') return { action: 'limits' };

  // /costs status
  if (rest === 'status') return { action: 'status' };

  // /costs clear
  if (rest === 'clear') return { action: 'clear' };

  // /costs set --per-day 5.00 --per-session 1 --enforcement block|warn --auto-resume
  if (rest.startsWith('set')) {
    const setArgs = rest.slice('set'.length).trim();
    if (!setArgs) return null; // /costs set with no flags → error

    const tokens = setArgs.split(/\s+/);
    const limits: Record<string, number> = {};
    let enforcement: string | undefined;
    let autoResume: boolean | undefined;
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i] === '--per-day' && i + 1 < tokens.length) {
        limits.perDay = parseFloat(tokens[i + 1]);
        i += 2;
      } else if (tokens[i] === '--per-session' && i + 1 < tokens.length) {
        limits.perSession = parseFloat(tokens[i + 1]);
        i += 2;
      } else if (tokens[i] === '--per-week' && i + 1 < tokens.length) {
        limits.perWeek = parseFloat(tokens[i + 1]);
        i += 2;
      } else if (tokens[i] === '--per-month' && i + 1 < tokens.length) {
        limits.perMonth = parseFloat(tokens[i + 1]);
        i += 2;
      } else if (tokens[i] === '--enforcement' && i + 1 < tokens.length) {
        const val = tokens[i + 1];
        if (val !== 'block' && val !== 'warn') return null; // invalid enforcement value
        enforcement = val;
        i += 2;
      } else if (tokens[i] === '--auto-resume') {
        autoResume = true;
        i += 1;
      } else {
        return null; // unknown flag
      }
    }
    if (Object.keys(limits).length === 0) return null;
    const result: { action: string; limits: Record<string, number>; enforcement?: string; autoResume?: boolean } = { action: 'set', limits };
    if (enforcement !== undefined) result.enforcement = enforcement;
    if (autoResume !== undefined) result.autoResume = autoResume;
    return result;
  }

  // Unknown subcommand
  return null;
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
  /** When true, restore the old multi-page paradigm (NavBar, page routing, hotkeys). Default: false. */
  classic?: boolean;
}

const App = ({ apiClient: clientProp, sessionManager: smProp, demoMode, repoPath, noBell, hasProviders: hasProvidersProp, ensureBackendFn, saveProviders, readProviders, importSessionTemplate, template, entryPoint, classic }: AppProps) => {
  const classicMode = classic === true;
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

  // ── Daily cost polling (every 60s) ──
  const [dailyCost, setDailyCost] = useState<number | null>(null);
  const [costLimitStatus, setCostLimitStatus] = useState<'block' | 'warn' | null>(null);
  useEffect(() => {
    if (!apiClient) return;
    const fetchCost = async () => {
      try {
        const summary = await (apiClient as any).getCostsSummary();
        if (summary && typeof summary.today?.totalCost === 'number') {
          setDailyCost(summary.today.totalCost);
          // Check if daily limit is exceeded and determine enforcement type
          const limitsObj = summary.limits;
          if (limitsObj) {
            const maxPerDay = typeof limitsObj.maxPerDay === 'object' && limitsObj.maxPerDay !== null
              ? limitsObj.maxPerDay
              : (typeof limitsObj.maxPerDay === 'number' ? { value: limitsObj.maxPerDay, enforcement: 'block' } : null);
            if (maxPerDay && typeof maxPerDay.value === 'number' && summary.today.totalCost >= maxPerDay.value) {
              setCostLimitStatus((maxPerDay.enforcement === 'warn' ? 'warn' : 'block') as 'block' | 'warn');
            } else {
              setCostLimitStatus(null);
            }
          } else {
            setCostLimitStatus(null);
          }
        }
      } catch {
        // Silently ignore — don't show errors in status bar
      }
    };
    fetchCost();
    const timer = setInterval(fetchCost, 60000);
    return () => clearInterval(timer);
  }, [apiClient]);

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
    { text: 'Welcome to Maestro Code. Type a message or /help for commands.', color: 'gray', dim: true },
    { text: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [agentState, setAgentState] = useState<'idle' | 'working' | 'completed' | 'error'>('idle');
  const [activeAgent, setActiveAgent] = useState<string | null>(() => {
    // Load saved assistant choice from provider config
    const cfg = readProviders ? readProviders() : null;
    return (cfg as any)?._selectedAssistant || 'system:maestro-assistant';
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const history = useInputHistory();
  const [inputFocused, setInputFocused] = useState(!classicMode);
  const [showHelp, setShowHelp] = useState(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Conversation line buffer limit ──
  const MAX_LINES = 500;

  // ── Widget management (Phase 63-B) ──
  const [focusedWidgetId, setFocusedWidgetId] = useState<string | null>(null);
  const [collapsedWidgets, setCollapsedWidgets] = useState<Set<string>>(() => new Set());
  const widgetCounterRef = useRef(0);
  const collapseWidgetReleaseRef = useRef<(() => void) | null>(null);
  const inputValueRef = useRef('');

  /**
   * Add an inline widget to the conversation log.
   * The widget becomes the focused widget (if interactive).
   */
  const addWidget = useCallback((type: WidgetType, props: Record<string, any> = {}, interactive: boolean = true) => {
    const widgetId = `w-${++widgetCounterRef.current}-${Date.now()}`;
    const widget: ChatWidget = { type, props, interactive };
    const line: LogLine = {
      text: '',
      widgetId,
      widget,
      timestamp: ts(),
    };
    setLines(prev => {
      const next = [...prev, line];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
    // Always set focused widget — even non-interactive widgets need focus
    // so Esc can collapse them. The interactive flag only controls whether
    // the widget claims the 'widget' focus layer for keyboard events.
    setFocusedWidgetId(widgetId);
    return widgetId;
  }, []);

  /**
   * Collapse a widget (Esc). Widget stays in chat history as a 1-line summary.
   * Focus returns to page layer.
   */
  const collapseWidget = useCallback((widgetId: string) => {
    setCollapsedWidgets(prev => {
      const next = new Set(prev);
      next.add(widgetId);
      return next;
    });
    if (focusedWidgetId === widgetId) {
      setFocusedWidgetId(null);
    }
    // focusRelease('widget') is called after focusRelease is declared (see below)
    collapseWidgetReleaseRef.current?.();
  }, [focusedWidgetId]);

  /**
   * Navigate from one widget to another (e.g., sessions list → session detail).
   * Collapses current focused widget and opens a new one.
   */
  const handleWidgetNavigate = useCallback((targetType: import('./types/widgets.ts').WidgetType, targetProps: Record<string, any>) => {
    // Collapse current widget
    if (focusedWidgetId) {
      collapseWidget(focusedWidgetId);
    }
    // Add new widget
    addWidget(targetType, targetProps, true);
  }, [focusedWidgetId, collapseWidget, addWidget]);

  // ── Refs for Ctrl+C handler (assigned after handleCancel is defined below) ──
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const handleCancelRef = useRef<(() => void) | null>(null);

  // ── Focus layer management ──
  const { claim: focusClaim, release: focusRelease } = useFocusContext();
  // Wire up the release ref for collapseWidget (defined before focusRelease)
  collapseWidgetReleaseRef.current = () => focusRelease('widget');

  // Claim/release focus layers based on state
  useEffect(() => {
    if (inputFocused) {
      focusClaim('input');
    } else {
      focusRelease('input');
    }
  }, [inputFocused, focusClaim, focusRelease]);

  useEffect(() => {
    if (showHelp) {
      focusClaim('modal');
    } else {
      focusRelease('modal');
    }
  }, [showHelp, focusClaim, focusRelease]);

  // Always claim 'page' so page-level handlers can be gated
  useEffect(() => {
    focusClaim('page');
    return () => focusRelease('page');
  }, [focusClaim, focusRelease]);

  // ── Input focus management + Ctrl+C interception ──
  // Slash-to-focus model: '/' activates input bar, Escape returns to navigation.
  // Ctrl+C when busy → cancel task; Ctrl+C when idle → quit.
  // This handler uses raw useInput (not managed) because Ctrl+C must ALWAYS work,
  // even when a modal or input layer is active.
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
    // Enter: submit input value directly from raw handler.
    // TaskInputBar's useManagedInput('input') may not fire due to focus layer conflicts.
    // This raw handler is always active and serves as the fallback submission path.
    if (key.return && !classicMode && inputValueRef.current.trim()) {
      const v = inputValueRef.current.trim();
      inputValueRef.current = '';
      handleSubmit(v);
      return;
    }

    // Escape closes help overlay first, then unfocuses input
    if (showHelp && key.escape) {
      setShowHelp(false);
      return;
    }
    if (inputFocused && key.escape) {
      // If a widget is focused, collapse it directly.
      // The widget's useManagedInput('widget') can't handle Esc because
      // the input layer (alwaysActive in chat-first) blocks the widget layer.
      if (focusedWidgetId) {
        collapseWidget(focusedWidgetId);
        return;
      }
      // In classic mode, Esc unfocuses input
      if (classicMode) {
        setInputFocused(false);
      }
      // In chat-first mode, Esc does nothing when no widget is focused
      // (input stays always active)
      return;
    }
  }, { isActive: true });

  // Page-level hotkeys — gated by FocusProvider (blocked when input/modal active)
  useManagedInput('page', (input, key) => {
    // ? key toggles help overlay (when not typing)
    if (input === '?') {
      setShowHelp(prev => !prev);
      return;
    }
    if (input === '/' && (!classicMode || currentPageRef.current === 'agent')) {
      setInputFocused(true);
      return;
    }
  });

  // ── Add line (FIFO) ──
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
          { text: 'Previous session restored. Type a message to continue.', color: 'gray', dim: true },
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
      addLine({ text: '  /help             — Show this help message', color: 'white' });
      addLine({ text: '  /status           — System health + active sessions', color: 'white' });
      addLine({ text: '  /spaces           — Sessions list', color: 'white' });
      addLine({ text: '  /workspaces       — Workspaces list', color: 'white' });
      addLine({ text: '  /repos            — Repos list', color: 'white' });
      addLine({ text: '  /catalog [filter] — Block catalog (filter: agents|tools|workflows)', color: 'white' });
      addLine({ text: '  /foundry          — My blocks', color: 'white' });
      addLine({ text: '  /models           — LLM models + providers', color: 'white' });
      addLine({ text: '  /session <id>     — Session monitor', color: 'white' });
      addLine({ text: '  /block <id>       — Block details', color: 'white' });
      addLine({ text: '  /model <id>       — Model details', color: 'white' });
      addLine({ text: '  /workspace <id>   — Workspace details', color: 'white' });
      addLine({ text: '  /permissions <id> — Session permissions diff', color: 'white' });
      addLine({ text: '  /new              — Start a new conversation', color: 'white' });
      addLine({ text: '  /clear            — Clear conversation', color: 'white' });
      addLine({ text: '  /stop             — Cancel the current task', color: 'white' });
      addLine({ text: '  /purge            — Delete idle sessions', color: 'white' });
      addLine({ text: '  /costs            — View/set cost limits', color: 'white' });
      addLine({ text: '  /agent            — Show or switch active agent', color: 'white' });
      addLine({ text: '  /create-agent     — Create agent via block-forge', color: 'white' });
      addLine({ text: '  /playground       — Model playground', color: 'white' });
      addLine({ text: '  /quit             — Quit', color: 'white' });
      addLine({ text: '' });
      addLine({ text: 'Keyboard:', color: 'cyan', bold: true });
      addLine({ text: '  /        — Focus input bar', color: 'white' });
      addLine({ text: '  Escape   — Close widget / return to navigation', color: 'white' });
      addLine({ text: '  j/k      — Navigate within focused widget', color: 'white' });
      addLine({ text: '  ?        — Toggle keyboard shortcuts overlay', color: 'white' });
      addLine({ text: '  Ctrl+C   — Cancel task (when busy) or quit', color: 'white' });
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
    // Widget slash commands (Phase 63-B) — render inline widgets
    '/status': () => { addWidget('status', {}, true); },
    '/spaces': () => { addWidget('sessions', {}, true); },
    '/sessions': () => { addWidget('sessions', {}, true); },
    '/workspaces': () => { addWidget('workspaces', {}, true); },
    '/repos': () => { addWidget('repos', {}, true); },
    '/catalog': () => { addWidget('catalog', {}, true); },
    '/foundry': () => { addWidget('foundry', {}, true); },
    '/models': () => { addWidget('models', {}, true); },
  }), [handleQuit, handleCancel, addLine, addWidget, sessionManager, apiClient]);

  // ── Handle task submit ──
  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();

    // Return to navigation mode after submitting (classic mode only)
    // In chat-first mode, input stays focused
    if (classicMode) {
      setInputFocused(false);
    }

    // Slash commands — dispatch via map
    const cmd = slashCommands[trimmed];
    if (cmd) { cmd(); return; }

    // Parametric slash commands

    // /spaces with subcommand: /spaces repos, /spaces workspaces, /spaces sessions
    if (trimmed.startsWith('/spaces ')) {
      const sub = input.trim().slice('/spaces '.length).trim().toLowerCase();
      if (sub === 'repos') { addWidget('repos', {}, true); return; }
      if (sub === 'workspaces') { addWidget('workspaces', {}, true); return; }
      if (sub === 'sessions') { addWidget('sessions', {}, true); return; }
    }

    // Widget commands with arguments (Phase 63-B)
    if (trimmed.startsWith('/session ')) {
      const sessionId = input.trim().slice('/session '.length).trim();
      if (sessionId) { addWidget('session-monitor', { sessionId }, true); return; }
    }
    if (trimmed.startsWith('/block ')) {
      const blockId = input.trim().slice('/block '.length).trim();
      if (blockId) { addWidget('block-detail', { blockId }, false); return; }
    }
    if (trimmed.startsWith('/model ')) {
      const modelId = input.trim().slice('/model '.length).trim();
      if (modelId) { addWidget('model-detail', { modelId }, true); return; }
    }
    if (trimmed.startsWith('/workspace ')) {
      const workspaceId = input.trim().slice('/workspace '.length).trim();
      if (workspaceId) { addWidget('workspace-detail', { workspaceId }, true); return; }
    }
    if (trimmed.startsWith('/repo ')) {
      const repoId = input.trim().slice('/repo '.length).trim();
      if (repoId) { addWidget('repo-detail', { repoId }, true); return; }
    }
    if (trimmed.startsWith('/permissions ')) {
      const sessionId = input.trim().slice('/permissions '.length).trim();
      if (sessionId) { addWidget('permissions', { sessionId }, false); return; }
    }
    // /catalog with filter: /catalog agents, /catalog tools, /catalog workflows
    if (trimmed.startsWith('/catalog ')) {
      const filter = input.trim().slice('/catalog '.length).trim().toLowerCase();
      const filterMap: Record<string, string> = { agents: 'agent', tools: 'tool', workflows: 'workflow' };
      addWidget('catalog', { initialFilter: filterMap[filter] || 'all' }, true);
      return;
    }

    // /costs — view and configure cost limits
    if (trimmed === '/costs' || trimmed.startsWith('/costs ')) {
      const parsed = parseCostsCommand(trimmed);
      if (!parsed) {
        addLine({ text: '' });
        addLine({ text: 'Usage: /costs [summary|limits|status|set|clear]', color: 'yellow', timestamp: ts() });
        addLine({ text: '  /costs                    Show cost summary + limits', color: 'gray' });
        addLine({ text: '  /costs status             Show limit status & exceeded warnings', color: 'gray' });
        addLine({ text: '  /costs set --per-day 5    Set daily limit to $5', color: 'gray' });
        addLine({ text: '  /costs set --per-day 5 --enforcement warn --auto-resume', color: 'gray' });
        addLine({ text: '  /costs clear              Remove all limits', color: 'gray' });
        addLine({ text: '' });
        return;
      }

      if (parsed.action === 'summary') {
        addLine({ text: '' });
        addLine({ text: 'Fetching cost summary...', color: 'cyan', timestamp: ts() });
        setTimeout(async () => {
          try {
            const summary = await apiClient.getCostsSummary();
            const limits = await apiClient.getCostsLimits();
            addLine({ text: '' });
            addLine({ text: 'Cost Summary', color: 'cyan', bold: true, timestamp: ts() });
            const today = summary?.today || {};
            const week = summary?.thisWeek || {};
            const month = summary?.thisMonth || {};
            addLine({ text: `  Today:      $${(today.totalCost ?? 0).toFixed(2)}  (${today.requestCount ?? 0} requests)`, color: 'white' });
            addLine({ text: `  This week:  $${(week.totalCost ?? 0).toFixed(2)}  (${week.requestCount ?? 0} requests)`, color: 'white' });
            addLine({ text: `  This month: $${(month.totalCost ?? 0).toFixed(2)}  (${month.requestCount ?? 0} requests)`, color: 'white' });
            addLine({ text: '' });
            addLine({ text: 'Limits', color: 'cyan', bold: true });
            const getLimitValue = (limit: any): number | null => {
              if (limit == null) return null;
              if (typeof limit === 'number') return limit;
              if (typeof limit === 'object' && limit.value != null) return Number(limit.value);
              return null;
            };
            const fmtLimit = (val: any) => { const n = getLimitValue(val); return n != null ? `$${n.toFixed(2)}` : 'not set'; };
            const remaining = (val: any, spent: number) => { const n = getLimitValue(val); return n != null ? `  (remaining: $${Math.max(0, n - spent).toFixed(2)})` : ''; };
            addLine({ text: `  Per session: ${fmtLimit(limits?.maxPerSession)}`, color: 'white' });
            addLine({ text: `  Per day:     ${fmtLimit(limits?.maxPerDay)}${remaining(limits?.maxPerDay, today.totalCost ?? 0)}`, color: 'white' });
            addLine({ text: `  Per week:    ${fmtLimit(limits?.maxPerWeek)}${remaining(limits?.maxPerWeek, week.totalCost ?? 0)}`, color: 'white' });
            addLine({ text: `  Per month:   ${fmtLimit(limits?.maxPerMonth)}${remaining(limits?.maxPerMonth, month.totalCost ?? 0)}`, color: 'white' });
            addLine({ text: '' });
          } catch (err: any) {
            addLine({ text: `Error: ${err?.message || 'Backend not connected'}`, color: 'red', timestamp: ts() });
            addLine({ text: '' });
          }
        }, 0);
        return;
      }

      if (parsed.action === 'limits') {
        addLine({ text: '' });
        addLine({ text: 'Fetching cost limits...', color: 'cyan', timestamp: ts() });
        setTimeout(async () => {
          try {
            const limits = await apiClient.getCostsLimits();
            addLine({ text: '' });
            addLine({ text: 'Cost Limits', color: 'cyan', bold: true, timestamp: ts() });
            const getLimitValue = (limit: any): number | null => {
              if (limit == null) return null;
              if (typeof limit === 'number') return limit;
              if (typeof limit === 'object' && limit.value != null) return Number(limit.value);
              return null;
            };
            const fmtLimit = (val: any) => { const n = getLimitValue(val); return n != null ? `$${n.toFixed(2)}` : 'not set'; };
            addLine({ text: `  Per session: ${fmtLimit(limits?.maxPerSession)}`, color: 'white' });
            addLine({ text: `  Per day:     ${fmtLimit(limits?.maxPerDay)}`, color: 'white' });
            addLine({ text: `  Per week:    ${fmtLimit(limits?.maxPerWeek)}`, color: 'white' });
            addLine({ text: `  Per month:   ${fmtLimit(limits?.maxPerMonth)}`, color: 'white' });
            addLine({ text: '' });
          } catch (err: any) {
            addLine({ text: `Error: ${err?.message || 'Backend not connected'}`, color: 'red', timestamp: ts() });
            addLine({ text: '' });
          }
        }, 0);
        return;
      }

      if (parsed.action === 'status') {
        addLine({ text: '' });
        addLine({ text: 'Fetching cost status...', color: 'cyan', timestamp: ts() });
        setTimeout(async () => {
          try {
            const summary = await apiClient.getCostsSummary();
            addLine({ text: '' });
            addLine({ text: 'Cost Status', color: 'cyan', bold: true, timestamp: ts() });
            const today = summary?.today || {};
            const limitsObj = summary?.limits || {};
            // Helper: extract limit value and enforcement from either format
            const extractLimit = (raw: any): { value: number | null; enforcement: string; autoResume: boolean } => {
              if (raw == null) return { value: null, enforcement: 'block', autoResume: false };
              if (typeof raw === 'number') return { value: raw, enforcement: 'block', autoResume: false };
              if (typeof raw === 'object') return { value: raw.value ?? null, enforcement: raw.enforcement || 'block', autoResume: raw.autoResume || false };
              return { value: null, enforcement: 'block', autoResume: false };
            };
            const checks = [
              { label: 'Daily', current: today.totalCost ?? 0, limit: extractLimit(limitsObj.maxPerDay) },
              { label: 'Weekly', current: summary?.thisWeek?.totalCost ?? 0, limit: extractLimit(limitsObj.maxPerWeek) },
              { label: 'Monthly', current: summary?.thisMonth?.totalCost ?? 0, limit: extractLimit(limitsObj.maxPerMonth) },
            ];
            let anyExceeded = false;
            for (const c of checks) {
              if (c.limit.value != null && c.current >= c.limit.value) {
                anyExceeded = true;
                const isBlock = c.limit.enforcement === 'block';
                const statusMsg = isBlock ? 'Executions are STOPPED' : 'Executions continue with warning';
                const color = isBlock ? 'red' : 'yellow';
                addLine({ text: `  ${c.label} limit EXCEEDED: $${c.current.toFixed(2)} / $${c.limit.value.toFixed(2)} (enforcement: ${c.limit.enforcement})`, color });
                addLine({ text: `    ${statusMsg}`, color });
                if (c.limit.autoResume) {
                  addLine({ text: `    Auto-resume: on`, color: 'gray' });
                }
              }
            }
            if (!anyExceeded) {
              addLine({ text: '  No limits exceeded.', color: 'green' });
              for (const c of checks) {
                if (c.limit.value != null) {
                  const remaining = Math.max(0, c.limit.value - c.current);
                  addLine({ text: `  ${c.label}: $${c.current.toFixed(2)} / $${c.limit.value.toFixed(2)}  (remaining: $${remaining.toFixed(2)}, enforcement: ${c.limit.enforcement})`, color: 'white' });
                }
              }
            }
            addLine({ text: '' });
          } catch (err: any) {
            addLine({ text: `Error: ${err?.message || 'Backend not connected'}`, color: 'red', timestamp: ts() });
            addLine({ text: '' });
          }
        }, 0);
        return;
      }

      if (parsed.action === 'set' && parsed.limits) {
        addLine({ text: '' });
        addLine({ text: 'Updating cost limits...', color: 'cyan', timestamp: ts() });
        setTimeout(async () => {
          try {
            const existing = await apiClient.getCostsLimits();
            const merged = { ...existing };
            const enforcementVal = parsed.enforcement || 'block';
            const autoResumeVal = parsed.autoResume || false;
            // Build new-format limit objects with enforcement/autoResume
            const buildLimitObj = (value: number) => ({ value, enforcement: enforcementVal, autoResume: autoResumeVal });
            if (parsed.limits!.perSession !== undefined) merged.maxPerSession = buildLimitObj(parsed.limits!.perSession);
            if (parsed.limits!.perDay !== undefined) merged.maxPerDay = buildLimitObj(parsed.limits!.perDay);
            if (parsed.limits!.perWeek !== undefined) merged.maxPerWeek = buildLimitObj(parsed.limits!.perWeek);
            if (parsed.limits!.perMonth !== undefined) merged.maxPerMonth = buildLimitObj(parsed.limits!.perMonth);
            await apiClient.setCostsLimits(merged);
            addLine({ text: '' });
            const parts: string[] = [];
            const enforcementSuffix = ` (${enforcementVal}${autoResumeVal ? ', auto-resume' : ''})`;
            if (parsed.limits!.perSession !== undefined) parts.push(`per-session = $${parsed.limits!.perSession.toFixed(2)}`);
            if (parsed.limits!.perDay !== undefined) parts.push(`per-day = $${parsed.limits!.perDay.toFixed(2)}`);
            if (parsed.limits!.perWeek !== undefined) parts.push(`per-week = $${parsed.limits!.perWeek.toFixed(2)}`);
            if (parsed.limits!.perMonth !== undefined) parts.push(`per-month = $${parsed.limits!.perMonth.toFixed(2)}`);
            addLine({ text: `Cost limits updated: ${parts.join(', ')}${enforcementSuffix}`, color: 'green', bold: true, timestamp: ts() });
            addLine({ text: '' });
          } catch (err: any) {
            addLine({ text: `Error: ${err?.message || 'Backend not connected'}`, color: 'red', timestamp: ts() });
            addLine({ text: '' });
          }
        }, 0);
        return;
      }

      if (parsed.action === 'clear') {
        addLine({ text: '' });
        addLine({ text: 'Clearing cost limits...', color: 'cyan', timestamp: ts() });
        setTimeout(async () => {
          try {
            await apiClient.setCostsLimits({ maxPerSession: null, maxPerDay: null, maxPerWeek: null, maxPerMonth: null });
            addLine({ text: '' });
            addLine({ text: 'All cost limits cleared.', color: 'green', bold: true, timestamp: ts() });
            addLine({ text: '' });
          } catch (err: any) {
            addLine({ text: `Error: ${err?.message || 'Backend not connected'}`, color: 'red', timestamp: ts() });
            addLine({ text: '' });
          }
        }, 0);
        return;
      }

      return;
    }

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

      // Use setTimeout to decouple from React's synchronous commit phase
      setTimeout(async () => {
        try {
          // Pre-flight: verify apiClient is available
          const client = apiClient as IMaestroCodeApiClient;
          if (!client || typeof client.createSession !== 'function') {
            addLine({ text: 'Error: Backend not connected. Wait for connection or restart.', color: 'red', timestamp: ts() });
            return;
          }
          if (!importSessionTemplate) {
            addLine({ text: 'Error: importSessionTemplate not available (demo mode?)', color: 'red', timestamp: ts() });
            return;
          }

          // Helper: yield a full event-loop tick so Ink can flush renders.
          // Without this, calling addLine() then fetch() blocks the event loop
          // because Ink's synchronous stdout.write races with undici's microtasks.
          const tick = () => new Promise<void>(resolve => globalThis.setTimeout(resolve, 10));
          const baseUrl = (await client.getApiUrl?.()) || 'http://localhost:5000';

          // Use node:http instead of undici (globalThis.fetch) — undici blocks
          // the event loop for write requests inside Ink's render cycle.
          const { request: httpReq } = await import('node:http');
          const httpCall = (method: string, path: string, body?: Record<string, unknown> | unknown) =>
            new Promise<{ status: number; data: any }>((resolve, reject) => {
              const payload = body != null ? JSON.stringify(body) : '';
              const url = new URL(path, baseUrl);
              const req = httpReq(
                { hostname: url.hostname, port: url.port, path: url.pathname, method,
                  headers: body != null ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {} },
                (res) => {
                  let data = '';
                  res.on('data', (chunk: Buffer) => { data += chunk; });
                  res.on('end', () => {
                    try { resolve({ status: res.statusCode || 0, data: data ? JSON.parse(data) : null }); }
                    catch { resolve({ status: res.statusCode || 0, data }); }
                  });
                },
              );
              req.on('error', reject);
              if (payload) req.write(payload);
              req.end();
            });

          // Step 1: Create session
          addLine({ text: '  [1/4] Creating session...', color: 'gray' });
          await tick();
          const r1 = await httpCall('POST', '/api/sessions', {
            repositoryPath: sessionManager?.getRepoPath() || process.cwd(),
            authority: 'human',
            name: `Block Forge - ${description.slice(0, 40)}`,
          });
          if (r1.status >= 400) throw new Error(`createSession: ${r1.status}`);
          const session = r1.data as { id: string };
          addLine({ text: `  [1/4] Session created (${session.id.slice(0, 8)})`, color: 'gray' });
          await tick();

          // Step 2: Import block-forge template — inline to avoid SDK/fetch calls
          addLine({ text: '  [2/4] Importing block-forge template...', color: 'gray' });
          await tick();
          {
            const fs = await import('node:fs');
            const nodePath = await import('node:path');
            const contentBase = process.env.MAESTRO_CONTENT_PATH
              || nodePath.default.join(process.env.MAESTRO_ROOT || 'C:\\Meastro', 'content', 'system');
            const tplPath = nodePath.default.join(contentBase, 'templates', 'sessions', 'block-forge.session.json');
            const tpl = JSON.parse(fs.default.readFileSync(tplPath, 'utf8'));
            // Import variables
            if (tpl.variables) {
              for (const [key, value] of Object.entries(tpl.variables)) {
                if (value == null) continue;
                await httpCall('PUT', `/api/sessions/${session.id}/variables/${key}`, { value });
                await tick();
              }
            }
            // Import entry points
            if (tpl.entryPoints) {
              for (const [name, workflowId] of Object.entries(tpl.entryPoints)) {
                await httpCall('PUT', `/api/sessions/${session.id}/entry-points/${encodeURIComponent(name)}`, { workflowId });
                await tick();
              }
            }
            // Import widgets
            if (tpl.monitorWidgets) {
              for (const widget of tpl.monitorWidgets as any[]) {
                await httpCall('POST', `/api/sessions/${session.id}/widgets`, widget);
                await tick();
              }
            }
          }
          addLine({ text: '  [2/4] Template imported', color: 'gray' });
          await tick();

          // Step 3: Start session
          addLine({ text: '  [3/4] Starting session...', color: 'gray' });
          await tick();
          await httpCall('POST', `/api/sessions/${session.id}/start`);

          // Step 4: Invoke the default entry point
          addLine({ text: '  [4/4] Invoking block-forge workflow...', color: 'gray' });
          await tick();
          await httpCall('POST', `/api/sessions/${session.id}/invoke/default`, {
            inputs: { description, contractId: contract, targetModel: model },
          });

          addLine({ text: `  Block-forge session started (${session.id.slice(0, 8)})`, color: 'green', timestamp: ts() });
          addLine({ text: '  Polling for completion...', color: 'gray' });

          // Poll for completion — check _activeWorkflow to know if workflow is still running
          let pollCount = 0;
          let lastStep = '';
          const poll = setInterval(async () => {
            try {
              pollCount++;
              const pr = await httpCall('GET', `/api/sessions/${session.id}`);
              const s = pr.data as any;
              const vars = (s as any).variables || {};
              const activeWorkflow = vars._activeWorkflow || '';
              const status = ((s as any).status || '').toLowerCase();

              // Workflow still running — show progress with current step + cost
              if (activeWorkflow && status !== 'error') {
                if (pollCount % 10 === 0) {
                  const mins = Math.round(pollCount * 3 / 60);
                  const cost = vars._accumulatedCost ? `$${Number(vars._accumulatedCost).toFixed(3)}` : '';
                  // Show current step if changed
                  let stepInfo = '';
                  try {
                    const ab = typeof vars._activeBlock === 'string' ? JSON.parse(vars._activeBlock) : vars._activeBlock;
                    if (ab?.name && ab.name !== lastStep) {
                      lastStep = ab.name;
                      stepInfo = ` — ${ab.name}`;
                    }
                  } catch { /* ignore parse errors */ }
                  addLine({ text: `  ${mins}min${stepInfo}${cost ? ` (${cost})` : ''}`, color: 'gray' });
                }
                return;
              }

              // Workflow completed (or errored)
              clearInterval(poll);
              const published = vars._forgePublished || vars.published || 'false';
              const cost = vars._accumulatedCost ? `$${Number(vars._accumulatedCost).toFixed(4)}` : 'N/A';
              // blockId/fitness may contain raw LLM text (>100 chars) if agent output extraction failed
              const rawBlockId = vars.blockId || '';
              const rawFitness = vars.fitness || '';
              const blockId = rawBlockId.length > 80 ? '(see session details)' : (rawBlockId || 'N/A');
              const fitness = rawFitness.length > 20 ? 'N/A' : (rawFitness || 'N/A');

              if (status === 'error') {
                addLine({ text: '' });
                addLine({ text: 'Block Forge Failed', color: 'red', bold: true, timestamp: ts() });
                addLine({ text: `  Error: ${(s as any).errorMessage || 'Unknown error'}`, color: 'red' });
                addLine({ text: `  Cost:  ${cost}`, color: 'gray' });
              } else {
                addLine({ text: '' });
                addLine({ text: 'Block Forge Complete', color: 'cyan', bold: true, timestamp: ts() });
                addLine({ text: `  Block:     ${blockId}`, color: 'white' });
                addLine({ text: `  Fitness:   ${fitness}`, color: published === 'true' ? 'green' : 'yellow' });
                addLine({ text: `  Published: ${published === 'true' ? 'Yes' : 'No (below threshold)'}`, color: published === 'true' ? 'green' : 'red' });
                addLine({ text: `  Cost:      ${cost}`, color: 'gray' });
                addLine({ text: `  Session:   ${session.id.slice(0, 8)} (view in Spaces [S])`, color: 'gray' });
              }
              addLine({ text: '' });
            } catch { /* polling error — ignore */ }
          }, 3000);
          // Timeout after 15 minutes — notify user instead of silent stop
          setTimeout(() => {
            clearInterval(poll);
            addLine({ text: '' });
            addLine({ text: 'Polling timed out (15 min). Workflow may still be running.', color: 'yellow', timestamp: ts() });
            addLine({ text: `  Check session ${session.id.slice(0, 8)} in Spaces [S] for results.`, color: 'gray' });
            addLine({ text: '' });
          }, 15 * 60 * 1000);
        } catch (err: any) {
          addLine({ text: `Error: ${err?.message || String(err)}`, color: 'red', timestamp: ts() });
        }
      }, 0);
      return;
    }

    // /playground — open model playground
    if (trimmed === '/playground' || trimmed.startsWith('/playground ')) {
      const arg = input.trim().slice('/playground'.length).trim();
      if (arg) {
        if (classicMode) {
          // Classic mode: navigate to model detail view
          setCurrentPage('models');
          setNavStack([]);
          setDetailView({ type: 'model', id: arg });
          setRestoredState(null);
        } else {
          // Chat-first mode: inject model-detail widget
          addWidget('model-detail', { modelId: arg }, true);
        }
      } else {
        if (classicMode) {
          setCurrentPage('models');
          setNavStack([]);
          setDetailView(null);
          setRestoredState(null);
        } else {
          addWidget('models', {}, true);
        }
        addLine({ text: '' });
        addLine({ text: 'Navigate to a model and press Enter, then [T] to open the playground.', color: 'cyan', timestamp: ts() });
        addLine({ text: '' });
      }
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

    // Unknown slash command — show error instead of sending to agent
    if (trimmed.startsWith('/')) {
      addLine({ text: '' });
      addLine({ text: `Unknown command: ${trimmed.split(' ')[0]}. Type /help for available commands.`, color: 'yellow', timestamp: ts() });
      addLine({ text: '' });
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
      }, addWidget).then(() => {
        const id = sessionManager.getSessionId();
        if (id) {
          setCurrentSessionId(id);
          sessionManager.startWidgetPolling(addLine, setCurrentWidget, setPendingInteractive);
        }
      });
    }
  }, [addLine, addWidget, sessionManager, busy, pendingInteractive, history, slashCommands]);

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

  // ── Classic mode: detail views (only in classic mode) ──
  if (classicMode && detailView) {
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

    return h(FullscreenBox, null, detailComponent);
  }

  // ── Classic mode: page routing (NavBar + page switching + hotkeys) ──
  if (classicMode) {
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
      pageComponent = h(HelpOverlay, { currentPage, onClose: () => setShowHelp(false), classic: true });
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
            focusedWidgetId,
            collapsedWidgets,
            onWidgetClose: collapseWidget,
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
      h(StatusBar, { currentPage, connectionStatus, latency: connLatency, lastRefresh, dailyCost, costLimitStatus }),
    );
  }

  // ── Chat-first mode (default): single Agent screen + widgets ──
  return h(FullscreenBox, null,
    showHelp
      ? h(HelpOverlay, { onClose: () => setShowHelp(false), classic: false })
      : h(ChatFirstScreen, {
          apiClient,
          onQuit: handleQuit,
          lines,
          agentState,
          sessionId: currentSessionId,
          busy,
          lastOutput: sessionManager?.getLastOutput() || null,
          repoPath: sessionManager?.getRepoPath() || repoPath || null,
          activeAgent,
          focusedWidgetId,
          collapsedWidgets,
          onWidgetClose: collapseWidget,
          onWidgetNavigate: handleWidgetNavigate,
        }),
    !showHelp
      ? h(TaskInputBar, {
          onSubmit: handleSubmit,
          disabled: busy && !pendingInteractive,
          placeholder: busy ? 'Send a message to the agent...' : 'Describe your task...',
          onUpArrow: history.prev,
          onDownArrow: history.next,
          captureInput: inputFocused,
          alwaysActive: true,
          inputValueRef,
        })
      : null,
    h(ChatStatusBar, {
      connectionStatus,
      latency: connLatency,
      lastRefresh,
      dailyCost,
      costLimitStatus,
      focusedWidgetId,
      apiClient,
    }),
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
  const classicMode = options.classic || false;
  const hasProviders = options.hasProviders === true;
  const sidecar = options.sidecar || null;
  const ensureBackendFn = options.ensureBackendFn || null;

  // No API client, no demo mode, and providers already configured → show error
  const apiClient = options.apiClient || null;
  const needsSetup = !hasProviders && !demoMode;
  const appContent = (!apiClient && !demoMode && !needsSetup)
    ? h(NoBackendScreen)
    : h(App, {
        apiClient, sessionManager, demoMode, repoPath: options.repoPath, noBell,
        hasProviders, ensureBackendFn,
        saveProviders: options.saveProviders || null,
        readProviders: options.readProviders || null,
        importSessionTemplate: options.importSessionTemplate || null,
        template: options.template || null,
        entryPoint: options.entryPoint || null,
        classic: classicMode,
      } as AppProps);
  const rootComponent = h(FocusProvider, null, appContent);

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
