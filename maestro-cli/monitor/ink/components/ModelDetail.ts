// @ts-nocheck
/**
 * ModelDetail — Model detail page.
 *
 * Shows model health, usage stats, and performance metrics.
 * 3 panels: HEALTH, USAGE, PERFORMANCE.
 *
 * Props:
 *   modelId    string — model ID/name
 *   apiClient  API client instance
 *   onExit     () => void — back to previous page
 *   onQuit     () => void — quit app
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary, bold,
  statusColor, statusIcon,
  progressBar, progressColor,
  sparkline,
} from '../theme.ts';
import { useApiData } from '../hooks/useApiData.ts';
import { useActionKeyboard } from '../hooks/useKeyboard.ts';
import { Panel } from './Panel.ts';
import { StatusBar } from './StatusBar.ts';

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
      muted('Backend:    '),
      primary(String(backend)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Device:     '),
      primary(String(device)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('GPU Memory: '),
      primary(String(gpuMemory)),
    ),
    model?.size
      ? h(Box, { flexDirection: 'row' },
          muted('Model Size: '),
          primary(String(model.size)),
        )
      : null,
    h(Box, { flexDirection: 'row' },
      muted('Uptime:     '),
      primary(String(uptime)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Load:       '),
      T(loadColor, String(load)),
    ),
  );
};

// ── Usage panel content ──────────────────────────────────────

const UsageContent = ({ llmStatus }) => {
  if (!llmStatus) return muted('(no usage data)');

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Requests:   '),
      primary(String(llmStatus.totalRequests ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Avg latency:'),
      h(Text, null, ' '),
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
      muted('Max tokens: '),
      primary(String(llmStatus.maxTokens ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Temperature:'),
      h(Text, null, ' '),
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
    // Best fitness
    h(Box, { flexDirection: 'row' },
      muted('Fitness:    '),
      T(fitCol, `${fitPct}%`, { bold: true }),
    ),
    h(Box, { flexDirection: 'row' },
      muted('            '),
      T(fitCol, progressBar(fitPct, 14)),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted('Sessions:   '),
      primary(String(perf.sessionCount)),
    ),

    // Task fitness breakdown
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

    // Sparkline history
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

// ── ModelDetail component ────────────────────────────────────

const ModelDetail = ({ modelId, apiClient, onExit, onQuit, onNavigate }) => {
  // Fetch LLM health
  const {
    data: llmHealth,
    connectionStatus,
    latency,
    lastRefresh,
  } = useApiData(
    useCallback(() => apiClient.getLLMHealth().catch(() => ({ error: true })), [apiClient]),
    5000
  );

  // Fetch LLM status
  const { data: llmStatus } = useApiData(
    useCallback(() => apiClient.getLLMStatus().catch(() => null), [apiClient]),
    10000
  );

  // Fetch models list to get this model's detail
  const { data: models } = useApiData(
    useCallback(() => apiClient.listLLMModels().catch(() => []), [apiClient]),
    10000
  );

  // Fetch model performance
  const { data: perf } = useApiData(
    useCallback(() => apiClient.getModelPerformance(modelId).catch(() => null), [apiClient, modelId]),
    10000
  );

  const modelList = Array.isArray(models) ? models : [];
  const modelInfo = modelList.find(m => {
    const name = typeof m === 'string' ? m : (m.id || m.name || m.model_id || '');
    return name === modelId;
  });

  // Check if this model is the active one
  const activeModel = llmHealth?.activeModel || llmHealth?.model || llmHealth?.model_id || '';
  const isActive = activeModel === modelId;
  const statusLabel = isActive ? 'active' : 'available';
  const statusCol = isActive ? theme.status.success : theme.status.pending;

  // Keyboard (Schema A: detail context)
  useActionKeyboard({
    'back': onExit,
    'quit': onQuit,
    'page.home': () => { if (onNavigate) onNavigate('home'); },
    'page.spaces': () => { if (onNavigate) onNavigate('spaces'); },
    'page.foundry': () => { if (onNavigate) onNavigate('foundry'); },
    'page.catalog': () => { if (onNavigate) onNavigate('catalog'); },
    'page.models': () => { if (onNavigate) onNavigate('models'); },
  }, 'detail');

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: 'MODEL', width: '100%' },
      h(Box, { flexDirection: 'column', paddingLeft: 1 },
        h(Box, { flexDirection: 'row', gap: 2 },
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
      // Health panel (left, 33%)
      h(Panel, { title: 'HEALTH', width: '33%' },
        h(HealthContent, {
          health: llmHealth,
          llmStatus,
          model: typeof modelInfo === 'object' ? modelInfo : null,
        }),
      ),

      // Usage panel (center, 33%)
      h(Panel, { title: 'USAGE', width: '34%' },
        h(UsageContent, { llmStatus }),
      ),

      // Performance panel (right, 33%)
      h(Panel, { title: 'PERFORMANCE', flexGrow: 1 },
        h(PerformanceContent, { perf }),
      ),
    ),

    // Status bar
    h(StatusBar, {
      connectionStatus,
      latency,
      lastRefresh,
      currentPage: 'models',
    }),
  );
};

export { ModelDetail };
