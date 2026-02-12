import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electron", {
  // ===== File System =====
  showDirectoryPicker: (options) => ipcRenderer.invoke("dialog:showDirectoryPicker", options),
  showFilePicker: (options) => ipcRenderer.invoke("dialog:showFilePicker", options),
  readDirectory: (path) => ipcRenderer.invoke("fs:readDirectory", path),
  pathExists: (path) => ipcRenderer.invoke("fs:pathExists", path),
  getCommonPaths: () => ipcRenderer.invoke("fs:getCommonPaths"),
  // ===== Application =====
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getPlatform: () => ipcRenderer.invoke("app:getPlatform"),
  getAppPath: () => ipcRenderer.invoke("app:getAppPath"),
  isPackaged: () => ipcRenderer.invoke("app:isPackaged"),
  isElectron: true,
  // ===== Window Controls =====
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  // ===== Shell Integration =====
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  showItemInFolder: (path) => ipcRenderer.invoke("shell:showItemInFolder", path),
  // ===== Backend Management =====
  backend: {
    getStatus: () => ipcRenderer.invoke("backend:getStatus"),
    start: () => ipcRenderer.invoke("backend:start"),
    stop: () => ipcRenderer.invoke("backend:stop"),
    onStatus: (callback) => {
      const handler = (_event, status) => callback(status);
      ipcRenderer.on("backend:status", handler);
      return () => ipcRenderer.removeListener("backend:status", handler);
    },
    onError: (callback) => {
      const handler = (_event, error) => callback(error);
      ipcRenderer.on("backend:error", handler);
      return () => ipcRenderer.removeListener("backend:error", handler);
    }
  },
  // ===== LLM Provider Management =====
  llm: {
    getStatus: () => ipcRenderer.invoke("llm:getStatus"),
    start: () => ipcRenderer.invoke("llm:start"),
    stop: () => ipcRenderer.invoke("llm:stop"),
    onStatus: (callback) => {
      const handler = (_event, status) => callback(status);
      ipcRenderer.on("llm:status", handler);
      return () => ipcRenderer.removeListener("llm:status", handler);
    },
    onError: (callback) => {
      const handler = (_event, error) => callback(error);
      ipcRenderer.on("llm:error", handler);
      return () => ipcRenderer.removeListener("llm:error", handler);
    }
  },
  // ===== Updater =====
  updater: {
    onUpdateAvailable: (callback) => {
      const handler = (_event, info) => callback(info);
      ipcRenderer.on("updater:update-available", handler);
      return () => ipcRenderer.removeListener("updater:update-available", handler);
    },
    onUpdateDownloaded: (callback) => {
      const handler = (_event, info) => callback(info);
      ipcRenderer.on("updater:update-downloaded", handler);
      return () => ipcRenderer.removeListener("updater:update-downloaded", handler);
    }
  },
  // ===== Menu Events =====
  onMenuNewProject: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("menu:new-project", handler);
    return () => ipcRenderer.removeListener("menu:new-project", handler);
  },
  onMenuOpenProject: (callback) => {
    const handler = (_event, path) => callback(path);
    ipcRenderer.on("menu:open-project", handler);
    return () => ipcRenderer.removeListener("menu:open-project", handler);
  }
});
contextBridge.exposeInMainWorld("isElectron", true);
