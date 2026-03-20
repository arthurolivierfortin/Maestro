/**
 * ConversationLog — Scrollable conversation log for Agent working state.
 *
 * Replaces OutputPanel. Shows user messages, agent phases,
 * step details, file creation indicators, AND inline widgets.
 * Auto-scrolls to bottom as new lines arrive.
 *
 * Phase 63-B: Widget entries render InlineWidget instead of text lines.
 */

import { createElement as h } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { LogLine } from '../services/SessionManager.ts';
import type { ChatWidget, WidgetType } from '../types/widgets.ts';
import { WIDGET_HEIGHTS } from '../types/widgets.ts';
import { InlineWidget } from './InlineWidget.ts';
import type { WidgetNavigateFn } from './InlineWidget.ts';

export interface ConversationLogProps {
  lines: LogLine[];
  height: number;
  width?: number;
  scrollOffset?: number;
  /** Currently focused widget ID (only one widget has focus at a time) */
  focusedWidgetId?: string | null;
  /** Collapsed widget IDs (Esc collapses widget to 1-line summary) */
  collapsedWidgets?: Set<string>;
  /** Called when a widget's Esc is pressed to collapse it */
  onWidgetClose?: (widgetId: string) => void;
  /** Called when a widget navigates to another widget (e.g., session detail from sessions list) */
  onWidgetNavigate?: WidgetNavigateFn;
  /** API client passed through to InlineWidget */
  apiClient?: any;
}

/**
 * Compute how many terminal rows a single LogLine occupies.
 * - Regular text lines = 1 row
 * - Collapsed widgets = 1 row
 * - Expanded widgets = WIDGET_HEIGHTS[type] + 2 (content + border top/bottom)
 *   (session-monitor uses -1 sentinel -> terminal rows - 6)
 */
function lineRowCost(
  line: LogLine,
  collapsedWidgets: Set<string> | undefined,
  termRows: number,
): number {
  if (!line.widgetId || !line.widget) return 1;
  if (collapsedWidgets?.has(line.widgetId)) return 1;
  const configured = WIDGET_HEIGHTS[line.widget.type];
  if (configured === -1) return Math.max(1, termRows - 6);
  if (typeof configured === 'number') return configured + 2; // content + border
  return 1;
}

const ConversationLog = ({
  lines,
  height,
  width,
  scrollOffset = 0,
  focusedWidgetId = null,
  collapsedWidgets,
  onWidgetClose,
  onWidgetNavigate,
  apiClient,
}: ConversationLogProps) => {
  const { stdout } = useStdout();
  const termRows = stdout.rows || 40;
  const availableRows = Math.max(height - 2, 1);

  // Build visible window accounting for actual row costs.
  // Walk backward from the end (minus scrollOffset) filling rows.
  const endIndex = Math.max(0, lines.length - scrollOffset);
  let rowBudget = availableRows;
  let startIndex = endIndex;
  while (startIndex > 0 && rowBudget > 0) {
    const cost = lineRowCost(lines[startIndex - 1], collapsedWidgets, termRows);
    if (rowBudget - cost < 0 && startIndex < endIndex) break; // would exceed budget
    rowBudget -= cost;
    startIndex--;
  }
  const visible = endIndex > startIndex ? lines.slice(startIndex, endIndex) : [];

  // Available width for text padding (account for paddingX: 1 on each side)
  const baseTextWidth = width ? Math.max(1, width - 2) : 0;

  return h(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden' as const,
    paddingX: 1,
    ...(width ? { width } : {}),
  },
    ...visible.map((line, i) => {
      // Widget entry: render InlineWidget instead of text line
      if (line.widgetId && line.widget) {
        const isCollapsed = collapsedWidgets?.has(line.widgetId) || false;
        return h(InlineWidget, {
          key: `widget-${line.widgetId}`,
          id: line.widgetId,
          widget: line.widget,
          focused: focusedWidgetId === line.widgetId,
          collapsed: isCollapsed,
          apiClient,
          onClose: () => onWidgetClose?.(line.widgetId!),
          onNavigate: onWidgetNavigate,
        });
      }

      // Regular text line
      const text = line.text || '';
      const isUserMessage = text.startsWith('> ');
      const isPhaseHeader = text.startsWith('\u25C6 ') || text.startsWith('\u2713 ');
      const isStepDetail = text.startsWith('\u2502 ') || text.startsWith('  \u2502');
      const isFileEntry = text.includes('\u00B7\u00B7\u00B7');

      // Pad text to fill remaining width, accounting for prefix columns
      // so that stale characters are cleared on re-render without overflowing.
      // Timestamp = 8 chars + 1 separator = 9; user prefix ">" = 2
      const displayText = isUserMessage ? text.slice(2) : text;
      let prefixCols = 0;
      if (line.timestamp) prefixCols += 9; // "HH:MM:SS" (8) + space (1)
      if (isUserMessage) prefixCols += 2;  // "> " prefix
      const textWidth = baseTextWidth > 0 ? Math.max(1, baseTextWidth - prefixCols) : 0;
      const paddedText = textWidth > 0 ? displayText.padEnd(textWidth) : displayText;

      return h(Box, {
        key: i,
        flexDirection: 'row',
        ...(width ? { width: width - 2 } : {}),
      },
        // Timestamp
        line.timestamp
          ? h(Text, { color: 'gray', dimColor: true }, line.timestamp.padEnd(8))
          : null,
        // Separator space between timestamp and content
        line.timestamp
          ? h(Text, null, ' ')
          : null,
        // User message prefix
        isUserMessage
          ? h(Text, { color: 'green', bold: true }, '\u276F ')
          : null,
        // Main text
        h(Text, {
          color: (line.color || 'white') as any,
          bold: line.bold || isPhaseHeader,
          dimColor: line.dim,
          wrap: 'wrap',
        }, paddedText),
      );
    }),
    visible.length === 0
      ? h(Text, { color: 'gray', dimColor: true }, '  Waiting for input...')
      : null,
  );
};

export { ConversationLog };
