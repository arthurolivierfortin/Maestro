# Plan d'Implémentation : Display Descriptors

**Date** : 6 février 2026
**Prérequis** : Aucun contexte préalable nécessaire. Ce document est autosuffisant.

---

## Vue d'ensemble

Ce plan implémente le système "Display Descriptors" qui permet aux sessions Maestro de
contrôler dynamiquement l'affichage du TUI Monitor via des variables de session structurées.

**Résultat attendu** : Quand une session écrit `_monitorDescriptor` dans ses variables,
le TUI Monitor adapte automatiquement son layout et affiche des composants riches :
phases, détail de block, métriques, log d'exécution, artefacts.

---

## Fichiers à créer

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `tools/maestro-cli/monitor/components/phase-list.js` | Composant liste des phases |
| 2 | `tools/maestro-cli/monitor/components/block-detail.js` | Composant détail block actif |
| 3 | `tools/maestro-cli/monitor/components/metrics-panel.js` | Composant métriques agrégées |
| 4 | `tools/maestro-cli/monitor/components/execution-log.js` | Composant log d'exécution |
| 5 | `tools/maestro-cli/monitor/components/artifacts.js` | Composant liste artefacts |

## Fichiers à modifier

| # | Fichier | Modification |
|---|---------|-------------|
| 6 | `tools/maestro-cli/monitor/session-monitor.js` | Ajouter mode descriptor, layout engine, nouveaux composants |
| 7 | `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Écrire _monitorDescriptor, _phases, _activeBlock, _executionLog, _artifacts |

## Fichiers de référence (NE PAS modifier)

| Fichier | Rôle |
|---------|------|
| `tools/maestro-cli/monitor/components/colors.js` | Exports : `{ colors, tag, icons }`. Utiliser dans tous les nouveaux composants |
| `tools/maestro-cli/monitor/components/widgets-panel.js` | Référence pour les patterns renderProgressBar, renderSparkline, renderCounter |
| `tools/maestro-cli/monitor/components/workflow-tree.js` | Déjà fonctionnel, utilisé tel quel |
| `backend/src/Maestro.Domain/Entities/Session.cs` | Classe Session avec Variables (Dictionary<string, object>), SetVariable(), GetVariable() |
| `backend/src/Maestro.Application/DTOs/ProjectSessionDto.cs` | DTO avec `Variables = new Dictionary<string, object>(session.Variables)` — les variables sont passées telles quelles à l'API |

---

## Étape 1 : Créer `phase-list.js`

**Fichier** : `tools/maestro-cli/monitor/components/phase-list.js`

**Ce composant fait** : Affiche une liste verticale de phases avec icône de statut colorée,
nom, et pour la phase active une barre de progression.

**Données source** : Variable `_phases` (array d'objets `{id, name, status, progress?, description?}`)

**Statuts possibles** : `pending`, `running`, `done`, `failed`, `skipped`

---

## Étape 2 : Créer `block-detail.js`

**Fichier** : `tools/maestro-cli/monitor/components/block-detail.js`

**Ce composant fait** : Affiche le détail du block actuellement en exécution : nom, type,
statut, output LLM, logs internes, metadata (tokens, modèle).

**Données source** : Variable `_activeBlock` (objet `{id, name, type, status, startedAt?, output?, logs?, metadata?}`)

---

## Étape 3 : Créer `metrics-panel.js`

**Fichier** : `tools/maestro-cli/monitor/components/metrics-panel.js`

**Ce composant fait** : Agrège fitness score (progress bar), iteration (counter), et score
history (sparkline) dans un seul panneau compact.

**Données source** : Configuré via `_monitorDescriptor.components[].data` avec des chemins
multiples (`data.fitness`, `data.iteration`, etc.) ou directement depuis session variables.

---

## Étape 4 : Créer `execution-log.js`

**Fichier** : `tools/maestro-cli/monitor/components/execution-log.js`

**Note** : Il existe déjà `command-log.js` qui affiche `_commandLog`. Ce nouveau composant
affiche `_executionLog` avec des niveaux colorés (info/success/warning/error).

---

## Étape 5 : Créer `artifacts.js`

**Fichier** : `tools/maestro-cli/monitor/components/artifacts.js`

**Ce composant fait** : Affiche la liste des fichiers produits par la session avec icônes
de statut (new/updated/deleted).

---

## Étape 6 : Modifier `session-monitor.js`

### 6.1 Imports
Ajouter les 5 nouveaux composants après les imports existants.

### 6.2 `createPanelBoxes()`
Ajouter 5 nouvelles boxes blessed : phasesBox, blockDetailBox, metricsBox, execLogBox, artifactsBox.
Toutes cachées par défaut (`hidden: true`).

### 6.3 `initComponents()`
Instancier les 5 nouveaux composants avec leurs boxes respectives.

### 6.4 `detectMode()`
Ajouter priorité 1 : si `_monitorDescriptor` existe → mode `descriptor`.

### 6.5 `applyLayout()`
Cacher toutes les boxes (anciennes + nouvelles), puis router vers `applyDescriptorLayout()`,
`applyExecutionLayout()`, ou `applyIdleLayout()`.

### 6.6 `applyDescriptorLayout()` (nouvelle méthode)
Positionner les boxes descriptor :
- LEFT (40%) : phases (50% height) + workflow tree (20% height)
- RIGHT (60%) : block detail (35%) + metrics (35%)
- BOTTOM (30%) : execution log (60% width) + artifacts (40% width)

### 6.7 `renderAll()`
Ajouter le rendu des composants descriptor quand `mode === 'descriptor'`.

---

## Étape 7 : Modifier `EntryPointExecutor.cs`

### 7.1 Helpers
Ajouter les méthodes statiques :
- `InitializeMonitorDescriptor(session)` — écrit `_monitorDescriptor`
- `InitializePhases(session)` — écrit `_phases` avec 4 phases pending
- `UpdatePhaseStatus(session, phaseId, status, progress?)` — met à jour une phase
- `SetActiveBlock(session, id, name, type, status, output?)` — écrit `_activeBlock`
- `UpdateActiveBlockOutput(session, output)` — met à jour l'output du block actif
- `UpdateActiveBlockStatus(session, status)` — met à jour le statut du block actif
- `ClearActiveBlock(session)` — efface le block actif
- `AppendExecutionLog(session, level, message)` — ajoute une entrée au log (FIFO 50)
- `AddArtifact(session, name, type, size?, status)` — ajoute/met à jour un artefact

### 7.2 Refactorer `ExecuteImprovementLoopAsync`
Utiliser les helpers pour écrire les display descriptors à chaque étape du workflow.

---

## Étape 8 : Build et vérification

### 8.1 Build backend
```bash
powershell.exe -Command "cd C:\Meastro\backend; dotnet build"
```
Vérifier : 0 errors.

### 8.2 Test end-to-end
1. Démarrer les services
2. Invoquer un workflow sur une session
3. Observer le TUI en mode descriptor

---

## Résumé des dépendances

```
Étape 1-5 (composants JS) → indépendantes entre elles, peuvent être faites en parallèle
Étape 6 (session-monitor.js) → dépend des étapes 1-5 (imports des composants)
Étape 7 (EntryPointExecutor.cs) → indépendante du frontend
Étape 8 (build + test) → dépend de tout
```

Ordre recommandé : 1-5 en parallèle → 6 → 7 → 8
