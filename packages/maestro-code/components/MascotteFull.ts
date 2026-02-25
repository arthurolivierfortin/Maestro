// @ts-nocheck
/**
 * MascotteFull — Large centered mascotte for idle Agent page.
 *
 * Renders the 24x22 bitmap sprite at 24x11 terminal chars using
 * Unicode half-blocks. Includes breathing animation (idle),
 * pulse animation (working), and celebration (done/celebrating).
 *
 * Uses sprites from @maestro/tui/sprites/mascotte.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { useAnimationTick } from '@maestro/tui/hooks';
import { renderBitmap } from '@maestro/tui/utils';
import { getMascotteFrame } from '@maestro/tui/sprites';
import type { MascotteState } from '@maestro/tui/sprites/mascotte.ts';

export type MascotteVisualState = 'idle' | 'working' | 'celebrating';

export interface MascotteFullProps {
  state: MascotteVisualState;
  statusText?: string;
}

const STATE_MAP: Record<MascotteVisualState, { mascotteState: MascotteState; color: string; core: string }> = {
  idle:        { mascotteState: 'idle',    color: 'cyan',    core: '◆' },
  working:     { mascotteState: 'working', color: 'green',   core: '◆' },
  celebrating: { mascotteState: 'idle',    color: 'magenta', core: '★' },
};

const MascotteFull = ({ state, statusText }: MascotteFullProps) => {
  const tick = useAnimationTick(state === 'working' ? 300 : 600);
  const mascotteTick = Math.floor(tick / (state === 'working' ? 2 : 4));

  const config = STATE_MAP[state] || STATE_MAP.idle;
  const bitmap = getMascotteFrame(config.mascotteState, mascotteTick);
  const lines = renderBitmap(bitmap);

  const defaultStatus = state === 'idle' ? 'Agent ready — Waiting for task'
    : state === 'working' ? 'Agent working...'
    : 'Task completed!';

  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
    // Mascotte sprite
    h(Box, {
      flexDirection: 'column',
      alignItems: 'center',
      borderStyle: 'double',
      borderColor: config.color,
      paddingX: 2,
    },
      ...lines.map((line, i) =>
        h(Text, { key: `m-${i}`, color: config.color }, line)
      ),
      h(Box, { height: 1 }),
      h(Text, { color: config.color, bold: true }, `${config.core} ${statusText || defaultStatus}`),
    ),
  );
};

export { MascotteFull };
