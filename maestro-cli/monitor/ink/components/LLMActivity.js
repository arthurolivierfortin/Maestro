/**
 * LLMActivity — Chat-like LLM interaction view.
 *
 * Ink equivalent of the blessed LLMActivityComponent.
 *
 * - Separator line with nodeId + timestamp
 * - Prompt preview (yellow arrow, 3 lines max)
 * - Response preview (green arrow, 3 lines max)
 * - Metadata line (char count, duration)
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { icons, dim } from '../theme.js';

// ── Text wrapping helper ───────────────────────────────────────

const wrapText = (text, width) => {
  if (!text) return [''];
  const clean = String(text).replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
  const lines = [];
  let remaining = clean;
  while (remaining.length > 0) {
    if (remaining.length <= width) {
      lines.push(remaining);
      break;
    }
    let breakAt = remaining.lastIndexOf(' ', width);
    if (breakAt <= 0) breakAt = width;
    lines.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt).trimStart();
  }
  return lines;
};

// ── Single LLM activity entry ──────────────────────────────────

const ActivityEntry = ({ entry }) => {
  const nodeId = entry.nodeId || 'unknown';
  const time = entry.time || '--:--:--';
  const duration = entry.duration != null ? `${entry.duration}s` : '?s';
  const respLen = entry.responseLength || 0;
  const lenStr = respLen > 1024 ? `${(respLen / 1024).toFixed(1)}K` : `${respLen}`;

  // Separator: --- nodeId (time) --------
  const sepLabel = `${nodeId} (${time})`;
  const padLen = Math.max(0, 36 - sepLabel.length - 4);
  const pad = '\u2500'.repeat(padLen);
  const separator = `\u2500\u2500\u2500 ${sepLabel} ${pad}`;

  // Prompt lines (max 3)
  const promptLines = wrapText(entry.promptPreview || '(no prompt)', 38);
  const promptDisplay = promptLines.slice(0, 3);

  // Response lines (max 3)
  const respLines = wrapText(entry.responsePreview || '(no response)', 38);
  const respDisplay = respLines.slice(0, 3);

  const children = [];

  // Separator line
  children.push(
    h(Box, { key: 'sep' },
      h(Text, { color: 'gray' }, separator),
    )
  );

  // Prompt preview: yellow arrow + first line
  children.push(
    h(Box, { key: 'prompt-0', flexDirection: 'row' },
      h(Text, { color: 'yellow' }, icons.arrow),
      h(Text, null, ` ${promptDisplay[0] || ''}`),
    )
  );
  // Continuation prompt lines
  for (let i = 1; i < promptDisplay.length; i++) {
    children.push(
      h(Box, { key: `prompt-${i}` },
        h(Text, null, `  ${promptDisplay[i]}`),
      )
    );
  }
  // Ellipsis if truncated
  if (promptLines.length > 3) {
    children.push(
      h(Box, { key: 'prompt-ellipsis' },
        h(Text, null, '  '),
        dim('...'),
      )
    );
  }

  // Response preview: green left-arrow + first line
  children.push(
    h(Box, { key: 'resp-0', flexDirection: 'row' },
      h(Text, { color: 'green' }, '\u2190'),
      h(Text, null, ` ${respDisplay[0] || ''}`),
    )
  );
  // Continuation response lines
  for (let i = 1; i < respDisplay.length; i++) {
    children.push(
      h(Box, { key: `resp-${i}` },
        h(Text, null, `  ${respDisplay[i]}`),
      )
    );
  }
  // Ellipsis if truncated
  if (respLines.length > 3) {
    children.push(
      h(Box, { key: 'resp-ellipsis' },
        h(Text, null, '  '),
        dim('...'),
      )
    );
  }

  // Metadata line: charCount . duration
  children.push(
    h(Box, { key: 'meta' },
      h(Text, null, '  '),
      dim(`${lenStr} chars ${icons.dot} ${duration}`),
    )
  );

  // Trailing blank line between entries
  children.push(h(Box, { key: 'blank', height: 1 }));

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Main component ─────────────────────────────────────────────

const LLMActivity = ({ session, context = {} }) => {
  const activities = context.llmActivity || [];

  const children = [];

  if (!Array.isArray(activities) || activities.length === 0) {
    children.push(
      h(Box, { key: 'empty', flexDirection: 'column' },
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          dim('(no LLM calls yet)'),
        ),
        h(Box, { flexDirection: 'row' },
          h(Text, null, '  '),
          dim('Waiting for inference nodes...'),
        ),
      )
    );
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  for (let i = 0; i < activities.length; i++) {
    children.push(h(ActivityEntry, { key: `act-${i}`, entry: activities[i] }));
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { LLMActivity };
