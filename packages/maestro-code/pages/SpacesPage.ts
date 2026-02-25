// @ts-nocheck
/**
 * SpacesPage — wraps SpacesScreen from @maestro/monitor.
 *
 * 3 tabs: Repos / Workspaces / Sessions.
 * Manages internal detail state for selected items.
 *
 * Phase 41-E.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { SpacesScreen } from '@maestro/monitor/components/SpacesScreen.ts';
import { SessionDetailPage } from './details/SessionDetailPage.ts';
import { WorkspaceDetailPage } from './details/WorkspaceDetailPage.ts';
import { RepoDetailPage } from './details/RepoDetailPage.ts';

export interface SpacesPageProps {
  apiClient: any;
  height: number;
  onQuit: () => void;
}

type DetailState =
  | { type: 'session'; id: string }
  | { type: 'workspace'; id: string }
  | { type: 'repo'; id: string }
  | null;

const NoSpacesView = ({ height }: { height: number }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Text, { color: 'yellow', bold: true }, 'Spaces'),
    h(Box, { height: 1 }),
    h(Text, { color: 'gray' }, 'No API client available.'),
    h(Text, { color: 'cyan', dimColor: true }, 'Ctrl+Left  Back to Agent'),
  );
};

const SpacesPage = ({ apiClient, height, onQuit }: SpacesPageProps) => {
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

  if (!apiClient) {
    return h(NoSpacesView, { height });
  }

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
  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(SpacesScreen, {
      apiClient,
      onSessionSelect: handleSessionSelect,
      onWorkspaceSelect: handleWorkspaceSelect,
      onRepoSelect: handleRepoSelect,
      onQuit,
    }),
  );
};

export { SpacesPage };
