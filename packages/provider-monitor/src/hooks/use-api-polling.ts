import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ApiClient,
  type StatisticsSnapshot,
  type QueueStatistics,
  type SwitchEvent,
  type ModelResponse,
  type HealthResponse,
  type PerformanceProfile,
} from '../api-client.js';

interface ApiPollingState {
  stats: StatisticsSnapshot | null;
  queue: QueueStatistics | null;
  switchingDecisions: SwitchEvent[];
  models: ModelResponse[];
  health: HealthResponse | null;
  performanceProfiles: PerformanceProfile[];
  connected: boolean;
  lastUpdated: string | null;
  refresh: () => void;
}

interface PollingData {
  stats: StatisticsSnapshot | null;
  queue: QueueStatistics | null;
  switchingDecisions: SwitchEvent[];
  models: ModelResponse[];
  health: HealthResponse | null;
  performanceProfiles: PerformanceProfile[];
  connected: boolean;
  lastUpdated: string | null;
}

/** Polls the API at regular intervals for dashboard data */
export function useApiPolling(baseUrl = 'http://localhost:5010', intervalMs = 2000): ApiPollingState {
  const clientRef = useRef(new ApiClient(baseUrl));
  const [state, setState] = useState<PollingData>({
    stats: null,
    queue: null,
    switchingDecisions: [],
    models: [],
    health: null,
    performanceProfiles: [],
    connected: false,
    lastUpdated: null,
  });

  const fetchAll = useCallback(async () => {
    const client = clientRef.current;
    const [statsRes, queueRes, decisionsRes, modelsRes, healthRes, profilesRes] = await Promise.all([
      client.getStats(),
      client.getQueueStats(),
      client.getSwitchingDecisions(),
      client.getModels(),
      client.getHealth(),
      client.getPerformanceProfiles(),
    ]);

    const isConnected = statsRes !== null || healthRes !== null;

    // Single setState instead of 8 separate calls — one re-render per poll cycle
    setState(prev => ({
      stats: statsRes ?? prev.stats,
      queue: queueRes ?? prev.queue,
      switchingDecisions: decisionsRes ?? prev.switchingDecisions,
      models: modelsRes ?? prev.models,
      health: healthRes ?? prev.health,
      performanceProfiles: profilesRes ?? prev.performanceProfiles,
      connected: isConnected,
      lastUpdated: new Date().toLocaleTimeString(),
    }));
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, intervalMs);
    return () => clearInterval(timer);
  }, [fetchAll, intervalMs]);

  return { ...state, refresh: fetchAll };
}
