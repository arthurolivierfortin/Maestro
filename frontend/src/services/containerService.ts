/**
 * Container Service
 *
 * API client for project container management.
 * Phase 8 implementation.
 */

import { apiClient } from './api';

// ============= Types =============

export interface ContainerState {
  projectId: string;
  containerId?: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  startedAt?: string;
  stoppedAt?: string;
  error?: string;
  resourceUsage?: {
    cpuPercent: number;
    memoryMb: number;
  };
}

// ============= API Functions =============

/**
 * Get container status for a project.
 */
export async function getProjectStatus(projectId: string): Promise<ContainerState> {
  return apiClient.get<ContainerState>(`/api/projects/${projectId}/status`);
}

/**
 * Start the container for a project.
 */
export async function startProject(projectId: string): Promise<ContainerState> {
  return apiClient.post<ContainerState>(`/api/projects/${projectId}/start`);
}

/**
 * Stop the container for a project.
 */
export async function stopProject(projectId: string): Promise<ContainerState> {
  return apiClient.post<ContainerState>(`/api/projects/${projectId}/stop`);
}

/**
 * Restart the container for a project.
 */
export async function restartProject(projectId: string): Promise<ContainerState> {
  return apiClient.post<ContainerState>(`/api/projects/${projectId}/restart`);
}

/**
 * Get container logs for a project.
 */
export async function getProjectLogs(projectId: string, tail?: number): Promise<string> {
  const params = tail ? `?tail=${tail}` : '';
  const response = await apiClient.get<{ logs: string }>(`/api/projects/${projectId}/logs${params}`);
  return response.logs;
}

export const containerService = {
  getStatus: getProjectStatus,
  start: startProject,
  stop: stopProject,
  restart: restartProject,
  getLogs: getProjectLogs,
};

export default containerService;
