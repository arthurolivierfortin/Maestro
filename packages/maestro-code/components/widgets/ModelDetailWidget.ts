/**
 * ModelDetailWidget -- Model info summary with metrics.
 *
 * Compact inline version of ModelDetail.
 * Shows: status, name, provider, metrics (requests, tokens, latency, errors),
 * and availability.
 * Interactive: P opens playground.
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  progressBar, progressColor,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';

interface ModelDetailWidgetProps {
  apiClient: any;
  focused: boolean;
  modelId: string;
}

const ModelDetailWidget = ({ apiClient, focused, modelId }: ModelDetailWidgetProps) => {
  const { data: llmHealth } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMHealth().catch((): any => ({ error: true })), [apiClient]),
    focused ? 5000 : 0
  );
  const { data: models } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listLLMModels().catch((): any[] => []), [apiClient]),
    focused ? 10000 : 0
  );
  const { data: perf } = useApiData(
    useCallback((): Promise<any> => apiClient.getModelPerformance(modelId).catch((): null => null), [apiClient, modelId]),
    focused ? 10000 : 0
  );
  const { data: llmStats } = useApiData(
    useCallback((): Promise<any> => {
      if (apiClient.getLLMStats) return apiClient.getLLMStats().catch((): null => null);
      return Promise.resolve(null);
    }, [apiClient]),
    focused ? 5000 : 0
  );

  const modelList: any[] = Array.isArray(models) ? models : [];
  const model = modelList.find(m => m.modelId === modelId);
  const isHealthy = llmHealth && !llmHealth.error;
  const activeModel = llmHealth?.activeModel || '';
  const isActive = modelId === activeModel;

  if (!model) {
    return h(Box, { paddingLeft: 1 },
      muted(`Loading model ${modelId}...`),
    );
  }

  const name = (model.name || model.modelId || 'Unknown').padEnd(30);
  const provider = String(model.category || model.provider || '-').padEnd(16);
  const available = model.isAvailable === true;

  // Find model-specific stats from perModel array
  const stats = llmStats as Record<string, any> | null;
  const perModel = stats?.perModel as any[] | undefined;
  const modelStats = perModel?.find((m: any) => m.model === modelId || m.model === model.name);

  const totalRequests = modelStats?.requests ?? stats?.totalRequests ?? '-';
  const totalTokens = modelStats?.totalTokens ?? stats?.totalTokens ?? '-';
  const avgLatency = modelStats?.avgLatencyMs ?? stats?.avgLatencyMs ?? '-';
  const errorRate = stats?.errorRate != null ? `${(stats.errorRate * 100).toFixed(1)}%` : '-';

  // Performance fitness
  const bestFitness = perf?.bestFitness != null ? perf.bestFitness : null;
  const hasFitness = bestFitness !== null && bestFitness >= 0;
  const sessionCount = perf?.sessionCount ?? 0;

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    // Name + status
    h(Box, { flexDirection: 'row', gap: 2 },
      h(Text, { color: available ? theme.status.success : theme.status.error },
        available ? icons.done : icons.failed),
      primary(name),
      isActive ? h(Text, { color: theme.status.success }, '(active)'.padEnd(10)) : h(Text, null, '          '),
    ),
    h(Text, null, ''),

    // Provider + Status
    h(Box, { flexDirection: 'row' },
      muted('Provider: '.padEnd(12)),
      primary(provider),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Status:   '.padEnd(12)),
      T(available ? theme.status.success : theme.status.error,
        (available ? 'Available' : 'Offline').padEnd(12)),
    ),
    isActive
      ? h(Box, { flexDirection: 'row' },
          muted('Active:   '.padEnd(12)),
          T(theme.status.success, 'Yes'.padEnd(12)),
        )
      : null,

    h(Text, null, ''),

    // Metrics section
    h(Text, { color: 'cyan', bold: true }, 'METRICS'),
    h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 3 },
      h(Text, null, muted('Requests: '), primary(String(totalRequests).padEnd(8))),
      h(Text, null, muted('Tokens: '), primary(String(totalTokens).padEnd(10))),
    ),
    h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 3 },
      h(Text, null, muted('Latency:  '), primary(
        (avgLatency !== '-' ? `${Math.round(Number(avgLatency))}ms` : '-').padEnd(8))),
      h(Text, null, muted('Errors: '),
        h(Text, { color: errorRate !== '-' && parseFloat(errorRate) > 0 ? 'red' : 'green' },
          errorRate.padEnd(8))),
    ),

    // Performance section
    hasFitness
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          h(Text, { color: 'cyan', bold: true }, 'PERFORMANCE'),
          h(Box, { flexDirection: 'row', paddingLeft: 1 },
            muted('Fitness:  '),
            T(progressColor(bestFitness * 100), progressBar(bestFitness * 100, 12)),
            h(Text, null, ' '),
            T(progressColor(bestFitness * 100), `${Math.round(bestFitness * 100)}%`.padEnd(5)),
          ),
          h(Box, { flexDirection: 'row', paddingLeft: 1 },
            muted('Sessions: '),
            primary(String(sessionCount).padEnd(8)),
          ),
        )
      : null,
  );
};

export { ModelDetailWidget };
