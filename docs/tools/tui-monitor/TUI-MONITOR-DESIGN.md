# Design Document: Maestro TUI Monitor

## Contexte

Le TUI Monitor actuel a plusieurs problèmes:
- Affiche "undefined" à plusieurs endroits
- Ne montre pas le filesystem lié à la session
- Ne montre pas l'arbre d'exécution des workflows
- Les widgets personnalisés ne s'affichent pas correctement
- Pas de navigation entre sessions

Ce document propose une architecture pour un TUI Monitor complet et évolutif.

---

## 1. Architecture de Navigation

### Option A: Navigation Interne au Monitor (Recommandée)

```
┌─────────────────────────────────────────────────────────────────┐
│  MAESTRO MONITOR                                    [?] help    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [TAB] Switch view   [1-9] Select session   [/] Filter          │
│                                                                 │
│  Views: [S]essions  [W]orkflow  [F]iles  [V]ars  [L]ogs        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Avantages:**
- Une seule fenêtre à gérer
- Navigation fluide avec raccourcis clavier
- L'utilisateur peut personnaliser son layout
- Contexte préservé lors du changement de vue

**Inconvénients:**
- Plus complexe à implémenter
- Espace limité sur petit écran

### Option B: Shells Séparés par Fonction

```bash
# Vue globale des sessions
maestro monitor --view sessions

# Vue détaillée d'une session
maestro monitor <session-id>

# Vue workflow seulement
maestro monitor <session-id> --view workflow

# Vue filesystem seulement
maestro monitor <session-id> --view files
```

**Avantages:**
- Simple à implémenter
- Chaque vue a tout l'espace
- Peut ouvrir plusieurs fenêtres côte à côte

**Inconvénients:**
- Plusieurs fenêtres à gérer
- Pas de navigation fluide

### Option C: Hybride (Recommandée pour MVP)

Le monitor principal avec navigation interne, mais possibilité de "détacher" des vues:

```bash
# Monitor principal avec navigation
maestro monitor <session-id>

# Détacher une vue dans une nouvelle fenêtre
[d] pour détacher la vue courante
```

---

## 2. Layout Proposé du TUI Monitor

### 2.1 Vue Session Unique (Default)

```
┌─ MAESTRO ──────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ● Generate Commit Tool Session                          13b28ebd  running │
│    project: Gen Commit Foundry                           duration: 5m 23s  │
│                                                                            │
├─ WORKFLOW TREE ────────────────────────────────────────────────────────────┤
│                                                                            │
│  ▼ agent-improvement-loop                                        [running] │
│    ├─ ✓ evaluate-current                                    0.42  [done]   │
│    ├─ ● generate-improvement                                      [active] │
│    │   └─ inference: analyzing patterns...                                 │
│    ├─ ○ apply-changes                                            [pending] │
│    └─ ○ check-fitness                                            [pending] │
│                                                                            │
├─ FILESYSTEM ───────────────────────────────────────────┬─ VARIABLES ───────┤
│                                                        │                   │
│  C:\Users\arthu\foundry-repos\gen-commit\              │  iteration    2   │
│  ├─ src/                                    [rw]       │  fitness    0.42  │
│  │   ├─ index.ts                            [rw]       │  target     0.85  │
│  │   └─ utils.ts                            [rw]       │  phase  optimize  │
│  ├─ tests/                                  [r-]       │  threshold   0.8  │
│  │   └─ index.test.ts                       [r-]       │                   │
│  ├─ node_modules/                           [--]       │                   │
│  └─ package.json                            [r-]       │                   │
│                                                        │                   │
├─ COMMAND LOG ──────────────────────────────────────────┴───────────────────┤
│                                                                            │
│  ✓ 15:23:45  vars set iteration 2                                          │
│    → iteration: 2                                                          │
│  ✓ 15:23:42  invoke start                                                  │
│    → workflow agent-improvement-loop started                               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  [q]uit  [r]efresh  [1]tree  [2]files  [3]vars  [4]logs  [w]idgets  [?]    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Légende Couleurs Filesystem

| Couleur | Signification |
|---------|---------------|
| `vert` | Lecture + Écriture (rw) |
| `jaune` | Lecture seule (r-) |
| `rouge` | Aucun accès (--) |
| `gris` | Ignoré (ex: node_modules) |
| `cyan` | Fichier actuellement modifié |

### 2.3 Légende Couleurs Workflow Tree

| Icône/Couleur | Signification |
|---------------|---------------|
| `✓ vert` | Terminé avec succès |
| `● cyan` | En cours d'exécution |
| `○ gris` | En attente |
| `✗ rouge` | Échec |
| `⏸ jaune` | En pause / Attente approbation |
| `↺ bleu` | Boucle (iteration N) |

### 2.4 Vue Multi-Sessions

```
┌─ MAESTRO SESSIONS ─────────────────────────────────────────────────────────┐
│                                                                            │
│  Active Sessions (3)                                    [n]ew  [f]ilter    │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ● Gen Commit Tool             13b28ebd   running   5m 23s           │   │
│  │   workflow: agent-improvement-loop  iter: 2/10  fitness: 42%        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ API Validator               a9f3c21d   paused    12m 05s          │   │
│  │   workflow: block-validation  awaiting approval                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Test Runner                 7bc45e12   completed 2m 14s           │   │
│  │   workflow: test-suite  12/12 passed                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  [↑↓] Navigate  [enter] Open  [s]tart  [p]ause  [x]stop  [q]uit           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Widgets Personnalisés

Les widgets définis dans le template de session devraient s'afficher dans une zone dédiée:

### 3.1 Zone Widgets (Toggle avec [w])

```
┌─ CUSTOM WIDGETS ───────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌─ Fitness Score ──────────┐  ┌─ Score History ────────────────────────┐  │
│  │ ████████░░░░░░░░░░ 42%   │  │ 1.0 ┤                    ╭── target    │  │
│  │ target: 85%              │  │     │              ╭────╯             │  │
│  └──────────────────────────┘  │ 0.5 ┤        ╭────╯                   │  │
│                                │     │  ╭────╯                         │  │
│  ┌─ Iteration ──────────────┐  │ 0.0 ┼──┴──────────────────────────    │  │
│  │ 2 / 10                   │  │       1   2   3   4   5   6   7       │  │
│  └──────────────────────────┘  └────────────────────────────────────────┘  │
│                                                                            │
│  ┌─ Pending Approvals ──────┐  ┌─ Recent Events ────────────────────────┐  │
│  │ 0                        │  │ ✓ Task evaluate-current completed      │  │
│  └──────────────────────────┘  │ ● Inference running...                 │  │
│                                └────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Configuration des Widgets

Les widgets sont configurés dans le template de session:

```json
{
  "monitorWidgets": [
    {
      "id": "fitness-progress",
      "type": "progress-bar",
      "position": { "row": 0, "col": 0, "width": 1, "height": 1 },
      "config": {
        "label": "Fitness Score",
        "current": "$.variables.currentFitness",
        "max": 1.0
      }
    }
  ]
}
```

---

## 4. Panneau Filesystem Dynamique

### 4.1 Binding Workflow → Filesystem

Chaque workflow définit ses accès filesystem:

```json
{
  "workflow": "agent-improvement-loop",
  "filesystem": {
    "workingDirectory": "C:\\Users\\arthu\\foundry-repos\\gen-commit",
    "access": [
      { "pattern": "src/**", "mode": "rw" },
      { "pattern": "tests/**", "mode": "r" },
      { "pattern": "*.json", "mode": "r" },
      { "pattern": "node_modules/**", "mode": "none" }
    ]
  }
}
```

### 4.2 Affichage Dynamique

Quand un workflow est actif, le panneau filesystem:
1. Affiche l'arbre avec les couleurs d'accès
2. Highlight les fichiers en cours de modification
3. Montre les fichiers récemment accédés
4. Filtre automatiquement les dossiers ignorés (collapse)

### 4.3 Changement de Contexte

Quand on passe d'un workflow à un autre:
- Animation de transition des couleurs
- Fichiers qui perdent l'accès passent en rouge puis gris
- Fichiers qui gagnent l'accès passent de gris à vert

---

## 5. Raccourcis Clavier Proposés

### 5.1 Navigation Globale

| Touche | Action |
|--------|--------|
| `q` | Quitter |
| `?` | Aide |
| `r` | Rafraîchir |
| `Tab` | Changer de panneau actif |
| `1-5` | Aller au panneau N |
| `/` | Recherche/Filtre |
| `Esc` | Annuler/Retour |

### 5.2 Panneaux Toggle

| Touche | Panneau |
|--------|---------|
| `t` | Workflow Tree |
| `f` | Filesystem |
| `v` | Variables |
| `l` | Command Log |
| `w` | Widgets |
| `e` | Events |

### 5.3 Actions Session

| Touche | Action |
|--------|--------|
| `s` | Start session |
| `p` | Pause session |
| `x` | Stop session |
| `i` | Invoke entry point |
| `a` | Approve pending |

### 5.4 Navigation Arbre

| Touche | Action |
|--------|--------|
| `↑↓` | Naviguer |
| `←→` | Collapse/Expand |
| `Enter` | Sélectionner/Détails |
| `Space` | Toggle sélection |

---

## 6. Architecture Technique

### 6.1 Structure des Composants

```
monitor/
├── tui-monitor.js          # Main entry, screen management
├── components/
│   ├── header.js           # Session info header
│   ├── workflow-tree.js    # Execution tree component
│   ├── filesystem.js       # File browser component
│   ├── variables.js        # Variables panel
│   ├── command-log.js      # Command history
│   ├── widgets/            # Custom widget renderers
│   │   ├── progress-bar.js
│   │   ├── counter.js
│   │   ├── score-chart.js
│   │   └── status-list.js
│   └── sessions-list.js    # Multi-session view
├── layouts/
│   ├── single-session.js   # Default layout
│   ├── multi-session.js    # Sessions overview
│   └── custom.js           # User-customizable
└── utils/
    ├── colors.js           # Color scheme
    ├── keybindings.js      # Keyboard handling
    └── api-sync.js         # Real-time data sync
```

### 6.2 Flux de Données

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│  API Client │────▶│ TUI Monitor │
│   (API)     │◀────│  (polling)  │◀────│ (blessed)   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │         WebSocket (future)             │
      └────────────────────────────────────────┘
```

### 6.3 Refresh Strategy

- **Polling actuel**: 2s interval
- **Future WebSocket**: Real-time push
- **Smart refresh**: Ne rafraîchir que les panneaux visibles
- **Diff-based**: Ne re-render que ce qui a changé

---

## 7. Questions Ouvertes

### 7.1 Persistance Layout

L'utilisateur devrait-il pouvoir sauvegarder son layout préféré?

```bash
# Sauvegarder le layout actuel
maestro monitor --save-layout myconfig

# Charger un layout
maestro monitor <session> --layout myconfig
```

### 7.2 Responsive Design

Comment gérer les petits terminaux?
- Mode compact automatique
- Priorité aux panneaux essentiels
- Scroll horizontal pour les arbres larges

### 7.3 Multi-Monitor

Support pour afficher différentes vues sur différents moniteurs/terminaux?

```bash
# Terminal 1: Vue globale
maestro monitor --view sessions

# Terminal 2: Session spécifique avec workflow
maestro monitor 13b28ebd --view workflow

# Terminal 3: Logs en temps réel
maestro monitor 13b28ebd --view logs --follow
```

### 7.4 Intégration IDE

Devrait-on avoir une version intégrable dans VS Code ou autres?

---

## 8. Plan d'Implémentation

### Phase 1: Corrections Urgentes
- [ ] Fixer les "undefined"
- [ ] Afficher correctement les widgets du template
- [ ] Corriger le calcul de duration

### Phase 2: Workflow Tree
- [ ] Composant workflow-tree.js
- [ ] Couleurs selon état
- [ ] Mise à jour en temps réel

### Phase 3: Filesystem Panel
- [ ] Composant filesystem.js
- [ ] Couleurs selon accès
- [ ] Binding workflow → filesystem

### Phase 4: Navigation
- [ ] Raccourcis clavier
- [ ] Toggle panneaux
- [ ] Vue multi-sessions

### Phase 5: Améliorations
- [ ] WebSocket real-time
- [ ] Layouts personnalisables
- [ ] Persistance config

---

## 9. Décisions Finales

### 9.1 Architecture: Option C (Hybride) ✓

Navigation interne avec possibilité de détacher des vues dans des fenêtres séparées.

### 9.2 Layout Adaptatif selon Contexte

Le TUI change automatiquement son layout selon l'état de la session:

**Mode EXECUTION (workflow en cours):**
```
┌─ Header ────────────────────────────────────────────────────────┐
├─ WORKFLOW TREE (50%) ───────────────────────────────────────────┤
│  ▼ agent-improvement-loop                            [running]  │
│    ├─ ✓ evaluate-current                                        │
│    ├─ ● generate-improvement ◀── focus                          │
│    └─ ○ apply-changes                                           │
├─ FILESYSTEM (25%) ────────────┬─ WIDGETS (25%) ─────────────────┤
│  src/              [rw]       │  ████████░░░░ 42%               │
│  tests/            [r-]       │  Iteration: 2/10                │
│  node_modules/     [--]       │  Events: ● running...           │
├─────────────────────────────────────────────────────────────────┤
│  [t]ree [f]iles [w]idgets [v]ars [l]ogs [d]etach [?]            │
└─────────────────────────────────────────────────────────────────┘
```

**Mode IDLE (pas de workflow actif):**
```
┌─ Header ────────────────────────────────────────────────────────┐
├─ VARIABLES (40%) ─────────────┬─ FILESYSTEM (40%) ──────────────┤
│  iteration      2             │  src/              [rw]         │
│  fitness        0.42          │  tests/            [r-]         │
│  target         0.85          │  package.json      [r-]         │
│  phase          optimize      │                                 │
├─ COMMAND LOG (20%) ─────────────────────────────────────────────┤
│  ✓ 15:23:45  vars set iteration 2                               │
│  ✓ 15:23:42  session start                                      │
├─────────────────────────────────────────────────────────────────┤
│  [v]ars [f]iles [l]ogs [t]ree [w]idgets [i]nvoke [?]            │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Multi-Sessions Flexible

L'utilisateur peut configurer sa vue multi-sessions:

**Vue côte à côte (2 sessions):**
```
┌─ Session A ─────────────────────┬─ Session B ─────────────────────┐
│  ● Gen Commit Tool   [running]  │  ○ API Validator    [paused]    │
│                                 │                                 │
│  ▼ improvement-loop             │  Variables:                     │
│    ├─ ✓ evaluate                │    status: awaiting_approval    │
│    └─ ● generate                │    block: tools/git-diff        │
│                                 │                                 │
│  src/         [rw]              │  Pending:                       │
│  tests/       [r-]              │    1 approval waiting           │
│                                 │                                 │
└─────────────────────────────────┴─────────────────────────────────┘
```

**Vue liste (N sessions):**
```
┌─ SESSIONS ──────────────────────────────────────────────────────┐
│                                                                 │
│  [1] ● Gen Commit Tool      running   improvement-loop  i:2/10  │
│  [2] ○ API Validator        paused    awaiting approval         │
│  [3] ✓ Test Runner          done      12/12 passed              │
│                                                                 │
│  [↑↓] select  [Enter] focus  [Space] toggle side-by-side        │
└─────────────────────────────────────────────────────────────────┘
```

**Actions de layout:**
- `[d]` Détacher la session courante dans une nouvelle fenêtre
- `[Space]` Ajouter/retirer de la vue côte à côte
- `[Enter]` Focus sur une session (plein écran)
- `[Backspace]` Retour à la vue liste

### 9.4 Raccourcis de Layout

| Touche | Action |
|--------|--------|
| `d` | Détacher dans nouvelle fenêtre |
| `Space` | Toggle côte à côte |
| `Enter` | Focus/Plein écran |
| `Backspace` | Retour vue précédente |
| `1-9` | Sélectionner session N |
| `=` | Split horizontal |
| `\|` | Split vertical |
| `-` | Fermer split |

---

## 10. Implémentation Proposée

### Phase 1: Fondations (Priorité Haute)
1. [ ] Fixer bugs actuels (undefined, duration)
2. [ ] Refactorer en composants modulaires
3. [ ] Implémenter système de layout adaptatif
4. [ ] Détecter état session (workflow running vs idle)

### Phase 2: Composants Core
1. [ ] Workflow Tree avec couleurs dynamiques
2. [ ] Filesystem avec binding accès
3. [ ] Widget renderer pour templates
4. [ ] Command Log amélioré

### Phase 3: Multi-Sessions
1. [ ] Vue liste sessions
2. [ ] Vue côte à côte
3. [ ] Détachement fenêtres
4. [ ] Synchronisation entre vues

### Phase 4: Polish
1. [ ] Animations transitions
2. [ ] Persistance layout utilisateur
3. [ ] WebSocket real-time
4. [ ] Responsive petit terminal

---

## 11. Conclusion

Le TUI Monitor sera:
- **Adaptatif**: Layout change selon contexte (execution vs idle)
- **Flexible**: L'utilisateur arrange ses sessions comme il veut
- **Modulaire**: Composants détachables
- **Informatif**: Bonne info au bon moment

Priorités d'affichage:
| Contexte | Priorité 1 | Priorité 2 | Priorité 3 |
|----------|------------|------------|------------|
| Workflow actif | Workflow Tree | Filesystem | Widgets |
| Idle | Variables | Filesystem | Command Log |
