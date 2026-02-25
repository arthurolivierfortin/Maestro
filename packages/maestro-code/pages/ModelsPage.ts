// @ts-nocheck
/**
 * ModelsPage — wraps ModelsScreen from @maestro/monitor.
 *
 * Master-detail layout. Selecting a model opens ModelDetailPage.
 *
 * In demo mode, shows mock model data from mocks/demo-data.ts.
 *
 * Phase 41-E/G.
 */

import { createElement as h, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { ModelsScreen } from '@maestro/monitor/components/ModelsScreen.ts';
import { ModelDetailPage } from './details/ModelDetailPage.ts';
import { DEMO_MODELS } from '../mocks/demo-data.ts';

export interface ModelsPageProps {
  apiClient: any;
  height: number;
  onQuit: () => void;
  demoMode?: boolean;
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

// Status color helper
const modelStatusColor = (s: string) =>
  s === 'available' ? 'green' : s === 'offline' ? 'red' : 'yellow';

// Demo models view — shows mock model data
const DemoModelsView = ({ height }: { height: number }) => {
  return h(Box, { flexDirection: 'column', flexGrow: 1, height, paddingX: 1 },
    h(Text, { color: 'cyan', bold: true }, `Models [DEMO] — ${DEMO_MODELS.length} models`),
    h(Box, { height: 1 }),
    ...DEMO_MODELS.map((model) =>
      h(Box, { key: model.id, flexDirection: 'row', gap: 1 },
        h(Text, { color: modelStatusColor(model.status) }, '●'),
        h(Text, { color: 'white', bold: true }, model.name.padEnd(24)),
        h(Text, { color: 'gray' }, model.provider.padEnd(12)),
        model.status === 'available'
          ? h(Text, { color: 'green' }, `${model.latency}ms ${model.tokensPerSec}t/s`)
          : h(Text, { color: 'red', dimColor: true }, model.status),
      )
    ),
  );
};

const ModelsPage = ({ apiClient, height, onQuit, demoMode }: ModelsPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleModelSelect = useCallback((modelId: string) => {
    setDetail({ type: 'model', id: modelId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  if (!apiClient) {
    if (demoMode) return h(DemoModelsView, { height });
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
