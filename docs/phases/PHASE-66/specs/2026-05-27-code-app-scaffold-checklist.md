# Checklist — Scaffold apps/code/

**Linked spec:** [2026-05-27-code-app-scaffold-design.md](2026-05-27-code-app-scaffold-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (sub-phase 66-A)

## Code

- [x] [SPEC-1] [code-app] Creer `apps/code/package.json` avec dependencies React 19, Vite 6, Electron 33, TypeScript 5.7, vite-plugin-electron, vitest ; scripts `dev`, `dev:web`, `build`, `type-check`, `test` — `apps/code/package.json`
- [x] [SPEC-2] [code-app] Creer `apps/code/vite.config.ts` : plugin react + vite-plugin-electron (main.ts + preload.ts), port 5174, proxy `/api` vers `http://localhost:5000`, alias `@/` vers `src/` — `apps/code/vite.config.ts`
- [x] [SPEC-3] [code-app] Creer `apps/code/tsconfig.json` + `tsconfig.node.json` : strict mode, jsx react-jsx, paths alias `@/*`, noUnusedLocals, noUnusedParameters — `apps/code/tsconfig.json`, `apps/code/tsconfig.node.json`
- [x] [SPEC-4] [code-app] Creer `apps/code/index.html` (entry point HTML avec `<div id="root">`) + `apps/code/src/main.tsx` (createRoot, import tui-theme.css, render `<App />`) — `apps/code/index.html`, `apps/code/src/main.tsx`
- [x] [SPEC-5] [code-app] Creer `apps/code/electron/main.ts` : BrowserWindow 1400x900 (minWidth 1024, minHeight 768), charge VITE_DEV_SERVER_URL en dev ou dist/index.html en prod, menu basique (Edit/View/Window), single instance lock, ready-to-show pattern, cleanup on before-quit — `apps/code/electron/main.ts`
- [x] [SPEC-6] [code-app] Creer `apps/code/electron/preload.ts` : contextBridge expose `window.isElectron = true` uniquement — `apps/code/electron/preload.ts`
- [x] [SPEC-7] [code-app] Creer `apps/code/src/theme/tui-theme.css` : variables CSS custom properties (--tui-bg, --tui-fg, --tui-accent, --tui-border, --tui-error, --tui-success, --tui-muted), @font-face JetBrains Mono (ou Google Fonts link dans index.html), reset HTML (margin 0, box-sizing border-box), classe utilitaire `.ascii-border` (border 1px solid var(--tui-border)) — `apps/code/src/theme/tui-theme.css`
- [x] [SPEC-8] [code-app] Creer `apps/code/src/theme/tokens.ts` : export const `colors` (bg: '#1a1a2e', fg: '#e0e0e0', accent: '#ffb300', border: '#3a3a5c', error: '#ff5252', success: '#4caf50', muted: '#6c6c8a'), `fontFamily` ('JetBrains Mono', monospace), `spacing` (xs/sm/md/lg/xl en px) — `apps/code/src/theme/tokens.ts`
- [x] [SPEC-9] [code-app] Creer `apps/code/src/services/apiClient.ts` : constante `API_URL` depuis `import.meta.env.VITE_API_URL || ''` (vide = proxy Vite), fonction `apiFetch(path, options)` qui wrap fetch avec le prefix API_URL, throw sur !res.ok avec le message d'erreur du body JSON — `apps/code/src/services/apiClient.ts`
- [x] [SPEC-10] [code-app] Creer `apps/code/src/services/chatService.ts` : copier `sendChatCompletion` + `streamChatCompletion` de `apps/desktop/src/services/chatService.ts`, importer `API_URL` depuis `apiClient.ts` (SPEC-9), `sendChatCompletion` utilise `apiFetch` pour le POST non-stream, `streamChatCompletion` utilise `fetch` directement avec prefix `API_URL` (car le streaming ReadableStream n'est pas compatible avec le wrapper apiFetch), garder les memes interfaces `ChatMessage` et `ChatCompletionResponse`, ne PAS copier fetchLLMModels/Health/Capabilities/loadModel/switchModel — `apps/code/src/services/chatService.ts`
- [x] [SPEC-11] [code-app] Creer `apps/code/src/hooks/useChat.ts` : copier de `apps/desktop/src/hooks/useChat.ts`, adapter les imports pour pointer vers le chatService local (SPEC-10), garder le meme comportement (streaming + fallback non-stream + abort + clearMessages + stopGeneration) — `apps/code/src/hooks/useChat.ts`
- [x] [SPEC-12] [code-app] Creer `apps/code/src/hooks/useBackendStatus.ts` : hook qui poll `GET /` (via apiFetch) toutes les 10 secondes, expose `{ connected: boolean, checking: boolean }`, commence par `checking: true` au mount, cleanup interval au unmount — `apps/code/src/hooks/useBackendStatus.ts`
- [x] [SPEC-13] [code-app] Creer `apps/code/src/components/Header.tsx` : barre superieure avec titre "MAESTRO CODE" a gauche, 5 tabs a droite ([1] Console actif, [2] Spaces [3] Foundry [4] Models [5] Monitor tous disabled/grises), styled avec tokens et tui-theme CSS — `apps/code/src/components/Header.tsx`
- [x] [SPEC-14] [code-app] Creer `apps/code/src/components/StatusBar.tsx` : barre inferieure avec indicateur connexion backend (point vert "Connected" ou point rouge "Disconnected"), consomme `useBackendStatus()`, styled monospace — `apps/code/src/components/StatusBar.tsx`
- [x] [SPEC-15] [code-app] Creer `apps/code/src/components/ChatMessage.tsx` : composant pour un message chat, props `{ role: 'user' | 'assistant', content: string, isStreaming?: boolean }`, affiche le role en label ("> you" ou "> assistant"), le content en monospace, un curseur block clignotant si `isStreaming` — `apps/code/src/components/ChatMessage.tsx`
- [x] [SPEC-16] [code-app] Creer `apps/code/src/components/ChatInput.tsx` : textarea monospace pleine largeur, 3 lignes de hauteur, Enter envoie le message (appelle `onSend(value)` prop), Shift+Enter insere un newline, disabled si `isLoading` prop est true, placeholder "Type a message..." — `apps/code/src/components/ChatInput.tsx`
- [x] [SPEC-17] [code-app] Creer `apps/code/src/pages/ConsolePage.tsx` : layout flex column hauteur 100%, zone messages scrollable (flex-grow, overflow-y auto, scroll-to-bottom automatique sur nouveau message), affiche `messages` + `streamingContent` du hook useChat, `ChatInput` sticky en bas — `apps/code/src/pages/ConsolePage.tsx`
- [x] [SPEC-18] [code-app] Creer `apps/code/src/App.tsx` : shell de l'app, layout flex column hauteur 100vh, `<Header />` en haut, `<ConsolePage />` au centre (flex-grow), `<StatusBar />` en bas, pas de routing (une seule page) — `apps/code/src/App.tsx`

## Tests

- [x] [TEST-1] Test unitaire `chatService.test.ts` : mock fetch, verifier que `streamChatCompletion` parse correctement les chunks SSE `data: {"content":"hello"}` et appelle `onChunk`, et que `data: [DONE]` appelle `onDone` — `apps/code/src/services/__tests__/chatService.test.ts`
- [x] [TEST-2] Test unitaire `chatService.test.ts` : mock fetch avec `res.ok = false`, verifier que `sendChatCompletion` throw une Error avec le message du body — `apps/code/src/services/__tests__/chatService.test.ts`
- [x] [TEST-3] Test unitaire `useChat.test.ts` : renderHook, appeler `sendMessage('hello')`, verifier que le state `messages` contient le message user, et que `isLoading` passe a true pendant le streaming — `apps/code/src/hooks/__tests__/useChat.test.ts`
- [x] [TEST-4] Test unitaire `useChat.test.ts` : verifier que `stopGeneration()` met `isLoading` a false et ajoute le `streamingContent` partiel comme message assistant — `apps/code/src/hooks/__tests__/useChat.test.ts`
- [x] [TEST-5] Test unitaire `useBackendStatus.test.ts` : mock fetch, verifier que le hook retourne `connected: true` quand fetch reussit, `connected: false` quand fetch echoue — `apps/code/src/hooks/__tests__/useBackendStatus.test.ts`
- [x] [TEST-6] Test unitaire `apiClient.test.ts` : verifier que `apiFetch('/api/test')` appelle fetch avec le bon URL, et throw sur erreur HTTP avec le message JSON — `apps/code/src/services/__tests__/apiClient.test.ts`

## Database / Migrations

- [ ] [DB-0] None

## Block / Contract changes

- [ ] [BLOCK-0] None

## Verification gates (6 layers TESTING-PROTOCOL)

- [x] [GATE-1] Layer 1 Type Check : `cd apps/code && npx tsc --noEmit` — zero erreurs
- [x] [GATE-2] Layer 2 Unit Tests : `cd apps/code && npx vitest run` — 9 tests passent (6 requis + 3 extra apiClient)
- [ ] [GATE-3] Layer 4 Real Demo Check : N/A pour ce cycle (pas de real-demo-check.cjs pour React-web, mais verification manuelle : `cd apps/code && npm run dev:web` ouvre le navigateur, la page Console s'affiche, le theme TUI est visible)
- [ ] [GATE-4] Layer 5 Integration : BONUS si backend running — ouvrir l'app, envoyer un message, verifier que la reponse streame correctement
- [ ] [GATE-5] Provider verification : N/A (pas de workflow/agent touche, juste frontend)
