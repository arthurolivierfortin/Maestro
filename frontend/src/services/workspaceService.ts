/**
 * Workspace Service
 *
 * Provides API methods for workspace management, including CRUD operations,
 * session/project management, topology, and cross-workspace promotions.
 */

import { apiClient } from './api';
import type {
  Workspace,
  WorkspaceTopology,
  PromotionResult,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  PromoteAgentRequest,
  WorkspaceType
} from '../types/workspace.types';

class WorkspaceService {
  /**
   * Get all workspaces
   */
  async getWorkspaces(type?: WorkspaceType): Promise<Workspace[]> {
    const params = type ? `?type=${type}` : '';
    return apiClient.get<Workspace[]>(`/api/workspaces${params}`);
  }

  /**
   * Get a workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace> {
    return apiClient.get<Workspace>(`/api/workspaces/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
    return apiClient.post<Workspace>('/api/workspaces', request);
  }

  /**
   * Update a workspace
   */
  async updateWorkspace(id: string, request: UpdateWorkspaceRequest): Promise<Workspace> {
    return apiClient.put<Workspace>(`/api/workspaces/${encodeURIComponent(id)}`, request);
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(id: string): Promise<void> {
    await apiClient.delete(`/api/workspaces/${encodeURIComponent(id)}`);
  }

  /**
   * Add a session to a workspace
   */
  async addSession(workspaceId: string, sessionId: string): Promise<Workspace> {
    return apiClient.post<Workspace>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions`,
      { sessionId }
    );
  }

  /**
   * Remove a session from a workspace
   */
  async removeSession(workspaceId: string, sessionId: string): Promise<Workspace> {
    return apiClient.delete<Workspace>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`
    );
  }

  /**
   * Add a project to a workspace
   */
  async addProject(workspaceId: string, projectId: string): Promise<Workspace> {
    return apiClient.post<Workspace>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      { projectId }
    );
  }

  /**
   * Remove a project from a workspace
   */
  async removeProject(workspaceId: string, projectId: string): Promise<Workspace> {
    return apiClient.delete<Workspace>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`
    );
  }

  /**
   * Pause a workspace
   */
  async pauseWorkspace(id: string): Promise<Workspace> {
    return apiClient.post<Workspace>(`/api/workspaces/${encodeURIComponent(id)}/pause`, {});
  }

  /**
   * Resume a workspace
   */
  async resumeWorkspace(id: string): Promise<Workspace> {
    return apiClient.post<Workspace>(`/api/workspaces/${encodeURIComponent(id)}/resume`, {});
  }

  /**
   * Archive a workspace
   */
  async archiveWorkspace(id: string): Promise<Workspace> {
    return apiClient.post<Workspace>(`/api/workspaces/${encodeURIComponent(id)}/archive`, {});
  }

  /**
   * Get workspace topology graph
   */
  async getTopology(): Promise<WorkspaceTopology> {
    return apiClient.get<WorkspaceTopology>('/api/workspaces/topology');
  }

  /**
   * Promote an agent from one workspace to another
   */
  async promoteAgent(
    sourceWorkspaceId: string,
    request: PromoteAgentRequest
  ): Promise<PromotionResult> {
    return apiClient.post<PromotionResult>(
      `/api/workspaces/${encodeURIComponent(sourceWorkspaceId)}/promote`,
      request
    );
  }

  /**
   * Update workspace permissions
   */
  async updatePermissions(
    id: string,
    permissions: Partial<{
      canReadFrom: string[];
      canWriteTo: string[];
      canPromoteTo: string[];
      allowReadFrom: string[];
      allowWriteFrom: string[];
    }>
  ): Promise<Workspace> {
    return this.updateWorkspace(id, {
      isolation: { permissions }
    });
  }
}

export const workspaceService = new WorkspaceService();
