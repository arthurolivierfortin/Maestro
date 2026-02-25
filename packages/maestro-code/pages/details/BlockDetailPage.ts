// @ts-nocheck
/**
 * BlockDetailPage — wraps BlockDetail from @maestro/monitor.
 * Shows block info, fitness, sessions, and actions.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { BlockDetail } from '@maestro/monitor/components/BlockDetail.ts';

export interface BlockDetailPageProps {
  blockId: string;
  apiClient: any;
  onBack: () => void;
  onQuit: () => void;
}

const BlockDetailPage = ({ blockId, apiClient, onBack, onQuit }: BlockDetailPageProps) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(BlockDetail, {
      blockId,
      apiClient,
      onExit: onBack,
      onQuit,
    }),
  );
};

export { BlockDetailPage };
