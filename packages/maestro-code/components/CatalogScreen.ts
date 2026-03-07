/**
 * CatalogScreen — Browse system + user blocks catalog.
 *
 * Read-only block browser showing fitness scores, types, and descriptions.
 * Supports scrolling when items exceed visible area.
 * Press [T] on a block with a contract to run contract tests and display results.
 *
 * Props:
 *   apiClient      API client instance
 *   onNavigate     (page: string) => void
 *   onBlockSelect  (blockId: string) => void — open block detail
 *   onQuit         () => void
 */

import { createElement as h, useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  TypeBadge,
  progressBar, progressColor,
  truncate,
  prevPage, nextPage,
} from '../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';

// ── Cost formatting ─────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd === 0) return 'Free';
  if (usd < 0.01) return '< $0.01';
  return `$${usd.toFixed(2)}`;
}

// ── Contract test result state ──────────────────────────────

interface ContractTestState {
  /** Block ID being tested (null if idle). */
  testingBlockId: string | null;
  /** Result of last test (keyed by block ID). */
  results: Record<string, any>;
  /** Error messages keyed by block ID. */
  errors: Record<string, string>;
}

// ── Type filter tabs ─────────────────────────────────────────

interface TypeFilterProps {
  activeType: string;
}

const TypeFilter = ({ activeType }: TypeFilterProps) => {
  const types = [
    { key: 'all', num: 1, label: 'All' },
    { key: 'workflow', num: 2, label: 'Workflows' },
    { key: 'agent', num: 3, label: 'Agents' },
    { key: 'tool', num: 4, label: 'Tools' },
  ];

  const elements = [];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const isActive = activeType === t.key;
    elements.push(
      h(Text, { key: t.key },
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
        h(Text, { color: isActive ? theme.panel.borderFocused : theme.shortcut.key, bold: isActive }, String(t.num)),
        h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
        isActive
          ? h(Text, { color: theme.panel.borderFocused, bold: true }, t.label)
          : h(Text, { color: theme.text.muted }, t.label),
      )
    );
    if (i < types.length - 1) {
      elements.push(h(Text, { key: `ts-${i}` }, '  '));
    }
  }

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    ...elements,
  );
};

// ── Catalog Block Row ────────────────────────────────────────

interface CatalogBlockRowProps {
  block: Record<string, any>;
  isSelected: boolean;
  isExpanded: boolean;
  testState?: ContractTestState;
}

const CatalogBlockRow = ({ block, isSelected, isExpanded, testState }: CatalogBlockRowProps) => {
  const type = (block.blockType || block.type || 'unknown').toLowerCase();
  const name = block.name || block.id || 'Unknown';
  const id = block.id ? block.id.substring(0, 18) : '--------';
  const selector = isSelected ? icons.arrow : ' ';
  const description = block.description || '';
  const expandIcon = isExpanded ? icons.expanded : (isSelected ? icons.collapsed : ' ');

  const capabilities: string[] = Array.isArray(block.capabilities) ? block.capabilities : [];
  const fitness = block.fitness !== undefined ? block.fitness : null;
  const fitnessStr = fitness !== null
    ? `${Math.round(fitness * 100)}%`
    : '-';

  // F1: Cap column widths to prevent row wrapping
  const nameMax = 28;
  const idMax = 20;
  const fitnessMax = 6;
  const tagsMax = 24;
  const descMax = 22;
  const displayName = truncate(name, nameMax).padEnd(nameMax);
  const displayId = truncate(id, idMax);
  const capsStr = capabilities.slice(0, 3).join(',');
  const displayCaps = truncate(capsStr, tagsMax);
  const displayDesc = truncate(description, descMax);

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
      h(Text, null, ' '),
      h(Text, { color: 'gray' }, expandIcon),
      h(Text, null, ' '),
      h(TypeBadge, { type }),
      h(Text, null, ' '),
      h(Text, { color: isSelected ? 'cyan' : 'white' }, displayName),
      h(Text, null, ' '),
      muted(displayId),
      h(Text, null, '  '),
      fitness !== null
        ? T(progressColor(fitness * 100), fitnessStr.padEnd(fitnessMax))
        : muted('-'.padEnd(fitnessMax)),
      h(Text, null, ' '),
      capabilities.length > 0
        ? h(Text, { color: theme.text.muted, dimColor: true }, displayCaps)
        : null,
      capabilities.length > 0 && description
        ? h(Text, { color: theme.text.muted, dimColor: true }, ' | ')
        : (capabilities.length > 0 ? h(Text, null, ' ') : null),
      description
        ? muted(displayDesc)
        : null,
    ),
    // F7: Expanded detail — each field on its own line (not concatenated)
    isExpanded
      ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
          description
            ? h(Text, { color: theme.text.muted, wrap: 'truncate' }, truncate(description, 80))
            : muted('No description'),
          block.version
            ? h(Box, { flexDirection: 'row' },
                muted('version: '), primary(block.version),
              )
            : null,
          block.isAtomic !== undefined
            ? h(Box, { flexDirection: 'row' },
                muted('atomic: '), primary(block.isAtomic ? 'yes' : 'no'),
              )
            : null,
          fitness !== null
            ? h(Box, { flexDirection: 'row' },
                muted('fitness: '),
                T(progressColor(fitness * 100), progressBar(fitness * 100, 12)),
                h(Text, null, ' '),
                T(progressColor(fitness * 100), fitnessStr),
              )
            : null,
          capabilities.length > 0
            ? h(Box, { flexDirection: 'row', gap: 1 },
                muted('capabilities: '),
                ...capabilities.map((cap: string) =>
                  h(Text, { key: cap, color: theme.panel.borderFocused, dimColor: true }, `[${cap}]`),
                ),
              )
            : null,
          // Contract test result display
          testState && testState.testingBlockId === block.id
            ? h(Box, { flexDirection: 'row', marginTop: 1 },
                h(Text, { color: 'yellow' }, `Testing ${block.id} against ${block.contract}...`),
              )
            : null,
          testState && testState.errors[block.id]
            ? h(Box, { flexDirection: 'column', marginTop: 1 },
                h(Text, { color: 'red' }, `Error: ${testState.errors[block.id]}`),
              )
            : null,
          testState && testState.results[block.id]
            ? h(ContractTestResultView, { result: testState.results[block.id], contractId: block.contract || '' })
            : null,
        )
      : null,
  );
};

// ── Contract Test Result View ────────────────────────────────

interface ContractTestResultViewProps {
  result: any;
  contractId: string;
}

const ContractTestResultView = ({ result, contractId }: ContractTestResultViewProps) => {
  const fitPct = Math.round((result.fitness ?? 0) * 100);
  const fitCol = progressColor(fitPct);
  const costStr = formatCost(result.estimatedCostUsd ?? 0);
  const duration = result.durationMs != null ? `${(result.durationMs / 1000).toFixed(1)}s` : '-';
  const features: any[] = Array.isArray(result.features) ? result.features : [];
  const bd = result.fitnessBreakdown;

  return h(Box, { flexDirection: 'column', marginTop: 1 },
    // Header line: Fitness + Cost
    h(Box, { flexDirection: 'row' },
      muted('Fitness: '),
      T(fitCol, `${fitPct}%`, { bold: true }),
      h(Text, null, '  '),
      muted('Cost: '),
      h(Text, { color: result.estimatedCostUsd === 0 ? 'green' : 'yellow' }, costStr),
    ),

    // Contract info line
    h(Box, { flexDirection: 'row' },
      muted(`Contract: ${contractId}`),
      result.contractVersion ? h(Text, null, muted(` v${result.contractVersion}`)) : null,
    ),

    // Tests summary
    h(Box, { flexDirection: 'row' },
      muted('Tests: '),
      h(Text, { color: 'green' }, `${result.passedTests ?? 0}/${result.totalTests ?? 0} passed`),
      h(Text, null, muted(' | Cost: ')),
      h(Text, { color: result.estimatedCostUsd === 0 ? 'green' : 'yellow' }, costStr),
      h(Text, null, muted(' | Duration: ')),
      muted(duration),
    ),

    // Features breakdown
    features.length > 0
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          muted('Features:'),
          ...features.map((f, i) => {
            const isLast = i === features.length - 1;
            const branch = isLast ? icons.lastBranch : icons.branch;
            const fPct = Math.round((f.score ?? 0) * 100);
            const fCol = progressColor(fPct);
            const passedStr = `${f.testsPassed ?? 0}/${f.testsTotal ?? 0}`;
            return h(Box, { key: f.featureId || `f-${i}`, flexDirection: 'row' },
              muted(branch + ' '),
              h(Text, { color: 'white' }, (f.featureId || 'unknown').padEnd(18)),
              h(Text, { color: 'white' }, passedStr.padEnd(6)),
              T(fCol, progressBar(fPct, 12)),
              h(Text, null, ' '),
              T(fCol, `${fPct}%`),
            );
          }),
        )
      : null,

    // F6: Fitness breakdown — uses plain indentation (NOT tree branch chars)
    // to visually separate metrics from features above
    bd
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          muted('Breakdown:'),
          h(Box, { flexDirection: 'row' },
            muted('  Performance:     '),
            h(Text, { color: progressColor(Math.round((bd.performance ?? 0) * 100)) },
              (bd.performance ?? 0).toFixed(2)),
          ),
          h(Box, { flexDirection: 'row' },
            muted('  Specialization:  '),
            h(Text, { color: progressColor(Math.round((bd.specialization ?? 0) * 100)) },
              (bd.specialization ?? 0).toFixed(2)),
          ),
          h(Box, { flexDirection: 'row' },
            muted('  Composability:   '),
            h(Text, { color: progressColor(Math.round((bd.composability ?? 0) * 100)) },
              (bd.composability ?? 0).toFixed(2)),
          ),
          h(Box, { flexDirection: 'row' },
            muted('  Cost Factor:     '),
            h(Text, { color: 'yellow' },
              `x${(bd.combinedCost ?? 1).toFixed(1)} (C_econ=${(bd.economicCost ?? 0).toFixed(1)} x C_compute=${(bd.computeCost ?? 0).toFixed(1)} x C_hw=${(bd.hardwareCost ?? 0).toFixed(1)})^0.3`),
          ),
        )
      : null,
  );
};

// ── CatalogScreen component ──────────────────────────────────

interface CatalogScreenProps {
  apiClient: any;
  onNavigate: (page: string) => void;
  onBlockSelect?: (id: string, state?: Record<string, any>) => void;
  onQuit: () => void;
  initialState?: Record<string, any>;
  chrome?: boolean;
  keyboardActive?: boolean;
}

const CatalogScreen = ({ apiClient, onNavigate, onBlockSelect, onQuit, initialState, chrome, keyboardActive }: CatalogScreenProps) => {
  const showChrome = chrome !== false;
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const [expandedIndex, setExpandedIndex] = useState(initialState?.expandedIndex ?? -1);
  const [typeFilter, setTypeFilter] = useState(initialState?.typeFilter ?? 'all');

  // F3: Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Contract test state
  const [contractTest, setContractTest] = useState<ContractTestState>({
    testingBlockId: null,
    results: {},
    errors: {},
  });

  // Terminal rows for scroll: NavBar(3) + PanelBorder(2) + header(2) + filter tabs(1) + StatusBar(3)
  const termRows = stdout.rows || 40;
  const visibleItems = Math.max(3, termRows - 13);

  // Fetch blocks
  const { data: blocks } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listBlocks().catch((): any[] => []), [apiClient]),
    10000
  );

  // Fetch sessions for nav badge
  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions().catch((): any[] => []), [apiClient]),
    10000
  );

  const blockList: any[] = Array.isArray(blocks) ? blocks : [];
  const sessionList: any[] = (sessions as any[]) || [];
  const runningCount = sessionList.filter((s: any) => s.status === 'running').length;

  // Apply type filter
  const typeFiltered = typeFilter === 'all'
    ? blockList
    : blockList.filter(b => ((b.blockType || b.type || '').toLowerCase()) === typeFilter);

  // F3: Apply search filter
  const filteredBlocks = searchQuery
    ? typeFiltered.filter(b => {
        const q = searchQuery.toLowerCase();
        const name = (b.name || '').toLowerCase();
        const id = (b.id || '').toLowerCase();
        const desc = (b.description || '').toLowerCase();
        const caps: string[] = Array.isArray(b.capabilities) ? b.capabilities : [];
        const capsStr = caps.join(' ').toLowerCase();
        return name.includes(q) || id.includes(q) || desc.includes(q) || capsStr.includes(q);
      })
    : typeFiltered;

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

  // Reset index on filter change (skip initial mount to preserve restored state)
  const prevTypeFilter = useRef(typeFilter);
  useEffect(() => {
    if (prevTypeFilter.current !== typeFilter) {
      setSelectedIndex(0);
      prevTypeFilter.current = typeFilter;
    }
  }, [typeFilter]);

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

  // Contract test handler
  const handleContractTest = useCallback(() => {
    if (sortedBlocks.length === 0) return;
    const block = sortedBlocks[selectedIndex];
    if (!block) return;

    const contractId = block.contract;
    if (!contractId) {
      // No contract — show message by auto-expanding and setting a transient error
      setExpandedIndex(selectedIndex);
      setContractTest(prev => ({
        ...prev,
        errors: { ...prev.errors, [block.id]: 'No contract defined for this block' },
      }));
      return;
    }

    // Already testing this block — ignore
    if (contractTest.testingBlockId === block.id) return;

    // Auto-expand the block row to show the result
    setExpandedIndex(selectedIndex);

    // Clear previous result/error for this block, set testing state
    setContractTest(prev => ({
      testingBlockId: block.id,
      results: { ...prev.results, [block.id]: undefined },
      errors: { ...prev.errors, [block.id]: undefined },
    }));

    // Run the test asynchronously
    const blockId = block.id;
    (async () => {
      try {
        const result = await apiClient.testContract(contractId, blockId);
        setContractTest(prev => ({
          ...prev,
          testingBlockId: prev.testingBlockId === blockId ? null : prev.testingBlockId,
          results: { ...prev.results, [blockId]: result },
        }));
      } catch (err: any) {
        setContractTest(prev => ({
          ...prev,
          testingBlockId: prev.testingBlockId === blockId ? null : prev.testingBlockId,
          errors: { ...prev.errors, [blockId]: err.message || String(err) },
        }));
      }
    })();
  }, [sortedBlocks, selectedIndex, contractTest.testingBlockId, apiClient]);

  // Keyboard (disabled when search is active)
  useKeyboard({
    up: () => setSelectedIndex((i: number) => Math.max(0, i - 1)),
    down: () => setSelectedIndex((i: number) => Math.min(sortedBlocks.length - 1, i + 1)),
    k: () => setSelectedIndex((i: number) => Math.max(0, i - 1)),
    j: () => setSelectedIndex((i: number) => Math.min(sortedBlocks.length - 1, i + 1)),
    enter: () => {
      if (sortedBlocks.length > 0 && onBlockSelect) {
        const block = sortedBlocks[selectedIndex];
        if (block) onBlockSelect(block.id, { selectedIndex, expandedIndex, typeFilter });
      }
    },
    space: () => {
      setExpandedIndex((prev: number) => prev === selectedIndex ? -1 : selectedIndex);
    },
    t: handleContractTest,
    tab: cycleTypeFilter,
    number: (num: number) => {
      const types = ['all', 'workflow', 'agent', 'tool'];
      if (num >= 1 && num <= types.length) setTypeFilter(types[num - 1]);
    },
    // Chrome-only keys: page navigation (disabled when embedded in maestro-code)
    ...(showChrome ? {
      ctrlLeft: () => onNavigate(prevPage('catalog')),
      ctrlRight: () => onNavigate(nextPage('catalog')),
      h: () => onNavigate('home'),
      a: () => onNavigate('agent'),
      s: () => onNavigate('spaces'),
      f: () => onNavigate('foundry'),
      c: () => {},
      m: () => onNavigate('models'),
    } : {}),
    escape: () => {
      if (searchQuery) {
        setSearchQuery('');
        setSelectedIndex(0);
      } else if (expandedIndex >= 0) {
        setExpandedIndex(-1);
      } else if (showChrome) {
        onNavigate('home');
      }
    },
    q: onQuit,
  }, { isActive: keyboardActive !== false && !isSearching });

  // F3: Search input handler — '/' enters search mode, Escape exits
  useInput((input: string, key) => {
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        setSearchQuery('');
        setSelectedIndex(0);
        return;
      }
      if (key.return) {
        // Confirm search — exit search mode but keep the filter
        setIsSearching(false);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
      // Append printable characters
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
        setSelectedIndex(0);
      }
      return;
    }
    // Not searching: '/' enters search mode
    if (input === '/') {
      setIsSearching(true);
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, { isActive: keyboardActive !== false });

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    showChrome ? h(NavBar, { currentPage: 'catalog', sessionCount: sessionList.length, runningCount }) : null,

    h(Panel, { title: 'BLOCK CATALOG', flexGrow: 1, width: '100%' },
      h(Box, { flexDirection: 'column' },
        // Type filter
        h(TypeFilter, { activeType: typeFilter }),

        // F3: Search bar (visible when searching or query active)
        isSearching
          ? h(Box, { paddingLeft: 2 },
              h(Text, { color: 'yellow' }, '/'),
              h(Text, { color: 'white' }, searchQuery),
              h(Text, { color: 'gray' }, '\u2588'),
            )
          : searchQuery
            ? h(Box, { paddingLeft: 2 },
                muted('filter: '),
                h(Text, { color: 'cyan' }, searchQuery),
                muted('  [Esc] clear'),
              )
            : null,

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
              muted(searchQuery
                ? `No blocks matching "${searchQuery}"`
                : (typeFilter === 'all' ? 'No blocks in catalog' : `No ${typeFilter} blocks found`)),
            )
          : h(Box, { flexDirection: 'column' },
              ...visibleSlice.map((block, vi) => {
                const realIndex = scrollStart + vi;
                return h(CatalogBlockRow, {
                  key: block.id || `cb-${realIndex}`,
                  block,
                  isSelected: realIndex === selectedIndex,
                  isExpanded: realIndex === expandedIndex,
                  testState: contractTest,
                });
              }),
            ),
        // Shortcut hints
        h(Box, { paddingLeft: 2, marginTop: 1, flexDirection: 'row' },
          muted('[1-4] Filter  '),
          muted('['),
          h(Text, { color: theme.shortcut.key }, '\u2191\u2193'),
          muted('] Navigate  '),
          muted('[Enter] Expand  '),
          // Show [T] Test only when selected block has a contract
          sortedBlocks.length > 0 && sortedBlocks[selectedIndex]?.contract
            ? h(Text, null,
                h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
                h(Text, { color: theme.shortcut.key }, 'T'),
                h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
                muted('Test  '),
              )
            : null,
          muted('[/] Search  '),
          muted('[Esc] Back'),
        ),
      ),
    ),

  );
};

export { CatalogScreen, formatCost };
