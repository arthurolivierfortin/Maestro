/**
 * useModelList — Shared hook for fetching and processing LLM model lists.
 *
 * Pure React hook. Works in both TUI and Frontend.
 */

import { useCallback, useMemo } from 'react';
import { usePolling } from './usePolling.ts';
import {
  normalizeModelEntry,
  isActiveModel,
  type ModelEntry,
} from '../transforms/model.ts';
import { extractActiveModel, type LLMHealthResponse } from '../transforms/health.ts';

export interface NormalizedModel {
  id: string;
  name: string;
  isActive: boolean;
  raw: string | ModelEntry;
}

export interface ModelListState {
  models: NormalizedModel[];
  activeModelName: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches and normalizes the LLM model list.
 *
 * @param fetchModels - Async function returning model array
 * @param fetchHealth - Async function returning LLM health (for active model)
 * @param interval - Poll interval (default 10000ms)
 */
export function useModelList(
  fetchModels: () => Promise<(string | ModelEntry)[]>,
  fetchHealth: () => Promise<LLMHealthResponse>,
  interval = 10000
): ModelListState {
  const { data: rawModels, refresh: refreshModels } = usePolling(
    useCallback(() => fetchModels().catch(() => []), [fetchModels]),
    interval
  );

  const { data: health, refresh: refreshHealth } = usePolling(
    useCallback(() => fetchHealth().catch(() => null as unknown as LLMHealthResponse), [fetchHealth]),
    interval
  );

  const activeModelName = extractActiveModel(health);
  const modelList = rawModels || [];

  const models: NormalizedModel[] = useMemo(() =>
    modelList.map(m => ({
      ...normalizeModelEntry(m),
      isActive: isActiveModel(m, activeModelName),
      raw: m,
    })),
    [modelList, activeModelName]
  );

  return {
    models,
    activeModelName,
    refresh: async () => { await refreshModels(); await refreshHealth(); },
  };
}
