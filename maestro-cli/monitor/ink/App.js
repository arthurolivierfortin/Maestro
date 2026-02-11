/**
 * Maestro TUI Monitor — Ink App (Root)
 *
 * Entry point for the Ink-based monitor. Routes between:
 * - Multi-page navigation (Home, Spaces, Foundry, Catalog, Models)
 * - SessionMonitor (single session detail) when a session is selected
 *
 * Navigation flow:
 *   Home/Spaces/Foundry/Catalog/Models ←→ (letter keys)
 *   Spaces → Enter → SessionMonitor → Esc → back to currentPage
 *
 * FullscreenBox provides explicit terminal height to Yoga so that
 * percentage heights and flexGrow work correctly in child layouts.
 */

import { createElement as h, useState, useCallback, useEffect, useRef } from 'react';
import { render, useApp, useStdout, Box } from 'ink';
import { theme } from './theme.js';
import { SessionMonitor } from './components/SessionMonitor.js';
import { HomeScreen } from './components/HomeScreen.js';
import { SpacesScreen } from './components/SpacesScreen.js';
import { FoundryScreen } from './components/FoundryScreen.js';
import { CatalogScreen } from './components/CatalogScreen.js';
import { ModelsScreen } from './components/ModelsScreen.js';
import { WorkspaceDetail } from './components/WorkspaceDetail.js';
import { RepoDetail } from './components/RepoDetail.js';
import { ModelDetail } from './components/ModelDetail.js';
import { BlockDetail } from './components/BlockDetail.js';

// ── Terminal background color control ──────────────────────────
//
// Ink's Box doesn't support backgroundColor. We use OSC 11 to
// change the terminal's own default background color on start,
// and restore it on exit. Works with Windows Terminal, iTerm2,
// xterm, and most modern terminal emulators.

function hexToOscRgb(hex) {
  // '#1a1a2e' → 'rgb:1a1a/1a1a/2e2e' (16-bit per channel for OSC)
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `rgb:${r}${r}/${g}${g}/${b}${b}`;
}

function setTerminalBg(hexColor) {
  if (!hexColor || !process.stdout.isTTY) return;
  const osc = `\x1b]11;${hexToOscRgb(hexColor)}\x07`;
  process.stdout.write(osc);
}

function resetTerminalBg() {
  if (!process.stdout.isTTY) return;
  // OSC 111 resets background to terminal default
  process.stdout.write('\x1b]111\x07');
}

// ── FullscreenBox — provides explicit height to Yoga ────────────
//
// Ink's root Yoga node only sets width, not height. Without an
// explicit numeric height, all percentage heights and flexGrow on
// children are meaningless. This wrapper reads stdout.rows and
// passes it as an explicit height, enabling proper layout.

const FullscreenBox = ({ children }) => {
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

// ── Root App Component ─────────────────────────────────────────

const App = ({ initialSessionId, apiClient }) => {
  const { exit } = useApp();
  const [navStack, setNavStack] = useState([]);
  const [detailView, setDetailView] = useState(
    initialSessionId ? { type: 'session', id: initialSessionId } : null
  );
  const [currentPage, setCurrentPage] = useState(initialSessionId ? 'spaces' : 'home');
  const [restoredState, setRestoredState] = useState(null);

  // Refs for stable callbacks — avoids stale closures
  const detailViewRef = useRef(detailView);
  const currentPageRef = useRef(currentPage);
  const navStackRef = useRef(navStack);
  detailViewRef.current = detailView;
  currentPageRef.current = currentPage;
  navStackRef.current = navStack;

  // Push current view to stack and navigate to target
  const navigateTo = useCallback((targetView, sourceState) => {
    const dv = detailViewRef.current;
    const cp = currentPageRef.current;
    const entry = dv
      ? { ...dv, state: sourceState || null }
      : { type: 'page', page: cp, state: sourceState || null };
    setNavStack(stack => [...stack, entry]);
    setDetailView(targetView);
    setRestoredState(null);
  }, []);

  const handleSessionSelect = useCallback((sessionId, sourceState) => {
    navigateTo({ type: 'session', id: sessionId }, sourceState);
  }, [navigateTo]);

  const handleWorkspaceSelect = useCallback((workspaceId, sourceState) => {
    navigateTo({ type: 'workspace', id: workspaceId }, sourceState);
  }, [navigateTo]);

  const handleRepoSelect = useCallback((repoId, sourceState) => {
    navigateTo({ type: 'repo', id: repoId }, sourceState);
  }, [navigateTo]);

  const handleModelSelect = useCallback((modelId, sourceState) => {
    navigateTo({ type: 'model', id: modelId }, sourceState);
  }, [navigateTo]);

  const handleBlockSelect = useCallback((blockId, sourceState) => {
    navigateTo({ type: 'block', id: blockId }, sourceState);
  }, [navigateTo]);

  const handleBack = useCallback(() => {
    const stack = navStackRef.current;
    if (stack.length > 0) {
      const prev = stack[stack.length - 1];
      setNavStack(stack.slice(0, -1));
      if (prev.type === 'page') {
        setDetailView(null);
        setCurrentPage(prev.page);
      } else {
        setDetailView({ type: prev.type, id: prev.id });
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
    exit();
  }, [exit]);

  // Page navigation (letter keys) — resets stack
  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
    setNavStack([]);
    setDetailView(null);
    setRestoredState(null);
  }, []);

  // Detail view routing
  if (detailView) {
    const detailProps = {
      apiClient,
      onExit: handleBack,
      onQuit: handleQuit,
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
        });
        break;
      case 'workspace':
        detailComponent = h(WorkspaceDetail, {
          workspaceId: detailView.id,
          ...detailProps,
        });
        break;
      case 'repo':
        detailComponent = h(RepoDetail, {
          repoId: detailView.id,
          ...detailProps,
        });
        break;
      case 'model':
        detailComponent = h(ModelDetail, {
          modelId: detailView.id,
          apiClient,
          onExit: handleBack,
          onQuit: handleQuit,
        });
        break;
      case 'block':
        detailComponent = h(BlockDetail, {
          blockId: detailView.id,
          ...detailProps,
        });
        break;
      default:
        detailComponent = h(SessionMonitor, {
          sessionId: detailView.id,
          apiClient,
          onExit: handleBack,
          onQuit: handleQuit,
        });
    }

    return h(FullscreenBox, null, detailComponent);
  }

  // Multi-page routing
  const pageProps = {
    apiClient,
    onNavigate: handleNavigate,
    onSessionSelect: handleSessionSelect,
    onWorkspaceSelect: handleWorkspaceSelect,
    onRepoSelect: handleRepoSelect,
    onQuit: handleQuit,
    initialState: restoredState,
  };

  let pageComponent;
  switch (currentPage) {
    case 'spaces':
      pageComponent = h(SpacesScreen, pageProps);
      break;
    case 'foundry':
      pageComponent = h(FoundryScreen, pageProps);
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

  return h(FullscreenBox, null, pageComponent);
};

// ── Public entry point (called from CJS tui-monitor.js) ────────

async function startInkMonitor(sessionId, apiClient, options = {}) {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Ink monitor requires an interactive terminal (TTY). '
      + 'Run in a proper terminal window or use --legacy flag.'
    );
  }

  // Set terminal background color from theme
  setTerminalBg(theme.bg);

  const instance = render(
    h(App, { initialSessionId: sessionId, apiClient }),
    {
      exitOnCtrlC: true,
    }
  );

  try {
    await instance.waitUntilExit();
  } finally {
    // Always restore terminal background on exit
    resetTerminalBg();
  }
}

export { startInkMonitor, App };
