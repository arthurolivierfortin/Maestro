# Phase 2: Session Management - Detailed Implementation Plan

> **⚠️ SUPERSEDED**: This document describes the original `ExecutionSession` implementation which has been replaced by the unified `ContainerSession` hierarchy. See:
> - `docs/architecture/DESIGN-CONTAINER-SESSION-HIERARCHY.md` - New design
> - `docs/guides/MIGRATION-CONTAINER-SESSION-HIERARCHY.md` - Migration guide
> - `docs/issues/REFACTOR-CONTAINER-SESSION-HIERARCHY.md` - Implementation details
>
> The concepts in this document are still valid, but the implementation now uses `Session` (abstract), `ProjectSession`, and `FoundrySession` instead of `ExecutionSession`.

## Overview

**Goal**: Enable session creation with permission inheritance from workspace.

**Key Concept**: Sessions are lightweight permission contexts that restrict from their parent (workspace or parent session). When an agent needs restricted permissions, it runs in a session.

---

## Analysis of Existing Sessions

| Entity | Purpose | Has ContextPermissions? |
|--------|---------|-------------------------|
| `ProjectSession` | Interactive project work with commands/events | ❌ (has `AccessLevel`) |
| `FoundrySession` | Block development | ❌ |
| `TrainingSession` | Workflow comparison | ❌ |

**Decision**: Create a new `ExecutionSession` entity focused on CLI permission context. The existing sessions serve specialized purposes and can be extended later if needed.

---

## Implementation Steps

### Step 1: Create ExecutionSession Entity

**File**: `backend/src/Maestro.Domain/Entities/ExecutionSession.cs`

```csharp
namespace Maestro.Domain.Entities;

/// <summary>
/// Execution session status.
/// </summary>
public enum ExecutionSessionStatus
{
    Active,
    Paused,
    Ended,
    Expired
}

/// <summary>
/// Lightweight execution session for CLI permission context.
/// Sessions restrict permissions from their parent (workspace or session).
/// </summary>
public class ExecutionSession
{
    public string Id { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Type { get; private set; } = string.Empty;  // "training", "evaluation", "foundry", etc.

    // Parent context (one of these is set)
    public string ParentWorkspaceId { get; private set; } = string.Empty;
    public string? ParentSessionId { get; private set; }

    // Who created this session
    public string? CreatedByAgentId { get; private set; }

    // Permissions for this context
    public ContextPermissions Permissions { get; private set; } = ContextPermissions.None;

    // State
    public ExecutionSessionStatus Status { get; private set; }
    public string? CurrentAgentId { get; private set; }
    public Dictionary<string, object> Context { get; private set; } = new();

    // Timestamps
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? EndedAt { get; private set; }
    public DateTimeOffset? ExpiresAt { get; private set; }

    // Audit
    public bool LogAllCommands { get; private set; }
    public int CommandCount { get; private set; }
    public int MaxIterations { get; private set; }

    private ExecutionSession() { }

    // Factory methods and update methods...
}
```

### Step 2: Create IExecutionSessionService Interface

**File**: `backend/src/Maestro.Application/Interfaces/IExecutionSessionService.cs`

```csharp
public interface IExecutionSessionService
{
    // CRUD
    Task<ExecutionSession> CreateAsync(CreateExecutionSessionRequest request, CancellationToken ct = default);
    Task<ExecutionSession?> GetAsync(string sessionId, CancellationToken ct = default);
    Task<IReadOnlyList<ExecutionSession>> ListByWorkspaceAsync(string workspaceId, CancellationToken ct = default);
    Task<IReadOnlyList<ExecutionSession>> ListByParentSessionAsync(string parentSessionId, CancellationToken ct = default);
    Task<ExecutionSession> EndAsync(string sessionId, CancellationToken ct = default);

    // Agent attachment
    Task<ExecutionSession> AttachAgentAsync(string sessionId, string agentId, CancellationToken ct = default);
    Task<ExecutionSession> DetachAgentAsync(string sessionId, CancellationToken ct = default);

    // Permission computation
    Task<ContextPermissions> GetEffectivePermissionsAsync(string sessionId, CancellationToken ct = default);

    // Session from template
    Task<ExecutionSession> CreateFromTemplateAsync(
        string workspaceId,
        string templateType,
        string? createdByAgentId = null,
        CancellationToken ct = default);
}

public class CreateExecutionSessionRequest
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ParentWorkspaceId { get; set; } = string.Empty;
    public string? ParentSessionId { get; set; }
    public string? CreatedByAgentId { get; set; }
    public ContextPermissions? Permissions { get; set; }
    public bool LogAllCommands { get; set; } = true;
    public int MaxIterations { get; set; }
    public TimeSpan? MaxDuration { get; set; }
}
```

### Step 3: Create ExecutionSessionDto

**File**: `backend/src/Maestro.Application/DTOs/ExecutionSessionDto.cs`

```csharp
public class ExecutionSessionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ParentWorkspaceId { get; set; } = string.Empty;
    public string? ParentSessionId { get; set; }
    public string? CreatedByAgentId { get; set; }
    public ContextPermissionsDto Permissions { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string? CurrentAgentId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public int CommandCount { get; set; }

    public static ExecutionSessionDto FromDomain(ExecutionSession session) { ... }
}

public class CreateExecutionSessionRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ParentWorkspaceId { get; set; } = string.Empty;
    public string? ParentSessionId { get; set; }
    public string? CreatedByAgentId { get; set; }
    public ContextPermissionsDto? Permissions { get; set; }
    public bool LogAllCommands { get; set; } = true;
    public int MaxIterations { get; set; }
    public int? MaxDurationMinutes { get; set; }
}
```

### Step 4: Implement ExecutionSessionService

**File**: `backend/src/Maestro.Infrastructure/Sessions/ExecutionSessionService.cs`

Key logic:
- `CreateAsync`: Validate permissions don't exceed parent
- `GetEffectivePermissionsAsync`: Compute intersection of session chain
- `CreateFromTemplateAsync`: Create session from workspace template

### Step 5: Create ExecutionSessionsController

**File**: `backend/src/Maestro.Api/Controllers/ExecutionSessionsController.cs`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/{id}` | Get session |
| GET | `/api/sessions?workspaceId=X` | List sessions by workspace |
| POST | `/api/sessions/{id}/attach` | Attach agent |
| POST | `/api/sessions/{id}/end` | End session |
| GET | `/api/sessions/{id}/permissions` | Get effective permissions |
| POST | `/api/sessions/from-template` | Create from template |

---

## Permission Inheritance Logic

```
GetEffectivePermissions(sessionId):
    session = GetSession(sessionId)

    if session.ParentSessionId != null:
        # Nested session: inherit from parent session
        parentPerms = GetEffectivePermissions(session.ParentSessionId)
    else:
        # Top-level session: inherit from workspace
        workspace = GetWorkspace(session.ParentWorkspaceId)
        parentPerms = workspace.Permissions

    # Return intersection (session can only restrict, not expand)
    return parentPerms.Intersect(session.Permissions)
```

---

## Files Summary

### New Files (5)

| File | Purpose |
|------|---------|
| `backend/src/Maestro.Domain/Entities/ExecutionSession.cs` | Session entity |
| `backend/src/Maestro.Application/Interfaces/IExecutionSessionService.cs` | Service interface |
| `backend/src/Maestro.Application/Interfaces/IExecutionSessionRepository.cs` | Repository interface |
| `backend/src/Maestro.Application/DTOs/ExecutionSessionDto.cs` | DTOs |
| `backend/src/Maestro.Api/Controllers/ExecutionSessionsController.cs` | API controller |

### Implementation Files (2)

| File | Purpose |
|------|---------|
| `backend/src/Maestro.Infrastructure/Sessions/ExecutionSessionService.cs` | Service implementation |
| `backend/src/Maestro.Infrastructure/Sessions/InMemoryExecutionSessionRepository.cs` | Repository implementation |

---

## Verification

```bash
# Build
cd backend && dotnet build

# Test session creation
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Training Session 1",
    "type": "training",
    "parentWorkspaceId": "model-research",
    "permissions": {
      "allowedCommands": ["run", "data"],
      "allowedTools": ["system:fitness-calculator"]
    }
  }'

# Test create from template
curl -X POST http://localhost:5000/api/sessions/from-template \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "model-research",
    "templateType": "training"
  }'

# Test get effective permissions
curl http://localhost:5000/api/sessions/{session-id}/permissions
```

---

## Integration with CLI Executor (Phase 3)

When the CLI Executor receives a request with `context.sessionId`:

```csharp
// In CliExecutor
public async Task<CliResult> ExecuteAsync(string command, ExecutionContext context)
{
    ContextPermissions permissions;

    if (!string.IsNullOrEmpty(context.SessionId))
    {
        // Get session's effective permissions
        permissions = await _sessionService.GetEffectivePermissionsAsync(context.SessionId);
    }
    else if (!string.IsNullOrEmpty(context.WorkspaceId))
    {
        // Get workspace permissions
        var workspace = await _workspaceService.GetAsync(context.WorkspaceId);
        permissions = workspace.Permissions;
    }
    else
    {
        return CliResult.PermissionDenied("No context provided");
    }

    // Check permissions...
}
```

---

*Phase 2 establishes session-based permission contexts.*
