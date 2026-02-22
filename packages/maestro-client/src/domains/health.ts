import type { HttpTransport } from '../http.js';
import type { HealthResponse, CapabilitiesResponse, ConfigResponse } from '../types.js';

export function healthDomain(http: HttpTransport) {
  return {
    check: () => http.get<HealthResponse>('/api/discovery/health'),
    capabilities: () => http.get<CapabilitiesResponse>('/api/discovery/capabilities'),
    config: () => http.get<ConfigResponse>('/api/discovery/config'),

    async isReady(): Promise<boolean> {
      try {
        const h = await http.get<HealthResponse>('/api/discovery/health');
        return h.status === 'healthy';
      } catch {
        return false;
      }
    },
  };
}
