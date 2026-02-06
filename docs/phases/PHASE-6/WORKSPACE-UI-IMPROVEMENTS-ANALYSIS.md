# Analyse et Recommandations: Améliorations UI du Workspace

**Date**: 4 février 2026
**Objectif**: Rendre les workspaces réellement utilisables via l'interface
**État actuel**: Page Overview minimale, onglets Blocks et Logs non implémentés

---

## 1. Analyse de l'État Actuel

### 1.1 Ce qui existe (Frontend)

| Composant | État | Fonctionnalités |
|-----------|------|-----------------|
| WorkspacesPage | ✅ Fonctionnel | Liste, filtres, création, recherche |
| WorkspaceDetailPage | ⚠️ Partiel | Header, Overview basique, Sessions |
| BlocksPanel | ❌ Placeholder | "Coming soon" |
| LogsPanel | ❌ Placeholder | "Coming soon" |
| UIBlockRenderer | ⚠️ Partiel | iframe basique, API incomplète |

### 1.2 Ce qui existe (Backend API)

| Endpoint | État | Utilisation Frontend |
|----------|------|----------------------|
| GET /api/workspaces | ✅ | Utilisé |
| GET /api/workspaces/{id} | ✅ | Utilisé |
| GET /api/blocks | ✅ | **Non utilisé** |
| GET /api/blocks/{id}/children | ✅ | **Non utilisé** |
| POST /api/blocks/{id}/execute | ✅ | **Non utilisé** |
| GET /api/cli/commands | ✅ | **Non utilisé** |
| POST /api/cli/execute | ✅ | **Non utilisé** |
| GET /api/workspaces/topology | ✅ | **Non utilisé** |
| GET /api/workspaces/{id}/entry-points | ✅ | Partiellement |

### 1.3 Problèmes Identifiés

1. **Impossible de voir les blocs du workspace** - L'onglet Blocks est un placeholder
2. **Impossible de lancer un bloc** - Aucun bouton d'exécution
3. **Impossible de voir les logs** - L'onglet Logs est un placeholder
4. **Entry points non exploités** - Définis mais pas affichés comme actions
5. **Pas de vue hiérarchique** - Sessions et blocs en liste plate
6. **Pas de monitoring** - Aucune métrique, état des exécutions
7. **UIBlockRenderer incomplet** - getBlocks, getMetrics, execute non implémentés

---

## 2. Recommandations par Section

### 2.1 Page Overview (Commune à tous les workspaces)

**Objectif**: Donner une vue d'ensemble complète et actionnable

#### A. Section "Quick Actions" (Entry Points)

```
┌─────────────────────────────────────────────────────────────────────┐
│ QUICK ACTIONS                                                        │
│                                                                      │
│  [▶ Run Research Team]  [📊 Open Dashboard]  [🧪 Manage Experiments] │
│  (main entry point)     (dashboard)          (experiments)           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Implémentation**:
- Lire `entryPoints` du workspace
- Afficher un bouton par entry point
- Clic → ouvre modal d'exécution ou navigue vers le bloc

#### B. Section "Workspace Content" (Blocs)

```
┌─────────────────────────────────────────────────────────────────────┐
│ WORKSPACE CONTENT                                                    │
│                                                                      │
│  📦 Blocks (16)                                                      │
│  ├─ 🔧 Tools (5)      fitness-calculator, data-store, ...          │
│  ├─ 🤖 Agents (6)     experiment-manager, researcher, trainer, ... │
│  └─ 🔄 Workflows (5)  research-team, training-loop, ...            │
│                                                                      │
│  [View All Blocks →]                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Implémentation**:
- Endpoint: `GET /api/blocks?workspaceId={id}` (à créer ou filtrer côté frontend)
- Grouper par `blockType`
- Afficher les 3-4 premiers de chaque catégorie
- Lien vers l'onglet Blocks complet

#### C. Section "Active Sessions"

```
┌─────────────────────────────────────────────────────────────────────┐
│ ACTIVE SESSIONS                                                      │
│                                                                      │
│  ● Training Session #1      Running   ████████░░ 80%   [View]       │
│  ○ Experiment exp-001       Paused    ████░░░░░░ 40%   [Resume]     │
│                                                                      │
│  [+ Create Session]  [View All Sessions →]                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Implémentation**:
- Filtrer `sessionIds` du workspace
- Afficher status, progression, actions rapides
- Bouton de création de session depuis template

#### D. Section "Workspace Health" (Métriques)

```
┌─────────────────────────────────────────────────────────────────────┐
│ WORKSPACE HEALTH                                                     │
│                                                                      │
│  Total Runs: 127        Success Rate: 94%        Avg Duration: 2.3s │
│  Active: 2              Last Run: 5 min ago      Cost: $0.00        │
│                                                                      │
│  [📈 View Full Metrics]                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Implémentation**:
- Agréger les données des sessions et exécutions
- Lire depuis `data/metrics/` du workspace
- Afficher KPIs clés

#### E. Section "Recent Activity"

```
┌─────────────────────────────────────────────────────────────────────┐
│ RECENT ACTIVITY                                                      │
│                                                                      │
│  🟢 2 min ago   fitness-calculator executed (0.847 fitness)         │
│  🟢 5 min ago   trainer-agent completed iteration 34                │
│  🟡 10 min ago  experiment-pipeline paused                          │
│  🔴 15 min ago  tester-agent failed (timeout)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Implémentation**:
- Lire les logs d'exécution récents
- Filtrer par workspace
- Afficher avec code couleur par status

---

### 2.2 Onglet "Blocks" (À implémenter)

**Objectif**: Voir, filtrer, et interagir avec les blocs du workspace

#### Layout proposé:

```
┌─────────────────────────────────────────────────────────────────────┐
│ BLOCKS                                                    [+ Create] │
│                                                                      │
│ [All] [Tools] [Agents] [Workflows] [Strategies]    🔍 Search...     │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔧 fitness-calculator                              tool          │ │
│ │    Calculates model fitness score using the Maestro formula     │ │
│ │    Tags: fitness, evaluation, metrics                           │ │
│ │    [▶ Run] [📝 Edit] [📋 View] [🗑️ Delete]                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🤖 experiment-manager                              agent         │ │
│ │    Orchestrates training experiments using different strategies │ │
│ │    Tags: experiment, manager, orchestration                     │ │
│ │    [▶ Run] [📝 Edit] [📋 View] [🗑️ Delete]                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Fonctionnalités:

| Action | Description | Endpoint |
|--------|-------------|----------|
| **Lister** | Afficher tous les blocs du workspace | `GET /api/blocks` (filtrer) |
| **Filtrer** | Par type (tool, agent, workflow) | Query string `?type=` |
| **Rechercher** | Par nom/description | Query string `?search=` |
| **Exécuter** | Lancer un bloc | `POST /api/blocks/{id}/execute` |
| **Éditer** | Modifier config/prompt | `PUT /api/blocks/{id}` |
| **Voir** | Afficher détails complets | Navigation vers `/blocks/{id}` |
| **Supprimer** | Retirer du workspace | `DELETE /api/blocks/{id}` |

#### Modal d'exécution:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Execute: fitness-calculator                                    [X]  │
│                                                                      │
│ Inputs                                                               │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ modelId *        [smollm2:1.7b              ▼]                  │ │
│ │ executionMetrics { "qualityScore": 0.8, "testsPassRate": 0.9 }  │ │
│ │ taskType         [general                    ]                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Context                                                              │
│ ○ Run in workspace context                                          │
│ ○ Run in new session (template: [Training ▼])                       │
│                                                                      │
│                                        [Cancel]  [▶ Execute]        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Onglet "Logs" (À implémenter)

**Objectif**: Voir l'historique des exécutions et logs

#### Layout proposé:

```
┌─────────────────────────────────────────────────────────────────────┐
│ EXECUTION LOGS                                          [↻ Refresh] │
│                                                                      │
│ Filter: [All Blocks ▼] [All Status ▼] [Last 24h ▼]                  │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ run-12345 • fitness-calculator • 2 min ago           ✅ Success │ │
│ │ Duration: 1.2s  |  Input: {modelId: "smollm2:1.7b"}            │ │
│ │ Output: {totalFitness: 0.847, breakdown: {...}}                │ │
│ │ [View Full Log]                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ run-12344 • trainer-agent • 5 min ago                ✅ Success │ │
│ │ Duration: 45.3s  |  Iteration: 34/100                          │ │
│ │ [View Full Log]                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ run-12340 • tester-agent • 15 min ago                ❌ Failed  │ │
│ │ Duration: 30.0s  |  Error: Timeout after 30000ms               │ │
│ │ [View Full Log] [🔄 Retry]                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Panels Spécifiques au Research Workspace

Pour le workspace de recherche, des panels custom devraient être disponibles:

#### A. Panel "Experiments" (via UI Block ou composant dédié)

```
┌─────────────────────────────────────────────────────────────────────┐
│ EXPERIMENTS                                        [+ New Experiment]│
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ exp-001 • Test RL on code-gen                     🟢 Running  │   │
│ │ Strategy: rl-fitness-strategy  |  Progress: 34/100            │   │
│ │ Current Fitness: 0.723  |  Best: 0.741 (iter 28)              │   │
│ │ ████████████████░░░░░░░░░░ 34%                                │   │
│ │                                                               │   │
│ │ [⏸ Pause] [⏹ Stop] [📊 View Metrics] [📋 Details]            │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ exp-002 • SFT on summarizer                       ⏸ Paused    │   │
│ │ Strategy: sft-strategy  |  Progress: 78/100                   │   │
│ │ Current Fitness: 0.812  |  Best: 0.812 (iter 78)              │   │
│ │ ████████████████████████████░░░ 78%                           │   │
│ │                                                               │   │
│ │ [▶ Resume] [⏹ Stop] [📊 View Metrics] [📋 Details]           │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Actions**:
- Créer expérience (lance `experiment-manager --action create`)
- Start/Pause/Stop (lance `experiment-manager --action start/pause/stop`)
- Voir métriques (affiche graphique de fitness over time)
- Voir détails (ouvre modal avec config complète)

#### B. Panel "Leaderboard"

```
┌─────────────────────────────────────────────────────────────────────┐
│ FITNESS LEADERBOARD                               [Task: All Types ▼]│
│                                                                      │
│ ┌─────┬────────────────────────┬─────────┬──────────┬───────────┐   │
│ │ #   │ Model                  │ Fitness │ Strategy │ Change    │   │
│ ├─────┼────────────────────────┼─────────┼──────────┼───────────┤   │
│ │ 1   │ llama3:8b-sft          │ 0.847   │ SFT      │ ↑ (+2)    │   │
│ │ 2   │ mistral:7b-rl          │ 0.823   │ RL       │ ↓ (-1)    │   │
│ │ 3   │ smollm2:1.7b           │ 0.756   │ RL       │ → (same)  │   │
│ │ 4   │ tinyllama              │ 0.612   │ SFT      │ ↓ (-1)    │   │
│ │ 5   │ smollm2:360m           │ 0.534   │ SFT      │ NEW       │   │
│ └─────┴────────────────────────┴─────────┴──────────┴───────────┘   │
│                                                                      │
│ [Compare Top 3] [Export Results] [View History]                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### C. Panel "Fitness Trends" (Graphique)

```
┌─────────────────────────────────────────────────────────────────────┐
│ FITNESS TRENDS                        [Experiment: exp-001 ▼]       │
│                                                                      │
│  1.0 ┤                                                              │
│      │                                            ●●●●              │
│  0.8 ┤                                    ●●●●●●●                   │
│      │                            ●●●●●●●●                          │
│  0.6 ┤                    ●●●●●●●●                                  │
│      │            ●●●●●●●●                                          │
│  0.4 ┤    ●●●●●●●●                                                  │
│      │ ●●●                                                          │
│  0.2 ┤                                                              │
│      └────────────────────────────────────────────────────────────  │
│        0    10    20    30    40    50    60    70    80    90 100  │
│                              Iterations                              │
│                                                                      │
│ Current: 0.723  |  Best: 0.741  |  Target: 0.80                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### D. Panel "Strategy Selector" (Pour créer expérience)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SELECT STRATEGY                                                      │
│                                                                      │
│ Agent Type: [Code Generation ▼]    Recommended for you:             │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ⭐ RL-Fitness Strategy                            [Select]      │ │
│ │    Best for: reasoning, code, agentic tasks                    │ │
│ │    Typical iterations: 500  |  Est. time: 2-4 hours            │ │
│ │    Success rate on similar tasks: 78%                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ SFT Strategy                                      [Select]      │ │
│ │    Best for: instruction-following, formatting                 │ │
│ │    Typical iterations: 100  |  Est. time: 30-60 min            │ │
│ │    Success rate on similar tasks: 85%                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Priorités d'Implémentation

### Phase 1: Fondamentaux (Haute priorité)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Implémenter BlocksPanel avec liste et filtres | Moyen | Élevé |
| Ajouter bouton "Run" sur chaque bloc | Faible | Élevé |
| Modal d'exécution avec inputs | Moyen | Élevé |
| Section Quick Actions (entry points) | Faible | Moyen |
| Section Workspace Content (résumé blocs) | Faible | Moyen |

### Phase 2: Monitoring (Moyenne priorité)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Implémenter LogsPanel | Moyen | Moyen |
| Section Recent Activity | Moyen | Moyen |
| Section Workspace Health (KPIs) | Moyen | Moyen |

### Phase 3: Research Workspace Spécifique (Moyenne priorité)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Panel Experiments | Élevé | Élevé |
| Panel Leaderboard | Moyen | Moyen |
| Panel Fitness Trends (graphique) | Moyen | Moyen |
| Panel Strategy Selector | Moyen | Moyen |

### Phase 4: Avancé (Basse priorité)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Compléter UIBlockRenderer API | Élevé | Moyen |
| Real-time updates (SignalR) | Élevé | Moyen |
| Topology visualization | Élevé | Faible |

---

## 4. Endpoints Backend Nécessaires

### Existants (à utiliser)

- `GET /api/blocks?type=&search=` - Liste blocs
- `POST /api/blocks/{id}/execute` - Exécuter bloc
- `GET /api/workspaces/{id}/entry-points` - Entry points
- `GET /api/cli/commands?workspaceId=` - Commandes disponibles

### À créer (optionnel mais utile)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/workspaces/{id}/blocks` | Blocs spécifiques au workspace |
| `GET /api/workspaces/{id}/runs` | Historique exécutions du workspace |
| `GET /api/workspaces/{id}/metrics` | Métriques agrégées |
| `GET /api/workspaces/{id}/activity` | Activité récente |

---

## 5. Composants Frontend à Créer

### Nouveaux composants

```
frontend/src/components/
├── workspace/
│   ├── BlocksPanel.tsx           # Liste des blocs avec actions
│   ├── BlockCard.tsx             # Carte individuelle d'un bloc
│   ├── BlockExecuteModal.tsx     # Modal d'exécution
│   ├── LogsPanel.tsx             # Historique des exécutions
│   ├── LogEntry.tsx              # Entrée de log individuelle
│   ├── QuickActions.tsx          # Section entry points
│   ├── WorkspaceContent.tsx      # Résumé des blocs
│   ├── WorkspaceHealth.tsx       # KPIs et métriques
│   ├── RecentActivity.tsx        # Activité récente
│   └── research/
│       ├── ExperimentsPanel.tsx  # Gestion expériences
│       ├── ExperimentCard.tsx    # Carte expérience
│       ├── LeaderboardPanel.tsx  # Classement fitness
│       ├── FitnessTrends.tsx     # Graphique fitness
│       └── StrategySelector.tsx  # Sélection stratégie
```

---

## 6. Résumé Exécutif

### Problème principal
Le workspace est créé mais **inutilisable** car l'interface ne permet pas d'interagir avec son contenu.

### Solution
Implémenter les composants manquants en utilisant les **APIs backend existantes** qui sont déjà fonctionnelles.

### Quick Wins (peut être fait rapidement)
1. Afficher les entry points comme boutons d'action
2. Lister les blocs dans l'onglet Blocks
3. Ajouter un bouton "Run" sur chaque bloc

### Effort Total Estimé
- Phase 1 (Fondamentaux): 2-3 jours
- Phase 2 (Monitoring): 2 jours
- Phase 3 (Research-specific): 3-4 jours
- **Total**: ~7-9 jours de développement

---

*"Un workspace sans interface d'interaction n'est qu'un dossier avec des fichiers JSON."*
