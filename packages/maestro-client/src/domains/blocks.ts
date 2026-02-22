import type { HttpTransport } from '../http.js';
import type {
  BlockDefinition,
  BlockFilter,
  BlockMetrics,
  BlockRunData,
  TopBlocksOptions,
} from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function blockDomain(http: HttpTransport) {
  return {
    list: (filter: BlockFilter = {}) =>
      http.get<BlockDefinition[]>(`/api/blocks${buildQuery(filter)}`),

    get: (id: string) => http.get<BlockDefinition>(`/api/blocks/${id}`),

    create: (block: Partial<BlockDefinition> & { name: string; blockType: string }) =>
      http.post<BlockDefinition>('/api/blocks', block),

    update: (id: string, updates: Partial<BlockDefinition>) =>
      http.put<BlockDefinition>(`/api/blocks/${id}`, updates),

    delete: (id: string) => http.del(`/api/blocks/${id}`),

    children: (id: string, recursive = true) =>
      http.get<BlockDefinition[]>(`/api/blocks/${id}/children?recursive=${recursive}`),

    content: (id: string, filePath?: string) =>
      http.get<string>(filePath ? `/api/blocks/${id}/content/${filePath}` : `/api/blocks/${id}/content`),

    updateContent: (id: string, filePath: string, content: string) =>
      http.put(`/api/blocks/${id}/content/${filePath}`, JSON.stringify(content)),

    metrics: (id: string) => http.get<BlockMetrics>(`/api/blocks/${id}/metrics`),

    recordRun: (id: string, data: BlockRunData) =>
      http.post(`/api/blocks/${id}/runs`, data),

    top: (options: TopBlocksOptions = {}) =>
      http.get<BlockDefinition[]>(`/api/blocks/top${buildQuery(options as Record<string, string | number | undefined>)}`),

    designate: (id: string, designation: string) =>
      http.post(`/api/blocks/${id}/designate`, { designation }),

    search: (query: string) =>
      http.get<BlockDefinition[]>(`/api/discovery/blocks/search?q=${encodeURIComponent(query)}`),

    byType: (type: string) =>
      http.get<BlockDefinition[]>(`/api/discovery/blocks/by-type/${encodeURIComponent(type)}`),

    byCapability: (capability: string) =>
      http.get<BlockDefinition[]>(`/api/discovery/blocks/by-capability/${encodeURIComponent(capability)}`),
  };
}
