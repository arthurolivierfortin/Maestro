/**
 * Sandbox Image Service (Phase 11 - Composable Session Architecture)
 *
 * API service for sandbox image operations.
 */

import { apiClient } from './api';
import type {
  SandboxImage,
  RegisterSandboxImageRequest,
  UpdateSandboxImageRequest,
  SandboxImageVerificationResult,
  ImageSource,
} from '../types/session.types';

const BASE_URL = '/api/sandbox-images';

/**
 * Sandbox Image API service
 */
export const sandboxImageService = {
  /**
   * Get all sandbox images with optional filtering
   */
  async getAll(params?: {
    source?: ImageSource;
    verified?: boolean;
    tags?: string[];
  }): Promise<SandboxImage[]> {
    const searchParams = new URLSearchParams();
    if (params?.source) searchParams.append('source', params.source);
    if (params?.verified !== undefined) searchParams.append('verified', String(params.verified));
    if (params?.tags?.length) searchParams.append('tags', params.tags.join(','));

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
    return apiClient.get<SandboxImage[]>(url);
  },

  /**
   * Get built-in sandbox images only
   */
  async getBuiltIn(): Promise<SandboxImage[]> {
    return apiClient.get<SandboxImage[]>(`${BASE_URL}/builtin`);
  },

  /**
   * Get user-defined sandbox images only
   */
  async getUserDefined(): Promise<SandboxImage[]> {
    return apiClient.get<SandboxImage[]>(`${BASE_URL}/user`);
  },

  /**
   * Get a specific sandbox image by ID
   */
  async getById(id: string): Promise<SandboxImage> {
    return apiClient.get<SandboxImage>(`${BASE_URL}/${id}`);
  },

  /**
   * Register a new user-defined sandbox image
   */
  async register(request: RegisterSandboxImageRequest): Promise<SandboxImage> {
    return apiClient.post<SandboxImage>(BASE_URL, request);
  },

  /**
   * Update a user-defined sandbox image
   */
  async update(id: string, request: UpdateSandboxImageRequest): Promise<SandboxImage> {
    return apiClient.put<SandboxImage>(`${BASE_URL}/${id}`, request);
  },

  /**
   * Delete a user-defined sandbox image
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`${BASE_URL}/${id}`);
  },

  /**
   * Verify that a sandbox image exists and is pullable
   */
  async verify(id: string): Promise<SandboxImageVerificationResult> {
    return apiClient.post<SandboxImageVerificationResult>(`${BASE_URL}/${id}/verify`);
  },
};

export default sandboxImageService;
