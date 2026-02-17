# Audit V1/V2 — État réel du code

> Date : 2026-02-15
> Méthode : Inspection du code source, pas des STATUS.md

---

## Verdict : V1 et V2 sont IMPLÉMENTÉES

Chaque feature a été vérifiée comme du code réel (pas des stubs/placeholders).

### V1 — Phase 19 (LLM + Chat) ✅ COMPLET

| Feature | Fichier | Détail |
|---------|---------|--------|
| ChatController | `Controllers/ChatController.cs` | 2 endpoints: POST completions + POST stream |
| ChatPage | `frontend/src/pages/ChatPage.tsx` | ModelSelector, ChatPanel, useChat hook |
| `maestro chat` | `cli.ts:5213` | REPL interactif, --model, --system, --temperature |
| `maestro setup` | `cli.ts:5281` | Wizard 6 étapes (backend → LLM → auth → key → config → test) |
| `maestro health` | `cli.ts:462` | Status, version, blocks, LLM, auth, --verbose |

### V1 — Phase 20 (Security) ✅ COMPLET

| Feature | Fichier | Détail |
|---------|---------|--------|
| ApiKeyAuthMiddleware | `Security/ApiKeyAuthMiddleware.cs` | Bearer token, exempt paths, localhost bypass |
| AuthController | `Controllers/AuthController.cs` | 6 endpoints (status, setup, keys CRUD, validate) |
| Kestrel 127.0.0.1 | `appsettings.json` | Confirmé : `"Url": "http://127.0.0.1:5000"` |
| IApiKeyService + scopes | `Infrastructure/Security/ApiKeyService.cs` | Admin, SessionScoped, expiry |
| `maestro auth` | `cli.ts:7523-7616` | status, setup, create-key, list-keys, revoke |

### V1 — Phase 21 (Packaging) ✅ COMPLET

| Feature | Fichier | Détail |
|---------|---------|--------|
| Electron main.ts | `frontend/electron/main.ts` (805 lignes) | IPC, backend management, LLM management, auto-updater |
| Electron preload.ts | `frontend/electron/preload.ts` (175 lignes) | Context bridge, 22+ handlers |
| electron-builder config | `frontend/package.json` | NSIS, portable, dist:win/mac/linux |
| Backend dans Electron | `main.ts` | Start/stop/status, health check |
| Auto-updater | `main.ts` | electron-updater intégré |

### V1 — Phase 22 (Stabilization) ✅ COMPLET

| Feature | Fichier | Détail |
|---------|---------|--------|
| SessionRecoveryService | `Configuration/SessionRecoveryService.cs` | IHostedService, zombies → stopped |
| Cascade delete | `Controllers/WorkspacesController.cs` | DELETE ?force=true, supprime sessions |
| ErrorMessages catalog | `Configuration/ErrorMessages.cs` | 17 erreurs avec suggestions |
| INSTALLATION.md | `docs/guides/INSTALLATION.md` + `users/INSTALLATION.md` | Guide Windows |
| GETTING-STARTED.md | `docs/guides/GETTING-STARTED.md` + `users/GETTING-STARTED.md` | Quickstart 5 min |

### V2 — Phase 23 (Templates/UI Infrastructure) ✅ COMPLET

| Feature | Fichier | LOC | Détail |
|---------|---------|-----|--------|
| WidgetRegistry | `shared/registry/widget-registry.ts` | 180 | Singleton, 13 widgets built-in |
| PageRegistry | `shared/registry/page-registry.ts` | 170 | 5 pages, raccourcis clavier |
| DataSourceResolver | `shared/data/data-source-resolver.ts` | 115 | variable, api, static, signalr |
| Breadcrumb TUI | `shared/tui/components/Breadcrumb.ts` | 90 | Ink, buildBreadcrumbs helper |
| Breadcrumb Frontend | `frontend/src/components/Breadcrumb/Breadcrumb.tsx` | 90 | React Router, block-aware |
| StateDisplays | `frontend/src/components/ui/StateDisplays.tsx` | 140 | Loading, Error, Empty |

### V2 — Phase 24 (Live Monitors) ✅ COMPLET

| Feature | Fichier | LOC | Détail |
|---------|---------|-----|--------|
| SignalR Client (CLI) | `shared/data/signalr-client.ts` | 172 | Polling fallback, auto-reconnect |
| SignalR Manager (Frontend) | `frontend/src/services/signalr/SignalRManager.ts` | 450+ | 3 hubs, typed messages |
| LLMMonitorScreen | `monitor/ink/components/LLMMonitorScreen.ts` | 120 | GPU, model, provider panels |
| PersistentStatusBar | `shared/tui/components/PersistentStatusBar.ts` | 77 | Health indicators |
| 28 composants TUI | `monitor/ink/components/*.ts` | ~5000 | Application TUI complète |

### V2 — Phase 25 (Frontend Redesign) ✅ COMPLET

| Feature | Fichier | LOC | Détail |
|---------|---------|-----|--------|
| Design tokens | `frontend/src/styles/tokens.css` | 198 | Colors, typo, spacing, animations |
| 10 composants UI | `frontend/src/components/ui/*.tsx` | ~500 | Button, Tabs, Modal, Progress, Card, Badge, StatusIndicator, Breadcrumb, StateDisplays |
| SessionDetailPage | `frontend/src/pages/SessionDetailPage.tsx` | 250+ | Tabs, metrics, execution tree |
| Animations CSS | `frontend/src/styles/ui.scss` | 726 | fadeIn, fadeInUp, pulse, shimmer, stagger |

---

## Blockers V3 identifiés

| Blocker | Sévérité | Description |
|---------|----------|-------------|
| **BlockRef dispatch** | CRITIQUE | `ExecuteRegularNodeAsync` ne vérifie pas `blockRef` — les nodes reguliers ne peuvent pas dispatcher vers des blocs externes. Seuls les phase nodes le font. |
| **Agent timeout** | MOYEN | Max iterations existe (défaut 5), mais pas de timeout wall-clock. Si le LLM hang, la session hang. |
| **Agent loop detection** | FAIBLE | Pas de détection de boucle (même tool call répété). |

Le **BlockRef dispatch** est le seul blocker CRITIQUE — sans lui, les workflows ne peuvent pas composer des agents.
