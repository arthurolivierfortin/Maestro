/**
 * AssistantSelector — Contract-based assistant selection.
 *
 * Shows all blocks implementing the "maestro-assistant" contract with their
 * active/inactive features based on capabilities. User picks which assistant
 * to use. Shown after provider setup in the first-run flow.
 */

import { createElement as h, useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { getBlocksForContract, type BlockForContract } from '../services/contract-resolver.ts';
import type { IMaestroCodeApiClient } from '../types.ts';

interface AssistantSelectorProps {
  apiClient: IMaestroCodeApiClient;
  onSelect: (blockId: string) => void;
  onSkip?: () => void;
}

const AssistantSelector = ({ apiClient, onSelect, onSkip }: AssistantSelectorProps) => {
  const [blocks, setBlocks] = useState<BlockForContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fetched = useRef(false);

  // Fetch blocks on mount
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    getBlocksForContract(apiClient, 'maestro-assistant')
      .then(result => {
        // Sort: most features first (recommended at top)
        result.sort((a, b) => b.activeFeatures.length - a.activeFeatures.length);
        setBlocks(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load assistants');
        setLoading(false);
      });
  }, [apiClient]);

  useInput((input, key) => {
    if (loading) return;

    if (blocks.length === 0) {
      // No blocks — skip or go back
      if (key.return || input === 's' || input === 'S') {
        onSkip?.();
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(blocks.length - 1, i + 1));
    } else if (key.return) {
      onSelect(blocks[selectedIndex].id);
    } else if (input === 's' || input === 'S') {
      // Skip — use default (first / recommended)
      onSelect(blocks[0].id);
    }
  });

  if (loading) {
    return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
      h(Text, { color: 'cyan' }, '  Loading available assistants...'),
    );
  }

  if (error) {
    return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
      h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'yellow', padding: 1, width: 64 },
        h(Text, { color: 'yellow', bold: true }, '  Assistant Selection'),
        h(Box, { height: 1 }),
        h(Text, { color: 'red' }, `  Error: ${error}`),
        h(Box, { height: 1 }),
        h(Text, { color: 'gray' }, '  Using default assistant. Press Enter to continue.'),
      ),
    );
  }

  if (blocks.length === 0) {
    return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
      h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'yellow', padding: 1, width: 64 },
        h(Text, { color: 'yellow', bold: true }, '  No Assistants Found'),
        h(Box, { height: 1 }),
        h(Text, null, '  No blocks implement the maestro-assistant contract.'),
        h(Text, { color: 'gray' }, '  Press Enter or S to skip.'),
      ),
    );
  }

  const totalFeatures = blocks.reduce((max, b) =>
    Math.max(max, b.activeFeatures.length + b.inactiveFeatures.length), 0);

  return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', padding: 1, width: 68 },
      h(Text, { color: 'cyan', bold: true }, '  Choose Your Assistant'),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, '  Select which assistant to use. They differ in capabilities.'),
      h(Text, { color: 'gray', dimColor: true }, '  Use j/k to navigate, Enter to select.'),
      h(Box, { height: 1 }),

      // Block list
      ...blocks.map((block, i) => {
        const sel = i === selectedIndex;
        const arrow = sel ? '>' : ' ';
        const isRecommended = i === 0;
        const activeCount = block.activeFeatures.length;

        return h(Box, { key: block.id, flexDirection: 'column', paddingLeft: 2, marginBottom: 1 },
          // Header line
          h(Box, { flexDirection: 'row' },
            h(Text, { color: sel ? 'cyan' : 'gray' }, `  ${arrow} `),
            h(Text, { color: sel ? 'cyan' : 'white', bold: sel }, block.name),
            isRecommended
              ? h(Text, { color: 'green', bold: true }, ' [Recommended]')
              : null,
          ),
          // Features count
          h(Text, { color: 'gray', dimColor: true }, `      Features: ${activeCount}/${totalFeatures} active`),
          // Feature details (only for selected block)
          sel ? h(Box, { flexDirection: 'column', paddingLeft: 6 },
            ...block.activeFeatures.map(f =>
              h(Text, { key: f, color: 'green' }, `  + ${f}`)
            ),
            ...block.inactiveFeatures.map(f =>
              h(Text, { key: f, color: 'red', dimColor: true }, `  - ${f}`)
            ),
          ) : null,
        );
      }),

      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, '  You can change this later with /agent <name>'),
    ),
  );
};

export { AssistantSelector };
export type { AssistantSelectorProps };
