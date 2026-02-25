// @ts-nocheck
/**
 * ModelsPage — wraps ModelsScreen from @maestro/monitor.
 *
 * Master-detail layout. Selecting a model opens ModelDetailPage.
 *
 * In demo mode, shows mock model data from mocks/demo-data.ts.
 *
 * Phase 41-E/G/H.
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

// ── Status helpers ───────────────────────────────────────────

function modelStatusColor(s: string): string {
  return s === 'available' ? 'green' : s === 'offline' ? 'red' : 'yellow';
}

function modelStatusIcon(s: string): string {
  return s === 'available' ? '●' : s === 'offline' ? '○' : '◐';
}

function latencyBar(ms: number, max = 2000, width = 8): string {
  const ratio = Math.min(ms / max, 1);
  const filled = Math.round(ratio * width);
  return '▮'.repeat(filled) + '▯'.repeat(width - filled);
}

// ── Empty / no-client view ───────────────────────────────────

const EmptyModelsView = ({ height, message }: { height: number; message: string }) => {
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
      h(Text, { color: 'cyan', bold: true }, '⟐ Models'),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray' }, message),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, 'Ctrl+Up → Agent'),
    ),
  );
};

// ── Demo models view ─────────────────────────────────────────

const DemoModelsView = ({ height }: { height: number }) => {
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
      h(Text, { color: 'cyan', bold: true }, `⟐ Models — ${DEMO_MODELS.length} providers`),
      h(Box, { height: 1 }),
      // Table header
      h(Box, { flexDirection: 'row' },
        h(Text, { color: 'gray', dimColor: true }, '  '),
        h(Text, { color: 'gray', dimColor: true }, 'MODEL'.padEnd(26)),
        h(Text, { color: 'gray', dimColor: true }, 'PROVIDER'.padEnd(14)),
        h(Text, { color: 'gray', dimColor: true }, 'LATENCY'.padEnd(14)),
        h(Text, { color: 'gray', dimColor: true }, 'SPEED'),
      ),
      // Model rows
      ...DEMO_MODELS.map((model) =>
        h(Box, { key: model.id, flexDirection: 'row' },
          h(Text, { color: modelStatusColor(model.status) }, modelStatusIcon(model.status) + ' '),
          h(Text, { color: 'white', bold: true }, model.name.padEnd(26)),
          h(Text, { color: 'gray' }, model.provider.padEnd(14)),
          model.status === 'available'
            ? h(Text, { color: model.latency < 1000 ? 'green' : 'yellow' },
                latencyBar(model.latency) + ` ${model.latency}ms`.padStart(6))
            : h(Text, { color: 'red', dimColor: true }, 'offline'.padEnd(20)),
          model.status === 'available'
            ? h(Text, { color: 'cyan' }, `  ${model.tokensPerSec}t/s`)
            : null,
        )
      ),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, '[DEMO] Read-only preview'),
    ),
  );
};

// ── Main ModelsPage ──────────────────────────────────────────

const ModelsPage = ({ apiClient, height, onQuit, demoMode }: ModelsPageProps) => {
  const [detail, setDetail] = useState<DetailState>(null);

  const handleModelSelect = useCallback((modelId: string) => {
    setDetail({ type: 'model', id: modelId });
  }, []);

  const handleBack = useCallback(() => {
    setDetail(null);
  }, []);

  // Demo mode — always show demo view
  if (demoMode) return h(DemoModelsView, { height });

  // No API client — show empty state
  if (!apiClient) return h(EmptyModelsView, { height, message: 'No API client available.' });

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
  // onNavigate is a noop — spatial navigation is handled by App.ts via Ctrl+Arrow
  return h(Box, { flexDirection: 'column', flexGrow: 1, height },
    h(ModelsScreen, {
      apiClient,
      onNavigate: () => {},
      onModelSelect: handleModelSelect,
      onQuit,
    }),
  );
};

export { ModelsPage };
