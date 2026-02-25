// @ts-nocheck
/**
 * ExecutionLog — Tail -f style log viewer.
 *
 * Ink equivalent of the blessed ExecutionLogComponent.
 *
 * Shows most recent entries at bottom.
 * Each entry: time + colored level tag + message.
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { dim } from '../theme/index.ts';

// ── Constants ──────────────────────────────────────────────────

const MAX_ENTRIES = 50;

// ── Level color mapping ────────────────────────────────────────

const levelColor = (level) => {
  const map = {
    info: 'white',
    success: 'green',
    warning: 'yellow',
    warn: 'yellow',
    error: 'red',
    debug: 'gray',
  };
  return map[(level || '').toLowerCase()] || 'white';
};

// ── Single log entry ───────────────────────────────────────────

const LogEntry = ({ entry }) => {
  const time = entry.time || '';
  const level = (entry.level || 'info').toLowerCase();
  const msg = entry.msg || entry.message || '';
  const col = levelColor(level);

  return h(Box, { flexDirection: 'row' },
    h(Text, null, '  '),
    dim(time),
    h(Text, null, ' '),
    h(Text, { color: col }, `[${level}]`),
    h(Text, null, `  ${msg}`),
  );
};

// ── Main component ─────────────────────────────────────────────

const ExecutionLog = ({ session, context = {} }) => {
  const log = context.executionLog || session?.variables?._executionLog || [];

  const children = [];

  if (!Array.isArray(log) || log.length === 0) {
    children.push(
      h(Box, { key: 'empty', flexDirection: 'row' },
        h(Text, null, '  '),
        dim('(no log entries yet)'),
      )
    );
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  // Show most recent entries (tail)
  const entries = log.slice(-MAX_ENTRIES);

  for (let i = 0; i < entries.length; i++) {
    children.push(h(LogEntry, { key: `log-${i}`, entry: entries[i] }));
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { ExecutionLog };
