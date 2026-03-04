import type { HttpTransport } from '../http.js';
import type { LLMHealthResponse, LLMModel, LLMProviderStats, LLMQueueStats, LLMPerformanceProfile, LLMSwitchEvent } from '../types.js';

export function llmDomain(http: HttpTransport) {
  return {
    health: () => http.get<LLMHealthResponse>('/api/provider/health'),
    status: () => http.get('/api/provider/status'),
    capabilities: () => http.get('/api/provider/capabilities'),
    activeProvider: () => http.get('/api/provider/active'),

    models: async (category?: string) => {
      const q = category ? `?category=${encodeURIComponent(category)}` : '';
      const res = await http.get<{ models?: LLMModel[] } | LLMModel[]>(`/api/provider/models${q}`);
      return Array.isArray(res) ? res : (res?.models ?? []);
    },

    localModels: async () => {
      const res = await http.get<{ models?: LLMModel[] } | LLMModel[]>('/api/provider/models/local');
      return Array.isArray(res) ? res : (res?.models ?? []);
    },

    registryModels: async (category?: string) => {
      const q = category ? `?category=${encodeURIComponent(category)}` : '';
      const res = await http.get<{ models?: LLMModel[] } | LLMModel[]>(`/api/provider/models/registry${q}`);
      return Array.isArray(res) ? res : (res?.models ?? []);
    },

    switchModel: (modelId: string, use8bit = false) =>
      http.post('/api/provider/models/switch', { modelId, use8bit }),

    loadModel: (modelId: string, use8bit = false) =>
      http.post('/api/provider/models/load', { modelId, use8bit }),

    // Stats / metrics
    stats: () => http.get<LLMProviderStats>('/api/provider/stats'),
    queueStats: () => http.get<LLMQueueStats>('/api/provider/stats/queue'),
    performanceProfiles: () => http.get<LLMPerformanceProfile[]>('/api/provider/stats/performance'),
    switchDecisions: () => http.get<LLMSwitchEvent[]>('/api/provider/stats/switching'),

    azureConfig: () => http.get('/api/provider/azure'),
    saveAzureConfig: (config: Record<string, unknown>) => http.put('/api/provider/azure', config),
    testAzureConnection: (config: Record<string, unknown> = {}) =>
      http.post('/api/provider/azure/test', config),

    complete: (messages: Array<{ role: string; content: string }>, options: { model?: string; temperature?: number; maxTokens?: number } = {}) =>
      http.post('/api/chat/completions', { messages, ...options }),
  };
}
