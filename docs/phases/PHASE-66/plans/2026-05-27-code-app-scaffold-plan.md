# Plan — Scaffold apps/code/

**Issue:** #60
**Spec:** `docs/phases/PHASE-66/specs/2026-05-27-code-app-scaffold-design.md`
**Checklist:** `docs/phases/PHASE-66/specs/2026-05-27-code-app-scaffold-checklist.md`
**Tags:** [code-app]
**Researcher:** 2026-05-27

---

## Corrections a la spec (IMPORTANT)

### Versions packages — la spec est FAUSSE sur plusieurs points

La spec mentionne "Vite 6, Electron 33, TypeScript 5.7, React 19". Les versions npm latest sont tres differentes :
- **Vite** : latest = 8.0.14, Vite 6 latest = 6.4.2
- **Electron** : latest = 42.3.0, Electron 33 latest = 33.4.11
- **TypeScript** : latest = 6.0.3, TS 5.7 latest = 5.7.2
- **React** : latest 19.x = 19.1.1 (pas de breaking change dans la range 19)

**Decision : aligner sur les memes ranges que `apps/desktop/package.json`** pour coherence et faciliter la factorisation future en `packages/code-core/` (Phase 78). `apps/desktop` utilise `^6.0.3` (Vite), `^33.2.1` (Electron), `^5.7.2` (TS), et React 18 (`^18.3.1`).

Pour `apps/code`, on utilise les **memes ranges de versions majeures** que desktop, mais avec React 19 comme requis par la spec :
- `react` / `react-dom` : `^19.1.0` (derniere stable 19.x)
- `vite` : `^6.4.2` (aligne avec desktop Vite 6)
- `electron` : `^33.4.11` (aligne avec desktop Electron 33)
- `typescript` : `^5.7.2` (aligne avec desktop)
- `vitest` : `^4.1.7`
- `vite-plugin-electron` : `^0.29.1`
- `vite-plugin-electron-renderer` : `^0.14.7`
- `@vitejs/plugin-react` : `^4.3.4` (aligne avec desktop ; la v6 requiert Vite 7+)
- `@testing-library/react` : `^16.3.2`
- `jsdom` : `^29.1.1`
- `@types/react` : `^19.1.0` (PAS `^18.3.12` — doit matcher React 19)
- `@types/react-dom` : `^19.1.0`

### Fichier CSS theme (`mock/claude-design/pure-theme.css`)

Ce fichier **n'existe pas** dans le repository. Le dossier `mock/` n'existe pas non plus. Il n'y a aucun fichier CSS theme TUI dans le projet (ni dans `packages/maestro-code/`, ni dans `apps/desktop/`). Le builder doit creer `tui-theme.css` from scratch avec les couleurs definies dans la spec (SPEC-7/SPEC-8). Les couleurs sont documentees dans la spec directement.

### Proxy Vite — pas present dans apps/desktop

`apps/desktop/vite.config.ts` n'a **pas** de proxy `/api`. Il utilise `API_URL` hardcode dans les services (`http://localhost:5000`). Pour `apps/code`, la spec demande un proxy Vite — c'est une bonne decision (evite CORS). Le builder l'ajoute dans `vite.config.ts`.

### Backend API verification

Le `ChatController.cs` (lignes 64-116) confirme :
- **POST `/api/chat/stream`** : accepte `ChatCompletionRequest` avec `{ messages: [{role, content}], model?, temperature?, maxTokens? }` — JSON camelCase via `JsonNamingPolicy.CamelCase`
- Retourne SSE `text/event-stream` avec `data: {"content":"..."}\n\n` et `data: [DONE]\n\n`
- Erreurs retournees inline SSE : `data: {"error":"...", "details":"..."}\n\n`
- **POST `/api/chat/completions`** : meme body, retourne `{ content, model, promptTokens, completionTokens, totalTokens }` (camelCase)

Le `chatService.ts` de `apps/desktop` est **100% compatible** avec ce controller. Pas d'adaptation du format de requete/reponse necessaire.

### `dev:web` script sur Windows

`apps/desktop` utilise `ELECTRON_DISABLE=true vite` — syntaxe Unix qui ne fonctionne pas sur Windows. Pour `apps/code`, utiliser `cross-env` ou la meme approche que desktop (qui fonctionne car Vite tourne dans un env Unix-like avec vite-plugin-electron qui gere le flag). Meme pattern que desktop : `ELECTRON_DISABLE=true vite`. Ajouter `cross-env` si besoin.

---

## SPEC-1 — package.json

**Tag:** [code-app]
**File:** `apps/code/package.json`
**Existing pattern:** `apps/desktop/package.json` (lignes 1-152)
**Pitfalls:** 
- SDK/backend type mismatch — les types React doivent etre `@types/react@^19` pas `@types/react@^18`
- `@ts-nocheck` — le `type-check` script doit utiliser `tsc --noEmit`, pas `tsc --noEmit || true`

### Step 1.1 — Le fichier a creer

```json
{
  "name": "maestro-code",
  "version": "0.1.0",
  "description": "Maestro Code - React Desktop with TUI Aesthetic",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "dev:web": "ELECTRON_DISABLE=true vite",
    "build": "tsc --noEmit && vite build",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^33.4.11",
    "jsdom": "^29.1.1",
    "typescript": "^5.7.2",
    "vite": "^6.4.2",
    "vite-plugin-electron": "^0.29.1",
    "vite-plugin-electron-renderer": "^0.14.7",
    "vitest": "^4.1.7"
  }
}
```

### Step 1.2 — Verification
```bash
cd apps/code && cat package.json | python -c "import sys,json; json.load(sys.stdin); print('valid JSON')"
```

---

## SPEC-2 — vite.config.ts

**Tag:** [code-app]
**File:** `apps/code/vite.config.ts`
**Existing pattern:** `apps/desktop/vite.config.ts` (lignes 1-93)
**Pitfalls:** Proxy Vite mal configure = requetes chat echouent silencieusement

### Adaptations par rapport a desktop

1. **Port** : 5174 (pas 5173)
2. **Proxy** : ajouter `server.proxy` pour `/api` vers `http://localhost:5000` (desktop n'a pas de proxy)
3. **Aliases** : simplifier — seulement `@/` vers `src/` (pas besoin de `@components`, `@services`, `@shared`, etc.)
4. **Pas de `renderer()`** : ne pas inclure `vite-plugin-electron-renderer` car on n'a pas besoin de Node.js APIs dans le renderer. apps/code est un pur navigateur web dans Electron.
5. **Pas de `manualChunks`** : on n'a pas react-router-dom, zustand, axios
6. **`ELECTRON_DISABLE` pattern** : copier exactement le pattern de desktop

### Code

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

const isElectronDisabled = process.env.ELECTRON_DISABLE === 'true';

export default defineConfig({
  plugins: [
    react(),
    ...(!isElectronDisabled
      ? [
          electron([
            {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  rollupOptions: {
                    external: ['electron'],
                    output: { format: 'cjs' },
                  },
                },
              },
            },
            {
              entry: 'electron/preload.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  rollupOptions: {
                    external: ['electron'],
                    output: { format: 'cjs' },
                  },
                },
              },
              onstart(options) {
                options.reload();
              },
            },
          ]),
        ]
      : []),
  ],
  server: {
    port: 5174,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### Step 2.1 — Verification
```bash
cd apps/code && npx tsc --noEmit
```

---

## SPEC-3 — tsconfig.json + tsconfig.node.json

**Tag:** [code-app]
**File:** `apps/code/tsconfig.json`, `apps/code/tsconfig.node.json`
**Existing pattern:** `apps/desktop/tsconfig.json` (lignes 1-43), `apps/desktop/tsconfig.node.json` (lignes 1-22)

### tsconfig.json — adaptations

1. **Pas de `@shared/*`** alias (pas de dependance vers `packages/tui`)
2. **Pas d'include de `../../packages/tui/`** (c'est specifique a desktop)
3. **`@types/react`** doit pointer vers les types React 19, pas React 18 — ne PAS ajouter de paths override `"react": ["./node_modules/@types/react"]` (la resolution par defaut suffit avec `@types/react@^19`)
4. Garder les memes options strict (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
5. Seulement l'alias `@/*` vers `./src/*`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### tsconfig.node.json — copie exacte de desktop

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "composite": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

---

## SPEC-4 — index.html + main.tsx

**Tag:** [code-app]
**File:** `apps/code/index.html`, `apps/code/src/main.tsx`
**Existing pattern:** `apps/desktop/index.html` (lignes 1-14)

### index.html

Copie de desktop avec modifications :
- Titre : "Maestro Code" (pas "B-One Maestro")
- Google Fonts link pour JetBrains Mono dans `<head>` (alternative CDN au lieu de fichier WOFF2 local pour simplifier le scaffold)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
    <title>Maestro Code</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### main.tsx

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tui-theme.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

## SPEC-5 — electron/main.ts

**Tag:** [code-app]
**File:** `apps/code/electron/main.ts`
**Existing pattern:** `apps/desktop/electron/main.ts` (805 lignes)
**Pitfalls:** Ne PAS copier le backend/LLM-Provider management de desktop. Le main.ts de apps/code doit etre minimal.

### Adaptation critique — ce qui est COPIE de desktop vs ce qui est EXCLUS

**COPIE (adapte) :**
- `createWindow()` (lignes 268-311) — BrowserWindow 1400x900, minWidth/minHeight, preload, contextIsolation, ready-to-show, load dev URL ou dist/index.html
- Single instance lock (lignes 745-804) — `app.requestSingleInstanceLock()`
- Menu basique : Edit + View + Window seulement (sous-ensemble des lignes 316-442 de desktop)
- `window-all-closed` handler
- `activate` handler (macOS)

**EXCLUS (ne PAS copier) :**
- `getBackendPath()`, `getLLMProviderPath()` (lignes 45-75)
- `startLLMProvider()`, `startNativeBackend()`, `isPortInUse()`, `isDotnetAvailable()` (lignes 80-263)
- `registerIpcHandlers()` complet (lignes 447-715) — dialog, fs, backend management, LLM management
- `initAutoUpdater()` (lignes 720-740)
- `electron-updater` import
- Auto-start LLM-Provider (lignes 766-778)
- `before-quit` cleanup processes (lignes 796-803)
- Variables `backendProcess`, `llmProviderProcess`, `backendPort`, `llmProviderPort`

### Code (environ 100 lignes vs 805 dans desktop)

```typescript
import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, '../public');

let mainWindow: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
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
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
```

---

## SPEC-6 — electron/preload.ts

**Tag:** [code-app]
**File:** `apps/code/electron/preload.ts`
**Existing pattern:** `apps/desktop/electron/preload.ts` (174 lignes)

### Adaptation — version minimale

Desktop expose 70+ API (fs, dialog, window, backend, llm, updater, menu). apps/code expose SEULEMENT `isElectron: true`.

```typescript
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('isElectron', true);
```

C'est tout. 3 lignes vs 174 dans desktop.

---

## SPEC-7 — tui-theme.css

**Tag:** [code-app]
**File:** `apps/code/src/theme/tui-theme.css`
**Existing pattern:** AUCUN — le fichier `mock/claude-design/pure-theme.css` mentionne dans la spec N'EXISTE PAS
**Pitfalls:** Aucun fichier CSS theme n'existe dans le repo. Creer from scratch.

### Code

```css
/* TUI Theme — Maestro Code */

:root {
  --tui-bg: #1a1a2e;
  --tui-fg: #e0e0e0;
  --tui-accent: #ffb300;
  --tui-border: #3a3a5c;
  --tui-error: #ff5252;
  --tui-success: #4caf50;
  --tui-muted: #6c6c8a;
}

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  background-color: var(--tui-bg);
  color: var(--tui-fg);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--tui-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--tui-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--tui-muted);
}

/* ASCII border utility */
.ascii-border {
  border: 1px solid var(--tui-border);
}

/* Blinking cursor for streaming */
@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background-color: var(--tui-accent);
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}
```

---

## SPEC-8 — tokens.ts

**Tag:** [code-app]
**File:** `apps/code/src/theme/tokens.ts`

### Code

```typescript
export const colors = {
  bg: '#1a1a2e',
  fg: '#e0e0e0',
  accent: '#ffb300',
  border: '#3a3a5c',
  error: '#ff5252',
  success: '#4caf50',
  muted: '#6c6c8a',
} as const;

export const fontFamily = "'JetBrains Mono', monospace";

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;
```

---

## SPEC-9 — apiClient.ts

**Tag:** [code-app]
**File:** `apps/code/src/services/apiClient.ts`

### Code

```typescript
const API_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res;
}

export { API_URL };
```

**NOTE :** `API_URL` par defaut est `''` (vide) car le proxy Vite gere le routing de `/api` vers localhost:5000. En mode Electron build, on peut setter `VITE_API_URL=http://localhost:5000`.

---

## SPEC-10 — chatService.ts

**Tag:** [code-app]
**File:** `apps/code/src/services/chatService.ts`
**Existing pattern:** `apps/desktop/src/services/chatService.ts` (144 lignes)

### Adaptations par rapport a desktop (fichier source : lignes 1-105)

1. **Import `API_URL`** depuis `./apiClient` au lieu de le declarer localement
2. **Desktop default** : `const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'` — apps/code utilise `''` (proxy)
3. **Supprimer** : `fetchLLMModels`, `fetchLLMHealth`, `fetchLLMCapabilities`, `loadModel`, `switchModel` (lignes 106-143 de desktop)
4. **Garder integralement** : `ChatMessage` interface, `ChatCompletionResponse` interface, `sendChatCompletion()`, `streamChatCompletion()`
5. **Dans `sendChatCompletion`** : remplacer `fetch(${API_URL}/api/chat/completions)` par usage de `apiFetch` (SPEC-9)
6. **Dans `streamChatCompletion`** : garder `fetch` direct (pas `apiFetch`) car ReadableStream est incompatible avec le wrapper throw-on-error. Mais prefixer avec `API_URL`.

### Verification format API (deja faite)

Le `ChatController.cs` (lignes 239-260 de `LLMDtos.cs`) confirme :
- Request body : `{ messages: [{role: string, content: string}], model?: string, temperature?: number, maxTokens?: number }` (camelCase)
- Response completions : `{ content: string, model?: string, promptTokens: number, completionTokens: number, totalTokens: number }` (camelCase)
- Stream SSE : `data: {"content":"..."}\n\n` puis `data: [DONE]\n\n`
- Erreur stream : `data: {"error":"...","details":"..."}\n\n`

Les interfaces `ChatMessage` et `ChatCompletionResponse` dans desktop **matchent exactement** les DTOs backend. Copier tel quel.

### Code

```typescript
import { API_URL, apiFetch } from './apiClient';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  content: string;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function sendChatCompletion(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<ChatCompletionResponse> {
  const res = await apiFetch('/api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }),
  });
  return res.json();
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    onError(err.error || `Stream request failed: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        onDone();
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          onError(parsed.error);
          return;
        }
        if (parsed.content) {
          onChunk(parsed.content);
        }
      } catch {
        // Non-JSON line, skip
      }
    }
  }

  onDone();
}
```

---

## SPEC-11 — useChat.ts

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useChat.ts`
**Existing pattern:** `apps/desktop/src/hooks/useChat.ts` (127 lignes)

### Adaptations

1. **Import path** : `'../services/chatService'` (identique structure)
2. **AUCUN changement fonctionnel** — copie exacte du hook desktop
3. Le hook utilise `useState`, `useCallback`, `useRef` de React — API identique React 18 vs 19

### Code : copie exacte de desktop (127 lignes)

Le builder copie `apps/desktop/src/hooks/useChat.ts` vers `apps/code/src/hooks/useChat.ts` **sans modification**. L'import relatif `'../services/chatService'` pointe deja vers le bon fichier dans la structure apps/code.

**Point important** : le `fallbackSend` dans useChat a un parametre `_partial: string` non utilise (prefixe `_`). C'est voulu — c'est le pattern desktop. Ne PAS le "corriger" en supprimant le parametre car le builder n'a pas de contexte sur pourquoi il est la (possiblement pour un futur resume de stream partiel).

---

## SPEC-12 — useBackendStatus.ts

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useBackendStatus.ts`

### Code

```typescript
import { useState, useEffect, useCallback } from 'react';

interface BackendStatus {
  connected: boolean;
  checking: boolean;
}

export function useBackendStatus(intervalMs = 10000): BackendStatus {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/');
      setConnected(res.ok);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, intervalMs);
    return () => clearInterval(id);
  }, [checkStatus, intervalMs]);

  return { connected, checking };
}
```

**Note** : utilise `fetch('/')` directement (pas `apiFetch`) car :
- Le proxy Vite route `/` vers le backend (qui retourne 200 sur la racine)
- On ne veut pas throw sur erreur HTTP — un 4xx/5xx est un "connected" (le backend repond)
- Un `fetch` qui echoue (network error) = "disconnected"

**Attention pitfall** : le proxy Vite ne route que `/api` vers le backend, pas `/`. Pour que le health check fonctionne, il faut soit :
- Option A : changer le health check pour `fetch('/api/discovery/health')` — endpoint qui existe dans le backend
- Option B : ajouter `/` au proxy Vite

**Decision : Option A** — utiliser `/api/discovery/health` car c'est l'endpoint de health check standard du backend (vu dans desktop main.ts ligne 244). Modifier le code :

```typescript
const res = await fetch('/api/discovery/health');
```

Ceci sera route par le proxy Vite vers `http://localhost:5000/api/discovery/health`.

---

## SPEC-13 — Header.tsx

**Tag:** [code-app]
**File:** `apps/code/src/components/Header.tsx`

### Code

```tsx
import { colors, spacing, fontFamily } from '../theme/tokens';

const tabs = [
  { key: 1, label: 'Console', active: true },
  { key: 2, label: 'Spaces', active: false },
  { key: 3, label: 'Foundry', active: false },
  { key: 4, label: 'Models', active: false },
  { key: 5, label: 'Monitor', active: false },
];

export function Header() {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily,
      backgroundColor: colors.bg,
    }}>
      <span style={{ color: colors.accent, fontWeight: 700, fontSize: '14px' }}>
        MAESTRO CODE
      </span>
      <nav style={{ display: 'flex', gap: spacing.sm }}>
        {tabs.map((tab) => (
          <span
            key={tab.key}
            style={{
              color: tab.active ? colors.accent : colors.muted,
              opacity: tab.active ? 1 : 0.5,
              cursor: tab.active ? 'default' : 'not-allowed',
              fontSize: '13px',
            }}
          >
            [{tab.key}] {tab.label}
          </span>
        ))}
      </nav>
    </header>
  );
}
```

---

## SPEC-14 — StatusBar.tsx

**Tag:** [code-app]
**File:** `apps/code/src/components/StatusBar.tsx`

### Code

```tsx
import { colors, spacing, fontFamily } from '../theme/tokens';
import { useBackendStatus } from '../hooks/useBackendStatus';

export function StatusBar() {
  const { connected, checking } = useBackendStatus();

  const statusColor = checking ? colors.muted : connected ? colors.success : colors.error;
  const statusText = checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected';

  return (
    <footer style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      padding: `${spacing.xs} ${spacing.md}`,
      borderTop: `1px solid ${colors.border}`,
      fontFamily,
      fontSize: '12px',
      color: colors.muted,
      backgroundColor: colors.bg,
    }}>
      <span style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColor,
      }} />
      <span>Backend: {statusText}</span>
    </footer>
  );
}
```

---

## SPEC-15 — ChatMessage.tsx

**Tag:** [code-app]
**File:** `apps/code/src/components/ChatMessage.tsx`

### Code

```tsx
import { colors, spacing, fontFamily } from '../theme/tokens';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const label = role === 'user' ? '> you' : '> assistant';
  const labelColor = role === 'user' ? colors.accent : colors.success;

  return (
    <div style={{
      padding: `${spacing.sm} ${spacing.md}`,
      fontFamily,
      fontSize: '14px',
      lineHeight: '1.6',
    }}>
      <div style={{ color: labelColor, fontWeight: 700, marginBottom: spacing.xs }}>
        {label}
      </div>
      <div style={{ color: colors.fg, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content}
        {isStreaming && <span className="streaming-cursor" />}
      </div>
    </div>
  );
}
```

---

## SPEC-16 — ChatInput.tsx

**Tag:** [code-app]
**File:** `apps/code/src/components/ChatInput.tsx`

### Code

```tsx
import { useState, useCallback, KeyboardEvent } from 'react';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface ChatInputProps {
  onSend: (value: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !isLoading) {
          onSend(value);
          setValue('');
        }
      }
    },
    [value, isLoading, onSend]
  );

  return (
    <div style={{
      padding: spacing.md,
      borderTop: `1px solid ${colors.border}`,
    }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Type a message..."
        rows={3}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          color: colors.fg,
          border: `1px solid ${colors.border}`,
          borderRadius: '4px',
          padding: spacing.sm,
          fontFamily,
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
        }}
      />
    </div>
  );
}
```

---

## SPEC-17 — ConsolePage.tsx

**Tag:** [code-app]
**File:** `apps/code/src/pages/ConsolePage.tsx`

### Code

```tsx
import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { colors, spacing } from '../theme/tokens';

export function ConsolePage() {
  const { messages, isLoading, error, streamingContent, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${spacing.sm} 0`,
      }}>
        {messages.length === 0 && !streamingContent && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: colors.muted,
            fontSize: '14px',
          }}>
            Type a message to start a conversation.
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role as 'user' | 'assistant'} content={msg.content} />
        ))}
        {streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming />
        )}
        {error && (
          <div style={{
            padding: `${spacing.sm} ${spacing.md}`,
            color: colors.error,
            fontSize: '13px',
          }}>
            Error: {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
```

---

## SPEC-18 — App.tsx

**Tag:** [code-app]
**File:** `apps/code/src/App.tsx`

### Code

```tsx
import { Header } from './components/Header';
import { ConsolePage } from './pages/ConsolePage';
import { StatusBar } from './components/StatusBar';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ConsolePage />
      </main>
      <StatusBar />
    </div>
  );
}
```

---

## Tests

### TEST-1 + TEST-2 — chatService.test.ts

**File:** `apps/code/src/services/__tests__/chatService.test.ts`

Le builder doit :
1. Creer le dossier `__tests__`
2. Mock `global.fetch`
3. TEST-1 : verifier que `streamChatCompletion` parse les chunks SSE correctement (mock `ReadableStream` avec `data: {"content":"hello"}\n\n` et `data: [DONE]\n\n`)
4. TEST-2 : verifier que `sendChatCompletion` throw sur `res.ok = false`

**Pitfall ReadableStream mock** : en environnement `jsdom`, `ReadableStream` existe mais `TextEncoder`/`TextDecoder` peuvent manquer. Le builder doit s'assurer que le `vitest.config.ts` (ou config dans `vite.config.ts`) utilise `environment: 'jsdom'` et que les tests utilisent `TextEncoder` pour encoder les chunks.

### TEST-3 + TEST-4 — useChat.test.ts

**File:** `apps/code/src/hooks/__tests__/useChat.test.ts`

Le builder doit :
1. Utiliser `@testing-library/react` avec `renderHook`
2. Mock `../services/chatService` (streamChatCompletion + sendChatCompletion)
3. TEST-3 : `sendMessage('hello')` → messages contient user msg, isLoading = true
4. TEST-4 : `stopGeneration()` → isLoading = false, streamingContent partiel ajoute comme message assistant

### TEST-5 — useBackendStatus.test.ts

**File:** `apps/code/src/hooks/__tests__/useBackendStatus.test.ts`

1. Mock `global.fetch`
2. `vi.useFakeTimers()` pour controler les intervals
3. Verifier `connected: true` quand fetch reussit, `connected: false` quand fetch echoue

### TEST-6 — apiClient.test.ts

**File:** `apps/code/src/services/__tests__/apiClient.test.ts`

1. Mock `global.fetch`
2. Verifier que `apiFetch('/api/test')` appelle fetch avec le bon URL
3. Verifier throw sur erreur HTTP avec message JSON

---

## Cross-cutting concerns

1. **Vitest config** : soit un fichier `vitest.config.ts` separe, soit une section `test` dans `vite.config.ts`. Recommandation : section `test` dans `vite.config.ts` pour la simplicite :
   ```typescript
   test: {
     environment: 'jsdom',
     globals: true,
   }
   ```
   Et ajouter `/// <reference types="vitest/globals" />` dans un fichier `src/vite-env.d.ts`.

2. **Fichier `src/vite-env.d.ts`** : necessaire pour les types Vite (`import.meta.env`). Le builder doit le creer :
   ```typescript
   /// <reference types="vite/client" />
   ```

3. **Pas de DI registration** : ce SPEC ne touche aucun code backend.

4. **Pas de modification de MEMORY.md** : ce SPEC ne prend aucune decision architecturale nouvelle.

5. **Ordre d'execution des SPECs** : le builder DOIT executer dans l'ordre suivant pour eviter les erreurs de compilation :
   - **Phase 1** : SPEC-1 (package.json) → `npm install`
   - **Phase 2** : SPEC-3 (tsconfigs) + SPEC-2 (vite.config.ts)
   - **Phase 3** : SPEC-4 (index.html + main.tsx) + SPEC-7 (CSS) + SPEC-8 (tokens.ts) + `src/vite-env.d.ts`
   - **Phase 4** : SPEC-5 (electron/main.ts) + SPEC-6 (electron/preload.ts)
   - **Phase 5** : SPEC-9 (apiClient.ts)
   - **Phase 6** : SPEC-10 (chatService.ts)
   - **Phase 7** : SPEC-11 (useChat.ts) + SPEC-12 (useBackendStatus.ts)
   - **Phase 8** : SPEC-13 (Header.tsx) + SPEC-14 (StatusBar.tsx) + SPEC-15 (ChatMessage.tsx) + SPEC-16 (ChatInput.tsx)
   - **Phase 9** : SPEC-17 (ConsolePage.tsx) + SPEC-18 (App.tsx)
   - **Phase 10** : TEST-1 a TEST-6
   - **Phase 11** : GATE-1 (tsc --noEmit) + GATE-2 (vitest run)

---

## Cardinal Rule check

**PASS.** apps/code est un pur frontend consommateur de l'API generique backend. Aucun code session-type-specifique. Le backend ne sait pas si le client est apps/code, apps/desktop, ou curl. Le litmus test passe — une nouvelle session type peut etre creee par JSON only.

## No Legacy Support check

**PASS.** apps/code est une nouvelle app. Rien a supprimer. La coexistence avec apps/desktop est un choix conscient (Option C, factorisation en Phase 78).

## Risques identifies

1. **`@vitejs/plugin-react@^4.3.4` avec Vite 6** : desktop utilise exactement cette combo et ca fonctionne. Pas de risque.
2. **React 19 + Electron 33** : React 19 est recent mais les APIs utilisees (useState, useCallback, useRef, useEffect) n'ont pas change entre React 18 et 19. Risque minimal.
3. **Proxy Vite** : si le backend n'est pas running, les requetes `/api` echoueront avec une erreur proxy (500). Le `useBackendStatus` detectera ca et affichera "Disconnected". Comportement correct.
4. **`vite-plugin-electron@0.29.1` avec Vite 6.4.2** : desktop utilise `0.28.8` avec Vite `6.0.3`. La 0.29.1 est plus recente et devrait etre compatible. Pas de peer dependency restrictive detectee.
