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

export interface CreateSessionRequest {
  name?: string;
  repositoryPath?: string;
  task?: string;
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

export async function createSession(request: CreateSessionRequest): Promise<SessionDto> {
  const res = await apiFetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return res.json();
}

export async function getSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}`);
  return res.json();
}

export async function pauseSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/pause`, { method: 'POST' });
  return res.json();
}

export async function resumeSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/resume`, { method: 'POST' });
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
}
