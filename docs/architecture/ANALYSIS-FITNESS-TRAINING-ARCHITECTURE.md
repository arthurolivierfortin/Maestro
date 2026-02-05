# Analyse Architecture: Fitness Training & Research Team

> **Document de travail** - Ce document capture l'analyse en cours pour définir l'architecture de l'équipe d'entraînement IA basée sur un modèle de fitness.

**Date de début**: 2026-02-03
**Branche cible**: feat/azure-model-catalog
**Statut**: Analyse complétée - Recommandation prête

---

## 1. Contexte et Objectif

### 1.1 Question Centrale

Comment structurer Maestro pour permettre une **équipe d'IA autonome** qui:
- Entraîne des agents basés sur un modèle de fitness
- Crée et améliore des tools/agents automatiquement
- Fournit un système de documentation automatique
- Permet l'auto-amélioration et l'auto-entraînement

### 1.2 Le Modèle de Fitness

```
ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ

Où:
- P = Performance utile (succès sur tâche ciblée)
- S = Spécialisation (P / entropie des tâches)
- W = Composabilité (1 - hallucination_rate)
- C_norm = Coût économique normalisé
- C_compute = log(params) × FLOPs/token
- C_hw = α·VRAM + β·RAM + γ·GPU_requirement
- λ > 1 = pénalisation non-linéaire
```

**Philosophie**: Maximiser l'intelligence par unité d'énergie, pas la taille brute.

### 1.3 Les Deux Options Proposées Initialement

#### Option A: Feature Native Hardcodée

- L'équipe d'entraînement comme feature intégrée à l'app
- Workspace d'entraînement basé sur des sessions Foundry
- Documentation disponible directement dans l'app
- Tests automatisés intégrés
- Système de `blocks/system` pour les blocks système
- API `publish` pour le catalogue global

**Avantages**:
- Intégration profonde avec l'app
- UX cohérente
- Documentation centralisée

**Inconvénients**:
- Hardcode beaucoup de logique
- Difficile pour l'auto-entraînement
- Moins flexible

#### Option B: Repo Modulaire

- L'équipe d'entraînement dans un repo externe
- Session Foundry basée sur ce repo
- Workflows, agents, doc, évaluation dans le repo

**Avantages**:
- Modularité maximale
- Séparation des préoccupations

**Inconvénients**:
- App moins spécialisée
- Documentation dispersée

---

## 2. Analyse de l'Existant

### 2.1 Architecture Backend (Clean Architecture + DDD)

```
backend/src/
├── Maestro.Domain/           # Entités pures, Value Objects
├── Maestro.Application/      # Services, DTOs, Interfaces
├── Maestro.Infrastructure/   # Implémentations, Repositories
├── Maestro.Api/              # Controllers REST + SignalR Hubs
└── Maestro.Agents/           # Agents spécifiques
```

**Patterns clés**:
- State Machine pour les sessions/runs
- Event Sourcing avec SessionEvent
- Value Objects pour type safety (SessionId, ProjectId, etc.)
- Composite Pattern pour l'évaluation qualité

### 2.2 Entités Principales

| Entité | Rôle |
|--------|------|
| `BlockDefinition` | Unité atomique d'exécution |
| `Project` | Conteneur isolé avec config |
| `FoundrySession` | Sandbox de développement avec training |
| `ProjectSession` | Environnement d'exécution projet |
| `TrainingRun` | Exécution de training avec itérations |
| `TrainingConfiguration` | Paramètres de training |
| `Sandbox` | Environnement isolé pour tests |

### 2.3 Système de Sessions Actuel

**FoundrySession** (pour développement):
```
Created → Running → Paused → Completed/Failed/Stopped
         ↓
    Training: Idle → Running → Paused → Completed/Stopped
```

**ProjectSession** (pour production):
```
Created → Running → Paused → Completed/Failed/Cancelled/Stopped
         ↓
    Commands, Agents, Files, Tests, Commits
```

### 2.4 Système d'Évaluation Existant

```
QualityEvaluationConfig
    ↓
CompositeQualityEvaluator
    ├→ HeuristicQualityEvaluator (règles)
    │   ├→ CheckOutputNotEmpty
    │   ├→ CheckJsonValid
    │   └→ CheckSchemaCompliance
    │
    └→ LLMQualityEvaluator (IA)
        └→ Prompt + Critères → Score
```

**Output**: `QualityScore` avec:
- Score (0-100)
- Method (Heuristic, LLM, Combined)
- Criteria avec scores individuels
- Confidence (0-1)

### 2.5 Ce qui MANQUE pour le Modèle Fitness

| Dimension Fitness | État Actuel | À Implémenter |
|-------------------|-------------|---------------|
| P (Performance) | ✅ QualityScore existe | Améliorer avec critères spécifiques tâche |
| S (Spécialisation) | ❌ Manquant | Tracker entropie des tâches par agent |
| W (Composabilité) | ❌ Manquant | Mesurer hallucination rate, format compliance |
| C_norm (Coût $) | ✅ TotalCostUsd existe | OK |
| C_compute | ❌ Manquant | Ajouter FLOPs, params au ModelUsageMetrics |
| C_hw | ❌ Manquant | Ajouter VRAM, RAM, GPU tracking |
| WorkflowFitness | ❌ Manquant | Agrégation avec contributions pondérées |
| PipelineBonus | ❌ Manquant | Bonus diversité pour workflows multi-modèles |

### 2.6 Frontend Architecture

- React 18 + TypeScript
- Zustand pour state management
- 13 types de blocks (atomic + composite)
- Stores: blockStore, trainingStore, testStore, metricsStore
- Services: API, SignalR, Training, Test, Metrics

### 2.7 Branche Training-Metrics (Commits récents)

La branche `feat/MAESTRO-7-training-metrics-workflow-optimization-system` contient:
- Zustand stores pour gestion de sessions avec catégories
- Model Capability Tests components
- Context block type
- Interactive session management

**Note**: Les catégories dynamiques de sessions ne sont PAS encore implémentées dans la branche actuelle.

---

## 3. Recommandation Architecturale

### 3.1 Option Recommandée: Architecture Hybride (Option C)

Après analyse approfondie, je recommande une **architecture hybride** qui combine:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MAESTRO CORE (Générique)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Blocks     │  │   Sessions   │  │   Workflows  │                  │
│  │   Engine     │  │   Manager    │  │   Executor   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Training   │  │   Metrics    │  │   Fitness    │ ← NOUVEAU        │
│  │   System     │  │   Collector  │  │   Calculator │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  SYSTEM       │    │  USER         │    │  EXTERNAL     │
│  BLOCKS       │    │  BLOCKS       │    │  REPOS        │
│               │    │               │    │               │
│ • Evaluator   │    │ • Custom      │    │ • Research    │
│ • Trainer     │    │   agents      │    │   Team repo   │
│ • Publisher   │    │ • Domain      │    │ • Domain      │
│ • Documenter  │    │   tools       │    │   specific    │
│ • Tester      │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │    WORKSPACES     │
                    │                   │
                    │ • Training WS     │
                    │ • Production WS   │
                    │ • Research WS     │
                    └───────────────────┘
```

### 3.2 Composants de l'Architecture

#### A. Maestro Core (Reste Générique)

Le core reste un **framework d'orchestration** sans logique spécifique:
- Block Engine: Exécution des blocks
- Session Manager: Gestion des sessions Foundry/Project
- Workflow Executor: Orchestration des workflows
- Training System: Infrastructure de training (existe déjà)
- Metrics Collector: Collecte de métriques (existe déjà)
- **Fitness Calculator**: NOUVEAU - Calcule le fitness selon la formule

#### B. System Blocks (Natifs mais Overridables)

Blocks fournis par défaut dans `blocks/system/`:

```yaml
# blocks/system/evaluator-agent/definition.json
{
  "id": "system:fitness-evaluator",
  "name": "Fitness Evaluator",
  "blockType": "agent",
  "isSystem": true,      # Flag système
  "overridable": true,   # Peut être remplacé
  "description": "Évalue le fitness d'un agent selon le modèle P×S×W / (C)^λ",
  "capabilities": ["evaluation", "fitness", "metrics"]
}
```

Blocks système prévus:
- `system:fitness-evaluator` - Calcule le fitness
- `system:trainer-agent` - Orchestre l'entraînement
- `system:publisher-agent` - Publie au catalogue
- `system:documenter-agent` - Génère documentation
- `system:tester-agent` - Exécute les tests
- `system:researcher-agent` - Recherche et amélioration

#### C. Workspaces (Nouveau Concept)

Un **Workspace** regroupe plusieurs sessions et projets:

```typescript
interface Workspace {
  id: string;
  name: string;
  type: 'training' | 'production' | 'research' | 'custom';
  sessions: SessionId[];        // Sessions Foundry liées
  projects: ProjectId[];        // Projets liés
  catalog: CatalogRef;          // Catalogue local ou global
  settings: WorkspaceSettings;
}
```

**Training Workspace** (pré-configuré):
- Sessions Foundry pour développement
- Tests automatisés
- Métriques fitness
- Publication vers catalogue

**Production Workspace**:
- Projets réels
- Agents du catalogue
- Monitoring

#### D. External Repos (Optionnel)

Pour des cas spécialisés, un repo externe peut définir:
- Ses propres agents de recherche
- Ses propres tests
- Sa propre documentation
- Son propre système d'évaluation custom

Le repo est **bindé** comme Project avec accès aux blocks système.

### 3.3 Implémentation du Fitness Model

#### A. Nouvelles Entités Domain

```csharp
// backend/src/Maestro.Domain/ValueObjects/FitnessScore.cs
public class FitnessScore
{
    public double Performance { get; init; }      // P: 0-1
    public double Specialization { get; init; }   // S: P/entropy
    public double Composability { get; init; }    // W: 1-hallucination_rate
    public double EconomicCost { get; init; }     // C_norm
    public double ComputeCost { get; init; }      // C_compute
    public double HardwareCost { get; init; }     // C_hw
    public double Lambda { get; init; }           // λ exponent

    public double TotalFitness =>
        (Performance * Specialization * Composability) /
        Math.Pow(EconomicCost * ComputeCost * HardwareCost, Lambda);
}

// backend/src/Maestro.Domain/ValueObjects/ModelProfile.cs
public class ModelProfile
{
    public string ModelId { get; init; }
    public long ParameterCount { get; init; }     // Nombre de paramètres
    public double FLOPsPerToken { get; init; }    // FLOPs estimés
    public int VRAMRequirementMB { get; init; }   // VRAM nécessaire
    public int RAMRequirementMB { get; init; }    // RAM nécessaire
    public bool RequiresGPU { get; init; }
    public string[] SupportedTasks { get; init; } // Tâches supportées
}

// backend/src/Maestro.Domain/ValueObjects/TaskEntropy.cs
public class TaskEntropy
{
    public string AgentId { get; init; }
    public Dictionary<string, int> TaskDistribution { get; init; }
    public double Entropy => CalculateEntropy();

    private double CalculateEntropy()
    {
        // Shannon entropy: -Σ p(x) * log(p(x))
        var total = TaskDistribution.Values.Sum();
        return TaskDistribution.Values
            .Select(count => (double)count / total)
            .Where(p => p > 0)
            .Sum(p => -p * Math.Log2(p));
    }
}
```

#### B. Service de Calcul Fitness

```csharp
// backend/src/Maestro.Application/Interfaces/IFitnessService.cs
public interface IFitnessService
{
    Task<FitnessScore> CalculateModelFitness(
        string modelId,
        string taskType,
        WorkflowExecutionMetrics metrics,
        CancellationToken ct);

    Task<WorkflowFitnessScore> CalculateWorkflowFitness(
        string workflowId,
        IEnumerable<WorkflowExecutionMetrics> iterations,
        CancellationToken ct);

    Task<ModelProfile> GetModelProfile(string modelId, CancellationToken ct);
    Task UpdateTaskEntropy(string agentId, string taskType, CancellationToken ct);
}
```

#### C. Intégration dans Training

```csharp
// Modification de TrainingIteration pour inclure FitnessScore
public class TrainingIteration
{
    // Existant...
    public WorkflowExecutionMetrics? Metrics { get; set; }

    // Nouveau
    public FitnessScore? FitnessScore { get; set; }
}

// Modification de TrainingRunMetrics
public class TrainingRunMetrics
{
    // Existant...
    public double AverageQualityScore { get; init; }

    // Nouveau
    public double AverageFitnessScore { get; init; }
    public double FitnessVariance { get; init; }
    public FitnessBreakdown FitnessBreakdown { get; init; }
}
```

### 3.4 Structure des Sessions

#### A. Nouvelle Configuration Session

```csharp
// Modification de FoundrySessionConfig
public class FoundrySessionConfig
{
    public string? DraftId { get; set; }
    public TrainingRunConfig Training { get; set; }
    public EvaluationConfig Evaluation { get; set; }

    // NOUVEAU
    public FitnessConfig Fitness { get; set; } = FitnessConfig.Default;
    public SessionSource Source { get; set; } = SessionSource.Sandbox;
}

public class FitnessConfig
{
    public bool Enabled { get; set; } = true;
    public double Lambda { get; set; } = 1.5;  // Pénalisation coûts
    public double MinFitnessThreshold { get; set; } = 0.5;
    public FitnessWeights Weights { get; set; } = FitnessWeights.Default;
}

public enum SessionSource
{
    Sandbox,    // Image sandbox isolée
    Repository  // Repo bindé (Docker volume)
}
```

#### B. Gestion Repo vs Sandbox

```csharp
public class SessionSource
{
    public SessionSourceType Type { get; init; }

    // Pour Sandbox
    public string? SandboxImage { get; init; }

    // Pour Repository
    public string? RepositoryPath { get; init; }
    public bool MountAsVolume { get; init; }
    public string? DockerBindPath { get; init; }
}
```

### 3.5 CLI Extensions

```bash
# Fitness commands
maestro fitness calculate <agent-id> --task <task-type>
maestro fitness profile <model-id>
maestro fitness leaderboard --sort fitness --limit 20

# Workspace commands
maestro workspace create --name "Research" --type training
maestro workspace list
maestro workspace add-session <workspace-id> <session-id>
maestro workspace add-project <workspace-id> <project-id>

# System blocks
maestro blocks --system                    # Liste les blocks système
maestro blocks override <system-block-id>  # Override un block système

# Training avec fitness
maestro training create \
  --name "Fitness Training" \
  --workflow <id> \
  --iterations 50 \
  --fitness-enabled \
  --fitness-lambda 1.5 \
  --min-fitness 0.6
```

---

## 4. Plan d'Implémentation

### Phase 1: Infrastructure Fitness (2-3 semaines)

1. **Entités Domain**:
   - [ ] `FitnessScore` value object
   - [ ] `ModelProfile` value object
   - [ ] `TaskEntropy` value object
   - [ ] `FitnessConfig` configuration

2. **Services**:
   - [ ] `IFitnessService` interface
   - [ ] `FitnessService` implémentation
   - [ ] `ModelProfileRepository` pour stocker les profils modèles

3. **Intégration Training**:
   - [ ] Ajouter `FitnessScore` à `TrainingIteration`
   - [ ] Calculer fitness après chaque itération
   - [ ] Ajouter métriques fitness au `TrainingRunMetrics`

### Phase 2: System Blocks (2-3 semaines)

1. **Structure**:
   - [ ] Créer dossier `blocks/system/`
   - [ ] Flag `isSystem` dans `BlockDefinition`
   - [ ] Logique de chargement blocks système

2. **Blocks Initiaux**:
   - [ ] `system:fitness-evaluator`
   - [ ] `system:trainer-agent`
   - [ ] `system:tester-agent`

3. **Override Mechanism**:
   - [ ] Détection d'override utilisateur
   - [ ] Merge de configurations

### Phase 3: Workspaces avec Isolation (3 semaines)

1. **Entités**:
   - [ ] `Workspace` entity
   - [ ] `WorkspaceSettings`
   - [ ] `WorkspaceIsolation` configuration
   - [ ] Relations Session/Project

2. **Infrastructure Docker**:
   - [ ] Création de réseaux Docker par workspace
   - [ ] Gestion des limites de ressources (CPU, RAM)
   - [ ] Isolation réseau entre workspaces

3. **Workspace Gateway**:
   - [ ] API de communication inter-workspace
   - [ ] Permissions et contrôle d'accès
   - [ ] Promotion d'agents entre workspaces

4. **API**:
   - [ ] CRUD Workspaces
   - [ ] Configuration isolation
   - [ ] Association sessions/projets

5. **CLI**:
   - [ ] Commandes workspace
   - [ ] Commandes isolation
   - [ ] Commandes permissions

### Phase 4: Session Source (1-2 semaines)

1. **Configuration**:
   - [ ] `SessionSource` enum et config
   - [ ] Détection auto repo vs sandbox

2. **Docker Integration**:
   - [ ] Volume binding pour repos
   - [ ] Image sandbox pour isolation

### Phase 5: Agent Orchestrateur (2-3 semaines)

1. **System Block**:
   - [ ] `system:orchestrator-agent` définition
   - [ ] Configuration des règles de promotion
   - [ ] Configuration des règles de rollback

2. **Workflow de Promotion**:
   - [ ] Détection des agents qualifiés (fitness > threshold)
   - [ ] Promotion Research → Staging
   - [ ] Tests d'intégration automatiques
   - [ ] Promotion Staging → Production

3. **Gestion du Rollback**:
   - [ ] Détection de dégradation fitness
   - [ ] Rollback automatique
   - [ ] Notifications et alertes

4. **Mise à jour des Sessions**:
   - [ ] Mise à jour des sessions Production avec nouveaux agents
   - [ ] Gestion des versions d'agents
   - [ ] Historique des déploiements

5. **CLI**:
   - [ ] Commandes orchestrator
   - [ ] Commandes de promotion manuelle
   - [ ] Commandes de rollback

### Phase 6: Research Team Integration (2-3 semaines)

1. **System Agents**:
   - [ ] `system:researcher-agent`
   - [ ] `system:documenter-agent`
   - [ ] `system:publisher-agent`

2. **Auto-Improvement Loop**:
   - [ ] Workflow d'auto-amélioration
   - [ ] Documentation automatique
   - [ ] Tests automatiques
   - [ ] Intégration avec l'orchestrateur

---

## 5. Avantages de cette Architecture

### 5.1 Respect de la Philosophie Maestro

✅ **Spécialisation**: Le fitness model favorise les petits modèles spécialisés
✅ **Orchestration**: Les workflows combinent des agents spécialisés
✅ **Blocks comme unité de base**: Tout est un block (même système)
✅ **CLI-first**: Tout accessible via CLI

### 5.2 Flexibilité

✅ **Modularité**: System blocks overridables
✅ **Extensibilité**: Repos externes supportés
✅ **Workspaces**: Groupement flexible de ressources

### 5.3 Auto-Amélioration

✅ **Même infrastructure**: Les agents système utilisent la même infra que les agents utilisateur
✅ **Feedback loop**: Les agents peuvent s'évaluer et s'améliorer
✅ **Documentation auto**: Génération automatique de docs

### 5.4 Évolutivité

✅ **Séparation claire**: Core générique vs logique spécialisée
✅ **Multi-domaine**: Support futur pour Maestro Coding, Maestro Data, etc.
✅ **Catalogue unifié**: Publication centralisée

---

## 6. Questions Résolues

| Question | Réponse |
|----------|---------|
| Sessions repo vs sandbox? | **Les deux**: `SessionSource` permet de choisir |
| Où mettre l'équipe de recherche? | **System blocks** + **Workspace dédié** |
| Comment gérer la documentation? | **system:documenter-agent** génère la doc |
| Comment faire l'auto-amélioration? | **Research Team workflow** utilise les mêmes blocks |
| Comment intégrer le fitness? | **FitnessService** calcule après chaque itération |
| Hardcodé ou modulaire? | **Hybride**: Core générique + System blocks spécialisés |
| Workspaces isolés dans Docker? | **Optionnel**: Isolation réseau + ressources configurable |
| Communication inter-workspace? | **Workspace Gateway**: API contrôlée avec permissions |
| Déploiement automatique? | **system:orchestrator**: Promotion basée sur fitness |
| Rollback automatique? | **Orchestrateur**: Détection dégradation + rollback auto |

---

## 7. Prochaines Étapes

1. **Valider cette architecture** avec review
2. **Créer MAESTRO-PHILOSOPHY-V2.md** avec la vision solidifiée
3. **Commencer Phase 1**: Infrastructure Fitness
4. **Définir les interfaces** des System Blocks

---

## 8. Journal d'Analyse

### Session 1 - 2026-02-03

**Documents analysés**:
- GUIDE-AI-CLI-REFERENCE.md - CLI complet
- FULL-PIPELINE-GUIDE.md - Pipeline Foundry → Project
- MAESTRO-PHILOSOPHY.md - Philosophie de base

**Code analysé**:
- Backend complet (Clean Architecture + DDD)
- Frontend complet (React + Zustand)
- Sessions (FoundrySession, ProjectSession)
- Training (TrainingRun, TrainingConfiguration)
- Evaluation (QualityEvaluator)
- Sandbox (environnement isolé)

**Décision architecturale**: Option C - Architecture Hybride
- Core générique + System Blocks + Workspaces + External Repos optionnels

**Prêt pour**: Création de MAESTRO-PHILOSOPHY-V2.md
