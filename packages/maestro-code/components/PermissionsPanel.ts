/**
 * PermissionsPanel -- Visual diff of parent/child block permissions.
 *
 * Phase 63-D: Shows which blocks are available (white), filtered (gray),
 * or denied (red) relative to the parent session's ceiling.
 *
 * Symbols:
 *   white  -- block is in effectiveBlocks (available)
 *   gray . -- block is in parentBlocks but NOT in effectiveBlocks (filtered)
 *   red  X -- block is denied by a blockRule
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface BlockPermissionRule {
  pattern: string;
  permission: 'Allowed' | 'Denied' | 'RequiresApproval';
  reason?: string;
}

interface PermissionsPanelProps {
  effectiveBlocks: string[];
  parentBlocks: string[];
  blockRules?: BlockPermissionRule[];
  title?: string;
  parentName?: string;
}

const PermissionsPanel = ({
  effectiveBlocks,
  parentBlocks,
  blockRules,
  title,
  parentName,
}: PermissionsPanelProps) => {
  const isWildcard = effectiveBlocks.includes('*');
  const panelTitle = title || 'PERMISSIONS';

  // Union of parent + effective, sorted
  const allBlocks = [...new Set([...parentBlocks, ...effectiveBlocks])]
    .filter(b => b !== '*')
    .sort();

  const rows: ReturnType<typeof h>[] = [];

  // Header with parent name
  if (parentName) {
    rows.push(
      h(Box, { key: 'parent', flexDirection: 'row' },
        h(Text, { color: 'gray', dimColor: true }, `Parent: ${parentName}`),
      ),
    );
    rows.push(h(Text, { key: 'parent-gap' }, ''));
  }

  // Block list
  for (const block of allBlocks) {
    const denyRule = blockRules?.find(
      r => r.pattern === block && r.permission === 'Denied',
    );

    if (denyRule) {
      rows.push(
        h(Box, { key: `b-${block}`, flexDirection: 'row' },
          h(Text, { color: 'red' }, `X ${block}`),
          denyRule.reason
            ? h(Text, { color: 'gray', dimColor: true }, ` (${denyRule.reason})`)
            : null,
        ),
      );
    } else if (isWildcard || effectiveBlocks.includes(block)) {
      rows.push(
        h(Box, { key: `b-${block}`, flexDirection: 'row' },
          h(Text, { color: 'white' }, `o ${block}`),
        ),
      );
    } else {
      rows.push(
        h(Box, { key: `b-${block}`, flexDirection: 'row' },
          h(Text, { color: 'gray', dimColor: true }, `. ${block}`),
        ),
      );
    }
  }

  // Wildcard indicator
  if (isWildcard) {
    rows.push(h(Text, { key: 'wildcard-gap' }, ''));
    rows.push(
      h(Text, { key: 'wildcard', color: 'gray', dimColor: true }, 'AllowedBlocks: *'),
    );
  }

  // Block rules section
  const denyRules = blockRules?.filter(r => r.permission === 'Denied') || [];
  if (denyRules.length > 0) {
    rows.push(h(Text, { key: 'rules-gap' }, ''));
    rows.push(h(Text, { key: 'rules-header', color: 'white', bold: true }, 'Rules:'));
    for (const rule of denyRules) {
      const label = rule.reason || rule.permission;
      rows.push(
        h(Box, { key: `r-${rule.pattern}`, flexDirection: 'row' },
          h(Text, { color: 'red' }, `X ${rule.pattern}`),
          h(Text, { color: 'gray', dimColor: true }, ` (${label})`),
        ),
      );
    }
  }

  // Empty state
  if (allBlocks.length === 0 && !isWildcard) {
    rows.push(
      h(Text, { key: 'empty', color: 'gray', dimColor: true }, '(no blocks defined)'),
    );
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Text, { color: 'cyan', bold: true }, panelTitle),
    h(Text, null, ''),
    ...rows,
  );
};

export { PermissionsPanel };
export type { PermissionsPanelProps, BlockPermissionRule };
