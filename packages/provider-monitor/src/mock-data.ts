import type {
  StatisticsSnapshot,
  QueueStatistics,
  SwitchEvent,
  ModelResponse,
  PerformanceProfile,
} from './api-client.js';

export interface MockData {
  stats: StatisticsSnapshot;
  queue: QueueStatistics;
  switchingDecisions: SwitchEvent[];
  models: ModelResponse[];
  performanceProfiles: PerformanceProfile[];
  logs: string[];
}

export function getMockData(): MockData {
  const now = new Date().toISOString();

  const stats: StatisticsSnapshot = {
    totalRequests: 1247,
    latency: { p50: 820, p95: 2340, p99: 4100, average: 1050 },
    totalTokens: { promptTokens: 32100, completionTokens: 13100, totalTokens: 45200 },
    modelStats: [
      {
        modelId: 'deepseek-ai/deepseek-coder-1.3b-instruct',
        requestCount: 834,
        latency: { p50: 680, p95: 1800, p99: 3200, average: 920 },
        totalTokens: { promptTokens: 21000, completionTokens: 7400, totalTokens: 28400 },
        requestsPerMinute: 5.2,
        errorRate: 0.002,
      },
      {
        modelId: 'gpt-4o',
        requestCount: 312,
        latency: { p50: 1240, p95: 3100, p99: 5200, average: 1580 },
        totalTokens: { promptTokens: 8600, completionTokens: 3500, totalTokens: 12100 },
        requestsPerMinute: 2.1,
        errorRate: 0.003,
      },
      {
        modelId: 'llama-3-70b',
        requestCount: 101,
        latency: { p50: 950, p95: 2800, p99: 4600, average: 1200 },
        totalTokens: { promptTokens: 2500, completionTokens: 2200, totalTokens: 4700 },
        requestsPerMinute: 1.0,
        errorRate: 0.01,
      },
    ],
    queue: {
      currentDepth: 3,
      depthByModel: { 'gpt-4o': 2, 'deepseek-ai/deepseek-coder-1.3b-instruct': 1 },
      currentModel: 'deepseek-ai/deepseek-coder-1.3b-instruct',
      avgWaitTimeMs: 2340,
      totalEnqueued: 1260,
      totalProcessed: 1257,
    },
    switching: {
      totalSwitches: 42,
      switchesAvoided: 187,
      avgSwitchDuration: '00:00:14.200',
      recentDecisions: [],
    },
    timeWindows: [
      { windowName: '1m', windowSeconds: 60, requestCount: 12, requestsPerMinute: 12.0, latency: { p50: 780, p95: 2100, p99: 3800, average: 950 }, tokensTotal: 4200 },
      { windowName: '5m', windowSeconds: 300, requestCount: 58, requestsPerMinute: 11.6, latency: { p50: 850, p95: 2400, p99: 4200, average: 1020 }, tokensTotal: 18600 },
      { windowName: '15m', windowSeconds: 900, requestCount: 167, requestsPerMinute: 11.1, latency: { p50: 890, p95: 2500, p99: 4400, average: 1080 }, tokensTotal: 52100 },
    ],
    generatedAt: now,
  };

  const queue: QueueStatistics = {
    currentDepth: 3,
    depthByModel: { 'gpt-4o': 2, 'deepseek-ai/deepseek-coder-1.3b-instruct': 1 },
    currentModel: 'deepseek-ai/deepseek-coder-1.3b-instruct',
    avgWaitTimeMs: 2340,
    totalEnqueued: 1260,
    totalProcessed: 1257,
  };

  const fiveMinAgo = (min: number) => new Date(Date.now() - min * 60000).toISOString();

  const switchingDecisions: SwitchEvent[] = [
    { from: 'llama-3-70b', to: 'deepseek-ai/deepseek-coder-1.3b-instruct', decision: 'KeepCurrent', score: -12.3, reason: '5 req current vs 1 alt, switch cost exceeds benefit', duration: '00:00:00', timestamp: fiveMinAgo(8) },
    { from: 'deepseek-ai/deepseek-coder-1.3b-instruct', to: 'gpt-4o', decision: 'SwitchImmediate', score: 4.2, reason: '0 req current vs 3 gpt-4o pending', duration: '00:00:14.200', timestamp: fiveMinAgo(6) },
    { from: 'gpt-4o', to: 'gpt-4o', decision: 'KeepCurrent', score: -8.1, reason: '2 req current vs 1 alt, keep current', duration: '00:00:00', timestamp: fiveMinAgo(4) },
    { from: 'gpt-4o', to: 'llama-3-70b', decision: 'ForcedByStarvation', score: 1.7976931348623157e+308, reason: 'Request for llama-3-70b waited 32s (starvation)', duration: '00:00:12.800', timestamp: fiveMinAgo(2) },
    { from: 'llama-3-70b', to: 'llama-3-70b', decision: 'KeepCurrent', score: -3.4, reason: '1 req current, no better alt', duration: '00:00:00', timestamp: fiveMinAgo(1) },
    { from: 'llama-3-70b', to: 'deepseek-ai/deepseek-coder-1.3b-instruct', decision: 'SwitchImmediate', score: 6.8, reason: '0 req current vs 4 deepseek pending, benefit > cost', duration: '00:00:08.700', timestamp: fiveMinAgo(0.5) },
  ];

  const models: ModelResponse[] = [
    { id: 'gpt-4', name: 'gpt-4', provider: 'Azure', contextLength: 8192, maxOutputTokens: 4096, capabilities: ['chat', 'function_calling'], isAvailable: true },
    { id: 'gpt-4o', name: 'gpt-4o', provider: 'Azure', contextLength: 128000, maxOutputTokens: 4096, capabilities: ['chat', 'function_calling', 'vision'], isAvailable: true },
    { id: 'llama-3-70b', name: 'llama-3-70b', provider: 'AzureInference', contextLength: 8192, maxOutputTokens: 4096, capabilities: ['chat'], isAvailable: true },
    { id: 'mistral-large', name: 'mistral-large', provider: 'AzureInference', contextLength: 32768, maxOutputTokens: 4096, capabilities: ['chat', 'function_calling'], isAvailable: true },
    { id: 'phi-3-medium', name: 'phi-3-medium', provider: 'AzureInference', contextLength: 128000, maxOutputTokens: 4096, capabilities: ['chat'], isAvailable: true },
    { id: 'cohere-command-r-plus', name: 'cohere-command-r-plus', provider: 'AzureInference', contextLength: 128000, maxOutputTokens: 4096, capabilities: ['chat', 'function_calling'], isAvailable: true },
    { id: 'deepseek-ai/deepseek-coder-1.3b-instruct', name: 'deepseek-coder-1.3b', provider: 'Local', contextLength: 16384, maxOutputTokens: 4096, capabilities: ['chat', 'code'], isAvailable: true },
  ];

  const performanceProfiles: PerformanceProfile[] = [
    { modelId: 'deepseek-ai/deepseek-coder-1.3b-instruct', averageLoadTime: '00:00:03.350', averageResponseTime: '00:00:00.920', avgTokensPerRequest: 34, totalRequests: 834, errorRate: 0.002, lastUsed: fiveMinAgo(0.5) },
    { modelId: 'gpt-4o', averageLoadTime: '00:00:00.000', averageResponseTime: '00:00:01.580', avgTokensPerRequest: 39, totalRequests: 312, errorRate: 0.003, lastUsed: fiveMinAgo(4) },
    { modelId: 'llama-3-70b', averageLoadTime: '00:00:14.200', averageResponseTime: '00:00:01.200', avgTokensPerRequest: 47, totalRequests: 101, errorRate: 0.01, lastUsed: fiveMinAgo(1) },
  ];

  const logs: string[] = [
    '[20:45:12 INF] Starting LLM Provider API',
    '[20:45:12 INF] Kestrel configured to listen on 127.0.0.1:5000',
    '[20:45:12 INF] Registered LLM provider: Azure OpenAI (Azure)',
    '[20:45:12 INF] Registered LLM provider: Azure AI Inference (AzureInference)',
    '[20:45:12 INF] Registered LLM provider: Local LLM (Python) (Local)',
    '[20:45:12 INF] Statistics service initialized (persistence: True)',
    '[20:45:12 INF] Queue processor started (poll interval: 100ms)',
    '[20:45:16 INF] Starting Python server...',
    '[20:45:19 DBG] [Python] [ModelManager] Loading deepseek-ai/deepseek-coder-1.3b-instruct on cuda...',
    '[20:45:22 DBG] [Python] [ModelManager] deepseek-ai/deepseek-coder-1.3b-instruct loaded in 3.35s',
    '[20:45:22 INF] Python server started successfully at http://localhost:8000',
    '[20:45:22 INF] Now listening on: http://127.0.0.1:5000',
    '[20:45:22 INF] Application started. Press Ctrl+C to shut down.',
    '[20:45:24 INF] Model registry cache refreshed. 7 models from 3 providers',
    '[20:45:30 INF] Processing LLM request for model deepseek-ai/deepseek-coder-1.3b-instruct, conversation none',
    '[20:45:31 INF] HTTP POST /api/v1/llm/complete responded 200 in 1240.32 ms',
    '[20:45:35 INF] Processing LLM request for model gpt-4o, conversation conv-001',
    '[20:45:37 INF] HTTP POST /api/v1/llm/complete responded 200 in 1820.45 ms',
    '[20:45:40 WRN] Queue depth increasing: 3 pending requests',
    '[20:45:42 INF] ModelSwitchOptimizer: SwitchImmediate to gpt-4o (score: 4.2)',
    '[20:45:56 DBG] [Python] [ModelManager] Loading gpt-4o on cuda...',
    '[20:46:10 INF] Model switch completed: deepseek-coder -> gpt-4o in 14.2s',
    '[20:46:12 INF] HTTP POST /api/v1/llm/complete responded 200 in 980.12 ms',
    '[20:46:15 INF] HTTP POST /api/v1/llm/complete responded 200 in 1120.87 ms',
    '[20:46:18 INF] HTTP GET /api/v1/stats responded 200 in 0.27 ms',
    '[20:46:20 INF] Processing LLM request for model llama-3-70b, conversation conv-003',
    '[20:46:52 WRN] Request for llama-3-70b starving (waited 32s)',
    '[20:46:52 INF] ModelSwitchOptimizer: ForcedByStarvation to llama-3-70b',
    '[20:47:05 INF] Model switch completed: gpt-4o -> llama-3-70b in 12.8s',
    '[20:47:06 INF] HTTP POST /api/v1/llm/complete responded 200 in 1340.21 ms',
    '[20:47:10 DBG] Persisted statistics snapshot to data/statistics/metrics-2026-02-12.json',
    '[20:47:15 INF] Processing LLM request for model deepseek-ai/deepseek-coder-1.3b-instruct, conversation none',
    '[20:47:16 INF] ModelSwitchOptimizer: SwitchImmediate to deepseek-coder (score: 6.8)',
    '[20:47:25 INF] Model switch completed: llama-3-70b -> deepseek-coder in 8.7s',
    '[20:47:26 INF] HTTP POST /api/v1/llm/complete responded 200 in 680.45 ms',
    '[20:47:28 INF] HTTP GET /api/v1/stats responded 200 in 0.14 ms',
  ];

  return { stats, queue, switchingDecisions, models, performanceProfiles, logs };
}
