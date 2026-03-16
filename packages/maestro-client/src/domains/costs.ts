import type { HttpTransport } from '../http.js';

// ── Cost Types ─────────────────────────────────────────────────

export interface CostPeriod {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
}

export interface CostBreakdown {
  totalCost: number;
  totalTokens: number;
}

export interface CostLimits {
  maxPerSession?: number | null;
  maxPerDay?: number | null;
  maxPerWeek?: number | null;
  maxPerMonth?: number | null;
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

export interface CostEntry {
  sessionId: string;
  blockId: string;
  modelId: string;
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  timestamp: string;
}

// ── Domain ─────────────────────────────────────────────────────

export function costDomain(http: HttpTransport) {
  return {
    /** Get aggregated cost summary (today, week, month, allTime, by provider). */
    summary: () => http.get<CostSummary>('/api/costs/summary'),

    /** Get current cost limits. */
    limits: () => http.get<CostLimits>('/api/costs/limits'),

    /** Set cost limits. */
    setLimits: (limits: CostLimits) => http.put<{ message: string }>('/api/costs/limits', limits),

    /** Get cost entries for a specific session. */
    sessionCosts: (sessionId: string) =>
      http.get<CostEntry[]>(`/api/sessions/${encodeURIComponent(sessionId)}/costs`),
  };
}
