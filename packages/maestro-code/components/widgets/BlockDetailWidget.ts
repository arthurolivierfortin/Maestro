/**
 * BlockDetailWidget -- Block info summary with TOOLS REQUIS panel.
 *
 * Compact inline version of BlockDetail.
 * Non-interactive (read-only).
 *
 * Phase 63-D: Added TOOLS REQUIS panel that lists blocks/tools referenced
 * in config.nodes (extracted recursively).
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme,
  T, muted, primary,
  TypeBadge,
  progressBar, progressColor,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';

/**
 * Recursively extract unique blockRef values from config.nodes.
 * Handles nested nodes in while loops and conditional branches.
 */
function extractBlockRefs(nodes: any[]): string[] {
  const refs = new Set<string>();
  if (!Array.isArray(nodes)) return [];

  for (const node of nodes) {
    if (node.blockRef) {
      refs.add(node.blockRef);
    }
    // Recurse into nested nodes (while loops)
    if (Array.isArray(node.nodes)) {
      for (const ref of extractBlockRefs(node.nodes)) refs.add(ref);
    }
    // Recurse into conditional branches
    if (node.branches && typeof node.branches === 'object') {
      for (const branchKey of Object.keys(node.branches)) {
        const branch = node.branches[branchKey];
        if (branch && Array.isArray(branch.nodes)) {
          for (const ref of extractBlockRefs(branch.nodes)) refs.add(ref);
        }
      }
    }
  }

  return [...refs].sort();
}

interface BlockDetailWidgetProps {
  apiClient: any;
  focused: boolean;
  blockId: string;
}

const BlockDetailWidget = ({ apiClient, focused, blockId }: BlockDetailWidgetProps) => {
  const { data: block } = useApiData(
    useCallback((): Promise<any> => apiClient.getBlock(blockId).catch((): null => null), [apiClient, blockId]),
    focused ? 10000 : 0
  );

  if (!block) {
    return h(Box, { paddingLeft: 1 }, muted('Loading block...'));
  }

  const type = (block.blockType || block.type || 'unknown').toLowerCase();
  const name = (block.name || block.id || 'Unknown').padEnd(30);
  const version = (block.version || '-').padEnd(8);
  const isAtomic = (block.isAtomic !== false ? 'Yes' : 'No').padEnd(4);
  const fitness = block.fitness;
  const hasFitness = fitness !== undefined && fitness !== null && fitness >= 0;
  const fitnessStr = hasFitness ? `${Math.round(fitness * 100)}%`.padEnd(5) : '-';
  const capabilities = block.capabilities || [];
  const description = block.description || '';
  const contractId = block.contractId || block.contract || '';
  const toolRefs = extractBlockRefs(block.config?.nodes || []);
  // Filter out infrastructure blocks to show only "tools"
  const infraBlocks = ['conversation-read', 'conversation-append', 'inference', 'response-parser', 'set-variable'];
  const tools = toolRefs.filter(r => !infraBlocks.includes(r));

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    // Name + type
    h(Box, { flexDirection: 'row', gap: 2 },
      h(TypeBadge, { type }),
      primary(name),
      muted(`v${version}`),
      muted(`atomic: ${isAtomic}`),
    ),
    // Description
    description
      ? h(Text, { color: 'gray', dimColor: true, wrap: 'wrap' }, description)
      : null,
    h(Text, null, ''),
    // Fitness
    hasFitness
      ? h(Box, { flexDirection: 'row' },
          muted('Fitness: '),
          T(progressColor(fitness * 100), progressBar(fitness * 100, 12)),
          h(Text, null, ' '),
          T(progressColor(fitness * 100), fitnessStr),
        )
      : h(Box, { flexDirection: 'row' }, muted('Fitness: -')),
    // Capabilities
    capabilities.length > 0
      ? h(Box, { flexDirection: 'row' },
          muted('Capabilities: '),
          h(Text, { color: 'cyan' }, capabilities.map((c: string) => `[${c}]`).join(' ')),
        )
      : null,
    // Contract
    contractId
      ? h(Box, { flexDirection: 'row' },
          muted('Contract: '),
          primary(String(contractId).padEnd(20)),
        )
      : null,
    // Tools requis
    tools.length > 0
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          h(Text, { color: 'cyan', bold: true }, 'TOOLS REQUIS'),
          h(Text, null, ''),
          h(Text, { color: 'gray', dimColor: true }, 'Ce block utilise :'),
          ...tools.map((t: string) =>
            h(Box, { key: `t-${t}`, flexDirection: 'row', paddingLeft: 1 },
              h(Text, { color: 'white' }, `o ${t}`),
            ),
          ),
          h(Text, null, ''),
          h(Text, { color: 'gray', dimColor: true },
            'La session doit autoriser ces tools pour',
          ),
          h(Text, { color: 'gray', dimColor: true },
            'que ce block fonctionne correctement.',
          ),
        )
      : null,
  );
};

export { BlockDetailWidget };
