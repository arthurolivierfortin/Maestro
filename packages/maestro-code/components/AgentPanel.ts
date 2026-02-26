// @ts-nocheck
/**
 * AgentPanel — Conversation log + agent state indicator.
 *
 * A focusable panel that displays the agent's conversation log,
 * following the monitor's Panel style. Used inside SessionMonitor
 * as the 'agent' panel in execution mode.
 *
 * Shows:
 * - State badge (idle/working/completed/error) with session ID
 * - ConversationLog (user messages + agent activity, auto-scrolling)
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { ConversationLog } from './ConversationLog.ts';
import type { LogLine } from '../services/SessionManager.ts';

export interface AgentPanelProps {
  lines: LogLine[];
  agentState: 'idle' | 'working' | 'completed' | 'error';
  sessionId: string | null;
}

const STATE_DISPLAY = {
  idle: { icon: '○', color: 'gray', label: 'idle' },
  working: { icon: '●', color: 'cyan', label: 'working' },
  completed: { icon: '✓', color: 'green', label: 'completed' },
  error: { icon: '✗', color: 'red', label: 'error' },
};

const AgentPanel = ({ lines, agentState, sessionId }: AgentPanelProps) => {
  const state = STATE_DISPLAY[agentState] || STATE_DISPLAY.idle;
  const shortId = sessionId ? sessionId.substring(0, 8) : null;

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // State badge line
    h(Box, { flexDirection: 'row', paddingX: 1, marginBottom: 0 },
      h(Text, { color: state.color }, `${state.icon} ${state.label}`),
      shortId
        ? h(Text, { color: 'gray', dimColor: true }, `  session:${shortId}`)
        : null,
    ),

    // Conversation log (fills remaining space)
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(ConversationLog, { lines, height: 999 }),
    ),
  );
};

export { AgentPanel };
