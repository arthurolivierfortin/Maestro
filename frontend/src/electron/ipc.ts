/**
 * Electron IPC Client
 *
 * This module provides a unified API for both Electron and web environments.
 * In Electron, it uses IPC to communicate with the main process.
 * In web, it falls back to web APIs or the backend.
 */

import type { ElectronAPI, CommonPath, DirectoryEntry, BackendStatus, BackendResult } from './types';

/**
 * Check if we're running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.isElectron === true;
}

/**
 * Get the Electron API if available
 */
export function getElectronAPI(): ElectronAPI | undefined {
  if (isElectron()) {
    return window.electron;
  }
  return undefined;
}

/**
 * Show native directory picker
 * Falls back to null in web (caller should show custom FileBrowser)
 */
export async function showDirectoryPicker(options?: { title?: string }): Promise<string | null> {
  const api = getElectronAPI();
  if (api) {
    return api.showDirectoryPicker(options);
  }
  // Web fallback: return null to indicate native picker not available
  return null;
}

/**
 * Show native file picker
 * Falls back to null in web
 */
export async function showFilePicker(options?: {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  multiSelections?: boolean;
}): Promise<string | string[] | null> {
  const api = getElectronAPI();
  if (api) {
    return api.showFilePicker(options);
  }
  return null;
}

/**
 * Read directory contents
 * Falls back to backend API in web
 */
export async function readDirectory(path: string): Promise<DirectoryEntry[]> {
  const api = getElectronAPI();
  if (api) {
    return api.readDirectory(path);
  }
  // Web fallback: use backend API
  throw new Error('Direct file system access not available in web mode');
}

/**
 * Check if path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  const api = getElectronAPI();
  if (api) {
    return api.pathExists(path);
  }
  throw new Error('Direct file system access not available in web mode');
}

/**
 * Get common paths (Home, Documents, etc.)
 */
export async function getCommonPaths(): Promise<CommonPath[]> {
  const api = getElectronAPI();
  if (api) {
    return api.getCommonPaths();
  }
  // Web fallback: return empty array (use backend)
  return [];
}

/**
 * Get app version
 */
export async function getAppVersion(): Promise<string> {
  const api = getElectronAPI();
  if (api) {
    return api.getVersion();
  }
  // Web fallback
  return '1.0.0';
}

/**
 * Get current platform
 */
export async function getPlatform(): Promise<NodeJS.Platform | 'web'> {
  const api = getElectronAPI();
  if (api) {
    return api.getPlatform();
  }
  return 'web';
}

/**
 * Open external URL in browser
 */
export async function openExternal(url: string): Promise<void> {
  const api = getElectronAPI();
  if (api) {
    await api.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Show file in system file explorer
 */
export function showItemInFolder(path: string): void {
  const api = getElectronAPI();
  if (api) {
    api.showItemInFolder(path);
  }
}

/**
 * Window controls (Electron only)
 */
export const windowControls = {
  minimize: (): void => {
    const api = getElectronAPI();
    api?.minimize();
  },
  maximize: (): void => {
    const api = getElectronAPI();
    api?.maximize();
  },
  close: (): void => {
    const api = getElectronAPI();
    api?.close();
  },
  isMaximized: async (): Promise<boolean> => {
    const api = getElectronAPI();
    if (api) {
      return api.isMaximized();
    }
    return false;
  },
};

/**
 * Backend management (Electron only)
 */
export const backendManager = {
  getStatus: async (): Promise<BackendStatus> => {
    const api = getElectronAPI();
    if (api) {
      return api.backend.getStatus();
    }
    // In web mode, assume backend is managed externally
    return { running: true };
  },
  start: async (): Promise<BackendResult> => {
    const api = getElectronAPI();
    if (api) {
      return api.backend.start();
    }
    return { success: false, message: 'Not available in web mode' };
  },
  stop: async (): Promise<BackendResult> => {
    const api = getElectronAPI();
    if (api) {
      return api.backend.stop();
    }
    return { success: false, message: 'Not available in web mode' };
  },
  onStatus: (callback: (status: { running: boolean }) => void): (() => void) => {
    const api = getElectronAPI();
    if (api) {
      return api.backend.onStatus(callback);
    }
    return () => {};
  },
  onError: (callback: (error: string) => void): (() => void) => {
    const api = getElectronAPI();
    if (api) {
      return api.backend.onError(callback);
    }
    return () => {};
  },
};

/**
 * Updater (Electron only)
 */
export const updater = {
  onUpdateAvailable: (callback: (info: unknown) => void): (() => void) => {
    const api = getElectronAPI();
    if (api) {
      return api.updater.onUpdateAvailable(callback);
    }
    return () => {};
  },
  onUpdateDownloaded: (callback: (info: unknown) => void): (() => void) => {
    const api = getElectronAPI();
    if (api) {
      return api.updater.onUpdateDownloaded(callback);
    }
    return () => {};
  },
};

/**
 * Menu event handlers (Electron only)
 */
export const menuEvents = {
  onNewProject: (callback: () => void): (() => void) => {
    const api = getElectronAPI();
    if (api) {
      return api.onMenuNewProject(callback);
    }
    return () => {};
  },
  onOpenProject: (callback: (path: string) => void): (() => void) => {
    const api = getElectronAPI();
    if (api) {
      return api.onMenuOpenProject(callback);
    }
    return () => {};
  },
};

// Default export for convenience
export default {
  isElectron,
  showDirectoryPicker,
  showFilePicker,
  readDirectory,
  pathExists,
  getCommonPaths,
  getAppVersion,
  getPlatform,
  openExternal,
  showItemInFolder,
  windowControls,
  backendManager,
  updater,
  menuEvents,
};
