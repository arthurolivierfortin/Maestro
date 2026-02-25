# Phase 41-PRE : maestro-code — Refactoring Flipper Zero

**Statut** : A faire
**Prerequis** : Phase 40-PRE COMPLETE
**Objectif** : Reintegrer les composants du monitor dans maestro-code avec un layout "Flipper Zero" (hero + context panels), corriger le mode demo silencieux, appliquer l'identite visuelle.

---

## 1. Analyse de la situation actuelle

### 1.1 Rappel de la vision (Phase 40-PRE)

La Phase 40-PRE a defini le pattern **"Agent-in-the-Cockpit"** — un modele architectural ou l'agent et l'utilisateur ont des **positions independantes** dans l'app :

```typescript
// Deux positions independantes
const [userScreen, setUserScreen] = useState<Screen>({ type: 'agent' });
const [agentScreen, setAgentScreen] = useState<Screen>({ type: 'agent' });
const [followingAgent, setFollowingAgent] = useState<boolean>(true);
```

Trois interactions fondamentales definies dans le design original :

1. **JOIN** (`[J]` ou `[A]`) — l'utilisateur se teleporte ou l'agent travaille
2. **CALL** — l'agent "arrive" sur l'ecran de l'utilisateur (mini-panel overlay avec mascotte)
3. **DETACH** (`[Esc]`) — l'utilisateur navigue librement, l'agent continue en background

Ce pattern a ete inspire du **Flipper Zero** : l'agent est une entite visible qui "nage" a travers les differents ecrans de l'application, comme le dauphin du Flipper Zero qui se deplace dans les menus.

### 1.2 Ce qui a ete correctement implemente

| Element | Fichier | Status |
|---------|---------|--------|
| Agent-in-the-Cockpit (two-position tracking) | `hooks/useNavigation.ts` | COMPLET |
| Mascotte pixel art (5 etats, 2 frames, 24x22 px) | `@maestro/tui/sprites/mascotte.ts` | COMPLET |
| Mini-panel overlay agent | `panels/AgentActivity.ts` | COMPLET |
| AgentBadge pour NavBar | `panels/AgentBadge.ts` | COMPLET |
| SplashScreen (logo + breathing dot) | `screens/SplashScreen.ts` | COMPLET |
| WelcomeScreen (first-run .maestro/) | `screens/WelcomeScreen.ts` | COMPLET |
| NavBar multi-ecran (A/C/S/M) | `App.ts` | COMPLET |
| Headless mode (CI/pipes) | `headless.ts` | COMPLET |
| Extraction composants vers @maestro/tui | `packages/tui/` | COMPLET |
| SessionManager (create/start/invoke/poll) | `App.ts` | COMPLET |
| Input history (up/down, 50 entries) | `hooks/useInputHistory.ts` | COMPLET |
| Voice mode toggle (Ctrl+V) | `App.ts` | COMPLET |

### 1.3 Ce qui n'a PAS ete fait — L'ecart critique

Le **monitor** (`packages/maestro-monitor/`) possede **28 composants matures** qui n'ont jamais ete integres dans maestro-code. Voici l'inventaire complet de ce qui manque :

#### Panneaux de monitoring (le coeur du monitor)

| Composant monitor | Fonction | Present dans maestro-code |
|---|---|---|
| `WorkflowTree` | Arbre d'execution interactif expand/collapse avec cursor | NON — log plat textuel |
| `PhaseWorkflow` | Phases + noeuds d'execution fusionnes | NON — rien |
| `LLMActivity` | Apercu prompt/reponse chat-like par noeud | NON — rien |
| `ExecutionLog` | Tail-f avec niveaux colores (50 entries) | NON — log integre au OutputPanel |
| `MetricsPanel` | Fitness, iteration, sparkline trend, tokens | NON — rien |
| `Variables` | Inspecteur session groupes config/state/other | NON — rien |
| `Filesystem` | Arbre repertoire avec permissions [rw]/[r-]/[--] | NON — rien |
| `Artifacts` | Fichiers produits par session (new/updated/deleted) | NON — rien |
| `CommandLog` | Historique commandes avec resultats | NON — rien |
| `WidgetsPanel` | Widgets custom avec data binding `$.variables.xxx` | PARTIEL — WidgetRenderer basique |

#### Ecrans de navigation

| Composant monitor | Fonction | Present dans maestro-code |
|---|---|---|
| `CatalogScreen` | Catalogue complet : filtres type (Tab), expand, fitness bars, scroll | APPAUVRI — liste simple sans expand ni filtres |
| `SpacesScreen` | 3 onglets (Repos/Workspaces/Sessions), expand, filtres | APPAUVRI — liste sessions plate |
| `ModelsScreen` | Status panel + liste modeles + detail | APPAUVRI — liste read-only |
| `FoundryScreen` | Browser blocks developpement | NON |
| `HomeScreen` | Dashboard system status + sessions actives | NON |

#### Ecrans de detail

| Composant monitor | Fonction | Present dans maestro-code |
|---|---|---|
| `SessionMonitor` | 3 modes layout (descriptor/execution/idle) — LE COEUR | NON — **STUB** (navigate mais ecran vide) |
| `BlockDetail` | Info block + fitness dimensions + sessions | NON — **STUB** |
| `ModelDetail` | Sante modele + usage + performance | NON |
| `WorkspaceDetail` | Sessions workspace + parametres | NON |
| `RepoDetail` | Info repo + sessions | NON |

#### Fonctionnalites UX

| Fonctionnalite | Monitor | maestro-code |
|---|---|---|
| Panel focus (Tab/Shift-Tab, 1/2/3) | OUI — `usePanelFocus` | NON |
| Zoom panel (z → fullscreen) | OUI | NON |
| Mouse support (clic focus, scroll) | OUI — `useMouse` | NON |
| Terminal background gris (#1e1e1e) | OUI — `setTerminalBg` | NON |
| StatusBar riche (connection, latency, shortcuts) | OUI | MINIMAL (session ID + busy) |
| Stale data warning (>10s) | OUI | NON |
| Error classification (connection, timeout, DNS) | OUI | NON |
| Responsive (<80 cols → stack vertical) | OUI | NON |

### 1.4 Le bug du mode demo silencieux

Quand le backend n'est pas lance, maestro-code fait **semblant de fonctionner** :

```typescript
// App.ts:722-733 — Mode demo silencieux
} else {
  // Demo mode (no API client)
  setBusy(true);
  addLine({ text: 'Processing... (demo mode — no API)', color: 'gray' });
  setTimeout(() => {
    addLine({ text: 'Done (no real execution in demo mode)', color: 'yellow' });
    setBusy(false);
  }, 1000);
}
```

Ceci viole le principe fondamental de CLAUDE.md : **"No Silent Failures"**. L'utilisateur pourrait ne pas se rendre compte que le backend n'est pas lance et perdre du temps.

**Correction** : Le mode demo doit etre explicite (`--demo` flag). Sans backend et sans `--demo`, un ecran d'erreur clair doit s'afficher avec les instructions pour demarrer les services.

### 1.5 Diagnostic

La Phase 33 a traite maestro-code comme un **nouveau produit a part** au lieu de ce qu'il aurait du etre : **le monitor + un ecran Agent conversation en plus**. La Phase 40-PRE a corrige la navigation et ajoute la mascotte, mais n'a pas integre les composants existants du monitor.

Le resultat : ~20 composants matures sont inutilises, et les ecrans catalog/sessions/models ont ete reecrits en versions appauvries au lieu d'importer ceux du monitor.

---

## 2. Vision : Layout Flipper Zero

### 2.1 Le concept

Comme le Flipper Zero avec son dauphin : **UN panneau central (hero) avec des panneaux contextuels autour**. Le panneau hero change selon l'ecran actif. Les panneaux contextuels fournissent des informations de monitoring en temps reel.

Ce n'est **PAS** le layout egal du monitor (panneaux cote a cote de taille equivalente). C'est un layout **centre sur l'action** avec du contexte autour.

**Principes :**
- Le panneau hero occupe ~60-65% de l'espace et contient l'action principale
- Les panneaux contextuels (35-40%) fournissent du monitoring temps reel
- Quand aucune session n'est active, le hero prend tout l'espace
- Quand une session est active, les panneaux contextuels apparaissent automatiquement
- La mascotte est visible dans le hero panel, pas dans un panneau separe

### 2.2 Agent Screen — Session active

```
┌─ MAESTRO ─── [A]gent  [C]atalog  [S]essions  [M]odels ── ◉ working ─┐
├──────────────────────────────────────┬───────────────────────────────────┤
│                                      │                                   │
│  AGENT (hero, ~60-65%)               │  EXECUTION TREE (~35-40%)         │
│  ┌──────────────────────────────┐    │  ✓ Prepare                        │
│  │ [Mascotte] ◉ Agent working  │    │  ✓ Cache Context                  │
│  │            Creating files.. │    │  ▶ Plan ←                         │
│  └──────────────────────────────┘    │    ○ Validate                     │
│                                      │    ○ Implement                    │
│  > Add login page                    │    ○ Test                         │
│    Creating session...               │    ○ Review                       │
│    ✓ Plan: 3 steps identified        │    ○ Commit                       │
│    ▶ Implementing auth module...     │───────────────────────────────────│
│                                      │  METRICS                          │
│  [Widget interactif si present]      │  Nodes: 2/8  Duration: 1m 23s    │
│                                      │  Fitness: [████░░░░] 52%          │
│  ─────────────────────────────       │                                   │
│  > Describe your task...             │                                   │
├──────────────────────────────────────┴───────────────────────────────────┤
│  LOG (50%)                            │  LLM ACTIVITY (50%)               │
│  [12:34:56] INFO Plan started         │  ── plan-block (12:34) ──         │
│  [12:35:01] INFO 3 steps identified   │  → "Plan the implementation..."   │
│  [12:35:02] INFO Starting implement   │  ← "Step 1: Create auth..."       │
├─────────────────────────────────────────────────────────────────────────┤
│  session: abc12345  ● connected  12ms  [Tab]panels  [z]zoom  [?]help   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Agent Screen — Idle (pas de session)

```
┌─ MAESTRO ─── [A]gent  [C]atalog  [S]essions  [M]odels ── ● ready ───┐
│                                                                        │
│  AGENT                                                                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [Mascotte idle — breathing]   ● Agent ready                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Type a task to start working.                                         │
│                                                                        │
│  ─────────────────────────────                                         │
│  > Describe your task...                                               │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  ● ready  [?]help  [Ctrl+C]quit                                       │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Catalog Screen (reutilise le monitor)

```
┌─ MAESTRO ─── [A]gent  [C]atalog  [S]essions  [M]odels ── ● ready ───┐
│                                                                        │
│  CATALOG                                   │  BLOCK DETAIL              │
│  [Tab] filter: All                         │  ─────────────             │
│  12 blocks                                 │  Name: dev-orchestrator    │
│                                            │  Type: agent               │
│  → [agent] dev-orchestrator    85% ████▒   │  Version: 1.0.0            │
│    [tool]  file-read           92% █████   │  Atomic: no (composite)    │
│    [tool]  file-write          88% ████▒   │  Fitness: 85%              │
│    [wrkfl] project-autonomous  78% ████░   │  ─────────                 │
│    [tool]  git-committer       95% █████   │  Description:              │
│    [valid] json-validator      90% █████   │  Main development          │
│    ...                                     │  orchestrator agent        │
│                                            │                            │
├────────────────────────────────────────────┴────────────────────────────┤
│  ↑↓ navigate  [Enter]open  [Tab]filter  [Space]expand  [Esc]back       │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Session Detail

Quand l'utilisateur selectionne une session dans le browser ou tape `/session` pendant une execution, il accede au **SessionMonitor complet** du monitor avec les 3 modes (descriptor/execution/idle) et tous les panneaux : WorkflowTree, PhaseWorkflow, LLMActivity, ExecutionLog, Variables, Filesystem, Artifacts, Metrics, Widgets.

---

## 3. Architecture

### 3.1 Comment reutiliser les composants du monitor

**maestro-code importe directement depuis maestro-monitor** via des exports granulaires dans `package.json`.

```
@maestro/tui (design system: Panel, hooks, theme, sprites)
   ↑              ↑
   │              │
   │     @maestro/monitor (bibliotheque de composants applicatifs)
   │        ↑
   │        │  imports composants individuels
   │        │
@maestro/code (app principale — agent-first + monitor integre)
```

- **@maestro/tui** possede : Panel, NavBar, StatusBar, Header, PixelArt, tous les hooks, theme, types, sprites
- **@maestro/monitor** possede : WorkflowTree, LLMActivity, ExecutionLog, MetricsPanel, Variables, Filesystem, Artifacts, CommandLog, WidgetsPanel, PhaseWorkflow, SessionMonitor, CatalogScreen, SpacesScreen, ModelsScreen, FoundryScreen, HomeScreen, BlockDetail, WorkspaceDetail, RepoDetail, ModelDetail. Plus son propre `App.ts` entry point
- **@maestro/code** possede : Agent screen, FlipperLayout, InputPrompt, AgentActivity, SplashScreen, WelcomeScreen, SessionManager, adaptateurs d'ecrans. Importe composants depuis tui ET monitor

Les composants du monitor importent depuis `../theme.ts` qui re-exporte tout depuis `@maestro/tui` — ca fonctionne correctement quand consomme via `@maestro/monitor/components/X.ts`. Le monitor reste fonctionnel en standalone.

### 3.2 Exports a ajouter

`packages/maestro-monitor/package.json` :
```json
"exports": {
  ".": "./tui-monitor.ts",
  "./components/*": "./components/*",
  "./hooks/*": "./hooks/*",
  "./theme": "./theme.ts"
}
```

`packages/maestro-code/package.json` :
```json
"dependencies": { "@maestro/monitor": "*" }
```

---

## 4. Plan d'implementation

### Sub-Phase A : Foundation

**Objectif** : Rendre les composants importables, fixer le mode demo, appliquer le background terminal.

| Tache | Fichier | Detail |
|-------|---------|--------|
| A1 | `maestro-monitor/package.json` | Exports granulaires pour components/hooks/theme |
| A2 | `maestro-code/package.json` | Ajouter dependance `@maestro/monitor` |
| A3 | `maestro-code/App.ts` | Mode demo explicite : sans backend + sans `--demo` = ecran erreur rouge |
| A4 | `maestro-code/App.ts` | `setTerminalBg(palette.bg)` au demarrage, `resetTerminalBg()` a la fermeture |
| A5 | `maestro-cli/cli.ts` | Ajouter flag `--demo`, passer a `startInteractiveMode` |
| A6 | `maestro-code/launcher.ts` | Accepter et transmettre option `demo` |
| A7 | Tests | Verifier import composants monitor depuis maestro-code |

**Commit** : `fix: require --demo flag for demo mode, apply terminal background, export monitor components`

### Sub-Phase B : Remplacement des ecrans stubs

**Objectif** : Les ecrans Catalog/Sessions/Models utilisent les versions completes du monitor. Ecrans de detail fonctionnels.

| Tache | Fichier | Detail |
|-------|---------|--------|
| B1 | `maestro-code/types.ts` | Ajouter `workspace-detail`, `repo-detail`, `model-detail` |
| B2 | `screens/CatalogBrowser.ts` | Wrapper autour de `CatalogScreen` du monitor |
| B3 | `screens/SessionBrowser.ts` | Wrapper autour de `SpacesScreen` du monitor (3 onglets) |
| B4 | `screens/ModelsBrowser.ts` | Wrapper autour de `ModelsScreen` du monitor |
| B5 | `screens/BlockDetailScreen.ts` | NOUVEAU — wrapper `BlockDetail` |
| B6 | `screens/SessionDetailScreen.ts` | NOUVEAU — wrapper `SessionMonitor` complet |
| B7 | `screens/ModelDetailScreen.ts` | NOUVEAU — wrapper `ModelDetail` |
| B8 | `maestro-code/App.ts` | Routing pour tous les nouveaux types d'ecran |

**Commit** : `feat: replace stub screens with full monitor components, add detail views`

### Sub-Phase C : Layout Flipper Zero

**Objectif** : Transformer l'ecran agent d'un log plat en cockpit avec panneaux contextuels.

| Tache | Fichier | Detail |
|-------|---------|--------|
| C1 | `layouts/FlipperLayout.ts` | NOUVEAU — hero panel + context panels (WorkflowTree, MetricsPanel, ExecutionLog, LLMActivity) |
| C2 | `panels/AgentActivity.ts` | Mode compact (1-2 lignes) pour integration dans hero panel |
| C3 | `maestro-code/App.ts` | `renderAgentContent()` utilise FlipperLayout |
| C4 | Keyboard | Dispatch contextuel : hero focused = input, panel focused = nav |

**Layout FlipperLayout** :
- `sessionId: null` → hero panel plein ecran (mode idle)
- `sessionId: string` → hero (65%) + colonne droite (35%) + barre inferieure
- Colonne droite : `WorkflowTree` (haut) + `MetricsPanel` (bas)
- Barre inferieure : `ExecutionLog` (gauche) + `LLMActivity` (droite)
- Hooks : `usePanelFocus`, `useScroll`, `useTreeNav` depuis @maestro/tui

**Commit** : `feat: implement Flipper Zero layout with hero + context panels`

### Sub-Phase D : Polish et unification

| Tache | Fichier | Detail |
|-------|---------|--------|
| D1 | `maestro-code/App.ts` | StatusBar riche (connection, latency, focused panel, shortcuts contextuels) |
| D2 | `maestro-code/App.ts` | Mouse support (`useMouse`) : clic focus, scroll wheel |
| D3 | `screens/HelpOverlay.ts` | Fusionner shortcuts monitor + agent |
| D4 | `maestro-code/App.ts` | Raccourci `/session` ou `Ctrl+D` → SessionMonitor complet |

**Commit** : `feat: unified StatusBar, mouse support, expanded help`

### Sub-Phase E : Cleanup

| Tache | Fichier | Detail |
|-------|---------|--------|
| E1 | `maestro-code/App.ts` | Simplifier SessionManager (completion-only polling) |
| E2 | `maestro-code/App.ts` | Supprimer rendu log plat des noeuds (WorkflowTree le remplace) |
| E3 | `maestro-monitor/App.ts` | Notice de depreciation |
| E4 | `memory/MEMORY.md` | Mettre a jour architecture |
| E5 | Tests | Suite complete (maestro-code + monitor + tui) |

**Commit** : `refactor: cleanup duplicated polling, deprecate standalone monitor`

---

## 5. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Double NavBar (monitor screens rendent leur propre NavBar) | Moyen | Phase B : chaque ecran gere son chrome. Unifier dans une phase ulterieure |
| Conflit clavier (input texte vs navigation panel) | Eleve | Dispatch contextuel : hero focused = mode input, panel focused = mode nav |
| Double polling (SessionManager + useSessionData) | Faible | Phase E : simplifier SessionManager a completion-only |
| useInput multiplexe (Ink dispatch a tous les hooks) | Eleve | Un seul handler top-level qui route par contexte |
| Import resolution (../theme.ts relatif dans composants monitor) | Faible | Verifie : les imports relatifs resolvent dans le package monitor, fonctionne via workspace |

---

## 6. Verification

Apres chaque sub-phase :

1. `cd packages/maestro-code && npx vitest run tests/` — 63+ tests passent
2. `cd packages/maestro-monitor && npx vitest run tests/` — 4 tests passent
3. `cd packages/tui && npx vitest run tests/` — 67 tests passent
4. `node packages/maestro-cli/index.js code --demo --no-splash` — TUI avec background gris, mode demo marque [DEMO]
5. `node packages/maestro-cli/index.js code --no-splash` (sans backend) — ecran d'erreur clair, pas de demo silencieux
6. Tests ink-testing-library pour FlipperLayout (render idle + render active)
7. Verification visuelle : lancer le TUI et verifier la navigation ecrans

---

## 7. Criteres de completion

- [ ] Composants monitor importables depuis maestro-code
- [ ] Mode demo explicite (--demo), erreur claire sans backend
- [ ] Terminal background gris applique
- [ ] Ecrans catalog/sessions/models utilisent les versions completes du monitor
- [ ] Block detail, session detail, model detail fonctionnels
- [ ] Layout Flipper Zero sur ecran agent (hero + context panels)
- [ ] WorkflowTree, MetricsPanel, ExecutionLog, LLMActivity integres dans FlipperLayout
- [ ] Panel focus cycling (Tab/Shift-Tab)
- [ ] StatusBar riche avec connection/latency/shortcuts
- [ ] Mouse support
- [ ] HelpOverlay etendu
- [ ] Tous les tests passent (158+)

---

## 8. Fichiers cles de reference

| Fichier | Role |
|---------|------|
| `packages/maestro-monitor/components/SessionMonitor.ts` | Reference implementation du layout multi-panel avec panel focus, scroll, tree nav, keyboard, mode detection |
| `packages/maestro-monitor/App.ts` | Reference pour navigation, setTerminalBg, routing detail views |
| `packages/maestro-code/App.ts` | Fichier principal a modifier — SessionManager, routing, layout |
| `packages/maestro-code/hooks/useNavigation.ts` | Agent-in-the-Cockpit — deja correct, a preserver |
| `packages/tui/hooks/usePanelFocus.ts` | Hook pour cycling entre panneaux |
| `packages/tui/hooks/useScroll.ts` | Hook pour scroll multi-panel |
| `packages/tui/hooks/useTreeNav.ts` | Hook pour navigation arborescente |
| `packages/tui/theme/terminal.ts` | setTerminalBg / resetTerminalBg |
