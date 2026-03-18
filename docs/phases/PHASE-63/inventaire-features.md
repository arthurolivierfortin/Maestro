# Inventaire complet des features TUI — Reference pre-refonte

Ce document liste CHAQUE feature visible dans le TUI avant la refonte chat-first.
Chaque feature a un statut de migration : ou elle sera accessible apres la refonte.

---

## Legende

- **Slash** = accessible via slash command (widget inline)
- **Chat** = toujours visible dans l'ecran principal
- **Overlay** = modal/overlay (inchange)
- **StatusBar** = barre du bas (inchange)
- **Widget** = composant interactif dans le chat

---

## 1. Navigation & Core UI

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 1.1 | NavBar avec 6 onglets (H/A/S/F/C/M) | Toujours visible | **SUPPRIME** — remplace par slash commands | NavBar.ts |
| 1.2 | Hotkeys de page (h/a/s/f/c/m) | Global | **SUPPRIME** — remplace par /status, /spaces, etc. | App.ts |
| 1.3 | Page cycling (Ctrl+← →) | Global | **SUPPRIME** | App.ts |
| 1.4 | Session count badge ("● N sessions") | NavBar | **StatusBar** — deplace dans la barre du bas | StatusBar.ts |
| 1.5 | StatusBar connection (● Connected, latency) | Barre du bas | **INCHANGE** | StatusBar.ts |
| 1.6 | StatusBar shortcuts contextuels | Barre du bas | **MIS A JOUR** — nouveaux raccourcis slash | StatusBar.ts |
| 1.7 | StatusBar time + daily cost | Barre du bas | **INCHANGE** | StatusBar.ts |
| 1.8 | TaskInputBar (prompt /, saisie texte) | Au-dessus StatusBar | **INCHANGE** | TaskInputBar.ts |
| 1.9 | Input history (Up/Down) | TaskInputBar | **INCHANGE** | useInputHistory.ts |
| 1.10 | HelpOverlay (? key) | Modal overlay | **MIS A JOUR** — contenu adapte aux slash commands | HelpOverlay.ts |
| 1.11 | Quit confirmation (q key) | Modal overlay | **INCHANGE** | App.ts |
| 1.12 | Provider setup screen | Au demarrage | **INCHANGE** | ProviderSetup.ts |
| 1.13 | Assistant selector | Au demarrage | **INCHANGE** | AssistantSelector.ts |
| 1.14 | Demo mode (--demo) | Global | **INCHANGE** | App.ts |

---

## 2. Page Home → /status

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 2.1 | Backend health (● Connected / ✗ Error) | Panel SYSTEM STATUS | **Slash** `/status` → StatusWidget | HomeScreen.ts |
| 2.2 | LLM health (model name / Offline) | Panel SYSTEM STATUS | **Slash** `/status` → StatusWidget | HomeScreen.ts |
| 2.3 | Active sessions list (scrollable, 10/page) | Panel ACTIVE SESSIONS | **Slash** `/status` → StatusWidget | HomeScreen.ts |
| 2.4 | Session row: selector, status icon, name, ID, status, fitness | Liste | **Widget** — meme format dans StatusWidget | HomeScreen.ts |
| 2.5 | Session selection + open (Enter) | Navigation | **Widget interactif** — j/k + Enter | HomeScreen.ts |
| 2.6 | Pagination (PgUp/PgDn) | Navigation | **Widget interactif** | HomeScreen.ts |
| 2.7 | Quick actions panel ([S] Spaces, [F] Foundry, etc.) | Panel droit | **SUPPRIME** — remplace par slash commands | HomeScreen.ts |

---

## 3. Page Agent → Ecran principal (toujours visible)

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 3.1 | Agent status (idle/working/completed/error + icon anime) | Header | **Chat** — toujours visible en haut | AgentScreen.ts |
| 3.2 | Repository path | Header | **Chat** — dans le header | AgentScreen.ts |
| 3.3 | Session ID badge | Header | **Chat** — dans le header | AgentScreen.ts |
| 3.4 | Model name | Header | **Chat** — dans le header | AgentScreen.ts |
| 3.5 | Processing indicator (● Processing...) | Header | **Chat** — dans le header | AgentScreen.ts |
| 3.6 | Conversation log (auto-scroll) | Panel principal | **Chat** — LE contenu principal | ConversationLog.ts |
| 3.7 | User messages (❯ green) | Conversation | **INCHANGE** | ConversationLog.ts |
| 3.8 | Agent activity (◆ phase, ✓ completed) | Conversation | **INCHANGE** | ConversationLog.ts |
| 3.9 | Step details (│ indented) | Conversation | **INCHANGE** | ConversationLog.ts |
| 3.10 | File entries (...created file.ts) | Conversation | **INCHANGE** | ConversationLog.ts |
| 3.11 | Manual scroll (j/k) | Navigation | **Chat** — j/k scroll le chat | ConversationLog.ts |
| 3.12 | Quick actions panel ([J/K] Scroll, [G] Go) | Panel droit | **SUPPRIME** — raccourcis dans StatusBar | AgentScreen.ts |
| 3.13 | Go to session (g key) | Hotkey | **Slash** `/session <id>` | AgentScreen.ts |

---

## 4. Page Spaces → /spaces

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 4.1 | 3 tabs (Repos/Workspaces/Sessions) | Tab header | **Widget** — tabs dans le widget (1/2/3) | SpacesScreen.ts |
| 4.2 | Session list avec status, cost, duration, child badge [+N] | Liste | **Widget interactif** — meme format | SpacesScreen.ts |
| 4.3 | Session expanded detail (ID, children, fitness, phases, workflow, entries) | Expand | **Widget interactif** — Space/Enter expand | SpacesScreen.ts |
| 4.4 | Children list indented dans expanded | Expand | **Widget** — meme format | SpacesScreen.ts |
| 4.5 | Fitness bar + percentage | Expand | **Widget** — meme format | SpacesScreen.ts |
| 4.6 | Phases row (status icons) | Expand | **Widget** — meme format | SpacesScreen.ts |
| 4.7 | Active workflow name | Expand | **Widget** — meme format | SpacesScreen.ts |
| 4.8 | Entry points list | Expand | **Widget** — meme format | SpacesScreen.ts |
| 4.9 | Workspace list | Tab Workspaces | **Widget** — `/spaces workspaces` | SpacesScreen.ts |
| 4.10 | Repo list | Tab Repos | **Widget** — `/spaces repos` | SpacesScreen.ts |
| 4.11 | Filter running/all (r key) | Toggle | **Widget interactif** — r key dans le widget | SpacesScreen.ts |
| 4.12 | Delete session (d key + confirmation) | Action | **Widget interactif** — d key dans le widget | SpacesScreen.ts |
| 4.13 | Open session detail (Enter) | Navigation | **Widget** → `/session <id>` automatique | SpacesScreen.ts |

---

## 5. Page Foundry → /foundry

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 5.1 | Block list avec type badge | Liste | **Widget interactif** | FoundryScreen.ts |
| 5.2 | Block count by type | Header | **Widget** | FoundryScreen.ts |
| 5.3 | Block expanded (description, metadata) | Expand | **Widget interactif** — Space expand | FoundryScreen.ts |
| 5.4 | Open block detail (Enter) | Navigation | **Widget** → `/block <id>` automatique | FoundryScreen.ts |

---

## 6. Page Catalog → /catalog

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 6.1 | Type filter tabs (All/Workflows/Agents/Tools) | Tab header | **Widget** — 1/2/3/4 ou Tab dans le widget | CatalogScreen.ts |
| 6.2 | Block list avec fitness, capabilities, description | Liste | **Widget interactif** | CatalogScreen.ts |
| 6.3 | Block expanded (description, version, fitness bar, capabilities) | Expand | **Widget interactif** — Space expand | CatalogScreen.ts |
| 6.4 | Contract test execution (T key) | Action | **Widget interactif** — T key dans le widget | CatalogScreen.ts |
| 6.5 | Test result panel (PASS/FAIL, content, tokens, cost) | Inline | **Widget** — meme format | CatalogScreen.ts |
| 6.6 | Open block detail (Enter) | Navigation | **Widget** → `/block <id>` automatique | CatalogScreen.ts |

---

## 7. Page Models → /models

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 7.1 | Model health status (Online/Offline + icon) | Panel | **Widget** | ModelsScreen.ts |
| 7.2 | Metrics (requests, tokens, latency p50/p95/avg, error rate) | Panel | **Widget** | ModelsScreen.ts |
| 7.3 | Queue status (depth, avg wait, per-model) | Panel | **Widget** | ModelsScreen.ts |
| 7.4 | Model list avec provider badge + active badge | Liste | **Widget interactif** | ModelsScreen.ts |
| 7.5 | Playground launch (P key) | Hotkey | **Widget interactif** — P key dans le widget | ModelsScreen.ts |
| 7.6 | Open model detail (Enter) | Navigation | **Widget** → `/model <id>` automatique | ModelsScreen.ts |

---

## 8. Detail Views → Slash commands

| # | Feature | Avant | Apres | Composant |
|---|---------|-------|-------|-----------|
| 8.1 | SessionMonitor multi-panel (descriptor/execution/idle modes) | Detail view | **Widget** `/session <id>` | SessionMonitor.ts |
| 8.2 | PhaseWorkflow panel (tree, expand, status icons) | SessionMonitor | **Widget** — meme composant | PhaseWorkflow.ts |
| 8.3 | WorkflowTree panel (execution tree, expand, running indicators) | SessionMonitor | **Widget** — meme composant | WorkflowTree.ts |
| 8.4 | AgentPanel (state, session, conversation) | SessionMonitor | **Widget** — meme composant | AgentPanel.ts |
| 8.5 | ExecutionLog (tail -f, color-coded levels) | SessionMonitor | **Widget** — meme composant | ExecutionLog.ts |
| 8.6 | LLMActivity (chat view, prompt/response preview) | SessionMonitor | **Widget** — meme composant | LLMActivity.ts |
| 8.7 | Filesystem (directory tree, access permissions, color-coded) | SessionMonitor | **Widget** — meme composant | Filesystem.ts |
| 8.8 | Variables (session vars, grouped, formatted) | SessionMonitor | **Widget** — meme composant | Variables.ts |
| 8.9 | MetricsPanel (fitness bar, iteration, sparkline) | SessionMonitor | **Widget** — meme composant | MetricsPanel.ts |
| 8.10 | CommandLog (reverse chrono, status icons) | SessionMonitor | **Widget** — meme composant | CommandLog.ts |
| 8.11 | Artifacts (file list, status icons, type tags) | SessionMonitor | **Widget** — meme composant | Artifacts.ts |
| 8.12 | WidgetsPanel (custom session widgets) | SessionMonitor | **Widget** — meme composant | WidgetsPanel.ts |
| 8.13 | Panel cycling (Tab/Shift+Tab) | SessionMonitor | **Widget interactif** — Tab dans le widget | SessionMonitor.ts |
| 8.14 | Panel zoom (z key) | SessionMonitor | **Widget interactif** — z key dans le widget | SessionMonitor.ts |
| 8.15 | BlockDetail (INFO, FITNESS, SESSIONS, ACTIONS) | Detail view | **Widget** `/block <id>` | BlockDetail.ts |
| 8.16 | ModelDetail (HEALTH, USAGE, PERFORMANCE, playground) | Detail view | **Widget** `/model <id>` | ModelDetail.ts |
| 8.17 | WorkspaceDetail (sessions, settings) | Detail view | **Widget** `/workspace <id>` | WorkspaceDetail.ts |
| 8.18 | RepoDetail (info, .maestro stats, sessions) | Detail view | **Widget** `/repo <id>` | RepoDetail.ts |

---

## 9. Slash Commands

| # | Command | Avant | Apres |
|---|---------|-------|-------|
| 9.1 | /help | Liste les commandes | **MIS A JOUR** — nouvelles commandes |
| 9.2 | /status | Affiche status session | **ENRICHI** — StatusWidget avec health + sessions |
| 9.3 | /new | Nouvelle conversation | **INCHANGE** |
| 9.4 | /clear | Clear conversation | **INCHANGE** |
| 9.5 | /stop | Cancel task | **INCHANGE** |
| 9.6 | /purge | Delete idle sessions | **INCHANGE** |
| 9.7 | /costs | View/set cost limits | **INCHANGE** |
| 9.8 | /agent | Show/switch agent | **INCHANGE** |
| 9.9 | /create-agent | Create via block-forge | **INCHANGE** |
| 9.10 | /playground | Model playground | **INCHANGE** |
| 9.11 | /quit | Quit | **INCHANGE** |
| 9.12 | /spaces | **NOUVEAU** — ouvre SessionsWidget |
| 9.13 | /foundry | **NOUVEAU** — ouvre FoundryWidget |
| 9.14 | /catalog | **NOUVEAU** — ouvre CatalogWidget |
| 9.15 | /models | **NOUVEAU** — ouvre ModelsWidget |
| 9.16 | /session \<id\> | **NOUVEAU** — ouvre SessionMonitorWidget |
| 9.17 | /block \<id\> | **NOUVEAU** — ouvre BlockDetailWidget |
| 9.18 | /model \<id\> | **NOUVEAU** — ouvre ModelDetailWidget |
| 9.19 | /workspace \<id\> | **NOUVEAU** — ouvre WorkspaceDetailWidget |
| 9.20 | /repo \<id\> | **NOUVEAU** — ouvre RepoDetailWidget |
| 9.21 | /permissions \<id\> | **NOUVEAU** — ouvre PermissionsWidget |

---

## 10. Nouvelles features (Phase 63)

| # | Feature | Composant |
|---|---------|-----------|
| 10.1 | PermissionsPanel (diff visuel ○/·/✗) | PermissionsPanel.ts |
| 10.2 | FocusProvider (layers modal/widget/input/page) | useFocusProvider.ts |
| 10.3 | useManagedInput (remplace useInput) | useManagedInput.ts |
| 10.4 | Widgets inline dans ConversationLog | InlineWidget.ts |
| 10.5 | Agent injecte des widgets dans ses reponses | SessionManager.ts |

---

## Compteurs

| Categorie | Avant | Apres | Delta |
|-----------|-------|-------|-------|
| Pages | 6 | 1 (chat) | -5 pages, +11 slash commands |
| Detail views | 5 | 5 (en widgets) | 0 perte |
| Slash commands | 11 | 21 | +10 nouveaux |
| Hotkeys globaux | 8 (h/a/s/f/c/m/q/?) | 3 (/,q,?) | -5 (remplaces par slash) |
| Hotkeys widgets | 15+ | 15+ (dans les widgets) | 0 perte |
| Panels SessionMonitor | 8 | 8 + PermissionsPanel | +1 |
| Features totales | 88 | 88 + 5 nouvelles | +5 |
