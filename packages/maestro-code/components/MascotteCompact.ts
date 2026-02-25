// @ts-nocheck
/**
 * MascotteCompact — Single-line mascotte header for working Agent page.
 *
 * Displays: mini face + core symbol + spinner + status text.
 * Example: ◉ ┃┃ ◉ [◆]  ⠹ Agent working — Implementing auth...
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { useAnimationTick } from '@maestro/tui/hooks';
import { spinnerFrame } from '@maestro/tui/theme';

export type CompactState = 'idle' | 'working' | 'celebrating';

export interface MascotteCompactProps {
  state: CompactState;
  statusText?: string;
  sessionId?: string | null;
  fitness?: number;
}

const STATE_CONFIG: Record<CompactState, { core: string; color: string; label: string }> = {
  idle:        { core: '◆', color: 'cyan',    label: 'Agent idle' },
  working:     { core: '◆', color: 'green',   label: 'Agent working' },
  celebrating: { core: '★', color: 'magenta', label: 'Task completed' },
};

const MascotteCompact = ({ state, statusText, sessionId, fitness }: MascotteCompactProps) => {
  const tick = useAnimationTick(150);
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;

  const spinner = state === 'working' ? spinnerFrame(tick) + ' ' : '';

  return h(Box, {
    flexDirection: 'row',
    paddingX: 1,
    height: 2,
    borderStyle: 'single',
    borderColor: config.color,
  },
    // Mini face
    h(Text, { color: 'white' }, '◉ ┃┃ ◉'),
    h(Text, null, ' '),
    h(Text, { color: config.color, bold: true }, `[${config.core}]`),
    h(Text, null, '  '),
    // Spinner + status
    state === 'working'
      ? h(Text, { color: config.color }, spinner)
      : null,
    h(Text, { color: config.color, bold: state === 'working' }, config.label),
    statusText
      ? h(Text, { color: 'gray' }, ` — ${statusText.length > 50 ? statusText.slice(0, 50) + '...' : statusText}`)
      : null,
    // Session + fitness
    sessionId
      ? h(Text, { color: 'gray', dimColor: true }, `  session:${sessionId.slice(0, 8)}`)
      : null,
    fitness != null
      ? h(Text, { color: 'gray', dimColor: true }, `  ${Math.round(fitness * 100)}%`)
      : null,
  );
};

export { MascotteCompact };
