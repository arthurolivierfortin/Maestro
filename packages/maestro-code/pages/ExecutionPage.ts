// @ts-nocheck
/**
 * ExecutionPage — Full-screen page wrapping SessionMonitor from @maestro/monitor.
 *
 * - If sessionId is null → "No active session" message with navigation hint
 * - If sessionId exists → renders SessionMonitor with apiClient + sessionId
 *
 * SessionMonitor handles its own:
 * - 3 modes (descriptor/execution/idle) auto-detected from session data
 * - Panel focus (Tab/Shift-Tab), zoom (z), toggles (t/f/w/v/l)
 * - Data polling via useSessionData
 * - NavBar + StatusBar (internal chrome — visual overlap with SpatialStatusBar accepted)
 *
 * Phase 41-D.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { SessionMonitor } from '@maestro/monitor/components/SessionMonitor.ts';

// ── Props ──────────────────────────────────────────────────────

export interface ExecutionPageProps {
  sessionId: string | null;
  apiClient: any;
  height: number;
  onExit?: () => void;
  onQuit?: () => void;
}

// ── No-session placeholder ────────────────────────────────────

const NoSessionView = ({ height }: { height: number }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: 'gray',
      paddingX: 3,
      paddingY: 1,
      width: 50,
    },
      h(Text, { color: 'yellow', bold: true }, 'No active session'),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray' }, 'Start a task on the Agent page to create a session.'),
      h(Text, { color: 'gray' }, 'The execution tree, logs, and metrics will appear here.'),
      h(Box, { height: 1 }),
      h(Text, { color: 'cyan', dimColor: true }, 'Ctrl+Down  Back to Agent'),
    ),
  );
};

// ── ExecutionPage ─────────────────────────────────────────────

const ExecutionPage = ({ sessionId, apiClient, height, onExit, onQuit }: ExecutionPageProps) => {
  if (!sessionId || !apiClient) {
    return h(NoSessionView, { height });
  }

  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(SessionMonitor, {
      sessionId,
      apiClient,
      onExit: onExit || null,
      onQuit: onQuit || null,
    }),
  );
};

export { ExecutionPage };
