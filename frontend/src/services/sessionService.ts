/**
 * Session Service (Phase 11 - Composable Session Architecture)
 *
 * API service for unified session operations.
 */

import { apiClient } from './api';
import type {
  Session,
  SessionSummary,
  CreateSessionRequest,
  CreateSessionFromTemplateRequest,
  SessionStatus,
  EnvironmentMode,
} from '../types/session.types';

const BASE_URL = '/api/sessions';

/**
 * Session API service
 */
export const sessionService = {
  /**
   * Get all sessions with optional filtering
   */
  async getAll(params?: {
    status?: SessionStatus;
    mode?: EnvironmentMode;
    categoryId?: string;
    templateId?: string;
    limit?: number;
  }): Promise<SessionSummary[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.mode) searchParams.append('mode', params.mode);
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params?.templateId) searchParams.append('templateId', params.templateId);
    if (params?.limit) searchParams.append('limit', String(params.limit));

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
    return apiClient.get<SessionSummary[]>(url);
  },

  /**
   * Get active sessions (running or paused)
   */
  async getActive(): Promise<SessionSummary[]> {
    return apiClient.get<SessionSummary[]>(`${BASE_URL}/active`);
  },

  /**
   * Get sessions by category
   */
  async getByCategory(
    categoryId: string,
    params?: { status?: SessionStatus; limit?: number }
  ): Promise<SessionSummary[]> {
    const searchParams = new URLSearchParams();
    searchParams.append('categoryId', categoryId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', String(params.limit));

    return apiClient.get<SessionSummary[]>(`${BASE_URL}?${searchParams.toString()}`);
  },

  /**
   * Get a specific session by ID
   */
  async getById(id: string): Promise<Session> {
    return apiClient.get<Session>(`${BASE_URL}/${id}`);
  },

  /**
   * Create a new session
   */
  async create(request: CreateSessionRequest): Promise<Session> {
    return apiClient.post<Session>(BASE_URL, request);
  },

  /**
   * Create a session from a template
   */
  async createFromTemplate(
    templateId: string,
    request: CreateSessionFromTemplateRequest
  ): Promise<Session> {
    return apiClient.post<Session>(`${BASE_URL}/from-template/${templateId}`, request);
  },

  /**
   * Start a session
   */
  async start(id: string): Promise<Session> {
    return apiClient.post<Session>(`${BASE_URL}/${id}/start`);
  },

  /**
   * Stop a session
   */
  async stop(id: string): Promise<Session> {
    return apiClient.post<Session>(`${BASE_URL}/${id}/stop`);
  },

  /**
   * Pause a session
   */
  async pause(id: string): Promise<Session> {
    return apiClient.post<Session>(`${BASE_URL}/${id}/pause`);
  },

  /**
   * Resume a paused session
   */
  async resume(id: string): Promise<Session> {
    return apiClient.post<Session>(`${BASE_URL}/${id}/resume`);
  },

  /**
   * Delete a session
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /**
   * Execute a command in a session
   */
  async exec(id: string, command: string): Promise<{ output: string; exitCode: number }> {
    return apiClient.post<{ output: string; exitCode: number }>(`${BASE_URL}/${id}/exec`, {
      command,
    });
  },
};

export default sessionService;
