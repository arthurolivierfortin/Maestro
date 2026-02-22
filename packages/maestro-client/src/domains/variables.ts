import type { HttpTransport } from '../http.js';
import type { VariableValue } from '../types.js';

export function variableDomain(http: HttpTransport) {
  return {
    get: (sessionId: string, key: string) =>
      http.get<VariableValue>(`/api/sessions/${sessionId}/variables/${key}`),

    set: (sessionId: string, key: string, value: VariableValue) =>
      http.put(`/api/sessions/${sessionId}/variables/${key}`, { value }),

    getAll: (sessionId: string) =>
      http.get<Record<string, VariableValue>>(`/api/sessions/${sessionId}/variables`),

    delete: (sessionId: string, key: string) =>
      http.del(`/api/sessions/${sessionId}/variables/${key}`),
  };
}
