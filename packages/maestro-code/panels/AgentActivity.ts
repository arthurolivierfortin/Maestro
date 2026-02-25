// @ts-nocheck
/**
 * AgentActivity — Mini-panel showing agent state + pixel art mascotte.
 *
 * Shows when the agent is on the same screen as the user.
 * Displays:
 * - Pixel art mascotte (Flipper Zero-style, state-specific animations)
 * - Agent state indicator (idle/working/navigating/waiting)
 * - Current task summary
 * - Animation (breathing dot when idle, spinner when working)
 *
 * This is the "mini-panel overlay" from the Agent-in-the-Cockpit pattern.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { useAnimationTick } from '@maestro/tui/hooks';
import { spinnerFrame, breathingDot, activityFrame, inkTheme as theme } from '@maestro/tui/theme';
import { renderBitmap } from '@maestro/tui/utils';
import { getMascotteFrame } from '@maestro/tui/sprites';
import type { AgentState } from '../types.ts';

interface AgentActivityProps {
  agentState: AgentState;
  taskSummary?: string;
  sessionId?: string | null;
  compact?: boolean;
}

const STATE_CONFIG: Record<AgentState, { icon: string; color: string; label: string }> = {
  idle: { icon: '●', color: theme.agent.idle, label: 'Agent idle' },
  working: { icon: '◉', color: theme.agent.working, label: 'Agent working' },
  navigating: { icon: '→', color: theme.agent.navigating, label: 'Agent navigating' },
  'waiting-input': { icon: '?', color: theme.agent.waiting, label: 'Agent waiting for input' },
};

const AgentActivity = ({ agentState, taskSummary, sessionId, compact }: AgentActivityProps) => {
  // Slow tick for mascotte animation (swap frame every ~600ms)
  const tick = useAnimationTick(150);
  const mascotteTick = Math.floor(tick / 4);

  const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle;

  // Animated indicator
  let indicator: string;
  if (agentState === 'working') {
    indicator = `${spinnerFrame(tick)} ${activityFrame(tick)}`;
  } else if (agentState === 'idle') {
    indicator = breathingDot(tick);
  } else {
    indicator = config.icon;
  }

  // Compact mode: single line, no mascotte, no border
  if (compact) {
    return h(Box, {
      paddingX: 1,
      width: '100%',
      flexDirection: 'row',
      height: 1,
    },
      h(Text, { color: config.color }, indicator),
      h(Text, null, ' '),
      h(Text, { color: config.color, bold: agentState === 'working' }, config.label),
      taskSummary
        ? h(Text, { color: 'gray' }, ` — ${taskSummary.length > 40 ? taskSummary.slice(0, 40) + '...' : taskSummary}`)
        : null,
    );
  }

  // Full mode: mascotte + state info
  const mascotteState = agentState === 'waiting-input' ? 'waiting-input' : agentState;
  const bitmap = getMascotteFrame(mascotteState as any, mascotteTick);
  const mascotteLines = renderBitmap(bitmap);

  return h(Box, {
    borderStyle: 'single',
    borderColor: config.color,
    paddingX: 1,
    width: '100%',
    flexDirection: 'row',
    height: 13, // 11 sprite lines + 2 border
  },
    // Pixel art mascotte
    h(Box, { flexDirection: 'column', marginRight: 1 },
      ...mascotteLines.map((line, i) =>
        h(Text, { key: `m-${i}`, color: config.color }, line)
      ),
    ),

    // State info
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: config.color }, indicator),
        h(Text, null, ' '),
        h(Text, { color: config.color, bold: agentState === 'working' }, config.label),
      ),
      taskSummary
        ? h(Text, { color: 'gray' }, taskSummary.length > 50 ? taskSummary.slice(0, 50) + '...' : taskSummary)
        : null,
      sessionId
        ? h(Text, { color: 'gray', dimColor: true }, `session: ${sessionId.slice(0, 8)}`)
        : null,
    ),
  );
};

export { AgentActivity };
