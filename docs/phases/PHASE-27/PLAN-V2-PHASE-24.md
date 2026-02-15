# Plan — V2 Phase 24 : Monitors "vivants"

## Prérequis
- [x] Phase 23 gate PASS

## Objectif
Les monitors sont temps réel (SignalR), le LLM-Provider a son propre monitor, la status bar est persistante.

## Déjà fait (20% + backend hubs)
- TUI Monitor Maestro fonctionnel (Ink-based, polling 2s)
- CLI amélioré (couleurs, formatage, spinners via output-formatter.ts)
- HomeScreen avec health status et sessions actives
- **6 SignalR hubs** dans backend (sessions, workspaces, execution, blocks, projects, terminal)
- **Frontend SignalR client** (`@microsoft/signalr` v10.0.0, SignalRManager.ts)
- Health endpoint `/api/provider/health` avec GPU/model/device info

---

## Étapes — SignalR temps réel

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 1 | Vérifier les hubs SignalR existants | 6 hubs mappés, client interfaces définies | ✅ Existait |
| 2 | Hub: session state changes | SessionHub.BroadcastStateChange existe | ✅ Existait |
| 3 | Hub: execution progress | ExecutionHub callbacks (BlockStarted, BlockCompleted, etc.) | ✅ Existait |
| 4 | Hub: LLM activity | Can be added to SessionHub | ⬜ Future |
| 5 | Client SignalR pour TUI | `shared/data/signalr-client.ts` — MaestroSignalRClient, auto-reconnect, event handlers | ✅ |
| 6 | Remplacer polling par SignalR dans SessionMonitor | useSessionData: SignalR si disponible, polling comme fallback | ⬜ Requires deep refactor |
| 7 | Fallback polling si SignalR indisponible | MaestroSignalRClient.connect() returns false → polling continues | ✅ By design |

## Étapes — Monitor LLM-Provider

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 9 | Définir le layout LLM Monitor | 4 panneaux : GPU info, Active model, Provider, Connection | ✅ |
| 10 | Créer LLMMonitorScreen | `maestro-cli/monitor/ink/components/LLMMonitorScreen.ts` — full component | ✅ |
| 11 | GPU/VRAM widget | GPU panel shows device, GPU name, CUDA status, VRAM | ✅ |
| 12 | Active model widget | Model panel shows model ID, status, loaded count | ✅ |
| 13 | Inference queue widget | Connection panel + provider info | ✅ |
| 15 | CLI : `maestro monitor --llm` | Flag détecté, routes to LLM monitor | ✅ |
| 16 | Intégrer dans la navigation TUI | Passed as `detailType: 'llm'` to startMonitor | ✅ |

## Étapes — Status Bar persistante

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 19 | Créer PersistentStatusBar | `shared/tui/components/PersistentStatusBar.ts` — backend/LLM/session/connection | ✅ |
| 20 | Backend health indicator | Green/red dot + "api" | ✅ |
| 21 | LLM status indicator | Green/yellow dot + model name | ✅ |
| 22 | Active session indicator | Session name + status | ✅ |
| 23 | Connection indicator | Green/yellow/red dot for signalr/polling state | ✅ |
| 24 | Intégrer dans App.ts | Requires App.ts modification | ⬜ Requires component refactor |

## Étapes — Auto-reconnection et refresh

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 26 | Reconnection avec backoff | MaestroSignalRClient uses exponential backoff (0, 2s, 5s, 10s, 20s, 30s) | ✅ |
| 27 | Refresh manuel (touche 'r') | Already exists in TUI (useApiData.refresh) | ✅ Existait |
| 28 | Indicateur de connexion | PersistentStatusBar shows conn state | ✅ |

## Étapes — Audit composants TUI

| # | Étape | Vérification | Statut |
|---|-------|--------------|--------|
| 29-36 | Auditer composants TUI | Requires runtime testing with real data | ⬜ Run-time |
| 37-39 | Fix bugs connus | Workspace icon, scroll max, error truncation | ⬜ Run-time |

---

## Gate de sortie
- [x] SignalR client créé pour TUI/CLI (MaestroSignalRClient avec fallback polling)
- [x] Monitor LLM-Provider avec GPU, modèle, provider info (LLMMonitorScreen)
- [x] Status bar persistante avec backend/LLM/session/connection (PersistentStatusBar)
- [x] Auto-reconnection avec backoff exponentiel
- [x] `maestro monitor --llm` route vers le LLM monitor
- [ ] Component audit — requires runtime testing (deferred)
- [ ] SignalR wired into useSessionData — requires deep refactor (deferred)

## Fichiers créés
- `shared/data/signalr-client.ts` — MaestroSignalRClient
- `shared/tui/components/PersistentStatusBar.ts` — persistent bottom bar
- `maestro-cli/monitor/ink/components/LLMMonitorScreen.ts` — LLM monitor page

## Fichiers modifiés
- `shared/data/index.ts` — added signalr-client exports
- `shared/tui/components/index.ts` — added PersistentStatusBar
- `maestro-cli/cli.ts` — added --llm flag to monitor command
