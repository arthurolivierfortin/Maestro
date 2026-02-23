// @ts-nocheck
/**
 * AgentActivity — Mini-panel showing agent state + activity indicator.
 *
 * Shows when the agent is on the same screen as the user.
 * Displays:
 * - Agent state indicator (idle/working/navigating/waiting)
 * - Current task summary
 * - Animation (breathing dot when idle, spinner when working)
 *
 * This is the "mini-panel overlay" from the Agent-in-the-Cockpit pattern.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { useAnimationTick } from '@maestro/tui/hooks';
import { spinnerFrame, breathingDot } from '@maestro/tui/theme/animations';
import type { AgentState } from '../types.ts';

interface AgentActivityProps {
  agentState: AgentState;
  taskSummary?: string;
  sessionId?: string | null;
}

const STATE_CONFIG: Record<AgentState, { icon: string; color: string; label: string }> = {
  idle: { icon: '●', color: 'green', label: 'Agent idle' },
  working: { icon: '◉', color: 'cyan', label: 'Agent working' },
  navigating: { icon: '→', color: 'yellow', label: 'Agent navigating' },
  'waiting-input': { icon: '?', color: 'magenta', label: 'Agent waiting for input' },
};

const AgentActivity = ({ agentState, taskSummary, sessionId }: AgentActivityProps) => {
  const tick = useAnimationTick(150);

  const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle;

  // Animated indicator
  let indicator: string;
  if (agentState === 'working') {
    indicator = spinnerFrame(tick);
  } else if (agentState === 'idle') {
    indicator = breathingDot(tick);
  } else {
    indicator = config.icon;
  }

  return h(Box, {
    borderStyle: 'single',
    borderColor: config.color,
    paddingX: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 3,
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: config.color }, indicator),
      h(Text, null, ' '),
      h(Text, { color: config.color, bold: agentState === 'working' }, config.label),
      taskSummary
        ? h(Text, { color: 'gray' }, ` — ${taskSummary.length > 40 ? taskSummary.slice(0, 40) + '...' : taskSummary}`)
        : null,
    ),
    sessionId
      ? h(Text, { color: 'gray', dimColor: true }, `session: ${sessionId.slice(0, 8)}`)
      : null,
  );
};

export { AgentActivity };
