/**
 * StatusIndicator — Icon + text with semantic color.
 *
 * Renders: ● connected   ✗ error   ◆ active
 * Single-color icon + text pair for status display.
 *
 * Used by: Headers, StatusBars, any connection/status display.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';

export interface StatusIndicatorProps {
  /** Icon character: "●", "✗", "◆" */
  icon: string;
  /** Status text: "connected", "running", "idle" */
  text: string;
  /** Color applied to both icon and text */
  color: string;
  /** Optional gap between icon and text. Default 1. */
  gap?: number;
}

const StatusIndicator = ({ icon, text, color, gap = 1 }: StatusIndicatorProps) => {
  return h(Box, { flexDirection: 'row' },
    h(Text, { color }, icon),
    h(Text, null, ' '.repeat(gap)),
    h(Text, { color }, text),
  );
};

export { StatusIndicator };
