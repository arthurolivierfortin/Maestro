// @ts-nocheck
/**
 * SessionMonitor Component (Ink)
 *
 * The main orchestrator — replaces the blessed SessionMonitor class.
 * Polls session data, detects mode, renders layout with child panels.
 *
 * Props: { sessionId, apiClient, onExit, onQuit, onNavigate?, agentLines?, agentState? }
 *
 * Modes:
 *   'descriptor' — session has _monitorDescriptor variable
 *   'execution'  — session has active workflow / execution tree
 *   'idle'       — no activity detected
 *
 * Keyboard:
 *   Tab/Shift-Tab = cycle panel focus
 *   Up/Down = tree navigate (if focused panel has tree) or scroll
 *   Left/Right = tree expand/collapse (if focused panel has tree)
 *   Enter/Space = toggle expand (if tree) or zoom (if no tree)
 *   Ctrl+Up/Down = scroll focused panel
 *   t/f/w/v/l = panel toggles (execution/idle modes)
 *   q = quit, r = refresh, ? = help, Esc = back/unzoom, z = zoom
 *
 * Mouse:
 *   Click = focus panel (by y-coordinate region)
 *   Scroll wheel = scroll focused panel
 */

import { createElement as h, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text } from 'ink';
import {
  T, primary, secondary, muted, dim, bold, error, warning, running,
  statusColor, statusIcon, icons, theme, prevPage, nextPage,
} from '../theme.ts';
import { useSessionData } from '../hooks/useSessionData.ts';
import { useActionKeyboard } from '../hooks/useKeyboard.ts';
import type { ActionHandlers } from '../hooks/useKeyboard.ts';
import { usePanelFocus } from '@maestro/tui/hooks';
import { useScroll } from '@maestro/tui/hooks';
import { useMouse } from '@maestro/tui/hooks';
import { useTreeNav } from '@maestro/tui/hooks';

// ── Child component imports ─────────────────────────────────────
import { Panel } from './Panel.ts';
import { Header } from './Header.ts';
import { NavBar } from './NavBar.ts';
import { StatusBar } from './StatusBar.ts';
import { WorkflowTree } from './WorkflowTree.ts';
import { PhaseWorkflow } from './PhaseWorkflow.ts';
import { LLMActivity } from './LLMActivity.ts';
import { AgentPanel } from './AgentPanel.ts';
import type { LogLine } from '../services/SessionManager.ts';
import { ExecutionLog } from './ExecutionLog.ts';
import { MetricsPanel } from './MetricsPanel.ts';
import { Variables } from './Variables.ts';
import { Filesystem } from './Filesystem.ts';
import { CommandLog } from './CommandLog.ts';
import { WidgetsPanel } from './WidgetsPanel.ts';
import { BlockDetail } from './BlockDetail.ts';
import { Artifacts } from './Artifacts.ts';

// ── Mode detection ──────────────────────────────────────────────

const detectMode = (session) => {
  if (!session) return 'idle';
  const vars = session.variables || {};
  if (vars._monitorDescriptor) return 'descriptor';
  const hasActiveWorkflow = vars._activeWorkflow
    || session.activeWorkflow
    || (session.status === 'running' && (
      vars._executionTree
      || vars.currentIteration > 0
      || vars.iteration > 0
    ));
  return hasActiveWorkflow ? 'execution' : 'idle';
};

const getActiveWorkflow = (session) => {
  if (!session) return null;
  const vars = session.variables || {};
  return vars._activeWorkflow || session.activeWorkflow || null;
};

// ── Panel names per mode ────────────────────────────────────────

const PANEL_NAMES = {
  descriptor: ['phases', 'llm', 'log'],
  execution: ['agent', 'tree', 'files', 'log'],
  idle: ['vars', 'files', 'logs'],
};

// Panels that support tree navigation
const TREE_PANELS = new Set(['tree', 'phases', 'files']);

// Panels whose content is chronological (newest at bottom) — anchor to bottom
const BOTTOM_ANCHORED = new Set(['log', 'llm', 'agent']);

// ── Panel hit-testing ────────────────────────────────────────────

const getPanelAtPosition = (x, y, mode, rows, cols) => {
  const hh = theme.layout.headerHeight;
  const sb = theme.layout.statusBarHeight;
  const contentHeight = rows - hh - sb;
  if (contentHeight <= 0) return null;

  if (y < hh || y >= rows - sb) return null;

  const contentY = y - hh;

  if (mode === 'descriptor') {
    const middleH = Math.floor(contentHeight * 3 / 4);
    if (contentY < middleH) {
      return x < cols * 0.55 ? 'phases' : 'llm';
    }
    return 'log';
  }

  if (mode === 'execution') {
    const halfH = Math.floor(contentHeight / 2);
    if (contentY < halfH) {
      return x < cols * 0.45 ? 'agent' : 'tree';
    }
    return x < cols * 0.5 ? 'files' : 'log';
  }

  // idle
  const topH = Math.floor(contentHeight * 3 / 5);
  if (contentY < topH) {
    return x < cols * 0.5 ? 'vars' : 'files';
  }
  return 'logs';
};

// ── Help Overlay ────────────────────────────────────────────────

const HelpOverlay = ({ hasBackOption }) => {
  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'single',
    borderColor: 'white',
    paddingX: 2,
    paddingY: 1,
    alignSelf: 'center',
    width: 56,
  },
    h(Text, { bold: true }, '  Maestro Session Monitor'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Panel Navigation:'),
    h(Text, {}, '    Ctrl+Left/Right  Switch panel'),
    h(Text, {}, '    Tab / Shift-Tab  Cycle panel focus'),
    h(Text, {}, '    1-3              Jump to panel'),
    h(Text, {}, '    Enter / z        Zoom focused panel'),
    h(Text, {}, '    Esc              Back / unzoom'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Content (focused panel):'),
    h(Text, {}, '    Up/Down or j/k   Scroll / tree cursor'),
    h(Text, {}, '    Left/Right       Tree collapse/expand'),
    h(Text, {}, '    Ctrl+Up/Down     Scroll 5 lines'),
    h(Text, {}, '    Enter/Space      Toggle expand'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Pages (from anywhere):'),
    h(Text, {}, '    h/s/f/c/m        Jump to page'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Actions:'),
    h(Text, {}, '    r     Refresh'),
    h(Text, {}, '    q     Quit'),
    h(Text, {}, '    ?     This help'),
    h(Text, {}, ''),
    h(Text, { color: 'gray' }, '  Press any key to close...')
  );
};

// ── Error classification ────────────────────────────────────────

const classifyError = (errorMessage) => {
  if (!errorMessage) return { type: 'Unknown', detail: 'No error details available' };
  const msg = errorMessage.toLowerCase();
  if (msg.includes('econnrefused') || msg.includes('connection refused')) {
    return { type: 'Connection Refused', detail: 'Backend server is not running or not accepting connections' };
  }
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnaborted')) {
    return { type: 'Timeout', detail: 'Request timed out — server may be overloaded' };
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return { type: '404 Not Found', detail: 'Session or endpoint does not exist' };
  }
  if (msg.includes('500') || msg.includes('internal server')) {
    return { type: '500 Server Error', detail: 'Internal server error' };
  }
  if (msg.includes('enotfound') || msg.includes('dns')) {
    return { type: 'DNS Error', detail: 'Host not found — check server address' };
  }
  if (msg.includes('network') || msg.includes('fetch failed')) {
    return { type: 'Network Error', detail: 'Network is unreachable' };
  }
  return { type: 'Error', detail: errorMessage };
};

// ── Error Header ────────────────────────────────────────────────

const ErrorHeader = ({ sessionId, errorMessage }) => {
  const shortId = sessionId ? sessionId.substring(0, 8) : '--------';
  const { type, detail } = classifyError(errorMessage);
  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row', gap: 1 },
      T('red', icons.failed),
      T('red', type)
    ),
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('Session: '), dim(shortId)
    ),
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('Detail: '), error(detail)
    ),
    errorMessage && errorMessage !== detail
      ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
          muted('Raw: '), dim(errorMessage.length > 80 ? errorMessage.substring(0, 80) + '...' : errorMessage)
        )
      : null
  );
};

// ── Layout Renderers ────────────────────────────────────────────

/**
 * Helper to build cursorInfo string from treeNav.
 */
const getCursorInfo = (treeNav) => {
  if (!treeNav) return null;
  const nodes = treeNav.getSelectedNode ? treeNav.getSelectedNode() : null;
  // Show cursor position out of total flat nodes
  const total = treeNav.expanded ? treeNav.cursor + 1 : 0;
  return null; // We'll use a simpler approach in the Panel props
};

/**
 * Descriptor mode layout (compliance sessions):
 *   Top:    Header (60%) + MetricsPanel (40%) — fixed height
 *   Middle: PhaseWorkflow (55%) + LLMActivity (45%) — flexGrow 3
 *   Bottom: ExecutionLog (100%) — flexGrow 1
 */
const DescriptorLayout = ({ session, context, isFocused, scrollOffset, treeNavMap, isNarrow }) => {
  const hh = theme.layout.headerHeight;
  // In narrow mode, stack header panels and middle panels vertically
  const headerDirection = isNarrow ? 'column' : 'row';
  const middleDirection = isNarrow ? 'column' : 'row';
  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header row — fixed min height (stacked in narrow mode)
    h(Box, { flexDirection: headerDirection, width: '100%', minHeight: isNarrow ? undefined : hh, height: isNarrow ? undefined : hh },
      h(Panel, { title: 'SESSION', width: isNarrow ? '100%' : '60%', minHeight: isNarrow ? undefined : hh },
        h(Header, { session, context })
      ),
      h(Panel, { title: 'METRICS', width: isNarrow ? '100%' : '40%', minHeight: isNarrow ? undefined : hh },
        h(MetricsPanel, { session, context })
      )
    ),
    // Middle row — takes remaining space (stacked in narrow mode)
    h(Box, { flexDirection: middleDirection, width: '100%', flexGrow: 1 },
      h(Panel, {
        title: 'PHASES / WORKFLOW',
        width: isNarrow ? '100%' : '55%',
        flexGrow: 1,
        focused: isFocused('phases'),
        scrollOffset: scrollOffset('phases'),
        showScroll: true,
        canScrollUp: scrollOffset('phases') > 0,
        canScrollDown: true,
      },
        h(PhaseWorkflow, { session, context, treeNav: treeNavMap.phases })
      ),
      h(Panel, {
        title: 'LLM ACTIVITY',
        width: isNarrow ? '100%' : '45%',
        flexGrow: 1,
        focused: isFocused('llm'),
        anchor: 'bottom',
        scrollOffset: scrollOffset('llm'),
        showScroll: true,
        canScrollUp: scrollOffset('llm') > 0,
        canScrollDown: true,
      },
        h(LLMActivity, { session, context })
      )
    ),
    // Bottom row — fixed compact height
    h(Panel, {
      title: 'EXECUTION LOG',
      width: '100%',
      height: 8,
      focused: isFocused('log'),
      anchor: 'bottom',
      scrollOffset: scrollOffset('log'),
      showScroll: true,
      canScrollUp: scrollOffset('log') > 0,
      canScrollDown: true,
    },
      h(ExecutionLog, { session, context })
    )
  );
};

/**
 * Execution mode layout:
 *   Top:    Header — fixed height
 *   Middle: AgentPanel (45%) + WorkflowTree (55%) — flexGrow 1
 *   Bottom: Filesystem (50%) + ExecutionLog (50%) — flexGrow 1
 */
const ExecutionLayout = ({ session, context, panels, isFocused, scrollOffset, treeNavMap, isNarrow, agentLines, agentState }) => {
  const hh = theme.layout.headerHeight;
  const topDirection = isNarrow ? 'column' : 'row';
  const bottomDirection = isNarrow ? 'column' : 'row';
  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'SESSION', width: '100%', height: hh, minHeight: hh },
      h(Header, { session, context })
    ),
    // Agent + Tree (top half)
    h(Box, { key: 'top', flexDirection: topDirection, width: '100%', flexGrow: 1 },
      panels.agent !== false
        ? h(Panel, {
            key: 'agent',
            title: 'AGENT',
            width: isNarrow ? '100%' : '45%',
            flexGrow: 1,
            focused: isFocused('agent'),
            anchor: 'bottom',
            scrollOffset: scrollOffset('agent'),
            showScroll: true,
            canScrollUp: scrollOffset('agent') > 0,
            canScrollDown: true,
          },
            h(AgentPanel, {
              lines: agentLines || [],
              agentState: agentState || 'idle',
              sessionId: session?.id || null,
            })
          )
        : null,
      panels.tree
        ? h(Panel, {
            key: 'tree',
            title: 'WORKFLOW TREE',
            width: isNarrow ? '100%' : '55%',
            flexGrow: 1,
            focused: isFocused('tree'),
            scrollOffset: scrollOffset('tree'),
            showScroll: true,
            canScrollUp: scrollOffset('tree') > 0,
            canScrollDown: true,
          },
            h(WorkflowTree, { session, context, treeNav: treeNavMap.tree })
          )
        : null,
    ),
    // Files + Log (bottom half)
    (panels.files || panels.log !== false)
      ? h(Box, { key: 'bottom', flexDirection: bottomDirection, width: '100%', flexGrow: 1 },
          panels.files
            ? h(Panel, {
                key: 'files',
                title: 'FILESYSTEM',
                width: isNarrow ? '100%' : '50%',
                flexGrow: 1,
                focused: isFocused('files'),
                scrollOffset: scrollOffset('files'),
                showScroll: true,
                canScrollUp: scrollOffset('files') > 0,
                canScrollDown: true,
              }, h(Filesystem, { session, context, treeNav: treeNavMap.files }))
            : null,
          h(Panel, {
            key: 'log',
            title: 'EXECUTION LOG',
            width: isNarrow ? '100%' : '50%',
            flexGrow: 1,
            focused: isFocused('log'),
            anchor: 'bottom',
            scrollOffset: scrollOffset('log'),
            showScroll: true,
            canScrollUp: scrollOffset('log') > 0,
            canScrollDown: true,
          }, h(ExecutionLog, { session, context }))
        )
      : null
  );
};

/**
 * Idle mode layout:
 *   Top:    Header — fixed height
 *   Middle: Variables + Filesystem — flexGrow 3 (~60%)
 *   Bottom: CommandLog — flexGrow 2 (~40%)
 */
const IdleLayout = ({ session, context, panels, isFocused, scrollOffset, treeNavMap, isNarrow }) => {
  const hh = theme.layout.headerHeight;
  // In narrow mode, stack vars and files vertically instead of side-by-side
  const topDirection = isNarrow ? 'column' : 'row';
  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'SESSION', width: '100%', height: hh, minHeight: hh },
      h(Header, { session, context })
    ),
    // Variables + Filesystem (top ~60% — stacked vertically if narrow)
    (panels.vars || panels.files)
      ? h(Box, { key: 'top', flexDirection: topDirection, width: '100%', flexGrow: 3 },
          panels.vars
            ? h(Panel, {
                key: 'vars',
                title: 'VARIABLES',
                width: (isNarrow || !panels.files) ? '100%' : '50%',
                flexGrow: 1,
                focused: isFocused('vars'),
                scrollOffset: scrollOffset('vars'),
                showScroll: true,
                canScrollUp: scrollOffset('vars') > 0,
                canScrollDown: true,
              }, h(Variables, { session, context }))
            : null,
          panels.files
            ? h(Panel, {
                key: 'files',
                title: 'FILESYSTEM',
                width: (isNarrow || !panels.vars) ? '100%' : '50%',
                flexGrow: 1,
                focused: isFocused('files'),
                scrollOffset: scrollOffset('files'),
                showScroll: true,
                canScrollUp: scrollOffset('files') > 0,
                canScrollDown: true,
              }, h(Filesystem, { session, context, treeNav: treeNavMap.files }))
            : null
        )
      : null,
    // Command Log (bottom ~40%)
    panels.logs
      ? h(Panel, {
          key: 'logs',
          title: 'COMMAND LOG',
          width: '100%',
          flexGrow: 2,
          focused: isFocused('logs'),
          scrollOffset: scrollOffset('logs'),
          showScroll: true,
          canScrollUp: scrollOffset('logs') > 0,
          canScrollDown: true,
        },
          h(CommandLog, { session, context })
        )
      : null
  );
};

// ── SessionMonitor ──────────────────────────────────────────────

const SessionMonitor = ({ sessionId, apiClient, onExit, onQuit, onNavigate, agentLines, agentState: agentStateProp }) => {
  // ── Data polling ──
  const {
    session,
    error: dataError,
    connectionStatus,
    latency,
    lastRefresh,
  } = useSessionData(apiClient, sessionId, 2000);

  // ── Local state ──
  const [panels, setPanels] = useState({
    agent: true, tree: true, files: true, widgets: true, vars: true, logs: true,
  });
  const [showHelp, setShowHelp] = useState(false);
  const [zoomedPanel, setZoomedPanel] = useState(null);

  // ── Derive mode from session data ──
  const mode = detectMode(session);

  // ── Panel focus ──
  const panelNames = useMemo(() => PANEL_NAMES[mode] || [], [mode]);
  const { focusedPanel, nextFocus, prevFocus, setFocus, setFocusByIndex, isFocused } = usePanelFocus(panelNames);

  // ── Tree navigation hooks — one per tree-capable panel ──
  const treeNavTree = useTreeNav();
  const treeNavPhases = useTreeNav();
  const treeNavFiles = useTreeNav();

  const treeNavMap = useMemo(() => ({
    tree: treeNavTree,
    phases: treeNavPhases,
    files: treeNavFiles,
  }), [treeNavTree, treeNavPhases, treeNavFiles]);

  // Get active treeNav for the currently focused panel
  const activeTreeNav = useMemo(() => {
    if (!focusedPanel || !TREE_PANELS.has(focusedPanel)) return null;
    return treeNavMap[focusedPanel] || null;
  }, [focusedPanel, treeNavMap]);

  // ── Scrolling ──
  const { getOffset, scrollUp, scrollDown, scrollTo, reset: resetScroll, setMaxScroll } = useScroll();

  // ── Panel toggle (only in execution/idle, not descriptor) ──
  const togglePanel = useCallback((panel) => {
    if (mode === 'descriptor') return;
    setPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  }, [mode]);

  // ── Zoom toggle ──
  const toggleZoom = useCallback(() => {
    if (!focusedPanel) return;
    setZoomedPanel(prev => prev === focusedPanel ? null : focusedPanel);
  }, [focusedPanel]);

  // ── Auto-scroll: reset scroll when panel loses focus ──
  const prevFocusedRef = useRef(focusedPanel);
  useEffect(() => {
    const prev = prevFocusedRef.current;
    if (prev && prev !== focusedPanel) {
      resetScroll(prev);
    }
    prevFocusedRef.current = focusedPanel;
  }, [focusedPanel, resetScroll]);

  // ── Mouse support with layout-aware hit-testing ──
  const handleMouseClick = useCallback((x, y, button) => {
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 120;
    const panel = getPanelAtPosition(x, y, mode, rows, cols);
    if (panel && panelNames.includes(panel)) {
      setFocus(panel);
    }
  }, [mode, panelNames, setFocus]);

  const handleMouseScroll = useCallback((x, y, direction) => {
    if (!focusedPanel) return;
    if (direction === 'up') scrollUp(focusedPanel);
    else scrollDown(focusedPanel);
  }, [focusedPanel, scrollUp, scrollDown]);

  useMouse({ onClick: handleMouseClick, onScroll: handleMouseScroll });

  // ── Content-aware scroll limits ──
  useEffect(() => {
    const vars = (session && session.variables) || {};
    const rows = process.stdout.rows || 24;
    const panelVisible = Math.max(3, Math.floor(rows / 3) - 4);

    // Tree panels — bounded by flat nodes
    const treeLen = treeNavTree?.expanded ? (treeNavTree.cursor + 1) : 0;
    // Use a rough estimate: we read the flatNodes count via the cursor max
    // For tree panels, cursor nav handles bounds; scroll is only for mouse/auto
    setMaxScroll('tree', Math.max(0, 100)); // tree uses cursor nav mostly
    setMaxScroll('phases', Math.max(0, 100));
    setMaxScroll('files', Math.max(0, 100));

    // Non-tree panels — estimate from data
    const logLen = Array.isArray(vars._executionLog) ? vars._executionLog.length : 0;
    setMaxScroll('log', Math.max(0, logLen));

    const llmLen = Array.isArray(vars._llmActivity) ? vars._llmActivity.length * 3 : 0;
    setMaxScroll('llm', Math.max(0, llmLen));

    const varKeys = Object.keys(vars).length;
    setMaxScroll('vars', Math.max(0, varKeys * 2));

    setMaxScroll('widgets', 30);

    const cmdLen = Array.isArray(session?.commandHistory) ? session.commandHistory.length : 0;
    setMaxScroll('logs', Math.max(0, cmdLen));
  }, [session, treeNavTree, setMaxScroll]);

  // ── Auto-scroll: follow cursor and expand/collapse in tree panels ──
  // Bounded to known panel names to prevent unbounded ref growth
  const prevCursorRef = useRef<Record<string, number>>({});
  const prevExpandedSizeRef = useRef<Record<string, number>>({});
  const activeExpandedSize = activeTreeNav?.expanded?.size ?? 0;
  useEffect(() => {
    if (!activeTreeNav || !focusedPanel) return;
    const cur = activeTreeNav.cursor;
    const offset = getOffset(focusedPanel);
    const rows = process.stdout.rows || 24;
    const visibleLines = Math.max(5, Math.floor(rows / 3) - 3);

    const prevCur = prevCursorRef.current[focusedPanel];
    const prevExpSize = prevExpandedSizeRef.current[focusedPanel];

    prevCursorRef.current[focusedPanel] = cur;
    prevExpandedSizeRef.current[focusedPanel] = activeExpandedSize;

    if (prevCur !== cur) {
      // Cursor moved — ensure cursor is visible
      if (cur < offset) {
        scrollTo(focusedPanel, cur);
      } else if (cur >= offset + visibleLines) {
        scrollTo(focusedPanel, cur - visibleLines + 1);
      }
    } else if (prevExpSize !== undefined && prevExpSize !== activeExpandedSize) {
      // Expanded set changed (toggle) — only scroll if cursor went out of view
      if (cur < offset) {
        scrollTo(focusedPanel, cur);
      } else if (cur >= offset + visibleLines) {
        scrollTo(focusedPanel, cur - visibleLines + 1);
      }
    }
  }, [activeTreeNav?.cursor, activeExpandedSize, focusedPanel, getOffset, scrollTo]);

  // ── Keyboard handling (Schema A: contextual navigation) ──
  // In detail views: Ctrl+Left/Right = switch panels
  // h/s/f/c/m = direct page jumps (always available)
  // j/k = cursor up/down (vim-style)
  const actionHandlers: ActionHandlers = {
    // Actions
    'quit': () => {
      if (showHelp) { setShowHelp(false); return; }
      if (onQuit) onQuit();
      else if (onExit) onExit();
      else process.exit(0);
    },
    'refresh': () => { if (showHelp) setShowHelp(false); },
    'help': () => setShowHelp(prev => !prev),
    'zoom': () => toggleZoom(),
    'back': () => {
      if (showHelp) { setShowHelp(false); return; }
      if (zoomedPanel) { setZoomedPanel(null); return; }
      if (onExit) onExit();
    },

    // Panel toggles
    'toggle.tree': () => togglePanel('tree'),
    'toggle.files': () => togglePanel('files'),
    'toggle.widgets': () => togglePanel('agent'),
    'toggle.vars': () => togglePanel('vars'),
    'toggle.logs': () => togglePanel('logs'),

    // Panel navigation (Ctrl+Left/Right in detail context = panel switch)
    'panel.next': () => nextFocus(),
    'panel.prev': () => prevFocus(),
    'panel.cycle': () => nextFocus(),
    'panel.cycleBack': () => prevFocus(),
    'panel.1': () => { if (panelNames.length >= 1) setFocusByIndex(0); },
    'panel.2': () => { if (panelNames.length >= 2) setFocusByIndex(1); },
    'panel.3': () => { if (panelNames.length >= 3) setFocusByIndex(2); },

    // Cursor / tree navigation
    'cursor.up': () => {
      if (activeTreeNav) { activeTreeNav.moveUp(); return; }
      if (focusedPanel) scrollUp(focusedPanel);
    },
    'cursor.down': () => {
      if (activeTreeNav) { activeTreeNav.moveDown(); return; }
      if (focusedPanel) scrollDown(focusedPanel);
    },
    'cursor.upAlt': () => {
      if (activeTreeNav) { activeTreeNav.moveUp(); return; }
      if (focusedPanel) scrollUp(focusedPanel);
    },
    'cursor.downAlt': () => {
      if (activeTreeNav) { activeTreeNav.moveDown(); return; }
      if (focusedPanel) scrollDown(focusedPanel);
    },
    'tree.expand': () => {
      if (activeTreeNav) { activeTreeNav.moveRight(); }
    },
    'tree.collapse': () => {
      if (activeTreeNav) { activeTreeNav.moveLeft(); }
    },
    'tree.toggle': () => {
      if (showHelp) { setShowHelp(false); return; }
      if (activeTreeNav) { activeTreeNav.toggle(); return; }
      toggleZoom();
    },

    // Scroll (Ctrl+Up/Down)
    'scroll.up': () => {
      if (focusedPanel) scrollUp(focusedPanel, 5);
    },
    'scroll.down': () => {
      if (focusedPanel) scrollDown(focusedPanel, 5);
    },

    // Page navigation (letter shortcuts always available from any view)
    'page.home': () => { if (onNavigate) onNavigate('home'); },
    'page.spaces': () => { if (onNavigate) onNavigate('spaces'); },
    'page.foundry': () => { if (onNavigate) onNavigate('foundry'); },
    'page.catalog': () => { if (onNavigate) onNavigate('catalog'); },
    'page.models': () => { if (onNavigate) onNavigate('models'); },
  };

  useActionKeyboard(actionHandlers, 'detail');

  // ── Terminal size detection (P3-35) ──
  const termCols = process.stdout.columns || 120;
  const termRows = process.stdout.rows || 24;
  const isNarrow = termCols < 80;
  const isTooSmall = termCols < 60;

  // ── Stale data detection (P2-26) ──
  // Store lastRefresh in a ref so the timer doesn't need to be recreated
  // when lastRefresh changes (which happens every 2s during normal polling).
  // Previously, the timer was recreated on every lastRefresh change — rapid allocation.
  const lastRefreshRef = useRef(lastRefresh);
  lastRefreshRef.current = lastRefresh;
  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    const checkStale = () => {
      const lr = lastRefreshRef.current;
      if (!lr) { setIsStale(false); return; }
      const lastRefreshTime = lr instanceof Date ? lr.getTime() : new Date(lr).getTime();
      setIsStale((Date.now() - lastRefreshTime) > 10000);
    };
    checkStale();
    const timer = setInterval(checkStale, 2000);
    return () => clearInterval(timer);
  }, []); // Timer created once, reads lastRefresh via ref

  // ── Build context object for child components ──
  const vars = (session && session.variables) || {};
  const context = {
    mode,
    activeWorkflow: getActiveWorkflow(session),
    executionTree: vars._executionTree || null,
    workingDirectory: session ? session.workingDirectory : null,
    phases: vars._phases || null,
    activeBlock: vars._activeBlock || null,
    blockOutputs: vars._blockOutputs || null,
    executionLog: vars._executionLog || null,
    artifacts: vars._artifacts || null,
    monitorDescriptor: vars._monitorDescriptor || null,
    llmActivity: vars._llmActivity || [],
  };

  // ── Status bar props ──
  const statusBarProps = {
    connectionStatus, latency, lastRefresh, mode,
    visiblePanels: panels,
    hasBackOption: !!onExit,
    focusedPanel,
    zoomedPanel,
  };

  // ── Render ──

  // Error state
  if (connectionStatus === 'error' && !session) {
    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
      h(NavBar, { currentPage: 'session' }),
      h(Panel, { title: 'ERROR', width: '100%' },
        h(ErrorHeader, { sessionId, errorMessage: dataError })
      ),
      h(Box, { flexGrow: 1 }),
      h(StatusBar, statusBarProps)
    );
  }

  // Loading state
  if (!session) {
    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
      h(NavBar, { currentPage: 'session' }),
      h(Panel, { title: 'CONNECTING', width: '100%' },
        h(Box, { paddingLeft: 1 },
          T('cyan', icons.running),
          h(Text, {}, ' Connecting to session '),
          dim(sessionId ? sessionId.substring(0, 8) : '...')
        )
      ),
      h(Box, { flexGrow: 1 }),
      h(StatusBar, statusBarProps)
    );
  }

  // ── Zoomed panel: render only that panel fullscreen ──
  if (zoomedPanel) {
    const zoomTreeNav = treeNavMap[zoomedPanel] || null;
    const zoomComponent = {
      agent: h(AgentPanel, { lines: agentLines || [], agentState: agentStateProp || 'idle', sessionId: session?.id || null }),
      phases: h(PhaseWorkflow, { session, context, treeNav: zoomTreeNav }),
      llm: h(LLMActivity, { session, context }),
      log: h(ExecutionLog, { session, context }),
      tree: h(WorkflowTree, { session, context, treeNav: zoomTreeNav }),
      files: h(Filesystem, { session, context, treeNav: zoomTreeNav }),
      widgets: h(WidgetsPanel, { session, context }),
      vars: h(Variables, { session, context }),
      logs: h(CommandLog, { session, context }),
    }[zoomedPanel];

    const zoomTitle = {
      agent: 'AGENT', phases: 'PHASES / WORKFLOW', llm: 'LLM ACTIVITY', log: 'EXECUTION LOG',
      tree: 'WORKFLOW TREE', files: 'FILESYSTEM', widgets: 'WIDGETS',
      vars: 'VARIABLES', logs: 'COMMAND LOG',
    }[zoomedPanel] || zoomedPanel.toUpperCase();

    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
      h(NavBar, { currentPage: 'session' }),
      h(Panel, {
        title: zoomTitle + ' (zoomed)',
        focused: true,
        width: '100%',
        flexGrow: 1,
        anchor: BOTTOM_ANCHORED.has(zoomedPanel) ? 'bottom' : 'top',
        scrollOffset: getOffset(zoomedPanel),
        showScroll: true,
        canScrollUp: getOffset(zoomedPanel) > 0,
        canScrollDown: true,
      },
        zoomComponent || dim('(empty)')
      ),
      h(StatusBar, statusBarProps)
    );
  }

  // ── Normal layout based on mode ──
  const layoutProps = { session, context, isFocused, scrollOffset: getOffset, treeNavMap, isNarrow };
  let layoutContent = null;

  if (mode === 'descriptor') {
    layoutContent = h(DescriptorLayout, layoutProps);
  } else if (mode === 'execution') {
    layoutContent = h(ExecutionLayout, { ...layoutProps, panels, agentLines, agentState: agentStateProp });
  } else {
    layoutContent = h(IdleLayout, { ...layoutProps, panels });
  }

  // Help overlay
  const helpOverlay = showHelp
    ? h(Box, {
        position: 'absolute',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      },
        h(HelpOverlay, { hasBackOption: !!onExit })
      )
    : null;

  // Error banner (stale data) with specific error classification
  const { type: errorType } = classifyError(dataError);
  const errorBanner = (connectionStatus === 'error' && session)
    ? h(Box, { width: '100%', paddingLeft: 1 },
        T('red', icons.failed + ' '),
        error(errorType + ': ' + (dataError || 'unknown')),
        muted('  (showing stale data)')
      )
    : null;

  // Stale data indicator — shown when connected but data is old
  const staleBanner = (isStale && connectionStatus !== 'error' && session)
    ? h(Box, { width: '100%', paddingLeft: 1 },
        T('yellow', icons.paused + ' '),
        warning('[stale] '),
        muted('Last update > 10s ago — data may be outdated')
      )
    : null;

  // ── Terminal too small (P3-35) ──
  if (isTooSmall) {
    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
      h(Text, { color: theme.status.warning, bold: true }, 'Terminal too small'),
      h(Text, null, ''),
      muted(`Current: ${termCols}x${termRows}`),
      muted('Minimum: 60 columns wide'),
      h(Text, null, ''),
      muted('Please resize your terminal.'),
    );
  }

  // ── NavBar for session monitor (P2-23) ──
  const navBar = h(NavBar, { currentPage: 'session' });

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    navBar,
    errorBanner,
    staleBanner,
    layoutContent,
    h(StatusBar, statusBarProps),
    helpOverlay
  );
};

export { SessionMonitor };
