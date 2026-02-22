import type { HttpTransport } from '../http.js';
import type {
  Session,
  SessionCreateRequest,
  SessionFilter,
  SessionEventsOptions,
  SessionCommandsOptions,
} from '../types.js';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function sessionDomain(http: HttpTransport) {
  return {
    list: (filter: SessionFilter = {}) =>
      http.get<Session[]>(`/api/sessions${buildQuery(filter as Record<string, string | number | undefined>)}`),

    get: (id: string) => http.get<Session>(`/api/sessions/${id}`),

    create: (request: SessionCreateRequest) =>
      http.post<Session>('/api/sessions', request),

    start: (id: string) => http.post<Session>(`/api/sessions/${id}/start`),
    pause: (id: string) => http.post<Session>(`/api/sessions/${id}/pause`),
    resume: (id: string) => http.post<Session>(`/api/sessions/${id}/resume`),
    stop: (id: string) => http.post<Session>(`/api/sessions/${id}/stop`),
    delete: (id: string) => http.del(`/api/sessions/${id}`),

    takeControl: (id: string, authority = 'human') =>
      http.post(`/api/sessions/${id}/take-control`, { authority }),

    exec: (id: string, command: string, args?: Record<string, unknown>) => {
      const body: Record<string, unknown> = { command };
      if (args) body.args = args;
      return http.post(`/api/sessions/${id}/exec`, body);
    },

    invoke: (id: string, entryPoint: string, inputs?: Record<string, unknown>) =>
      http.post(`/api/sessions/${id}/invoke/${entryPoint}`, { inputs }),

    events: (id: string, options: SessionEventsOptions = {}) =>
      http.get(`/api/sessions/${id}/events${buildQuery(options as Record<string, string | number | undefined>)}`),

    commands: (id: string, options: SessionCommandsOptions = {}) =>
      http.get(`/api/sessions/${id}/commands${buildQuery(options as Record<string, string | number | undefined>)}`),
  };
}
