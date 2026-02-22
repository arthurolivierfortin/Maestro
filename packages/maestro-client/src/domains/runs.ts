import type { HttpTransport } from '../http.js';
import type { RunFilter } from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function runDomain(http: HttpTransport) {
  return {
    list: (filter: RunFilter = {}) =>
      http.get(`/api/runs${buildQuery(filter as Record<string, string | number | undefined>)}`),

    get: (id: string, projectPath?: string) =>
      http.get(`/api/runs/${id}${buildQuery({ projectPath })}`),
  };
}
