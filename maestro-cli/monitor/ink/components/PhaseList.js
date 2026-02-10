/**
 * PhaseList — Simple phase list (legacy mode).
 *
 * Ink equivalent of the blessed PhaseListComponent.
 *
 * Phase icon + name + status badge.
 * Running phase shows progress bar and description.
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  icons, label, dim,
  statusColor, statusIcon,
  progressBar,
} from '../theme.js';

// ── Skipped icon (not in the shared icon set) ──────────────────

const SKIPPED_ICON = '\u2212'; // minus sign

// ── Phase icon resolver ────────────────────────────────────────

const phaseIcon = (status) => {
  if (status === 'skipped') return SKIPPED_ICON;
  return statusIcon(status);
};

const phaseColor = (status) => {
  if (status === 'skipped') return 'gray';
  return statusColor(status);
};

// ── Single phase row ───────────────────────────────────────────

const PhaseRow = ({ phase }) => {
  const status = (phase.status || 'pending').toLowerCase();
  const icon = phaseIcon(status);
  const color = phaseColor(status);
  const name = phase.name || phase.id || 'Phase';

  const children = [];

  // Main line: icon + name [+ badge]
  const lineParts = [
    h(Text, { key: 'pad' }, '  '),
    h(Text, { key: 'icon', color }, icon),
    h(Text, { key: 'sp' }, ` ${name}`),
  ];

  if (status !== 'pending') {
    lineParts.push(
      h(Text, { key: 'bsp' }, '  '),
      h(Text, { key: 'lb', color: 'gray' }, '['),
      h(Text, { key: 'st', color }, status),
      h(Text, { key: 'rb', color: 'gray' }, ']'),
    );
  }

  children.push(h(Box, { key: 'line', flexDirection: 'row' }, ...lineParts));

  // Progress bar for running phase
  if (status === 'running' && phase.progress !== undefined) {
    const bar = progressBar(phase.progress, 20);
    children.push(
      h(Box, { key: 'progress', flexDirection: 'row' },
        h(Text, null, '    '),
        h(Text, { color: 'cyan' }, bar),
        h(Text, null, ` ${phase.progress}%`),
      )
    );
  }

  // Description for running phase
  if (status === 'running' && phase.description) {
    children.push(
      h(Box, { key: 'desc', flexDirection: 'row' },
        h(Text, null, '    '),
        dim(phase.description),
      )
    );
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

// ── Main component ─────────────────────────────────────────────

const PhaseList = ({ session, context = {} }) => {
  const phases = context.phases || session?.variables?._phases || [];

  const children = [
    h(Box, { key: 'header' }, label('PHASES')),
    h(Box, { key: 'spacer', height: 1 }),
  ];

  if (!Array.isArray(phases) || phases.length === 0) {
    children.push(
      h(Box, { key: 'empty', flexDirection: 'row' },
        h(Text, null, '  '),
        dim('(no phases defined)'),
      )
    );
    return h(Box, { flexDirection: 'column' }, ...children);
  }

  for (let i = 0; i < phases.length; i++) {
    children.push(h(PhaseRow, { key: phases[i].id || `phase-${i}`, phase: phases[i] }));
  }

  return h(Box, { flexDirection: 'column' }, ...children);
};

export { PhaseList };
