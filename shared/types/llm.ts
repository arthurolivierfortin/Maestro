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
  id: string;
  name: string;
  size?: string;
  loaded: boolean;
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
