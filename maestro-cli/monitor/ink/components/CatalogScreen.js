/**
 * CatalogScreen — Browse system + user blocks catalog.
 *
 * Read-only block browser showing fitness scores, types, and descriptions.
 * Supports scrolling when items exceed visible area.
 *
 * Props:
 *   apiClient    API client instance
 *   onNavigate   (page: string) => void
 *   onQuit       () => void
 */

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { Box, Text, useStdout } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  TypeBadge,
  progressBar, progressColor,
  truncate,
} from '../theme.js';
import { useApiData } from '../hooks/useApiData.js';
import { useKeyboard } from '../hooks/useKeyboard.js';
import { NavBar } from './NavBar.js';
import { Panel } from './Panel.js';
import { StatusBar } from './StatusBar.js';

// ── Type filter tabs ─────────────────────────────────────────

const TypeFilter = ({ activeType }) => {
  const types = [
    { key: 'all', label: 'All' },
    { key: 'workflow', label: 'Workflows' },
    { key: 'agent', label: 'Agents' },
    { key: 'tool', label: 'Tools' },
  ];

  const elements = [];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const isActive = activeType === t.key;
    elements.push(
      h(Text, { key: t.key },
        isActive
          ? h(Text, { color: theme.panel.borderFocused, bold: true }, t.label)
          : h(Text, { color: theme.text.muted }, t.label),
      )
    );
    if (i < types.length - 1) {
      elements.push(h(Text, { key: `ts-${i}`, color: theme.text.muted }, ' | '));
    }
  }

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    muted('Type: '),
    ...elements,
  );
};

// ── Catalog Block Row ────────────────────────────────────────

const CatalogBlockRow = ({ block, isSelected, isExpanded }) => {
  const type = (block.type || block.blockType || 'unknown').toLowerCase();
  const name = block.name || block.id || 'Unknown';
  const id = block.id ? block.id.substring(0, 12) : '--------';
  const selector = isSelected ? icons.arrow : ' ';
  const description = block.description || '';
  const expandIcon = isExpanded ? icons.expanded : (isSelected ? icons.collapsed : ' ');

  const fitness = block.fitness !== undefined ? block.fitness : null;
  const fitnessStr = fitness !== null
    ? `${Math.round(fitness * 100)}%`
    : '-';

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
      h(Text, null, ' '),
      h(Text, { color: 'gray' }, expandIcon),
      h(Text, null, ' '),
      h(TypeBadge, { type }),
      h(Text, null, ' '),
      h(Text, { color: isSelected ? 'cyan' : 'white' },
        name.length > 30 ? name.substring(0, 30) : name.padEnd(30)),
      h(Text, null, ' '),
      muted(id),
      h(Text, null, '  '),
      fitness !== null
        ? T(progressColor(fitness * 100), fitnessStr)
        : muted('-'),
      h(Text, null, ' '),
      description
        ? muted(truncate(description, 30))
        : null,
    ),
    isExpanded
      ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
          description
            ? h(Text, { color: theme.text.muted }, description)
            : muted('No description'),
          h(Box, { flexDirection: 'row', gap: 3 },
            block.version ? h(Text, null, muted('version: '), primary(block.version)) : null,
            block.isAtomic !== undefined
              ? h(Text, null, muted('atomic: '), primary(block.isAtomic ? 'yes' : 'no'))
              : null,
            fitness !== null
              ? h(Text, null,
                  muted('fitness: '),
                  T(progressColor(fitness * 100), progressBar(fitness * 100, 12)),
                  h(Text, null, ' '),
                  T(progressColor(fitness * 100), fitnessStr),
                )
              : null,
          ),
        )
      : null,
  );
};

// ── CatalogScreen component ──────────────────────────────────

const CatalogScreen = ({ apiClient, onNavigate, onQuit }) => {
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState(-1);
  const [typeFilter, setTypeFilter] = useState('all');

  // Terminal rows for scroll: NavBar(3) + PanelBorder(2) + header(2) + StatusBar(3) = 10
  const termRows = stdout.rows || 40;
  const visibleItems = Math.max(3, termRows - 10);

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

  // Apply type filter
  const filteredBlocks = typeFilter === 'all'
    ? blockList
    : blockList.filter(b => ((b.type || b.blockType || '').toLowerCase()) === typeFilter);

  // Sort by name
  const sortedBlocks = [...filteredBlocks].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= sortedBlocks.length && sortedBlocks.length > 0) {
      setSelectedIndex(Math.max(0, sortedBlocks.length - 1));
    }
  }, [sortedBlocks.length]);

  // Reset index on filter change
  useEffect(() => { setSelectedIndex(0); }, [typeFilter]);

  // Scroll window
  const scrollStart = Math.max(0,
    Math.min(selectedIndex - Math.floor(visibleItems / 2), sortedBlocks.length - visibleItems)
  );
  const visibleSlice = sortedBlocks.slice(scrollStart, scrollStart + visibleItems);
  const canScrollUp = scrollStart > 0;
  const canScrollDown = scrollStart + visibleItems < sortedBlocks.length;

  // Cycle type filter
  const cycleTypeFilter = () => {
    const types = ['all', 'workflow', 'agent', 'tool'];
    const currentIdx = types.indexOf(typeFilter);
    setTypeFilter(types[(currentIdx + 1) % types.length]);
  };

  // Keyboard
  useKeyboard({
    up: () => setSelectedIndex(i => Math.max(0, i - 1)),
    down: () => setSelectedIndex(i => Math.min(sortedBlocks.length - 1, i + 1)),
    k: () => setSelectedIndex(i => Math.max(0, i - 1)),
    j: () => setSelectedIndex(i => Math.min(sortedBlocks.length - 1, i + 1)),
    enter: () => {
      setExpandedIndex(prev => prev === selectedIndex ? -1 : selectedIndex);
    },
    tab: cycleTypeFilter,
    h: () => onNavigate('home'),
    s: () => onNavigate('spaces'),
    f: () => onNavigate('foundry'),
    c: () => {},
    m: () => onNavigate('models'),
    escape: () => {
      if (expandedIndex >= 0) {
        setExpandedIndex(-1);
      } else {
        onNavigate('home');
      }
    },
    q: onQuit,
    number: (num) => {
      const pageMap = { 1: 'home', 2: 'spaces', 3: 'foundry', 4: 'catalog', 5: 'models' };
      if (pageMap[num]) onNavigate(pageMap[num]);
    },
  });

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    h(NavBar, { currentPage: 'catalog', sessionCount: sessionList.length, runningCount }),

    h(Panel, { title: 'BLOCK CATALOG', flexGrow: 1, width: '100%' },
      h(Box, { flexDirection: 'column' },
        // Type filter
        h(TypeFilter, { activeType: typeFilter }),

        // Summary with scroll indicator
        h(Box, { paddingLeft: 2 },
          muted(`${sortedBlocks.length} block(s)`),
          typeFilter !== 'all'
            ? h(Text, null, muted(' ('), primary(typeFilter), muted(')'))
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
          ? h(Box, { paddingLeft: 2, paddingTop: 1 },
              muted(typeFilter === 'all' ? 'No blocks in catalog' : `No ${typeFilter} blocks found`),
            )
          : h(Box, { flexDirection: 'column' },
              ...visibleSlice.map((block, vi) => {
                const realIndex = scrollStart + vi;
                return h(CatalogBlockRow, {
                  key: block.id || `cb-${realIndex}`,
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
      currentPage: 'catalog',
    }),
  );
};

export { CatalogScreen };
