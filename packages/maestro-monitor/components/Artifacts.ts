// @ts-nocheck
/**
 * Artifacts Component (Ink)
 *
 * Displays files produced by the session.
 * - File list with status icons: new=cyan +, updated=green check, deleted=red X
 * - Shows type tag and size
 *
 * Data source: session.variables._artifacts (array)
 * Each artifact: { name, type, size?, status? }
 * Status: new, updated, deleted
 *
 * Props: { session, context }
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import {
  T, muted, dim, label,
  icons,
} from '../theme.ts';

// ── Status mapping ──────────────────────────────────────────────

const getArtifactIcon = (status) => {
  switch (status) {
    case 'updated': return icons.done;
    case 'new': return '+';
    case 'deleted': return icons.failed;
    default: return icons.dot;
  }
};

const getArtifactColor = (status) => {
  switch (status) {
    case 'updated': return 'green';
    case 'new': return 'cyan';
    case 'deleted': return 'red';
    default: return 'gray';
  }
};

// ── Single artifact row ─────────────────────────────────────────

const ArtifactRow = ({ artifact }) => {
  const status = (artifact.status || 'new').toLowerCase();
  const icon = getArtifactIcon(status);
  const color = getArtifactColor(status);

  return h(Box, { flexDirection: 'row', paddingLeft: 2 },
    T(color, icon),
    h(Text, null, ' '),
    h(Text, null, artifact.name),
    h(Text, null, '  '),
    artifact.type ? T('gray', '[' + artifact.type + ']') : null,
    artifact.type ? h(Text, null, '  ') : null,
    artifact.size ? dim(artifact.size) : null,
    h(Text, null, '  '),
    T(color, status)
  );
};

// ── Main component ──────────────────────────────────────────────

const Artifacts = ({ session, context }) => {
  const artifacts = context?.artifacts || session?.variables?._artifacts || [];

  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      label('ARTIFACTS'),
      h(Box, { height: 1 }),
      dim('  (no artifacts yet)')
    );
  }

  const children = [
    label('ARTIFACTS'),
    h(Box, { key: 'gap-top', height: 1 }),
  ];

  for (let i = 0; i < artifacts.length; i++) {
    children.push(h(ArtifactRow, { key: 'art-' + i, artifact: artifacts[i] }));
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 }, ...children);
};

export { Artifacts };
