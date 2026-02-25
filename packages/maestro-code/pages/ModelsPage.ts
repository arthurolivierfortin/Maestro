// @ts-nocheck
/**
 * ModelsPage — wraps ModelsScreen from @maestro/monitor.
 *
 * Master-detail layout. Selecting a model opens ModelDetailPage.
 *
 * Phase 41-E.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { ModelsScreen } from '@maestro/monitor/components/ModelsScreen.ts';
import { ModelDetailPage } from './details/ModelDetailPage.ts';

export interface ModelsPageProps {
  apiClient: any;
  height: number;
  onQuit: () => void;
}

type DetailState = { type: 'model'; id: string } | null;

const NoModelsView = ({ height }: { height: number }) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    width: '100%',
  },
    h(Text, { color: 'yellow', bold: true }, 'Models'),
    h(Box, { height: 1 }),
    h(Text, { color: 'gray' }, 'No API client available.'),
    h(Text, { color: 'cyan', dimColor: true }, 'Ctrl+Up  Back to Agent'),
  );
};

const ModelsPage = ({ apiClient, height, onQuit }: ModelsPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleModelSelect = useCallback((modelId: string) => {
    setDetail({ type: 'model', id: modelId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  if (!apiClient) {
    return h(NoModelsView, { height });
  }

  // Detail view: model detail within the models page
  if (detail) {
    return h(ModelDetailPage, {
      modelId: detail.id,
      apiClient,
      onBack: handleBack,
      onQuit,
    });
  }

  // List view: ModelsScreen from monitor
  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(ModelsScreen, {
      apiClient,
      onModelSelect: handleModelSelect,
      onQuit,
    }),
  );
};

export { ModelsPage };
