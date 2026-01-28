import { contextBridge as a, ipcRenderer as e } from "electron";
a.exposeInMainWorld("electron", {
  // ===== File System =====
  showDirectoryPicker: (n) => e.invoke("dialog:showDirectoryPicker", n),
  showFilePicker: (n) => e.invoke("dialog:showFilePicker", n),
  readDirectory: (n) => e.invoke("fs:readDirectory", n),
  pathExists: (n) => e.invoke("fs:pathExists", n),
  getCommonPaths: () => e.invoke("fs:getCommonPaths"),
  // ===== Application =====
  getVersion: () => e.invoke("app:getVersion"),
  getPlatform: () => e.invoke("app:getPlatform"),
  getAppPath: () => e.invoke("app:getAppPath"),
  isPackaged: () => e.invoke("app:isPackaged"),
  isElectron: !0,
  // ===== Window Controls =====
  minimize: () => e.invoke("window:minimize"),
  maximize: () => e.invoke("window:maximize"),
  close: () => e.invoke("window:close"),
  isMaximized: () => e.invoke("window:isMaximized"),
  // ===== Shell Integration =====
  openExternal: (n) => e.invoke("shell:openExternal", n),
  showItemInFolder: (n) => e.invoke("shell:showItemInFolder", n),
  // ===== Backend Management =====
  backend: {
    getStatus: () => e.invoke("backend:getStatus"),
    start: () => e.invoke("backend:start"),
    stop: () => e.invoke("backend:stop"),
    onStatus: (n) => {
      const t = (r, o) => n(o);
      return e.on("backend:status", t), () => e.removeListener("backend:status", t);
    },
    onError: (n) => {
      const t = (r, o) => n(o);
      return e.on("backend:error", t), () => e.removeListener("backend:error", t);
    }
  },
  // ===== LLM Provider Management =====
  llm: {
    getStatus: () => e.invoke("llm:getStatus"),
    start: () => e.invoke("llm:start"),
    stop: () => e.invoke("llm:stop"),
    onStatus: (n) => {
      const t = (r, o) => n(o);
      return e.on("llm:status", t), () => e.removeListener("llm:status", t);
    },
    onError: (n) => {
      const t = (r, o) => n(o);
      return e.on("llm:error", t), () => e.removeListener("llm:error", t);
    }
  },
  // ===== Updater =====
  updater: {
    onUpdateAvailable: (n) => {
      const t = (r, o) => n(o);
      return e.on("updater:update-available", t), () => e.removeListener("updater:update-available", t);
    },
    onUpdateDownloaded: (n) => {
      const t = (r, o) => n(o);
      return e.on("updater:update-downloaded", t), () => e.removeListener("updater:update-downloaded", t);
    }
  },
  // ===== Menu Events =====
  onMenuNewProject: (n) => {
    const t = () => n();
    return e.on("menu:new-project", t), () => e.removeListener("menu:new-project", t);
  },
  onMenuOpenProject: (n) => {
    const t = (r, o) => n(o);
    return e.on("menu:open-project", t), () => e.removeListener("menu:open-project", t);
  }
});
a.exposeInMainWorld("isElectron", !0);
