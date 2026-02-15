// @ts-nocheck
/**
 * Phase 24: PersistentStatusBar — always-visible bottom bar showing system health.
 * Displays: backend status, LLM status, active session, connection indicator.
 */

import { createElement as h } from 'react';
const { Box, Text } = require('ink');

interface PersistentStatusBarProps {
  backendOk: boolean;
  llmStatus?: string;
  llmModel?: string;
  activeSession?: { id: string; name: string; status: string } | null;
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
}

export function PersistentStatusBar({
  backendOk,
  llmStatus,
  llmModel,
  activeSession,
  connectionState = 'connected',
}: PersistentStatusBarProps) {
  // Connection indicator
  const connIcon = connectionState === 'connected' ? '●'
    : connectionState === 'reconnecting' ? '◐'
    : '○';
  const connColor = connectionState === 'connected' ? 'green'
    : connectionState === 'reconnecting' ? 'yellow'
    : 'red';

  // Backend indicator
  const backendIcon = backendOk ? '●' : '○';
  const backendColor = backendOk ? 'green' : 'red';

  // LLM indicator
  const llmOk = llmStatus === 'online' || llmStatus === 'ok' || llmStatus === 'connected';
  const llmIcon = llmOk ? '●' : '○';
  const llmColor = llmOk ? 'green' : 'yellow';

  return h(Box, {
    borderStyle: 'single',
    borderColor: 'gray',
    paddingLeft: 1,
    paddingRight: 1,
    justifyContent: 'space-between',
    width: '100%',
  },
    // Left: connection + backend + LLM
    h(Box, { gap: 2 },
      h(Text, null,
        h(Text, { color: connColor }, connIcon),
        h(Text, { color: 'gray' }, ' conn')
      ),
      h(Text, null,
        h(Text, { color: backendColor }, backendIcon),
        h(Text, { color: 'gray' }, ' api')
      ),
      h(Text, null,
        h(Text, { color: llmColor }, llmIcon),
        h(Text, { color: 'gray' }, ` llm${llmModel ? ` (${llmModel})` : ''}`)
      )
    ),

    // Right: active session
    h(Box, null,
      activeSession
        ? h(Text, null,
            h(Text, { color: 'gray' }, 'session: '),
            h(Text, { color: 'cyan' }, `${activeSession.name || activeSession.id.substring(0, 8)}`),
            h(Text, { color: 'gray' }, ` [${activeSession.status}]`)
          )
        : h(Text, { color: 'gray' }, 'no active session')
    )
  );
}
