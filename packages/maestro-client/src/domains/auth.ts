import type { HttpTransport } from '../http.js';
import type { AuthStatus, ApiKey, ApiKeyCreateRequest } from '../types.js';

export function authDomain(http: HttpTransport) {
  return {
    status: () => http.get<AuthStatus>('/api/auth/status'),
    setup: (name = 'admin') => http.post('/api/auth/setup', { name }),
    createKey: (request: ApiKeyCreateRequest) => http.post<ApiKey>('/api/auth/keys', request),
    listKeys: () => http.get<ApiKey[]>('/api/auth/keys'),
    revokeKey: (id: string) => http.del(`/api/auth/keys/${id}`),
    validate: () => http.post('/api/auth/validate'),
  };
}
