import type { HttpTransport } from '../http.js';
import type { Workspace } from '../types.js';

export function workspaceDomain(http: HttpTransport) {
  return {
    list: () => http.get<Workspace[]>('/api/workspaces'),
    get: (id: string) => http.get<Workspace>(`/api/workspaces/${id}`),

    create: (data: { name: string; repositoryPath?: string }) =>
      http.post<Workspace>('/api/workspaces', data),

    addSession: (workspaceId: string, sessionId: string) =>
      http.post(`/api/workspaces/${workspaceId}/sessions/${sessionId}`),

    removeSession: (workspaceId: string, sessionId: string) =>
      http.del(`/api/workspaces/${workspaceId}/sessions/${sessionId}`),
  };
}
