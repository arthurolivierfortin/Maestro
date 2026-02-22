import type { HttpTransport } from '../http.js';
import type { BlockTestRunFilter, BlockTestRunRequest, BlockTestEvaluation } from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function testingDomain(http: HttpTransport) {
  return {
    listRuns: (filter: BlockTestRunFilter = {}) =>
      http.get(`/api/blocktest/runs${buildQuery(filter as Record<string, string | number | undefined>)}`),
    getRun: (id: string) => http.get(`/api/blocktest/runs/${id}`),
    createRun: (request: BlockTestRunRequest) => http.post('/api/blocktest/runs', request),
    deleteRun: (id: string) => http.del(`/api/blocktest/runs/${id}`),

    evaluate: (runId: string, evaluation: BlockTestEvaluation) =>
      http.post(`/api/blocktest/runs/${runId}/evaluate`, evaluation),
    evaluateBulk: (runId: string, evaluations: BlockTestEvaluation[]) =>
      http.post(`/api/blocktest/runs/${runId}/evaluate/bulk`, { evaluations }),
    pendingEvaluations: (runId: string) =>
      http.get(`/api/blocktest/runs/${runId}/pending`),
    improve: (runId: string, suggestions: string[]) =>
      http.post(`/api/blocktest/runs/${runId}/improve`, { suggestions }),
    compare: (runIds: string[]) =>
      http.get(`/api/blocktest/compare?runIds=${runIds.join(',')}`),
  };
}
