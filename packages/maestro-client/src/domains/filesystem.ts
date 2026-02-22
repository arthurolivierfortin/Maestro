import type { HttpTransport } from '../http.js';

export function filesystemDomain(http: HttpTransport) {
  return {
    list: (path?: string) => {
      const q = path ? `?path=${encodeURIComponent(path)}` : '';
      return http.get(`/api/filesystem/list${q}`);
    },

    commonDirectories: () => http.get('/api/filesystem/common-directories'),
  };
}
