/**
 * File System Service
 *
 * API client for file system browsing.
 * Phase 8 implementation.
 */

import { apiClient } from './api';

// ============= Types =============

export interface DirectoryEntry {
  name: string;
  path: string;
  lastModified?: string;
  isMaestroProject: boolean;
  isGitRepository: boolean;
  isHidden: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  lastModified?: string;
  extension?: string;
  isHidden: boolean;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath?: string;
  directories: DirectoryEntry[];
  files: FileEntry[];
  isMaestroProject: boolean;
  isGitRepository: boolean;
}

export interface CommonDirectory {
  name: string;
  path: string;
  icon?: string;
}

// ============= API Functions =============

/**
 * Browse a directory and list its contents.
 */
export async function browseDirectory(path?: string): Promise<DirectoryListing> {
  if (path) {
    // Use POST for paths that might have special characters
    return apiClient.post<DirectoryListing>('/api/filesystem/browse', { path });
  }
  return apiClient.get<DirectoryListing>('/api/filesystem/browse');
}

/**
 * Get common/favorite directories.
 */
export async function getCommonDirectories(): Promise<CommonDirectory[]> {
  return apiClient.get<CommonDirectory[]>('/api/filesystem/common');
}

/**
 * Check if a directory exists.
 */
export async function directoryExists(path: string): Promise<boolean> {
  const response = await apiClient.get<{ exists: boolean }>(`/api/filesystem/exists?path=${encodeURIComponent(path)}`);
  return response.exists;
}

export const fileSystemService = {
  browse: browseDirectory,
  getCommonDirectories,
  exists: directoryExists,
};

export default fileSystemService;
