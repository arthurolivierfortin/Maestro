// @ts-nocheck
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
} from '../theme.ts';
import { useApiData } from '../hooks/useApiData.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';
import { StatusBar } from './StatusBar.ts';

// ── System Status Panel ──────────────────────────────────────

const SystemStatus = ({ health, llmHealth }) => {
  const backendOk = health && !health.error;
  const llmOk = llmHealth && !llmHealth.error;

  const backendStatus = backendOk ? 'connected' : 'error';
  const llmStatus = llmOk ? 'connected' : 'error';

  const backendColor = backendOk ? theme.status.success : theme.status.error;
  const llmColor = llmOk ? theme.status.success : theme.status.error;

  // Extract model name from LLM health
  const modelName = llmHealth?.activeModel || llmHealth?.model || llmHealth?.model_id || '-';

  return h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 3 },
    h(Text, null,
      h(Text, { color: backendColor }, icons.connected),
      h(Text, null, ' '),
      muted('Backend: '),
      T(backendColor, backendOk ? 'Connected' : 'Error'),
    ),
    h(Text, null,
      h(Text, { color: llmColor }, icons.connected),
      h(Text, null, ' '),
      muted('LLM: '),
      T(llmColor, llmOk ? String(modelName) : 'Offline'),
    ),
  );
};

// ── Active Sessions Panel ────────────────────────────────────

const ActiveSessionCard = ({ session, index, isSelected, onSelect }) => {
  const status = (session.status || 'unknown').toLowerCase();
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);
  const name = session.name || 'Unnamed';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';

  const vars = session.variables || {};
  const fitness = vars.currentFitness !== undefined ? vars.currentFitness : vars.fitness;
  const fitnessStr = fitness !== undefined && fitness !== null
    ? `${Math.round(fitness * 100)}%`
    : '-';

  const selector = isSelected ? icons.arrow : ' ';

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
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

const ActiveSessions = ({ sessions, selectedIndex }) => {
  if (!sessions || sessions.length === 0) {
    return h(Box, { paddingLeft: 1 },
      muted('No active sessions'),
    );
  }

  return h(Box, { flexDirection: 'column' },
    ...sessions.slice(0, 8).map((session, i) =>
      h(ActiveSessionCard, {
        key: session.id || `s-${i}`,
        session,
        index: i,
        isSelected: i === selectedIndex,
      })
    ),
    sessions.length > 8
      ? h(Box, { paddingLeft: 1 },
          muted(`  ... and ${sessions.length - 8} more`),
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

const QuitConfirmation = ({ onConfirm, onCancel }) => {
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

const HomeScreen = ({ apiClient, onNavigate, onSessionSelect, onQuit }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Fetch data
  const { data: health } = useApiData(
    useCallback(() => apiClient.getHealth(), [apiClient]),
    5000
  );
  const { data: llmHealth } = useApiData(
    useCallback(() => apiClient.getLLMHealth().catch(() => null), [apiClient]),
    10000
  );
  const {
    data: sessions,
    connectionStatus,
    latency,
    lastRefresh,
  } = useApiData(
    useCallback(() => apiClient.listSessions(), [apiClient]),
    5000
  );

  const sessionList = sessions || [];
  const runningCount = sessionList.filter(s => s.status === 'running').length;

  const askQuit = () => setShowQuitConfirm(true);

  // Keyboard — disabled when quit confirmation is showing
  useKeyboard(showQuitConfirm ? {} : {
    up: () => setSelectedIndex(i => Math.max(0, i - 1)),
    down: () => setSelectedIndex(i => Math.min(sessionList.length - 1, i + 1)),
    k: () => setSelectedIndex(i => Math.max(0, i - 1)),
    j: () => setSelectedIndex(i => Math.min(sessionList.length - 1, i + 1)),
    enter: () => {
      if (sessionList.length > 0 && sessionList[selectedIndex]) {
        onSessionSelect(sessionList[selectedIndex].id);
      }
    },
    h: () => {}, // Already on home, no-op
    s: () => onNavigate('spaces'),
    f: () => onNavigate('foundry'),
    c: () => onNavigate('catalog'),
    m: () => onNavigate('models'),
    q: askQuit,
    escape: askQuit,
    number: (num) => {
      const pageMap = { 1: 'home', 2: 'spaces', 3: 'foundry', 4: 'catalog', 5: 'models' };
      if (pageMap[num]) onNavigate(pageMap[num]);
    },
  });

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
      h(StatusBar, {
        connectionStatus,
        latency,
        lastRefresh,
        currentPage: 'home',
      }),
    );
  }

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // NavBar
    h(NavBar, { currentPage: 'home', sessionCount: sessionList.length, runningCount }),

    // System Status
    h(Panel, { title: 'SYSTEM STATUS', height: 3, width: '100%' },
      h(SystemStatus, { health, llmHealth }),
    ),

    // Main content: Active Sessions | Quick Actions
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Active Sessions (left, 70%)
      h(Panel, { title: 'ACTIVE SESSIONS', flexGrow: 1 },
        h(ActiveSessions, { sessions: sessionList, selectedIndex }),
      ),

      // Quick Actions (right, 30%)
      h(Panel, { title: 'QUICK ACTIONS', width: 25 },
        h(QuickActions),
      ),
    ),

    // StatusBar
    h(StatusBar, {
      connectionStatus,
      latency,
      lastRefresh,
      currentPage: 'home',
    }),
  );
};

export { HomeScreen };
