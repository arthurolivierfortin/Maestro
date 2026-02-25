// @ts-nocheck
/**
 * CatalogPage — wraps CatalogScreen from @maestro/monitor.
 *
 * Manages internal detail state: when user selects a block,
 * switches to BlockDetailPage. Esc in detail returns to list.
 *
 * In demo mode, shows mock block data from mocks/demo-data.ts.
 *
 * Phase 41-E/G/H.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { CatalogScreen } from '@maestro/monitor/components/CatalogScreen.ts';
import { BlockDetailPage } from './details/BlockDetailPage.ts';
import { DEMO_BLOCKS } from '../mocks/demo-data.ts';

export interface CatalogPageProps {
  apiClient: any;
  height: number;
  onQuit: () => void;
  demoMode?: boolean;
}

type DetailState = { type: 'block'; id: string } | null;

// ── Fitness bar helper ───────────────────────────────────────

function fitnessBar(fitness: number, width = 10): string {
  const filled = Math.round(fitness * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fitnessColor(f: number): string {
  return f >= 0.9 ? 'green' : f >= 0.7 ? 'yellow' : 'red';
}

const TYPE_ICON: Record<string, string> = {
  agent: '◉', tool: '◆', workflow: '⟁', inference: '⟐', validator: '✓',
};

// ── Empty / no-client view ───────────────────────────────────

const EmptyCatalogView = ({ height, message }: { height: number; message: string }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'gray',
      paddingX: 3,
      paddingY: 1,
      width: 50,
    },
      h(Text, { color: 'cyan', bold: true }, '◇ Catalog'),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray' }, message),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, 'Ctrl+Right → Agent'),
    ),
  );
};

// ── Demo catalog view ────────────────────────────────────────

const DemoCatalogView = ({ height }: { height: number }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'cyan',
      paddingX: 2,
      paddingY: 1,
      width: 72,
    },
      h(Text, { color: 'cyan', bold: true }, `◇ Catalog — ${DEMO_BLOCKS.length} blocks`),
      h(Box, { height: 1 }),
      // Table header
      h(Box, { flexDirection: 'row' },
        h(Text, { color: 'gray', dimColor: true }, '  '),
        h(Text, { color: 'gray', dimColor: true }, 'TYPE'.padEnd(12)),
        h(Text, { color: 'gray', dimColor: true }, 'NAME'.padEnd(24)),
        h(Text, { color: 'gray', dimColor: true }, 'FITNESS'.padEnd(14)),
        h(Text, { color: 'gray', dimColor: true }, 'VER'),
      ),
      // Block rows
      ...DEMO_BLOCKS.map((block) =>
        h(Box, { key: block.id, flexDirection: 'row' },
          h(Text, { color: fitnessColor(block.fitness) }, (TYPE_ICON[block.type] || '·') + ' '),
          h(Text, { color: 'gray' }, block.type.padEnd(12)),
          h(Text, { color: 'white', bold: true }, block.name.padEnd(24)),
          h(Text, { color: fitnessColor(block.fitness) },
            fitnessBar(block.fitness) + ` ${Math.round(block.fitness * 100)}%`.padStart(5)),
          h(Text, { color: 'gray', dimColor: true }, `  ${block.version}`),
        )
      ),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, '[DEMO] Read-only preview'),
    ),
  );
};

// ── Main CatalogPage ─────────────────────────────────────────

const CatalogPage = ({ apiClient, height, onQuit, demoMode }: CatalogPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleBlockSelect = useCallback((blockId: string) => {
    setDetail({ type: 'block', id: blockId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  // Demo mode — always show demo view
  if (demoMode) return h(DemoCatalogView, { height });

  // No API client — show empty state
  if (!apiClient) return h(EmptyCatalogView, { height, message: 'No API client available.' });

  // Detail view: block detail within the catalog page
  if (detail) {
    return h(BlockDetailPage, {
      blockId: detail.id,
      apiClient,
      onBack: handleBack,
      onQuit,
    });
  }

  // List view: CatalogScreen from monitor
  // onNavigate is a noop — spatial navigation is handled by App.ts via Ctrl+Arrow
  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(CatalogScreen, {
      apiClient,
      onNavigate: () => {},
      onBlockSelect: handleBlockSelect,
      onQuit,
    }),
  );
};

export { CatalogPage };
