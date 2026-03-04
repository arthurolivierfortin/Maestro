/**
 * useHealthMonitor — Shared hook for monitoring backend + LLM health.
 *
 * Pure React hook. Works in both TUI and Frontend.
 * Provides normalized health status for both services.
 */

import { useCallback } from 'react';
import { usePolling } from './usePolling.ts';
import {
  toServiceHealth,
  toLLMServiceHealth,
  extractActiveModel,
  extractMaxTokens,
  extractDevice,
  extractBackend,
  type ServiceHealth,
  type LLMHealthResponse,
} from '../transforms/health.ts';

export interface HealthMonitorState {
  backend: ServiceHealth;
  llm: ServiceHealth;
  activeModel: string | null;
  device: string;
  backendFramework: string;
  maxTokens: number | null;
  temperature: number | null;
  vramUsed: number | null;
  vramTotal: number | null;
  connectionStatus: 'connecting' | 'connected' | 'error';
  latency: number;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
}

interface FetchFns {
  getHealth: () => Promise<unknown>;
  getLLMHealth: () => Promise<unknown>;
}

/**
 * Monitors backend and LLM Provider health.
 *
 * @param fetchFns - Object with getHealth() and getLLMHealth() functions
 * @param backendInterval - Backend poll interval (default 5000ms)
 * @param llmInterval - LLM poll interval (default 10000ms)
 */
export function useHealthMonitor(
  fetchFns: FetchFns,
  backendInterval = 5000,
  llmInterval = 10000
): HealthMonitorState {
  const {
    data: healthData,
    connectionStatus,
    latency,
    lastRefresh,
    refresh: refreshHealth,
  } = usePolling(
    useCallback(() => fetchFns.getHealth(), [fetchFns]),
    backendInterval
  );

  const {
    data: llmData,
    refresh: refreshLLM,
  } = usePolling(
    useCallback((): Promise<any> => fetchFns.getLLMHealth().catch((): null => null), [fetchFns]),
    llmInterval
  );

  const health = healthData as Record<string, unknown> | null;
  const llmHealth = llmData as LLMHealthResponse | null;

  const backend = toServiceHealth('Backend API', health, latency);
  const llm = toLLMServiceHealth(llmHealth);

  return {
    backend,
    llm,
    activeModel: extractActiveModel(llmHealth),
    device: extractDevice(llmHealth),
    backendFramework: extractBackend(llmHealth),
    maxTokens: extractMaxTokens(llmHealth),
    temperature: llmHealth?.temperature ?? null,
    vramUsed: llmHealth?.vramUsed ?? null,
    vramTotal: llmHealth?.vramTotal ?? null,
    connectionStatus,
    latency,
    lastRefresh,
    refresh: async () => { await refreshHealth(); await refreshLLM(); },
  };
}
