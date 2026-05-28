const API_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res;
}

export { API_URL };
