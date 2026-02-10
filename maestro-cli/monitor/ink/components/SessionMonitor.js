/**
 * SessionMonitor Component (Ink)
 *
 * The main orchestrator — replaces the blessed SessionMonitor class.
 * Polls session data, detects mode, renders layout with child panels.
 *
 * Props: { sessionId, apiClient, onExit }
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
  T, primary, secondary, muted, dim, bold, error, running,
  statusColor, statusIcon, icons, theme,
} from '../theme.js';
import { useSessionData } from '../hooks/useSessionData.js';
import { useKeyboard } from '../hooks/useKeyboard.js';
import { usePanelFocus } from '../hooks/usePanelFocus.js';
import { useScroll } from '../hooks/useScroll.js';
import { useMouse } from '../hooks/useMouse.js';
import { useTreeNav } from '../hooks/useTreeNav.js';

// ── Child component imports ─────────────────────────────────────
import { Panel } from './Panel.js';
import { Header } from './Header.js';
import { StatusBar } from './StatusBar.js';
import { WorkflowTree } from './WorkflowTree.js';
import { PhaseWorkflow } from './PhaseWorkflow.js';
import { LLMActivity } from './LLMActivity.js';
import { ExecutionLog } from './ExecutionLog.js';
import { MetricsPanel } from './MetricsPanel.js';
import { Variables } from './Variables.js';
import { Filesystem } from './Filesystem.js';
import { CommandLog } from './CommandLog.js';
import { WidgetsPanel } from './WidgetsPanel.js';
import { BlockDetail } from './BlockDetail.js';
import { Artifacts } from './Artifacts.js';

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
  execution: ['tree', 'files', 'widgets'],
  idle: ['vars', 'files', 'logs'],
};

// Panels that support tree navigation
const TREE_PANELS = new Set(['tree', 'phases', 'files']);

// Panels whose content is chronological (newest at bottom) — anchor to bottom
const BOTTOM_ANCHORED = new Set(['log', 'llm']);

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
    if (contentY < halfH) return 'tree';
    return x < cols * 0.5 ? 'files' : 'widgets';
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
  const backLine = hasBackOption
    ? h(Text, { key: 'back' }, '    Esc        Back / unzoom')
    : null;

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
    h(Text, {}, '    Tab / Shift-Tab     Cycle panel focus'),
    h(Text, {}, '    Ctrl+Arrows         Switch panels'),
    h(Text, {}, '    Enter / z           Zoom focused panel'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Tree Navigation (tree panels):'),
    h(Text, {}, '    Up/Down          Move cursor'),
    h(Text, {}, '    Left             Collapse / go to parent'),
    h(Text, {}, '    Right            Expand / go to child'),
    h(Text, {}, '    Enter/Space      Toggle expand/collapse'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Actions:'),
    h(Text, {}, '    r          Refresh now'),
    backLine,
    h(Text, {}, '    q          Quit'),
    h(Text, {}, '    ?          This help'),
    h(Text, {}, ''),
    h(Text, { bold: true }, '  Mouse:'),
    h(Text, {}, '    Click       Focus panel'),
    h(Text, {}, '    Scroll      Scroll focused panel'),
    h(Text, {}, ''),
    h(Text, { color: 'gray' }, '  Press q, Esc, or Enter to close...')
  );
};

// ── Error Header ────────────────────────────────────────────────

const ErrorHeader = ({ sessionId, errorMessage }) => {
  const shortId = sessionId ? sessionId.substring(0, 8) : '--------';
  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row', gap: 1 },
      T('red', icons.failed),
      T('red', 'Connection Error')
    ),
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('Session: '), dim(shortId)
    ),
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('Error: '), error(errorMessage || 'Unknown error')
    )
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
const DescriptorLayout = ({ session, context, isFocused, scrollOffset, treeNavMap }) => {
  const hh = theme.layout.headerHeight;
  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header row — fixed min height
    h(Box, { flexDirection: 'row', width: '100%', minHeight: hh, height: hh },
      h(Panel, { title: 'SESSION', width: '60%', minHeight: hh },
        h(Header, { session, context })
      ),
      h(Panel, { title: 'METRICS', width: '40%', minHeight: hh },
        h(MetricsPanel, { session, context })
      )
    ),
    // Middle row — takes remaining space
    h(Box, { flexDirection: 'row', width: '100%', flexGrow: 1 },
      h(Panel, {
        title: 'PHASES / WORKFLOW',
        width: '55%',
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
        width: '45%',
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
 *   Middle: WorkflowTree — flexGrow 1
 *   Bottom: Filesystem + WidgetsPanel — flexGrow 1
 */
const ExecutionLayout = ({ session, context, panels, isFocused, scrollOffset, treeNavMap }) => {
  const hh = theme.layout.headerHeight;
  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'SESSION', width: '100%', height: hh, minHeight: hh },
      h(Header, { session, context })
    ),
    // Tree (top half)
    panels.tree
      ? h(Panel, {
          key: 'tree',
          title: 'WORKFLOW TREE',
          width: '100%',
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
    // Files + Widgets (bottom half)
    (panels.files || panels.widgets)
      ? h(Box, { key: 'bottom', flexDirection: 'row', width: '100%', flexGrow: 1 },
          panels.files
            ? h(Panel, {
                key: 'files',
                title: 'FILESYSTEM',
                width: panels.widgets ? '50%' : '100%',
                flexGrow: 1,
                focused: isFocused('files'),
                scrollOffset: scrollOffset('files'),
                showScroll: true,
                canScrollUp: scrollOffset('files') > 0,
                canScrollDown: true,
              }, h(Filesystem, { session, context, treeNav: treeNavMap.files }))
            : null,
          panels.widgets
            ? h(Panel, {
                key: 'widgets',
                title: 'WIDGETS',
                width: panels.files ? '50%' : '100%',
                flexGrow: 1,
                focused: isFocused('widgets'),
                scrollOffset: scrollOffset('widgets'),
                showScroll: true,
                canScrollUp: scrollOffset('widgets') > 0,
                canScrollDown: true,
              }, h(WidgetsPanel, { session, context }))
            : null
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
const IdleLayout = ({ session, context, panels, isFocused, scrollOffset, treeNavMap }) => {
  const hh = theme.layout.headerHeight;
  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'SESSION', width: '100%', height: hh, minHeight: hh },
      h(Header, { session, context })
    ),
    // Variables + Filesystem (top ~60%)
    (panels.vars || panels.files)
      ? h(Box, { key: 'top', flexDirection: 'row', width: '100%', flexGrow: 3 },
          panels.vars
            ? h(Panel, {
                key: 'vars',
                title: 'VARIABLES',
                width: panels.files ? '50%' : '100%',
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
                width: panels.vars ? '50%' : '100%',
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

const SessionMonitor = ({ sessionId, apiClient, onExit }) => {
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
    tree: true, files: true, widgets: true, vars: true, logs: true,
  });
  const [showHelp, setShowHelp] = useState(false);
  const [zoomedPanel, setZoomedPanel] = useState(null);

  // ── Derive mode from session data ──
  const mode = detectMode(session);

  // ── Panel focus ──
  const panelNames = useMemo(() => PANEL_NAMES[mode] || [], [mode]);
  const { focusedPanel, nextFocus, prevFocus, setFocus, isFocused } = usePanelFocus(panelNames);

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

  // ── Auto-scroll: follow cursor in tree panels ──
  const prevCursorRef = useRef({});
  useEffect(() => {
    if (!activeTreeNav || !focusedPanel) return;
    const cur = activeTreeNav.cursor;
    const prev = prevCursorRef.current[focusedPanel];
    if (prev !== cur) {
      prevCursorRef.current[focusedPanel] = cur;
      // Estimate visible lines (~panel height - borders - title).
      // Use scroll offset to keep cursor visible.
      const offset = getOffset(focusedPanel);
      const rows = process.stdout.rows || 24;
      const visibleLines = Math.max(5, Math.floor(rows / 3) - 3);
      if (cur < offset) {
        // Cursor above visible area → scroll up
        scrollTo(focusedPanel, cur);
      } else if (cur >= offset + visibleLines) {
        // Cursor below visible area → scroll down
        scrollTo(focusedPanel, cur - visibleLines + 1);
      }
    }
  }, [activeTreeNav?.cursor, focusedPanel, getOffset, scrollTo]);

  // ── Keyboard handling ──
  // Tab/Shift-Tab = cycle panels
  // Arrows = tree nav (if active) or scroll
  // Ctrl+Arrows = switch panels
  useKeyboard({
    q: () => {
      if (showHelp) { setShowHelp(false); return; }
      if (onExit) onExit();
      else process.exit(0);
    },
    r: () => { if (showHelp) setShowHelp(false); },
    t: () => togglePanel('tree'),
    f: () => togglePanel('files'),
    w: () => togglePanel('widgets'),
    v: () => togglePanel('vars'),
    l: () => togglePanel('logs'),
    z: () => toggleZoom(),
    tab: () => nextFocus(),
    shiftTab: () => prevFocus(),
    // Arrow keys: tree nav if active, otherwise scroll
    up: () => {
      if (activeTreeNav) { activeTreeNav.moveUp(); return; }
      if (focusedPanel) scrollUp(focusedPanel);
    },
    down: () => {
      if (activeTreeNav) { activeTreeNav.moveDown(); return; }
      if (focusedPanel) scrollDown(focusedPanel);
    },
    left: () => {
      if (activeTreeNav) { activeTreeNav.moveLeft(); return; }
    },
    right: () => {
      if (activeTreeNav) { activeTreeNav.moveRight(); return; }
    },
    // Ctrl+Arrows = switch panels
    ctrlUp: () => prevFocus(),
    ctrlDown: () => nextFocus(),
    ctrlLeft: () => prevFocus(),
    ctrlRight: () => nextFocus(),
    // Enter: toggle expand if tree, else toggle zoom
    enter: () => {
      if (showHelp) { setShowHelp(false); return; }
      if (activeTreeNav) { activeTreeNav.toggle(); return; }
      toggleZoom();
    },
    // Space: toggle expand if tree
    space: () => {
      if (activeTreeNav) { activeTreeNav.toggle(); return; }
    },
    escape: () => {
      if (showHelp) { setShowHelp(false); return; }
      if (zoomedPanel) { setZoomedPanel(null); return; }
      if (onExit) onExit();
    },
    '?': () => setShowHelp(prev => !prev),
  });

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
      phases: 'PHASES / WORKFLOW', llm: 'LLM ACTIVITY', log: 'EXECUTION LOG',
      tree: 'WORKFLOW TREE', files: 'FILESYSTEM', widgets: 'WIDGETS',
      vars: 'VARIABLES', logs: 'COMMAND LOG',
    }[zoomedPanel] || zoomedPanel.toUpperCase();

    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
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
  const layoutProps = { session, context, isFocused, scrollOffset: getOffset, treeNavMap };
  let layoutContent = null;

  if (mode === 'descriptor') {
    layoutContent = h(DescriptorLayout, layoutProps);
  } else if (mode === 'execution') {
    layoutContent = h(ExecutionLayout, { ...layoutProps, panels });
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

  // Error banner (stale data)
  const errorBanner = (connectionStatus === 'error' && session)
    ? h(Box, { width: '100%', paddingLeft: 1 },
        T('red', icons.failed + ' '),
        error('Connection error: ' + (dataError || 'unknown')),
        muted('  (showing stale data)')
      )
    : null;

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    errorBanner,
    layoutContent,
    h(StatusBar, statusBarProps),
    helpOverlay
  );
};

export { SessionMonitor };
