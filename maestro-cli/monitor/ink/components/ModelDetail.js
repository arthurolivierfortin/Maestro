/**
 * ModelDetail — Model detail page.
 *
 * Shows model health info, usage stats, and configuration.
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
} from '../theme.js';
import { useApiData } from '../hooks/useApiData.js';
import { useKeyboard } from '../hooks/useKeyboard.js';
import { Panel } from './Panel.js';
import { StatusBar } from './StatusBar.js';

// ── Health panel content ─────────────────────────────────────

const HealthContent = ({ health, model }) => {
  const isHealthy = health && !health.error;
  const healthColor = isHealthy ? theme.status.success : theme.status.error;
  const healthIcon = isHealthy ? icons.done : icons.failed;

  const backend = health?.backend || health?.framework || '-';
  const device = health?.device || '-';
  const gpuMemory = health?.gpuMemory || '-';

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
  );
};

// ── Usage panel content ──────────────────────────────────────

const UsageContent = ({ llmStatus }) => {
  if (!llmStatus) return muted('(no usage data)');

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row' },
      muted('Total requests: '),
      primary(String(llmStatus.totalRequests ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Avg latency:    '),
      primary(llmStatus.avgLatency != null ? `${llmStatus.avgLatency}s` : '-'),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Max tokens:     '),
      primary(String(llmStatus.maxTokens ?? llmStatus.max_tokens ?? '-')),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Temperature:    '),
      primary(String(llmStatus.temperature ?? '-')),
    ),
  );
};

// ── ModelDetail component ────────────────────────────────────

const ModelDetail = ({ modelId, apiClient, onExit, onQuit }) => {
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

  // Keyboard
  useKeyboard({
    escape: onExit,
    q: onQuit,
  });

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

    // Content: Health + Usage side by side
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Health panel (left, 50%)
      h(Panel, { title: 'HEALTH', width: '50%' },
        h(HealthContent, { health: llmHealth, model: typeof modelInfo === 'object' ? modelInfo : null }),
      ),

      // Usage panel (right, 50%)
      h(Panel, { title: 'USAGE', flexGrow: 1 },
        h(UsageContent, { llmStatus }),
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
