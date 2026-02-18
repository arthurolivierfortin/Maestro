/**
 * KV — Label + Value pair micro-component.
 *
 * Renders a key-value line:  "Total     1,247"
 * Label is muted, value is primary (accent) or secondary.
 *
 * Used by: MetricsPanel, QueueTab, any dashboard stat display.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';

export interface KVProps {
  /** Label text: "Total", "P50", "Prompt" */
  label: string;
  /** Value text: "1,247", "820ms", "32.1K" */
  value: string;
  /** Character width for label padding. Default 10. */
  labelWidth?: number;
  /** When true, value uses primary (bright) color. Default false. */
  accent?: boolean;
  /** Override value color directly. Takes precedence over accent. */
  valueColor?: string;
}

const KV = ({ label, value, labelWidth = 10, accent = false, valueColor }: KVProps) => {
  const color = valueColor ?? (accent ? semantic.text.primary : semantic.text.secondary);
  return h(Box, { flexDirection: 'row' },
    h(Text, { color: semantic.text.muted }, label.padEnd(labelWidth)),
    h(Text, { color }, value),
  );
};

export { KV };
