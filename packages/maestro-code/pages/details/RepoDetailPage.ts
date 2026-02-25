// @ts-nocheck
/**
 * RepoDetailPage — wraps RepoDetail from @maestro/monitor.
 * Shows repo info, linked sessions, and .maestro directory stats.
 */

import { createElement as h } from 'react';
import { Box } from 'ink';
import { RepoDetail } from '@maestro/monitor/components/RepoDetail.ts';

export interface RepoDetailPageProps {
  repoId: string;
  apiClient: any;
  onBack: () => void;
  onQuit: () => void;
}

const RepoDetailPage = ({ repoId, apiClient, onBack, onQuit }: RepoDetailPageProps) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(RepoDetail, {
      repoId,
      apiClient,
      onExit: onBack,
      onQuit,
    }),
  );
};

export { RepoDetailPage };
