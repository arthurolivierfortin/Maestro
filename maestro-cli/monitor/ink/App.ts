// @ts-nocheck
/**
 * Maestro TUI Monitor — Ink App (Root)
 *
 * Entry point for the Ink-based monitor. Routes between:
 * - Multi-page navigation (Home, Spaces, Foundry, Catalog, Models)
 * - SessionMonitor (single session detail) when a session is selected
 */

import { createElement as h, useState, useCallback, useEffect, useRef } from 'react';
import { render, useApp, useStdout, Box } from 'ink';
import { theme, type PageName } from './theme.ts';
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

import type { IApiClient } from '../../../shared/types/api-client.ts';
import { setTerminalBg, resetTerminalBg } from '../../../shared/theme/terminal.ts';
import { palette } from '../../../shared/theme/colors.ts';

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

interface AppProps {
  initialSessionId: string | null;
  apiClient: IApiClient;
  initialDetailType?: 'session' | 'workspace';
}

// ── Root App Component ─────────────────────────────────────────

const App = ({ initialSessionId, apiClient, initialDetailType }: AppProps) => {
  const { exit } = useApp();
  const [navStack, setNavStack] = useState<(NavStackEntry | PageNavEntry)[]>([]);
  const detailType = initialDetailType || 'session';
  const [detailView, setDetailView] = useState<DetailView | null>(
    initialSessionId ? { type: detailType, id: initialSessionId } : null
  );
  const [currentPage, setCurrentPage] = useState<PageName>(initialSessionId ? 'spaces' : 'home');
  const [restoredState, setRestoredState] = useState<any>(null);

  const detailViewRef = useRef(detailView);
  const currentPageRef = useRef(currentPage);
  const navStackRef = useRef(navStack);
  detailViewRef.current = detailView;
  currentPageRef.current = currentPage;
  navStackRef.current = navStack;

  const navigateTo = useCallback((targetView: DetailView, sourceState?: any) => {
    const dv = detailViewRef.current;
    const cp = currentPageRef.current;
    const entry = dv
      ? { ...dv, state: sourceState || null }
      : { type: 'page' as const, page: cp, state: sourceState || null };
    setNavStack(stack => {
      const next = [...stack, entry];
      // Cap navigation depth to prevent unbounded memory growth
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
    exit();
  }, [exit]);

  const handleNavigate = useCallback((page: PageName) => {
    setCurrentPage(page);
    setNavStack([]);
    setDetailView(null);
    setRestoredState(null);
  }, []);

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
        detailComponent = h(SessionMonitor, { sessionId: detailView.id, apiClient, onExit: handleBack, onQuit: handleQuit, onNavigate: handleNavigate });
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

    return h(FullscreenBox, null, detailComponent);
  }

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

  return h(FullscreenBox, null, pageComponent);
};

// ── Public entry point ──────────────────────────────────────────

async function startInkMonitor(sessionId: string | null, apiClient: IApiClient, options: Record<string, unknown> = {}): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error('Ink monitor requires an interactive terminal (TTY). Run in a proper terminal window or use --legacy flag.');
  }

  setTerminalBg(palette.bg);

  const detailType = (options.detailType as 'session' | 'workspace') || undefined;

  const instance = render(
    h(App, { initialSessionId: sessionId, apiClient, initialDetailType: detailType }),
    { exitOnCtrlC: true }
  );

  try {
    await instance.waitUntilExit();
  } finally {
    resetTerminalBg();
  }
}

export { startInkMonitor, App };
