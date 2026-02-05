# Plan d'Implémentation V2: Stratégies de Training comme Blocks

**Date**: 3 février 2026
**Phase**: 7 - Training Strategies (Révisé)
**Philosophie**: Aligné avec `MAESTRO-PHILOSOPHY-V2.md`

---

## Principes Directeurs

Ce plan respecte les principes fondamentaux de Maestro:

| Principe | Application |
|----------|-------------|
| **9.1 Tout est un Block** | Stratégies = Workflow Blocks, Manager = Agent Block |
| **9.2 CLI-First** | CLI délègue à `system:experiment-manager` |
| **9.4 Spécialisation** | Chaque stratégie est un workflow composable |
| **9.5 Overridable** | Tous les system blocks peuvent être overridés |

---

## Architecture Cible

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI (maestro experiment)                        │
│                                      │                                       │
│                                      ▼                                       │
│                    ┌─────────────────────────────────┐                      │
│                    │   system:experiment-manager     │ ← Agent Block        │
│                    │   (orchestre les expériences)   │                      │
│                    └────────────────┬────────────────┘                      │
│                                     │                                        │
│         ┌───────────────────────────┼───────────────────────────┐           │
│         │                           │                           │           │
│         ▼                           ▼                           ▼           │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │ strategy:   │           │ strategy:   │           │ strategy:   │       │
│  │ sft         │           │ rl-fitness  │           │ distillation│       │
│  │ (workflow)  │           │ (workflow)  │           │ (workflow)  │       │
│  └──────┬──────┘           └──────┬──────┘           └──────┬──────┘       │
│         │                         │                         │               │
│         └─────────────────────────┼─────────────────────────┘               │
│                                   ▼                                         │
│                    ┌─────────────────────────────────┐                      │
│                    │   Blocks Helpers Réutilisables  │                      │
│                    │   • iteration-runner            │                      │
│                    │   • fitness-evaluator           │                      │
│                    │   • reward-calculator           │                      │
│                    │   • early-stopper               │                      │
│                    └─────────────────────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Étape 1: Blocks Helpers de Base

Ces blocks sont utilisés par toutes les stratégies.

### 1.1 Créer `iteration-runner.workflow.block.json`

**Fichier**: `blocks/system/training/iteration-runner.workflow.block.json`

```json
{
  "id": "system:iteration-runner",
  "name": "Iteration Runner",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Exécute une itération de training sur un agent cible",
  "config": {
    "timeout": 300000,
    "retryOnFailure": true,
    "maxRetries": 3,
    "collectMetrics": true
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "workflowId": { "type": "string", "required": true },
    "iterationNumber": { "type": "number", "required": true },
    "parameters": { "type": "object", "required": false }
  },
  "outputs": {
    "success": { "type": "boolean" },
    "metrics": { "type": "object" },
    "duration": { "type": "number" },
    "error": { "type": "string" }
  },
  "children": []
}
```

### 1.2 Créer `reward-calculator.agent.block.json`

**Fichier**: `blocks/system/training/reward-calculator.agent.block.json`

```json
{
  "id": "system:reward-calculator",
  "name": "Reward Calculator",
  "blockType": "agent",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Calcule les récompenses pour le reinforcement learning basé sur le fitness",
  "config": {
    "rewardType": "fitness-based",
    "normalization": "minmax",
    "discountFactor": 0.99
  },
  "inputs": {
    "currentFitness": { "type": "number", "required": true },
    "previousFitness": { "type": "number", "required": true },
    "metrics": { "type": "object", "required": true },
    "config": { "type": "object", "required": false }
  },
  "outputs": {
    "reward": { "type": "number" },
    "breakdown": { "type": "object" },
    "normalized": { "type": "number" }
  }
}
```

### 1.3 Créer `early-stopper.agent.block.json`

**Fichier**: `blocks/system/training/early-stopper.agent.block.json`

```json
{
  "id": "system:early-stopper",
  "name": "Early Stopper",
  "blockType": "agent",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Détermine quand arrêter le training (convergence, plateau, dégradation)",
  "config": {
    "patience": 10,
    "minDelta": 0.001,
    "mode": "maximize"
  },
  "inputs": {
    "fitnessHistory": { "type": "array", "required": true },
    "currentIteration": { "type": "number", "required": true },
    "maxIterations": { "type": "number", "required": true },
    "targetFitness": { "type": "number", "required": false }
  },
  "outputs": {
    "shouldStop": { "type": "boolean" },
    "reason": { "type": "string" },
    "confidence": { "type": "number" }
  }
}
```

### 1.4 Créer `metrics-aggregator.agent.block.json`

**Fichier**: `blocks/system/training/metrics-aggregator.agent.block.json`

```json
{
  "id": "system:metrics-aggregator",
  "name": "Metrics Aggregator",
  "blockType": "agent",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Agrège les métriques de plusieurs itérations pour analyse",
  "config": {
    "windowSize": 10,
    "aggregations": ["mean", "std", "min", "max", "trend"]
  },
  "inputs": {
    "metricsHistory": { "type": "array", "required": true }
  },
  "outputs": {
    "aggregated": { "type": "object" },
    "trends": { "type": "object" },
    "anomalies": { "type": "array" }
  }
}
```

---

## Étape 2: Stratégies comme Workflow Blocks

Chaque méthode de training est un workflow block indépendant et overridable.

### 2.1 Créer `sft-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/sft-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-sft",
  "name": "Supervised Fine-Tuning Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Stratégie classique de fine-tuning supervisé avec exemples gold-standard",
  "metadata": {
    "method": "SupervisedFineTuning",
    "category": "supervised",
    "suitableFor": ["classification", "generation", "qa"],
    "strengths": [
      "Simple à implémenter",
      "Résultats prévisibles",
      "Bon pour tâches bien définies"
    ],
    "weaknesses": [
      "Nécessite données labellisées",
      "Peut sur-apprendre",
      "Moins adaptatif"
    ],
    "estimatedResources": {
      "minIterations": 10,
      "typicalIterations": 100,
      "costPerIteration": "low"
    }
  },
  "config": {
    "learningRate": 0.001,
    "batchSize": 8,
    "epochs": 3,
    "validationSplit": 0.2,
    "earlyStopping": {
      "enabled": true,
      "patience": 5,
      "minDelta": 0.01
    }
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "trainingData": { "type": "array", "required": true },
    "validationData": { "type": "array", "required": false },
    "maxIterations": { "type": "number", "default": 100 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "iterationsCompleted": { "type": "number" },
    "trainingHistory": { "type": "array" },
    "bestCheckpoint": { "type": "string" }
  },
  "children": [
    { "ref": "system:iteration-runner", "role": "executor" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:early-stopper", "role": "stopper" },
    { "ref": "system:metrics-aggregator", "role": "aggregator" }
  ]
}
```

### 2.2 Créer `rl-fitness-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/rl-fitness-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-rl-fitness",
  "name": "RL Fitness Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Reinforcement Learning optimisé pour maximiser le fitness Maestro",
  "metadata": {
    "method": "ReinforcementLearning",
    "category": "reinforcement",
    "suitableFor": ["reasoning", "code", "agentic"],
    "strengths": [
      "Optimise directement le fitness",
      "Adaptable aux tâches complexes",
      "Découvre des stratégies nouvelles"
    ],
    "weaknesses": [
      "Peut être instable",
      "Nécessite plus d'itérations",
      "Sensible aux hyperparamètres"
    ],
    "estimatedResources": {
      "minIterations": 50,
      "typicalIterations": 500,
      "costPerIteration": "medium"
    }
  },
  "config": {
    "algorithm": "PPO",
    "fitnessWeight": 1.0,
    "explorationRate": 0.1,
    "explorationDecay": 0.995,
    "rewardShaping": {
      "fitnessImprovement": 1.0,
      "costPenalty": -0.1,
      "formatCompliance": 0.2
    },
    "earlyStopping": {
      "enabled": true,
      "fitnessThreshold": 0.9,
      "plateauPatience": 20
    }
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "taskWorkflowId": { "type": "string", "required": true },
    "maxIterations": { "type": "number", "default": 500 },
    "targetFitness": { "type": "number", "default": 0.9 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "fitnessImprovement": { "type": "number" },
    "iterationsCompleted": { "type": "number" },
    "rewardHistory": { "type": "array" },
    "policyCheckpoints": { "type": "array" }
  },
  "children": [
    { "ref": "system:iteration-runner", "role": "executor" },
    { "ref": "system:reward-calculator", "role": "reward" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:early-stopper", "role": "stopper" },
    { "ref": "system:metrics-aggregator", "role": "aggregator" }
  ]
}
```

### 2.3 Créer `preference-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/preference-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-preference",
  "name": "Preference Learning Strategy (RLAIF/DPO)",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Apprentissage par préférences avec RLAIF ou DPO",
  "metadata": {
    "method": "PreferenceLearning",
    "category": "preference",
    "suitableFor": ["alignment", "style", "safety"],
    "strengths": [
      "Aligne avec préférences humaines/IA",
      "Pas besoin de récompenses explicites",
      "Efficace pour le style"
    ],
    "weaknesses": [
      "Nécessite paires de comparaison",
      "Peut être subjectif",
      "Coûteux en évaluation"
    ],
    "estimatedResources": {
      "minIterations": 20,
      "typicalIterations": 200,
      "costPerIteration": "high"
    }
  },
  "config": {
    "method": "DPO",
    "beta": 0.1,
    "referenceModel": "self",
    "preferenceSource": "ai",
    "evaluatorModel": "default",
    "comparisonBatchSize": 4
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "preferenceData": { "type": "array", "required": false },
    "generatePreferences": { "type": "boolean", "default": true },
    "maxIterations": { "type": "number", "default": 200 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "preferenceAccuracy": { "type": "number" },
    "alignmentScore": { "type": "number" },
    "iterationsCompleted": { "type": "number" }
  },
  "children": [
    { "ref": "system:iteration-runner", "role": "executor" },
    { "ref": "system:preference-evaluator", "role": "evaluator" },
    { "ref": "system:fitness-evaluator", "role": "fitness" },
    { "ref": "system:early-stopper", "role": "stopper" }
  ]
}
```

### 2.4 Créer `execution-based-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/execution-based-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-execution",
  "name": "Execution-Based Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Training basé sur les tests et l'exécution réelle du code",
  "metadata": {
    "method": "ExecutionBased",
    "category": "verification",
    "suitableFor": ["code", "math", "logic"],
    "strengths": [
      "Signal de récompense objectif",
      "Vérifie la correction réelle",
      "Pas de biais d'évaluation"
    ],
    "weaknesses": [
      "Limité aux tâches vérifiables",
      "Peut être lent (exécution)",
      "Nécessite environnement sécurisé"
    ],
    "estimatedResources": {
      "minIterations": 20,
      "typicalIterations": 150,
      "costPerIteration": "medium"
    }
  },
  "config": {
    "executionTimeout": 30000,
    "sandboxed": true,
    "testTypes": ["unit", "integration"],
    "partialCredit": true,
    "rewardMapping": {
      "allTestsPass": 1.0,
      "partialPass": 0.5,
      "compileError": -0.5,
      "runtimeError": -0.3
    }
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "testSuiteId": { "type": "string", "required": true },
    "maxIterations": { "type": "number", "default": 150 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "testPassRate": { "type": "number" },
    "executionResults": { "type": "array" },
    "iterationsCompleted": { "type": "number" }
  },
  "children": [
    { "ref": "system:iteration-runner", "role": "executor" },
    { "ref": "system:test-runner", "role": "tester" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:early-stopper", "role": "stopper" }
  ]
}
```

### 2.5 Créer `evolutionary-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/evolutionary-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-evolutionary",
  "name": "Evolutionary Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Sélection naturelle avec population d'agents variants",
  "metadata": {
    "method": "Evolutionary",
    "category": "population",
    "suitableFor": ["optimization", "creativity", "exploration"],
    "strengths": [
      "Explore l'espace de solutions",
      "Évite les minima locaux",
      "Parallélisable"
    ],
    "weaknesses": [
      "Gourmand en ressources",
      "Convergence lente",
      "Nécessite grande population"
    ],
    "estimatedResources": {
      "minIterations": 10,
      "typicalIterations": 50,
      "costPerIteration": "very-high"
    }
  },
  "config": {
    "populationSize": 10,
    "generations": 50,
    "selectionMethod": "tournament",
    "tournamentSize": 3,
    "mutationRate": 0.1,
    "crossoverRate": 0.7,
    "elitism": 2
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "maxGenerations": { "type": "number", "default": 50 },
    "targetFitness": { "type": "number", "default": 0.95 }
  },
  "outputs": {
    "bestFitness": { "type": "number" },
    "bestAgentId": { "type": "string" },
    "generationHistory": { "type": "array" },
    "populationDiversity": { "type": "number" }
  },
  "children": [
    { "ref": "system:population-manager", "role": "population" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:mutation-operator", "role": "mutator" },
    { "ref": "system:selection-operator", "role": "selector" }
  ]
}
```

### 2.6 Créer `distillation-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/distillation-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-distillation",
  "name": "Knowledge Distillation Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Transfert de connaissances d'un grand modèle vers un petit",
  "metadata": {
    "method": "Distillation",
    "category": "transfer",
    "suitableFor": ["compression", "efficiency", "deployment"],
    "strengths": [
      "Réduit la taille du modèle",
      "Préserve les performances",
      "Améliore le fitness (coût réduit)"
    ],
    "weaknesses": [
      "Nécessite un teacher performant",
      "Perte de capacités possibles",
      "Complexe à calibrer"
    ],
    "estimatedResources": {
      "minIterations": 30,
      "typicalIterations": 200,
      "costPerIteration": "high"
    }
  },
  "config": {
    "teacherModel": null,
    "temperature": 2.0,
    "alpha": 0.5,
    "distillationType": "response",
    "softLabelWeight": 0.7,
    "hardLabelWeight": 0.3
  },
  "inputs": {
    "studentAgentId": { "type": "string", "required": true },
    "teacherAgentId": { "type": "string", "required": true },
    "trainingData": { "type": "array", "required": true },
    "maxIterations": { "type": "number", "default": 200 }
  },
  "outputs": {
    "studentFitness": { "type": "number" },
    "teacherFitness": { "type": "number" },
    "fitnessRatio": { "type": "number" },
    "compressionRatio": { "type": "number" }
  },
  "children": [
    { "ref": "system:teacher-inference", "role": "teacher" },
    { "ref": "system:iteration-runner", "role": "student" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:early-stopper", "role": "stopper" }
  ]
}
```

### 2.7 Créer `curriculum-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/curriculum-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-curriculum",
  "name": "Curriculum Learning Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Progression simple→complexe pour apprentissage graduel",
  "metadata": {
    "method": "CurriculumLearning",
    "category": "progressive",
    "suitableFor": ["reasoning", "math", "language"],
    "strengths": [
      "Apprentissage stable",
      "Gère la complexité graduellement",
      "Meilleure généralisation"
    ],
    "weaknesses": [
      "Nécessite curriculum design",
      "Peut être lent au début",
      "Difficulté à définir la progression"
    ],
    "estimatedResources": {
      "minIterations": 50,
      "typicalIterations": 300,
      "costPerIteration": "medium"
    }
  },
  "config": {
    "stages": [
      { "name": "basic", "difficulty": 0.2, "iterations": 50 },
      { "name": "intermediate", "difficulty": 0.5, "iterations": 100 },
      { "name": "advanced", "difficulty": 0.8, "iterations": 100 },
      { "name": "expert", "difficulty": 1.0, "iterations": 50 }
    ],
    "promotionThreshold": 0.8,
    "allowDemotion": false
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "curriculumId": { "type": "string", "required": true },
    "startStage": { "type": "number", "default": 0 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "stagesCompleted": { "type": "number" },
    "stageHistory": { "type": "array" },
    "finalStage": { "type": "string" }
  },
  "children": [
    { "ref": "system:curriculum-manager", "role": "curriculum" },
    { "ref": "system:iteration-runner", "role": "executor" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:stage-promoter", "role": "promoter" }
  ]
}
```

### 2.8 Créer `self-play-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/self-play-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-self-play",
  "name": "Self-Play Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Auto-amélioration par génération et critique de ses propres outputs",
  "metadata": {
    "method": "SelfPlay",
    "category": "self-improvement",
    "suitableFor": ["reasoning", "debate", "verification"],
    "strengths": [
      "Pas besoin de données externes",
      "Amélioration continue",
      "Découvre ses propres faiblesses"
    ],
    "weaknesses": [
      "Peut amplifier les biais",
      "Risque de mode collapse",
      "Nécessite bonne auto-évaluation"
    ],
    "estimatedResources": {
      "minIterations": 30,
      "typicalIterations": 200,
      "costPerIteration": "medium"
    }
  },
  "config": {
    "roles": ["generator", "critic"],
    "selfCritiqueEnabled": true,
    "debateRounds": 3,
    "consensusThreshold": 0.8
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "taskPrompts": { "type": "array", "required": true },
    "maxIterations": { "type": "number", "default": 200 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "selfCritiqueAccuracy": { "type": "number" },
    "improvementRate": { "type": "number" }
  },
  "children": [
    { "ref": "system:generator-agent", "role": "generator" },
    { "ref": "system:critic-agent", "role": "critic" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:early-stopper", "role": "stopper" }
  ]
}
```

### 2.9 Créer `neuro-symbolic-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/neuro-symbolic-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-neuro-symbolic",
  "name": "Neuro-Symbolic Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Combine raisonnement symbolique (règles) avec LLM",
  "metadata": {
    "method": "NeuroSymbolic",
    "category": "hybrid",
    "suitableFor": ["logic", "compliance", "structured"],
    "strengths": [
      "Garanties logiques",
      "Explicable",
      "Combine flexibilité et rigueur"
    ],
    "weaknesses": [
      "Complexe à implémenter",
      "Nécessite règles explicites",
      "Peut être rigide"
    ],
    "estimatedResources": {
      "minIterations": 20,
      "typicalIterations": 100,
      "costPerIteration": "medium"
    }
  },
  "config": {
    "rulesSource": "inline",
    "rules": [],
    "constraintEnforcement": "soft",
    "symbolicWeight": 0.3,
    "neuralWeight": 0.7
  },
  "inputs": {
    "agentId": { "type": "string", "required": true },
    "rulesId": { "type": "string", "required": false },
    "maxIterations": { "type": "number", "default": 100 }
  },
  "outputs": {
    "finalFitness": { "type": "number" },
    "ruleCompliance": { "type": "number" },
    "constraintViolations": { "type": "array" }
  },
  "children": [
    { "ref": "system:rule-engine", "role": "symbolic" },
    { "ref": "system:iteration-runner", "role": "neural" },
    { "ref": "system:constraint-checker", "role": "validator" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" }
  ]
}
```

### 2.10 Créer `moe-strategy.workflow.block.json`

**Fichier**: `blocks/system/strategies/moe-strategy.workflow.block.json`

```json
{
  "id": "system:strategy-moe",
  "name": "Mixture of Experts Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Entraîne un routeur pour sélectionner le meilleur expert par tâche",
  "metadata": {
    "method": "MixtureOfExperts",
    "category": "ensemble",
    "suitableFor": ["multi-task", "generalization", "routing"],
    "strengths": [
      "Spécialisation par expert",
      "Scalable",
      "Efficace en inférence"
    ],
    "weaknesses": [
      "Complexe à entraîner",
      "Nécessite plusieurs modèles",
      "Load balancing difficile"
    ],
    "estimatedResources": {
      "minIterations": 50,
      "typicalIterations": 300,
      "costPerIteration": "very-high"
    }
  },
  "config": {
    "numExperts": 4,
    "topK": 2,
    "routerType": "learned",
    "loadBalancingLoss": 0.01,
    "expertSpecialization": true
  },
  "inputs": {
    "baseAgentId": { "type": "string", "required": true },
    "taskTypes": { "type": "array", "required": true },
    "maxIterations": { "type": "number", "default": 300 }
  },
  "outputs": {
    "routerAccuracy": { "type": "number" },
    "expertFitnesses": { "type": "object" },
    "overallFitness": { "type": "number" },
    "routingDistribution": { "type": "object" }
  },
  "children": [
    { "ref": "system:router-trainer", "role": "router" },
    { "ref": "system:expert-trainer", "role": "expert" },
    { "ref": "system:fitness-evaluator", "role": "evaluator" },
    { "ref": "system:load-balancer", "role": "balancer" }
  ]
}
```

---

## Étape 3: Agent Experiment Manager

L'agent principal qui orchestre les expériences.

### 3.1 Créer `experiment-manager.agent.block.json`

**Fichier**: `blocks/system/experiment-manager.agent.block.json`

```json
{
  "id": "system:experiment-manager",
  "name": "Experiment Manager",
  "blockType": "agent",
  "version": "1.0.0",
  "isSystem": true,
  "overridable": true,
  "description": "Orchestre les expériences de training avec différentes stratégies. Point d'entrée CLI pour toutes les opérations d'expérimentation.",
  "capabilities": [
    "experiment-lifecycle",
    "strategy-selection",
    "parallel-execution",
    "result-comparison",
    "recommendation"
  ],
  "config": {
    "maxConcurrentExperiments": 3,
    "defaultWorkspace": null,
    "autoCompare": true,
    "notifyOnComplete": true
  },
  "actions": {
    "create": {
      "description": "Créer une nouvelle expérience",
      "inputs": {
        "name": { "type": "string", "required": true },
        "workspaceId": { "type": "string", "required": true },
        "agentId": { "type": "string", "required": true },
        "strategyId": { "type": "string", "required": true },
        "config": { "type": "object", "required": false }
      }
    },
    "start": {
      "description": "Démarrer une expérience",
      "inputs": {
        "experimentId": { "type": "string", "required": true }
      }
    },
    "startAll": {
      "description": "Démarrer toutes les expériences d'un workspace",
      "inputs": {
        "workspaceId": { "type": "string", "required": true },
        "parallel": { "type": "boolean", "default": true }
      }
    },
    "stop": {
      "description": "Arrêter une expérience",
      "inputs": {
        "experimentId": { "type": "string", "required": true }
      }
    },
    "compare": {
      "description": "Comparer les résultats de plusieurs expériences",
      "inputs": {
        "experimentIds": { "type": "array", "required": true }
      }
    },
    "recommend": {
      "description": "Recommander la meilleure stratégie pour un agent/tâche",
      "inputs": {
        "agentId": { "type": "string", "required": true },
        "taskType": { "type": "string", "required": true }
      }
    },
    "list": {
      "description": "Lister les expériences",
      "inputs": {
        "workspaceId": { "type": "string", "required": false },
        "status": { "type": "string", "required": false }
      }
    },
    "listStrategies": {
      "description": "Lister toutes les stratégies disponibles",
      "inputs": {
        "category": { "type": "string", "required": false }
      }
    }
  },
  "tools": [
    "workspace-gateway",
    "fitness-calculator",
    "training-service",
    "session-manager",
    "block-discovery"
  ],
  "systemPrompt": "Tu es l'Experiment Manager de Maestro. Tu orchestres les expériences de training en utilisant différentes stratégies. Tu dois:\n1. Aider l'utilisateur à choisir la bonne stratégie\n2. Créer et gérer les expériences\n3. Comparer les résultats objectivement\n4. Recommander les meilleures approches basé sur le fitness"
}
```

---

## Étape 4: Infrastructure Backend Minimale

Le backend ne contient que la persistence et l'API de routing vers l'agent.

### 4.1 Créer `TrainingExperiment.cs` (Entité)

**Fichier**: `backend/src/Maestro.Domain/Entities/TrainingExperiment.cs`

```csharp
using System;
using System.Collections.Generic;

namespace Maestro.Domain.Entities;

/// <summary>
/// Représente une expérience de training.
/// La logique est dans les blocks, cette entité sert uniquement à la persistence.
/// </summary>
public class TrainingExperiment
{
    public string Id { get; private set; }
    public string Name { get; private set; }
    public string WorkspaceId { get; private set; }
    public string TargetAgentId { get; private set; }
    public string StrategyBlockId { get; private set; }
    public ExperimentStatus Status { get; private set; }
    public Dictionary<string, object> Config { get; private set; }
    public List<string> SessionIds { get; private set; }
    public ExperimentResults? Results { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? Error { get; private set; }

    private TrainingExperiment() { }

    public static TrainingExperiment Create(
        string name,
        string workspaceId,
        string targetAgentId,
        string strategyBlockId,
        Dictionary<string, object>? config = null)
    {
        return new TrainingExperiment
        {
            Id = $"exp-{Guid.NewGuid():N}",
            Name = name,
            WorkspaceId = workspaceId,
            TargetAgentId = targetAgentId,
            StrategyBlockId = strategyBlockId,
            Status = ExperimentStatus.Created,
            Config = config ?? new Dictionary<string, object>(),
            SessionIds = new List<string>(),
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public void Start()
    {
        if (Status != ExperimentStatus.Created && Status != ExperimentStatus.Paused)
            throw new InvalidOperationException($"Cannot start experiment in status {Status}");

        Status = ExperimentStatus.Running;
        StartedAt ??= DateTimeOffset.UtcNow;
    }

    public void Pause()
    {
        if (Status != ExperimentStatus.Running)
            throw new InvalidOperationException($"Cannot pause experiment in status {Status}");

        Status = ExperimentStatus.Paused;
    }

    public void Complete(ExperimentResults results)
    {
        Status = ExperimentStatus.Completed;
        Results = results;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Fail(string error)
    {
        Status = ExperimentStatus.Failed;
        Error = error;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Cancel()
    {
        Status = ExperimentStatus.Cancelled;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void AddSession(string sessionId)
    {
        SessionIds.Add(sessionId);
    }
}

public enum ExperimentStatus
{
    Created,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled
}
```

### 4.2 Créer `ExperimentResults.cs` (Value Object)

**Fichier**: `backend/src/Maestro.Domain/ValueObjects/ExperimentResults.cs`

```csharp
using System;
using System.Collections.Generic;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Résultats d'une expérience de training.
/// </summary>
public record ExperimentResults
{
    public double InitialFitness { get; init; }
    public double FinalFitness { get; init; }
    public double FitnessImprovement => FinalFitness - InitialFitness;
    public double FitnessImprovementPercent => InitialFitness > 0
        ? (FitnessImprovement / InitialFitness) * 100
        : 0;

    public int TotalIterations { get; init; }
    public int SuccessfulIterations { get; init; }
    public double SuccessRate => TotalIterations > 0
        ? (double)SuccessfulIterations / TotalIterations
        : 0;

    public decimal TotalCost { get; init; }
    public TimeSpan TotalDuration { get; init; }

    public double CostEfficiency => TotalCost > 0
        ? FitnessImprovement / (double)TotalCost
        : 0;

    public double TimeEfficiency => TotalDuration.TotalMinutes > 0
        ? FitnessImprovement / TotalDuration.TotalMinutes
        : 0;

    public List<IterationSnapshot> Snapshots { get; init; } = new();
    public Dictionary<string, object> Metadata { get; init; } = new();

    public static ExperimentResults Empty => new()
    {
        InitialFitness = 0,
        FinalFitness = 0,
        TotalIterations = 0,
        SuccessfulIterations = 0,
        TotalCost = 0,
        TotalDuration = TimeSpan.Zero
    };
}

public record IterationSnapshot
{
    public int Iteration { get; init; }
    public double Fitness { get; init; }
    public decimal Cost { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public Dictionary<string, double> Metrics { get; init; } = new();
}
```

### 4.3 Créer `IExperimentRepository.cs` (Interface)

**Fichier**: `backend/src/Maestro.Application/Interfaces/IExperimentRepository.cs`

```csharp
using System.Collections.Generic;
using System.Threading.Tasks;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository pour la persistence des expériences.
/// </summary>
public interface IExperimentRepository
{
    Task<TrainingExperiment?> GetByIdAsync(string id);
    Task<IEnumerable<TrainingExperiment>> GetByWorkspaceAsync(string workspaceId);
    Task<IEnumerable<TrainingExperiment>> GetByStatusAsync(ExperimentStatus status);
    Task<IEnumerable<TrainingExperiment>> GetAllAsync();
    Task SaveAsync(TrainingExperiment experiment);
    Task DeleteAsync(string id);
}
```

### 4.4 Créer `FileSystemExperimentRepository.cs`

**Fichier**: `backend/src/Maestro.Infrastructure/Experiments/FileSystemExperimentRepository.cs`

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Experiments;

public class FileSystemExperimentRepository : IExperimentRepository
{
    private readonly string _basePath;
    private readonly ILogger<FileSystemExperimentRepository>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public FileSystemExperimentRepository(string basePath, ILogger<FileSystemExperimentRepository>? logger = null)
    {
        _basePath = basePath;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        Directory.CreateDirectory(_basePath);
    }

    public async Task<TrainingExperiment?> GetByIdAsync(string id)
    {
        var filePath = GetFilePath(id);
        if (!File.Exists(filePath))
            return null;

        var json = await File.ReadAllTextAsync(filePath);
        return JsonSerializer.Deserialize<TrainingExperiment>(json, _jsonOptions);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetByWorkspaceAsync(string workspaceId)
    {
        var all = await GetAllAsync();
        return all.Where(e => e.WorkspaceId == workspaceId);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetByStatusAsync(ExperimentStatus status)
    {
        var all = await GetAllAsync();
        return all.Where(e => e.Status == status);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetAllAsync()
    {
        var experiments = new List<TrainingExperiment>();

        if (!Directory.Exists(_basePath))
            return experiments;

        foreach (var file in Directory.GetFiles(_basePath, "*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var experiment = JsonSerializer.Deserialize<TrainingExperiment>(json, _jsonOptions);
                if (experiment != null)
                    experiments.Add(experiment);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load experiment from {File}", file);
            }
        }

        return experiments.OrderByDescending(e => e.CreatedAt);
    }

    public async Task SaveAsync(TrainingExperiment experiment)
    {
        var filePath = GetFilePath(experiment.Id);
        var json = JsonSerializer.Serialize(experiment, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);
        _logger?.LogDebug("Saved experiment {Id} to {Path}", experiment.Id, filePath);
    }

    public Task DeleteAsync(string id)
    {
        var filePath = GetFilePath(id);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger?.LogDebug("Deleted experiment {Id}", id);
        }
        return Task.CompletedTask;
    }

    private string GetFilePath(string id) => Path.Combine(_basePath, $"{id}.json");
}
```

### 4.5 Créer `ExperimentDto.cs`

**Fichier**: `backend/src/Maestro.Application/DTOs/ExperimentDto.cs`

```csharp
using System;
using System.Collections.Generic;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

public record ExperimentDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string WorkspaceId { get; init; } = string.Empty;
    public string TargetAgentId { get; init; } = string.Empty;
    public string StrategyBlockId { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public Dictionary<string, object> Config { get; init; } = new();
    public List<string> SessionIds { get; init; } = new();
    public ExperimentResultsDto? Results { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public string? Error { get; init; }

    public static ExperimentDto FromDomain(TrainingExperiment experiment) => new()
    {
        Id = experiment.Id,
        Name = experiment.Name,
        WorkspaceId = experiment.WorkspaceId,
        TargetAgentId = experiment.TargetAgentId,
        StrategyBlockId = experiment.StrategyBlockId,
        Status = experiment.Status.ToString(),
        Config = experiment.Config,
        SessionIds = experiment.SessionIds,
        Results = experiment.Results != null
            ? ExperimentResultsDto.FromDomain(experiment.Results)
            : null,
        CreatedAt = experiment.CreatedAt,
        StartedAt = experiment.StartedAt,
        CompletedAt = experiment.CompletedAt,
        Error = experiment.Error
    };
}

public record ExperimentResultsDto
{
    public double InitialFitness { get; init; }
    public double FinalFitness { get; init; }
    public double FitnessImprovement { get; init; }
    public double FitnessImprovementPercent { get; init; }
    public int TotalIterations { get; init; }
    public int SuccessfulIterations { get; init; }
    public double SuccessRate { get; init; }
    public decimal TotalCost { get; init; }
    public string TotalDuration { get; init; } = string.Empty;
    public double CostEfficiency { get; init; }
    public double TimeEfficiency { get; init; }

    public static ExperimentResultsDto FromDomain(ExperimentResults results) => new()
    {
        InitialFitness = results.InitialFitness,
        FinalFitness = results.FinalFitness,
        FitnessImprovement = results.FitnessImprovement,
        FitnessImprovementPercent = results.FitnessImprovementPercent,
        TotalIterations = results.TotalIterations,
        SuccessfulIterations = results.SuccessfulIterations,
        SuccessRate = results.SuccessRate,
        TotalCost = results.TotalCost,
        TotalDuration = results.TotalDuration.ToString(),
        CostEfficiency = results.CostEfficiency,
        TimeEfficiency = results.TimeEfficiency
    };
}

public record CreateExperimentRequest
{
    public string Name { get; init; } = string.Empty;
    public string WorkspaceId { get; init; } = string.Empty;
    public string AgentId { get; init; } = string.Empty;
    public string StrategyId { get; init; } = string.Empty;
    public Dictionary<string, object>? Config { get; init; }
}

public record CompareExperimentsRequest
{
    public List<string> ExperimentIds { get; init; } = new();
}

public record ExperimentComparisonDto
{
    public List<ExperimentDto> Experiments { get; init; } = new();
    public string BestExperimentId { get; init; } = string.Empty;
    public string RecommendedStrategyId { get; init; } = string.Empty;
    public Dictionary<string, RankingDto> Rankings { get; init; } = new();
}

public record RankingDto
{
    public int FitnessRank { get; init; }
    public int CostEfficiencyRank { get; init; }
    public int TimeEfficiencyRank { get; init; }
    public int OverallRank { get; init; }
}

public record StrategyInfoDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Method { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public List<string> SuitableFor { get; init; } = new();
    public List<string> Strengths { get; init; } = new();
    public List<string> Weaknesses { get; init; } = new();
    public bool IsSystem { get; init; }
    public bool IsOverridable { get; init; }
}
```

### 4.6 Créer `ExperimentsController.cs`

**Fichier**: `backend/src/Maestro.Api/Controllers/ExperimentsController.cs`

```csharp
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Maestro.Api.Controllers;

/// <summary>
/// API pour les expériences de training.
/// Cette API est un thin wrapper qui délègue la logique à system:experiment-manager.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ExperimentsController : ControllerBase
{
    private readonly IExperimentRepository _repository;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly ILogger<ExperimentsController> _logger;

    public ExperimentsController(
        IExperimentRepository repository,
        IBlockDiscoveryService blockDiscovery,
        ILogger<ExperimentsController> logger)
    {
        _repository = repository;
        _blockDiscovery = blockDiscovery;
        _logger = logger;
    }

    /// <summary>
    /// Liste toutes les expériences
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExperimentDto>>> GetAll(
        [FromQuery] string? workspaceId = null,
        [FromQuery] string? status = null)
    {
        IEnumerable<TrainingExperiment> experiments;

        if (!string.IsNullOrEmpty(workspaceId))
        {
            experiments = await _repository.GetByWorkspaceAsync(workspaceId);
        }
        else if (!string.IsNullOrEmpty(status) &&
                 System.Enum.TryParse<ExperimentStatus>(status, true, out var statusEnum))
        {
            experiments = await _repository.GetByStatusAsync(statusEnum);
        }
        else
        {
            experiments = await _repository.GetAllAsync();
        }

        return Ok(experiments.Select(ExperimentDto.FromDomain));
    }

    /// <summary>
    /// Récupère une expérience par ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ExperimentDto>> GetById(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        return Ok(ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Crée une nouvelle expérience
    /// Note: La création via CLI utilise system:experiment-manager
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ExperimentDto>> Create([FromBody] CreateExperimentRequest request)
    {
        var experiment = TrainingExperiment.Create(
            request.Name,
            request.WorkspaceId,
            request.AgentId,
            request.StrategyId,
            request.Config
        );

        await _repository.SaveAsync(experiment);
        _logger.LogInformation("Created experiment {Id} with strategy {Strategy}",
            experiment.Id, request.StrategyId);

        return CreatedAtAction(nameof(GetById), new { id = experiment.Id },
            ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Démarre une expérience
    /// </summary>
    [HttpPost("{id}/start")]
    public async Task<ActionResult<ExperimentDto>> Start(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        experiment.Start();
        await _repository.SaveAsync(experiment);

        // TODO: Invoquer le workflow de stratégie via system:experiment-manager
        _logger.LogInformation("Started experiment {Id}", id);

        return Ok(ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Arrête une expérience
    /// </summary>
    [HttpPost("{id}/stop")]
    public async Task<ActionResult<ExperimentDto>> Stop(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        experiment.Pause();
        await _repository.SaveAsync(experiment);
        _logger.LogInformation("Stopped experiment {Id}", id);

        return Ok(ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Supprime une expérience
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await _repository.DeleteAsync(id);
        return NoContent();
    }

    /// <summary>
    /// Liste toutes les stratégies disponibles (system blocks)
    /// </summary>
    [HttpGet("strategies")]
    public async Task<ActionResult<IEnumerable<StrategyInfoDto>>> GetStrategies(
        [FromQuery] string? category = null)
    {
        var blocks = await _blockDiscovery.GetAllBlocksAsync();
        var strategies = blocks
            .Where(b => b.BlockType == "workflow" &&
                       b.Id.StartsWith("system:strategy-"))
            .Select(b => new StrategyInfoDto
            {
                Id = b.Id,
                Name = b.Name,
                Method = b.Metadata?.GetValueOrDefault("method")?.ToString() ?? "Unknown",
                Category = b.Metadata?.GetValueOrDefault("category")?.ToString() ?? "Unknown",
                SuitableFor = (b.Metadata?.GetValueOrDefault("suitableFor") as IEnumerable<object>)?
                    .Select(x => x.ToString()!).ToList() ?? new List<string>(),
                Strengths = (b.Metadata?.GetValueOrDefault("strengths") as IEnumerable<object>)?
                    .Select(x => x.ToString()!).ToList() ?? new List<string>(),
                Weaknesses = (b.Metadata?.GetValueOrDefault("weaknesses") as IEnumerable<object>)?
                    .Select(x => x.ToString()!).ToList() ?? new List<string>(),
                IsSystem = b.IsSystem,
                IsOverridable = b.Overridable
            });

        if (!string.IsNullOrEmpty(category))
        {
            strategies = strategies.Where(s =>
                s.Category.Equals(category, System.StringComparison.OrdinalIgnoreCase));
        }

        return Ok(strategies);
    }

    /// <summary>
    /// Compare plusieurs expériences
    /// </summary>
    [HttpPost("compare")]
    public async Task<ActionResult<ExperimentComparisonDto>> Compare(
        [FromBody] CompareExperimentsRequest request)
    {
        var experiments = new List<TrainingExperiment>();
        foreach (var id in request.ExperimentIds)
        {
            var exp = await _repository.GetByIdAsync(id);
            if (exp != null)
                experiments.Add(exp);
        }

        if (experiments.Count < 2)
            return BadRequest(new { error = "Need at least 2 experiments to compare" });

        // Calcul des rankings
        var rankings = new Dictionary<string, RankingDto>();
        var completed = experiments.Where(e => e.Results != null).ToList();

        if (completed.Any())
        {
            var byFitness = completed.OrderByDescending(e => e.Results!.FinalFitness).ToList();
            var byCostEff = completed.OrderByDescending(e => e.Results!.CostEfficiency).ToList();
            var byTimeEff = completed.OrderByDescending(e => e.Results!.TimeEfficiency).ToList();

            foreach (var exp in completed)
            {
                rankings[exp.Id] = new RankingDto
                {
                    FitnessRank = byFitness.IndexOf(exp) + 1,
                    CostEfficiencyRank = byCostEff.IndexOf(exp) + 1,
                    TimeEfficiencyRank = byTimeEff.IndexOf(exp) + 1,
                    OverallRank = 0 // Calculé après
                };
            }

            // Overall rank = moyenne des rangs
            foreach (var kvp in rankings)
            {
                var r = kvp.Value;
                var avgRank = (r.FitnessRank + r.CostEfficiencyRank + r.TimeEfficiencyRank) / 3.0;
                rankings[kvp.Key] = r with { OverallRank = (int)System.Math.Round(avgRank) };
            }
        }

        var bestId = rankings
            .OrderBy(kvp => kvp.Value.OverallRank)
            .FirstOrDefault().Key ?? experiments.First().Id;

        return Ok(new ExperimentComparisonDto
        {
            Experiments = experiments.Select(ExperimentDto.FromDomain).ToList(),
            BestExperimentId = bestId,
            RecommendedStrategyId = experiments.First(e => e.Id == bestId).StrategyBlockId,
            Rankings = rankings
        });
    }
}
```

### 4.7 Modifier `Program.cs`

**Fichier**: `backend/src/Maestro.Api/Program.cs`

Ajouter après la section fitness:

```csharp
// Phase 7: Register experiment services
var experimentsFolder = Path.Combine(pathConfig.RepoRootPath, "data", "experiments");
Directory.CreateDirectory(experimentsFolder);
Console.WriteLine($"[Maestro] Experiments data: {experimentsFolder}");
builder.Services.AddSingleton<IExperimentRepository>(sp =>
{
    var logger = sp.GetService<ILogger<FileSystemExperimentRepository>>();
    return new FileSystemExperimentRepository(experimentsFolder, logger);
});
```

---

## Étape 5: CLI (Délégation à l'Agent)

Le CLI invoque `system:experiment-manager` plutôt que d'implémenter la logique.

### 5.1 Modifier `tools/maestro-cli/index.js`

Ajouter la commande `experiment`:

```javascript
// ============================================================================
// EXPERIMENT COMMANDS (delegates to system:experiment-manager)
// ============================================================================

program
  .command('experiment')
  .description('Manage training experiments (delegates to system:experiment-manager)')
  .addCommand(
    new Command('list')
      .description('List all experiments')
      .option('-w, --workspace <id>', 'Filter by workspace')
      .option('-s, --status <status>', 'Filter by status')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await invokeExperimentManager('list', {
          workspaceId: options.workspace,
          status: options.status
        }, options.json);
      })
  )
  .addCommand(
    new Command('create')
      .description('Create a new experiment')
      .requiredOption('-n, --name <name>', 'Experiment name')
      .requiredOption('-w, --workspace <id>', 'Workspace ID')
      .requiredOption('-a, --agent <id>', 'Target agent ID')
      .requiredOption('-s, --strategy <id>', 'Strategy block ID (e.g., system:strategy-rl-fitness)')
      .option('-c, --config <json>', 'Additional config as JSON')
      .action(async (options) => {
        const config = options.config ? JSON.parse(options.config) : {};
        await invokeExperimentManager('create', {
          name: options.name,
          workspaceId: options.workspace,
          agentId: options.agent,
          strategyId: options.strategy,
          config
        });
      })
  )
  .addCommand(
    new Command('start')
      .description('Start an experiment')
      .argument('<id>', 'Experiment ID')
      .action(async (id) => {
        await invokeExperimentManager('start', { experimentId: id });
      })
  )
  .addCommand(
    new Command('start-all')
      .description('Start all experiments in a workspace')
      .requiredOption('-w, --workspace <id>', 'Workspace ID')
      .option('--sequential', 'Run sequentially instead of parallel')
      .action(async (options) => {
        await invokeExperimentManager('startAll', {
          workspaceId: options.workspace,
          parallel: !options.sequential
        });
      })
  )
  .addCommand(
    new Command('stop')
      .description('Stop an experiment')
      .argument('<id>', 'Experiment ID')
      .action(async (id) => {
        await invokeExperimentManager('stop', { experimentId: id });
      })
  )
  .addCommand(
    new Command('compare')
      .description('Compare multiple experiments')
      .argument('<ids...>', 'Experiment IDs to compare')
      .option('--json', 'Output as JSON')
      .action(async (ids, options) => {
        await invokeExperimentManager('compare', { experimentIds: ids }, options.json);
      })
  )
  .addCommand(
    new Command('recommend')
      .description('Get strategy recommendation for an agent')
      .requiredOption('-a, --agent <id>', 'Agent ID')
      .requiredOption('-t, --task <type>', 'Task type (code, reasoning, etc.)')
      .action(async (options) => {
        await invokeExperimentManager('recommend', {
          agentId: options.agent,
          taskType: options.task
        });
      })
  )
  .addCommand(
    new Command('strategies')
      .description('List available training strategies')
      .option('-c, --category <cat>', 'Filter by category')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await invokeExperimentManager('listStrategies', {
          category: options.category
        }, options.json);
      })
  );

/**
 * Invoke system:experiment-manager agent for experiment operations.
 * This follows the Maestro philosophy: CLI delegates to agents.
 */
async function invokeExperimentManager(action, inputs, jsonOutput = false) {
  try {
    // For now, call the API directly
    // In production, this would invoke the agent block
    const baseUrl = process.env.MAESTRO_API_URL || 'http://localhost:5000';

    let response;
    switch (action) {
      case 'list':
        const params = new URLSearchParams();
        if (inputs.workspaceId) params.append('workspaceId', inputs.workspaceId);
        if (inputs.status) params.append('status', inputs.status);
        response = await fetch(`${baseUrl}/api/experiments?${params}`);
        break;

      case 'create':
        response = await fetch(`${baseUrl}/api/experiments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputs)
        });
        break;

      case 'start':
        response = await fetch(`${baseUrl}/api/experiments/${inputs.experimentId}/start`, {
          method: 'POST'
        });
        break;

      case 'startAll':
        // Get all experiments in workspace, then start each
        const listResp = await fetch(`${baseUrl}/api/experiments?workspaceId=${inputs.workspaceId}`);
        const experiments = await listResp.json();
        console.log(chalk.blue(`Starting ${experiments.length} experiments...`));
        for (const exp of experiments) {
          if (exp.status === 'Created' || exp.status === 'Paused') {
            await fetch(`${baseUrl}/api/experiments/${exp.id}/start`, { method: 'POST' });
            console.log(chalk.green(`  Started: ${exp.name}`));
          }
        }
        return;

      case 'stop':
        response = await fetch(`${baseUrl}/api/experiments/${inputs.experimentId}/stop`, {
          method: 'POST'
        });
        break;

      case 'compare':
        response = await fetch(`${baseUrl}/api/experiments/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experimentIds: inputs.experimentIds })
        });
        break;

      case 'listStrategies':
        const stratParams = inputs.category ? `?category=${inputs.category}` : '';
        response = await fetch(`${baseUrl}/api/experiments/strategies${stratParams}`);
        break;

      case 'recommend':
        // Get strategies and filter by suitability
        const stratResp = await fetch(`${baseUrl}/api/experiments/strategies`);
        const strategies = await stratResp.json();
        const suitable = strategies.filter(s =>
          s.suitableFor.includes(inputs.taskType)
        );
        if (jsonOutput) {
          console.log(JSON.stringify(suitable, null, 2));
        } else {
          console.log(chalk.blue(`\nRecommended strategies for ${inputs.taskType}:\n`));
          suitable.forEach((s, i) => {
            console.log(chalk.green(`${i + 1}. ${s.name} (${s.id})`));
            console.log(chalk.gray(`   Method: ${s.method}`));
            console.log(chalk.gray(`   Strengths: ${s.strengths.join(', ')}`));
          });
        }
        return;

      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        return;
    }

    if (!response.ok) {
      const error = await response.json();
      console.error(chalk.red(`Error: ${error.error || response.statusText}`));
      return;
    }

    const data = await response.json();

    if (jsonOutput) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      formatExperimentOutput(action, data);
    }

  } catch (error) {
    console.error(chalk.red(`Failed to invoke experiment-manager: ${error.message}`));
  }
}

function formatExperimentOutput(action, data) {
  switch (action) {
    case 'list':
      console.log(chalk.blue('\nExperiments:\n'));
      if (data.length === 0) {
        console.log(chalk.gray('  No experiments found'));
        return;
      }
      data.forEach(exp => {
        const statusColor = {
          'Created': chalk.gray,
          'Running': chalk.blue,
          'Completed': chalk.green,
          'Failed': chalk.red,
          'Paused': chalk.yellow
        }[exp.status] || chalk.white;

        console.log(`  ${chalk.bold(exp.name)} ${statusColor(`[${exp.status}]`)}`);
        console.log(chalk.gray(`    ID: ${exp.id}`));
        console.log(chalk.gray(`    Strategy: ${exp.strategyBlockId}`));
        if (exp.results) {
          console.log(chalk.gray(`    Fitness: ${exp.results.initialFitness.toFixed(3)} → ${exp.results.finalFitness.toFixed(3)} (+${exp.results.fitnessImprovementPercent.toFixed(1)}%)`));
        }
        console.log();
      });
      break;

    case 'create':
    case 'start':
    case 'stop':
      console.log(chalk.green(`\n✓ Experiment ${action === 'create' ? 'created' : action === 'start' ? 'started' : 'stopped'}`));
      console.log(chalk.gray(`  ID: ${data.id}`));
      console.log(chalk.gray(`  Status: ${data.status}`));
      break;

    case 'compare':
      console.log(chalk.blue('\nExperiment Comparison:\n'));
      console.log(chalk.green(`  Best: ${data.bestExperimentId}`));
      console.log(chalk.green(`  Recommended Strategy: ${data.recommendedStrategyId}\n`));

      console.log('  Rankings:');
      Object.entries(data.rankings).forEach(([id, rank]) => {
        console.log(`    ${id}:`);
        console.log(chalk.gray(`      Fitness: #${rank.fitnessRank}`));
        console.log(chalk.gray(`      Cost Efficiency: #${rank.costEfficiencyRank}`));
        console.log(chalk.gray(`      Overall: #${rank.overallRank}`));
      });
      break;

    case 'listStrategies':
      console.log(chalk.blue('\nAvailable Training Strategies:\n'));
      data.forEach(s => {
        console.log(chalk.bold(`  ${s.name}`));
        console.log(chalk.gray(`    ID: ${s.id}`));
        console.log(chalk.gray(`    Method: ${s.method} | Category: ${s.category}`));
        console.log(chalk.gray(`    Suitable for: ${s.suitableFor.join(', ')}`));
        console.log();
      });
      break;
  }
}
```

---

## Étape 6: Frontend (Types et Services)

### 6.1 Créer `experiment.types.ts`

**Fichier**: `frontend/src/types/experiment.types.ts`

```typescript
export type ExperimentStatus =
  | 'Created'
  | 'Running'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface ExperimentResults {
  initialFitness: number;
  finalFitness: number;
  fitnessImprovement: number;
  fitnessImprovementPercent: number;
  totalIterations: number;
  successfulIterations: number;
  successRate: number;
  totalCost: number;
  totalDuration: string;
  costEfficiency: number;
  timeEfficiency: number;
}

export interface Experiment {
  id: string;
  name: string;
  workspaceId: string;
  targetAgentId: string;
  strategyBlockId: string;
  status: ExperimentStatus;
  config: Record<string, unknown>;
  sessionIds: string[];
  results?: ExperimentResults;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface CreateExperimentRequest {
  name: string;
  workspaceId: string;
  agentId: string;
  strategyId: string;
  config?: Record<string, unknown>;
}

export interface StrategyInfo {
  id: string;
  name: string;
  method: string;
  category: string;
  suitableFor: string[];
  strengths: string[];
  weaknesses: string[];
  isSystem: boolean;
  isOverridable: boolean;
}

export interface ExperimentRanking {
  fitnessRank: number;
  costEfficiencyRank: number;
  timeEfficiencyRank: number;
  overallRank: number;
}

export interface ExperimentComparison {
  experiments: Experiment[];
  bestExperimentId: string;
  recommendedStrategyId: string;
  rankings: Record<string, ExperimentRanking>;
}
```

### 6.2 Créer `experimentService.ts`

**Fichier**: `frontend/src/services/experimentService.ts`

```typescript
import { api } from './api';
import type {
  Experiment,
  CreateExperimentRequest,
  StrategyInfo,
  ExperimentComparison
} from '../types/experiment.types';

class ExperimentService {
  async getExperiments(workspaceId?: string, status?: string): Promise<Experiment[]> {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    if (status) params.append('status', status);
    return api.get<Experiment[]>(`/experiments?${params}`);
  }

  async getExperiment(id: string): Promise<Experiment> {
    return api.get<Experiment>(`/experiments/${id}`);
  }

  async createExperiment(request: CreateExperimentRequest): Promise<Experiment> {
    return api.post<Experiment>('/experiments', request);
  }

  async startExperiment(id: string): Promise<Experiment> {
    return api.post<Experiment>(`/experiments/${id}/start`);
  }

  async stopExperiment(id: string): Promise<Experiment> {
    return api.post<Experiment>(`/experiments/${id}/stop`);
  }

  async deleteExperiment(id: string): Promise<void> {
    return api.delete(`/experiments/${id}`);
  }

  async getStrategies(category?: string): Promise<StrategyInfo[]> {
    const params = category ? `?category=${category}` : '';
    return api.get<StrategyInfo[]>(`/experiments/strategies${params}`);
  }

  async compareExperiments(experimentIds: string[]): Promise<ExperimentComparison> {
    return api.post<ExperimentComparison>('/experiments/compare', { experimentIds });
  }

  async startAllInWorkspace(workspaceId: string, parallel = true): Promise<void> {
    const experiments = await this.getExperiments(workspaceId);
    const toStart = experiments.filter(e =>
      e.status === 'Created' || e.status === 'Paused'
    );

    if (parallel) {
      await Promise.all(toStart.map(e => this.startExperiment(e.id)));
    } else {
      for (const exp of toStart) {
        await this.startExperiment(exp.id);
      }
    }
  }
}

export const experimentService = new ExperimentService();
```

### 6.3 Créer `experimentStore.ts`

**Fichier**: `frontend/src/store/experimentStore.ts`

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Experiment,
  StrategyInfo,
  CreateExperimentRequest,
  ExperimentComparison
} from '../types/experiment.types';
import { experimentService } from '../services/experimentService';

interface ExperimentState {
  experiments: Experiment[];
  strategies: StrategyInfo[];
  comparison: ExperimentComparison | null;
  selectedExperiment: Experiment | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadExperiments: (workspaceId?: string) => Promise<void>;
  loadStrategies: (category?: string) => Promise<void>;
  createExperiment: (request: CreateExperimentRequest) => Promise<Experiment>;
  startExperiment: (id: string) => Promise<void>;
  stopExperiment: (id: string) => Promise<void>;
  deleteExperiment: (id: string) => Promise<void>;
  compareExperiments: (ids: string[]) => Promise<void>;
  selectExperiment: (id: string) => void;
  clearError: () => void;
}

export const useExperimentStore = create<ExperimentState>()(
  devtools(
    (set, get) => ({
      experiments: [],
      strategies: [],
      comparison: null,
      selectedExperiment: null,
      isLoading: false,
      error: null,

      loadExperiments: async (workspaceId?: string) => {
        set({ isLoading: true, error: null });
        try {
          const experiments = await experimentService.getExperiments(workspaceId);
          set({ experiments, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load experiments',
            isLoading: false
          });
        }
      },

      loadStrategies: async (category?: string) => {
        set({ isLoading: true, error: null });
        try {
          const strategies = await experimentService.getStrategies(category);
          set({ strategies, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load strategies',
            isLoading: false
          });
        }
      },

      createExperiment: async (request: CreateExperimentRequest) => {
        set({ isLoading: true, error: null });
        try {
          const experiment = await experimentService.createExperiment(request);
          set(state => ({
            experiments: [experiment, ...state.experiments],
            isLoading: false
          }));
          return experiment;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create experiment',
            isLoading: false
          });
          throw error;
        }
      },

      startExperiment: async (id: string) => {
        try {
          const updated = await experimentService.startExperiment(id);
          set(state => ({
            experiments: state.experiments.map(e => e.id === id ? updated : e)
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to start experiment' });
        }
      },

      stopExperiment: async (id: string) => {
        try {
          const updated = await experimentService.stopExperiment(id);
          set(state => ({
            experiments: state.experiments.map(e => e.id === id ? updated : e)
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to stop experiment' });
        }
      },

      deleteExperiment: async (id: string) => {
        try {
          await experimentService.deleteExperiment(id);
          set(state => ({
            experiments: state.experiments.filter(e => e.id !== id)
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete experiment' });
        }
      },

      compareExperiments: async (ids: string[]) => {
        set({ isLoading: true, error: null });
        try {
          const comparison = await experimentService.compareExperiments(ids);
          set({ comparison, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to compare experiments',
            isLoading: false
          });
        }
      },

      selectExperiment: (id: string) => {
        const experiment = get().experiments.find(e => e.id === id) || null;
        set({ selectedExperiment: experiment });
      },

      clearError: () => set({ error: null })
    }),
    { name: 'experiment-store' }
  )
);
```

---

## Résumé des Fichiers

### Nouveaux Fichiers: 26 fichiers

**System Blocks (14):**
```
blocks/system/
├── experiment-manager.agent.block.json
├── training/
│   ├── iteration-runner.workflow.block.json
│   ├── reward-calculator.agent.block.json
│   ├── early-stopper.agent.block.json
│   └── metrics-aggregator.agent.block.json
└── strategies/
    ├── sft-strategy.workflow.block.json
    ├── rl-fitness-strategy.workflow.block.json
    ├── preference-strategy.workflow.block.json
    ├── execution-based-strategy.workflow.block.json
    ├── evolutionary-strategy.workflow.block.json
    ├── distillation-strategy.workflow.block.json
    ├── curriculum-strategy.workflow.block.json
    ├── self-play-strategy.workflow.block.json
    ├── neuro-symbolic-strategy.workflow.block.json
    └── moe-strategy.workflow.block.json
```

**Backend (5):**
```
backend/src/
├── Maestro.Domain/
│   ├── Entities/TrainingExperiment.cs
│   └── ValueObjects/ExperimentResults.cs
├── Maestro.Application/
│   ├── Interfaces/IExperimentRepository.cs
│   └── DTOs/ExperimentDto.cs
└── Maestro.Infrastructure/
    └── Experiments/FileSystemExperimentRepository.cs
```

**API (1):**
```
backend/src/Maestro.Api/Controllers/ExperimentsController.cs
```

**Frontend (3):**
```
frontend/src/
├── types/experiment.types.ts
├── services/experimentService.ts
└── store/experimentStore.ts
```

### Fichiers Modifiés: 3 fichiers

```
backend/src/Maestro.Api/Program.cs          # Ajouter registration IExperimentRepository
tools/maestro-cli/index.js                  # Ajouter commandes experiment
frontend/src/types/index.ts                 # Export experiment types
frontend/src/services/index.ts              # Export experiment service
frontend/src/store/index.ts                 # Export experiment store
```

---

## Vérification

### Build Backend
```bash
cd backend && dotnet build
```

### Build Frontend
```bash
cd frontend && npm run build
```

### Test CLI
```bash
cd tools/maestro-cli
node index.js experiment strategies
node index.js experiment recommend --agent my-agent --task code
node index.js experiment create -n "Test SFT" -w ws-1 -a agent-1 -s system:strategy-sft
node index.js experiment list
node index.js experiment start <exp-id>
```

### Test API
```bash
curl http://localhost:5000/api/experiments/strategies
curl http://localhost:5000/api/experiments
```

---

## Avantages de cette Architecture

| Aspect | Description |
|--------|-------------|
| **Philosophie** | 100% aligné avec "Tout est un Block" |
| **Extensibilité** | Nouvelle stratégie = nouveau fichier JSON |
| **Override** | L'utilisateur peut override n'importe quelle stratégie |
| **CLI-First** | CLI délègue à l'agent, agents utilisent le CLI |
| **Self-Improvement** | L'experiment-manager peut améliorer les stratégies |
| **Testabilité** | Chaque block est testable indépendamment |
| **Documentation** | Stratégies auto-documentées via metadata |
