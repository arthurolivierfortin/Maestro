import { app as c, BrowserWindow as x, ipcMain as l, dialog as M, shell as L, Menu as E } from "electron";
import _ from "electron-updater";
import i from "node:path";
import { fileURLToPath as A } from "node:url";
import h from "node:fs";
import { spawn as w } from "node:child_process";
const { autoUpdater: g } = _, k = i.dirname(A(import.meta.url));
process.env.DIST = i.join(k, "../dist");
process.env.VITE_PUBLIC = c.isPackaged ? process.env.DIST : i.join(k, "../public");
let e = null, a = null, u = null, b = 5e3, P = 8e3;
const S = process.env.VITE_DEV_SERVER_URL;
function j() {
  if (c.isPackaged) {
    const t = i.join(process.resourcesPath, "backend");
    return h.existsSync(i.join(t, "Maestro.Api.exe")) || h.existsSync(i.join(t, "Maestro.Api")) ? t : i.join(process.resourcesPath, "..", "backend", "src", "Maestro.Api");
  }
  return i.join(k, "../../..", "apps", "backend", "src", "Maestro.Api");
}
function I() {
  const t = process.platform === "win32" ? "C:\\LLM-Provider" : "/opt/LLM-Provider";
  return process.env.LLM_PROVIDER_PATH && h.existsSync(process.env.LLM_PROVIDER_PATH) ? process.env.LLM_PROVIDER_PATH : t;
}
async function C() {
  var s, d;
  const t = I();
  if (!h.existsSync(t))
    return console.log("LLM-Provider not found at:", t), !1;
  if (await T(P))
    return console.log(`Port ${P} already in use, assuming LLM-Provider is running`), !0;
  console.log("Starting LLM-Provider from:", t);
  const r = process.platform === "win32" ? "python" : "python3";
  u = w(r, ["-m", "uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", String(P)], {
    cwd: t,
    shell: !0,
    env: {
      ...process.env,
      LLM_PRELOAD_MODEL: process.env.LLM_PRELOAD_MODEL || "deepseek-ai/deepseek-coder-1.3b-instruct"
    }
  }), (s = u.stdout) == null || s.on("data", (o) => {
    console.log("[LLM-Provider]", o.toString());
  }), (d = u.stderr) == null || d.on("data", (o) => {
    console.log("[LLM-Provider]", o.toString());
  }), u.on("error", (o) => {
    console.error("LLM-Provider start error:", o), e == null || e.webContents.send("llm:error", o.message);
  }), u.on("exit", (o) => {
    console.log("LLM-Provider exited with code:", o), e == null || e.webContents.send("llm:status", { running: !1 }), u = null;
  });
  const n = 60;
  for (let o = 0; o < n; o++) {
    await new Promise((p) => setTimeout(p, 1e3));
    try {
      const p = require("http");
      return await new Promise((y, m) => {
        const f = p.get(`http://localhost:${P}/health`, (v) => {
          v.statusCode === 200 ? y() : m(new Error(`Status ${v.statusCode}`));
        });
        f.on("error", m), f.setTimeout(1e3, () => {
          f.destroy(), m(new Error("Timeout"));
        });
      }), console.log("LLM-Provider is ready!"), e == null || e.webContents.send("llm:status", { running: !0 }), !0;
    } catch {
      o % 10 === 0 && console.log(`Waiting for LLM-Provider... (${o}s)`);
    }
  }
  return console.error("LLM-Provider failed to start within timeout"), !1;
}
async function H() {
  return new Promise((t) => {
    const r = w("dotnet", ["--version"], { shell: !0 });
    r.on("close", (n) => t(n === 0)), r.on("error", () => t(!1));
  });
}
async function T(t) {
  return new Promise((r) => {
    const s = require("net").createServer();
    s.once("error", () => r(!0)), s.once("listening", () => {
      s.close(), r(!1);
    }), s.listen(t);
  });
}
async function Q() {
  var s, d;
  const t = j(), r = i.join(t, "Maestro.Api.csproj");
  if (!h.existsSync(r))
    return console.error("Backend project not found at:", r), !1;
  if (await T(b))
    return console.log(`Port ${b} already in use, assuming backend is running`), !0;
  console.log("Starting native backend from:", t), a = w("dotnet", ["run", "--project", r], {
    shell: !0,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://localhost:${b}`,
      ASPNETCORE_ENVIRONMENT: "Development"
    }
  }), (s = a.stdout) == null || s.on("data", (o) => {
    console.log("[Backend]", o.toString());
  }), (d = a.stderr) == null || d.on("data", (o) => {
    console.error("[Backend Error]", o.toString());
  }), a.on("error", (o) => {
    console.error("Backend start error:", o), e == null || e.webContents.send("backend:error", o.message);
  }), a.on("exit", (o) => {
    console.log("Backend exited with code:", o), e == null || e.webContents.send("backend:status", { running: !1 }), a = null;
  });
  const n = 30;
  for (let o = 0; o < n; o++) {
    await new Promise((p) => setTimeout(p, 1e3));
    try {
      const p = require("http");
      return await new Promise((y, m) => {
        const f = p.get(`http://localhost:${b}/api/discovery/health`, (v) => {
          v.statusCode === 200 ? y() : m(new Error(`Status ${v.statusCode}`));
        });
        f.on("error", m), f.setTimeout(1e3, () => {
          f.destroy(), m(new Error("Timeout"));
        });
      }), console.log("Backend is ready!"), !0;
    } catch {
    }
  }
  return console.error("Backend failed to start within timeout"), !1;
}
function D() {
  e = new x({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: i.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: i.join(k, "preload.js"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
      // Required for preload script to work properly
    },
    // Modern frameless window with custom title bar
    frame: !0,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: !1
  }), e.once("ready-to-show", () => {
    e == null || e.show();
  }), e.webContents.setWindowOpenHandler(({ url: t }) => (L.openExternal(t), { action: "deny" })), S ? (e.loadURL(S), e.webContents.openDevTools()) : e.loadFile(i.join(process.env.DIST, "index.html")), e.on("closed", () => {
    e = null;
  });
}
function R() {
  const t = process.platform === "darwin", r = [
    // App menu (macOS only)
    ...t ? [
      {
        label: c.name,
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
            e == null || e.webContents.send("menu:new-project");
          }
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const s = await M.showOpenDialog(e, {
              properties: ["openDirectory"],
              title: "Select Project Folder"
            });
            !s.canceled && s.filePaths.length > 0 && (e == null || e.webContents.send("menu:open-project", s.filePaths[0]));
          }
        },
        { type: "separator" },
        t ? { role: "close" } : { role: "quit" }
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
        ...t ? [
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
            await L.openExternal("https://github.com/maestro/docs");
          }
        },
        {
          label: "Report Issue",
          click: async () => {
            await L.openExternal("https://github.com/maestro/issues");
          }
        },
        { type: "separator" },
        {
          label: "Check for Updates",
          click: () => {
            g.checkForUpdatesAndNotify();
          }
        }
      ]
    }
  ], n = E.buildFromTemplate(r);
  E.setApplicationMenu(n);
}
function O() {
  l.handle("dialog:showDirectoryPicker", async (t, r) => {
    const n = await M.showOpenDialog(e, {
      properties: ["openDirectory", "createDirectory"],
      title: (r == null ? void 0 : r.title) || "Select Folder"
    });
    return n.canceled || n.filePaths.length === 0 ? null : n.filePaths[0];
  }), l.handle(
    "dialog:showFilePicker",
    async (t, r) => {
      const n = ["openFile"];
      r != null && r.multiSelections && n.push("multiSelections");
      const s = await M.showOpenDialog(e, {
        properties: n,
        title: (r == null ? void 0 : r.title) || "Select File",
        filters: r == null ? void 0 : r.filters
      });
      return s.canceled || s.filePaths.length === 0 ? null : r != null && r.multiSelections ? s.filePaths : s.filePaths[0];
    }
  ), l.handle("fs:readDirectory", async (t, r) => {
    try {
      return (await h.promises.readdir(r, { withFileTypes: !0 })).map((s) => ({
        name: s.name,
        path: i.join(r, s.name),
        isDirectory: s.isDirectory(),
        isFile: s.isFile()
      }));
    } catch (n) {
      throw new Error(`Failed to read directory: ${n.message}`);
    }
  }), l.handle("fs:pathExists", async (t, r) => {
    try {
      return await h.promises.access(r), !0;
    } catch {
      return !1;
    }
  }), l.handle("fs:getCommonPaths", async () => {
    const t = c.getPath("home"), r = [], n = [
      { name: "Home", key: "home", icon: "home" },
      { name: "Desktop", key: "desktop", icon: "desktop" },
      { name: "Documents", key: "documents", icon: "file-text" },
      { name: "Downloads", key: "downloads", icon: "download" },
      { name: "Pictures", key: "pictures", icon: "image" },
      { name: "Music", key: "music", icon: "music" },
      { name: "Videos", key: "videos", icon: "video" }
    ];
    for (const { name: d, key: o, icon: p } of n)
      try {
        const y = c.getPath(o);
        h.existsSync(y) && r.push({ name: d, path: y, icon: p });
      } catch {
      }
    const s = [
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
    for (const d of s) {
      const o = i.join(t, d);
      h.existsSync(o) && !r.some((p) => p.path === o) && r.push({ name: d, path: o, icon: "code" });
    }
    if (process.platform === "win32") {
      const d = i.join(t, "OneDrive");
      h.existsSync(d) && r.push({ name: "OneDrive", path: d, icon: "cloud" });
    }
    return r;
  }), l.handle("app:getVersion", () => c.getVersion()), l.handle("app:getPlatform", () => process.platform), l.handle("app:getAppPath", () => c.getAppPath()), l.handle("app:isPackaged", () => c.isPackaged), l.handle("window:minimize", () => e == null ? void 0 : e.minimize()), l.handle("window:maximize", () => {
    e != null && e.isMaximized() ? e.unmaximize() : e == null || e.maximize();
  }), l.handle("window:close", () => e == null ? void 0 : e.close()), l.handle("window:isMaximized", () => (e == null ? void 0 : e.isMaximized()) ?? !1), l.handle("shell:openExternal", async (t, r) => {
    await L.openExternal(r);
  }), l.handle("shell:showItemInFolder", (t, r) => {
    L.showItemInFolder(r);
  }), l.handle("backend:getStatus", () => ({
    running: a !== null && !a.killed,
    pid: a == null ? void 0 : a.pid
  })), l.handle("backend:start", async () => {
    if (a && !a.killed)
      return { success: !0, message: "Backend already running" };
    try {
      const t = c.isPackaged ? i.join(process.resourcesPath, "..") : i.join(k, "../../..");
      return a = w("docker-compose", ["up", "-d", "backend"], {
        cwd: t,
        shell: !0
      }), a.on("error", (r) => {
        console.error("Backend start error:", r), e == null || e.webContents.send("backend:error", r.message);
      }), a.on("exit", (r) => {
        console.log("Backend exited with code:", r), e == null || e.webContents.send("backend:status", { running: !1 });
      }), { success: !0, message: "Backend started" };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), l.handle("backend:stop", async () => {
    if (!a || a.killed)
      return { success: !0, message: "Backend not running" };
    try {
      const t = c.isPackaged ? i.join(process.resourcesPath, "..") : i.join(k, "../../..");
      return w("docker-compose", ["stop", "backend"], {
        cwd: t,
        shell: !0
      }), a = null, { success: !0, message: "Backend stopped" };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), l.handle("llm:getStatus", async () => {
    try {
      const t = require("http");
      return await new Promise((r, n) => {
        const s = t.get(`http://localhost:${P}/health`, (d) => {
          d.statusCode === 200 ? r() : n(new Error(`Status ${d.statusCode}`));
        });
        s.on("error", n), s.setTimeout(1e3, () => {
          s.destroy(), n(new Error("Timeout"));
        });
      }), { running: !0, port: P };
    } catch {
      return { running: !1, port: P };
    }
  }), l.handle("llm:start", async () => {
    try {
      const t = await C();
      return { success: t, message: t ? "LLM-Provider started" : "Failed to start LLM-Provider" };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), l.handle("llm:stop", async () => {
    if (!u || u.killed)
      return { success: !0, message: "LLM-Provider not running" };
    try {
      return u.kill(), u = null, { success: !0, message: "LLM-Provider stopped" };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  });
}
function B() {
  g.autoDownload = !1, g.autoInstallOnAppQuit = !0, g.on("update-available", (t) => {
    e == null || e.webContents.send("updater:update-available", t);
  }), g.on("update-downloaded", (t) => {
    e == null || e.webContents.send("updater:update-downloaded", t);
  }), g.on("error", (t) => {
    console.error("Auto-updater error:", t);
  }), c.isPackaged && g.checkForUpdatesAndNotify();
}
const F = c.requestSingleInstanceLock();
F ? (c.on("second-instance", () => {
  e && (e.isMinimized() && e.restore(), e.focus());
}), c.whenReady().then(async () => {
  O(), R(), D(), B(), process.env.AUTO_START_LLM !== "false" && (console.log("Auto-starting LLM-Provider..."), C().then((t) => {
    t ? (console.log("LLM-Provider auto-started successfully"), e == null || e.webContents.send("llm:status", { running: !0 })) : console.log("LLM-Provider auto-start failed (might need manual start)");
  }).catch((t) => {
    console.error("LLM-Provider auto-start error:", t);
  })), c.on("activate", () => {
    x.getAllWindows().length === 0 && D();
  });
}), c.on("window-all-closed", () => {
  process.platform !== "darwin" && c.quit();
}), c.on("before-quit", () => {
  a && !a.killed && a.kill(), u && !u.killed && u.kill();
})) : c.quit();
export {
  H as isDotnetAvailable,
  C as startLLMProvider,
  Q as startNativeBackend
};
