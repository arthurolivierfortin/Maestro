// @ts-nocheck
/**
 * SpacesPage — wraps SpacesScreen from @maestro/monitor.
 *
 * 3 tabs: Repos / Workspaces / Sessions.
 * Manages internal detail state for selected items.
 *
 * In demo mode, shows mock data from mocks/demo-data.ts.
 *
 * Phase 41-E/G/H.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { SpacesScreen } from '@maestro/monitor/components/SpacesScreen.ts';
import { SessionDetailPage } from './details/SessionDetailPage.ts';
import { WorkspaceDetailPage } from './details/WorkspaceDetailPage.ts';
import { RepoDetailPage } from './details/RepoDetailPage.ts';
import { DEMO_REPOS, DEMO_WORKSPACES, DEMO_SESSIONS } from '../mocks/demo-data.ts';

export interface SpacesPageProps {
  apiClient: any;
  height: number;
  onQuit: () => void;
  demoMode?: boolean;
}

type DetailState =
  | { type: 'session'; id: string }
  | { type: 'workspace'; id: string }
  | { type: 'repo'; id: string }
  | null;

// ── Status color helper ──────────────────────────────────────

function statusColor(s: string): string {
  return s === 'completed' ? 'green' : s === 'active' ? 'cyan' : s === 'error' ? 'red' : 'gray';
}

function statusIcon(s: string): string {
  return s === 'completed' ? '✓' : s === 'active' ? '●' : s === 'error' ? '✗' : '○';
}

// ── Empty / no-client view ───────────────────────────────────

const EmptySpacesView = ({ height, message }: { height: number; message: string }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'gray',
      paddingX: 3,
      paddingY: 1,
      width: 50,
    },
      h(Text, { color: 'cyan', bold: true }, '⬡ Spaces'),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray' }, message),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, 'Ctrl+Left → Agent'),
    ),
  );
};

// ── Demo spaces view ─────────────────────────────────────────

const DemoSpacesView = ({ height }: { height: number }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'cyan',
      paddingX: 2,
      paddingY: 1,
      width: 72,
    },
      h(Text, { color: 'cyan', bold: true }, '⬡ Spaces'),
      h(Box, { height: 1 }),

      // ── Repos section ──
      h(Text, { color: 'yellow', bold: true }, `Repos (${DEMO_REPOS.length})`),
      ...DEMO_REPOS.map((repo) =>
        h(Box, { key: repo.id, flexDirection: 'row', paddingLeft: 1 },
          h(Text, { color: 'cyan' }, '◆ '),
          h(Text, { color: 'white', bold: true }, repo.name.padEnd(18)),
          h(Text, { color: 'gray' }, repo.language.padEnd(16)),
          h(Text, { color: 'gray', dimColor: true }, repo.lastActivity),
        )
      ),
      h(Box, { height: 1 }),

      // ── Workspaces section ──
      h(Text, { color: 'yellow', bold: true }, `Workspaces (${DEMO_WORKSPACES.length})`),
      ...DEMO_WORKSPACES.map((ws) =>
        h(Box, { key: ws.id, flexDirection: 'row', paddingLeft: 1 },
          h(Text, { color: 'magenta' }, '⬡ '),
          h(Text, { color: 'white', bold: true }, ws.name.padEnd(18)),
          h(Text, { color: 'gray' }, `${ws.sessions} sessions`.padEnd(16)),
          h(Text, { color: 'gray', dimColor: true }, ws.created),
        )
      ),
      h(Box, { height: 1 }),

      // ── Sessions section ──
      h(Text, { color: 'yellow', bold: true }, `Sessions (${DEMO_SESSIONS.length})`),
      ...DEMO_SESSIONS.map((sess) =>
        h(Box, { key: sess.id, flexDirection: 'row', paddingLeft: 1 },
          h(Text, { color: statusColor(sess.status) }, statusIcon(sess.status) + ' '),
          h(Text, { color: statusColor(sess.status) }, sess.status.padEnd(10)),
          h(Text, { color: 'white' }, sess.name.padEnd(30)),
          h(Text, { color: 'gray', dimColor: true }, sess.duration),
        )
      ),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, '[DEMO] Read-only preview'),
    ),
  );
};

// ── Main SpacesPage ──────────────────────────────────────────

const SpacesPage = ({ apiClient, height, onQuit, demoMode }: SpacesPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setDetail({ type: 'session', id: sessionId });
  }, []);

  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    setDetail({ type: 'workspace', id: workspaceId });
  }, []);

  const handleRepoSelect = useCallback((repoId: string) => {
    setDetail({ type: 'repo', id: repoId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  // Demo mode — always show demo view
  if (demoMode) return h(DemoSpacesView, { height });

  // No API client — show empty state
  if (!apiClient) return h(EmptySpacesView, { height, message: 'No API client available.' });

  // Detail views
  if (detail) {
    switch (detail.type) {
      case 'session':
        return h(SessionDetailPage, {
          sessionId: detail.id,
          apiClient,
          onBack: handleBack,
          onQuit,
        });
      case 'workspace':
        return h(WorkspaceDetailPage, {
          workspaceId: detail.id,
          apiClient,
          onBack: handleBack,
          onQuit,
        });
      case 'repo':
        return h(RepoDetailPage, {
          repoId: detail.id,
          apiClient,
          onBack: handleBack,
          onQuit,
        });
    }
  }

  // List view: SpacesScreen from monitor
  // onNavigate is a noop — spatial navigation is handled by App.ts via Ctrl+Arrow
  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(SpacesScreen, {
      apiClient,
      onNavigate: () => {},
      onSessionSelect: handleSessionSelect,
      onWorkspaceSelect: handleWorkspaceSelect,
      onRepoSelect: handleRepoSelect,
      onQuit,
    }),
  );
};

export { SpacesPage };
