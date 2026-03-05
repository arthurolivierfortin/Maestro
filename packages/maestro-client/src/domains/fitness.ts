import type { HttpTransport } from '../http.js';
import type {
  FitnessScore,
  FitnessConfig,
  CalculateFitnessRequest,
  ModelFitnessRanking,
  AggregateFitnessStats,
} from '../types.js';

export function fitnessDomain(http: HttpTransport) {
  return {
    calculate: (request: CalculateFitnessRequest) =>
      http.post<FitnessScore>('/api/fitness/calculate', request),

    history: (modelId: string, taskType?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (taskType) params.set('taskType', taskType);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return http.get<FitnessScore[]>(`/api/fitness/history/${encodeURIComponent(modelId)}${qs ? `?${qs}` : ''}`);
    },

    stats: (modelId: string, taskType?: string) => {
      const qs = taskType ? `?taskType=${encodeURIComponent(taskType)}` : '';
      return http.get<AggregateFitnessStats>(`/api/fitness/stats/${encodeURIComponent(modelId)}${qs}`);
    },

    config: () => http.get<FitnessConfig>('/api/fitness/config'),

    updateConfig: (updates: Partial<FitnessConfig>) =>
      http.put<FitnessConfig>('/api/fitness/config', updates),

    resetConfig: () => http.post<FitnessConfig>('/api/fitness/config/reset', {}),

    leaderboard: (taskType?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (taskType) params.set('taskType', taskType);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return http.get<ModelFitnessRanking[]>(`/api/fitness/leaderboard${qs ? `?${qs}` : ''}`);
    },
  };
}
