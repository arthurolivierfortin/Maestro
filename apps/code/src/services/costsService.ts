import { apiFetch } from './apiClient';

// Types matching CostDtos.cs (camelCase serialization)

export interface CostPeriod {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
}

export interface CostBreakdown {
  totalCost: number;
  totalTokens: number;
}

export interface CostLimitConfig {
  value: number | null;
  enforcement: string;
  autoResume: boolean;
}

export interface CostLimits {
  maxPerSession: CostLimitConfig | null;
  maxPerDay: CostLimitConfig | null;
  maxPerWeek: CostLimitConfig | null;
  maxPerMonth: CostLimitConfig | null;
}

export interface CostSummary {
  today: CostPeriod;
  thisWeek: CostPeriod;
  thisMonth: CostPeriod;
  allTime: CostPeriod;
  byProvider: Record<string, CostBreakdown>;
  byModel: Record<string, CostBreakdown>;
  limits: CostLimits | null;
}

export async function getCostSummary(): Promise<CostSummary> {
  const res = await apiFetch('/api/costs/summary');
  return res.json();
}

export async function getCostLimits(): Promise<CostLimits> {
  const res = await apiFetch('/api/costs/limits');
  return res.json();
}
