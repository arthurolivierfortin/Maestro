// @ts-nocheck
/**
 * ModelDetailScreen — Model detail page for maestro-code.
 *
 * Shows model health, usage stats, and performance metrics.
 * 3 panels: HEALTH, USAGE, PERFORMANCE.
 *
 * Adapted from maestro-monitor's ModelDetail — uses @maestro/tui directly,
 * no StatusBar (App.ts provides it), no monitor-specific page navigation.
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Panel } from '@maestro/tui/components';
import { useApiData, useActionKeyboard } from '@maestro/tui/hooks';
import {
  inkTheme as theme, icons,
  T, muted, primary, bold,
} from '@maestro/tui/theme';
import {
  statusColor, statusIcon,
  progressBar, progressColor,
  sparkline,
} from '@maestro/tui/utils';

// ── Health panel content ─────────────────────────────────────

const HealthContent = ({ health, llmStatus, model }) => {
  const isHealthy = health && !health.error;
  const healthColor = isHealthy ? theme.status.success : theme.status.error;
  const healthIcon = isHealthy ? icons.done : icons.failed;

  const backend = health?.backend || health?.framework || '-';
  const device = health?.device || '-';
  const gpuMemory = health?.gpuMemory || '-';
  const uptime = llmStatus?.uptime || '-';
  const load = llmStatus?.load || '-';
  const loadColor = load === 'idle' ? theme.status.success
    : load === 'high' ? theme.status.error
    : load === 'medium' ? theme.status.warning
    : theme.status.pending;

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Status:     '),
      h(Text, { color: healthColor }, healthIcon),
      h(Text, null, ' '),
      T(healthColor, isHealthy ? 'Online' : 'Offline'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Backend:    '), primary(String(backend)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Device:     '), primary(String(device)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('GPU Memory: '), primary(String(gpuMemory)),
    ),
    model?.size
      ? h(Box, { flexDirection: 'row' },
          muted('Model Size: '), primary(String(model.size)),
        )
      : null,
    h(Box, { flexDirection: 'row' },
      muted('Uptime:     '), primary(String(uptime)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Load:       '), T(loadColor, String(load)),
    ),
  );
};

// ── Usage panel content ──────────────────────────────────────

const UsageContent = ({ llmStatus }) => {
  if (!llmStatus) return muted('(no usage data)');

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Requests:   '), primary(String(llmStatus.totalRequests ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Avg latency:'), h(Text, null, ' '),
      primary(llmStatus.avgLatency != null ? `${llmStatus.avgLatency}s` : '-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Peak:       '),
      llmStatus.peakLatency != null
        ? T(llmStatus.peakLatency > 3 ? theme.status.warning : theme.status.success,
            `${llmStatus.peakLatency}s`)
        : primary('-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Errors:     '),
      llmStatus.errorCount > 0
        ? T(theme.status.error, String(llmStatus.errorCount))
        : T(theme.status.success, String(llmStatus.errorCount ?? 0)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Max tokens: '), primary(String(llmStatus.maxTokens ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Temperature:'), h(Text, null, ' '),
      primary(String(llmStatus.temperature ?? '-')),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted('Tokens in:  '),
      primary(llmStatus.tokensIn != null ? `${(llmStatus.tokensIn / 1000).toFixed(1)}k` : '-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Tokens out: '),
      primary(llmStatus.tokensOut != null ? `${(llmStatus.tokensOut / 1000).toFixed(1)}k` : '-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Throughput: '),
      primary(llmStatus.throughput != null ? `${llmStatus.throughput} t/s` : '-'),
    ),
  );
};

// ── Performance panel content ────────────────────────────────

const PerformanceContent = ({ perf }) => {
  if (!perf || perf.bestFitness == null) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      muted('(no performance data)'),
      h(Text, null, ''),
      muted('Run a training session to'),
      muted('generate fitness metrics.'),
    );
  }

  const fitPct = Math.round(perf.bestFitness * 100);
  const fitCol = progressColor(fitPct);

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Fitness:    '), T(fitCol, `${fitPct}%`, { bold: true }),
    ),
    h(Box, { flexDirection: 'row' },
      muted('            '), T(fitCol, progressBar(fitPct, 14)),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted('Sessions:   '), primary(String(perf.sessionCount)),
    ),

    perf.taskFitness && perf.taskFitness.length > 0
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          muted('Tasks:'),
          ...perf.taskFitness.map((tf, i) => {
            const pct = Math.round(tf.fitness * 100);
            return h(Box, { key: `tf-${i}`, flexDirection: 'row', paddingLeft: 1 },
              muted(`${tf.task.length > 12 ? tf.task.substring(0, 12) : tf.task.padEnd(12)} `),
              T(progressColor(pct), `${pct}%`),
            );
          }),
        )
      : null,

    perf.fitnessHistory && perf.fitnessHistory.length > 1
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          muted('History:'),
          h(Box, { flexDirection: 'row', paddingLeft: 1 },
            T(fitCol, sparkline(perf.fitnessHistory.map(v => v * 100), 14)),
          ),
        )
      : null,
  );
};

// ── ModelDetailScreen component ──────────────────────────────

interface ModelDetailScreenProps {
  modelId: string;
  apiClient: any;
  onBack: () => void;
  onQuit: () => void;
  height: number;
}

const ModelDetailScreen = ({ modelId, apiClient, onBack, onQuit, height }: ModelDetailScreenProps) => {
  const { data: llmHealth } = useApiData(
    useCallback(() =>
      apiClient?.getLLMHealth?.() ||
      apiClient?._fetch?.('GET', '/api/provider/health').catch(() => ({ error: true })),
      [apiClient]),
    5000
  );

  const { data: llmStatus } = useApiData(
    useCallback(() =>
      apiClient?.getLLMStatus?.() ||
      apiClient?._fetch?.('GET', '/api/provider/status').catch(() => null),
      [apiClient]),
    10000
  );

  const { data: models } = useApiData(
    useCallback(() =>
      apiClient?.listLLMModels?.() ||
      apiClient?._fetch?.('GET', '/api/provider/models').catch(() => []),
      [apiClient]),
    10000
  );

  const { data: perf } = useApiData(
    useCallback(() =>
      apiClient?.getModelPerformance?.(modelId) ||
      apiClient?._fetch?.('GET', `/api/provider/models/${modelId}/performance`).catch(() => null),
      [apiClient, modelId]),
    10000
  );

  const modelList = Array.isArray(models) ? models : [];
  const modelInfo = modelList.find(m => {
    const name = typeof m === 'string' ? m : (m.id || m.name || m.model_id || '');
    return name === modelId;
  });

  const activeModel = llmHealth?.activeModel || llmHealth?.model || llmHealth?.model_id || '';
  const isActive = activeModel === modelId;
  const statusLabel = isActive ? 'active' : 'available';
  const statusCol = isActive ? theme.status.success : theme.status.pending;

  useActionKeyboard({
    'back': onBack,
    'quit': onQuit,
  }, 'detail');

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'MODEL', width: '100%' },
      h(Box, { flexDirection: 'column', paddingLeft: 1 },
        h(Box, { flexDirection: 'row' },
          bold(modelId),
          h(Text, null, '  '),
          T(statusCol, statusIcon(isActive ? 'done' : 'pending')),
          h(Text, null, ' '),
          T(statusCol, statusLabel),
        ),
        modelInfo
          ? h(Box, { flexDirection: 'row' },
              muted('Size: '),
              primary(String(typeof modelInfo === 'object' ? modelInfo.size || '-' : '-')),
              h(Text, null, '   '),
              muted('Backend: '),
              primary(String(llmHealth?.backend || '-')),
              h(Text, null, '   '),
              muted('Device: '),
              primary(String(llmHealth?.device || '-')),
            )
          : null,
      ),
    ),

    // Content: Health + Usage + Performance
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      h(Panel, { title: 'HEALTH', width: '33%' },
        h(HealthContent, {
          health: llmHealth,
          llmStatus,
          model: typeof modelInfo === 'object' ? modelInfo : null,
        }),
      ),
      h(Panel, { title: 'USAGE', width: '34%' },
        h(UsageContent, { llmStatus }),
      ),
      h(Panel, { title: 'PERFORMANCE', flexGrow: 1 },
        h(PerformanceContent, { perf }),
      ),
    ),
  );
};

export { ModelDetailScreen };
