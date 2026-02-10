# ISSUE-001: Fitness-Driven Autonomous Training Architecture

> **Status**: Open
> **Priority**: High
> **Branch**: feat/azure-model-catalog
> **Created**: 2026-02-03
> **Type**: Feature Implementation

---

## Overview

This issue tracks the implementation of the **Fitness-Driven Autonomous Training Architecture** as defined in our analysis and philosophy documents. The goal is to transform Maestro into a self-improving AI orchestration platform.

> **Philosophy**: "Maximize intelligence per unit of energy" - Favor specialized small models orchestrated together over large monolithic models.

---

## CRITICAL: Reference Documents

**Before implementing any phase, thoroughly read and understand these documents:**

| Document | Path | Purpose |
|----------|------|---------|
| **Architecture Analysis** | `docs/architecture/ANALYSIS-FITNESS-TRAINING-ARCHITECTURE.md` | Technical analysis, C# code samples, entity structures, what is missing in current codebase |
| **Philosophy V2** | `docs/MAESTRO-PHILOSOPHY-V2.md` | Fitness Model formula, architecture diagrams, Workspace isolation, Orchestrator workflow, CLI specs |

These documents contain:
- Detailed code examples for all new entities
- Complete interface definitions
- CLI command specifications
- Architecture diagrams
- Implementation rationale

---

## Fitness Model Formula

```
                    P x S x W
ModelFitness = -------------------------
               (C_norm x C_compute x C_hw)^lambda
```

| Dimension | Description | Calculation |
|-----------|-------------|-------------|
| **P** (Performance) | Success rate on targeted task | Tests passed, format compliance [0-1] |
| **S** (Specialization) | Rewards focus | P / task_entropy |
| **W** (Composability) | Workflow integration | 1 - hallucination_rate |
| **C_norm** | Normalized economic cost | cost / baseline_cost |
| **C_compute** | Computational cost | log(params) x FLOPs/token |
| **C_hw** | Hardware friction | alpha*VRAM + beta*RAM + gamma*GPU |
| **lambda** | Non-linear penalty | > 1 (recommended: 1.5) |

**Effects**:
- Large models are mathematically penalized
- Small specialized models win
- Task decomposition is rewarded
- Open-source/local models have structural advantage

---

## Architecture Overview

```
+-----------------------------------------------------------------------------+
|                              MAESTRO HOST                                    |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                    MAESTRO CORE (Generic)                              |  |
|  |  +------------+ +------------+ +------------+ +--------------------+   |  |
|  |  |  Blocks    | |  Sessions  | |  Training  | |  FITNESS ENGINE    |   |  |
|  |  |  Engine    | |  Manager   | |  System    | |  (NEW - Phase 1)   |   |  |
|  |  +------------+ +------------+ +------------+ +--------------------+   |  |
|  +------------------------------------------------------------------------+  |
|                                    |                                         |
|         +--------------------------+---------------------------+             |
|         v                          v                           v             |
|  +---------------------+  +---------------------+  +---------------------+   |
|  | WORKSPACE: Research |  | WORKSPACE: Staging  |  | WORKSPACE: Prod     |   |
|  | (isolated)          |  | (isolated)          |  | (isolated)          |   |
|  |                     |  |                     |  |                     |   |
|  | - Training sessions |  | - Integration tests |  | - Project sessions  |   |
|  | - Fitness eval      |  | - Validation        |  | - Bound repos       |   |
|  | - Research agents   |  |                     |  |                     |   |
|  +----------+----------+  +----------+----------+  +----------+----------+   |
|             |                        |                        |              |
|             +------------------------+------------------------+              |
|                                      v                                       |
|                    +-------------------------------+                         |
|                    |   ORCHESTRATOR AGENT          |                         |
|                    |   (automatic promotion)       |                         |
|                    |                               |                         |
|                    |   fitness > 0.7 -> staging    |                         |
|                    |   fitness > 0.85 -> prod      |                         |
|                    |   fitness drop -> rollback    |                         |
|                    +-------------------------------+                         |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Implementation Phases

### Phase 1: Fitness Infrastructure [HIGH PRIORITY]

**Objective**: Add core fitness calculation capabilities to Maestro.

#### Backend - Domain Entities

Location: `backend/src/Maestro.Domain/ValueObjects/`

- [ ] `FitnessScore.cs` - Value object with all dimensions
  ```csharp
  public class FitnessScore
  {
      public double Performance { get; init; }      // P: 0-1
      public double Specialization { get; init; }   // S: P/entropy
      public double Composability { get; init; }    // W: 1-hallucination_rate
      public double EconomicCost { get; init; }     // C_norm
      public double ComputeCost { get; init; }      // C_compute
      public double HardwareCost { get; init; }     // C_hw
      public double Lambda { get; init; }           // lambda exponent
      public double TotalFitness => /* formula */;
  }
  ```

- [ ] `ModelProfile.cs` - Model specifications
  ```csharp
  public class ModelProfile
  {
      public string ModelId { get; init; }
      public long ParameterCount { get; init; }
      public double FLOPsPerToken { get; init; }
      public int VRAMRequirementMB { get; init; }
      public int RAMRequirementMB { get; init; }
      public bool RequiresGPU { get; init; }
      public string[] SupportedTasks { get; init; }
  }
  ```

- [ ] `TaskEntropy.cs` - Shannon entropy calculation for specialization
- [ ] `FitnessConfig.cs` - Configuration (lambda, thresholds, weights)

#### Backend - Application Services

Location: `backend/src/Maestro.Application/`

- [ ] `IFitnessService` interface:
  - `CalculateModelFitness(modelId, taskType, metrics)`
  - `CalculateWorkflowFitness(workflowId, iterations)`
  - `GetModelProfile(modelId)`
  - `UpdateTaskEntropy(agentId, taskType)`

- [ ] `FitnessService` implementation

#### Backend - Infrastructure

Location: `backend/src/Maestro.Infrastructure/`

- [ ] `ModelProfileRepository` - Store/retrieve model profiles
- [ ] Seed model profiles for: GPT-4, Claude, Llama, Mistral, Phi, Qwen, etc.

#### Backend - Training Integration

- [ ] Add `FitnessScore` to `TrainingIteration`
- [ ] Add `AverageFitnessScore`, `FitnessVariance`, `FitnessBreakdown` to `TrainingRunMetrics`
- [ ] Calculate fitness after each training iteration automatically

#### Backend - API Endpoints

Location: `backend/src/Maestro.Api/Controllers/`

- [ ] `GET /api/fitness/{agentId}` - Get fitness score
- [ ] `GET /api/fitness/profile/{modelId}` - Get model profile
- [ ] `GET /api/fitness/leaderboard` - Agents ranked by fitness
- [ ] `GET /api/fitness/compare?agents=id1,id2` - Compare agents

#### CLI Commands

Location: `tools/maestro-cli/`

- [ ] `maestro fitness calculate <agent-id> --task <task-type>`
- [ ] `maestro fitness profile <model-id>`
- [ ] `maestro fitness leaderboard --sort fitness --limit 20`
- [ ] `maestro fitness compare <agent-1> <agent-2>`

#### Frontend

Location: `frontend/src/`

- [ ] `components/fitness/FitnessScore.tsx` - Display component
- [ ] `components/fitness/FitnessBreakdown.tsx` - Radar chart visualization
- [ ] `components/fitness/FitnessLeaderboard.tsx` - Rankings table
- [ ] Add fitness metrics to training dashboard
- [ ] Add fitness to agent cards

#### Acceptance Criteria Phase 1

- [ ] Fitness scores calculated for all training iterations
- [ ] Model profiles exist for major LLM providers
- [ ] CLI displays fitness scores and leaderboards
- [ ] Frontend shows fitness breakdown in training dashboard

---

### Phase 2: System Blocks [HIGH PRIORITY]

**Objective**: Create system blocks infrastructure with overridable default agents.

#### Block Structure

- [ ] Create `blocks/system/` directory
- [ ] Add `isSystem: boolean` to `BlockDefinition` entity
- [ ] Add `overridable: boolean` to `BlockDefinition`
- [ ] Implement automatic loading of system blocks at startup
- [ ] Update `BlockDto.FromDomain` to include new flags

#### Initial System Blocks

Create in `blocks/system/`:

- [ ] `fitness-evaluator/definition.json`
  ```json
  {
    "id": "system:fitness-evaluator",
    "name": "Fitness Evaluator",
    "blockType": "agent",
    "isSystem": true,
    "overridable": true,
    "description": "Evaluates agent fitness using P*S*W / (C)^lambda",
    "capabilities": ["evaluation", "fitness", "metrics"]
  }
  ```

- [ ] `trainer-agent/definition.json` - Orchestrates training sessions
- [ ] `tester-agent/definition.json` - Executes structured tests

#### Override Mechanism

- [ ] Detect user overrides in `blocks/user/` with matching ID
- [ ] Merge configurations (user takes precedence)
- [ ] Track override status in block metadata

#### API Endpoints

- [ ] `GET /api/blocks?system=true` - List system blocks
- [ ] `POST /api/blocks/{id}/override` - Create user override
- [ ] `DELETE /api/blocks/{id}/override` - Restore to system default

#### CLI Commands

- [ ] `maestro blocks --system` - List system blocks
- [ ] `maestro blocks override <system-block-id>` - Override system block
- [ ] `maestro blocks restore <system-block-id>` - Restore system block

#### Acceptance Criteria Phase 2

- [ ] System blocks load automatically at startup
- [ ] Users can override any system block
- [ ] Initial 3 system blocks are functional
- [ ] Override mechanism works correctly

---

### Phase 3: Workspaces with Isolation [MEDIUM PRIORITY]

**Objective**: Implement workspace grouping with optional Docker-based isolation.

#### Domain Entities

Location: `backend/src/Maestro.Domain/Entities/`

- [ ] `Workspace.cs`:
  ```csharp
  public class Workspace
  {
      public WorkspaceId Id { get; }
      public string Name { get; }
      public WorkspaceType Type { get; }  // Training, Production, Research, Custom
      public List<SessionId> Sessions { get; }
      public List<ProjectId> Projects { get; }
      public CatalogRef Catalog { get; }
      public WorkspaceSettings Settings { get; }
      public WorkspaceIsolation Isolation { get; }
  }
  ```

- [ ] `WorkspaceIsolation.cs`:
  ```csharp
  public class WorkspaceIsolation
  {
      public bool Enabled { get; }
      public NetworkConfig Network { get; }      // Docker network name, subnet
      public ResourceLimits Resources { get; }   // CPU%, RAM, Storage
      public WorkspacePermissions Permissions { get; }  // canReadFrom, canWriteTo, canPromoteTo
  }
  ```

#### Docker Infrastructure

- [ ] Create Docker network per isolated workspace
- [ ] Apply resource limits (CPU, RAM) via Docker
- [ ] Network isolation between workspaces
- [ ] Container labeling for workspace membership

#### Workspace Gateway

- [ ] `IWorkspaceGateway` interface:
  - `PromoteAgent(source, target, agentId, version)`
  - `ReadMetrics(source, target, query)`
  - `TriggerAction(source, target, action)`

- [ ] Implementation with permission checks
- [ ] Audit logging for cross-workspace operations

#### API Endpoints

- [ ] `POST /api/workspaces` - Create workspace
- [ ] `GET /api/workspaces` - List workspaces
- [ ] `GET /api/workspaces/{id}` - Get workspace details
- [ ] `PUT /api/workspaces/{id}` - Update workspace
- [ ] `DELETE /api/workspaces/{id}` - Delete workspace
- [ ] `POST /api/workspaces/{id}/sessions` - Add session
- [ ] `POST /api/workspaces/{id}/projects` - Add project
- [ ] `GET /api/workspaces/{id}/topology` - View topology

#### CLI Commands

- [ ] `maestro workspace create --name <name> --type <type> [--isolated]`
- [ ] `maestro workspace list`
- [ ] `maestro workspace info <workspace-id>`
- [ ] `maestro workspace add-session <workspace-id> <session-id>`
- [ ] `maestro workspace add-project <workspace-id> <project-id>`
- [ ] `maestro workspace permissions <id> --can-promote-to staging,production`
- [ ] `maestro workspace topology` - Visual representation

#### Acceptance Criteria Phase 3

- [ ] Workspaces can be created with/without isolation
- [ ] Docker networks created per isolated workspace
- [ ] Resource limits enforced
- [ ] Gateway allows controlled cross-workspace communication

---

### Phase 4: Session Source Configuration [MEDIUM PRIORITY]

**Objective**: Allow sessions to use either isolated sandboxes or bound repositories.

#### Configuration

- [ ] `SessionSource` enum: `Sandbox | Repository`
- [ ] Add to `FoundrySessionConfig`:
  ```csharp
  public class FoundrySessionConfig
  {
      // Existing...
      public SessionSource Source { get; set; } = SessionSource.Sandbox;
      public RepositorySourceConfig? RepositoryConfig { get; set; }
  }

  public class RepositorySourceConfig
  {
      public string RepositoryPath { get; set; }
      public string DockerBindPath { get; set; }
      public AccessLevel AccessLevel { get; set; }  // ReadOnly, Controlled, Full
  }
  ```

#### Docker Integration

- [ ] Volume binding for repository sources
- [ ] Isolated container for sandbox sources
- [ ] AccessLevel enforcement

#### CLI Updates

- [ ] `maestro session create --source sandbox` (default)
- [ ] `maestro session create --source repository --repository-path <path>`
- [ ] `maestro session create --access-level readonly|controlled|full`

#### Acceptance Criteria Phase 4

- [ ] Sessions can be created with sandbox or repository source
- [ ] Repository binding works with Docker volumes
- [ ] Access levels are enforced

---

### Phase 5: Orchestrator Agent [MEDIUM PRIORITY]

**Objective**: Automated agent promotion between workspaces based on fitness.

#### System Block Definition

Create `blocks/system/orchestrator-agent/definition.json`:

```json
{
  "id": "system:orchestrator",
  "name": "Workspace Orchestrator",
  "blockType": "agent",
  "isSystem": true,
  "overridable": true,
  "description": "Automates agent promotion between workspaces based on fitness",
  "capabilities": ["cross-workspace-communication", "agent-promotion", "fitness-monitoring", "rollback-management"],
  "config": {
    "promotionRules": [
      {
        "from": "research",
        "to": "staging",
        "conditions": { "minFitness": 0.7, "minIterations": 50, "allTestsPass": true }
      },
      {
        "from": "staging",
        "to": "production",
        "conditions": { "minFitness": 0.85, "integrationTestsPass": true }
      }
    ],
    "rollbackRules": {
      "fitnessDropThreshold": 0.1,
      "errorRateThreshold": 0.05,
      "autoRollback": true
    },
    "monitoringInterval": "5m"
  }
}
```

#### Promotion Workflow

- [ ] Scan Research workspace for qualified agents
- [ ] Automatic promotion Research -> Staging
- [ ] Run integration tests in Staging
- [ ] Automatic promotion Staging -> Production (if tests pass)
- [ ] Update Production sessions with new agent version

#### Rollback Management

- [ ] Monitor fitness in Production continuously
- [ ] Automatic rollback if fitness drops > threshold
- [ ] Maintain version history for rollback targets
- [ ] Send alerts on rollback events

#### CLI Commands

- [ ] `maestro orchestrator status`
- [ ] `maestro orchestrator pending` - View pending promotions
- [ ] `maestro orchestrator promote <agent-id> --from <ws> --to <ws> [--force]`
- [ ] `maestro orchestrator rollback <agent-id> --workspace <ws> --to-version <v>`
- [ ] `maestro orchestrator history --workspace <ws> --limit 20`
- [ ] `maestro orchestrator config set --min-fitness 0.8 --from research --to staging`
- [ ] `maestro orchestrator auto-promote --enable|--disable`
- [ ] `maestro orchestrator metrics --agent <agent-id>`

#### Acceptance Criteria Phase 5

- [ ] Orchestrator automatically promotes agents based on fitness
- [ ] Integration tests run in Staging before Production promotion
- [ ] Rollback triggers when fitness degrades
- [ ] Production sessions updated with promoted agents
- [ ] Full audit trail of promotions and rollbacks

---

### Phase 6: Research Team Integration [LOW PRIORITY]

**Objective**: Complete research team workflow for self-improvement.

#### Additional System Agents

Create in `blocks/system/`:

- [ ] `researcher-agent/definition.json` - Identifies improvement opportunities
- [ ] `documenter-agent/definition.json` - Generates documentation automatically
- [ ] `publisher-agent/definition.json` - Publishes agents to catalog

#### Research Team Workflow

```
Researcher -> Trainer -> Tester -> Fitness Evaluator
                                          |
                                    +-----+-----+
                                    |           |
                                  Pass        Fail
                                    |           |
                                    v           v
                              Documenter    (back to Researcher)
                                    |
                                    v
                               Publisher
```

- [ ] Create workflow definition for research team
- [ ] Automatic documentation generation after successful training
- [ ] Automatic test generation for new agents
- [ ] Integration with orchestrator for deployment

#### Self-Improvement Capability

- [ ] Research team can evaluate system agents
- [ ] Research team can train improved versions of system agents
- [ ] Improved system agents can override originals (if fitness improves)
- [ ] Full cycle: evaluate -> improve -> test -> deploy -> monitor

#### Acceptance Criteria Phase 6

- [ ] All research team agents functional
- [ ] Auto-documentation works
- [ ] Self-improvement cycle demonstrated
- [ ] System agents can be improved by the research team

---

## What Exists vs What is Missing

### Existing Infrastructure to Leverage

| Component | Location | Status |
|-----------|----------|--------|
| QualityEvaluator | `Maestro.Application/Services/` | Can integrate with P metric |
| TrainingRun/Iteration | `Maestro.Domain/Entities/` | Add FitnessScore property |
| ModelUsageMetrics | `Maestro.Domain/ValueObjects/` | Has TotalCostUsd (C_norm) |
| State Machine | Sessions | Reuse for Workspaces |
| Event Sourcing | SessionEvent | Extend for Workspace events |

### What is Missing (from analysis document)

| Dimension | Current State | To Implement |
|-----------|---------------|--------------|
| P (Performance) | QualityScore exists | Improve with task-specific criteria |
| S (Specialization) | Missing | TaskEntropy tracking per agent |
| W (Composability) | Missing | Hallucination rate, format compliance |
| C_compute | Missing | FLOPs, params in ModelUsageMetrics |
| C_hw | Missing | VRAM, RAM, GPU tracking |
| WorkflowFitness | Missing | Aggregation with weighted contributions |
| PipelineBonus | Missing | Diversity bonus for multi-model workflows |

---

## Testing Strategy

### Unit Tests

- FitnessScore calculation with known inputs
- TaskEntropy Shannon entropy calculation
- ModelProfile validation
- Workspace permission checks

### Integration Tests

- Fitness calculation in training pipeline
- System block loading and override
- Workspace isolation (Docker network tests)
- Orchestrator promotion workflow

### E2E Tests

- Full training run with fitness tracking
- Agent promotion Research -> Staging -> Production
- Rollback scenario
- Research team self-improvement cycle

---

## Dependencies

- Docker (for workspace isolation)
- SignalR (for real-time fitness updates)
- Existing training infrastructure
- Existing block system

---

## Notes for Implementers

1. **Start with Phase 1** - Fitness infrastructure is foundational
2. **Read the reference documents** - They contain detailed code samples
3. **Follow existing patterns** - Clean Architecture + DDD
4. **Run tests** - Before and after changes (see CLAUDE.md)
5. **Incremental PRs** - One phase or sub-phase per PR

---

## Labels

`enhancement` `architecture` `fitness` `training` `autonomous` `workspaces` `orchestration`
