/**
 * ProgressBar — Visual progress bar with optional label and percentage.
 *
 * Renders: "Fitness  ████████░░░░ 75%"
 * Auto-colors based on progress (green >= 80%, yellow >= 50%, red < 50%).
 *
 * Uses progressBar() and progressColor() from shared/utils/progress.
 *
 * Used by: Headers (fitness), MetricsPanel, WidgetsPanel, BlockDetail.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';
import { progressBar, progressColor } from '../../utils/progress.ts';

export interface ProgressBarProps {
  /** Progress value from 0 to 1 (e.g., 0.75 = 75%) */
  value: number;
  /** Character width of the bar. Default 16. */
  width?: number;
  /** Optional target value (0-1). Displays a marker if provided. */
  target?: number;
  /** Optional label displayed before the bar: "Fitness", "Loading" */
  label?: string;
  /** Character width for label padding. Default 10. */
  labelWidth?: number;
  /** Show percentage after the bar. Default true. */
  showPercent?: boolean;
  /** Override bar color. If not set, auto-colors by percentage. */
  color?: string;
}

const ProgressBar = ({
  value,
  width = 16,
  target,
  label,
  labelWidth = 10,
  showPercent = true,
  color,
}: ProgressBarProps) => {
  const percent = Math.min(100, Math.max(0, value * 100));
  const barStr = progressBar(percent, width);
  const barColor = color ?? progressColor(percent);
  const percentStr = showPercent ? ` ${Math.round(percent)}%` : '';

  const elements: any[] = [];

  if (label) {
    elements.push(
      h(Text, { key: 'label', color: semantic.text.muted }, label.padEnd(labelWidth))
    );
  }

  elements.push(
    h(Text, { key: 'bar', color: barColor }, barStr)
  );

  if (target !== undefined) {
    const targetPercent = Math.min(100, Math.max(0, target * 100));
    elements.push(
      h(Text, { key: 'target', color: semantic.text.muted }, ` (target: ${Math.round(targetPercent)}%)`)
    );
  }

  if (showPercent) {
    elements.push(
      h(Text, { key: 'pct', color: barColor }, percentStr)
    );
  }

  return h(Box, { flexDirection: 'row' }, ...elements);
};

export { ProgressBar };
