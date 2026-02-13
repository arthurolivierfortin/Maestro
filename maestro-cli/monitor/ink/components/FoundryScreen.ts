// @ts-nocheck
/**
 * FoundryScreen — User's blocks browser (My Blocks).
 *
 * Lists user's blocks grouped by type with inline detail expansion.
 * Supports scrolling when items exceed visible area.
 *
 * Props:
 *   apiClient      API client instance
 *   onNavigate     (page: string) => void
 *   onBlockSelect  (blockId: string, state?) => void — open block detail
 *   onQuit         () => void
 */

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { Box, Text, useStdout } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  TypeBadge,
  truncate,
  prevPage, nextPage,
} from '../theme.ts';
import { useApiData } from '../hooks/useApiData.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';
import { StatusBar } from './StatusBar.ts';

// ── Block Row ────────────────────────────────────────────────

const BlockRow = ({ block, isSelected, isExpanded }) => {
  const type = (block.type || block.blockType || 'unknown').toLowerCase();
  const name = block.name || block.id || 'Unknown';
  const id = block.id ? block.id.substring(0, 12) : '--------';
  const selector = isSelected ? icons.arrow : ' ';
  const expandIcon = isExpanded ? icons.expanded : (isSelected ? icons.collapsed : ' ');

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
      h(Text, null, ' '),
      h(Text, { color: 'gray' }, expandIcon),
      h(Text, null, ' '),
      h(TypeBadge, { type }),
      h(Text, null, ' '),
      h(Text, { color: isSelected ? 'cyan' : 'white' },
        name.length > 35 ? name.substring(0, 35) : name.padEnd(35)),
      h(Text, null, ' '),
      muted(id),
    ),
    isExpanded
      ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
          block.description
            ? h(Text, { color: theme.text.muted }, truncate(block.description, 70))
            : null,
          h(Box, { flexDirection: 'row', gap: 2 },
            block.version ? h(Text, null, muted('v'), primary(block.version)) : null,
            block.isAtomic !== undefined
              ? h(Text, null, muted('atomic: '), primary(block.isAtomic ? 'yes' : 'no'))
              : null,
          ),
        )
      : null,
  );
};

// ── FoundryScreen component ──────────────────────────────────

const FoundryScreen = ({ apiClient, onNavigate, onBlockSelect, onQuit }) => {
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState(-1);

  // Terminal rows for scroll: NavBar(3) + PanelBorder(2) + header(1) + StatusBar(3) = 9
  const termRows = stdout.rows || 40;
  const visibleItems = Math.max(3, termRows - 9);

  // Fetch blocks
  const {
    data: blocks,
    connectionStatus,
    latency,
    lastRefresh,
  } = useApiData(
    useCallback(() => apiClient.listBlocks().catch(() => []), [apiClient]),
    10000
  );

  // Fetch sessions for nav badge
  const { data: sessions } = useApiData(
    useCallback(() => apiClient.listSessions().catch(() => []), [apiClient]),
    10000
  );

  const blockList = Array.isArray(blocks) ? blocks : [];
  const sessionList = sessions || [];
  const runningCount = sessionList.filter(s => s.status === 'running').length;

  // Sort blocks by type then name
  const sortedBlocks = [...blockList].sort((a, b) => {
    const typeOrder = { workflow: 0, agent: 1, tool: 2, template: 3 };
    const ta = typeOrder[(a.type || a.blockType || '').toLowerCase()] ?? 99;
    const tb = typeOrder[(b.type || b.blockType || '').toLowerCase()] ?? 99;
    if (ta !== tb) return ta - tb;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= sortedBlocks.length && sortedBlocks.length > 0) {
      setSelectedIndex(Math.max(0, sortedBlocks.length - 1));
    }
  }, [sortedBlocks.length]);

  // Scroll window
  const scrollStart = Math.max(0,
    Math.min(selectedIndex - Math.floor(visibleItems / 2), sortedBlocks.length - visibleItems)
  );
  const visibleSlice = sortedBlocks.slice(scrollStart, scrollStart + visibleItems);
  const canScrollUp = scrollStart > 0;
  const canScrollDown = scrollStart + visibleItems < sortedBlocks.length;

  // Keyboard
  useKeyboard({
    up: () => setSelectedIndex(i => Math.max(0, i - 1)),
    down: () => setSelectedIndex(i => Math.min(sortedBlocks.length - 1, i + 1)),
    k: () => setSelectedIndex(i => Math.max(0, i - 1)),
    j: () => setSelectedIndex(i => Math.min(sortedBlocks.length - 1, i + 1)),
    // Ctrl+Left/Right = switch page (wrap-around)
    ctrlLeft: () => onNavigate(prevPage('foundry')),
    ctrlRight: () => onNavigate(nextPage('foundry')),
    enter: () => {
      if (sortedBlocks.length > 0 && onBlockSelect) {
        const block = sortedBlocks[selectedIndex];
        if (block) onBlockSelect(block.id, { selectedIndex, expandedIndex });
      }
    },
    space: () => {
      setExpandedIndex(prev => prev === selectedIndex ? -1 : selectedIndex);
    },
    h: () => onNavigate('home'),
    s: () => onNavigate('spaces'),
    f: () => {},
    c: () => onNavigate('catalog'),
    m: () => onNavigate('models'),
    escape: () => {
      if (expandedIndex >= 0) {
        setExpandedIndex(-1);
      } else {
        onNavigate('home');
      }
    },
    q: onQuit,
  });

  // Count by type
  const typeCounts = {};
  for (const b of sortedBlocks) {
    const t = (b.type || b.blockType || 'unknown').toLowerCase();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const typeCountStr = Object.entries(typeCounts)
    .map(([t, c]) => `${c} ${t}`)
    .join(', ');

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    h(NavBar, { currentPage: 'foundry', sessionCount: sessionList.length, runningCount }),

    h(Panel, { title: 'MY BLOCKS', flexGrow: 1, width: '100%' },
      h(Box, { flexDirection: 'column' },
        // Summary line with scroll indicator
        h(Box, { paddingLeft: 2, marginBottom: 1 },
          muted(`${sortedBlocks.length} block(s)`),
          typeCountStr
            ? h(Text, null, muted('  ('), muted(typeCountStr), muted(')'))
            : null,
          canScrollUp || canScrollDown
            ? h(Text, null,
                muted('  '),
                muted(`${selectedIndex + 1}/${sortedBlocks.length}`),
                h(Text, null, ' '),
                canScrollUp ? h(Text, { color: theme.panel.scrollIndicator }, icons.scrollUp) : null,
                canScrollDown ? h(Text, { color: theme.panel.scrollIndicator }, icons.scrollDown) : null,
              )
            : null,
        ),

        // Block list (windowed)
        sortedBlocks.length === 0
          ? h(Box, { paddingLeft: 2, flexDirection: 'column' },
              muted('No blocks found'),
              h(Text, null, ''),
              muted('Create one with:'),
              primary('maestro block create --type tool --name "my-tool"'),
            )
          : h(Box, { flexDirection: 'column' },
              ...visibleSlice.map((block, vi) => {
                const realIndex = scrollStart + vi;
                return h(BlockRow, {
                  key: block.id || `b-${realIndex}`,
                  block,
                  isSelected: realIndex === selectedIndex,
                  isExpanded: realIndex === expandedIndex,
                });
              }),
            ),
      ),
    ),

    h(StatusBar, {
      connectionStatus,
      latency,
      lastRefresh,
      currentPage: 'foundry',
    }),
  );
};

export { FoundryScreen };
