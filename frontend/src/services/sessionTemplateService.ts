/**
 * Session Template Service (Phase 11 - Composable Session Architecture)
 *
 * API service for session template operations.
 */

import { apiClient } from './api';
import type {
  SessionTemplate,
  CreateSessionTemplateRequest,
  UpdateSessionTemplateRequest,
  TemplateSource,
  EnvironmentMode,
} from '../types/session.types';

const BASE_URL = '/api/session-templates';

/**
 * Session Template API service
 */
export const sessionTemplateService = {
  /**
   * Get all session templates with optional filtering
   */
  async getAll(params?: {
    source?: TemplateSource;
    mode?: EnvironmentMode;
    categoryId?: string;
    tags?: string[];
  }): Promise<SessionTemplate[]> {
    const searchParams = new URLSearchParams();
    if (params?.source) searchParams.append('source', params.source);
    if (params?.mode) searchParams.append('mode', params.mode);
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params?.tags?.length) searchParams.append('tags', params.tags.join(','));

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
    return apiClient.get<SessionTemplate[]>(url);
  },

  /**
   * Get built-in session templates only
   */
  async getBuiltIn(): Promise<SessionTemplate[]> {
    return apiClient.get<SessionTemplate[]>(`${BASE_URL}/builtin`);
  },

  /**
   * Get user-defined session templates only
   */
  async getUserDefined(): Promise<SessionTemplate[]> {
    return apiClient.get<SessionTemplate[]>(`${BASE_URL}/user`);
  },

  /**
   * Get a specific session template by ID
   */
  async getById(id: string): Promise<SessionTemplate> {
    return apiClient.get<SessionTemplate>(`${BASE_URL}/${id}`);
  },

  /**
   * Create a new user-defined session template
   */
  async create(request: CreateSessionTemplateRequest): Promise<SessionTemplate> {
    return apiClient.post<SessionTemplate>(BASE_URL, request);
  },

  /**
   * Update a user-defined session template
   */
  async update(id: string, request: UpdateSessionTemplateRequest): Promise<SessionTemplate> {
    return apiClient.put<SessionTemplate>(`${BASE_URL}/${id}`, request);
  },

  /**
   * Delete a user-defined session template
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },
};

export default sessionTemplateService;
