// @ts-nocheck
/**
 * WorkspaceDetailPage — wraps WorkspaceDetail from @maestro/monitor.
 * Shows workspace info, linked sessions, and settings.
 */

import { createElement as h } from 'react';
import { Box } from 'ink';
import { WorkspaceDetail } from '@maestro/monitor/components/WorkspaceDetail.ts';

export interface WorkspaceDetailPageProps {
  workspaceId: string;
  apiClient: any;
  onBack: () => void;
  onQuit: () => void;
}

const WorkspaceDetailPage = ({ workspaceId, apiClient, onBack, onQuit }: WorkspaceDetailPageProps) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(WorkspaceDetail, {
      workspaceId,
      apiClient,
      onExit: onBack,
      onQuit,
    }),
  );
};

export { WorkspaceDetailPage };
