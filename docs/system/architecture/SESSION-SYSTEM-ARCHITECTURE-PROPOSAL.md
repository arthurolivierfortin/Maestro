# Unified Session System - Architecture Proposal (v2)

## Document Purpose

This document proposes the unified architecture for Maestro sessions, centered around **Foundry** for block development and **Project Sessions** for real-world execution.

---

## 1. Overview

### Two Session Types

| Type | Purpose | Environment |
|------|---------|-------------|
| **Foundry Session** | Forge, test, improve blocks | Isolated sandbox |
| **Project Session** | Execute workflows on real projects | Attached repository |

### Key Design Principles

1. **Evaluation at Creation** - Configure how sessions will be evaluated upfront
2. **Automatic Execution** - No manual intervention needed for happy path
3. **Unified Data Model** - Common session structure with type-specific extensions
4. **CLI-First** - Full automation possible via command line

---

## 2. Domain Model

### Core Session Entity

```csharp
namespace Maestro.Domain.Entities;

public class Session
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public SessionType Type { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Created;

    // Authority
    public AuthorityInfo CreatedBy { get; set; } = new();
    public List<AuthorityInfo> Participants { get; set; } = new();

    // Target
    public string BlockId { get; set; } = string.Empty;

    // Type-specific configuration
    public FoundrySessionConfig? FoundryConfig { get; set; }
    public ProjectSessionConfig? ProjectConfig { get; set; }

    // Results
    public List<SessionIteration> Iterations { get; set; } = new();
    public SessionMetrics? Metrics { get; set; }
    public List<ImprovementSuggestion> Improvements { get; set; } = new();

    // Timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public enum SessionType
{
    Foundry,    // Block development in sandbox
    Project     // Real project execution
}

public enum SessionStatus
{
    Created,
    Running,
    Paused,
    Evaluating,     // Waiting for manual evaluations
    Completed,
    Failed,
    Cancelled
}
```

### Foundry Session Configuration

```csharp
public class FoundrySessionConfig
{
    // Execution
    public int Iterations { get; set; } = 10;
    public int Parallel { get; set; } = 1;
    public int DelayMs { get; set; } = 0;
    public int TimeoutMs { get; set; } = 300000;
    public Dictionary<string, object> Inputs { get; set; } = new();

    // Evaluation (configured at creation!)
    public EvaluationConfig Evaluation { get; set; } = new();

    // Tags for organization
    public List<string> Tags { get; set; } = new();
}

public class EvaluationConfig
{
    public EvaluationMode Mode { get; set; } = EvaluationMode.Auto;

    // Auto evaluator settings
    public AutoEvaluatorConfig? AutoEvaluator { get; set; }

    // Hybrid mode settings
    public HumanReviewTrigger? HumanReviewTrigger { get; set; }
}

public enum EvaluationMode
{
    Manual,     // Human evaluates each iteration
    Auto,       // LLM/Agent evaluates automatically
    Hybrid      // Auto by default, human when triggered
}

public class AutoEvaluatorConfig
{
    public EvaluatorType Type { get; set; } = EvaluatorType.LLM;
    public string? ModelId { get; set; }          // For LLM type
    public string? AgentId { get; set; }          // For Agent type
    public List<EvaluationCriterion> Criteria { get; set; } = new();
    public double PassThreshold { get; set; } = 0.8;
}

public enum EvaluatorType
{
    LLM,        // Use LLM model directly
    Agent,      // Use Maestro agent as evaluator
    Heuristic   // Use rule-based evaluation
}

public class HumanReviewTrigger
{
    public double? ScoreThreshold { get; set; }   // Review if score below this
    public bool OnError { get; set; } = true;     // Review on execution error
    public double? SampleRate { get; set; }       // Random sample % for review
}
```

### Project Session Configuration

```csharp
public class ProjectSessionConfig
{
    // Project reference
    public string ProjectId { get; set; } = string.Empty;

    // Task definition
    public string Task { get; set; } = string.Empty;
    public string? Context { get; set; }

    // Access control
    public AccessConfig Access { get; set; } = new();

    // Execution limits
    public int MaxSteps { get; set; } = 50;
    public int TimeoutMs { get; set; } = 600000;

    // Validation
    public ValidationConfig Validation { get; set; } = new();
}

public class AccessConfig
{
    public AccessLevel Level { get; set; } = AccessLevel.Controlled;
    public List<string> AllowedPaths { get; set; } = new() { "**/*" };
    public List<string> DeniedPaths { get; set; } = new() { ".env", "secrets/**" };
    public List<string> RequireApprovalPaths { get; set; } = new();
}

public enum AccessLevel
{
    ReadOnly,       // Can only read files
    Sandbox,        // Writes to temp copy
    Controlled,     // Writes with review before commit
    Full            // Direct write and commit
}

public class ValidationConfig
{
    public bool RunTests { get; set; } = true;
    public bool RunLinter { get; set; } = false;
    public bool RequireCleanDiff { get; set; } = false;
    public string? TestCommand { get; set; }
}
```

### Session Iteration

```csharp
public class SessionIteration
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int IterationNumber { get; set; }
    public string? ExecutionId { get; set; }

    // Execution
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }

    // I/O
    public Dictionary<string, object> Inputs { get; set; } = new();
    public Dictionary<string, object> Outputs { get; set; } = new();
    public string? OutputContent { get; set; }
    public List<string> Logs { get; set; } = new();

    // Metrics
    public IterationMetrics Metrics { get; set; } = new();

    // Evaluation
    public EvaluationResult? Evaluation { get; set; }
    public bool NeedsHumanReview { get; set; } = false;
}

public class EvaluationResult
{
    public double Score { get; set; }
    public List<CriterionScore> CriteriaScores { get; set; } = new();
    public string? Explanation { get; set; }
    public double Confidence { get; set; } = 1.0;

    public EvaluatorInfo EvaluatedBy { get; set; } = new();
    public DateTimeOffset EvaluatedAt { get; set; }
}

public class EvaluatorInfo
{
    public string Type { get; set; } = "auto";  // "auto", "human", "agent"
    public string? ModelId { get; set; }
    public string? AgentId { get; set; }
    public string? UserId { get; set; }
}
```

### Authority Info

```csharp
public class AuthorityInfo
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public AuthorityType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum AuthorityType
{
    Human,          // User via UI or CLI
    MaestroAgent,   // Internal Maestro agent
    ExternalAI      // Claude Code, GPT, etc.
}
```

---

## 3. Service Layer

### IFoundryService

```csharp
public interface IFoundryService
{
    // Draft Management
    Task<Draft> CreateDraftAsync(CreateDraftRequest request, CancellationToken ct = default);
    Task<Draft?> GetDraftAsync(string draftId, CancellationToken ct = default);
    Task<IReadOnlyList<Draft>> ListDraftsAsync(DraftFilter? filter = null, CancellationToken ct = default);
    Task<Draft> UpdateDraftAsync(string draftId, UpdateDraftRequest request, CancellationToken ct = default);
    Task DeleteDraftAsync(string draftId, CancellationToken ct = default);
    Task<bool> IsDraftReadyForPublishAsync(string draftId, CancellationToken ct = default);

    // Session Management
    Task<Session> CreateSessionAsync(CreateFoundrySessionRequest request, CancellationToken ct = default);
    Task<Session> StartSessionAsync(string sessionId, CancellationToken ct = default);
    Task<Session> PauseSessionAsync(string sessionId, CancellationToken ct = default);
    Task<Session> ResumeSessionAsync(string sessionId, CancellationToken ct = default);
    Task<Session> CancelSessionAsync(string sessionId, CancellationToken ct = default);
    Task<Session?> GetSessionAsync(string sessionId, CancellationToken ct = default);
    Task<IReadOnlyList<Session>> ListSessionsAsync(SessionFilter? filter = null, CancellationToken ct = default);

    // Evaluation
    Task<SessionIteration> EvaluateIterationAsync(string sessionId, string iterationId, EvaluationRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<SessionIteration>> GetPendingEvaluationsAsync(string sessionId, CancellationToken ct = default);

    // Improvements
    Task<IReadOnlyList<ImprovementSuggestion>> GetImprovementsAsync(string sessionId, CancellationToken ct = default);
    Task<Draft> ApplyImprovementAsync(string sessionId, string improvementId, CancellationToken ct = default);
    Task<Draft> ApplyAllImprovementsAsync(string sessionId, CancellationToken ct = default);

    // Comparison
    Task<SessionComparison> CompareSessionsAsync(string[] sessionIds, CancellationToken ct = default);

    // Publication
    Task<PublishedBlock> PublishAsync(string draftId, PublishRequest request, CancellationToken ct = default);
    Task UnpublishAsync(string blockId, string version, CancellationToken ct = default);

    // Catalog
    Task<IReadOnlyList<PublishedBlock>> GetCatalogAsync(CatalogFilter? filter = null, CancellationToken ct = default);
    Task<PublishedBlock?> GetPublishedBlockAsync(string blockId, string? version = null, CancellationToken ct = default);
}
```

### IProjectSessionService

```csharp
public interface IProjectSessionService
{
    // Session Management
    Task<Session> CreateSessionAsync(string projectId, CreateProjectSessionRequest request, CancellationToken ct = default);
    Task<Session> StartSessionAsync(string projectId, string sessionId, CancellationToken ct = default);
    Task<Session?> GetSessionAsync(string projectId, string sessionId, CancellationToken ct = default);
    Task<IReadOnlyList<Session>> ListSessionsAsync(string projectId, SessionFilter? filter = null, CancellationToken ct = default);
    Task CancelSessionAsync(string projectId, string sessionId, CancellationToken ct = default);

    // Results
    Task<string> GetDiffAsync(string projectId, string sessionId, CancellationToken ct = default);
    Task<TestResult> RunTestsAsync(string projectId, string sessionId, CancellationToken ct = default);

    // Commit
    Task<CommitResult> CommitAsync(string projectId, string sessionId, CommitRequest request, CancellationToken ct = default);
}
```

---

## 4. Execution Flow

### Foundry Session Execution

```
CreateFoundrySession(config with evaluation settings)
         │
         ▼
    StartSession()
         │
         ▼
┌────────────────────────────────────────────┐
│          ITERATION LOOP                     │
│                                             │
│  ┌─────────────┐                           │
│  │   EXECUTE   │ Run workflow with inputs  │
│  └──────┬──────┘                           │
│         │                                   │
│         ▼                                   │
│  ┌─────────────┐                           │
│  │  EVALUATE   │ Based on config.evaluation│
│  │             │                           │
│  │  if auto:   │ → LLM/Agent evaluates     │
│  │  if hybrid: │ → Auto + flag for human   │
│  │  if manual: │ → Wait for human          │
│  └──────┬──────┘                           │
│         │                                   │
│         ▼                                   │
│  ┌─────────────┐                           │
│  │   STORE     │ Save iteration + eval     │
│  └──────┬──────┘                           │
│         │                                   │
│         ▼                                   │
│  Continue for all iterations               │
└────────────────────────────────────────────┘
         │
         ▼
    Calculate Metrics
         │
         ▼
    Generate Improvements
         │
         ▼
    Session Complete
```

### Auto-Evaluation Implementation

```csharp
private async Task EvaluateIterationAutomaticallyAsync(
    Session session,
    SessionIteration iteration,
    CancellationToken ct)
{
    var evalConfig = session.FoundryConfig!.Evaluation;

    if (evalConfig.Mode == EvaluationMode.Manual)
    {
        iteration.NeedsHumanReview = true;
        return;
    }

    // Perform automatic evaluation
    EvaluationResult result;

    if (evalConfig.AutoEvaluator!.Type == EvaluatorType.LLM)
    {
        result = await _llmEvaluator.EvaluateAsync(
            iteration,
            evalConfig.AutoEvaluator.ModelId!,
            evalConfig.AutoEvaluator.Criteria,
            ct);
    }
    else if (evalConfig.AutoEvaluator.Type == EvaluatorType.Agent)
    {
        result = await _agentEvaluator.EvaluateAsync(
            iteration,
            evalConfig.AutoEvaluator.AgentId!,
            evalConfig.AutoEvaluator.Criteria,
            ct);
    }
    else
    {
        result = await _heuristicEvaluator.EvaluateAsync(
            iteration,
            evalConfig.AutoEvaluator.Criteria,
            ct);
    }

    iteration.Evaluation = result;

    // Check if human review is needed (hybrid mode)
    if (evalConfig.Mode == EvaluationMode.Hybrid && evalConfig.HumanReviewTrigger != null)
    {
        var trigger = evalConfig.HumanReviewTrigger;

        if (trigger.ScoreThreshold.HasValue && result.Score < trigger.ScoreThreshold)
        {
            iteration.NeedsHumanReview = true;
        }
        else if (trigger.OnError && !iteration.Success)
        {
            iteration.NeedsHumanReview = true;
        }
        else if (trigger.SampleRate.HasValue)
        {
            var random = new Random();
            if (random.NextDouble() < trigger.SampleRate.Value)
            {
                iteration.NeedsHumanReview = true;
            }
        }
    }
}
```

---

## 5. API Design

### Foundry Endpoints

```
# Drafts
POST   /api/foundry/drafts                    Create draft
GET    /api/foundry/drafts                    List drafts
GET    /api/foundry/drafts/{id}               Get draft
PUT    /api/foundry/drafts/{id}               Update draft
DELETE /api/foundry/drafts/{id}               Delete draft
GET    /api/foundry/drafts/{id}/ready         Check if ready to publish

# Sessions
POST   /api/foundry/sessions                  Create session
GET    /api/foundry/sessions                  List sessions
GET    /api/foundry/sessions/{id}             Get session
POST   /api/foundry/sessions/{id}/start       Start session
POST   /api/foundry/sessions/{id}/pause       Pause session
POST   /api/foundry/sessions/{id}/resume      Resume session
POST   /api/foundry/sessions/{id}/cancel      Cancel session
GET    /api/foundry/sessions/{id}/metrics     Get metrics
GET    /api/foundry/sessions/{id}/iterations  List iterations

# Evaluation
GET    /api/foundry/sessions/{id}/pending     Get pending evaluations
POST   /api/foundry/sessions/{id}/evaluate    Submit evaluation

# Improvements
GET    /api/foundry/sessions/{id}/improvements      List improvements
POST   /api/foundry/sessions/{id}/improvements/{impId}/apply  Apply improvement

# Comparison
GET    /api/foundry/sessions/compare?ids=a,b,c     Compare sessions

# Publication
POST   /api/foundry/publish                   Publish draft
DELETE /api/foundry/catalog/{id}/versions/{v} Unpublish version

# Catalog
GET    /api/foundry/catalog                   List published blocks
GET    /api/foundry/catalog/{id}              Get published block
GET    /api/foundry/catalog/{id}/versions     List versions
```

### Project Session Endpoints

```
POST   /api/projects/{pid}/sessions           Create session
GET    /api/projects/{pid}/sessions           List sessions
GET    /api/projects/{pid}/sessions/{id}      Get session
POST   /api/projects/{pid}/sessions/{id}/start    Start session
POST   /api/projects/{pid}/sessions/{id}/cancel   Cancel session
GET    /api/projects/{pid}/sessions/{id}/diff     Get changes diff
POST   /api/projects/{pid}/sessions/{id}/test     Run tests
POST   /api/projects/{pid}/sessions/{id}/commit   Commit changes
```

---

## 6. CLI Commands

### Foundry Commands

```bash
# Drafts
maestro foundry draft create [options]
maestro foundry draft list [filters]
maestro foundry draft show <id>
maestro foundry draft edit <id> [options]
maestro foundry draft delete <id>
maestro foundry draft ready <id>

# Sessions
maestro foundry session create [options]
maestro foundry session list [filters]
maestro foundry session show <id>
maestro foundry session start <id> [--wait]
maestro foundry session status <id>
maestro foundry session metrics <id>
maestro foundry session follow <id>
maestro foundry session pause <id>
maestro foundry session resume <id>
maestro foundry session cancel <id>

# Evaluation
maestro foundry session pending <id>
maestro foundry session evaluate <id> [options]

# Improvements
maestro foundry session improvements <id>
maestro foundry session improve <id> --apply <imp-id>
maestro foundry session improve <id> --apply-all

# Comparison
maestro foundry session compare <id1> <id2>

# Publication
maestro foundry publish <draft-id> [options]
maestro foundry unpublish <block-id>@<version>
maestro foundry versions <block-id>

# Catalog
maestro foundry catalog [filters]
maestro foundry catalog show <block-id>
maestro foundry catalog search <query>
```

### Project Session Commands

```bash
maestro project session create [options]
maestro project session list [filters]
maestro project session show <id>
maestro project session start <id> [--wait]
maestro project session status <id>
maestro project session diff <id>
maestro project session test <id>
maestro project session commit <id> [options]
maestro project session cancel <id>
```

---

## 7. Data Storage

### File Structure

```
data/
├── foundry/
│   ├── drafts/
│   │   └── {draft-id}.draft.json
│   ├── sessions/
│   │   └── {session-id}.session.json
│   └── catalog/
│       └── {block-id}/
│           ├── manifest.json
│           └── versions/
│               ├── 1.0.0.json
│               └── 1.1.0.json
└── projects/
    └── {project-id}/
        └── sessions/
            └── {session-id}.session.json
```

---

## 8. Implementation Phases

### Phase 1: Core Models (Week 1)
- Session entity and related models
- FoundrySessionConfig and ProjectSessionConfig
- EvaluationConfig with all modes

### Phase 2: Foundry Service (Week 2)
- Draft management
- Session lifecycle
- Auto-evaluation integration

### Phase 3: API & CLI (Week 3)
- REST endpoints
- CLI commands
- SignalR hub for real-time updates

### Phase 4: Project Sessions (Week 4)
- Project session service
- Access control
- Commit integration

### Phase 5: Frontend & Migration (Week 5)
- Foundry UI
- Project session UI
- Migrate from old Training/Testing

---

## 9. Migration from Old System

### Mapping

| Old | New |
|-----|-----|
| `TrainingConfiguration` | `Draft` + default `FoundrySessionConfig` |
| `TrainingRun` | `Session` (type=Foundry) |
| `TrainingIteration` | `SessionIteration` |
| `BlockTestRun` | `Session` (type=Foundry, iterations=N) |
| `BlockTestIteration` | `SessionIteration` |

### Migration Script

```csharp
public async Task MigrateAsync(CancellationToken ct)
{
    // Migrate Training Runs
    var trainingRuns = await _oldTrainingRepo.GetAllAsync(ct: ct);
    foreach (var run in trainingRuns)
    {
        var session = new Session
        {
            Id = run.Id,
            Name = run.Name,
            Type = SessionType.Foundry,
            BlockId = run.WorkflowId,
            Status = MapStatus(run.Status),
            FoundryConfig = new FoundrySessionConfig
            {
                Iterations = run.TotalIterations,
                Evaluation = new EvaluationConfig
                {
                    Mode = EvaluationMode.Manual  // Old system was manual
                }
            },
            Iterations = run.Iterations.Select(MapIteration).ToList()
        };
        await _sessionRepo.SaveAsync(session, ct);
    }

    // Migrate Block Test Runs
    var testRuns = _oldTestRepo.GetAll().Values;
    foreach (var run in testRuns)
    {
        var session = new Session
        {
            Id = run.Id,
            Name = run.Name,
            Type = SessionType.Foundry,
            BlockId = run.BlockId,
            // ... similar mapping
        };
        await _sessionRepo.SaveAsync(session, ct);
    }
}
```

---

## 10. Summary

This architecture provides:

1. **Unified Session Model** - One entity for both Foundry and Project sessions
2. **Evaluation at Creation** - No manual intervention needed after session starts
3. **Multiple Evaluation Modes** - Auto, Manual, Hybrid to fit different needs
4. **Clear Separation** - Foundry for development, Project for production
5. **Full Automation** - External AIs can run complete optimization loops via CLI
