/**
 * Session Category Service
 *
 * API service for managing user-defined session categories.
 */

import { apiClient } from './api';
import type {
  SessionCategory,
  CreateSessionCategoryRequest,
  UpdateSessionCategoryRequest,
} from '../types/session.types';

const BASE_URL = '/api/session-categories';

export const sessionCategoryService = {
  /**
   * Get all session categories (built-in and user-defined)
   */
  async getAll(): Promise<SessionCategory[]> {
    return apiClient.get<SessionCategory[]>(BASE_URL);
  },

  /**
   * Get only built-in categories
   */
  async getBuiltIn(): Promise<SessionCategory[]> {
    return apiClient.get<SessionCategory[]>(`${BASE_URL}/builtin`);
  },

  /**
   * Get only user-defined categories
   */
  async getUserDefined(): Promise<SessionCategory[]> {
    return apiClient.get<SessionCategory[]>(`${BASE_URL}/user-defined`);
  },

  /**
   * Get a category by ID
   */
  async getById(id: string): Promise<SessionCategory> {
    return apiClient.get<SessionCategory>(`${BASE_URL}/${id}`);
  },

  /**
   * Create a new user-defined category
   */
  async create(request: CreateSessionCategoryRequest): Promise<SessionCategory> {
    return apiClient.post<SessionCategory>(BASE_URL, request);
  },

  /**
   * Update a user-defined category
   */
  async update(id: string, request: UpdateSessionCategoryRequest): Promise<SessionCategory> {
    return apiClient.put<SessionCategory>(`${BASE_URL}/${id}`, request);
  },

  /**
   * Delete a user-defined category
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },
};
