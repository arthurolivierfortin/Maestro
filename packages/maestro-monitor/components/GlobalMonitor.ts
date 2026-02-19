// @ts-nocheck
/**
 * GlobalMonitor — Top-level session-list screen.
 *
 * Ink equivalent of the blessed GlobalMonitor class.
 *
 * Props:
 *   apiClient        API client instance (must expose listSessions())
 *   onSessionSelect  (sessionId: string) => void — called when the user opens a session
 */

import { createElement as h, useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import {
  theme, icons,
  label, muted, running, error,
  T,
} from '../theme.ts';
import { useSessionData } from '../hooks/useSessionData.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { Panel } from './Panel.ts';
import { SessionList } from './SessionList.ts';
import { StatusBar } from './StatusBar.ts';

// ── Help overlay ───────────────────────────────────────────────

const HelpOverlay = ({ onClose }) => {
  useKeyboard({
    escape: onClose,
    enter: onClose,
    q: onClose,
    '?': onClose,
    up: onClose,
    down: onClose,
    r: onClose,
    h: onClose,
  });

  const lines = [
    '',
    '  Maestro Monitor - Session List',
    '',
    '  Navigation:',
    '    \u2191/k     Move up',
    '    \u2193/j     Move down',
    '    Enter   Open selected session',
    '    1-9     Quick select session',
    '',
    '  Actions:',
    '    r       Refresh list',
    '    q       Quit',
    '',
    '  Press any key to close...',
    '',
  ];

  return h(Box, {
    flexDirection: 'column',
    borderStyle: theme.panel.borderStyle,
    borderColor: theme.panel.borderFocused,
    paddingLeft: 2,
    paddingRight: 2,
    width: 45,
    alignSelf: 'center',
    marginTop: 2,
  },
    ...lines.map((line, i) =>
      h(Text, { key: `help-${i}` }, line),
    ),
  );
};

// ── Error state ────────────────────────────────────────────────

const ErrorContent = ({ message }) =>
  h(Panel, {
    title: 'ERROR',
    flexGrow: 1,
    width: '100%',
  },
    h(Box, { flexDirection: 'column', paddingLeft: 1, paddingTop: 1 },
      error('Failed to fetch sessions'),
      h(Text, null, ''),
      muted(message || 'Unknown error'),
      h(Text, null, ''),
      muted('Press [r] to retry'),
    )
  );

// ── Header ─────────────────────────────────────────────────────

const ListHeader = ({ sessions = [], connectionStatus, errorMessage }) => {
  const count = sessions.length;
  const runningCount = sessions.filter(s => s.status === 'running').length;

  if (connectionStatus === 'error') {
    return h(Panel, { title: 'MAESTRO SESSIONS', height: 5, width: '100%' },
      h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 2 },
        error(`${icons.connected} Connection Error`),
        muted(errorMessage || ''),
      )
    );
  }

  return h(Panel, { title: 'MAESTRO SESSIONS', height: 5, width: '100%' },
    h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 2 },
      muted(`${count} session(s)`),
      runningCount > 0
        ? running(`${runningCount} running`)
        : null,
    )
  );
};

// ── GlobalMonitor component ────────────────────────────────────

const GlobalMonitor = ({ apiClient, onSessionSelect, onQuit }) => {
  const { exit } = useApp();
  const doQuit = onQuit || (() => exit());

  // Data fetching: poll every 3 seconds in list mode (sessionId = null)
  const {
    sessions,
    error: fetchError,
    connectionStatus,
    latency,
    lastRefresh,
  } = useSessionData(apiClient, null, 3000);

  // Local UI state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Clamp selectedIndex when sessions change
  useEffect(() => {
    if (selectedIndex >= sessions.length && sessions.length > 0) {
      setSelectedIndex(Math.max(0, sessions.length - 1));
    }
  }, [sessions.length]);

  // Open the currently selected session
  const openSelected = () => {
    if (sessions.length === 0) return;
    const session = sessions[selectedIndex];
    if (!session) return;
    if (onSessionSelect) {
      onSessionSelect(session.id);
    }
  };

  // Quick-select by number (1-9)
  const quickSelect = (num) => {
    if (num >= 1 && num <= sessions.length) {
      setSelectedIndex(num - 1);
      // Open immediately
      const session = sessions[num - 1];
      if (session && onSessionSelect) {
        onSessionSelect(session.id);
      }
    }
  };

  // Keyboard handlers — only active when help overlay is NOT shown
  useKeyboard(showHelp ? {} : {
    up: () => setSelectedIndex(i => Math.max(0, i - 1)),
    down: () => setSelectedIndex(i => Math.min(sessions.length - 1, i + 1)),
    k: () => setSelectedIndex(i => Math.max(0, i - 1)),
    j: () => setSelectedIndex(i => Math.min(sessions.length - 1, i + 1)),
    enter: openSelected,
    number: quickSelect,
    q: () => doQuit(),
    escape: () => doQuit(),
    '?': () => setShowHelp(true),
    h: () => setShowHelp(true),
  });

  // ── Render ───────────────────────────────────────────────────

  const statusBarProps = {
    connectionStatus, latency, lastRefresh,
    mode: 'idle',
    visiblePanels: {},
    hasBackOption: false,
  };

  // Help overlay takes over the entire area
  if (showHelp) {
    return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
      h(ListHeader, { sessions, connectionStatus, errorMessage: fetchError }),
      h(HelpOverlay, { onClose: () => setShowHelp(false) }),
      h(Box, { flexGrow: 1 }),
      h(StatusBar, statusBarProps),
    );
  }

  // Normal view
  return h(Box, {
    flexDirection: 'column',
    width: '100%',
    flexGrow: 1,
  },
    h(ListHeader, { sessions, connectionStatus, errorMessage: fetchError }),

    connectionStatus === 'error'
      ? h(ErrorContent, { message: fetchError })
      : h(Panel, { title: 'SESSIONS', flexGrow: 1, width: '100%' },
          h(SessionList, { sessions, selectedIndex })
        ),

    h(StatusBar, statusBarProps),
  );
};

export { GlobalMonitor };
