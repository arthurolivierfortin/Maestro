// @ts-nocheck
/**
 * Maestro Interactive Mode — Spatial TUI (Phase 41-C)
 *
 * Spatial full-screen page navigation on a 2D grid.
 * Pages: Agent (0,0), Execution (0,-1), Catalog (-1,0), Spaces (1,0), Models (0,1).
 *
 * Agent page has 3 visual states: idle (mascotte centered), working (compact + ConversationLog),
 * completed (celebrating + summary). SessionManager extracted to services/.
 *
 * Navigation:
 * - Ctrl+Arrow: navigate to adjacent page (computed from Page Registry)
 * - Esc: return to Agent (home) / close detail / unzoom
 * - Ctrl+Tab: quick-switch between last 2 pages
 * - Slash commands: /catalog, /spaces, /models, /help, /agent
 */

import { createElement as h, useState, useCallback, useEffect, useRef } from 'react';
import { render, useApp, useStdout, Box, Text, useInput } from 'ink';
import { setTerminalBg, resetTerminalBg, palette } from '@maestro/tui/theme';
import type { PanelId } from './layouts/FlipperLayout.ts';
import { CatalogBrowser } from './screens/CatalogBrowser.ts';
import { SessionBrowser } from './screens/SessionBrowser.ts';
import { ModelsBrowser } from './screens/ModelsBrowser.ts';
import { BlockDetailScreen } from './screens/BlockDetailScreen.ts';
import { SessionDetailScreen } from './screens/SessionDetailScreen.ts';
import { ModelDetailScreen } from './screens/ModelDetailScreen.ts';
import { HelpOverlay } from './screens/HelpOverlay.ts';
import { WelcomeScreen } from './screens/WelcomeScreen.ts';
import { SplashScreen } from './screens/SplashScreen.ts';
import { useInputHistory } from './hooks/useInputHistory.ts';
import { useSpatialNav } from './hooks/useSpatialNav.ts';
import { createDefaultRegistry } from './registry/index.ts';
import { SpatialStatusBar } from './components/SpatialStatusBar.ts';
import { TransitionWipe } from './components/TransitionWipe.ts';
import { AgentPage } from './pages/AgentPage.ts';
import type { AgentState } from './types.ts';
import { SessionManager, ts } from './services/SessionManager.ts';
import type { LogLine, InteractiveOptions, Widget } from './services/SessionManager.ts';
import * as nodePath from 'path';
import * as nodeFs from 'fs';


// ── Demo Client ──────────────────────────────────────────────
// Returns a fake API client for --demo mode with staged mock data
// that populates the cockpit panels (WorkflowTree, ExecutionLog, LLMActivity).

function createDemoClient() {
  const DEMO_SESSION_ID = 'demo-0000-1111-2222-333344445555';
  let startTime = 0;

  // Mock execution tree that evolves over time
  const getTree = (elapsed: number) => {
    const nodes = [
      { id: 'prepare', name: 'Prepare', status: elapsed > 500 ? 'completed' : 'running', children: [] },
      { id: 'plan', name: 'Plan', status: elapsed > 2000 ? 'completed' : elapsed > 500 ? 'running' : 'pending', children: [
        { id: 'analyze', name: 'Analyze Codebase', status: elapsed > 1200 ? 'completed' : elapsed > 600 ? 'running' : 'pending', children: [] },
        { id: 'design', name: 'Design Solution', status: elapsed > 2000 ? 'completed' : elapsed > 1200 ? 'running' : 'pending', children: [] },
      ] },
      { id: 'implement', name: 'Implement', status: elapsed > 4000 ? 'completed' : elapsed > 2000 ? 'running' : 'pending', children: [
        { id: 'code', name: 'Write Code', status: elapsed > 3000 ? 'completed' : elapsed > 2200 ? 'running' : 'pending', children: [] },
        { id: 'test', name: 'Run Tests', status: elapsed > 4000 ? 'completed' : elapsed > 3000 ? 'running' : 'pending', children: [] },
      ] },
      { id: 'review', name: 'Review', status: elapsed > 5000 ? 'completed' : elapsed > 4000 ? 'running' : 'pending', children: [] },
      { id: 'commit', name: 'Commit', status: elapsed > 6000 ? 'completed' : elapsed > 5000 ? 'running' : 'pending', children: [] },
    ];
    return nodes;
  };

  // Mock execution log entries
  const getLog = (elapsed: number) => {
    const entries: any[] = [];
    if (elapsed > 200) entries.push({ msg: 'Session initialized', level: 'info', time: ts() });
    if (elapsed > 600) entries.push({ msg: 'Analyzing repository structure...', level: 'info', time: ts() });
    if (elapsed > 1200) entries.push({ msg: 'Found 12 source files, 3 test files', level: 'info', time: ts() });
    if (elapsed > 1800) entries.push({ msg: 'Design: 3 steps identified', level: 'info', time: ts() });
    if (elapsed > 2200) entries.push({ msg: 'Writing implementation...', level: 'info', time: ts() });
    if (elapsed > 3000) entries.push({ msg: 'Code generation complete', level: 'info', time: ts() });
    if (elapsed > 3200) entries.push({ msg: 'Running test suite...', level: 'info', time: ts() });
    if (elapsed > 4000) entries.push({ msg: 'All 8 tests passed', level: 'info', time: ts() });
    if (elapsed > 4500) entries.push({ msg: 'Reviewing changes...', level: 'info', time: ts() });
    if (elapsed > 5200) entries.push({ msg: 'Review: no issues found', level: 'info', time: ts() });
    if (elapsed > 5500) entries.push({ msg: 'Creating commit...', level: 'info', time: ts() });
    if (elapsed > 6000) entries.push({ msg: 'Committed: feat: add login page', level: 'info', time: ts() });
    return entries;
  };

  // Mock LLM activity
  const getLLM = (elapsed: number) => {
    const entries: any[] = [];
    if (elapsed > 600) entries.push({ nodeId: 'analyze', time: ts(), duration: 580, promptPreview: 'Analyze this repository...', responsePreview: 'Repository contains a TypeScript project with...' });
    if (elapsed > 1800) entries.push({ nodeId: 'design', time: ts(), duration: 920, promptPreview: 'Design a solution for...', responsePreview: 'Step 1: Create auth module. Step 2: Add routes...' });
    if (elapsed > 2800) entries.push({ nodeId: 'code', time: ts(), duration: 1450, promptPreview: 'Implement the following plan...', responsePreview: 'Created src/auth.ts with login(), logout()...' });
    if (elapsed > 4500) entries.push({ nodeId: 'review', time: ts(), duration: 340, promptPreview: 'Review these changes...', responsePreview: 'Changes look correct. No security issues.' });
    return entries;
  };

  return {
    _fetch: async (method: string, path: string) => {
      if (path === '/api/health') return { status: 'ok' };
      return {};
    },
    getSession: async (id: string) => {
      const elapsed = Date.now() - startTime;
      const tree = getTree(elapsed);
      const allDone = tree.every(n => n.status === 'completed');
      return {
        id,
        status: allDone ? 'idle' : 'running',
        variables: {
          _executionTree: tree,
          _executionLog: getLog(elapsed),
          _llmActivity: getLLM(elapsed),
          _scoreHistory: elapsed > 3000 ? [0.3, 0.5, 0.7, 0.85] : [0.3],
          currentFitness: elapsed > 4000 ? 0.85 : elapsed > 2000 ? 0.5 : 0.3,
        },
      };
    },
    createSession: async (opts: any) => {
      startTime = Date.now();
      return { id: DEMO_SESSION_ID };
    },
    startSession: async () => {},
    DEMO_SESSION_ID,
    _startTime: () => { startTime = Date.now(); },
  };
}

// ── ConversationLog re-export (replaces old OutputPanel) ──

import { ConversationLog } from './components/ConversationLog.ts';


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

// ── Slash commands → page IDs ─────────────────────────────────

const SLASH_COMMANDS: Record<string, string | 'session-current' | 'help'> = {
  '/catalog': 'catalog',
  '/c': 'catalog',
  '/sessions': 'spaces',
  '/spaces': 'spaces',
  '/s': 'spaces',
  '/models': 'models',
  '/m': 'models',
  '/help': 'help',
  '/?': 'help',
  '/agent': 'agent',
  '/a': 'agent',
  '/home': 'agent',
  '/execution': 'execution',
  '/e': 'execution',
  '/session': 'session-current',
};

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

const InteractiveApp = ({ sessionManager: smProp, apiClient: clientProp, isFirstRun, repoPath, demoMode }: {
  sessionManager: SessionManager | null;
  apiClient?: any;
  isFirstRun?: boolean;
  repoPath?: string;
  demoMode?: boolean;
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);

  // ── Demo mode: create internal mock client + session manager ──
  const [demoSetup] = useState(() => {
    if (demoMode) {
      const client = createDemoClient();
      return { client, sm: new SessionManager({ apiClient: client }) };
    }
    return null;
  });
  const sessionManager = demoMode ? (demoSetup?.sm || null) : (smProp || null);
  const apiClient = demoMode ? (demoSetup?.client || null) : (clientProp || null);

  // ── Spatial navigation ──
  const [registry] = useState(() => createDefaultRegistry());
  const spatialNav = useSpatialNav(registry, isFirstRun ? 'agent' : 'agent');
  const [showWelcome, setShowWelcome] = useState(!!isFirstRun);
  const [showHelp, setShowHelp] = useState(false);
  const history = useInputHistory();

  // ── Agent state (simple — full Agent-in-the-Cockpit is 41-F) ──
  const [agentState, setAgentState] = useState<AgentState>('idle');

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
    // Ctrl+C: quit
    if (input === 'c' && key.ctrl) {
      if (sessionManager) sessionManager.stopPolling();
      exit();
    }
    // Ctrl+V: toggle voice
    if (input === 'v' && key.ctrl) {
      setVoiceMode(v => !v);
    }
    // Ctrl+D: jump to session detail
    if (input === 'd' && key.ctrl && currentSessionId) {
      spatialNav.openDetail({ type: 'session-detail', id: currentSessionId });
      return;
    }

    // Ctrl+Arrow: spatial navigation (only when NOT on agent with active zoom/panel)
    if (key.ctrl && !key.meta) {
      if (key.upArrow) { spatialNav.navigate('up'); return; }
      if (key.downArrow) { spatialNav.navigate('down'); return; }
      // Ctrl+Left/Right for spatial nav (only when NOT in agent hero mode typing)
      if (key.leftArrow && spatialNav.currentPageId !== 'agent') { spatialNav.navigate('left'); return; }
      if (key.rightArrow && spatialNav.currentPageId !== 'agent') { spatialNav.navigate('right'); return; }
      // From non-agent pages, Ctrl+Left/Right always navigates
      if (key.leftArrow) { spatialNav.navigate('left'); return; }
      if (key.rightArrow) { spatialNav.navigate('right'); return; }
    }

    // Ctrl+Tab: quick-switch between last 2 pages
    if (key.tab && key.ctrl) {
      spatialNav.quickSwitch();
      return;
    }

    // Esc: close help → close detail → go home (FlipperLayout handles internal Esc)
    if (key.escape) {
      if (showHelp) { setShowHelp(false); return; }
      if (spatialNav.detailScreen) { spatialNav.closeDetail(); return; }
      if (spatialNav.currentPageId !== 'agent') { spatialNav.goHome(); return; }
    }

    // ?: toggle help (only when not typing on agent page)
    if (input === '?' && spatialNav.currentPageId !== 'agent') {
      setShowHelp(v => !v);
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
    const maestroDir = nodePath.join(initPath, '.maestro');
    const fs = nodeFs;
    try {
      const dirs = ['blocks', 'docs', 'logs', 'artifacts', 'metrics', 'sandboxes'];
      fs.mkdirSync(maestroDir, { recursive: true });
      dirs.forEach((d: string) => fs.mkdirSync(nodePath.join(maestroDir, d), { recursive: true }));
      const config = { template: 'project-autonomous', model: 'auto', stack: 'unknown' };
      fs.writeFileSync(nodePath.join(maestroDir, 'config.json'), JSON.stringify(config, null, 2));
      fs.writeFileSync(nodePath.join(maestroDir, 'aliases.json'), JSON.stringify({}, null, 2));
      fs.writeFileSync(nodePath.join(maestroDir, 'README.md'), '# Maestro Project\n\nInitialized by `maestro code`.\n');
      addLine({ text: `Initialized .maestro/ in ${initPath}`, color: 'green', bold: true });
    } catch (err: any) {
      addLine({ text: `Failed to initialize: ${err.message}`, color: 'red' });
    }
    setShowWelcome(false);
  }, [repoPath, addLine]);

  // ── onNavigate callback for child screens (detail drill-downs) ──
  const handleNavigate = useCallback((target: any) => {
    if (target && target.type && target.id) {
      spatialNav.openDetail({ type: target.type, id: target.id });
    } else if (target && target.type) {
      // Page-level navigation (e.g., from a detail screen link)
      spatialNav.goTo(target.type);
    }
  }, [spatialNav]);

  // ── Handle submit ──
  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim().toLowerCase();

    // Slash commands → spatial navigation
    const slashTarget = SLASH_COMMANDS[trimmed];
    if (slashTarget === 'session-current') {
      if (currentSessionId) {
        spatialNav.openDetail({ type: 'session-detail', id: currentSessionId });
      } else {
        addLine({ text: 'No active session. Start a task first.', color: 'yellow' });
      }
      return;
    }
    if (slashTarget === 'help') {
      setShowHelp(true);
      return;
    }
    if (slashTarget) {
      spatialNav.goTo(slashTarget);
      return;
    }
    if (trimmed === '/back') { spatialNav.closeDetail(); return; }
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

    // Branch 3: First message — create session
    addLine({ text: `> ${input}`, color: 'green', bold: true });

    if (sessionManager) {
      sessionManager.submitTask(input, addLine, (b) => {
        setBusy(b);
        if (!b) {
          if (!demoMode) setCurrentSessionId(null);
          sessionManager.stopWidgetPolling();
          setAgentState('idle');
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
  }, [addLine, sessionManager, busy, pendingInteractive, spatialNav, history, exit, demoMode]);

  // ── Auto-start demo session ──
  const autoStarted = useRef(false);
  useEffect(() => {
    if (demoMode && sessionManager && !autoStarted.current) {
      autoStarted.current = true;
      handleSubmit('Add login page');
    }
  }, [demoMode, sessionManager, handleSubmit]);

  // ── Layout ──
  // No NavBar — SpatialStatusBar at bottom replaces both NavBar and RichStatusBar.
  // Gains ~3 lines of content height compared to the old NavBar+StatusBar.
  const contentHeight = Math.max(rows - 1, 5); // 1 line for SpatialStatusBar

  // Welcome screen overlay
  if (showWelcome) {
    return h(Box, { flexDirection: 'column', width: '100%', height: rows },
      h(WelcomeScreen, {
        onInit: handleInit,
        onSkip: () => setShowWelcome(false),
        onHelp: () => setShowHelp(true),
      }),
    );
  }

  // Help overlay
  if (showHelp) {
    return h(Box, { flexDirection: 'column', width: '100%', height: rows },
      h(HelpOverlay, { onClose: () => setShowHelp(false) }),
    );
  }

  // Transition wipe (brief directional indicator)
  if (spatialNav.transitionDir && spatialNav.transitionTarget) {
    return h(Box, { flexDirection: 'column', width: '100%', height: rows },
      h(TransitionWipe, {
        direction: spatialNav.transitionDir,
        targetPage: spatialNav.transitionTarget,
        height: contentHeight,
      }),
      h(SpatialStatusBar, {
        currentPage: spatialNav.currentPage,
        directionHints: spatialNav.directionHints,
        agentState,
        sessionId: currentSessionId,
        busy,
        connected,
        latency,
        voiceActive: voiceMode,
        focusedPanel: activePanelFocus,
        zoomedPanel: activeZoom,
        demoMode,
      }),
    );
  }

  return h(Box, { flexDirection: 'column', width: '100%', height: rows },
    // Page content (or detail screen)
    spatialNav.detailScreen
      ? renderDetail(spatialNav.detailScreen, contentHeight)
      : renderPage(spatialNav.currentPageId, contentHeight),

    // SpatialStatusBar (always visible)
    h(SpatialStatusBar, {
      currentPage: spatialNav.currentPage,
      directionHints: spatialNav.directionHints,
      agentState,
      sessionId: currentSessionId,
      busy,
      connected,
      latency,
      voiceActive: voiceMode,
      focusedPanel: activePanelFocus,
      zoomedPanel: activeZoom,
      demoMode,
    }),
  );

  function renderPage(pageId: string, height: number) {
    switch (pageId) {
      case 'agent':
        return renderAgentContent();
      case 'execution':
        return h(Box, { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
          h(Text, { color: 'gray', dimColor: true }, 'Execution page — coming in 41-D')
        );
      case 'catalog':
        return h(CatalogBrowser, {
          apiClient, onNavigate: handleNavigate,
          onBack: () => spatialNav.goHome(), onQuit: () => exit(),
          height,
        });
      case 'spaces':
        return h(SessionBrowser, {
          apiClient, onNavigate: handleNavigate,
          onBack: () => spatialNav.goHome(), onQuit: () => exit(),
          height,
        });
      case 'models':
        return h(ModelsBrowser, {
          apiClient, onNavigate: handleNavigate,
          onBack: () => spatialNav.goHome(), onQuit: () => exit(),
          height,
        });
      default:
        return renderAgentContent();
    }
  }

  function renderDetail(detail: { type: string; id: string }, height: number) {
    switch (detail.type) {
      case 'block-detail':
        return h(BlockDetailScreen, {
          blockId: detail.id,
          apiClient, onNavigate: handleNavigate,
          onBack: () => spatialNav.closeDetail(), onQuit: () => exit(),
          height,
        });
      case 'session-detail':
        return h(SessionDetailScreen, {
          sessionId: detail.id,
          apiClient, onNavigate: handleNavigate,
          onBack: () => spatialNav.closeDetail(), onQuit: () => exit(),
          height,
        });
      case 'model-detail':
        return h(ModelDetailScreen, {
          modelId: detail.id,
          apiClient,
          onBack: () => spatialNav.closeDetail(), onQuit: () => exit(),
          height,
        });
      default:
        return renderPage(spatialNav.currentPageId, height);
    }
  }

  function renderAgentContent() {
    return h(Box, { flexDirection: 'column', flexGrow: 1, height: contentHeight },
      // AgentPage: idle/working/celebrating
      h(AgentPage, {
        agentState,
        lines,
        busy,
        connected,
        latency,
        sessionId: currentSessionId,
        height: contentHeight - 3, // reserve 3 for InputPrompt
        onSubmit: handleSubmit,
        onUpArrow: history.prev,
        onDownArrow: history.next,
        currentWidget,
        pendingInteractive,
        voiceMode,
        widgetRenderer: WidgetRenderer,
        demoMode,
      }),
      // InputPrompt (always at bottom)
      h(InputPrompt, {
        onSubmit: handleSubmit,
        disabled: false,
        placeholder: busy ? 'Send a message to the agent...' : 'Describe your task...',
        onUpArrow: history.prev,
        onDownArrow: history.next,
      }),
    );
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

export { startInteractive, InteractiveApp, ConversationLog, InputPrompt, SessionManager, WidgetRenderer };
export type { LogLine, LogLine as InteractiveLogLine, InteractiveOptions, Widget };
