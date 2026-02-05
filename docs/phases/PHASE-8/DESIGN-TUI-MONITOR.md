# Design: TUI Monitor - Option C Hybride

## Contexte

Le TUI Monitor est l'interface de supervision des sessions Maestro. Ce document présente le choix de conception retenu et le layout proposé.

---

## Choix de Conception: Option C (Hybride)

### Options Évaluées

| Option | Description | Avantages | Inconvénients |
|--------|-------------|-----------|---------------|
| **A** | Navigation 100% interne au TUI | Une seule fenêtre, navigation fluide | Complexe, espace limité |
| **B** | Shells séparés par fonction | Simple, tout l'espace | Plusieurs fenêtres à gérer |
| **C** | Hybride: TUI monitoring + CLI/API orchestration | Meilleur des deux mondes | - |

### Décision: Option C

**Le TUI Monitor se concentre sur le monitoring. L'orchestration (détachement, split, multi-sessions) se fait via CLI/API.**

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CLI / Maestro Shell                                           │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  maestro monitor <session> --layout workflow            │   │
│   │  maestro monitor --sessions A,B --split horizontal      │   │
│   │  maestro monitor --detach <session> --view files        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                      API                                │   │
│   │  POST /api/monitor/open                                 │   │
│   │  POST /api/monitor/split                                │   │
│   │  POST /api/monitor/layout                               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  TUI Monitor(s)                         │   │
│   │  - Affichage read-only                                  │   │
│   │  - Refresh automatique                                  │   │
│   │  - Toggle panneaux (local)                              │   │
│   │  - Navigation clavier (local)                           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Justification

1. **Séparation des responsabilités**
   - TUI = Affichage et navigation locale
   - CLI/API = Orchestration et configuration

2. **Scriptabilité**
   ```powershell
   # Script pour ouvrir un layout de développement
   maestro monitor $SESSION_A --layout workflow --position left
   maestro monitor $SESSION_B --layout files --position right
   ```

3. **Intégration future**
   - VS Code extension peut utiliser l'API
   - Web UI peut utiliser l'API
   - Automation/CI peut utiliser l'API

4. **TUI léger**
   - Pas de logique d'orchestration
   - Démarre rapidement
   - Consomme moins de ressources

---

## Commandes CLI Proposées

### Ouvrir un Monitor

```bash
# Monitor simple
maestro monitor <session-id>

# Avec layout spécifique
maestro monitor <session-id> --layout workflow
maestro monitor <session-id> --layout idle
maestro monitor <session-id> --layout minimal

# Vue spécifique seulement
maestro monitor <session-id> --view tree
maestro monitor <session-id> --view files
maestro monitor <session-id> --view vars
maestro monitor <session-id> --view logs
maestro monitor <session-id> --view widgets
```

### Multi-Sessions

```bash
# Liste des sessions (vue sélection)
maestro monitor --list

# Plusieurs sessions côte à côte
maestro monitor --sessions <id1>,<id2> --split horizontal
maestro monitor --sessions <id1>,<id2> --split vertical

# Grille de sessions
maestro monitor --sessions <id1>,<id2>,<id3>,<id4> --grid 2x2
```

### Détachement

```bash
# Ouvrir dans une nouvelle fenêtre
maestro monitor <session-id> --detach

# Détacher une vue spécifique
maestro monitor <session-id> --detach --view tree
maestro monitor <session-id> --detach --view files
```

### Layouts Sauvegardés

```bash
# Sauvegarder le layout actuel
maestro monitor --save-layout dev-setup

# Charger un layout
maestro monitor --load-layout dev-setup

# Lister les layouts
maestro monitor --layouts
```

---

## Layout Proposé

### Principe: Layout Adaptatif

Le TUI adapte automatiquement son affichage selon l'état de la session:

| État | Panneaux Prioritaires | Raison |
|------|----------------------|--------|
| **Workflow actif** | Tree + Files + Widgets | Suivre l'exécution en cours |
| **Idle** | Vars + Files + Logs | Inspecter l'état, préparer actions |

### Mode EXECUTION (Workflow en cours)

```
┌─ MAESTRO ──────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ● Generate Commit Tool Session                          13b28ebd  running │
│    workflow: agent-improvement-loop                      duration: 5m 23s  │
│                                                                            │
├─ WORKFLOW TREE ────────────────────────────────────────────────────────────┤
│                                                                            │
│  ▼ agent-improvement-loop                                        [running] │
│    │                                                                       │
│    ├─ ✓ evaluate-current                                    0.42    [done] │
│    │   └─ output: fitness score calculated                                 │
│    │                                                                       │
│    ├─ ● generate-improvement                                     [active]  │
│    │   ├─ inference: analyzing code patterns...                            │
│    │   └─ progress: 67%                                                    │
│    │                                                                       │
│    ├─ ○ apply-changes                                           [pending]  │
│    │                                                                       │
│    └─ ○ check-fitness                                           [pending]  │
│                                                                            │
├─ FILESYSTEM ───────────────────────────────────┬─ WIDGETS ─────────────────┤
│                                                │                           │
│  C:\foundry-repos\gen-commit\                  │  Fitness Score            │
│  │                                             │  ████████░░░░░░░░░░ 42%   │
│  ├─ src/                           [rw]        │  target: 85%              │
│  │   ├─ index.ts                   [rw]  ◀──   │                           │
│  │   ├─ commit-generator.ts        [rw]        │  Iteration                │
│  │   └─ utils/                     [rw]        │  2 / 10                   │
│  │       └─ parser.ts              [rw]        │                           │
│  │                                             │  Score History            │
│  ├─ tests/                         [r-]        │  ▁▂▃▄▅▆ 0.42              │
│  │   └─ commit.test.ts             [r-]        │                           │
│  │                                             │  Pending Approvals        │
│  ├─ node_modules/                  [--]        │  0                        │
│  │                                             │                           │
│  └─ package.json                   [r-]        │                           │
│                                                │                           │
├────────────────────────────────────────────────┴───────────────────────────┤
│  ● connected  45ms  15:23:47      [t]ree [f]iles [w]idgets [v]ars [l]ogs   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Légende Workflow Tree:**
| Symbole | Couleur | Signification |
|---------|---------|---------------|
| `✓` | vert | Terminé avec succès |
| `●` | cyan | En cours d'exécution |
| `○` | gris | En attente |
| `✗` | rouge | Échec |
| `⏸` | jaune | En pause / Attente approbation |

**Légende Filesystem:**
| Tag | Couleur | Signification |
|-----|---------|---------------|
| `[rw]` | vert | Lecture + Écriture |
| `[r-]` | jaune | Lecture seule |
| `[--]` | rouge/gris | Aucun accès |
| `◀──` | cyan | Fichier en cours de modification |

### Mode IDLE (Pas de workflow actif)

```
┌─ MAESTRO ──────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ○ Generate Commit Tool Session                          13b28ebd    idle  │
│    project: Gen Commit Foundry                           duration: 12m 45s │
│                                                                            │
├─ VARIABLES ────────────────────────────────────┬─ FILESYSTEM ──────────────┤
│                                                │                           │
│  Session Config                                │  C:\foundry-repos\gen-commit\
│  ─────────────────                             │  │                        │
│  qualityThreshold      0.8                     │  ├─ src/                  │
│  maxIterations         10                      │  │   ├─ index.ts          │
│  maxOptimizationRounds 5                       │  │   └─ utils/            │
│  targetFitness         0.85                    │  │                        │
│                                                │  ├─ tests/                │
│  Current State                                 │  │   └─ commit.test.ts    │
│  ─────────────────                             │  │                        │
│  currentPhase          1                       │  └─ package.json          │
│  currentIteration      0                       │                           │
│  currentFitness        0                       │                           │
│  scoreHistory          []                      │                           │
│                                                │                           │
├─ COMMAND LOG ──────────────────────────────────┴───────────────────────────┤
│                                                                            │
│  ✓ 15:23:45  vars set qualityThreshold 0.8                                 │
│              → qualityThreshold: 0.8                                       │
│                                                                            │
│  ✓ 15:23:42  vars set maxIterations 10                                     │
│              → maxIterations: 10                                           │
│                                                                            │
│  ✓ 15:23:38  session import --template foundry-default                     │
│              → 12 variables, 6 entry points, 5 widgets imported            │
│                                                                            │
│  ✓ 15:23:30  session create --project 75fbefbc --name "Generate..."        │
│              → session 13b28ebd created                                    │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  ● connected  32ms  15:35:12      [v]ars [f]iles [l]ogs [t]ree [w]idgets   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Vue Multi-Sessions

```
┌─ MAESTRO SESSIONS ─────────────────────────────────────────────────────────┐
│                                                                            │
│  3 sessions actives                                         [r]efresh     │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [1] ● Generate Commit Tool                    13b28ebd    running   │  │
│  │      workflow: agent-improvement-loop          iter: 2/10            │  │
│  │      fitness: ████████░░░░ 42%                 duration: 5m 23s      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [2] ⏸ API Validator                           a9f3c21d    paused    │  │
│  │      awaiting approval: tools/git-diff                               │  │
│  │      1 pending approval                        duration: 12m 05s     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [3] ✓ Test Runner                             7bc45e12    completed │  │
│  │      workflow: test-suite                      12/12 passed          │  │
│  │      result: success                           duration: 2m 14s      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  [↑↓] navigate  [Enter] open  [1-9] quick select  [n]ew  [q]uit           │
└────────────────────────────────────────────────────────────────────────────┘
```

### Vue Côte à Côte (via CLI)

```bash
maestro monitor --sessions 13b28ebd,a9f3c21d --split vertical
```

```
┌─ Session: 13b28ebd ─────────────────┬─ Session: a9f3c21d ─────────────────┐
│                                     │                                     │
│  ● Generate Commit Tool   running   │  ⏸ API Validator        paused      │
│                                     │                                     │
│  ▼ agent-improvement-loop           │  Awaiting Approval                  │
│    ├─ ✓ evaluate-current            │  ────────────────────               │
│    ├─ ● generate-improvement        │                                     │
│    └─ ○ apply-changes               │  Block: tools/git-diff              │
│                                     │  Type:  tool                        │
│  Fitness: ████████░░░░ 42%          │  Submitted: 15:20:03                │
│  Iteration: 2/10                    │                                     │
│                                     │  [a]pprove  [r]eject                │
│                                     │                                     │
├─────────────────────────────────────┼─────────────────────────────────────┤
│  ● 45ms  [t] [f] [w]                │  ● 32ms  [v] [l]                     │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## Raccourcis Clavier (Dans le TUI)

Le TUI garde des raccourcis simples pour la navigation **locale**:

### Navigation Panneaux

| Touche | Action |
|--------|--------|
| `t` | Toggle Workflow Tree |
| `f` | Toggle Filesystem |
| `v` | Toggle Variables |
| `l` | Toggle Command Log |
| `w` | Toggle Widgets |
| `Tab` | Panneau suivant |

### Actions Locales

| Touche | Action |
|--------|--------|
| `r` | Rafraîchir maintenant |
| `↑↓` | Naviguer dans le panneau actif |
| `←→` | Collapse/Expand (arbres) |
| `/` | Recherche dans panneau |
| `?` | Aide |
| `q` | Quitter |

### Actions Session (via prompt)

| Touche | Action |
|--------|--------|
| `:` | Ouvrir prompt commande |
| `i` | Invoquer entry point (ouvre sélecteur) |
| `a` | Approuver (si pending) |

**Note**: Les actions complexes (split, detach, multi-session) se font via CLI, pas dans le TUI.

---

## Intégration API

### Endpoints Monitor

```
POST /api/monitor/sessions/{id}/open
  body: { layout: "workflow" | "idle" | "minimal", detach: bool }

POST /api/monitor/split
  body: { sessions: ["id1", "id2"], direction: "horizontal" | "vertical" }

GET /api/monitor/layouts
  -> [{ name: "dev-setup", sessions: [...], splits: [...] }]

POST /api/monitor/layouts
  body: { name: "my-layout", config: {...} }
```

### Événements WebSocket (Future)

```
ws://localhost:5000/monitor/{session-id}

Events:
- session.status.changed
- workflow.node.started
- workflow.node.completed
- variable.updated
- filesystem.accessed
```

---

## Conclusion

L'Option C Hybride sépare clairement:

| Responsabilité | Outil |
|----------------|-------|
| **Monitoring** | TUI Monitor |
| **Orchestration** | CLI / Maestro Shell |
| **Intégration** | API REST + WebSocket |

Cette architecture permet:
- Un TUI simple et performant
- Des scripts d'automatisation
- Une intégration IDE future
- Une évolution indépendante des composants
