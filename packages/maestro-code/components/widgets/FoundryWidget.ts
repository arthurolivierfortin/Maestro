/**
 * FoundryWidget — My blocks list.
 *
 * Extracted from FoundryScreen. Compact inline version.
 * Interactive: j/k navigate, Space expand/collapse, Enter opens block detail.
 */

import { createElement as h, useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  TypeBadge,
  truncate,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface FoundryWidgetProps {
  apiClient: any;
  focused: boolean;
  onBlockSelect?: (id: string) => void;
  maxItems?: number;
}

const FoundryWidget = ({ apiClient, focused, onBlockSelect, maxItems = 10 }: FoundryWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: blocks } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listBlocks().catch((): any[] => []), [apiClient]),
    focused ? 10000 : 0
  );

  // Filter to user blocks (not system blocks)
  const blockList: any[] = ((blocks as any[]) || []).filter(
    b => !(b.id || '').startsWith('system:')
  );

  useEffect(() => {
    if (selectedIndex >= blockList.length && blockList.length > 0) {
      setSelectedIndex(Math.max(0, blockList.length - 1));
    }
  }, [blockList.length]);

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(blockList.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (input === ' ') {
      const block = blockList[selectedIndex];
      if (block) {
        setExpandedId(prev => prev === block.id ? null : block.id);
      }
    }
    if (key.return && blockList[selectedIndex] && onBlockSelect) {
      onBlockSelect(blockList[selectedIndex].id);
    }
  }, { isActive: focused });

  // Scroll support
  const scrollStart = Math.max(0,
    Math.min(selectedIndex - Math.floor(maxItems / 2), blockList.length - maxItems)
  );
  const visible = blockList.slice(scrollStart, scrollStart + maxItems);

  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const b of blockList) {
    const t = (b.blockType || b.type || 'unknown').toLowerCase();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const countStr = Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`).join(', ');

  return h(Box, { flexDirection: 'column' },
    h(Box, { paddingLeft: 1, flexDirection: 'row' },
      muted(`${blockList.length} block(s)`),
      countStr ? h(Text, null, muted(`  (${countStr})`)) : null,
      blockList.length > maxItems
        ? muted(`  ${selectedIndex + 1}/${blockList.length}`)
        : null,
    ),
    h(Text, null, ''),
    ...visible.map((block: any, vi: number) => {
      const realIndex = scrollStart + vi;
      const type = (block.blockType || block.type || 'unknown').toLowerCase();
      const name = block.name || block.id || 'Unknown';
      const id = block.id ? block.id.substring(0, 18) : '--------';
      const isSelected = focused && realIndex === selectedIndex;
      const isExpanded = expandedId === block.id;
      const selector = isSelected ? icons.arrow : ' ';

      return h(Box, { key: block.id || `b-${realIndex}`, flexDirection: 'column' },
        // Main row
        h(Box, { flexDirection: 'row', paddingLeft: 1, overflow: 'hidden' },
          h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
          h(Text, null, ' '),
          h(TypeBadge, { type }),
          h(Text, null, ' '),
          h(Text, { color: isSelected ? 'cyan' : 'white' },
            truncate(name, 28).padEnd(28)),
          h(Text, null, ' '),
          muted(id.padEnd(18)),
        ),
        // Expanded detail
        isExpanded
          ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
              // Description
              block.description
                ? h(Text, { color: theme.text.muted, wrap: 'wrap' }, truncate(block.description, 70))
                : muted('No description'),
              // Version + atomic
              h(Box, { flexDirection: 'row', gap: 2 },
                block.version
                  ? h(Box, { flexDirection: 'row' }, muted('v'), primary(block.version))
                  : null,
                block.isAtomic !== undefined
                  ? h(Box, { flexDirection: 'row' }, muted('atomic: '), primary(block.isAtomic ? 'yes' : 'no'))
                  : null,
              ),
            )
          : null,
      );
    }),
    blockList.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no user blocks)'))
      : null,
    blockList.length > maxItems
      ? h(Box, { paddingLeft: 2 }, muted(`+${blockList.length - maxItems} more`))
      : null,
    // Shortcut hints
    h(Box, { paddingLeft: 1, marginTop: 1, flexDirection: 'row' },
      muted('[j/k] Nav  '),
      muted('[Space] Expand  '),
      muted('[Enter] Open  '),
    ),
  );
};

export { FoundryWidget };
