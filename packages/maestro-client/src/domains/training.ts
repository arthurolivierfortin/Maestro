import type { HttpTransport } from '../http.js';
import type { TrainingConfig, TrainingRunFilter, TrainingRunRequest } from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function trainingDomain(http: HttpTransport) {
  return {
    // Configurations
    listConfigs: () => http.get<TrainingConfig[]>('/api/training/configurations'),
    getConfig: (id: string) => http.get<TrainingConfig>(`/api/training/configurations/${id}`),
    createConfig: (config: Record<string, unknown>) =>
      http.post<TrainingConfig>('/api/training/configurations', config),
    updateConfig: (id: string, updates: Record<string, unknown>) =>
      http.put<TrainingConfig>(`/api/training/configurations/${id}`, updates),
    deleteConfig: (id: string) => http.del(`/api/training/configurations/${id}`),

    // Runs
    listRuns: (filter: TrainingRunFilter = {}) =>
      http.get(`/api/training/runs${buildQuery(filter as Record<string, string | number | undefined>)}`),
    getRun: (id: string) => http.get(`/api/training/runs/${id}`),
    startRun: (request: TrainingRunRequest) =>
      http.post(`/api/training/configurations/${request.configurationId}/runs`, request),
    pauseRun: (id: string) => http.post(`/api/training/runs/${id}/pause`),
    resumeRun: (id: string) => http.post(`/api/training/runs/${id}/resume`),
    cancelRun: (id: string) => http.post(`/api/training/runs/${id}/cancel`),
  };
}
