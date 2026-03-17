/**
 * LLM-related types — the API contract for LLM data.
 */

export interface LLMHealth {
  status: string;
  model: string;
  backend?: string;
  device?: string;
  gpuMemory?: string;
}

export interface LLMModel {
  modelId: string;
  name: string;
  description?: string;
  category?: string;
  size?: string;
  parametersB?: number;
  contextLength?: number;
  capabilities?: string[];
  recommended?: boolean;
  isLocal?: boolean;
  isAvailable?: boolean;
  inputTokenPricePerMillion?: number | null;
  outputTokenPricePerMillion?: number | null;
}

export interface LLMStatus {
  activeModel: string;
  maxTokens: number;
  temperature: number;
  totalRequests: number;
  avgLatency: number;
  peakLatency: number;
  errorCount: number;
  tokensIn: number;
  tokensOut: number;
  throughput: number;
  uptime: string;
  load: string;
}

export interface TaskFitnessEntry {
  task: string;
  fitness: number;
}

export interface ModelPerformance {
  bestFitness: number | null;
  sessionCount: number;
  taskFitness: TaskFitnessEntry[];
  fitnessHistory: number[];
}
