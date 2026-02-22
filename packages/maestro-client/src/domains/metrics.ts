import type { HttpTransport } from '../http.js';
import type { MetricsFilter, AggregatedMetricsFilter } from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function metricsDomain(http: HttpTransport) {
  return {
    executions: (filter: MetricsFilter = {}) =>
      http.get(`/api/metrics/executions${buildQuery(filter as Record<string, string | number | undefined>)}`),

    execution: (executionId: string) =>
      http.get(`/api/metrics/executions/${executionId}`),

    workflow: (workflowId: string) =>
      http.get(`/api/metrics/workflows/${workflowId}`),

    aggregated: (filter: AggregatedMetricsFilter = {}) =>
      http.get(`/api/metrics/aggregate${buildQuery(filter as Record<string, string | number | undefined>)}`),

    trainingRun: (runId: string) =>
      http.get(`/api/metrics/training-runs/${runId}`),
  };
}
