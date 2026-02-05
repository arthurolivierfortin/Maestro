/**
 * Electron Main Process
 *
 * This is the entry point for the Electron application.
 * It manages the application lifecycle, creates windows, and handles IPC.
 */

import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, '../public');

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let llmProviderProcess: ChildProcess | null = null;
let backendPort = 5000;
let llmProviderPort = 8000;

// Vite dev server URL (set by vite-plugin-electron)
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/**
 * Find the backend project path
 */
function getBackendPath(): string {
  const projectRoot = app.isPackaged
    ? path.join(process.resourcesPath, '..')
    : path.join(__dirname, '../../..');

  return path.join(projectRoot, 'backend', 'src', 'Maestro.Api');
}

/**
 * Find the LLM-Provider path
 */
function getLLMProviderPath(): string {
  // LLM-Provider is expected to be at C:\LLM-Provider
  // In production, it might be bundled differently
  const defaultPath = process.platform === 'win32' ? 'C:\\LLM-Provider' : '/opt/LLM-Provider';

  // Check if LLM_PROVIDER_PATH env var is set
  if (process.env.LLM_PROVIDER_PATH && fs.existsSync(process.env.LLM_PROVIDER_PATH)) {
    return process.env.LLM_PROVIDER_PATH;
  }

  return defaultPath;
}

/**
 * Start the LLM-Provider Python server
 */
export async function startLLMProvider(): Promise<boolean> {
  const llmProviderPath = getLLMProviderPath();

  if (!fs.existsSync(llmProviderPath)) {
    console.log('LLM-Provider not found at:', llmProviderPath);
    return false;
  }

  // Check if port is already in use (LLM-Provider might already be running)
  if (await isPortInUse(llmProviderPort)) {
    console.log(`Port ${llmProviderPort} already in use, assuming LLM-Provider is running`);
    return true;
  }

  console.log('Starting LLM-Provider from:', llmProviderPath);

  // Start Python uvicorn server
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  llmProviderProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'api.server:app', '--host', '0.0.0.0', '--port', String(llmProviderPort)], {
    cwd: llmProviderPath,
    shell: true,
    env: {
      ...process.env,
      LLM_PRELOAD_MODEL: process.env.LLM_PRELOAD_MODEL || 'deepseek-ai/deepseek-coder-1.3b-instruct',
    },
  });

  llmProviderProcess.stdout?.on('data', (data) => {
    console.log('[LLM-Provider]', data.toString());
  });

  llmProviderProcess.stderr?.on('data', (data) => {
    // uvicorn logs to stderr by default, so we'll log as info
    console.log('[LLM-Provider]', data.toString());
  });

  llmProviderProcess.on('error', (error) => {
    console.error('LLM-Provider start error:', error);
    mainWindow?.webContents.send('llm:error', error.message);
  });

  llmProviderProcess.on('exit', (code) => {
    console.log('LLM-Provider exited with code:', code);
    mainWindow?.webContents.send('llm:status', { running: false });
    llmProviderProcess = null;
  });

  // Wait for LLM-Provider to be ready
  const maxAttempts = 60; // 60 seconds timeout (model loading can take time)
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const http = require('http');
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${llmProviderPort}/health`, (res: any) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log('LLM-Provider is ready!');
      mainWindow?.webContents.send('llm:status', { running: true });
      return true;
    } catch {
      // Keep waiting
      if (i % 10 === 0) {
        console.log(`Waiting for LLM-Provider... (${i}s)`);
      }
    }
  }

  console.error('LLM-Provider failed to start within timeout');
  return false;
}

/**
 * Check if dotnet is available
 * @internal Reserved for future use
 */
export async function isDotnetAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('dotnet', ['--version'], { shell: true });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Check if a port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

/**
 * Start the backend as a native dotnet process
 * @internal Reserved for future use
 */
export async function startNativeBackend(): Promise<boolean> {
  const backendPath = getBackendPath();
  const csprojPath = path.join(backendPath, 'Maestro.Api.csproj');

  if (!fs.existsSync(csprojPath)) {
    console.error('Backend project not found at:', csprojPath);
    return false;
  }

  // Check if port is already in use (backend might already be running)
  if (await isPortInUse(backendPort)) {
    console.log(`Port ${backendPort} already in use, assuming backend is running`);
    return true;
  }

  console.log('Starting native backend from:', backendPath);

  // Start dotnet run
  backendProcess = spawn('dotnet', ['run', '--project', csprojPath], {
    shell: true,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://localhost:${backendPort}`,
      ASPNETCORE_ENVIRONMENT: 'Development',
    },
  });

  backendProcess.stdout?.on('data', (data) => {
    console.log('[Backend]', data.toString());
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error('[Backend Error]', data.toString());
  });

  backendProcess.on('error', (error) => {
    console.error('Backend start error:', error);
    mainWindow?.webContents.send('backend:error', error.message);
  });

  backendProcess.on('exit', (code) => {
    console.log('Backend exited with code:', code);
    mainWindow?.webContents.send('backend:status', { running: false });
    backendProcess = null;
  });

  // Wait for backend to be ready
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const http = require('http');
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${backendPort}/api/discovery/health`, (res: any) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log('Backend is ready!');
      return true;
    } catch {
      // Keep waiting
    }
  }

  console.error('Backend failed to start within timeout');
  return false;
}

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(process.env.VITE_PUBLIC!, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload script to work properly
    },
    // Modern frameless window with custom title bar
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create the application menu
 */
function createMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-project');
          },
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openDirectory'],
              title: 'Select Project Folder',
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('menu:open-project', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'delete' as const },
        { type: 'separator' as const },
        { role: 'selectAll' as const },
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help menu
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/maestro/docs');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/maestro/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Register IPC handlers for native functionality
 */
function registerIpcHandlers(): void {
  // ===== File System Operations =====

  // Show native directory picker
  ipcMain.handle('dialog:showDirectoryPicker', async (_event, options?: { title?: string }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: options?.title || 'Select Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Show native file picker
  ipcMain.handle(
    'dialog:showFilePicker',
    async (
      _event,
      options?: {
        title?: string;
        filters?: { name: string; extensions: string[] }[];
        multiSelections?: boolean;
      }
    ) => {
      const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
      if (options?.multiSelections) {
        properties.push('multiSelections');
      }

      const result = await dialog.showOpenDialog(mainWindow!, {
        properties,
        title: options?.title || 'Select File',
        filters: options?.filters,
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return options?.multiSelections ? result.filePaths : result.filePaths[0];
    }
  );

  // Read directory contents
  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
    } catch (error) {
      throw new Error(`Failed to read directory: ${(error as Error).message}`);
    }
  });

  // Check if path exists
  ipcMain.handle('fs:pathExists', async (_event, filePath: string) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // Get common directories
  ipcMain.handle('fs:getCommonPaths', async () => {
    const home = app.getPath('home');
    const paths: { name: string; path: string; icon: string }[] = [];

    // Add standard paths
    const standardPaths = [
      { name: 'Home', key: 'home' as const, icon: 'home' },
      { name: 'Desktop', key: 'desktop' as const, icon: 'desktop' },
      { name: 'Documents', key: 'documents' as const, icon: 'file-text' },
      { name: 'Downloads', key: 'downloads' as const, icon: 'download' },
      { name: 'Pictures', key: 'pictures' as const, icon: 'image' },
      { name: 'Music', key: 'music' as const, icon: 'music' },
      { name: 'Videos', key: 'videos' as const, icon: 'video' },
    ];

    for (const { name, key, icon } of standardPaths) {
      try {
        const p = app.getPath(key);
        if (fs.existsSync(p)) {
          paths.push({ name, path: p, icon });
        }
      } catch {
        // Path not available on this platform
      }
    }

    // Add common dev directories
    const devDirs = [
      'Projects',
      'projects',
      'Development',
      'dev',
      'Code',
      'code',
      'workspace',
      'repos',
      'src',
    ];

    for (const dir of devDirs) {
      const devPath = path.join(home, dir);
      if (fs.existsSync(devPath) && !paths.some((p) => p.path === devPath)) {
        paths.push({ name: dir, path: devPath, icon: 'code' });
      }
    }

    // Add OneDrive on Windows
    if (process.platform === 'win32') {
      const oneDrivePath = path.join(home, 'OneDrive');
      if (fs.existsSync(oneDrivePath)) {
        paths.push({ name: 'OneDrive', path: oneDrivePath, icon: 'cloud' });
      }
    }

    return paths;
  });

  // ===== Application Info =====

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:getAppPath', () => app.getAppPath());
  ipcMain.handle('app:isPackaged', () => app.isPackaged);

  // ===== Window Controls =====

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // ===== Shell Integration =====

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:showItemInFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // ===== Backend Management =====

  ipcMain.handle('backend:getStatus', () => {
    return {
      running: backendProcess !== null && !backendProcess.killed,
      pid: backendProcess?.pid,
    };
  });

  ipcMain.handle('backend:start', async () => {
    if (backendProcess && !backendProcess.killed) {
      return { success: true, message: 'Backend already running' };
    }

    try {
      // Try to start backend via docker-compose
      const projectRoot = app.isPackaged
        ? path.join(process.resourcesPath, '..')
        : path.join(__dirname, '../../..');

      backendProcess = spawn('docker-compose', ['up', '-d', 'backend'], {
        cwd: projectRoot,
        shell: true,
      });

      backendProcess.on('error', (error) => {
        console.error('Backend start error:', error);
        mainWindow?.webContents.send('backend:error', error.message);
      });

      backendProcess.on('exit', (code) => {
        console.log('Backend exited with code:', code);
        mainWindow?.webContents.send('backend:status', { running: false });
      });

      return { success: true, message: 'Backend started' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('backend:stop', async () => {
    if (!backendProcess || backendProcess.killed) {
      return { success: true, message: 'Backend not running' };
    }

    try {
      const projectRoot = app.isPackaged
        ? path.join(process.resourcesPath, '..')
        : path.join(__dirname, '../../..');

      spawn('docker-compose', ['stop', 'backend'], {
        cwd: projectRoot,
        shell: true,
      });

      backendProcess = null;
      return { success: true, message: 'Backend stopped' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  // ===== LLM-Provider Management =====

  ipcMain.handle('llm:getStatus', async () => {
    // Check if LLM-Provider is running by pinging health endpoint
    try {
      const http = require('http');
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${llmProviderPort}/health`, (res: any) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return { running: true, port: llmProviderPort };
    } catch {
      return { running: false, port: llmProviderPort };
    }
  });

  ipcMain.handle('llm:start', async () => {
    try {
      const success = await startLLMProvider();
      return { success, message: success ? 'LLM-Provider started' : 'Failed to start LLM-Provider' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('llm:stop', async () => {
    if (!llmProviderProcess || llmProviderProcess.killed) {
      return { success: true, message: 'LLM-Provider not running' };
    }

    try {
      llmProviderProcess.kill();
      llmProviderProcess = null;
      return { success: true, message: 'LLM-Provider stopped' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });
}

/**
 * Initialize auto-updater
 */
function initAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:update-downloaded', info);
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });

  // Check for updates after app is ready (not in dev mode)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// ===== App Lifecycle =====

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus main window if user tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App ready
  app.whenReady().then(async () => {
    registerIpcHandlers();
    createMenu();
    createWindow();
    initAutoUpdater();

    // Auto-start LLM-Provider if AUTO_START_LLM is not explicitly false
    if (process.env.AUTO_START_LLM !== 'false') {
      console.log('Auto-starting LLM-Provider...');
      startLLMProvider().then((success) => {
        if (success) {
          console.log('LLM-Provider auto-started successfully');
          mainWindow?.webContents.send('llm:status', { running: true });
        } else {
          console.log('LLM-Provider auto-start failed (might need manual start)');
        }
      }).catch((error) => {
        console.error('LLM-Provider auto-start error:', error);
      });
    }

    app.on('activate', () => {
      // macOS: recreate window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Quit when all windows are closed (except on macOS)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Clean up backend and LLM-Provider on app quit
  app.on('before-quit', () => {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
    }
    if (llmProviderProcess && !llmProviderProcess.killed) {
      llmProviderProcess.kill();
    }
  });
}
