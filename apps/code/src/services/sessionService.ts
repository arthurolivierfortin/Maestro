import { apiFetch } from './apiClient';

export interface SessionDto {
  id: string;
  name: string;
  type: string;
  status: string;
  authority: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  commandCount: number;
  repositoryPath?: string;
  parentSessionId?: string;
  errorMessage?: string;
}

export async function getSessions(): Promise<SessionDto[]> {
  const res = await apiFetch('/api/sessions');
  return res.json();
}

export async function startSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/start`, { method: 'POST' });
  return res.json();
}

export async function stopSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/stop`, { method: 'POST' });
  return res.json();
}
