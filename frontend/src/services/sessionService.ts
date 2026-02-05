/**
 * Session Service - Generic session operations
 * Handles all API calls for session management
 */

import { apiClient } from './api';
import type {
  Session,
  SessionSummary,
  SessionListFilters,
  CreateSessionRequest,
  SessionLog
} from '../types/session.types';

class SessionService {
  private baseUrl = '/api/sessions';

  /**
   * Get all sessions with optional filters
   */
  async getSessions(filters?: SessionListFilters): Promise<SessionSummary[]> {
    const params = new URLSearchParams();
    if (filters?.workspaceId) params.append('workspaceId', filters.workspaceId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return apiClient.get<SessionSummary[]>(`${this.baseUrl}${query ? `?${query}` : ''}`);
  }

  /**
   * Get a single session by ID
   */
  async getSession(id: string): Promise<Session> {
    return apiClient.get<Session>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new session
   */
  async createSession(request: CreateSessionRequest): Promise<Session> {
    return apiClient.post<Session>(this.baseUrl, request);
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  /**
   * Start a pending session
   */
  async startSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${encodeURIComponent(id)}/start`, {});
  }

  /**
   * Pause a running session
   */
  async pauseSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${encodeURIComponent(id)}/pause`, {});
  }

  /**
   * Resume a paused session
   */
  async resumeSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${encodeURIComponent(id)}/resume`, {});
  }

  /**
   * Stop a running session
   */
  async stopSession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${encodeURIComponent(id)}/stop`, {});
  }

  /**
   * Retry a failed session
   */
  async retrySession(id: string): Promise<Session> {
    return apiClient.post<Session>(`${this.baseUrl}/${encodeURIComponent(id)}/retry`, {});
  }

  /**
   * Get session logs
   */
  async getLogs(id: string, limit?: number, offset?: number): Promise<SessionLog[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const query = params.toString();
    return apiClient.get<SessionLog[]>(
      `${this.baseUrl}/${encodeURIComponent(id)}/logs${query ? `?${query}` : ''}`
    );
  }

  /**
   * Export session results
   */
  async exportResults(id: string, format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/${encodeURIComponent(id)}/export?format=${format}`,
      { method: 'GET' }
    );
    return response.blob();
  }

  /**
   * Get sessions for a specific workspace
   */
  async getSessionsForWorkspace(workspaceId: string): Promise<SessionSummary[]> {
    return this.getSessions({ workspaceId });
  }
}

export const sessionService = new SessionService();
