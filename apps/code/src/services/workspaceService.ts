import { apiFetch } from './apiClient';

export interface WorkspaceDto {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  sessionIds: string[];
  projectIds: string[];
  createdAt: string;
  updatedAt?: string;
}

export async function getWorkspaces(): Promise<WorkspaceDto[]> {
  const res = await apiFetch('/api/workspaces');
  return res.json();
}
