# Scaffold apps/code/ — Design

**Goal:** Creer le squelette fonctionnel de `apps/code/` (Vite + React 19 + Electron + TypeScript) avec un theme TUI, une page Console chat-first connectee au backend C# via streaming SSE, et un Electron main process minimal.

**Roadmap phase:** Phase-66 (sub-phase 66-A)
**Tags:** [code-app]
**Scope (in):**

- Scaffold complet `apps/code/` : `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `electron/main.ts`, `electron/preload.ts`
- Theme TUI CSS : JetBrains Mono, monospace, palette amber/green/white, ASCII border utilities, variables CSS custom properties
- Fichier `src/theme/tokens.ts` : constantes TS pour couleurs, spacing, font (consommees par les composants)
- App shell (`App.tsx`) : header avec tabs 1-5 (Console active, autres grises/disabled), zone main, status bar
- Page Console (`ConsolePage.tsx`) : liste de messages scrollable + barre d'input + Enter pour envoyer
- Composants : `Header.tsx`, `StatusBar.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`
- Service `chatService.ts` : copie-adaptee de `apps/desktop/src/services/chatService.ts` (sendChatCompletion + streamChatCompletion uniquement, sans fetchLLMModels/Health/Capabilities/loadModel/switchModel)
- Hook `useChat.ts` : copie-adapte de `apps/desktop/src/hooks/useChat.ts` (messages state, streaming, error, abort)
- Service `apiClient.ts` : base fetch wrapper (API_URL configurable via env var ou proxy Vite)
- Hook `useBackendStatus.ts` : poll `GET /` (backend health) toutes les 10s, expose `connected: boolean`
- `StatusBar.tsx` affiche l'indicateur de connexion backend (vert = connecte, rouge = deconnecte)
- Electron main process : `BrowserWindow` minimal, charge le dev server Vite en dev ou `dist/index.html` en build
- Electron preload : `contextBridge` minimal (juste `isElectron: true` pour detection)
- npm scripts : `dev` (Vite + Electron), `build` (tsc + Vite build), `dev:web` (Vite seul sans Electron)

**Scope (out — YAGNI explicite):**

- Pages Spaces, Foundry, Models, Monitor (Phase 66-B/C/D/E ou Phase 67)
- Slash commands et autocompletion (cycle ulterieur)
- InlineWidgets (cycle ulterieur)
- Help overlay (cycle ulterieur)
- Command palette Cmd+K (cycle ulterieur)
- Electron packaging distributable (.dmg/.exe — Phase 70)
- Gestion backend/LLM-Provider par Electron (l'utilisateur lance le backend separement)
- IPC handlers complexes (dialog, fs, backend:start/stop — copier de desktop plus tard si besoin)
- Auto-updater (Phase 70)
- Gestion de sessions Maestro (juste chat direct pour ce cycle)
- Tests visuels / golden files (pas de real-demo-check pour React-web encore)
- CRT effect optionnel (66-B theme polish)
- react-router-dom (une seule page pour l'instant, routing ajoute quand pages multiples)

**Constraints:**

- React 19 (pas 18 — aligne avec la direction du projet, plus recent)
- Vite 6 (meme version que apps/desktop)
- Electron derniere stable (33.x)
- `vite-plugin-electron` pour integrer Electron avec le dev server Vite (meme pattern que apps/desktop)
- Port Vite dev server : 5174 (5173 deja pris par apps/desktop)
- Proxy Vite : `/api` → `http://localhost:5000` (evite config CORS dans le backend)
- Zero modification du backend C# — consomme les API existantes
- JetBrains Mono charge via `@font-face` local (fichier WOFF2 inclus dans `src/theme/fonts/`) ou Google Fonts CDN
- TypeScript strict mode (`"strict": true`, pas de `@ts-nocheck`)

## Cardinal Rule check

**Respecte.** `apps/code/` est un pur consommateur du backend API generique (`/api/chat/stream`, `/api/chat/completions`). Aucun code session-type-specifique. Le backend ne sait pas si le client est apps/code, apps/desktop, maestro-code Ink, ou curl. Litmus test PASS — une nouvelle session type peut etre creee par JSON only sans toucher apps/code.

## No Legacy Support check

**Rien a supprimer.** `apps/code/` est une nouvelle app, pas un remplacement. `apps/desktop/` et `packages/maestro-code/` coexistent (decision Chemin C explicite dans le roadmap). La duplication temporaire entre apps/desktop et apps/code est assumee — factorisation en `packages/code-core/` reportee a Phase 78.

## Architecture

### Structure fichiers

```
apps/code/
  package.json              # Vite 6 + React 19 + Electron 33 + TypeScript 5.7
  vite.config.ts            # Port 5174, proxy /api → localhost:5000, vite-plugin-electron
  tsconfig.json             # Strict, paths alias @/ → src/
  tsconfig.node.json        # Pour vite.config.ts
  index.html                # Entry point HTML (<div id="root">)
  electron/
    main.ts                 # BrowserWindow minimal (charge dev server ou dist/index.html)
    preload.ts              # contextBridge minimal (isElectron: true)
  src/
    main.tsx                # createRoot, import theme CSS, render <App />
    App.tsx                 # Shell : <Header /> + <main><ConsolePage /></main> + <StatusBar />
    theme/
      tui-theme.css         # Variables CSS, @font-face JetBrains Mono, reset, utilities ASCII border
      tokens.ts             # Export TS : colors (amber, green, white, red, gray), spacing, fontFamily
    components/
      Header.tsx            # Barre superieure : "MAESTRO CODE" + tabs [1]Console [2]Spaces... (disabled)
      StatusBar.tsx          # Barre inferieure : indicateur backend + model info placeholder
      ChatMessage.tsx        # Un message (role user|assistant, content, streaming cursor si en cours)
      ChatInput.tsx          # Textarea monospace + Enter pour envoyer, Shift+Enter pour newline
    pages/
      ConsolePage.tsx        # Flex column : messages scroll area + ChatInput sticky en bas
    services/
      apiClient.ts           # API_URL from env, fetch wrapper avec error handling
      chatService.ts         # sendChatCompletion + streamChatCompletion (copie-adaptee de apps/desktop)
    hooks/
      useChat.ts             # State messages, streaming, fallback non-stream, abort (copie-adapte)
      useBackendStatus.ts    # Poll GET / toutes les 10s, expose { connected: boolean, checking: boolean }
```

### Data flow

1. L'utilisateur tape un message dans `ChatInput` et appuie sur Enter
2. `ConsolePage` appelle `sendMessage(content)` du hook `useChat`
3. `useChat` ajoute le message user au state, appelle `streamChatCompletion()` du service
4. `chatService.streamChatCompletion()` envoie `POST /api/chat/stream` au backend (via proxy Vite `/api` → `:5000`)
5. Le backend route vers LLM-Provider, retourne un flux SSE `data: {"content":"..."}` + `data: [DONE]`
6. `useChat` accumule les chunks dans `streamingContent`, puis finalise le message assistant
7. `ChatMessage` affiche le contenu avec un curseur clignotant pendant le streaming

### Electron integration

Le main process Electron est **minimal** compare a `apps/desktop/electron/main.ts`. Pas de backend management, pas de LLM-Provider management, pas d'auto-updater, pas d'IPC handlers complexes. Juste :
- Creer une `BrowserWindow`
- Charger `VITE_DEV_SERVER_URL` (dev) ou `dist/index.html` (build)
- Menu basique (Edit + View + Window)
- Single instance lock

Le preload expose uniquement `window.isElectron = true` pour que l'app sache si elle tourne dans Electron ou dans un navigateur.

## Affected systems

- Backend C# : **non touche** (consomme API existante `/api/chat/stream`, `/api/chat/completions`)
- LLM-Provider : **non touche**
- TUI Ink (`packages/maestro-code/`) : **non touche**
- CLI (`packages/maestro-cli/`) : **non touche**
- Blocks : **non touche**
- Contracts : **non touche**
- DI : **non touche**
- **NOUVEAU** : `apps/code/` (pur frontend React + Electron, ~15 fichiers)

## Risks

- **`@ts-nocheck` temptation** (pitfall CRITICAL) — si le builder rencontre des erreurs TypeScript, il pourrait etre tente d'ajouter `@ts-nocheck`. Interdit. Fixer les types.
- **SDK/backend type mismatch** (pitfall) — `chatService.ts` declare des interfaces (`ChatCompletionResponse`) qui doivent matcher le JSON du backend. Le researcher doit `curl` les endpoints pour verifier les champs reels.
- **Proxy Vite vs CORS** — le proxy Vite (`/api` → `:5000`) evite tout probleme CORS. Si le builder configure mal le proxy, les requetes chat echoueront silencieusement. Verifier avec `curl` via le proxy.
- **React 19 compat avec Electron** — React 19 est recent. Si `vite-plugin-electron-renderer` ne supporte pas React 19, fallback a React 18 (mineur).
- **Port collision** — 5174 choisi pour eviter 5173 (apps/desktop). Si l'utilisateur a les deux en dev simultanement, pas de collision.
- **JetBrains Mono loading** — si la font ne charge pas, le fallback `monospace` preserve l'aesthetic. Pas critique, mais a tester.
