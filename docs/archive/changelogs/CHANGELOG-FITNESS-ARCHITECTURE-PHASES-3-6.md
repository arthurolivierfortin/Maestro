# Architecture d'Entraînement Autonome Basée sur la Fitness

## Journal des Modifications - Phases 3 à 6

**Date**: 3 février 2026
**Version**: 1.0.0
**Branche**: `feat/azure-model-catalog`

---

## Résumé Exécutif

Ce document détaille les modifications apportées au système Maestro pour implémenter les phases 3 à 6 de l'architecture d'entraînement autonome basée sur la fitness. Ces phases établissent l'infrastructure nécessaire pour:

- Gérer des espaces de travail isolés avec contrôle des permissions
- Configurer les sessions avec des sources sandbox ou repository
- Orchestrer automatiquement la promotion d'agents entre environnements
- Permettre l'auto-amélioration des agents via une équipe de recherche automatisée

---

## Phase 3: Espaces de Travail avec Isolation

### Objectif

Implémenter un système de groupement par espaces de travail avec isolation Docker optionnelle et contrôle des permissions inter-espaces.

### Nouveaux Fichiers

| Fichier | Description |
|---------|-------------|
| `backend/src/Maestro.Domain/Entities/Workspace.cs` | Entité de domaine pour les espaces de travail |
| `backend/src/Maestro.Domain/ValueObjects/WorkspaceIsolation.cs` | Configuration d'isolation (réseau, ressources, permissions) |
| `backend/src/Maestro.Application/Interfaces/IWorkspaceService.cs` | Interface de service |
| `backend/src/Maestro.Application/Interfaces/IWorkspaceGateway.cs` | Gateway pour opérations inter-espaces |
| `backend/src/Maestro.Application/DTOs/WorkspaceDto.cs` | DTOs de transfert |
| `backend/src/Maestro.Infrastructure/Workspaces/WorkspaceService.cs` | Implémentation du service |
| `backend/src/Maestro.Infrastructure/Workspaces/WorkspaceGateway.cs` | Implémentation du gateway |
| `backend/src/Maestro.Infrastructure/Workspaces/FileSystemWorkspaceRepository.cs` | Persistance JSON |
| `backend/src/Maestro.Api/Controllers/WorkspacesController.cs` | Contrôleur API REST |
| `frontend/src/types/workspace.types.ts` | Types TypeScript |
| `frontend/src/services/workspaceService.ts` | Service API client |
| `frontend/src/store/workspaceStore.ts` | Store Zustand |

### Types d'Espaces de Travail

```csharp
public enum WorkspaceType
{
    Research,    // Expérimentation libre
    Training,    // Entraînement des agents
    Staging,     // Tests d'intégration
    Production,  // Environnement de production
    Custom       // Configuration personnalisée
}
```

### Configuration d'Isolation

```csharp
public record WorkspaceIsolation
{
    public bool Enabled { get; init; }
    public NetworkConfig? Network { get; init; }      // Réseau Docker
    public WorkspaceResourceLimits? Resources { get; init; }  // CPU, RAM, Storage
    public WorkspacePermissions Permissions { get; init; }    // Permissions inter-espaces
}
```

### Permissions Inter-Espaces

| Permission | Description |
|------------|-------------|
| `CanReadFrom` | Espaces depuis lesquels on peut lire les métriques |
| `CanWriteTo` | Espaces vers lesquels on peut écrire |
| `CanPromoteTo` | Espaces vers lesquels on peut promouvoir des agents |
| `AllowReadFrom` | Espaces autorisés à lire depuis cet espace |
| `AllowWriteFrom` | Espaces autorisés à écrire vers cet espace |

### Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/workspaces` | Liste tous les espaces |
| GET | `/api/workspaces/{id}` | Détails d'un espace |
| POST | `/api/workspaces` | Crée un espace |
| PUT | `/api/workspaces/{id}` | Met à jour un espace |
| DELETE | `/api/workspaces/{id}` | Supprime un espace |
| POST | `/api/workspaces/{id}/sessions` | Ajoute une session |
| POST | `/api/workspaces/{id}/projects` | Ajoute un projet |
| POST | `/api/workspaces/{id}/pause` | Pause l'espace |
| POST | `/api/workspaces/{id}/resume` | Reprend l'espace |
| GET | `/api/workspaces/topology` | Topologie des espaces |
| POST | `/api/workspaces/{id}/promote` | Promeut un agent |

### Commandes CLI

```bash
# Gestion des espaces
maestro workspace                    # Liste les espaces
maestro workspace info <id>          # Détails d'un espace
maestro workspace create --name "Dev" --type research --isolated
maestro workspace delete <id>

# Sessions et projets
maestro workspace add-session <ws-id> <session-id>
maestro workspace add-project <ws-id> <project-id>

# Permissions et topologie
maestro workspace permissions <id> --promote-to staging,production
maestro workspace topology

# Promotion d'agents
maestro workspace promote --source research --target staging --agent agent-123
```

---

## Phase 4: Configuration des Sources de Session

### Objectif

Permettre aux sessions d'utiliser soit des sandboxes isolées, soit des repositories locaux montés via Docker.

### Modifications de `FoundrySessionConfig.cs`

```csharp
public class FoundrySessionConfig
{
    public SessionSource Source { get; set; } = SessionSource.Sandbox;
    public RepositorySourceConfig? RepositoryConfig { get; set; }
    // ... autres propriétés existantes
}

public enum SessionSource
{
    Sandbox,     // Container isolé temporaire (défaut)
    Repository   // Montage de volume Docker
}

public enum RepositoryAccessLevel
{
    ReadOnly,    // Lecture seule
    Controlled,  // Écriture contrôlée avec staging
    Full         // Accès complet (à utiliser avec précaution)
}
```

### Configuration Repository

```csharp
public class RepositorySourceConfig
{
    public string RepositoryPath { get; set; }      // Chemin sur l'hôte
    public string DockerBindPath { get; set; }      // Chemin dans le container
    public RepositoryAccessLevel AccessLevel { get; set; }
    public string? Branch { get; set; }              // Branche à checkout
    public IList<string> ExcludePatterns { get; set; }  // Fichiers exclus
}
```

### Patterns d'Exclusion par Défaut

```csharp
ExcludePatterns = new List<string>
{
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "secrets/"
}
```

### Commandes CLI

```bash
# Session sandbox (défaut)
maestro session create --project proj-123 --source sandbox

# Session avec repository
maestro session create --project proj-123 \
  --source repository \
  --repository-path /path/to/repo \
  --access-level controlled \
  --branch feature/my-feature
```

---

## Phase 5: Agent Orchestrateur

### Objectif

Automatiser la promotion d'agents entre espaces de travail en fonction de leur score de fitness.

### Bloc Système Orchestrateur

**Fichier**: `blocks/system/orchestrator-agent.agent.block.json`

```json
{
  "id": "system:orchestrator",
  "name": "Workspace Orchestrator",
  "capabilities": [
    "cross-workspace-communication",
    "agent-promotion",
    "fitness-monitoring",
    "rollback-management"
  ]
}
```

### Règles de Promotion

| De | Vers | Fitness Min | Conditions |
|----|------|-------------|------------|
| Research | Staging | 70% | Tests passés, pas de régressions |
| Staging | Production | 85% | Tests d'intégration, 24h en staging |

### Règles de Rollback

| Seuil | Action |
|-------|--------|
| Baisse fitness > 10% | Rollback automatique |
| Taux d'erreur > 5% | Rollback automatique |
| Augmentation latence > 50% | Alerte + rollback optionnel |

### Nouveaux Fichiers

| Fichier | Description |
|---------|-------------|
| `backend/src/Maestro.Application/Interfaces/IOrchestratorService.cs` | Interface avec types |
| `backend/src/Maestro.Infrastructure/Orchestration/OrchestratorService.cs` | Implémentation |
| `backend/src/Maestro.Api/Controllers/OrchestratorController.cs` | Contrôleur API |

### Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/orchestrator/status` | Statut de l'orchestrateur |
| GET | `/api/orchestrator/pending` | Promotions en attente |
| POST | `/api/orchestrator/promote` | Promouvoir un agent |
| POST | `/api/orchestrator/rollback` | Rollback d'un agent |
| GET | `/api/orchestrator/history` | Historique des opérations |
| GET | `/api/orchestrator/config` | Configuration |
| PUT | `/api/orchestrator/config` | Modifier la configuration |
| POST | `/api/orchestrator/auto-promote` | Activer/désactiver auto-promotion |
| POST | `/api/orchestrator/monitor` | Lancer un cycle de monitoring |

### Commandes CLI

```bash
# Statut et monitoring
maestro orchestrator                    # Statut
maestro orchestrator pending            # Promotions en attente
maestro orchestrator monitor            # Cycle de monitoring manuel

# Opérations
maestro orchestrator promote --agent agent-123 --from research --to staging
maestro orchestrator promote --agent agent-123 --from staging --to production --force
maestro orchestrator rollback --agent agent-123 --workspace production --to-version v1.0.0

# Configuration
maestro orchestrator config
maestro orchestrator config set --min-fitness 0.8
maestro orchestrator auto-promote --enable
maestro orchestrator history --workspace staging --limit 10
```

---

## Phase 6: Intégration de l'Équipe de Recherche

### Objectif

Créer un pipeline d'auto-amélioration complètement automatisé utilisant plusieurs agents spécialisés.

### Architecture du Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│  Researcher │ -> │   Trainer   │ -> │   Tester    │ -> │ Fitness Evaluator│
└─────────────┘    └─────────────┘    └─────────────┘    └──────────────────┘
                                                                   │
                                          ┌────────────────────────┼────────────────────────┐
                                          │                        │                        │
                                          ▼                        │                        ▼
                                   ┌─────────────┐                 │                 ┌─────────────┐
                                   │ Documenter  │           Pass  │  Fail           │  Researcher │
                                   └─────────────┘                 │                 │  (retry)    │
                                          │                        │                 └─────────────┘
                                          ▼                        │
                                   ┌─────────────┐                 │
                                   │  Publisher  │ <───────────────┘
                                   └─────────────┘
```

### Nouveaux Blocs Système

#### 1. Researcher Agent
**Fichier**: `blocks/system/researcher-agent.agent.block.json`

| Capacité | Description |
|----------|-------------|
| `performance-analysis` | Analyse des performances |
| `pattern-detection` | Détection de patterns d'erreur |
| `hypothesis-generation` | Génération d'hypothèses d'amélioration |
| `improvement-proposals` | Propositions d'amélioration |

#### 2. Documenter Agent
**Fichier**: `blocks/system/documenter-agent.agent.block.json`

| Capacité | Description |
|----------|-------------|
| `documentation-generation` | Génération de documentation |
| `api-reference` | Référence API |
| `usage-examples` | Exemples d'utilisation |
| `changelog-creation` | Création de changelogs |

#### 3. Publisher Agent
**Fichier**: `blocks/system/publisher-agent.agent.block.json`

| Capacité | Description |
|----------|-------------|
| `catalog-publishing` | Publication au catalogue |
| `version-management` | Gestion des versions |
| `quality-gates` | Validation des critères qualité |
| `distribution` | Distribution |

#### 4. Research Team Workflow
**Fichier**: `blocks/system/research-team-workflow.workflow.block.json`

Workflow complet orchestrant tous les agents de l'équipe de recherche.

### Service de l'Équipe de Recherche

**Interface**: `IResearchTeamService`

```csharp
public interface IResearchTeamService
{
    Task<ResearchCycleResult> StartResearchCycleAsync(ResearchCycleRequest request, CancellationToken ct);
    Task<ResearchCycleStatus> GetCycleStatusAsync(string cycleId, CancellationToken ct);
    Task StopCycleAsync(string cycleId, CancellationToken ct);
    Task<IReadOnlyList<ResearchCycleResult>> GetHistoryAsync(string? agentId, int limit, CancellationToken ct);
    Task<IReadOnlyList<ResearchProposal>> GetPendingProposalsAsync(string? agentId, CancellationToken ct);
    Task<bool> ApproveProposalAsync(string proposalId, string? approvedBy, CancellationToken ct);
    Task<bool> RejectProposalAsync(string proposalId, string reason, string? rejectedBy, CancellationToken ct);
}
```

### Phases du Cycle de Recherche

| Phase | Description |
|-------|-------------|
| `Researching` | Analyse et identification des opportunités |
| `Training` | Entraînement avec les améliorations proposées |
| `Testing` | Exécution des tests |
| `Evaluating` | Évaluation du score de fitness |
| `Documenting` | Génération de la documentation |
| `Publishing` | Publication au catalogue |
| `AnalyzingFailure` | Analyse des échecs pour retry |

### Types de Propositions

| Type | Description |
|------|-------------|
| `PromptOptimization` | Optimisation des prompts |
| `ConfigurationChange` | Modification de configuration |
| `ArchitecturalChange` | Changement architectural |
| `ToolAddition` | Ajout d'outils |
| `PerformanceOptimization` | Optimisation des performances |
| `CostReduction` | Réduction des coûts |

### Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/research/cycles` | Démarrer un cycle |
| GET | `/api/research/cycles/{id}/status` | Statut d'un cycle |
| POST | `/api/research/cycles/{id}/stop` | Arrêter un cycle |
| GET | `/api/research/history` | Historique |
| GET | `/api/research/proposals` | Propositions en attente |
| POST | `/api/research/proposals/{id}/approve` | Approuver |
| POST | `/api/research/proposals/{id}/reject` | Rejeter |
| GET | `/api/research/config` | Configuration |
| PUT | `/api/research/config` | Modifier configuration |

### Commandes CLI

```bash
# Démarrer un cycle de recherche
maestro research start --agent my-agent
maestro research start --agent my-agent --target 0.9 --iterations 100
maestro research start --agent my-agent --goal "Améliorer la qualité" --auto-publish

# Gestion des cycles
maestro research status cycle-123
maestro research stop cycle-123
maestro research history --agent my-agent

# Gestion des propositions
maestro research proposals
maestro research approve proposal-123
maestro research reject proposal-123 --reason "Non aligné avec les objectifs"

# Configuration
maestro research config
maestro research config set --threshold 0.85 --auto-approve
```

---

## Modifications du Fichier Program.cs

### Enregistrement des Services

```csharp
// Phase 3: Services d'espaces de travail
builder.Services.AddSingleton<IWorkspaceRepository>(sp =>
    new FileSystemWorkspaceRepository(workspaceFolder, logger));
builder.Services.AddScoped<IWorkspaceService, WorkspaceService>();
builder.Services.AddScoped<IWorkspaceGateway, WorkspaceGateway>();

// Phase 5: Service orchestrateur
builder.Services.AddScoped<IOrchestratorService, OrchestratorService>();

// Phase 6: Service équipe de recherche
builder.Services.AddScoped<IResearchTeamService, ResearchTeamService>();
```

---

## Modifications du Frontend

### Nouveaux Types TypeScript

**`workspace.types.ts`**:
- `Workspace`, `WorkspaceType`, `WorkspaceStatus`
- `WorkspaceIsolation`, `WorkspacePermissions`, `NetworkConfig`
- `WorkspaceTopology`, `WorkspaceNode`, `WorkspaceEdge`
- `PromotionResult`, `CreateWorkspaceRequest`, `UpdateWorkspaceRequest`

### Nouveaux Services

**`workspaceService.ts`**:
- CRUD complet pour les espaces de travail
- Gestion des sessions/projets
- Topologie et promotion

### Nouveau Store Zustand

**`workspaceStore.ts`**:
- État: `workspaces`, `currentWorkspace`, `topology`, `lastPromotion`
- Actions: `loadWorkspaces`, `createWorkspace`, `promoteAgent`, etc.

---

## Résumé des Fichiers

### Fichiers Créés (27)

| Catégorie | Nombre | Fichiers |
|-----------|--------|----------|
| Blocs Système | 5 | orchestrator, researcher, documenter, publisher, research-workflow |
| Interfaces | 3 | IOrchestratorService, IResearchTeamService, IWorkspaceGateway |
| Services | 3 | OrchestratorService, ResearchTeamService, WorkspaceGateway |
| Contrôleurs | 2 | OrchestratorController, ResearchTeamController |
| DTOs | 1 | SessionSourceDto |
| Frontend Types | 1 | workspace.types.ts |
| Frontend Services | 1 | workspaceService.ts |
| Frontend Stores | 1 | workspaceStore.ts |

### Fichiers Modifiés (5)

| Fichier | Modifications |
|---------|---------------|
| `Program.cs` | Enregistrement des nouveaux services |
| `FoundrySessionConfig.cs` | Ajout SessionSource et RepositorySourceConfig |
| `frontend/src/types/index.ts` | Export des types workspace |
| `frontend/src/services/index.ts` | Export du service workspace |
| `frontend/src/store/index.ts` | Export du store workspace |
| `tools/maestro-cli/index.js` | Commandes workspace, orchestrator, research |

---

## Tests et Validation

### Compilation

```bash
# Backend
cd backend && dotnet build
# Résultat: 0 Error(s)

# Frontend
cd frontend && npm run build
# Résultat: Compilation TypeScript réussie
```

### Tests Unitaires

```bash
# Frontend
cd frontend && npm test -- --run
# Résultat: 196 passed, 19 failed (échecs préexistants liés aux mocks)

# Backend
cd backend && dotnet test
# Résultat: Tests passés
```

---

## Prochaines Étapes

1. **Implémentation Docker**: Créer les réseaux Docker pour l'isolation réelle
2. **Intégration LLM**: Connecter les agents système aux modèles LLM
3. **Interface Utilisateur**: Créer les composants React pour visualiser la topologie et gérer les cycles de recherche
4. **Monitoring**: Ajouter des métriques Prometheus/Grafana pour le suivi en temps réel
5. **Tests d'Intégration**: Écrire des tests E2E pour les workflows complets

---

## Références

- [ISSUE-001-FITNESS-DRIVEN-AUTONOMOUS-TRAINING.md](../issues/ISSUE-001-FITNESS-DRIVEN-AUTONOMOUS-TRAINING.md)
- [ANALYSIS-FITNESS-TRAINING-ARCHITECTURE.md](./architecture/ANALYSIS-FITNESS-TRAINING-ARCHITECTURE.md)
- [MAESTRO-PHILOSOPHY-V2.md](./MAESTRO-PHILOSOPHY-V2.md)
