# Phase 10: Unified Session System (Foundry + Project)

**Issue**: MAESTRO-10 - Unified Session System Implementation
**Priority**: High
**Estimated Effort**: 5-6 weeks
**Dependencies**: Phase 7 (Projects/Containers), Phase 9 (Training/Metrics)

---

## Overview

Unify Testing and Training into **Foundry Sessions**, and add **Project Sessions** for real-world execution. Replace the separate Training/Testing systems with a cohesive session architecture.

### Goals

1. **Foundry Sessions** - Forge, test, improve blocks with automatic evaluation
2. **Project Sessions** - Execute workflows on real projects with access control
3. **Evaluation at Creation** - Configure how sessions are evaluated upfront
4. **Publish Workflow** - Draft → Forge → Validate → Publish to Catalog
5. **Full CLI Support** - External AIs can automate the entire workflow

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         FOUNDRY                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WORKSHOP: Drafts → Sessions → Improvements → Publish   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CATALOG: Published tools, agents, workflows            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT SESSIONS                            │
│  Execute workflows from Catalog on real projects with:          │
│  - Access control (readonly/sandbox/controlled/full)            │
│  - Validation (tests, linter)                                   │
│  - Commit workflow                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 10A: Core Domain Models (Week 1)

**Objective**: Create unified session models with evaluation configuration.

#### Tasks

- [ ] **10A-1**: Create Session entity
  ```
  Session.cs
  - Id, Name, Type (Foundry/Project), Status
  - FoundryConfig / ProjectConfig (type-specific)
  - Iterations, Metrics, Improvements
  ```

- [ ] **10A-2**: Create FoundrySessionConfig
  ```
  FoundrySessionConfig.cs
  - Iterations, Parallel, DelayMs, TimeoutMs
  - Inputs, Tags
  - Evaluation (configured at creation!)
  ```

- [ ] **10A-3**: Create EvaluationConfig
  ```
  EvaluationConfig.cs
  - Mode (Manual/Auto/Hybrid)
  - AutoEvaluator (LLM/Agent/Heuristic)
  - Criteria, PassThreshold
  - HumanReviewTrigger (for Hybrid mode)
  ```

- [ ] **10A-4**: Create ProjectSessionConfig
  ```
  ProjectSessionConfig.cs
  - ProjectId, Task, Context
  - Access (Level, AllowedPaths, DeniedPaths)
  - Validation (RunTests, RunLinter)
  ```

- [ ] **10A-5**: Create SessionIteration
  ```
  SessionIteration.cs
  - Inputs, Outputs, Metrics
  - Evaluation (score, criteria, explanation)
  - NeedsHumanReview flag
  ```

- [ ] **10A-6**: Create Draft model
  ```
  Draft.cs
  - Id, Name, Type (tool/agent/workflow)
  - Status (draft/forging/validated/published)
  - Definition (block JSON)
  - Sessions, CurrentScore, Improvements
  ```

- [ ] **10A-7**: Create repositories
  ```
  ISessionRepository.cs
  IDraftRepository.cs
  FileSystemSessionRepository.cs
  FileSystemDraftRepository.cs
  ```

**Files to Create:**
```
backend/src/Maestro.Domain/
├── Entities/
│   ├── Session.cs
│   ├── SessionIteration.cs
│   ├── Draft.cs
│   └── ImprovementSuggestion.cs
├── Configuration/
│   ├── FoundrySessionConfig.cs
│   ├── ProjectSessionConfig.cs
│   ├── EvaluationConfig.cs
│   ├── AutoEvaluatorConfig.cs
│   └── AccessConfig.cs
└── Enums/
    ├── SessionType.cs
    ├── SessionStatus.cs
    ├── EvaluationMode.cs
    ├── EvaluatorType.cs
    └── AccessLevel.cs

backend/src/Maestro.Application/
├── Interfaces/
│   ├── ISessionRepository.cs
│   └── IDraftRepository.cs
└── DTOs/
    ├── SessionDto.cs
    ├── DraftDto.cs
    └── CreateFoundrySessionRequest.cs

backend/src/Maestro.Infrastructure/
└── Foundry/
    ├── FileSystemSessionRepository.cs
    └── FileSystemDraftRepository.cs
```

**Acceptance Criteria:**
- [ ] All models compile without errors
- [ ] EvaluationConfig supports Manual/Auto/Hybrid modes
- [ ] Repositories can persist to file system

---

### Phase 10B: Foundry Service (Week 2)

**Objective**: Implement core Foundry logic with automatic evaluation.

#### Tasks

- [ ] **10B-1**: Create IFoundryService interface
  - Draft CRUD
  - Session lifecycle (create, start, pause, resume, cancel)
  - Evaluation management
  - Improvement workflow
  - Publication

- [ ] **10B-2**: Implement FoundryService
  - Session execution loop
  - **Automatic evaluation** after each iteration (based on config)
  - Parallel execution support
  - Metrics aggregation

- [ ] **10B-3**: Implement LLM Evaluator
  - Send iteration to LLM model
  - Parse evaluation response
  - Map to EvaluationResult

- [ ] **10B-4**: Implement Agent Evaluator
  - Execute evaluator agent
  - Pass iteration as input
  - Get structured evaluation output

- [ ] **10B-5**: Implement Heuristic Evaluator
  - Rule-based evaluation
  - Success/failure checks
  - Duration/token metrics

- [ ] **10B-6**: Implement Hybrid Mode Logic
  - Auto-evaluate first
  - Flag for human review based on triggers
  - Track pending reviews

- [ ] **10B-7**: Implement Improvement Generator
  - Analyze low-scoring iterations
  - Generate suggestions via LLM
  - Store with session

**Files to Create:**
```
backend/src/Maestro.Application/Interfaces/
└── IFoundryService.cs

backend/src/Maestro.Infrastructure/Foundry/
├── FoundryService.cs
├── Evaluators/
│   ├── LLMIterationEvaluator.cs
│   ├── AgentIterationEvaluator.cs
│   └── HeuristicIterationEvaluator.cs
└── ImprovementGenerator.cs
```

**Acceptance Criteria:**
- [ ] Sessions execute with automatic evaluation
- [ ] All three evaluation modes work
- [ ] Improvements are generated after session completion

---

### Phase 10C: Publication & Catalog (Week 2-3)

**Objective**: Implement publish workflow and catalog management.

#### Tasks

- [ ] **10C-1**: Create PublishedBlock model
  ```
  PublishedBlock.cs
  - BlockId, Name, Type, Version
  - Definition, Metrics, Category, Tags
  ```

- [ ] **10C-2**: Create ICatalogRepository
  - Save published blocks with versions
  - Query by type, category, tags
  - Get specific version or latest

- [ ] **10C-3**: Implement publish workflow
  - Validate draft is ready (score >= threshold)
  - Create versioned entry in catalog
  - Update draft status

- [ ] **10C-4**: Implement unpublish
  - Remove specific version
  - Keep history for audit

- [ ] **10C-5**: Implement catalog search
  - Filter by type, category
  - Search by name/description
  - Sort by score, usage

**Files to Create:**
```
backend/src/Maestro.Domain/Entities/
└── PublishedBlock.cs

backend/src/Maestro.Application/Interfaces/
└── ICatalogRepository.cs

backend/src/Maestro.Infrastructure/Foundry/
├── FileSystemCatalogRepository.cs
└── PublishService.cs
```

**Acceptance Criteria:**
- [ ] Drafts can be published with versions
- [ ] Catalog can be queried and searched
- [ ] Published blocks can be used in Project Sessions

---

### Phase 10D: Project Sessions (Week 3)

**Objective**: Implement project-attached session execution.

#### Tasks

- [ ] **10D-1**: Create IProjectSessionService interface
  - Create/start/cancel sessions
  - Get diff, run tests
  - Commit changes

- [ ] **10D-2**: Implement ProjectSessionService
  - Load workflow from catalog
  - Execute in project context
  - Track file changes

- [ ] **10D-3**: Implement Access Control
  - Enforce allowed/denied paths
  - Handle require-approval paths
  - Implement access levels

- [ ] **10D-4**: Implement Diff Generation
  - Track modified files
  - Generate unified diff
  - Show before/after

- [ ] **10D-5**: Implement Validation
  - Run test command
  - Run linter (optional)
  - Check clean diff

- [ ] **10D-6**: Implement Commit Workflow
  - Validate all checks pass
  - Create Git commit
  - Return commit info

**Files to Create:**
```
backend/src/Maestro.Application/Interfaces/
└── IProjectSessionService.cs

backend/src/Maestro.Infrastructure/Projects/
├── ProjectSessionService.cs
├── AccessControlService.cs
├── DiffService.cs
└── CommitService.cs
```

**Acceptance Criteria:**
- [ ] Sessions can execute on real projects
- [ ] Access control is enforced
- [ ] Changes can be validated and committed

---

### Phase 10E: Foundry API (Week 3-4)

**Objective**: REST API for Foundry operations.

#### Tasks

- [ ] **10E-1**: Create FoundryController
  ```
  /api/foundry/drafts/*           Draft CRUD
  /api/foundry/sessions/*         Session lifecycle
  /api/foundry/sessions/*/evaluate   Evaluation
  /api/foundry/sessions/*/improve    Improvements
  /api/foundry/publish            Publication
  /api/foundry/catalog/*          Catalog queries
  ```

- [ ] **10E-2**: Create ProjectSessionController
  ```
  /api/projects/{pid}/sessions/*  Session CRUD
  /api/projects/{pid}/sessions/*/diff
  /api/projects/{pid}/sessions/*/test
  /api/projects/{pid}/sessions/*/commit
  ```

- [ ] **10E-3**: Create SignalR Hubs
  - FoundryHub (session events, evaluation events)
  - Integrate with existing ProjectHub

- [ ] **10E-4**: Register services in Program.cs

**Files to Create:**
```
backend/src/Maestro.Api/Controllers/
├── FoundryController.cs
└── ProjectSessionController.cs

backend/src/Maestro.Api/Hubs/
└── FoundryHub.cs
```

**Acceptance Criteria:**
- [ ] All endpoints documented in Swagger
- [ ] Real-time updates via SignalR
- [ ] Proper error handling

---

### Phase 10F: CLI Implementation (Week 4)

**Objective**: Full CLI support for Foundry and Project Sessions.

#### Tasks

- [ ] **10F-1**: Add Foundry draft commands
  ```
  maestro foundry draft create/list/show/edit/delete/ready
  ```

- [ ] **10F-2**: Add Foundry session commands
  ```
  maestro foundry session create/start/status/metrics/follow
  maestro foundry session pause/resume/cancel
  maestro foundry session pending/evaluate
  maestro foundry session improvements/improve
  maestro foundry session compare
  ```

- [ ] **10F-3**: Add publication commands
  ```
  maestro foundry publish/unpublish/versions
  maestro foundry catalog/search
  ```

- [ ] **10F-4**: Add Project session commands
  ```
  maestro project session create/start/status
  maestro project session diff/test/commit/cancel
  ```

- [ ] **10F-5**: Update API client
  - Add all Foundry methods
  - Add all Project session methods

**Files to Modify:**
```
tools/maestro-cli/
├── index.js (register new commands)
└── commands/
    ├── foundry.js (new)
    └── project-session.js (new)

tools/shared/
└── api-client.js (add methods)
```

**Acceptance Criteria:**
- [ ] All commands have help text
- [ ] Commands support JSON output
- [ ] External AIs can run full automation loops

---

### Phase 10G: Frontend Integration (Week 5)

**Objective**: UI for Foundry and Project Sessions.

#### Tasks

- [ ] **10G-1**: Create Foundry page
  - Drafts list
  - Sessions list
  - Catalog view

- [ ] **10G-2**: Create Draft detail view
  - Edit definition
  - View sessions history
  - View current score

- [ ] **10G-3**: Create Session detail view
  - Iteration list with evaluations
  - Metrics charts
  - Improvements panel

- [ ] **10G-4**: Create evaluation UI
  - Manual evaluation form
  - Pending evaluations list

- [ ] **10G-5**: Create Project session UI
  - Create session dialog
  - Diff viewer
  - Commit confirmation

- [ ] **10G-6**: Add real-time updates
  - SignalR integration
  - Live session progress

**Files to Create:**
```
frontend/src/pages/
├── Foundry.tsx
├── FoundryDraft.tsx
├── FoundrySession.tsx
└── ProjectSession.tsx

frontend/src/components/foundry/
├── DraftList.tsx
├── DraftEditor.tsx
├── SessionList.tsx
├── SessionDetail.tsx
├── IterationList.tsx
├── EvaluationForm.tsx
├── ImprovementsPanel.tsx
├── MetricsCharts.tsx
└── CatalogBrowser.tsx

frontend/src/services/
└── foundryService.ts

frontend/src/store/
└── foundryStore.ts
```

**Acceptance Criteria:**
- [ ] Foundry workflow usable from UI
- [ ] Real-time session updates
- [ ] Consistent with existing UI patterns

---

### Phase 10H: Migration & Cleanup (Week 5-6)

**Objective**: Migrate existing data and deprecate old systems.

#### Tasks

- [ ] **10H-1**: Create migration service
  - Migrate TrainingConfiguration → Draft
  - Migrate TrainingRun → Session (type=Foundry)
  - Migrate BlockTestRun → Session (type=Foundry)

- [ ] **10H-2**: Run migration on startup
  - One-time migration flag
  - Preserve all data
  - Log results

- [ ] **10H-3**: Deprecate old APIs
  - Add deprecation headers
  - Log usage warnings
  - Plan removal timeline

- [ ] **10H-4**: Update documentation
  - Update CLAUDE.md
  - Update all guides
  - Remove old Training/Testing references

- [ ] **10H-5**: Update frontend routing
  - Redirect /training → /foundry
  - Redirect /testing → /foundry
  - Update navigation

**Files to Create/Modify:**
```
backend/src/Maestro.Infrastructure/Foundry/
└── MigrationService.cs

backend/src/Maestro.Api/Controllers/
├── TrainingController.cs (add deprecation)
└── BlockTestController.cs (add deprecation)

docs/
├── CLAUDE.md (update)
├── guides/* (update)
└── MIGRATION-FOUNDRY.md (new)
```

**Acceptance Criteria:**
- [ ] All existing data migrated
- [ ] Old APIs show deprecation warnings
- [ ] Documentation reflects new system

---

## Testing Requirements

### Unit Tests

```
backend/tests/Maestro.Tests/
├── Domain/
│   ├── SessionTests.cs
│   └── DraftTests.cs
├── Infrastructure/
│   ├── FoundryServiceTests.cs
│   ├── EvaluatorTests.cs
│   └── ProjectSessionServiceTests.cs
└── Api/
    ├── FoundryControllerTests.cs
    └── ProjectSessionControllerTests.cs
```

### Integration Tests

```
backend/tests/Maestro.IntegrationTests/
├── FoundryIntegrationTests.cs
└── ProjectSessionIntegrationTests.cs
```

### CLI Tests

```
tools/maestro-cli/tests/
├── foundry.test.js
└── project-session.test.js
```

---

## Success Metrics

1. **Foundry Sessions** can execute with automatic evaluation
2. **All evaluation modes** (Manual/Auto/Hybrid) work correctly
3. **Publish workflow** completes successfully
4. **Project Sessions** can execute and commit
5. **CLI coverage** - Full automation possible
6. **Migration** - 100% data preserved

---

## Timeline Summary

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | 10A | Domain models, repositories |
| 2 | 10B, 10C | Foundry service, evaluators, catalog |
| 3 | 10D, 10E | Project sessions, APIs |
| 4 | 10F | CLI implementation |
| 5-6 | 10G, 10H | Frontend, migration, cleanup |

---

## Checklist

- [ ] Phase 10A complete
- [ ] Phase 10B complete
- [ ] Phase 10C complete
- [ ] Phase 10D complete
- [ ] Phase 10E complete
- [ ] Phase 10F complete
- [ ] Phase 10G complete
- [ ] Phase 10H complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Migration verified
- [ ] Old system deprecated
