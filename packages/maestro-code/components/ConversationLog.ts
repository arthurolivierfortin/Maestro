// @ts-nocheck
/**
 * ConversationLog — Scrollable conversation log for Agent working state.
 *
 * Replaces OutputPanel. Shows user messages (❯), agent phases (◆),
 * step details (indented), and file creation indicators.
 * Auto-scrolls to bottom as new lines arrive.
 */

import { createElement as h, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import type { LogLine } from '../services/SessionManager.ts';

export interface ConversationLogProps {
  lines: LogLine[];
  height: number;
  scrollOffset?: number;
}

const ConversationLog = ({ lines, height, scrollOffset = 0 }: ConversationLogProps) => {
  const maxVisible = Math.max(height - 2, 1);

  // Compute visible window based on scroll offset
  // scrollOffset = 0 → show latest lines (bottom)
  // scrollOffset > 0 → show lines further back in history
  const endIndex = lines.length - scrollOffset;
  const startIndex = Math.max(0, endIndex - maxVisible);
  const visible = endIndex > 0 ? lines.slice(startIndex, endIndex) : [];

  return h(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
    paddingX: 1,
  },
    ...visible.map((line, i) => {
      // Detect line type for formatting
      const text = line.text || '';
      const isUserMessage = text.startsWith('> ');
      const isPhaseHeader = text.startsWith('◆ ') || text.startsWith('✓ ');
      const isStepDetail = text.startsWith('│ ') || text.startsWith('  │');
      const isFileEntry = text.includes('···');

      return h(Box, { key: i, flexDirection: 'row' },
        // Timestamp
        line.timestamp
          ? h(Text, { color: 'gray', dimColor: true }, `${line.timestamp} `)
          : null,
        // User message prefix
        isUserMessage
          ? h(Text, { color: 'green', bold: true }, '❯ ')
          : null,
        // Main text
        h(Text, {
          color: (line.color || 'white') as any,
          bold: line.bold || isPhaseHeader,
          dimColor: line.dim,
        }, isUserMessage ? text.slice(2) : text),
      );
    }),
    visible.length === 0
      ? h(Text, { color: 'gray', dimColor: true }, '  Waiting for input...')
      : null,
  );
};

export { ConversationLog };
