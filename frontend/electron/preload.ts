/**
 * Electron Preload Script
 *
 * This script runs in the renderer process before the web page loads.
 * It exposes a safe API to the renderer through contextBridge.
 *
 * Security: Context isolation is enabled, so this is the only way
 * for the renderer to access Node.js/Electron APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
export interface ElectronAPI {
  // File System
  showDirectoryPicker: (options?: { title?: string }) => Promise<string | null>;
  showFilePicker: (options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    multiSelections?: boolean;
  }) => Promise<string | string[] | null>;
  readDirectory: (
    path: string
  ) => Promise<{ name: string; path: string; isDirectory: boolean; isFile: boolean }[]>;
  pathExists: (path: string) => Promise<boolean>;
  getCommonPaths: () => Promise<{ name: string; path: string; icon: string }[]>;

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
    getStatus: () => Promise<{ running: boolean; pid?: number }>;
    start: () => Promise<{ success: boolean; message: string }>;
    stop: () => Promise<{ success: boolean; message: string }>;
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

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // ===== File System =====
  showDirectoryPicker: (options?: { title?: string }) =>
    ipcRenderer.invoke('dialog:showDirectoryPicker', options),

  showFilePicker: (options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    multiSelections?: boolean;
  }) => ipcRenderer.invoke('dialog:showFilePicker', options),

  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),

  pathExists: (path: string) => ipcRenderer.invoke('fs:pathExists', path),

  getCommonPaths: () => ipcRenderer.invoke('fs:getCommonPaths'),

  // ===== Application =====
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
  isPackaged: () => ipcRenderer.invoke('app:isPackaged'),
  isElectron: true,

  // ===== Window Controls =====
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ===== Shell Integration =====
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),

  // ===== Backend Management =====
  backend: {
    getStatus: () => ipcRenderer.invoke('backend:getStatus'),
    start: () => ipcRenderer.invoke('backend:start'),
    stop: () => ipcRenderer.invoke('backend:stop'),
    onStatus: (callback: (status: { running: boolean }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: { running: boolean }) =>
        callback(status);
      ipcRenderer.on('backend:status', handler);
      return () => ipcRenderer.removeListener('backend:status', handler);
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on('backend:error', handler);
      return () => ipcRenderer.removeListener('backend:error', handler);
    },
  },

  // ===== Updater =====
  updater: {
    onUpdateAvailable: (callback: (info: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
      ipcRenderer.on('updater:update-available', handler);
      return () => ipcRenderer.removeListener('updater:update-available', handler);
    },
    onUpdateDownloaded: (callback: (info: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
      ipcRenderer.on('updater:update-downloaded', handler);
      return () => ipcRenderer.removeListener('updater:update-downloaded', handler);
    },
  },

  // ===== Menu Events =====
  onMenuNewProject: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('menu:new-project', handler);
    return () => ipcRenderer.removeListener('menu:new-project', handler);
  },

  onMenuOpenProject: (callback: (path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('menu:open-project', handler);
    return () => ipcRenderer.removeListener('menu:open-project', handler);
  },
} satisfies ElectronAPI);

// Also expose a simple check for Electron environment
contextBridge.exposeInMainWorld('isElectron', true);
