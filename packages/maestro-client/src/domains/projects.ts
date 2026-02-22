import type { HttpTransport } from '../http.js';
import type { Project, ProjectCreateRequest, ContainerLogsOptions } from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function projectDomain(http: HttpTransport) {
  return {
    list: () => http.get<Project[]>('/api/projects'),
    get: (id: string) => http.get<Project>(`/api/projects/${id}`),
    create: (project: ProjectCreateRequest) => http.post<Project>('/api/projects', project),
    update: (id: string, updates: Partial<Project>) => http.put<Project>(`/api/projects/${id}`, updates),
    delete: (id: string) => http.del(`/api/projects/${id}`),
    open: (rootPath: string) => http.post<Project>('/api/projects/open', { rootPath }),
    bind: (options: { rootPath: string; [key: string]: unknown }) =>
      http.post('/api/projects/bind', options),
    blocks: (projectId: string) => http.get(`/api/projects/${projectId}/blocks`),
    discover: () => http.post('/api/projects/discover'),

    // Container management
    containerStatus: (id: string) => http.get(`/api/projects/${id}/status`),
    startContainer: (id: string) => http.post(`/api/projects/${id}/start`),
    stopContainer: (id: string) => http.post(`/api/projects/${id}/stop`),
    restartContainer: (id: string) => http.post(`/api/projects/${id}/restart`),
    containerLogs: (id: string, options: ContainerLogsOptions = {}) =>
      http.get(`/api/projects/${id}/logs${buildQuery(options as Record<string, string | number | undefined>)}`),

    // Permissions
    fileAccessRules: (id: string) => http.get(`/api/projects/${id}/file-rules`),
    updateFileAccessRules: (id: string, rules: unknown) =>
      http.put(`/api/projects/${id}/file-rules`, rules),
    blockPermissions: (id: string) => http.get(`/api/projects/${id}/block-permissions`),
    updateBlockPermissions: (id: string, permissions: unknown) =>
      http.put(`/api/projects/${id}/block-permissions`, permissions),
  };
}
