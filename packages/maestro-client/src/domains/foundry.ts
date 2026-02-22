import type { HttpTransport } from '../http.js';
import type { FoundryOverview, FoundryLeaderboard } from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function foundryDomain(http: HttpTransport) {
  return {
    overview: (projectPath?: string) =>
      http.get<FoundryOverview>(`/api/foundry/overview${buildQuery({ projectPath })}`),

    leaderboard: (limit = 10, projectPath?: string) =>
      http.get<FoundryLeaderboard>(`/api/foundry/leaderboard${buildQuery({ limit, projectPath })}`),

    relationships: (projectPath?: string) =>
      http.get(`/api/foundry/relationships${buildQuery({ projectPath })}`),

    promote: (request: Record<string, unknown>, projectPath?: string) =>
      http.post(`/api/foundry/promote${buildQuery({ projectPath })}`, request),
  };
}
