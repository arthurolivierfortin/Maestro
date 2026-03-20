/**
 * CatalogWidget — Block catalog with type filter + fitness.
 *
 * Extracted from CatalogScreen. Compact inline version.
 * Interactive: j/k navigate, 1/2/3/4 filter by type, Space expand/collapse,
 * T run contract test, Enter opens block detail.
 */

import { createElement as h, useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  TypeBadge,
  progressBar, progressColor,
  truncate,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface CatalogWidgetProps {
  apiClient: any;
  focused: boolean;
  onBlockSelect?: (id: string) => void;
  initialFilter?: string;
  maxItems?: number;
}

interface ContractTestState {
  testingBlockId: string | null;
  results: Record<string, any>;
  errors: Record<string, string>;
}

const CatalogWidget = ({ apiClient, focused, onBlockSelect, initialFilter, maxItems = 10 }: CatalogWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [typeFilter, setTypeFilter] = useState(initialFilter || 'all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contractTest, setContractTest] = useState<ContractTestState>({
    testingBlockId: null,
    results: {},
    errors: {},
  });

  const { data: blocks } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listBlocks().catch((): any[] => []), [apiClient]),
    focused ? 10000 : 0
  );

  const blockList: any[] = (blocks as any[]) || [];
  const filtered = useMemo(() => {
    if (typeFilter === 'all') return blockList;
    return blockList.filter(b => (b.blockType || b.type || '').toLowerCase() === typeFilter);
  }, [blockList, typeFilter]);

  useEffect(() => {
    if (selectedIndex >= filtered.length && filtered.length > 0) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length]);

  // Contract test handler
  const handleContractTest = useCallback(() => {
    if (filtered.length === 0) return;
    const block = filtered[selectedIndex];
    if (!block) return;

    const contractId = block.contract;
    if (!contractId) {
      // No contract -- show message
      setExpandedId(block.id);
      setContractTest(prev => ({
        ...prev,
        errors: { ...prev.errors, [block.id]: 'No contract defined for this block' },
      }));
      return;
    }

    if (contractTest.testingBlockId === block.id) return;

    // Auto-expand to show result
    setExpandedId(block.id);

    setContractTest(prev => ({
      testingBlockId: block.id,
      results: { ...prev.results, [block.id]: undefined },
      errors: { ...prev.errors, [block.id]: undefined },
    }));

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
  }, [filtered, selectedIndex, contractTest.testingBlockId, apiClient]);

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (input === '1') { setTypeFilter('all'); setSelectedIndex(0); }
    if (input === '2') { setTypeFilter('workflow'); setSelectedIndex(0); }
    if (input === '3') { setTypeFilter('agent'); setSelectedIndex(0); }
    if (input === '4') { setTypeFilter('tool'); setSelectedIndex(0); }
    if (input === ' ') {
      const block = filtered[selectedIndex];
      if (block) {
        setExpandedId(prev => prev === block.id ? null : block.id);
      }
    }
    if (input === 't' || input === 'T') {
      handleContractTest();
    }
    if (key.return && filtered[selectedIndex] && onBlockSelect) {
      onBlockSelect(filtered[selectedIndex].id);
    }
  }, { isActive: focused });

  // Scroll support
  const scrollStart = Math.max(0,
    Math.min(selectedIndex - Math.floor(maxItems / 2), filtered.length - maxItems)
  );
  const visible = filtered.slice(scrollStart, scrollStart + maxItems);

  const types = ['all', 'workflow', 'agent', 'tool'];
  const typeLabels = ['All', 'Workflows', 'Agents', 'Tools'];

  return h(Box, { flexDirection: 'column' },
    // Type filter tabs
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      ...types.map((t, i) => {
        const isActive = typeFilter === t;
        return h(Text, { key: t },
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
          h(Text, { color: isActive ? theme.panel.borderFocused : theme.shortcut.key, bold: isActive }, String(i + 1)),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
          isActive
            ? h(Text, { color: theme.panel.borderFocused, bold: true }, typeLabels[i])
            : h(Text, { color: theme.text.muted }, typeLabels[i]),
          i < types.length - 1 ? h(Text, null, '  ') : null,
        );
      }),
    ),
    h(Box, { paddingLeft: 1, flexDirection: 'row' },
      muted(`${filtered.length} block(s)`),
      filtered.length > maxItems
        ? muted(`  ${selectedIndex + 1}/${filtered.length}`)
        : null,
    ),
    // Block rows
    ...visible.map((block: any, vi: number) => {
      const realIndex = scrollStart + vi;
      const type = (block.blockType || block.type || 'unknown').toLowerCase();
      const name = block.name || block.id || 'Unknown';
      const id = block.id ? block.id.substring(0, 18) : '--------';
      const fitness = block.fitness;
      const hasFitness = fitness !== undefined && fitness !== null && fitness >= 0;
      const fitnessStr = hasFitness ? `${Math.round(fitness * 100)}%`.padEnd(8) : ''.padEnd(8);
      const isSelected = focused && realIndex === selectedIndex;
      const isExpanded = expandedId === block.id;
      const selector = isSelected ? icons.arrow : ' ';

      const capabilities: string[] = Array.isArray(block.capabilities) ? block.capabilities : [];
      const description = block.description || '';

      return h(Box, { key: block.id || `b-${realIndex}`, flexDirection: 'column', overflow: 'hidden' },
        // Main row
        h(Box, { flexDirection: 'row', paddingLeft: 1, height: 1, overflow: 'hidden' },
          h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
          h(Text, null, ' '),
          h(TypeBadge, { type }),
          h(Text, null, ' '),
          h(Text, { color: isSelected ? 'cyan' : 'white' },
            truncate(name, 24).padEnd(24)),
          h(Text, null, ' '),
          muted(id.padEnd(18)),
          h(Text, null, ' '),
          hasFitness
            ? h(Box, { flexDirection: 'row', overflow: 'hidden' },
                T(progressColor(fitness * 100), progressBar(fitness * 100, 8)),
                h(Text, null, ' '),
                T(progressColor(fitness * 100), fitnessStr),
              )
            : muted(''.padEnd(17)),
        ),
        // Expanded detail
        isExpanded
          ? h(Box, { flexDirection: 'column', paddingLeft: 6, marginBottom: 1 },
              // Full description
              description
                ? h(Text, { color: theme.text.muted, wrap: 'wrap' }, description)
                : muted('No description'),
              // Version + atomic
              h(Box, { flexDirection: 'row', gap: 2 },
                block.version
                  ? h(Box, { flexDirection: 'row' }, muted('version: '), primary(block.version))
                  : null,
                block.isAtomic !== undefined
                  ? h(Box, { flexDirection: 'row' }, muted('atomic: '), primary(block.isAtomic ? 'yes' : 'no'))
                  : null,
              ),
              // Capabilities as tags
              capabilities.length > 0
                ? h(Box, { flexDirection: 'row', overflow: 'hidden' },
                    muted('capabilities: '),
                    h(Text, { color: theme.panel.borderFocused, dimColor: true },
                      capabilities.map((cap: string) => `[${cap}]`).join(' ')),
                  )
                : null,
              // Contract ID
              block.contract
                ? h(Box, { flexDirection: 'row' },
                    muted('contract: '), primary(block.contract),
                  )
                : null,
              // Fitness bar (expanded, full width)
              hasFitness
                ? h(Box, { flexDirection: 'row' },
                    muted('fitness: '),
                    T(progressColor(fitness * 100), progressBar(fitness * 100, 12)),
                    h(Text, null, ' '),
                    T(progressColor(fitness * 100), `${Math.round(fitness * 100)}%`),
                  )
                : null,
              // Contract test result
              contractTest.testingBlockId === block.id
                ? h(Box, { flexDirection: 'row', marginTop: 1 },
                    h(Text, { color: 'yellow' }, `Testing ${block.id}...`),
                  )
                : null,
              contractTest.errors[block.id]
                ? h(Box, { flexDirection: 'row' },
                    h(Text, { color: 'red' }, `Error: ${contractTest.errors[block.id]}`),
                  )
                : null,
              contractTest.results[block.id]
                ? h(Box, { flexDirection: 'column' },
                    h(Box, { flexDirection: 'row' },
                      muted('Test: '),
                      h(Text, { color: 'green' },
                        `${contractTest.results[block.id].passedTests ?? 0}/${contractTest.results[block.id].totalTests ?? 0} passed`),
                      h(Text, null, '  '),
                      muted('Fitness: '),
                      T(progressColor(Math.round((contractTest.results[block.id].fitness ?? 0) * 100)),
                        `${Math.round((contractTest.results[block.id].fitness ?? 0) * 100)}%`),
                    ),
                  )
                : null,
            )
          : null,
      );
    }),
    filtered.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('(no blocks)'))
      : null,
    filtered.length > maxItems
      ? h(Box, { paddingLeft: 2 }, muted(`+${filtered.length - maxItems} more`))
      : null,
    // Shortcut hints
    h(Box, { paddingLeft: 1, marginTop: 1, flexDirection: 'row' },
      muted('[1-4] Filter  '),
      muted('[j/k] Nav  '),
      muted('[Space] Expand  '),
      muted('[Enter] Open  '),
      muted('[T] Test  '),
    ),
  );
};

export { CatalogWidget };
