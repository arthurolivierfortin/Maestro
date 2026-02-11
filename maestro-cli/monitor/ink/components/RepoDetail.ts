// @ts-nocheck
/**
 * RepoDetail — Repo/Project detail page.
 *
 * Shows repo info, linked sessions, and .maestro directory stats.
 * Enter on a session → navigates to SessionMonitor.
 *
 * Props:
 *   repoId           string
 *   apiClient        API client instance
 *   onExit           () => void — back to previous page
 *   onQuit           () => void — quit app
 *   onSessionSelect  (sessionId: string) => void
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary, bold,
  statusColor, statusIcon,
} from '../theme.ts';
import { useApiData } from '../hooks/useApiData.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { Panel } from './Panel.ts';
import { StatusBar } from './StatusBar.ts';

// ── Session row (compact) ────────────────────────────────────

const SessionRow = ({ session, isSelected }) => {
  const status = (session.status || 'unknown').toLowerCase();
  const sColor = statusColor(status);
  const sIcon = statusIcon(status);
  const name = session.name || 'Unnamed';
  const shortId = session.id ? session.id.substring(0, 8) : '--------';
  const selector = isSelected ? icons.arrow : ' ';

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    T(sColor, sIcon),
    h(Text, null, ' '),
    h(Text, { color: isSelected ? 'cyan' : 'white' },
      name.length > 30 ? name.substring(0, 30) : name.padEnd(30)),
    h(Text, null, ' '),
    muted(shortId),
    h(Text, null, '  '),
    T(sColor, status),
  );
};

// ── Info panel content ───────────────────────────────────────

const InfoContent = ({ project }) => {
  const info = project?.maestroInfo || {};
  const containerStatus = project?.containerStatus || 'unknown';
  const csColor = statusColor(containerStatus);

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Container:          '),
      T(csColor, containerStatus),
    ),
    h(Box, { flexDirection: 'row' },
      muted('.maestro/blocks:    '),
      primary(String(info.blocks ?? 0)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('.maestro/artifacts: '),
      primary(String(info.artifacts ?? 0)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('.maestro/metrics:   '),
      primary(String(info.metrics ?? 0)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('.maestro/logs:      '),
      primary(String(info.logs ?? 0)),
    ),
  );
};

// ── RepoDetail component ────────────────────────────────────

const RepoDetail = ({ repoId, apiClient, onExit, onQuit, onSessionSelect, initialState }) => {
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const [activePanel, setActivePanel] = useState(initialState?.activePanel ?? 'sessions'); // 'sessions' | 'info'

  // Fetch project detail
  const {
    data: project,
    connectionStatus,
    latency,
    lastRefresh,
  } = useApiData(
    useCallback(() => apiClient.getProject(repoId), [apiClient, repoId]),
    5000
  );

  // Fetch all sessions to filter by project
  const { data: allSessions } = useApiData(
    useCallback(() => apiClient.listSessions().catch(() => []), [apiClient]),
    5000
  );

  // Filter sessions belonging to this project
  const sessionIds = project?.sessionIds || [];
  const sessions = (allSessions || []).filter(s => sessionIds.includes(s.id));

  const maxIndex = Math.max(0, sessions.length - 1);
  const clampedIndex = Math.min(selectedIndex, maxIndex);

  // Keyboard
  useKeyboard({
    up: () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.max(0, i - 1));
    },
    down: () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.min(maxIndex, i + 1));
    },
    k: () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.max(0, i - 1));
    },
    j: () => {
      if (activePanel === 'sessions') setSelectedIndex(i => Math.min(maxIndex, i + 1));
    },
    tab: () => setActivePanel(p => p === 'sessions' ? 'info' : 'sessions'),
    enter: () => {
      if (activePanel === 'sessions' && sessions.length > 0) {
        const session = sessions[clampedIndex];
        if (session) onSessionSelect(session.id, { selectedIndex, activePanel });
      }
    },
    escape: onExit,
    q: onQuit,
  });

  const proj = project || {};
  const projStatus = (proj.containerStatus || 'unknown').toLowerCase();
  const projStatusColor = statusColor(projStatus);

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'REPO', width: '100%' },
      h(Box, { flexDirection: 'column', paddingLeft: 1 },
        h(Box, { flexDirection: 'row', gap: 2 },
          bold(proj.name || repoId),
          h(Text, null, '  '),
          muted(proj.id || repoId),
          h(Text, null, '  '),
          T(projStatusColor, statusIcon(projStatus)),
          h(Text, null, ' '),
          T(projStatusColor, projStatus),
        ),
        h(Box, { flexDirection: 'row' },
          muted('Path: '),
          primary(proj.rootPath || '-'),
        ),
      ),
    ),

    // Content: Sessions + Info side by side
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Sessions panel (left, 60%)
      h(Panel, {
        title: 'SESSIONS',
        focused: activePanel === 'sessions',
        width: '60%',
      },
        h(Box, { flexDirection: 'column' },
          h(Box, { paddingLeft: 2, marginBottom: 1 },
            muted(`${sessions.length} session(s)`),
          ),
          sessions.length === 0
            ? h(Box, { paddingLeft: 2 }, muted('(no sessions linked)'))
            : h(Box, { flexDirection: 'column' },
                ...sessions.map((s, i) =>
                  h(SessionRow, {
                    key: s.id,
                    session: s,
                    isSelected: activePanel === 'sessions' && i === clampedIndex,
                  })
                ),
              ),
        ),
      ),

      // Info panel (right, 40%)
      h(Panel, {
        title: 'INFO',
        focused: activePanel === 'info',
        flexGrow: 1,
      },
        h(InfoContent, { project: proj }),
      ),
    ),

    // Status bar
    h(StatusBar, {
      connectionStatus,
      latency,
      lastRefresh,
      currentPage: 'spaces',
    }),
  );
};

export { RepoDetail };
