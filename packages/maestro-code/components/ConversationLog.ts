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
}

const ConversationLog = ({ lines, height }: ConversationLogProps) => {
  const maxVisible = Math.max(height - 2, 1);

  // Auto-scroll: always show the latest lines
  const visible = lines.slice(-maxVisible);

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
