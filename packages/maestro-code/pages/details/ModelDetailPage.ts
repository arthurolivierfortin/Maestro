// @ts-nocheck
/**
 * ModelDetailPage — wraps ModelDetail from @maestro/monitor.
 * Shows model health, usage stats, and performance metrics.
 */

import { createElement as h } from 'react';
import { Box } from 'ink';
import { ModelDetail } from '@maestro/monitor/components/ModelDetail.ts';

export interface ModelDetailPageProps {
  modelId: string;
  apiClient: any;
  onBack: () => void;
  onQuit: () => void;
}

const ModelDetailPage = ({ modelId, apiClient, onBack, onQuit }: ModelDetailPageProps) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(ModelDetail, {
      modelId,
      apiClient,
      onExit: onBack,
      onQuit,
    }),
  );
};

export { ModelDetailPage };
