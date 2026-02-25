// @ts-nocheck
/**
 * TransitionWipe — Brief directional wipe overlay shown during
 * spatial page transitions (~150ms).
 *
 * Displays a centered direction arrow + target page label.
 * Example:  ▲ EXECUTION
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import type { PageDefinition, Direction } from '../registry/types.ts';

const DIR_ARROW: Record<Direction, string> = {
  up: '▲',
  down: '▼',
  left: '◄',
  right: '►',
};

export interface TransitionWipeProps {
  direction: Direction;
  targetPage: PageDefinition;
  height: number;
}

export const TransitionWipe = ({ direction, targetPage, height }: TransitionWipeProps) => {
  return h(Box, {
    width: '100%',
    height,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
    h(Text, { color: 'cyan', bold: true, dimColor: true },
      `${DIR_ARROW[direction]} ${targetPage.label.toUpperCase()}`
    ),
  );
};
