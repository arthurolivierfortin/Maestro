# Design: Display Descriptors — Les sessions contrôlent leur affichage TUI

**Date**: 6 février 2026
**Status**: Approuvé
**Auteur**: Claude (Agent Phase 8)

---

## 1. Problème

Le TUI Monitor actuel affiche un arbre d'exécution minimaliste (nœuds avec pending/running/done)
et des widgets statiques. Quand un utilisateur observe une session en cours, il voit :

```
 WORKFLOW TREE

  ├─ ✓ evaluate-current      [done]
  │    → Git Diff: 3 files changed...
  ├─ ● generate-improvement  [running]
  ├─ ○ apply-changes         [pending]
  └─ ○ check-fitness         [pending]
```

**Problèmes identifiés** :
- L'utilisateur ne sait pas **quelle phase** de la session est en cours
- Il ne voit pas **le détail** de ce que fait le block actif (output LLM, tokens, logs)
- Il n'y a pas de **log d'exécution** en temps réel
- Il ne voit pas les **artefacts produits** (fichiers créés/modifiés)
- Les **métriques** (fitness, iterations) sont noyées dans les widgets ou les variables
- Chaque type de session aurait besoin d'un affichage différent, mais le TUI est figé

---

## 2. Options Évaluées

### Option A : Enhanced Widgets Only

**Concept** : Ajouter plus de types de widgets (phase-list, block-detail, log-viewer) et
laisser chaque session les enregistrer dans `monitorWidgets`.

| Avantages | Inconvénients |
|-----------|---------------|
| Simple, réutilise le système existant | Les widgets sont statiques (définis au template import) |
| Pas de nouveau mécanisme | Ne peut pas changer le layout dynamiquement |
| | Limité à la zone widgets (pas de layout zones) |
| | Pas de lien entre phases, blocks et métriques |

**Verdict** : Insuffisant. Les widgets sont conçus pour des métriques atomiques,
pas pour un affichage dynamique qui change selon l'état de l'exécution.

### Option B : Session Display Plugins

**Concept** : Chaque session fournit un fichier JavaScript de plugin TUI qui est chargé
dynamiquement par le monitor.

| Avantages | Inconvénients |
|-----------|---------------|
| Contrôle total sur l'affichage | Sécurité : exécution de code arbitraire |
| Flexibilité maximale | Complexité : chaque session doit écrire du JS |
| | Pas de standard entre sessions |
| | Difficulté de maintenance |

**Verdict** : Trop complexe et risqué. Brise le principe de séparation données/affichage.

### Option C : Display Descriptors (Retenu)

**Concept** : Les sessions écrivent une variable structurée `_monitorDescriptor` qui décrit
le layout et les composants à afficher. Le TUI interprète ce descripteur et adapte son
affichage. Les données (phases, blocks, logs) sont dans d'autres variables standardisées.

| Avantages | Inconvénients |
|-----------|---------------|
| Déclaratif : les sessions décrivent QUOI afficher, pas COMMENT | Limité aux composants existants |
| Sécurisé : pas d'exécution de code | Nécessite de nouveaux composants TUI |
| Standardisé : format JSON commun | |
| Dynamique : le layout change selon l'état | |
| Compatible : sessions sans descripteur gardent l'ancien affichage | |
| Extensible : nouveaux composants ajoutés au TUI sans toucher les sessions | |

**Verdict** : Meilleur équilibre entre flexibilité et sécurité. Respecte l'architecture
generic/specific de Maestro (l'infrastructure fournit les composants, les sessions définissent
quoi afficher).

---

## 3. Architecture Display Descriptors

### 3.1 Principe

```
┌────────────────────────────────────┐     ┌──────────────────────────────────┐
│       SESSION (Backend)            │     │       TUI MONITOR (Frontend)     │
│                                    │     │                                  │
│  Variables de session :            │     │  1. GET /api/sessions/{id}       │
│                                    │ API │  2. Lire session.variables       │
│  _monitorDescriptor = {            │────▶│  3. Si _monitorDescriptor existe │
│    layout: { zones... },           │     │     → mode "descriptor"          │
│    components: [...]               │     │  4. Créer les boxes blessed      │
│  }                                 │     │     selon layout.zones           │
│                                    │     │  5. Rendre chaque composant      │
│  _phases = [...]                   │     │     avec ses données             │
│  _activeBlock = {...}              │     │  6. Refresh toutes les 2s        │
│  _executionLog = [...]             │     │                                  │
│  _artifacts = [...]                │     └──────────────────────────────────┘
│  _executionTree = [...]            │
│  currentFitness = 0.75            │
│  currentIteration = 3             │
│  scoreHistory = [0.5, 0.6, 0.75]  │
│                                    │
└────────────────────────────────────┘
```

### 3.2 Séparation Generic vs Specific

Ce design respecte parfaitement le principe Phase 8 (voir `README.md`) :

| Couche | Ce qu'elle fournit |
|--------|--------------------|
| **Generic (Maestro TUI)** | Les composants de rendu : `phase-list`, `block-detail`, `metrics-panel`, `execution-log`, `artifacts`, `workflow-tree` |
| **Generic (Maestro TUI)** | Le layout engine qui lit `_monitorDescriptor` et positionne les zones |
| **Specific (Session)** | Le contenu de `_monitorDescriptor` (quels composants, où) |
| **Specific (Session)** | Les données dans `_phases`, `_activeBlock`, `_executionLog`, `_artifacts` |

Une session différente (ex: Code Reviewer) pourrait écrire un `_monitorDescriptor` complètement
différent utilisant les mêmes composants mais dans un layout différent, ou n'en utiliser qu'un
sous-ensemble.

### 3.3 Backward Compatibility

- **Sessions sans `_monitorDescriptor`** : Le TUI continue d'utiliser les modes `execution`/`idle` existants (l'ancien comportement est inchangé)
- **Sessions avec `_monitorDescriptor`** : Le TUI active le mode `descriptor` qui utilise le layout et composants décrits
- **Transition douce** : Une session peut commencer sans descripteur (mode idle), puis écrire le descripteur quand l'exécution commence

---

## 4. Modèle de Données

### 4.1 `_monitorDescriptor` — Layout et composants

```json
{
  "layout": {
    "mode": "phased",
    "zones": {
      "left":   { "width": "40%", "components": ["phases", "workflow-tree"] },
      "right":  { "width": "60%", "components": ["block-detail", "metrics"] },
      "bottom": { "height": "30%", "components": ["execution-log", "artifacts"] }
    }
  },
  "components": [
    { "id": "phases",        "type": "phase-list",     "data": "$.variables._phases" },
    { "id": "workflow-tree", "type": "workflow-tree",   "data": "$.variables._executionTree" },
    { "id": "block-detail",  "type": "block-detail",   "data": "$.variables._activeBlock" },
    { "id": "metrics",       "type": "metrics-panel",  "data": {
        "fitness": "$.variables.currentFitness",
        "iteration": "$.variables.currentIteration",
        "scoreHistory": "$.variables.scoreHistory",
        "target": "$.variables.targetFitness"
    }},
    { "id": "execution-log", "type": "execution-log",  "data": "$.variables._executionLog" },
    { "id": "artifacts",     "type": "artifacts",       "data": "$.variables._artifacts" }
  ]
}
```

**Zones** : `left`, `right`, `bottom`. Chaque zone spécifie sa taille et ses composants.
Les composants d'une même zone sont empilés verticalement (stacked).

**Composants** : Chaque composant a un `id`, un `type` (nom du composant TUI), et un `data`
(chemin vers les données dans les variables de session, ou objet de chemins multiples).

### 4.2 `_phases` — Liste des phases de la session

```json
[
  {
    "id": "creation",
    "name": "Phase 1: Creation",
    "status": "done",
    "description": "Créer l'outil gen-commit initial"
  },
  {
    "id": "optimization",
    "name": "Phase 2: Optimization",
    "status": "running",
    "progress": 60,
    "description": "Réduire les tokens, améliorer la qualité"
  },
  {
    "id": "validation",
    "name": "Phase 3: Validation",
    "status": "pending",
    "description": "Validation finale et tests"
  },
  {
    "id": "publish",
    "name": "Phase 4: Publish",
    "status": "pending",
    "description": "Packager et publier l'outil"
  }
]
```

**Statuts possibles** : `pending`, `running`, `done`, `failed`, `skipped`

### 4.3 `_activeBlock` — Block en cours d'exécution

```json
{
  "id": "generate-improvement",
  "name": "Generate Improvement",
  "type": "inference",
  "status": "running",
  "startedAt": "2026-02-06T10:30:00Z",
  "output": "Generating commit message tool with conventional format...",
  "logs": [
    { "time": "10:30:01", "msg": "Analyzing git diff output..." },
    { "time": "10:30:02", "msg": "Generating JSON schema..." },
    { "time": "10:30:05", "msg": "Validating output structure..." }
  ],
  "metadata": {
    "tokensUsed": 1250,
    "model": "local-llm"
  }
}
```

Quand aucun block n'est actif, `_activeBlock` est `null` ou absent.

### 4.4 `_executionLog` — Journal d'exécution scrollable

```json
[
  { "time": "10:29:55", "level": "info",    "msg": "Starting improvement loop iteration 3" },
  { "time": "10:30:00", "level": "info",    "msg": "evaluate-current: git diff --stat completed" },
  { "time": "10:30:01", "level": "info",    "msg": "generate-improvement: LLM request sent" },
  { "time": "10:30:05", "level": "success", "msg": "generate-improvement: Response received (1250 tokens)" },
  { "time": "10:30:06", "level": "warning", "msg": "apply-changes: Output file already exists, overwriting" }
]
```

**Niveaux** : `info` (blanc), `success` (vert), `warning` (jaune), `error` (rouge)
Limiter à 50 entrées max (FIFO).

### 4.5 `_artifacts` — Fichiers produits

```json
[
  { "name": "gen-commit-tool.json", "type": "output",  "size": "2.1 KB", "status": "updated" },
  { "name": "evaluation-report.md", "type": "report",  "size": "4.5 KB", "status": "new" }
]
```

---

## 5. Visualisation TUI avec Display Descriptors

### 5.1 Mode Descriptor — Workflow en cours

```
┌─ MAESTRO ──────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ● Generate Commit Tool Session                          2da2d165  running │
│    workflow: agent-improvement-loop                      duration: 5m 23s  │
│                                                                            │
├─ PHASES ──────────────────────┬─ ACTIVE BLOCK ─────────────────────────────┤
│                               │                                            │
│  ✓ Phase 1: Creation   [done]│  ● generate-improvement  [inference]        │
│  ● Phase 2: Optimization     │  Started: 10:30:00 | Tokens: 1250          │
│    ████████████░░░░░░ 60%    │  Model: local-llm                          │
│  ○ Phase 3: Validation       │                                            │
│  ○ Phase 4: Publish          │  Output:                                   │
│                               │  ┌────────────────────────────────────┐    │
├─ WORKFLOW TREE ───────────────│  │ Generating commit message tool    │    │
│                               │  │ with conventional format...       │    │
│  ├─ ✓ evaluate-current       │  └────────────────────────────────────┘    │
│  │   → fitness: 0.75        │                                            │
│  ├─ ● generate-improvement   │  Log:                                     │
│  ├─ ○ apply-changes          │  10:30:01  Analyzing git diff output...   │
│  └─ ○ check-fitness          │  10:30:02  Generating JSON schema...      │
│                               │  10:30:05  Validating output structure... │
│                               ├─ METRICS ─────────────────────────────────┤
│                               │                                            │
│                               │  Fitness   ████████████░░░░ 75%  T: 85%  │
│                               │  Iteration 3 / 50                        │
│                               │  Scores    ▂▃▅▆▇█ 0.75                   │
│                               │                                            │
├─ EXECUTION LOG ───────────────┴────────────┬─ ARTIFACTS ──────────────────┤
│                                            │                              │
│  10:29:55 [info]    Starting iteration 3   │  ✓ gen-commit-tool.json     │
│  10:30:00 [info]    evaluate-current done  │    [output] 2.1 KB updated  │
│  10:30:01 [info]    LLM request sent       │  + evaluation-report.md     │
│  10:30:05 [success] Response (1250 tokens) │    [report] 4.5 KB new      │
│                                            │                              │
├────────────────────────────────────────────┴──────────────────────────────┤
│  ● connected  45ms  15:23:47      [t]ree [p]hases [b]lock [m]etrics [q]uit│
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Comparaison Avant/Après

**AVANT (mode execution)** :
- Workflow tree basique (4 nœuds, statuts colorés)
- Filesystem panel (fichiers du projet)
- Widgets panel (fitness bar, iteration counter, sparkline)
- L'utilisateur doit deviner ce qui se passe

**APRÈS (mode descriptor)** :
- Phase list : voit clairement quelle phase est active et la progression
- Workflow tree : même arbre mais dans un contexte clair
- Block detail : voit exactement ce que le block fait, son output, ses logs
- Metrics panel : fitness, iteration, score history regroupés
- Execution log : journal complet coloré par niveau
- Artifacts : fichiers produits par la session

---

## 6. Extensibilité

### 6.1 Nouveaux types de composants

Pour ajouter un nouveau type de composant au TUI :
1. Créer `tools/maestro-cli/monitor/components/<nom>.js`
2. Implémenter `render(session, context)` en lisant les données depuis `context`
3. L'enregistrer dans `session-monitor.js` (`initComponents`)

Les sessions peuvent ensuite l'utiliser dans leur `_monitorDescriptor.components[]`.

### 6.2 Autres sessions

Une session "Code Reviewer" pourrait utiliser :
```json
{
  "layout": {
    "zones": {
      "left":  { "width": "50%", "components": ["phases", "artifacts"] },
      "right": { "width": "50%", "components": ["block-detail", "execution-log"] }
    }
  }
}
```

Mêmes composants TUI, layout différent, données différentes.

---

## 7. Relation avec les Widgets Existants

Les `monitorWidgets` (progress-bar, counter, score-chart, status-list) restent disponibles
dans le mode `execution`. Le mode `descriptor` les remplace par un système plus riche :

| Ancien (Widgets) | Nouveau (Descriptor) |
|-------------------|----------------------|
| `progress-bar` widget pour fitness | Intégré dans `metrics-panel` |
| `counter` widget pour iteration | Intégré dans `metrics-panel` |
| `score-chart` widget pour history | Intégré dans `metrics-panel` |
| Pas de phases | `phase-list` composant |
| Pas de block detail | `block-detail` composant |
| Pas de log | `execution-log` composant |
| Pas d'artefacts | `artifacts` composant |

Les widgets sont toujours utilisés si le mode n'est pas `descriptor` (backward compat).
