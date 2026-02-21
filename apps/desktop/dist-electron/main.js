import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import pkg from "electron-updater";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { spawn } from "node:child_process";
const { autoUpdater } = pkg;
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname$1, "../public");
let mainWindow = null;
let backendProcess = null;
let llmProviderProcess = null;
let backendPort = 5e3;
let llmProviderPort = 8e3;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
function getBackendPath() {
  if (app.isPackaged) {
    const publishedPath = path.join(process.resourcesPath, "backend");
    if (fs.existsSync(path.join(publishedPath, "Maestro.Api.exe")) || fs.existsSync(path.join(publishedPath, "Maestro.Api"))) {
      return publishedPath;
    }
    return path.join(process.resourcesPath, "..", "backend", "src", "Maestro.Api");
  }
  return path.join(__dirname$1, "../../..", "apps", "backend", "src", "Maestro.Api");
}
function getLLMProviderPath() {
  const defaultPath = process.platform === "win32" ? "C:\\Meastro\\llm-provider" : "/opt/LLM-Provider";
  if (process.env.LLM_PROVIDER_PATH && fs.existsSync(process.env.LLM_PROVIDER_PATH)) {
    return process.env.LLM_PROVIDER_PATH;
  }
  return defaultPath;
}
async function startLLMProvider() {
  var _a, _b;
  const llmProviderPath = getLLMProviderPath();
  if (!fs.existsSync(llmProviderPath)) {
    console.log("LLM-Provider not found at:", llmProviderPath);
    return false;
  }
  if (await isPortInUse(llmProviderPort)) {
    console.log(`Port ${llmProviderPort} already in use, assuming LLM-Provider is running`);
    return true;
  }
  console.log("Starting LLM-Provider from:", llmProviderPath);
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  llmProviderProcess = spawn(pythonCmd, ["-m", "uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", String(llmProviderPort)], {
    cwd: llmProviderPath,
    shell: true,
    env: {
      ...process.env,
      LLM_PRELOAD_MODEL: process.env.LLM_PRELOAD_MODEL || "deepseek-ai/deepseek-coder-1.3b-instruct"
    }
  });
  (_a = llmProviderProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log("[LLM-Provider]", data.toString());
  });
  (_b = llmProviderProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.log("[LLM-Provider]", data.toString());
  });
  llmProviderProcess.on("error", (error) => {
    console.error("LLM-Provider start error:", error);
    mainWindow == null ? void 0 : mainWindow.webContents.send("llm:error", error.message);
  });
  llmProviderProcess.on("exit", (code) => {
    console.log("LLM-Provider exited with code:", code);
    mainWindow == null ? void 0 : mainWindow.webContents.send("llm:status", { running: false });
    llmProviderProcess = null;
  });
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    try {
      const http = require("http");
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${llmProviderPort}/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(1e3, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      console.log("LLM-Provider is ready!");
      mainWindow == null ? void 0 : mainWindow.webContents.send("llm:status", { running: true });
      return true;
    } catch {
      if (i % 10 === 0) {
        console.log(`Waiting for LLM-Provider... (${i}s)`);
      }
    }
  }
  console.error("LLM-Provider failed to start within timeout");
  return false;
}
async function isDotnetAvailable() {
  return new Promise((resolve) => {
    const proc = spawn("dotnet", ["--version"], { shell: true });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const net = require("net");
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}
async function startNativeBackend() {
  var _a, _b;
  const backendPath = getBackendPath();
  const csprojPath = path.join(backendPath, "Maestro.Api.csproj");
  if (!fs.existsSync(csprojPath)) {
    console.error("Backend project not found at:", csprojPath);
    return false;
  }
  if (await isPortInUse(backendPort)) {
    console.log(`Port ${backendPort} already in use, assuming backend is running`);
    return true;
  }
  console.log("Starting native backend from:", backendPath);
  backendProcess = spawn("dotnet", ["run", "--project", csprojPath], {
    shell: true,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://localhost:${backendPort}`,
      ASPNETCORE_ENVIRONMENT: "Development"
    }
  });
  (_a = backendProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log("[Backend]", data.toString());
  });
  (_b = backendProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error("[Backend Error]", data.toString());
  });
  backendProcess.on("error", (error) => {
    console.error("Backend start error:", error);
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:error", error.message);
  });
  backendProcess.on("exit", (code) => {
    console.log("Backend exited with code:", code);
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", { running: false });
    backendProcess = null;
  });
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    try {
      const http = require("http");
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${backendPort}/api/discovery/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(1e3, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      console.log("Backend is ready!");
      return true;
    } catch {
    }
  }
  console.error("Backend failed to start within timeout");
  return false;
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
      // Required for preload script to work properly
    },
    // Modern frameless window with custom title bar
    frame: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST, "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function createMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    // App menu (macOS only)
    ...isMac ? [
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    // File menu
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.send("menu:new-project");
          }
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
              title: "Select Project Folder"
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow == null ? void 0 : mainWindow.webContents.send("menu:open-project", result.filePaths[0]);
            }
          }
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" }
      ]
    },
    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...isMac ? [
          { type: "separator" },
          { role: "front" },
          { type: "separator" },
          { role: "window" }
        ] : [{ role: "close" }]
      ]
    },
    // Help menu
    {
      role: "help",
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            await shell.openExternal("https://github.com/maestro/docs");
          }
        },
        {
          label: "Report Issue",
          click: async () => {
            await shell.openExternal("https://github.com/maestro/issues");
          }
        },
        { type: "separator" },
        {
          label: "Check for Updates",
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
function registerIpcHandlers() {
  ipcMain.handle("dialog:showDirectoryPicker", async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: (options == null ? void 0 : options.title) || "Select Folder"
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
  ipcMain.handle(
    "dialog:showFilePicker",
    async (_event, options) => {
      const properties = ["openFile"];
      if (options == null ? void 0 : options.multiSelections) {
        properties.push("multiSelections");
      }
      const result = await dialog.showOpenDialog(mainWindow, {
        properties,
        title: (options == null ? void 0 : options.title) || "Select File",
        filters: options == null ? void 0 : options.filters
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return (options == null ? void 0 : options.multiSelections) ? result.filePaths : result.filePaths[0];
    }
  );
  ipcMain.handle("fs:readDirectory", async (_event, dirPath) => {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      }));
    } catch (error) {
      throw new Error(`Failed to read directory: ${error.message}`);
    }
  });
  ipcMain.handle("fs:pathExists", async (_event, filePath) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle("fs:getCommonPaths", async () => {
    const home = app.getPath("home");
    const paths = [];
    const standardPaths = [
      { name: "Home", key: "home", icon: "home" },
      { name: "Desktop", key: "desktop", icon: "desktop" },
      { name: "Documents", key: "documents", icon: "file-text" },
      { name: "Downloads", key: "downloads", icon: "download" },
      { name: "Pictures", key: "pictures", icon: "image" },
      { name: "Music", key: "music", icon: "music" },
      { name: "Videos", key: "videos", icon: "video" }
    ];
    for (const { name, key, icon } of standardPaths) {
      try {
        const p = app.getPath(key);
        if (fs.existsSync(p)) {
          paths.push({ name, path: p, icon });
        }
      } catch {
      }
    }
    const devDirs = [
      "Projects",
      "projects",
      "Development",
      "dev",
      "Code",
      "code",
      "workspace",
      "repos",
      "src"
    ];
    for (const dir of devDirs) {
      const devPath = path.join(home, dir);
      if (fs.existsSync(devPath) && !paths.some((p) => p.path === devPath)) {
        paths.push({ name: dir, path: devPath, icon: "code" });
      }
    }
    if (process.platform === "win32") {
      const oneDrivePath = path.join(home, "OneDrive");
      if (fs.existsSync(oneDrivePath)) {
        paths.push({ name: "OneDrive", path: oneDrivePath, icon: "cloud" });
      }
    }
    return paths;
  });
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:getPlatform", () => process.platform);
  ipcMain.handle("app:getAppPath", () => app.getAppPath());
  ipcMain.handle("app:isPackaged", () => app.isPackaged);
  ipcMain.handle("window:minimize", () => mainWindow == null ? void 0 : mainWindow.minimize());
  ipcMain.handle("window:maximize", () => {
    if (mainWindow == null ? void 0 : mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow == null ? void 0 : mainWindow.maximize();
    }
  });
  ipcMain.handle("window:close", () => mainWindow == null ? void 0 : mainWindow.close());
  ipcMain.handle("window:isMaximized", () => (mainWindow == null ? void 0 : mainWindow.isMaximized()) ?? false);
  ipcMain.handle("shell:openExternal", async (_event, url) => {
    await shell.openExternal(url);
  });
  ipcMain.handle("shell:showItemInFolder", (_event, filePath) => {
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle("backend:getStatus", () => {
    return {
      running: backendProcess !== null && !backendProcess.killed,
      pid: backendProcess == null ? void 0 : backendProcess.pid
    };
  });
  ipcMain.handle("backend:start", async () => {
    if (backendProcess && !backendProcess.killed) {
      return { success: true, message: "Backend already running" };
    }
    try {
      const projectRoot = app.isPackaged ? path.join(process.resourcesPath, "..") : path.join(__dirname$1, "../../..");
      backendProcess = spawn("docker-compose", ["up", "-d", "backend"], {
        cwd: projectRoot,
        shell: true
      });
      backendProcess.on("error", (error) => {
        console.error("Backend start error:", error);
        mainWindow == null ? void 0 : mainWindow.webContents.send("backend:error", error.message);
      });
      backendProcess.on("exit", (code) => {
        console.log("Backend exited with code:", code);
        mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", { running: false });
      });
      return { success: true, message: "Backend started" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle("backend:stop", async () => {
    if (!backendProcess || backendProcess.killed) {
      return { success: true, message: "Backend not running" };
    }
    try {
      const projectRoot = app.isPackaged ? path.join(process.resourcesPath, "..") : path.join(__dirname$1, "../../..");
      spawn("docker-compose", ["stop", "backend"], {
        cwd: projectRoot,
        shell: true
      });
      backendProcess = null;
      return { success: true, message: "Backend stopped" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle("llm:getStatus", async () => {
    try {
      const http = require("http");
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${llmProviderPort}/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(1e3, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      return { running: true, port: llmProviderPort };
    } catch {
      return { running: false, port: llmProviderPort };
    }
  });
  ipcMain.handle("llm:start", async () => {
    try {
      const success = await startLLMProvider();
      return { success, message: success ? "LLM-Provider started" : "Failed to start LLM-Provider" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
  ipcMain.handle("llm:stop", async () => {
    if (!llmProviderProcess || llmProviderProcess.killed) {
      return { success: true, message: "LLM-Provider not running" };
    }
    try {
      llmProviderProcess.kill();
      llmProviderProcess = null;
      return { success: true, message: "LLM-Provider stopped" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}
function initAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", (info) => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("updater:update-available", info);
  });
  autoUpdater.on("update-downloaded", (info) => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("updater:update-downloaded", info);
  });
  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error);
  });
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    registerIpcHandlers();
    createMenu();
    createWindow();
    initAutoUpdater();
    if (process.env.AUTO_START_LLM !== "false") {
      console.log("Auto-starting LLM-Provider...");
      startLLMProvider().then((success) => {
        if (success) {
          console.log("LLM-Provider auto-started successfully");
          mainWindow == null ? void 0 : mainWindow.webContents.send("llm:status", { running: true });
        } else {
          console.log("LLM-Provider auto-start failed (might need manual start)");
        }
      }).catch((error) => {
        console.error("LLM-Provider auto-start error:", error);
      });
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
  app.on("before-quit", () => {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
    }
    if (llmProviderProcess && !llmProviderProcess.killed) {
      llmProviderProcess.kill();
    }
  });
}
export {
  isDotnetAvailable,
  startLLMProvider,
  startNativeBackend
};
