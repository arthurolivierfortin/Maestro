// @ts-nocheck
/**
 * CatalogPage — wraps CatalogScreen from @maestro/monitor.
 *
 * Manages internal detail state: when user selects a block,
 * switches to BlockDetailPage. Esc in detail returns to list.
 *
 * In demo mode, shows mock block data from mocks/demo-data.ts.
 *
 * Phase 41-E/G.
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

const NoCatalogView = ({ height }: { height: number }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Text, { color: 'yellow', bold: true }, 'Catalog'),
    h(Box, { height: 1 }),
    h(Text, { color: 'gray' }, 'No API client available.'),
    h(Text, { color: 'cyan', dimColor: true }, 'Ctrl+Right  Back to Agent'),
  );
};

// Demo catalog view — shows mock blocks without CatalogScreen
const DemoCatalogView = ({ height }: { height: number }) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1, height, paddingX: 1 },
    h(Text, { color: 'cyan', bold: true }, `Catalog [DEMO] — ${DEMO_BLOCKS.length} blocks`),
    h(Box, { height: 1 }),
    ...DEMO_BLOCKS.map((block) =>
      h(Box, { key: block.id, flexDirection: 'row', gap: 1 },
        h(Text, { color: 'gray' }, block.type.padEnd(10)),
        h(Text, { color: 'white', bold: true }, block.name.padEnd(22)),
        h(Text, { color: block.fitness >= 0.9 ? 'green' : block.fitness >= 0.8 ? 'yellow' : 'red' },
          `${Math.round(block.fitness * 100)}%`),
        h(Text, { color: 'gray', dimColor: true }, ` v${block.version}`),
      )
    ),
  );
};

const CatalogPage = ({ apiClient, height, onQuit, demoMode }: CatalogPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleBlockSelect = useCallback((blockId: string) => {
    setDetail({ type: 'block', id: blockId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  // No API client: show demo or fallback
  if (!apiClient) {
    if (demoMode) return h(DemoCatalogView, { height });
    return h(NoCatalogView, { height });
  }

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
