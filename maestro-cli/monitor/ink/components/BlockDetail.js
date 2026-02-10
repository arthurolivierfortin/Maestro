/**
 * BlockDetail — Block output browser.
 *
 * Ink equivalent of the blessed BlockDetailComponent.
 *
 * Active block: live detail (status, metadata, output lines).
 * Historical: per-block entries with typed output (inference, validator, shell, write).
 * Includes miniBar helper for criteria scores.
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  icons, label, dim, muted, bold,
  statusColor, statusIcon,
  formatTime, truncate,
} from '../theme.js';

// ── Type color mapping ─────────────────────────────────────────

const typeColor = (type) => {
  const map = {
    inference: 'cyan',
    validator: 'yellow',
    shell: 'magenta',
    script: 'magenta',
    write: 'green',
    task: 'white',
  };
  return map[type] || 'gray';
};

// ── Mini bar for criteria scores ───────────────────────────────

const MiniBar = ({ value, width = 8 }) => {
  const filled = Math.round(value * width);
  const empty = width - filled;
  return h(Text, null,
    h(Text, { color: 'green' }, '\u2588'.repeat(filled)),
    h(Text, { color: 'gray' }, '\u2591'.repeat(empty)),
  );
};

// ── Node ID to display name ────────────────────────────────────

const nodeIdToDisplayName = (nodeId) =>
  nodeId.split('-').map(w =>
    w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w
  ).join(' ');

// ── Output lines with pipe prefix ──────────────────────────────

const OutputLines = ({ text, maxLines = 8, maxWidth = 100 }) => {
  if (!text) return null;
  const allLines = String(text).split('\n');
  const visibleLines = allLines.slice(0, maxLines);

  const children = visibleLines.map((line, i) => {
    const truncated = line.length > maxWidth ? line.substring(0, maxWidth - 3) + '...' : line;
    return h(Box, { key: `ol-${i}`, flexDirection: 'row' },
      h(Text, null, '  '),
      dim('\u2502'),
      h(Text, null, ` ${truncated}`),
    );
  });

  if (allLines.length > maxLines) {
    children.push(
      h(Box, { key: 'more', flexDirection: 'row' },
        h(Text, null, '  '),
        dim('\u2502'),
        h(Text, null, ' '),
        dim(`... ${allLines.length - maxLines} more lines`),
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Active block (live detail) ─────────────────────────────────

const ActiveBlockView = ({ block }) => {
  const status = (block.status || 'running').toLowerCase();
  const icon = statusIcon(status);
  const col = statusColor(status);
  const blockType = block.type || '';

  const children = [];

  // Header: icon + name + [type]
  const headerParts = [
    h(Text, { key: 'pad' }, '  '),
    h(Text, { key: 'icon', color: col }, icon),
    h(Text, { key: 'sp' }, ' '),
    bold(block.name || block.id),
  ];
  if (blockType) {
    headerParts.push(
      h(Text, { key: 'tsp' }, '  '),
      h(Text, { key: 'type', color: 'gray' }, `[${blockType}]`),
    );
  }
  children.push(h(Box, { key: 'header', flexDirection: 'row' }, ...headerParts));

  // Metadata line
  const metaParts = [];
  if (block.startedAt) {
    metaParts.push(`Started: ${formatTime(block.startedAt)}`);
  }
  if (block.metadata?.tokensUsed) {
    metaParts.push(`Tokens: ${block.metadata.tokensUsed}`);
  }
  if (metaParts.length > 0) {
    children.push(
      h(Box, { key: 'meta', flexDirection: 'row' },
        h(Text, null, '  '),
        dim(metaParts.join('  |  ')),
      )
    );
  }

  // Blank spacer
  children.push(h(Box, { key: 'spacer', height: 1 }));

  // Output section
  if (block.output) {
    children.push(
      h(Box, { key: 'out-label', flexDirection: 'row' },
        h(Text, null, '  '),
        muted('Output:'),
      )
    );
    children.push(
      h(OutputLines, { key: 'out-lines', text: block.output, maxLines: 15, maxWidth: 100 })
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Typed output renderers ─────────────────────────────────────

const InferenceOutput = ({ data }) => {
  const output = data.output || data.response || '';
  if (!output) return null;
  return h(OutputLines, { text: output, maxLines: 10, maxWidth: 100 });
};

const ValidatorOutput = ({ data }) => {
  const criteriaScores = data.criteriaScores || {};
  const totalScore = data.totalScore ?? 0;
  const passed = data.passed;

  const children = [];

  // Per-criteria scores
  for (const [criterion, score] of Object.entries(criteriaScores)) {
    const numScore = Number(score);
    const cIcon = numScore >= 0.5 ? icons.done : icons.failed;
    const cColor = numScore >= 0.5 ? 'green' : 'red';

    children.push(
      h(Box, { key: `c-${criterion}`, flexDirection: 'row' },
        h(Text, null, '  '),
        dim('\u2502'),
        h(Text, null, ' '),
        h(Text, { color: cColor }, cIcon),
        h(Text, null, ` ${criterion}: `),
        h(MiniBar, { value: numScore }),
        h(Text, null, ` ${numScore.toFixed(2)}`),
      )
    );
  }

  // Total line
  const totalColor = passed ? 'green' : 'red';
  const passLabel = passed ? 'PASSED' : 'FAILED';
  children.push(
    h(Box, { key: 'total', flexDirection: 'row' },
      h(Text, null, '  '),
      dim('\u2502'),
      h(Text, null, ' '),
      h(Text, { color: totalColor }, `Total: ${totalScore.toFixed(2)} [${passLabel}]`),
    )
  );

  return h(Box, { flexDirection: 'column' }, ...children);
};

const ShellOutput = ({ data }) => {
  const output = data.output || data.commands || '';
  if (!output) return null;
  return h(OutputLines, { text: output, maxLines: 8, maxWidth: 100 });
};

const WriteOutput = ({ data }) => {
  const output = data.output || '';
  if (!output) return null;
  return h(OutputLines, { text: output, maxLines: 3, maxWidth: 200 });
};

const GenericOutput = ({ data }) => {
  const output = data.output || '';
  if (!output) return null;
  return h(OutputLines, { text: output, maxLines: 8, maxWidth: 100 });
};

// ── Block entry (historical) ───────────────────────────────────

const BlockEntry = ({ nodeId, data }) => {
  const type = data?.type || 'unknown';
  const tColor = typeColor(type);
  const displayName = nodeIdToDisplayName(nodeId);
  const timestamp = data?.timestamp || '';

  const children = [];

  // Header: arrow + name + [type] + timestamp
  const headerParts = [
    h(Text, { key: 'pad' }, '  '),
    h(Text, { key: 'arrow', color: tColor }, icons.arrow),
    h(Text, { key: 'sp' }, ' '),
    bold(displayName),
    h(Text, { key: 'tsp' }, '  '),
    h(Text, { key: 'type', color: 'gray' }, `[${type}]`),
  ];
  if (timestamp) {
    headerParts.push(
      h(Text, { key: 'ts-sp' }, '  '),
      dim(timestamp),
    );
  }
  children.push(h(Box, { key: 'header', flexDirection: 'row' }, ...headerParts));

  // Typed output
  switch (type) {
    case 'inference':
      children.push(h(InferenceOutput, { key: 'out', data }));
      break;
    case 'validator':
      children.push(h(ValidatorOutput, { key: 'out', data }));
      break;
    case 'shell':
    case 'script':
      children.push(h(ShellOutput, { key: 'out', data }));
      break;
    case 'write':
      children.push(h(WriteOutput, { key: 'out', data }));
      break;
    default:
      children.push(h(GenericOutput, { key: 'out', data }));
      break;
  }

  // Trailing blank line
  children.push(h(Box, { key: 'blank', height: 1 }));

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Main component ─────────────────────────────────────────────

const BlockDetail = ({ session, context = {} }) => {
  const activeBlock = context.activeBlock || session?.variables?._activeBlock;
  const blockOutputs = context.blockOutputs || session?.variables?._blockOutputs;

  const children = [
    h(Box, { key: 'header' }, label('BLOCK OUTPUT BROWSER')),
  ];

  // If a block is currently running, show its live detail
  if (activeBlock && activeBlock.status === 'running') {
    children.push(h(ActiveBlockView, { key: 'active', block: activeBlock }));
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  // Otherwise show historical block outputs
  if (blockOutputs && typeof blockOutputs === 'object') {
    const entries = Object.entries(blockOutputs);
    if (entries.length === 0) {
      children.push(
        h(Box, { key: 'empty', flexDirection: 'row' },
          h(Text, null, '  '),
          dim('(no block outputs yet)'),
        )
      );
    } else {
      for (const [nodeId, data] of entries) {
        children.push(h(BlockEntry, { key: `be-${nodeId}`, nodeId, data }));
      }
    }
  } else if (activeBlock) {
    // Fall back to active block if available (even if done)
    children.push(h(ActiveBlockView, { key: 'active', block: activeBlock }));
  } else {
    children.push(
      h(Box, { key: 'empty', flexDirection: 'row' },
        h(Text, null, '  '),
        dim('(no block outputs yet)'),
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { BlockDetail };
