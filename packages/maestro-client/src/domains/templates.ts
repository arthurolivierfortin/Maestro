import type { HttpTransport } from '../http.js';
import type { SessionTemplate } from '../types.js';

export function templateDomain(http: HttpTransport) {
  return {
    list: () => http.get<SessionTemplate[]>('/api/templates'),
    get: (id: string) => http.get<SessionTemplate>(`/api/templates/${id}`),
  };
}
