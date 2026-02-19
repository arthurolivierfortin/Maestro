/** API client for the LLM-Provider .NET backend */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = 'http://localhost:5010', timeout = 5000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  async getStats(): Promise<StatisticsSnapshot | null> {
    return this.get('/api/v1/stats');
  }

  async getHealth(): Promise<HealthResponse | null> {
    return this.get('/api/v1/health');
  }

  async getModels(): Promise<ModelResponse[] | null> {
    // API returns { models: [...] }, not a bare array
    const resp = await this.get<{ models: ModelResponse[] }>('/api/v1/models');
    return resp?.models ?? null;
  }

  async getQueueStats(): Promise<QueueStatistics | null> {
    return this.get('/api/v1/stats/queue');
  }

  async getSwitchingDecisions(): Promise<SwitchEvent[] | null> {
    // API may return { value: [...] } envelope or a bare array
    const resp = await this.get<SwitchEvent[] | { value: SwitchEvent[] }>('/api/v1/stats/switching/decisions');
    if (!resp) return null;
    if (Array.isArray(resp)) return resp;
    if ('value' in resp && Array.isArray(resp.value)) return resp.value;
    return null;
  }

  async getPerformanceProfiles(): Promise<PerformanceProfile[] | null> {
    // API may return { value: [...] } envelope or a bare array
    const resp = await this.get<PerformanceProfile[] | { value: PerformanceProfile[] }>('/api/v1/stats/performance');
    if (!resp) return null;
    if (Array.isArray(resp)) return resp;
    if ('value' in resp && Array.isArray(resp.value)) return resp.value;
    return null;
  }

  async getSwitchingStats(): Promise<SwitchingStatistics | null> {
    return this.get('/api/v1/stats/switching');
  }

  async switchModel(modelId: string): Promise<void> {
    // Trigger a switch via a request to the model
    const response = await this.fetch('/api/v1/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ping', model: modelId }),
    });
    if (!response.ok) throw new Error(`Switch failed: ${response.status}`);
  }

  async isConnected(): Promise<boolean> {
    try {
      const resp = await this.fetch('/api/v1/health/live');
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      const resp = await this.fetch(path);
      if (!resp.ok) return null;
      return await resp.json() as T;
    } catch {
      return null;
    }
  }

  private fetch(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    return globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  }
}

// Type definitions matching the .NET DTOs
export interface StatisticsSnapshot {
  totalRequests: number;
  latency: LatencyPercentiles;
  totalTokens: TokenUsage;
  modelStats: ModelStatistic[];
  queue: QueueStatistics;
  switching: SwitchingStatistics;
  timeWindows: TimeWindowMetrics[];
  generatedAt: string;
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  average: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelStatistic {
  modelId: string;
  requestCount: number;
  latency: LatencyPercentiles;
  totalTokens: TokenUsage;
  requestsPerMinute: number;
  errorRate: number;
}

export interface QueueStatistics {
  currentDepth: number;
  depthByModel: Record<string, number>;
  currentModel: string | null;
  avgWaitTimeMs: number;
  totalEnqueued: number;
  totalProcessed: number;
}

export interface SwitchEvent {
  from: string;
  to: string;
  decision: string;
  score: number;
  reason: string;
  duration: string;
  timestamp: string;
}

export interface SwitchingStatistics {
  totalSwitches: number;
  switchesAvoided: number;
  avgSwitchDuration: string;
  recentDecisions: SwitchEvent[];
}

export interface TimeWindowMetrics {
  windowName: string;
  windowSeconds: number;
  requestCount: number;
  requestsPerMinute: number;
  latency: LatencyPercentiles;
  tokensTotal: number;
}

export interface PerformanceProfile {
  modelId: string;
  averageLoadTime: string;
  averageResponseTime: string;
  avgTokensPerRequest: number;
  totalRequests: number;
  errorRate: number;
  lastUsed: string;
}

export interface ModelResponse {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  maxOutputTokens: number;
  capabilities: string[];
  isAvailable: boolean;
}

export interface HealthResponse {
  status: string;
  timestamp?: string;
  providers: Record<string, ProviderHealth>;
}

export interface ProviderHealth {
  name: string;
  isAvailable: boolean;
}
