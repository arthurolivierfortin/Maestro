# Proposition : Stratégies de Training Diversifiées

**Date**: 3 février 2026
**Statut**: Proposition
**Auteur**: Claude (Assistant IA)

---

## Résumé Exécutif

Cette proposition décrit une architecture pour supporter plusieurs méthodes de training en parallèle au sein d'un même workspace de recherche. L'objectif est de permettre la diversité des approches tout en facilitant la comparaison et la sélection du meilleur résultat.

---

## Problématique

L'utilisateur souhaite :
1. Tester différentes méthodes de training simultanément
2. Comparer les résultats de manière objective
3. Choisir quelle approche promouvoir
4. Avoir des templates système pour chaque type de training
5. Pouvoir démarrer toutes les expériences en parallèle ou individuellement

**Question centrale** : Utiliser plusieurs workspaces ou un seul ?

---

## Recommandation : Un Seul Workspace avec Stratégies Parallèles

### Justification

| Critère | Même Workspace | Workspaces Séparés |
|---------|---------------|-------------------|
| Comparaison équitable | ✅ Même contexte, même agent | ❌ Variables différentes |
| Simplicité de gestion | ✅ Une seule topologie | ❌ N topologies à gérer |
| Compétition naturelle | ✅ Fitness comparable | ❌ Métriques isolées |
| Promotion claire | ✅ Le meilleur gagne | ❌ Choix subjectif |
| Ressources | ✅ Partagées efficacement | ❌ Duplication |
| Isolation des expériences | ⚠️ Via sessions | ✅ Complète |

**Verdict** : Un seul workspace avec des **Training Strategies** comme nouveau concept.

---

## Architecture Proposée

### Hiérarchie des Concepts

```
Workspace (Research)
    └── Training Experiment (instance)
            ├── Target Agent: agent-123
            ├── Strategy: RL-Fitness
            ├── Sessions: [session-1, session-2, ...]
            └── Results: { fitness, iterations, cost, ... }
```

### Nouveau Concept : Training Strategy

```csharp
public class TrainingStrategy
{
    public string Id { get; set; }
    public string Name { get; set; }
    public TrainingMethodType Method { get; set; }
    public bool IsSystem { get; set; }  // Template système
    public bool IsTemplate { get; set; }
    public TrainingStrategyConfig Config { get; set; }
    public string? Description { get; set; }
    public List<string> SuitableFor { get; set; }  // ["code", "reasoning", "classification"]
    public EstimatedResources Resources { get; set; }
}

public enum TrainingMethodType
{
    SupervisedFineTuning,      // SFT classique
    ReinforcementLearning,     // RL avec fitness
    PreferenceLearning,        // RLAIF / DPO
    ExecutionBased,            // Tests comme signal
    Evolutionary,              // Sélection naturelle
    Distillation,              // Teacher → Student
    CurriculumLearning,        // Simple → Complexe
    SelfPlay,                  // Auto-correction
    NeuroSymbolic,             // Règles + LLM
    MixtureOfExperts           // MoE routing
}
```

### Nouveau Concept : Training Experiment

```csharp
public class TrainingExperiment
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string WorkspaceId { get; set; }
    public string TargetAgentId { get; set; }
    public string StrategyId { get; set; }
    public ExperimentStatus Status { get; set; }
    public ExperimentConfig Config { get; set; }
    public List<string> SessionIds { get; set; }
    public ExperimentResults Results { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public class ExperimentResults
{
    public double InitialFitness { get; set; }
    public double FinalFitness { get; set; }
    public double FitnessImprovement { get; set; }
    public int TotalIterations { get; set; }
    public decimal TotalCost { get; set; }
    public TimeSpan TotalDuration { get; set; }
    public double CostEfficiency { get; set; }  // Improvement / Cost
    public int Rank { get; set; }  // Classement vs autres expériences
}
```

---

## Stratégies Système (Templates)

### 1. SFT - Supervised Fine-Tuning

```json
{
  "id": "system:strategy:sft",
  "name": "Supervised Fine-Tuning",
  "method": "SupervisedFineTuning",
  "isSystem": true,
  "description": "Entraînement classique avec paires input/output",
  "suitableFor": ["classification", "parsing", "specialized-tasks"],
  "config": {
    "dataRequirement": "labeled-pairs",
    "minSamples": 100,
    "epochs": 3,
    "learningRate": 2e-5,
    "batchSize": 8
  },
  "resources": {
    "estimatedTime": "1-4 hours",
    "gpuRequired": true,
    "costEstimate": "low-medium"
  },
  "strengths": [
    "Simple et stable",
    "Très efficace pour spécialisation",
    "Résultats prévisibles"
  ],
  "weaknesses": [
    "Nécessite données de qualité",
    "N'apprend pas à choisir",
    "Pas adaptatif"
  ]
}
```

### 2. RL - Reinforcement Learning

```json
{
  "id": "system:strategy:rl-fitness",
  "name": "RL avec Fitness",
  "method": "ReinforcementLearning",
  "isSystem": true,
  "description": "Apprentissage par récompense basé sur le score fitness",
  "suitableFor": ["orchestration", "decision-making", "cost-optimization"],
  "config": {
    "algorithm": "PPO",
    "rewardSignal": "fitness-score",
    "episodes": 1000,
    "gamma": 0.99,
    "clipRange": 0.2
  },
  "resources": {
    "estimatedTime": "4-12 hours",
    "gpuRequired": true,
    "costEstimate": "medium-high"
  },
  "strengths": [
    "Optimise directement la métrique cible",
    "Apprend à éviter le coût inutile",
    "Adaptatif"
  ],
  "weaknesses": [
    "Instable sans bon tuning",
    "Lent à converger",
    "Coûteux en compute"
  ]
}
```

### 3. Execution-Based Learning

```json
{
  "id": "system:strategy:execution-based",
  "name": "Training par Tests",
  "method": "ExecutionBased",
  "isSystem": true,
  "description": "Le runtime est la vérité - tests comme signal d'apprentissage",
  "suitableFor": ["code-generation", "bug-fixing", "refactoring"],
  "config": {
    "signalType": "test-results",
    "compileRequired": true,
    "testSuite": "comprehensive",
    "passThreshold": 0.95,
    "maxAttempts": 10
  },
  "resources": {
    "estimatedTime": "2-8 hours",
    "gpuRequired": false,
    "costEstimate": "medium",
    "requiresTestInfra": true
  },
  "strengths": [
    "Signal objectif et vérifiable",
    "Aucun humain requis",
    "Très proche de la production"
  ],
  "weaknesses": [
    "Nécessite infrastructure de test",
    "Limité aux tâches testables"
  ]
}
```

### 4. Distillation

```json
{
  "id": "system:strategy:distillation",
  "name": "Distillation Teacher→Student",
  "method": "Distillation",
  "isSystem": true,
  "description": "Un gros modèle enseigne à un petit modèle",
  "suitableFor": ["cost-reduction", "edge-deployment", "specialization"],
  "config": {
    "teacherModel": "auto-select-best",
    "studentModel": "smallest-capable",
    "temperature": 2.0,
    "alpha": 0.5,
    "samples": 10000
  },
  "resources": {
    "estimatedTime": "2-6 hours",
    "gpuRequired": true,
    "costEstimate": "medium",
    "requiresTeacher": true
  },
  "strengths": [
    "Excellent ratio performance/taille",
    "Réduit les coûts d'inférence",
    "Bootstrap rapide"
  ],
  "weaknesses": [
    "Dépendant de la qualité du teacher",
    "Peut transférer les biais"
  ]
}
```

### 5. Evolutionary

```json
{
  "id": "system:strategy:evolutionary",
  "name": "Training Évolutionnaire",
  "method": "Evolutionary",
  "isSystem": true,
  "description": "Sélection naturelle de modèles par fitness",
  "suitableFor": ["architecture-discovery", "workflow-emergence", "exploration"],
  "config": {
    "populationSize": 10,
    "generations": 50,
    "mutationRate": 0.1,
    "crossoverRate": 0.3,
    "selectionMethod": "tournament",
    "elitism": 2
  },
  "resources": {
    "estimatedTime": "8-24 hours",
    "gpuRequired": true,
    "costEstimate": "high",
    "parallelizable": true
  },
  "strengths": [
    "Favorise la spécialisation",
    "Très robuste",
    "Découvre des solutions inattendues"
  ],
  "weaknesses": [
    "Lent",
    "Difficile à scaler",
    "Résultats variables"
  ]
}
```

### 6. Self-Play

```json
{
  "id": "system:strategy:self-play",
  "name": "Self-Play / Auto-Refinement",
  "method": "SelfPlay",
  "isSystem": true,
  "description": "Le modèle génère, critique et corrige ses propres sorties",
  "suitableFor": ["refactoring", "optimization", "reasoning"],
  "config": {
    "rounds": 5,
    "critiqueModel": "self",
    "refinementIterations": 3,
    "acceptanceThreshold": 0.8
  },
  "resources": {
    "estimatedTime": "1-4 hours",
    "gpuRequired": false,
    "costEstimate": "low-medium"
  },
  "strengths": [
    "Peu de données externes requises",
    "Amélioration continue",
    "Bon pour la qualité"
  ],
  "weaknesses": [
    "Risque d'auto-illusion",
    "Nécessite garde-fous"
  ]
}
```

### 7. Preference Learning (RLAIF/DPO)

```json
{
  "id": "system:strategy:preference",
  "name": "Preference Learning",
  "method": "PreferenceLearning",
  "isSystem": true,
  "description": "Apprentissage par comparaison A vs B",
  "suitableFor": ["quality", "style", "safety", "alignment"],
  "config": {
    "algorithm": "DPO",
    "comparisons": 1000,
    "evaluator": "auto",
    "beta": 0.1
  },
  "resources": {
    "estimatedTime": "2-6 hours",
    "gpuRequired": true,
    "costEstimate": "medium"
  },
  "strengths": [
    "Plus stable que RL pur",
    "Encode bien les préférences qualitatives",
    "Bon pour l'alignement"
  ],
  "weaknesses": [
    "Nécessite évaluateur fiable",
    "Comparaisons peuvent être subjectives"
  ]
}
```

### 8. Curriculum Learning

```json
{
  "id": "system:strategy:curriculum",
  "name": "Curriculum Learning",
  "method": "CurriculumLearning",
  "isSystem": true,
  "description": "Apprentissage progressif du simple au complexe",
  "suitableFor": ["reasoning", "multi-step", "complex-tasks"],
  "config": {
    "stages": ["basic", "intermediate", "advanced", "expert"],
    "promotionThreshold": 0.85,
    "adaptiveProgression": true
  },
  "resources": {
    "estimatedTime": "4-12 hours",
    "gpuRequired": true,
    "costEstimate": "medium-high"
  },
  "strengths": [
    "Convergence plus rapide",
    "Meilleure stabilité",
    "Adapté aux tâches complexes"
  ],
  "weaknesses": [
    "Design du curriculum crucial",
    "Plus complexe à configurer"
  ]
}
```

### 9. Neuro-Symbolic

```json
{
  "id": "system:strategy:neuro-symbolic",
  "name": "Neuro-Symbolic Hybrid",
  "method": "NeuroSymbolic",
  "isSystem": true,
  "description": "Combinaison de règles explicites et apprentissage",
  "suitableFor": ["parsing", "validation", "business-logic", "compliance"],
  "config": {
    "rulesSource": "domain-specific",
    "llmRole": "fuzzy-handling",
    "constraintEnforcement": "strict"
  },
  "resources": {
    "estimatedTime": "1-4 hours",
    "gpuRequired": false,
    "costEstimate": "low"
  },
  "strengths": [
    "Explicable et auditable",
    "Très robuste",
    "Peu de paramètres"
  ],
  "weaknesses": [
    "Nécessite expertise domaine",
    "Moins flexible"
  ]
}
```

### 10. Mixture of Experts

```json
{
  "id": "system:strategy:moe",
  "name": "Mixture of Experts",
  "method": "MixtureOfExperts",
  "isSystem": true,
  "description": "Spécialisation structurelle avec routage intelligent",
  "suitableFor": ["multi-domain", "large-scale", "efficiency"],
  "config": {
    "numExperts": 8,
    "topK": 2,
    "routerTraining": "load-balanced",
    "expertCapacity": 1.25
  },
  "resources": {
    "estimatedTime": "12-48 hours",
    "gpuRequired": true,
    "costEstimate": "high",
    "multiGpu": true
  },
  "strengths": [
    "Compute efficace",
    "Spécialisation naturelle",
    "Scale bien"
  ],
  "weaknesses": [
    "Complexité infrastructure",
    "Experts parfois sous-utilisés"
  ]
}
```

---

## Interface Utilisateur Proposée

### Vue Workspace Research

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔬 Research Workspace: Agent Improvement Lab                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Target Agent: code-review-agent-v2                                         │
│  Current Fitness: 72%  │  Goal: 85%  │  Budget: $50                        │
│                                                                             │
│  ┌─ Active Experiments ─────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  [▶ Running] SFT Classic          Fitness: 72% → 78%  ████████░░ 80% │  │
│  │  [▶ Running] RL-Fitness           Fitness: 72% → 81%  ██████░░░░ 60% │  │
│  │  [▶ Running] Execution-Based      Fitness: 72% → 76%  ████░░░░░░ 40% │  │
│  │  [⏸ Paused]  Distillation         Fitness: 72% → 74%  ███░░░░░░░ 30% │  │
│  │  [○ Queued]  Self-Play            Not started                        │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [+ New Experiment]  [▶ Start All]  [⏸ Pause All]  [Compare Results]       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dialogue de Création d'Expérience

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 New Training Experiment                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Target Agent: [code-review-agent-v2 ▼]                                    │
│                                                                             │
│  Select Strategy:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ SFT - Supervised Fine-Tuning                                      │   │
│  │   Best for: classification, parsing, specialized tasks              │   │
│  │   Resources: 1-4h, GPU required, Cost: $5-15                        │   │
│  │                                                                      │   │
│  │ ● RL - Reinforcement Learning                      [Recommended]    │   │
│  │   Best for: orchestration, decision-making, cost optimization       │   │
│  │   Resources: 4-12h, GPU required, Cost: $15-40                      │   │
│  │                                                                      │   │
│  │ ○ Execution-Based                                                   │   │
│  │   Best for: code generation, bug fixing, refactoring                │   │
│  │   Resources: 2-8h, Test infra required, Cost: $10-25                │   │
│  │                                                                      │   │
│  │ ○ Distillation                                                      │   │
│  │   Best for: cost reduction, edge deployment                         │   │
│  │   Resources: 2-6h, Teacher model required, Cost: $10-20             │   │
│  │                                                                      │   │
│  │ [Show 6 more strategies...]                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Configuration:                                                             │
│  ├─ Max Iterations: [1000        ]                                         │
│  ├─ Fitness Target: [0.85        ]                                         │
│  ├─ Budget Limit:   [$20         ]                                         │
│  └─ Priority:       [Normal ▼    ]                                         │
│                                                                             │
│                                    [Cancel]  [Create & Start]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Vue Comparaison des Résultats

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Experiment Comparison: code-review-agent-v2                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Strategy          │ Fitness │ Δ Fitness │ Cost   │ Time  │ Efficiency│  │
│  ├───────────────────┼─────────┼───────────┼────────┼───────┼───────────│  │
│  │ 🥇 RL-Fitness     │ 86%     │ +14%      │ $18.50 │ 6.2h  │ 0.76      │  │
│  │ 🥈 Execution-Based│ 84%     │ +12%      │ $12.30 │ 4.1h  │ 0.98      │  │
│  │ 🥉 Self-Play      │ 82%     │ +10%      │ $8.20  │ 2.8h  │ 1.22      │  │
│  │    SFT Classic    │ 79%     │ +7%       │ $6.50  │ 1.5h  │ 1.08      │  │
│  │    Distillation   │ 77%     │ +5%       │ $9.80  │ 3.2h  │ 0.51      │  │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📈 Fitness Over Time                                                       │
│  100%│                                            ╭─── RL-Fitness          │
│   90%│                                    ╭───────╯                        │
│   80%│                        ╭───────────╯    ╭─── Execution-Based       │
│   70%│    ╭───────────────────╯                │                          │
│   60%│────╯                                                                │
│      └────────────────────────────────────────────────────────────────     │
│        0h        2h        4h        6h        8h                          │
│                                                                             │
│  Recommendation: RL-Fitness achieved highest fitness.                       │
│                  Execution-Based has best cost efficiency.                  │
│                                                                             │
│  [Promote RL-Fitness to Staging]  [Export Report]  [Archive Experiments]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Commandes CLI Proposées

```bash
# Lister les stratégies disponibles
maestro strategy list
maestro strategy info rl-fitness

# Créer et gérer des expériences
maestro experiment create --agent agent-123 --strategy rl-fitness
maestro experiment create --agent agent-123 --strategy all  # Toutes les stratégies
maestro experiment list --workspace research
maestro experiment status exp-456
maestro experiment compare --workspace research --agent agent-123

# Actions groupées
maestro experiment start-all --workspace research --agent agent-123
maestro experiment pause-all --workspace research
maestro experiment cancel exp-456

# Promotion du gagnant
maestro experiment promote exp-456 --to staging
maestro experiment promote-best --workspace research --agent agent-123 --to staging
```

---

## Avantages de cette Architecture

### 1. Diversité Garantie
- 10 stratégies système disponibles
- Possibilité de créer des stratégies personnalisées
- Exécution parallèle pour comparaison équitable

### 2. Sélection Objective
- Métriques comparables (fitness, coût, temps)
- Score d'efficacité calculé automatiquement
- Classement automatique des expériences

### 3. Flexibilité
- Démarrer une seule expérience ou toutes
- Pause/reprise individuelle ou groupée
- Budget et limites configurables

### 4. Simplicité
- Un seul workspace à gérer
- Templates système prêts à l'emploi
- Promotion du meilleur en un clic

---

## Questions Ouvertes

1. **Combinaison de stratégies** : Permettre des pipelines (ex: Distillation → RL) ?
2. **Stratégies personnalisées** : Interface pour créer ses propres stratégies ?
3. **Auto-sélection** : Le système devrait-il recommander la stratégie basée sur l'agent ?
4. **Budgets partagés vs séparés** : Budget global ou par expérience ?
5. **Historique** : Conserver combien de temps les résultats des expériences ?

---

## Conclusion

Cette architecture permet de tester systématiquement différentes approches de training tout en gardant une gestion simple. Le concept de "Training Strategy" comme template système offre la diversité recherchée, tandis que le "Training Experiment" permet le suivi et la comparaison.

La recommandation finale est de **maintenir un seul workspace de recherche** avec des **expériences parallèles** utilisant différentes stratégies système.
