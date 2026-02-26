# Phase 42 : Restructuration maestro-code = Monitor + AgentPanel

**Statut** : En cours
**Prerequis** : Phase 41-PRE COMPLETE (spatial TUI)
**Objectif** : Remplacer l'architecture spatiale cassee de maestro-code par une copie du monitor solide + un AgentPanel interactif.

---

## Motivation

Le UI de `maestro-code` est brise et over-engineered :
- `App.ts` monolithique de 854 lignes (God Component)
- Navigation spatiale 2D de 350 lignes pour 5 pages (overkill)
- 4 pages sur 5 sont des wrappers du monitor avec `chrome:false` (hack)
- La seule valeur ajoutee : AgentPage (176 lignes) + ConversationLog (62 lignes)

Le monitor (`maestro-monitor`) est solide et battle-tested :
- SessionMonitor orchestrateur avec 3 modes (descriptor/execution/idle)
- Panel focus, tree nav, scroll, mouse, keyboard — tout fonctionne
- 5 pages (Home, Spaces, Foundry, Catalog, Models) + 4 detail views
- Survit au dogfooding Phase 35

**Decision** : Copier l'architecture du monitor dans maestro-code, ajouter un AgentPanel + TaskInputBar, supprimer le spatial. Maestro-code devient "le monitor + agent interactif" pour l'instant, et divergera dans le futur.

---

## Pourquoi copier et pas importer

- Maestro-code deviendra une app separee avec son propre UI/style
- Importer creerait un couplage : changer le monitor casserait maestro-code
- Copier permet a chaque app d'evoluer independamment
- Le refactor de style viendra plus tard, sur une base solide

---

## Sous-phases

| Step | Titre | Description |
|------|-------|-------------|
| 1 | Copier les fichiers du monitor | ~25 components, 3 hooks, theme.ts |
| 2 | Creer AgentPanel + TaskInputBar | Nouveaux composants specifiques a maestro-code |
| 3 | Reecrire App.ts | Pattern monitor + SessionManager + input + demo |
| 4 | Modifier SessionMonitor | Ajouter AgentPanel dans le layout execution |
| 5 | Supprimer le spatial | registry/, pages/, mascotte, spatial status bar |
| 6 | Mettre a jour package.json | Retirer @maestro/monitor, garder @maestro/tui |
| 7 | Tests et verification | Supprimer tests obsoletes, ecrire nouveaux, verifier |

---

## Architecture cible

### App.ts (~400 lignes)

```
FullscreenBox
+-- InteractiveCodeApp
    |-- State: navStack, detailView, currentPage (from monitor)
    |-- State: sessionManager, currentSessionId, lines[], busy, agentState
    |-- State: inputHistory (useInputHistory)
    |
    |-- Page mode (no detailView):
    |   |-- NavBar
    |   |-- PageComponent (Home/Spaces/Foundry/Catalog/Models)
    |   |-- TaskInputBar
    |   +-- StatusBar
    |
    +-- Session detail mode:
        |-- SessionMonitor (with agentLines, agentState props)
        |   +-- Layout includes AgentPanel
        |-- TaskInputBar (send messages)
        +-- StatusBar
```

### SessionMonitor execution layout (avec AgentPanel)

```
NavBar
+-- SESSION (Header) -------------------------------------------+
|   session name . status . repo                                |
+---------------------------------------------------------------+
+-- AGENT ----------------++-- WORKFLOW TREE -------------------+
|  conversation log       ||  +-- planning         ok          |
|  agent activity         ||  +-- implementation   running     |
|  user messages          ||  |   +-- file-read    ok          |
|                         ||  |   +-- file-write   running     |
+-------------------------++-----------------------------------+
+-- FILESYSTEM -----------++-- EXECUTION LOG -------------------+
|  src/                   ||  13:02 [info] Starting...          |
|  +-- auth/              ||  13:02 [info] Planning...          |
|  +-- components/        ||  13:03 [ok] Phase 1 done           |
+-------------------------++-----------------------------------+
StatusBar
```

Panel names en mode execution : `['agent', 'tree', 'files', 'log']`

### Task submit flow

1. User tape dans TaskInputBar -> Enter
2. `sessionManager.submitTask()` cree session -> import template -> start -> invoke
3. App set `detailView = { type: 'session', id: newSessionId }`
4. SessionMonitor s'affiche avec AgentPanel montrant la conversation

---

## Fichiers : operations

### Copier (monitor -> maestro-code)

| Fichier source | Notes |
|----------------|-------|
| components/SessionMonitor.ts | Sera modifie pour AgentPanel |
| components/HomeScreen.ts | Copy as-is |
| components/SpacesScreen.ts | Copy as-is |
| components/FoundryScreen.ts | Copy as-is |
| components/CatalogScreen.ts | Copy as-is |
| components/ModelsScreen.ts | Copy as-is |
| components/BlockDetail.ts | Copy as-is |
| components/WorkspaceDetail.ts | Copy as-is |
| components/RepoDetail.ts | Copy as-is |
| components/ModelDetail.ts | Copy as-is |
| components/SessionList.ts | Copy as-is |
| components/PhaseList.ts | Copy as-is |
| components/GlobalMonitor.ts | Copy as-is |
| components/LLMMonitorScreen.ts | Copy as-is |
| components/Panel.ts | Re-export @maestro/tui |
| components/Header.ts | Re-export @maestro/tui |
| components/StatusBar.ts | Re-export @maestro/tui |
| components/NavBar.ts | Minor title change |
| components/WorkflowTree.ts | Re-export @maestro/tui |
| components/PhaseWorkflow.ts | Re-export @maestro/tui |
| components/LLMActivity.ts | Re-export @maestro/tui |
| components/ExecutionLog.ts | Re-export @maestro/tui |
| components/MetricsPanel.ts | Re-export @maestro/tui |
| components/Variables.ts | Re-export @maestro/tui |
| components/Filesystem.ts | Re-export @maestro/tui |
| components/CommandLog.ts | Re-export @maestro/tui |
| components/WidgetsPanel.ts | Re-export @maestro/tui |
| components/Artifacts.ts | Re-export @maestro/tui |
| hooks/useSessionData.ts | Copy as-is |
| hooks/useKeyboard.ts | Copy as-is |
| hooks/useAnimationTick.ts | Copy as-is |
| theme.ts | Copy as-is |

### Creer

| Fichier | Lignes | Description |
|---------|--------|-------------|
| components/AgentPanel.ts | ~80 | ConversationLog + state badge dans Panel |
| components/TaskInputBar.ts | ~70 | Extrait de InputPrompt dans App.ts |

### Garder (maestro-code existant)

| Fichier | Raison |
|---------|--------|
| services/SessionManager.ts | Session lifecycle |
| components/ConversationLog.ts | Reutilise dans AgentPanel |
| mocks/DemoApiClient.ts | Demo mode |
| mocks/demo-data.ts | Demo mode data |
| mocks/index.ts | Barrel |
| hooks/useInputHistory.ts | Input history |
| launcher.ts | Entry point |
| headless.ts | Headless mode |

### Supprimer

| Fichier/Dossier | Raison |
|-----------------|--------|
| hooks/useSpatialNav.ts | Spatial nav |
| hooks/useNavigation.ts | Spatial nav |
| registry/ (entier) | PageRegistry, types, built-in-pages |
| pages/ (entier) | AgentPage, ExecutionPage, wrappers |
| components/SpatialStatusBar.ts | Spatial nav |
| components/Minimap.ts | Spatial nav |
| components/MascotteFull.ts | Mascotte |
| components/MascotteCompact.ts | Mascotte |
| components/MascotteOverlay.ts | Mascotte |
| components/NotificationToast.ts | Spatial nav |
| components/TransitionWipe.ts | Spatial nav |
| components/CommandPalette.ts | Spatial nav |
| components/HelpOverlay.ts | Spatial nav (monitor a le sien) |
| screens/ (entier) | WelcomeScreen, SplashScreen |
| types.ts | AgentState, spatial types |
| audio/ (entier) | Voice mode |

### Tests

| Action | Fichiers |
|--------|----------|
| Supprimer | spatial-nav.test.ts, navigation.test.ts, page-registry.test.ts, agent-page.test.ts, agent-cockpit.test.ts, command-palette.test.ts, list-pages.test.ts, execution-page.test.ts, screens.test.ts, demo-visual-debug.test.ts, monitor-imports.test.ts, demo-pages.test.ts |
| Reecrire | App.test.ts |
| Garder | DemoApiClient.test.ts, headless.test.ts, ink-table.test.ts, real-demo-check.cjs |
| Creer | AgentPanel.test.ts, TaskInputBar.test.ts |

---

## Verification

1. `cd packages/maestro-code && npx vitest run tests/` — tous les tests passent
2. `node tests/real-demo-check.cjs` — module resolution CJS/ESM ok
3. `node ../../packages/maestro-cli/index.js code --demo` — verification visuelle
4. `grep -r "@maestro/monitor" packages/maestro-code/` — aucun resultat
5. `grep -r "useSpatialNav\|PageRegistry\|Mascotte" packages/maestro-code/` — aucun resultat

---

## Criteres de completion

- [ ] Monitor copie dans maestro-code (fichiers independants)
- [ ] AgentPanel affiche la conversation dans le layout execution
- [ ] TaskInputBar permet de soumettre des taches
- [ ] Task submit cree session et navigue vers SessionMonitor
- [ ] Navigation monitor fonctionne (h/s/f/c/m, Tab, scroll, tree nav)
- [ ] Demo mode fonctionne (--demo)
- [ ] Aucune reference a @maestro/monitor dans maestro-code
- [ ] Aucune reference au spatial nav
- [ ] Tests passent
- [ ] real-demo-check.cjs passe
