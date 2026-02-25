// @ts-nocheck
/**
 * CatalogPage — wraps CatalogScreen from @maestro/monitor.
 *
 * Manages internal detail state: when user selects a block,
 * switches to BlockDetailPage. Esc in detail returns to list.
 *
 * Phase 41-E.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { CatalogScreen } from '@maestro/monitor/components/CatalogScreen.ts';
import { BlockDetailPage } from './details/BlockDetailPage.ts';

export interface CatalogPageProps {
  apiClient: any;
  height: number;
  onQuit: () => void;
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

const CatalogPage = ({ apiClient, height, onQuit }: CatalogPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleBlockSelect = useCallback((blockId: string) => {
    setDetail({ type: 'block', id: blockId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  if (!apiClient) {
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
  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(CatalogScreen, {
      apiClient,
      onBlockSelect: handleBlockSelect,
      onQuit,
    }),
  );
};

export { CatalogPage };
