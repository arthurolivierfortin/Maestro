// @ts-nocheck
/**
 * SessionDetailPage — wraps SessionMonitor from @maestro/monitor.
 * Shows full session detail (execution tree, logs, metrics, LLM activity).
 * Used from Spaces page when selecting a specific session.
 */

import { createElement as h } from 'react';
import { Box } from 'ink';
import { SessionMonitor } from '@maestro/monitor/components/SessionMonitor.ts';

export interface SessionDetailPageProps {
  sessionId: string;
  apiClient: any;
  onBack: () => void;
  onQuit: () => void;
}

const SessionDetailPage = ({ sessionId, apiClient, onBack, onQuit }: SessionDetailPageProps) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1 },
    h(SessionMonitor, {
      sessionId,
      apiClient,
      onExit: onBack,
      onQuit,
    }),
  );
};

export { SessionDetailPage };
