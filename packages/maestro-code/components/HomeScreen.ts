/**
 * HomeScreen — Dashboard page for the TUI monitor.
 *
 * Shows system status, active sessions, quick actions, and recent activity.
 *
 * Props:
 *   apiClient    API client instance
 *   onNavigate   (page: string) => void — navigate to a different page
 *   onSessionSelect  (sessionId: string) => void — open session detail
 *   onQuit       () => void — quit the app
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, label, primary, bold,
  statusColor, statusIcon,
  formatDuration, formatTime,
  prevPage, nextPage,
  spinnerFrame, breathingDot,
} from '../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { useAnimationTick } from '../hooks/useAnimationTick.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';

// ── System Status Panel ──────────────────────────────────────

interface SystemStatusProps {
  health: Record<string, any> | null;
  llmHealth: Record<string, any> | null;
  tick?: number;
}

const SystemStatus = ({ health, llmHealth, tick = 0 }: SystemStatusProps) => {
  const backendOk = health && !health.error;
  const llmOk = llmHealth && !llmHealth.error;

  const backendColor = backendOk ? theme.status.success : theme.status.error;
  const llmColor = llmOk ? theme.status.success : theme.status.error;

  // Animated status indicators
  const backendIcon = backendOk ? breathingDot(tick) : icons.failed;
  const llmIcon = llmOk ? breathingDot(tick + 3) : icons.failed; // offset for staggered animation

  // Extract model name from LLM health
  const modelName = llmHealth?.activeModel || '-';

  return h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 3 },
    h(Text, null,
      h(Text, { color: backendColor }, backendIcon),
      h(Text, null, ' '),
      muted('Backend: '),
      T(backendColor, backendOk ? 'Connected' : 'Error'),
    ),
    h(Text, null,
      h(Text, { color: llmColor }, llmIcon),
      h(Text, null, ' '),
      muted('LLM: '),
      T(llmColor, llmOk ? String(modelName) : 'Offline'),
    ),
  );
};

// ── Active Sessions Panel ────────────────────────────────────

interface ActiveSessionCardProps {
  session: Record<string, any>;
  index: number;
  isSelected: boolean;
  onSelect?: (id: string) => void;
  tick?: number;
}

const ActiveSessionCard = ({ session, index, isSelected, onSelect, tick = 0 }: ActiveSessionCardProps) => {
  const status = (session.status || 'unknown').toLowerCase();
  const sColor = statusColor(status);
  // Use animated spinner for running sessions
  const sIcon = status === 'running' ? spinnerFrame(tick) : statusIcon(status);
  const name = session.name || 'Unnamed';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';

  const vars = session.variables || {};
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
  const fitnessStr = fitness !== undefined && fitness !== null
    ? `${Math.round(fitness * 100)}%`
    : '-';

  const selector = isSelected ? icons.arrow : ' ';

  return h(Box, { flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    T(sColor, sIcon),
    h(Text, null, ' '),
    primary(name.length > 24 ? name.substring(0, 24) : name.padEnd(24)),
    h(Text, null, ' '),
    muted(shortId),
    h(Text, null, '  '),
    T(sColor, status.padEnd(10)),
    h(Text, null, ' '),
    muted('fit: '),
    T(sColor, fitnessStr),
  );
};

const SESSIONS_PER_PAGE = 10;

interface ActiveSessionsProps {
  sessions: Record<string, any>[];
  selectedIndex: number;
  page: number;
  totalPages: number;
  tick?: number;
}

const ActiveSessions = ({ sessions, selectedIndex, page, totalPages, tick = 0 }: ActiveSessionsProps) => {
  if (!sessions || sessions.length === 0) {
    return h(Box, { paddingLeft: 1 },
      muted('No active sessions'),
    );
  }

  const startIdx = page * SESSIONS_PER_PAGE;
  const endIdx = Math.min(startIdx + SESSIONS_PER_PAGE, sessions.length);
  const visibleSessions = sessions.slice(startIdx, endIdx);

  return h(Box, { flexDirection: 'column' },
    ...visibleSessions.map((session, i) => {
      const globalIdx = startIdx + i;
      return h(ActiveSessionCard, {
        key: session.id || `s-${globalIdx}`,
        session,
        index: globalIdx,
        isSelected: globalIdx === selectedIndex,
        tick,
      });
    }),
    totalPages > 1
      ? h(Box, { paddingLeft: 1, marginTop: 1, flexDirection: 'row', gap: 1 },
          muted('Page '),
          primary(String(page + 1)),
          muted('/' + totalPages),
          h(Text, null, '  '),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
          h(Text, { color: theme.shortcut.key }, 'PgUp'),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '/'),
          h(Text, { color: theme.shortcut.key }, 'PgDn'),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
          muted(' navigate'),
        )
      : null,
  );
};

// ── Quick Actions Panel ──────────────────────────────────────

const QuickActions = () =>
  h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'S'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Spaces'),
    ),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'F'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Foundry'),
    ),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'C'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Catalog'),
    ),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'M'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Models'),
    ),
    h(Text, null,
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'Enter'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Open session'),
    ),
  );

// ── Quit Confirmation Overlay ─────────────────────────────────

interface QuitConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const QuitConfirmation = ({ onConfirm, onCancel }: QuitConfirmationProps) => {
  useKeyboard({
    enter: onConfirm,
    escape: onCancel,
    q: onConfirm,
    n: onCancel,
  });

  return h(Box, {
    flexDirection: 'column',
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.status.warning,
    paddingLeft: 2,
    paddingRight: 2,
    width: 42,
    alignSelf: 'center',
    marginTop: 3,
  },
    h(Text, null, ''),
    h(Text, { color: theme.status.warning, bold: true }, '  Quit Maestro Monitor?'),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row', gap: 3, paddingLeft: 2 },
      h(Text, null,
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: theme.shortcut.key }, 'Enter'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '/'),
        h(Text, { color: theme.shortcut.key }, 'q'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
        muted(' Yes'),
      ),
      h(Text, null,
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: theme.shortcut.key }, 'Esc'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '/'),
        h(Text, { color: theme.shortcut.key }, 'n'),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, ']'),
        muted(' No'),
      ),
    ),
    h(Text, null, ''),
  );
};

// ── HomeScreen component ─────────────────────────────────────

interface HomeScreenProps {
  apiClient: any;
  onNavigate: (page: string) => void;
  onSessionSelect: (id: string) => void;
  onQuit: () => void;
  keyboardActive?: boolean;
}

const HomeScreen = ({ apiClient, onNavigate, onSessionSelect, onQuit, keyboardActive }: HomeScreenProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const tick = useAnimationTick(120);

  // Fetch data (all with .catch to prevent unhandled rejections on first render)
  const { data: health } = useApiData(
    useCallback((): Promise<any> => apiClient.getHealth().catch((): any => ({ error: true })), [apiClient]),
    5000
  );
  const { data: llmHealth } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMHealth().catch((): null => null), [apiClient]),
    10000
  );
  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions().catch((): any[] => []), [apiClient]),
    5000
  );

  const sessionList: any[] = (sessions as any[]) || [];
  const runningCount = sessionList.filter((s: any) => s.status === 'running').length;
  const totalPages = Math.max(1, Math.ceil(sessionList.length / SESSIONS_PER_PAGE));

  // Keep page in bounds when session list changes
  const currentPage = Math.min(page, totalPages - 1);

  const askQuit = () => setShowQuitConfirm(true);

  const navigateUp = () => {
    setSelectedIndex(i => {
      const newIdx = Math.max(0, i - 1);
      // Auto-switch page if selection goes above current page
      const newPage = Math.floor(newIdx / SESSIONS_PER_PAGE);
      setPage(newPage);
      return newIdx;
    });
  };

  const navigateDown = () => {
    setSelectedIndex(i => {
      const newIdx = Math.min(sessionList.length - 1, i + 1);
      // Auto-switch page if selection goes below current page
      const newPage = Math.floor(newIdx / SESSIONS_PER_PAGE);
      setPage(newPage);
      return newIdx;
    });
  };

  const pageUp = () => {
    setPage(p => {
      const newPage = Math.max(0, p - 1);
      // Move selection to first item on new page
      setSelectedIndex(newPage * SESSIONS_PER_PAGE);
      return newPage;
    });
  };

  const pageDown = () => {
    setPage(p => {
      const newPage = Math.min(totalPages - 1, p + 1);
      // Move selection to first item on new page
      const firstOnPage = newPage * SESSIONS_PER_PAGE;
      setSelectedIndex(Math.min(firstOnPage, sessionList.length - 1));
      return newPage;
    });
  };

  // Keyboard — disabled when quit confirmation is showing or input bar is focused
  useKeyboard(showQuitConfirm ? {} : {
    up: navigateUp,
    down: navigateDown,
    k: navigateUp,
    j: navigateDown,
    // PgUp/PgDown via Ctrl+Up/Down (terminal PgUp/PgDn not standard in Ink)
    ctrlUp: pageUp,
    ctrlDown: pageDown,
    // Ctrl+Left/Right = switch page (wrap-around)
    ctrlLeft: () => onNavigate(prevPage('home')),
    ctrlRight: () => onNavigate(nextPage('home')),
    enter: () => {
      if (sessionList.length > 0 && sessionList[selectedIndex]) {
        onSessionSelect(sessionList[selectedIndex].id);
      }
    },
    h: () => {}, // Already on home, no-op
    a: () => onNavigate('agent'),
    s: () => onNavigate('spaces'),
    f: () => onNavigate('foundry'),
    c: () => onNavigate('catalog'),
    m: () => onNavigate('models'),
    q: askQuit,
    escape: askQuit,
  }, { isActive: keyboardActive !== false });

  // Quit confirmation overlay
  if (showQuitConfirm) {
    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
      h(NavBar, { currentPage: 'home', sessionCount: sessionList.length, runningCount }),
      h(Box, { flexGrow: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
        h(QuitConfirmation, {
          onConfirm: onQuit,
          onCancel: () => setShowQuitConfirm(false),
        }),
      ),
    );
  }

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // NavBar
    h(NavBar, { currentPage: 'home', sessionCount: sessionList.length, runningCount }),

    // System Status
    h(Panel, { title: 'SYSTEM STATUS', height: 3, width: '100%' },
      h(SystemStatus, { health, llmHealth, tick }),
    ),

    // Main content: Active Sessions | Quick Actions
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Active Sessions (left, 70%)
      h(Panel, { title: 'ACTIVE SESSIONS', flexGrow: 1 },
        h(ActiveSessions, { sessions: sessionList, selectedIndex, page: currentPage, totalPages, tick }),
      ),

      // Quick Actions (right, 30%)
      h(Panel, { title: 'QUICK ACTIONS', width: 25 },
        h(QuickActions),
      ),
    ),
  );
};

export { HomeScreen };
