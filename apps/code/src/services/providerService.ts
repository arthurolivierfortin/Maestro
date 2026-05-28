import { apiFetch } from './apiClient';

// Types matching LLMDtos.cs (camelCase serialization)

export interface ProviderHealth {
  status: string;
  activeModel: string | null;
  modelsLoaded: number;
  device: string;
  cudaAvailable: boolean;
  cudaDeviceName: string | null;
}

export interface CompatibleModel {
  modelId: string;
  name: string;
  description: string | null;
  category: string | null;
  size: string | null;
  parametersB: number;
  contextLength: number;
  vramFp16Gb: number;
  vramInt8Gb: number;
  vramInt4Gb: number;
  capabilities: string[];
  license: string | null;
  recommended: boolean;
  canRunFp16: boolean;
  canRunInt8: boolean;
  canRunInt4: boolean;
  recommendedPrecision: string | null;
  quantizationRequired: string | null;
  vramRequired: number;
  isLocal: boolean;
  isAvailable: boolean;
  inputTokenPricePerMillion: number | null;
  outputTokenPricePerMillion: number | null;
}

export interface HardwareSummary {
  gpuAvailable: boolean;
  gpuName: string | null;
  vramTotalGb: number;
  vramFreeGb: number;
}

export interface CompatibilitySummary {
  totalCompatible: number;
  fullPrecisionCount: number;
  int8RequiredCount: number;
  int4RequiredCount: number;
  note: string | null;
}

export interface CompatibleModelsResponse {
  hardware: HardwareSummary | null;
  summary: CompatibilitySummary | null;
  count: number;
  models: CompatibleModel[];
}

export interface ActiveProviderInfo {
  provider: string;
  gatewayType: string;
}

export interface PerModelStats {
  model: string;
  requests: number;
  avgLatencyMs: number;
  totalTokens: number;
  rpm: number;
}

export interface ProviderStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  avgLatencyMs: number;
  perModel: PerModelStats[];
}

export async function getHealth(): Promise<ProviderHealth> {
  const res = await apiFetch('/api/provider/health');
  return res.json();
}

export async function getModels(): Promise<CompatibleModelsResponse> {
  const res = await apiFetch('/api/provider/models');
  return res.json();
}

export async function getActiveProvider(): Promise<ActiveProviderInfo> {
  const res = await apiFetch('/api/provider/active');
  return res.json();
}

export async function getStats(): Promise<ProviderStats> {
  const res = await apiFetch('/api/provider/stats');
  return res.json();
}
