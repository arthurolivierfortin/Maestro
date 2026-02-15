# Phase 27 — Observations: État réel de Maestro

> Audit complet réalisé le 2026-02-14. Chaque observation est factuelle et vérifiable.

---

## 1. Violation du Roadmap

### Ce que le roadmap prévoyait (PHASE-19/ROADMAP-V1-TO-V4.md)

| Version | Phases | Prérequis | État actuel |
|---------|--------|-----------|-------------|
| V1 | 19-22 | Aucun | **Incomplet** — Phase 19 partielle, Phase 20-22 non commencées |
| V2 | 23-25 | V1 complète | **Non commencé** — quelques éléments faits hors séquence |
| V3 | 26-28 | V2 complète | **Sauté directement ici** (Phase 26) |
| V4 | 29-32 | V3 complète | Non commencé |

### Ce qui s'est passé

Phase 26 (V3 — Workflows out-of-the-box) a été commencée alors que :
- V1 n'est pas complète (pas de packaging, pas de sécurité, pas de stabilisation)
- V2 n'est pas commencée (pas de template partagé, monitors pas "vivants", frontend pas refait)

Le roadmap V3 dit explicitement : *"Valeur utilisateur — workflows out-of-the-box, ajustements de fonctionnalités manquantes, expérience premier jour."* Cela présuppose que l'app est téléchargeable (V1) et que l'interface est professionnelle (V2).

---

## 2. Inventaire — Ce qui fonctionne

### Backend (C# .NET)

| Composant | État | Preuve |
|-----------|------|--------|
| API REST /api/sessions | FONCTIONNE | CRUD complet, variables, entry points, invoke |
| API REST /api/blocks | FONCTIONNE | CRUD, metrics, search, designate |
| API REST /api/workspaces | FONCTIONNE | CRUD, sessions, topology |
| API REST /api/projects | FONCTIONNE | CRUD, containers, discover |
| API REST /api/provider | FONCTIONNE | Health, models, switch, load |
| API REST /api/training | FONCTIONNE | Configs, runs, start/pause/resume |
| API REST /api/blocktest | FONCTIONNE | Test runs, evaluations, compare |
| API REST /api/chat | FONCTIONNE | Chat completions |
| EntryPointExecutor | FONCTIONNE | Generic workflow execution, config.nodes dispatch |
| BlockExecutorRegistry | FONCTIONNE | Agent, tool block execution dispatch |
| FileSystemBlockDiscoveryService | FONCTIONNE | Block discovery from file system |
| FileSystemProjectSessionRepository | FONCTIONNE* | *Corrigé dans cette session (Newtonsoft + System.Text.Json) |
| Variable serialization | FONCTIONNE* | *Corrigé dans cette session (ObjectToJsonNode) |
| Session lifecycle | FONCTIONNE | create → start → invoke → pause → stop |

### CLI (maestro-cli)

| Composant | État | Preuve |
|-----------|------|--------|
| Session commands (24 sous-commandes) | FONCTIONNE | create, start, stop, invoke, vars, import, etc. |
| Block commands (24 sous-commandes) | FONCTIONNE | list, create, update, delete, content, search |
| Workspace commands (8 sous-commandes) | FONCTIONNE | create, add-session, topology, promote |
| Project commands (11 sous-commandes) | FONCTIONNE | create, bind, open, discover, containers |
| Template commands (3 sous-commandes) | FONCTIONNE | list, show, info |
| Training commands (7 sous-commandes) | FONCTIONNE | configs, runs, start/pause/resume |
| Test commands (10 sous-commandes) | FONCTIONNE | start, runs, evaluate, compare, improve |
| Model commands (8 sous-commandes) | FONCTIONNE | list, local, registry, load, switch |
| Monitor command | FONCTIONNE | Session, workspace, global modes |
| Chat command | FONCTIONNE | Interactive chat |
| Short ID resolution | FONCTIONNE | session, project, workspace types |
| JSON output mode | FONCTIONNE | --json flag |
| Config (config.ts) | FONCTIONNE | Backend URL, API key, config file I/O |

### TUI Monitor (Ink)

| Composant | État | Preuve |
|-----------|------|--------|
| SessionMonitor | FONCTIONNE | Polls API, renders panels, keyboard nav |
| PhaseWorkflow | FONCTIONNE | Phase display, expand/collapse, status colors |
| ExecutionLog | FONCTIONNE | Time + level + message, colored |
| LLMActivity | FONCTIONNE | Prompt/response preview, metadata |
| MetricsPanel | FONCTIONNE | Fitness bar, sparkline, iteration count |
| HomeScreen | FONCTIONNE | Health status, active sessions, quick actions |
| SpacesScreen (Sessions tab) | FONCTIONNE | Session list, expandable rows, selection |
| SpacesScreen (Repos tab) | FONCTIONNE | Project list |
| Theme system | FONCTIONNE | Shared palette, semantic colors, Ink helpers |
| Keyboard navigation | FONCTIONNE | Schema A contextual, panel cycling |

### Frontend (React + Vite)

| Composant | État | Preuve |
|-----------|------|--------|
| Build (npm run build) | FONCTIONNE | Compiles sans erreur |
| Block editor | FONCTIONNE | Canvas, hierarchy, edit |
| Router | FONCTIONNE | Navigation entre pages |
| API client | FONCTIONNE | Shared api-client.js |

### LLM Provider

| Composant | État | Preuve |
|-----------|------|--------|
| Local model serving | FONCTIONNE | Qwen2.5-Coder-1.5B-Instruct loaded |
| /v1/completions | FONCTIONNE | Inference works |
| /v1/switch-model | FONCTIONNE | Model hot-swap |
| Health endpoint | FONCTIONNE | /health returns status |

---

## 3. Inventaire — Ce qui NE fonctionne PAS

### Bugs actifs

| # | Bug | Sévérité | Détail |
|---|-----|----------|--------|
| B1 | **10 sessions zombies en "running"** | HAUTE | Sessions du 2026-02-06, jamais arrêtées. Le backend ne transition pas les sessions "running" au redémarrage. |
| B2 | **2 références fantômes dans workspace cantante-dev** | MOYENNE | Sessions a3271f41 et b8a288b6 supprimées, mais workspace.sessionIds non nettoyé. Pas de cascade delete. |
| B3 | **Workspace status icon hardcodé** | BASSE | SpacesScreen affiche toujours l'icône "running" pour tous les workspaces. |
| B4 | **Scroll max hardcodé à 100** | BASSE | SessionMonitor utilise `setMaxScroll('tree', 100)` au lieu du nombre réel de noeuds. |
| B5 | **Error detail tronqué à 80 chars** | BASSE | ErrorHeader tronque le message d'erreur, perte d'information. |

### Features manquantes critiques (devrait exister dans V1)

| # | Feature | Phase roadmap | Impact |
|---|---------|---------------|--------|
| M1 | **Session recovery au redémarrage** | V1 P22 | Sessions restent "running" éternellement après un restart |
| M2 | **Cascade delete workspace ↔ sessions** | V1 P22 | Références fantômes dans les workspaces |
| M3 | **API Key locale + auth middleware** | V1 P20 | Aucune sécurité — toutes les routes accessibles sans auth |
| M4 | **Localhost binding** | V1 P20 | Backend écoute sur 0.0.0.0 par défaut |
| M5 | **Packaging Electron (.exe)** | V1 P21 | App non téléchargeable |
| M6 | **First-run init** | V1 P21 | Pas de setup automatique ~/.maestro/ |
| M7 | **npm publish CLI global** | V1 P21 | CLI non installable globalement |
| M8 | **`maestro setup` wizard** | V1 P21 | Pas de détection hardware + guide |
| M9 | **Tests d'intégration E2E** | V1 P22 | Pas de pipeline de test bout en bout |
| M10 | **Error handling humain** | V1 P22 | Messages d'erreur techniques, pas user-friendly |
| M11 | **Doc d'installation** | V1 P22 | Pas de guide Windows step-by-step |
| M12 | **Getting Started guide** | V1 P22 | Pas de guide "5 minutes" |

### Features manquantes (V2)

| # | Feature | Phase roadmap | Impact |
|---|---------|---------------|--------|
| M13 | **Shared layout system** | V2 P23 | Pas de template partagé CLI/TUI/Frontend |
| M14 | **Widget registry** | V2 P23 | Widgets hardcodés dans les composants |
| M15 | **Page registry** | V2 P23 | Pages hardcodées dans le router |
| M16 | **SignalR/WebSocket temps réel** | V2 P24 | Tout est polling 2s, pas de push |
| M17 | **Monitor LLM-Provider (TUI)** | V2 P24 | Pas de monitor dédié pour le LLM-Provider |
| M18 | **Status bar persistante** | V2 P24 | Pas d'info constante (health, LLM actif, VRAM) |
| M19 | **Refonte frontend design system** | V2 P25 | Frontend fonctionnel mais pas professionnel |
| M20 | **Loading/Error/Empty states** | V2 P25 | Pas de spinners, skeletons, empty states |
| M21 | **Breadcrumb navigation** | V2 P25 | Pas de fil d'Ariane dans les vues détail |
| M22 | **Auto-reconnection** | V2 P24 | Monitor affiche stale-data banner mais ne retry pas |
| M23 | **Refresh manuel (touche 'r')** | V2 P24 | Pas de refresh immédiat à la demande |

---

## 4. État des données

### Sessions (22 total)

| Statut | Nombre | Détail |
|--------|--------|--------|
| running (zombies) | 10 | Toutes du 2026-02-06, 8 jours sans activité |
| idle | 8 | Dont 5x "Generate Commit Tool Foundry" identiques |
| stopped | 2 | 2x "Generate Commit Tool Foundry" |
| paused | 1 | Foundry-E2E-Test |
| created | 1 | train-planner-agent (jamais démarré) |

### Naming chaos

4 conventions différentes en usage simultané :
1. `PascalCase-Hyphen` : Compliance-E2E-Test, Phase-Chain-V2
2. `Title Case Spaces` : Test Context Fix, Generate Commit Tool Foundry
3. `Title - Subtitle` : Cantante - File Tree Module
4. `lowercase-hyphen` : train-planner-agent

7 sessions avec le nom identique "Generate Commit Tool Foundry" sans distinction.

### Workspaces

| Workspace | Sessions | Fantômes | État |
|-----------|----------|----------|------|
| cantante-dev | 4 réf, 2 réelles | 2 | Données corrompues |
| Training Research | 9 | Non vérifié | Possiblement corrompues |
| LLM-Compliance-Testing | 0 | 0 | OK |
| Model Research | 0 | 0 | OK |
| Test Workspace | 0 | 0 | OK |

---

## 5. Ce que la session Phase 26 a réellement accompli

### Travail utile
1. **Fix sérialisation Newtonsoft** : Root cause identifiée et corrigée (Program.cs utilise .AddNewtonsoftJson() mais le code traitait uniquement System.Text.Json.JsonElement)
2. **Fix ObjectToJsonNode** : Sérialisation disque via JsonNode au lieu de Dictionary<string,object>
3. **Fix agent passthrough** : BlockExecutorRegistry injecté dans EntryPointExecutor
4. **Fix short ID monitor** : resolveId() ajouté au monitor command
5. **API getWorkspace()** : Ajouté au client API
6. **Monitor workspace mode** : `-w` flag pour ouvrir directement la vue workspace
7. **Blocks créés** : planner-agent, coder-agent, tester-agent, reviewer-agent, git-agent, context-builder, convention-reader, code-analyzer (non vérifiés fonctionnellement)
8. **Session template** : agent-dev.session.json créé

### Travail non validé
1. **Agents** : Le coder-agent produit du texte décrivant ce qu'il ferait, mais **ne fait rien réellement** (les tools ne sont pas connectés)
2. **Session Cantante** : 5 phases toutes "pending", arbre d'exécution plat, métriques à zéro
3. **Blocks** : Créés mais jamais testés avec des inputs réels et des outputs vérifiés

### Erreurs de processus
1. **Sauté V1/V2** → Construit sur des fondations instables
2. **Vérifié API au lieu du monitor** → Problèmes visuels invisibles
3. **Pas de cleanup** → Zombies et fantômes accumulés
4. **Naming anarchique** → Sessions impossibles à distinguer
5. **Pas de critères de "done"** → Déclaré "fait" sans validation

---

## 6. Composants TUI non audités

Les composants suivants n'ont pas été vérifiés en profondeur :

| Composant | Fichier | Risque |
|-----------|---------|--------|
| Variables panel | Variables.ts | Inconnu — affiche-t-il les objets complexes correctement ? |
| Filesystem panel | Filesystem.ts | Inconnu — gère-t-il les permissions, les gros dossiers ? |
| Widgets panel | WidgetsPanel.ts | Inconnu — résout-il les bindings $.variables.xxx ? |
| Command log | CommandLog.ts | Inconnu — affiche-t-il l'historique des commandes ? |
| ModelDetail | ModelDetail.ts | Inconnu — metrics, fitness history ? |
| BlockDetail | BlockDetail.ts | Inconnu — contenu, children, metrics ? |
| RepoDetail | RepoDetail.ts | Inconnu — container status, sessions ? |
| FoundryScreen | FoundryScreen.ts | Partiellement audité — tri et groupement non vérifiés |
| CatalogScreen | CatalogScreen.ts | Partiellement audité — filtre type non vérifié |

---

## 7. Dettes techniques identifiées

| Dette | Impact | Effort estimé |
|-------|--------|---------------|
| Polling 2s au lieu de WebSocket | Latence, charge réseau | Élevé (SignalR) |
| Pas de tests E2E | Régressions silencieuses | Élevé |
| Sessions non récupérées au restart | Données incohérentes | Moyen |
| Pas de cascade delete | Références fantômes | Faible |
| 1 TODO dans agent metrics (cli.ts:6463) | Affichage incomplet | Faible |
| 2 méthodes API manquantes (topology, promote) — workaround _fetch | Fragile | Faible |
| Aucun health check au démarrage | Utilisateur ne sait pas si tout fonctionne | Moyen |
