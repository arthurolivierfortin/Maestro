/**
 * ModelsWidget — Model health + metrics + model list.
 *
 * Extracted from ModelsScreen. Compact inline version.
 * Interactive: j/k navigate, Enter opens model detail, P playground.
 */

import { createElement as h, useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  theme, icons,
  T, muted, primary,
  breathingDot,
  truncate,
} from '../../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useManagedInput } from '../../hooks/useManagedInput.ts';

interface ModelsWidgetProps {
  apiClient: any;
  focused: boolean;
  onModelSelect?: (id: string) => void;
}

const ModelsWidget = ({ apiClient, focused, onModelSelect }: ModelsWidgetProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: llmHealth } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMHealth().catch((): any => ({ error: true })), [apiClient]),
    focused ? 5000 : 0
  );
  const { data: models } = useApiData(
    useCallback((): Promise<any[]> => {
      if (!apiClient) return Promise.reject(new Error('No client'));
      return apiClient.listLLMModels();
    }, [apiClient]),
    focused ? 10000 : 0
  );
  const { data: llmStats } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMStats().catch((): null => null), [apiClient]),
    focused ? 5000 : 0
  );

  // Deduplicate models by modelId
  const modelList: any[] = (() => {
    const raw: any[] = Array.isArray(models) ? models : [];
    const seen = new Map<string, any>();
    for (const m of raw) {
      const id = m.modelId;
      if (!id) continue;
      const existing = seen.get(id);
      if (!existing) seen.set(id, m);
      else if (m.isAvailable && !existing.isAvailable) seen.set(id, m);
    }
    return Array.from(seen.values());
  })();

  const isHealthy = llmHealth && !llmHealth.error;
  const activeModel = llmHealth?.activeModel || '';
  const stats = llmStats as Record<string, any> | null;

  useEffect(() => {
    if (selectedIndex >= modelList.length && modelList.length > 0) {
      setSelectedIndex(Math.max(0, modelList.length - 1));
    }
  }, [modelList.length]);

  useManagedInput('widget', (input, key) => {
    if (input === 'j' || key.downArrow) setSelectedIndex(i => Math.min(modelList.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.return && modelList[selectedIndex] && onModelSelect) {
      onModelSelect(modelList[selectedIndex].modelId);
    }
  }, { isActive: focused });

  return h(Box, { flexDirection: 'column' },
    // Health summary
    h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 3 },
      h(Text, null,
        muted('Status: '),
        T(isHealthy ? theme.status.success : theme.status.error, isHealthy ? 'Online' : 'Offline'),
      ),
      activeModel
        ? h(Text, null, muted('Active: '), primary(String(activeModel)))
        : null,
    ),
    // Metrics row
    stats && !stats.error
      ? h(Box, { flexDirection: 'row', paddingLeft: 1, gap: 3 },
          h(Text, null, muted('Requests: '), primary(String(stats.totalRequests ?? 0))),
          h(Text, null, muted('Tokens: '), primary(String(stats.totalTokens ?? 0))),
          stats.latencyP50Ms != null
            ? h(Text, null, muted('p50: '), primary(`${Math.round(stats.latencyP50Ms)}ms`))
            : null,
          stats.errorRate != null
            ? h(Text, null, muted('Errors: '), h(Text, { color: (stats.totalErrors ?? 0) > 0 ? 'red' : 'green' }, `${(stats.errorRate * 100).toFixed(1)}%`))
            : null,
        )
      : null,
    h(Text, null, ''),
    // Model list
    ...modelList.map((model: any, i: number) => {
      const name = model.name || model.modelId || 'Unknown';
      const provider = model.category || '';
      const isActive = model.modelId === activeModel;
      const available = model.isAvailable === true;
      const isSelected = focused && i === selectedIndex;
      const selector = isSelected ? icons.arrow : ' ';
      const sIcon = isActive ? icons.done : (available ? icons.done : icons.failed);
      const sColor = isActive ? theme.status.success : (available ? theme.status.success : theme.status.error);

      return h(Box, { key: model.modelId || `m-${i}`, flexDirection: 'row', paddingLeft: 1 },
        h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
        h(Text, null, ' '),
        h(Text, { color: sColor }, sIcon),
        h(Text, null, ' '),
        h(Text, { color: isActive ? theme.status.success : (isSelected ? 'cyan' : 'white') },
          truncate(name, 28).padEnd(28)),
        h(Text, null, ' '),
        muted(truncate(provider, 16).padEnd(16)),
        isActive ? h(Text, { color: theme.status.success }, ' (active) ') : h(Text, null, '          '),
      );
    }),
    modelList.length === 0
      ? h(Box, { paddingLeft: 2 }, muted('No models found'))
      : null,
  );
};

export { ModelsWidget };
