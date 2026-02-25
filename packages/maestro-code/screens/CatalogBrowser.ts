// @ts-nocheck
/**
 * CatalogBrowser — Browse available blocks.
 *
 * Lists blocks from the API with type badges and fitness scores.
 * Select a block → navigate to block detail.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Panel } from '@maestro/tui/components';
import { useApiData, useSelectableList } from '@maestro/tui/hooks';
import { useActionKeyboard } from '@maestro/tui/hooks';
import {
  inkTheme as theme, T, muted, bold, primary,
  TypeBadge,
} from '@maestro/tui/theme';
import { progressBar, progressColor } from '@maestro/tui/utils';
import type { Screen } from '../types.ts';

interface CatalogBrowserProps {
  apiClient: any;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onQuit: () => void;
  height: number;
}

const CatalogBrowser = ({ apiClient, onNavigate, onBack, onQuit, height }: CatalogBrowserProps) => {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: blocks } = useApiData(
    useCallback(() => apiClient?.listBlocks?.() || apiClient?._fetch?.('GET', '/api/blocks').catch(() => []), [apiClient]),
    10000
  );

  const blockList = (blocks || []).filter(b =>
    !typeFilter || b.type === typeFilter
  );

  const {
    selectedIndex,
    moveUp,
    moveDown,
    scrollStart,
    visibleCount,
    canScrollUp,
    canScrollDown,
    positionLabel,
  } = useSelectableList({ itemCount: blockList.length, pageSize: height - 8 });

  useActionKeyboard({
    'cursor.up': moveUp,
    'cursor.down': moveDown,
    'cursor.upAlt': moveUp,
    'cursor.downAlt': moveDown,
    'tree.toggle': () => {
      const block = blockList[selectedIndex];
      if (block) onNavigate({ type: 'block-detail', id: block.id });
    },
    'back': onBack,
    'quit': onQuit,
  }, 'detail');

  const visibleBlocks = blockList.slice(scrollStart, scrollStart + visibleCount);

  return h(Panel, {
    title: 'CATALOG',
    focused: true,
    flexGrow: 1,
    cursorInfo: positionLabel,
    showScroll: true,
    canScrollUp,
    canScrollDown,
  },
    h(Box, { flexDirection: 'column', paddingLeft: 1 },
      // Filter bar
      h(Box, { flexDirection: 'row', marginBottom: 1 },
        muted(`${blockList.length} block(s)`),
        typeFilter
          ? h(Text, null, '  ', muted('filter: '), primary(typeFilter))
          : null,
      ),

      // Block list
      blockList.length === 0
        ? h(Box, { paddingLeft: 1 }, muted('(no blocks found)'))
        : h(Box, { flexDirection: 'column' },
            ...visibleBlocks.map((block, i) => {
              const globalIndex = scrollStart + i;
              const isSelected = globalIndex === selectedIndex;
              const selector = isSelected ? '→' : ' ';
              const fitness = block.fitness != null ? Math.round(block.fitness * 100) : null;

              return h(Box, {
                key: block.id || `b-${i}`,
                flexDirection: 'row',
                paddingLeft: 1,
              },
                h(Text, { color: isSelected ? 'cyan' : 'gray' }, selector),
                h(Text, null, ' '),
                h(TypeBadge, { type: block.type || 'unknown' }),
                h(Text, null, ' '),
                h(Text, {
                  color: isSelected ? 'cyan' : 'white',
                  bold: isSelected,
                }, (block.name || block.id || 'unnamed').padEnd(30)),
                fitness != null
                  ? h(Box, { flexDirection: 'row' },
                      T(progressColor(fitness), progressBar(fitness, 8)),
                      h(Text, null, ' '),
                      T(progressColor(fitness), `${fitness}%`),
                    )
                  : muted('-'),
              );
            }),
          ),
    ),
  );
};

export { CatalogBrowser };
