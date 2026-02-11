# Proposition : ModelDetail enrichi + BlockDetail page

**Date** : 2026-02-11
**Phase** : 15 (TUI Monitor)
**Statut** : En attente d'approbation

---

## 1. ModelDetail enrichi — Plus de métriques

### État actuel

La page ModelDetail a 2 panels (Health + Usage) avec des infos basiques :
- Health : status, backend, device, GPU memory, model size
- Usage : total requests, avg latency, max tokens, temperature

### Proposition : 3 panels avec métriques détaillées

```
┌─ MODEL ───────────────────────────────────────────────────────────┐
│  SmolLM2-1.7B-Instruct                              ✓ active     │
│  Size: 1.7B   Backend: vllm   Device: cuda:0                     │
├─ HEALTH ──────────────┬─ USAGE ───────────────┬─ PERFORMANCE ────┤
│  Status: ● Online     │  Requests: 47         │  Fitness: 95%    │
│  GPU Mem: 2.1/8.0 GB  │  Avg latency: 2.1s    │  ████████████░░  │
│  Uptime: 2h 15m       │  Peak latency: 4.8s   │                  │
│  Load: idle           │  Errors: 0            │  Sessions: 3     │
│                       │  Tokens in: 12.4k     │  Tasks:          │
│                       │  Tokens out: 8.2k     │   JSON gen: 95%  │
│                       │  Throughput: 142 t/s   │   Commit:   92%  │
│                       │                       │   Review:   78%  │
│                       │                       │                  │
│                       │                       │  History:        │
│                       │                       │  ▁▃▅▆▇▇██████   │
├─ [Esc] Back ──────────────────────────────────────────────────────┤
└───────────────────────────────────────────────────────────────────┘
```

### Nouveau panel : PERFORMANCE

| Métrique | Source | Description |
|----------|--------|-------------|
| **Fitness global** | Mock / API | Meilleur fitness observé sur toutes les sessions utilisant ce modèle |
| **Barre de fitness** | `progressBar()` | Visualisation compacte du fitness |
| **Sessions count** | Sessions filtrées par modèle | Nombre de sessions qui ont utilisé ce modèle |
| **Task fitness par type** | Mock / futur `fitness.task` | Fitness ventilé par type de tâche (JSON gen, commit, review...) |
| **Sparkline historique** | `scoreHistory` agrégé | Évolution du fitness dans le temps |

### Métriques ajoutées au panel USAGE

| Métrique | Source | Description |
|----------|--------|-------------|
| **Peak latency** | Mock / API | Latence max observée |
| **Error count** | Mock / API | Nombre d'erreurs LLM |
| **Tokens in/out** | Mock / API | Volume de tokens entrants/sortants |
| **Throughput** | Mock / API | Tokens/seconde moyen |

### Métriques ajoutées au panel HEALTH

| Métrique | Source | Description |
|----------|--------|-------------|
| **Uptime** | Mock / API | Temps depuis le dernier redémarrage |
| **Load** | Mock / API | État de charge (idle/low/medium/high) |

### Mock data nécessaire

```javascript
// Ajout à MOCK_LLM_STATUS
const MOCK_LLM_STATUS = {
  // ... existant ...
  peakLatency: 4.8,
  errorCount: 0,
  tokensIn: 12400,
  tokensOut: 8200,
  throughput: 142,
  uptime: '2h 15m',
  load: 'idle',
};

// Nouveau : performance par modèle
const MOCK_MODEL_PERFORMANCE = {
  'SmolLM2-1.7B-Instruct': {
    bestFitness: 0.95,
    sessionCount: 3,
    taskFitness: [
      { task: 'JSON generation', fitness: 0.95 },
      { task: 'Commit message', fitness: 0.92 },
      { task: 'Code review', fitness: 0.78 },
    ],
    fitnessHistory: [0.65, 0.72, 0.78, 0.85, 0.88, 0.92, 0.95, 0.95],
  },
};
```

---

## 2. BlockDetail — Nouvelle page de détail de block

### Navigation

Catalog → Enter sur un block → **BlockDetail** → Esc → retour au Catalog

Actuellement Enter dans le Catalog fait expand/collapse inline. La proposition :
- **Enter** → ouvre la page BlockDetail (full detail)
- **Space** → toggle expand/collapse inline (garde le comportement actuel)

### Layout proposé

```
┌─ BLOCK ───────────────────────────────────────────────────────────┐
│  [workflow] Gen Commit Message              v1.2.0   fit: 95%    │
│  Generate conventional commit messages from diffs                 │
├─ INFO ────────────────┬─ FITNESS ─────────────────────────────────┤
│  ID: gen-commit-wf    │  Block Fitness: 0.95                     │
│  Type: workflow       │  ██████████████░░ 95%                    │
│  Atomic: no           │                                           │
│  Version: 1.2.0       │  Dimensions:                             │
│  Author: system       │   Performance:  ████████░░ 92%           │
│                       │   Specialization: ███████░░░ 88%         │
│  Children: 4 blocks   │   Composability:  █████████░ 95%         │
│   ├─ llm-generate     │                                           │
│   ├─ json-validator   │  Task Fitness: 0.78                      │
│   ├─ fitness-eval     │   Completion:  ████████░░ 82%            │
│   └─ file-writer      │   Quality:     ███████░░░ 75%            │
│                       │   Cost-Eff:    ███████░░░ 70%            │
│                       │   Reliability: ████████░░ 85%            │
├─ SESSIONS ────────────┴─ ACTIONS ─────────────────────────────────┤
│  3 sessions use this block:   │  [d] Download block package      │
│  → gen-commit training  ●     │  [p] Publish to catalog          │
│    compliance-tester    ●     │  [i] Import to workspace         │
│    readme-writer        ✓     │  [v] View source JSON            │
├─ [Enter] Open session  [d] Download  [Esc] Back ─────────────────┤
└───────────────────────────────────────────────────────────────────┘
```

### 4 panels

#### Panel INFO (top-left)

| Champ | Source |
|-------|--------|
| ID | `block.id` |
| Type | `block.type` + TypeBadge |
| Atomic | `block.isAtomic` |
| Version | `block.version` |
| Author | `block.author` (nouveau dans mock) |
| Children | Pour les composites : liste des blocks enfants (workflow nodes) |

#### Panel FITNESS (top-right)

Reprend le modèle multi-dimensionnel de Phase 14 :

| Métrique | Source | Description |
|----------|--------|-------------|
| **Block Fitness** | `block.fitness` | Score actuel [0-1] avec barre de progression |
| **Dimensions block** | Mock / futur manifest | P (Performance), S (Spécialisation), W (Composabilité) |
| **Task Fitness** | Mock / futur manifest | Pour les workflows/agents : score multi-dimensionnel |
| **Task dimensions** | Mock | Completion, Quality, Cost-Efficiency, Reliability |

Si le block est atomique → seulement Block Fitness + dimensions.
Si le block est composite → Block Fitness + Task Fitness.
Si pas de fitness → affiche `(no fitness data — run a training session)`.

#### Panel SESSIONS (bottom-left)

| Champ | Source |
|-------|--------|
| Sessions utilisant ce block | Sessions filtrées par `entryPoints` contenant ce block ID |
| Enter sur une session → SessionMonitor | Navigation nested |

#### Panel ACTIONS (bottom-right)

Actions futures mais affichées dès maintenant (grayed out si pas encore implémentées) :

| Action | Hotkey | Description | Implémenté ? |
|--------|--------|-------------|-------------|
| **Download** | `d` | Télécharger le package block (pour partage/backup) | Futur — affiche "coming soon" |
| **Publish** | `p` | Publier vers le catalogue public | Futur |
| **Import** | `i` | Importer dans un workspace | Futur |
| **View source** | `v` | Afficher le JSON brut du block | Faisable maintenant (mock) |

Les actions non implémentées s'affichent en gris avec `(coming soon)`. Ça pose la vision sans casser la fonctionnalité.

### Mock data nécessaire

```javascript
// Enrichir MOCK_BLOCKS avec plus de détails
const MOCK_BLOCKS = [
  {
    id: 'gen-commit-workflow',
    name: 'Gen Commit Message',
    type: 'workflow',
    version: '1.2.0',
    description: 'Generate conventional commit messages from diffs',
    author: 'system',
    fitness: 0.95,
    isAtomic: false,
    children: ['llm-generate', 'json-validator', 'fitness-evaluator', 'file-writer'],
    fitnessDimensions: {
      performance: 0.92,
      specialization: 0.88,
      composability: 0.95,
    },
    taskFitness: {
      score: 0.78,
      dimensions: {
        completion: 0.82,
        quality: 0.75,
        costEfficiency: 0.70,
        reliability: 0.85,
      },
    },
    sessionIds: ['a1b2c3d4...', 'c3d4e5f6...', 'd4e5f6a7...'],
    // Futur
    downloadUrl: null,
    publishedAt: null,
  },
  // ... tools avec seulement block fitness, pas de taskFitness
];
```

### Nouveau : `getBlock(id)` dans mock-api-client

```javascript
async getBlock(id) {
  return MOCK_BLOCKS.find(b => b.id === id) || null;
}
```

---

## 3. Modifications par fichier

### Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `mock-api-client.js` | Enrichir `MOCK_LLM_STATUS`, ajouter `MOCK_MODEL_PERFORMANCE`, enrichir `MOCK_BLOCKS`, ajouter `getBlock(id)`, `getModelPerformance(id)` |
| `ModelDetail.js` | Ajouter 3ème panel PERFORMANCE avec fitness, sparkline, task breakdown |
| `CatalogScreen.js` | Enter → `onBlockSelect(blockId)`, Space → toggle expand (actuel) |
| `App.js` | Ajouter `handleBlockSelect`, route `detailView.type === 'block'` → `BlockDetail` |

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `components/BlockDetail.js` | Page de détail de block (~300 lignes) |

---

## 4. Ordre d'implémentation

1. **mock-api-client.js** — Enrichir données mock (modèles + blocks)
2. **ModelDetail.js** — Ajouter panel PERFORMANCE + enrichir HEALTH/USAGE
3. **BlockDetail.js** — Créer la page de détail de block
4. **CatalogScreen.js** — Enter → BlockDetail, Space → expand
5. **App.js** — Route block detail

---

## 5. Questions ouvertes

1. **Actions dans BlockDetail** : On affiche les 4 actions (download, publish, import, view source) même si seulement "view source" est faisable en mock ? Ou on attend ?
   - **Proposition** : Afficher tout, griser les non-implémentées → montre la vision

2. **Navigation nested depuis BlockDetail** : Enter sur une session → SessionMonitor → Esc → revient à BlockDetail ?
   - **Proposition** : Oui, même pattern que WorkspaceDetail/RepoDetail

3. **Sparkline dans ModelDetail** : On utilise le helper `sparkline()` qui existe déjà dans theme.js ?
   - **Proposition** : Oui
