// @ts-nocheck
/**
 * AgentBadge — Small agent state indicator for the NavBar.
 *
 * Shows animated spinner when working, green dot when idle.
 * Designed to be passed as the `badge` prop to NavBar.
 */

import { createElement as h } from 'react';
import { Text } from 'ink';
import { useAnimationTick } from '@maestro/tui/hooks';
import { spinnerFrame, breathingDot, inkTheme as theme } from '@maestro/tui/theme';
import type { AgentState } from '../types.ts';

interface AgentBadgeProps {
  agentState: AgentState;
  busy?: boolean;
}

const AgentBadge = ({ agentState, busy }: AgentBadgeProps) => {
  const tick = useAnimationTick(150);

  if (agentState === 'working' || busy) {
    return h(Text, { color: theme.agent.working, bold: true },
      `${spinnerFrame(tick)} working`
    );
  }
  if (agentState === 'waiting-input') {
    return h(Text, { color: theme.agent.waiting },
      '? waiting'
    );
  }
  if (agentState === 'navigating') {
    return h(Text, { color: theme.agent.navigating },
      `→ navigating`
    );
  }
  // idle
  return h(Text, { color: theme.agent.idle },
    `${breathingDot(tick)} ready`
  );
};

export { AgentBadge };
