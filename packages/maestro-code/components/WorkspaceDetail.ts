/**
 * WorkspaceDetail — Workspace detail page.
 *
 * Shows workspace info, linked sessions, and settings.
 * Enter on a session → navigates to SessionMonitor.
 *
 * Props:
 *   workspaceId      string
 *   apiClient        API client instance
 *   onExit           () => void — back to previous page
 *   onQuit           () => void — quit app
 *   onSessionSelect  (sessionId: string) => void
 */

import { createElement as h, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary, bold,
  statusColor, statusIcon,
} from '../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useActionKeyboard } from '../hooks/useKeyboard.ts';
import { Panel } from './Panel.ts';
import { StatusBar } from './StatusBar.ts';

// ── Types ────────────────────────────────────────────────────

interface SessionRowProps {
  session: Record<string, any>;
  isSelected: boolean;
}

interface SettingsContentProps {
  settings: Record<string, any> | null;
}

interface WorkspaceDetailProps {
  workspaceId: string;
  apiClient: any;
  onExit: () => void;
  onQuit: () => void;
  onNavigate?: (page: string) => void;
  onSessionSelect: (id: string, state?: Record<string, any>) => void;
  initialState?: Record<string, any>;
}

// ── Session row (compact) ────────────────────────────────────

const SessionRow = ({ session, isSelected }: SessionRowProps): ReactNode => {
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

// ── Settings panel content ───────────────────────────────────

const SettingsContent = ({ settings }: SettingsContentProps): ReactNode => {
  if (!settings) return muted('(no settings)');

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Max concurrent:  '),
      primary(String(settings.maxConcurrentSessions ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Auto-promote:    '),
      primary(settings.autoPromotionEnabled ? 'on' : 'off'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Min fitness:     '),
      primary(String(settings.minFitnessForPromotion ?? '-')),
    ),
  );
};

// ── WorkspaceDetail component ────────────────────────────────

const WorkspaceDetail = ({ workspaceId, apiClient, onExit, onQuit, onNavigate, onSessionSelect, initialState }: WorkspaceDetailProps): ReactNode => {
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const [activePanel, setActivePanel] = useState(initialState?.activePanel ?? 'sessions'); // 'sessions' | 'settings'

  // Fetch workspace detail
  const {
    data: workspace,
    connectionStatus,
    latency,
    lastRefresh,
  } = useApiData(
    useCallback((): Promise<any> => apiClient.getWorkspace(workspaceId), [apiClient, workspaceId]),
    5000
  );

  // Fetch all sessions to filter by workspace
  const { data: allSessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions().catch((): any[] => []), [apiClient]),
    5000
  );

  // Filter sessions belonging to this workspace
  const sessionIds = workspace?.sessionIds || [];
  const sessions = ((allSessions as any[]) || []).filter((s: any) => sessionIds.includes(s.id));

  // Clamp index
  const maxIndex = Math.max(0, sessions.length - 1);
  const clampedIndex = Math.min(selectedIndex, maxIndex);

  // Keyboard (Schema A: detail context)
  useActionKeyboard({
    'cursor.up': () => {
      if (activePanel === 'sessions') setSelectedIndex((i: number) => Math.max(0, i - 1));
    },
    'cursor.down': () => {
      if (activePanel === 'sessions') setSelectedIndex((i: number) => Math.min(maxIndex, i + 1));
    },
    'cursor.upAlt': () => {
      if (activePanel === 'sessions') setSelectedIndex((i: number) => Math.max(0, i - 1));
    },
    'cursor.downAlt': () => {
      if (activePanel === 'sessions') setSelectedIndex((i: number) => Math.min(maxIndex, i + 1));
    },
    'panel.cycle': () => setActivePanel((p: string) => p === 'sessions' ? 'settings' : 'sessions'),
    'panel.next': () => setActivePanel((p: string) => p === 'sessions' ? 'settings' : 'sessions'),
    'panel.prev': () => setActivePanel((p: string) => p === 'sessions' ? 'settings' : 'sessions'),
    'tree.toggle': () => {
      if (activePanel === 'sessions' && sessions.length > 0) {
        const session = sessions[clampedIndex];
        if (session) onSessionSelect(session.id, { selectedIndex, activePanel });
      }
    },
    'back': onExit,
    'quit': onQuit,
    'page.home': () => { if (onNavigate) onNavigate('home'); },
    'page.spaces': () => { if (onNavigate) onNavigate('spaces'); },
    'page.foundry': () => { if (onNavigate) onNavigate('foundry'); },
    'page.catalog': () => { if (onNavigate) onNavigate('catalog'); },
    'page.models': () => { if (onNavigate) onNavigate('models'); },
  }, 'detail');

  const ws = workspace || {};
  const wsStatus = ws.status || 'Unknown';
  const wsStatusColor = wsStatus === 'Active' ? theme.status.success : theme.status.pending;

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'WORKSPACE', width: '100%' },
      h(Box, { flexDirection: 'column', paddingLeft: 1 },
        h(Box, { flexDirection: 'row', gap: 2 },
          bold(ws.name || workspaceId),
          h(Text, null, '  '),
          muted(workspaceId),
          h(Text, null, '  '),
          T(wsStatusColor, wsStatus),
        ),
        h(Box, { flexDirection: 'row' },
          muted('Type: '),
          primary(ws.type || '-'),
          h(Text, null, '   '),
          muted('Path: '),
          primary(ws.repositoryPath || '-'),
        ),
        ws.description
          ? h(Box, { flexDirection: 'row' },
              muted('Desc: '),
              primary(ws.description),
            )
          : null,
      ),
    ),

    // Content: Sessions + Settings side by side
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

      // Settings panel (right, 40%)
      h(Panel, {
        title: 'SETTINGS',
        focused: activePanel === 'settings',
        flexGrow: 1,
      },
        h(SettingsContent, { settings: ws.settings }),
      ),
    ),

    // Status bar
    h(StatusBar, {
      connectionStatus,
      latency,
      lastRefresh,
      currentPage: 'spaces',
      isDetailView: true,
      hasBackOption: true,
    }),
  );
};

export { WorkspaceDetail };
