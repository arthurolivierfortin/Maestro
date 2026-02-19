/**
 * Electron IPC Type Definitions
 *
 * These types define the API exposed by the Electron preload script.
 * They are used by the React app to communicate with the main process.
 */

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface CommonPath {
  name: string;
  path: string;
  icon: string;
}

export interface BackendStatus {
  running: boolean;
  pid?: number;
}

export interface BackendResult {
  success: boolean;
  message: string;
}

export interface ElectronAPI {
  // File System
  showDirectoryPicker: (options?: { title?: string }) => Promise<string | null>;
  showFilePicker: (options?: {
    title?: string;
    filters?: FileFilter[];
    multiSelections?: boolean;
  }) => Promise<string | string[] | null>;
  readDirectory: (path: string) => Promise<DirectoryEntry[]>;
  pathExists: (path: string) => Promise<boolean>;
  getCommonPaths: () => Promise<CommonPath[]>;

  // Application
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  getAppPath: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  isElectron: boolean;

  // Window
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;

  // Shell
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (path: string) => void;

  // Backend
  backend: {
    getStatus: () => Promise<BackendStatus>;
    start: () => Promise<BackendResult>;
    stop: () => Promise<BackendResult>;
    onStatus: (callback: (status: { running: boolean }) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
  };

  // Updater
  updater: {
    onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
    onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  };

  // Menu events
  onMenuNewProject: (callback: () => void) => () => void;
  onMenuOpenProject: (callback: (path: string) => void) => () => void;
}

// Extend Window interface to include electron API
declare global {
  interface Window {
    electron?: ElectronAPI;
    isElectron?: boolean;
  }
}

export {};
