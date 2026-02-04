# Migration Guide: ContainerSession Hierarchy

**Version**: 1.0.0
**Date**: February 4, 2026
**Breaking Changes**: Yes (ExecutionSession removed)

---

## Overview

This guide covers the migration from the old session system to the new unified `ContainerSession` hierarchy. The primary breaking change is the removal of `ExecutionSession` in favor of `ProjectSession` and `FoundrySession`.

---

## Breaking Changes

### 1. ExecutionSession Removed

The `ExecutionSession` entity and all related types have been removed:

| Removed Type | Replacement |
|--------------|-------------|
| `ExecutionSession` | `ProjectSession` or `FoundrySession` |
| `IExecutionSessionRepository` | `IProjectSessionRepository` or `IFoundrySessionRepository` |
| `IExecutionSessionService` | `IProjectSessionServer` |
| `ExecutionSessionDto` | `ProjectSessionDto` |
| `ExecutionSessionsController` | `SessionsController` or `ProjectSessionsController` |

### 2. API Endpoint Changes

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `POST /api/execution-sessions` | `POST /api/sessions` |
| `GET /api/execution-sessions/{id}` | `GET /api/sessions/{id}` |
| `DELETE /api/execution-sessions/{id}` | `DELETE /api/sessions/{id}` |

### 3. Status Enum Changes

The status enums have been unified:

```csharp
// Old: Multiple enums
enum ExecutionSessionStatus { Created, Active, Paused, Completed, Failed }
enum ProjectSessionStatus { Created, Running, Paused, Completed, Failed, Cancelled, Stopped }

// New: Unified enum
enum ContainerSessionStatus { Created, Active, Paused, Ended, Archived, Expired }
```

**Mapping:**
| Old Status | New Status |
|------------|------------|
| `Created` | `Created` |
| `Active` / `Running` | `Active` |
| `Paused` | `Paused` |
| `Completed` / `Failed` / `Cancelled` / `Stopped` | `Ended` |

For sessions that need to track terminal reasons, use `Session.TerminalReason`:
```csharp
public enum SessionTerminalReason { None, Completed, Failed, Cancelled, Stopped }
```

---

## Migration Steps

### Step 1: Update Session Creation

**Before:**
```csharp
var session = await _executionSessionService.CreateAsync(new CreateExecutionSessionRequest
{
    Name = "My Session",
    Type = "default",
    ParentWorkspaceId = workspaceId,
    CreatedByAgentId = agentId
});
```

**After:**
```csharp
// For development/project work
var config = new ProjectSessionConfig
{
    ProjectId = projectId,
    Task = "Fix bug #123",
    Access = new AccessConfig { Level = AccessLevel.Controlled }
};
var session = await _sessionServer.CreateAsync("My Session", Authority.Human(), config);

// For training/experimentation
var foundryConfig = new FoundrySessionConfig
{
    Source = SessionSource.Sandbox,
    SandboxImage = "maestro/sandbox:latest"
};
var foundrySession = FoundrySession.Create("Training Session", Authority.Agent(), foundryConfig);
```

### Step 2: Update Session Retrieval

**Before:**
```csharp
var session = await _executionSessionService.GetAsync(sessionId);
var permissions = await _executionSessionService.GetEffectivePermissionsAsync(sessionId);
```

**After:**
```csharp
var sessionId = SessionId.From(id);
var session = await _sessionServer.GetAsync(sessionId);
var permissions = session.GetEffectivePermissions();
```

### Step 3: Update Status Checks

**Before:**
```csharp
if (session.Status == ExecutionSessionStatus.Active)
{
    // ...
}
```

**After:**
```csharp
// Option 1: Use helper properties
if (session.IsRunning)
{
    // ...
}

// Option 2: Use unified status
if (session.Status == ContainerSessionStatus.Active)
{
    // ...
}

// Option 3: Check granular session status
if (session.GetSessionStatus() == SessionStatus.Running)
{
    // ...
}
```

### Step 4: Update Permission Resolution

**Before:**
```csharp
public class PermissionChecker
{
    private readonly IExecutionSessionService _sessionService;

    public async Task<ContextPermissions> GetPermissionsAsync(string sessionId)
    {
        return await _sessionService.GetEffectivePermissionsAsync(sessionId);
    }
}
```

**After:**
```csharp
public class PermissionChecker
{
    private readonly IProjectSessionServer _sessionServer;

    public async Task<ContextPermissions> GetPermissionsAsync(string sessionId)
    {
        var session = await _sessionServer.GetAsync(SessionId.From(sessionId));
        return session?.GetEffectivePermissions() ?? ContextPermissions.None;
    }
}
```

---

## New Features

### 1. Unified Permission Inheritance

All session types now support permission inheritance from parent contexts:

```csharp
// Workspace defines maximum permissions
var workspace = Workspace.Create("Research", WorkspaceType.Research);
workspace.UpdatePermissions(new ContextPermissions
{
    AllowedCommands = new[] { "*" },
    AllowedTools = new[] { "*" },
    CanCreateBlocks = true
});

// Session restricts from parent
var session = ProjectSession.CreateInWorkspace(workspace, "Dev Session", authority, config);
session.UpdatePermissions(new ContextPermissions
{
    AllowedCommands = new[] { "run", "data" },
    AllowedTools = new[] { "fitness-*" },
    CanCreateBlocks = false
});

// GetEffectivePermissions() returns intersection of chain
var effective = session.GetEffectivePermissions();
// Result: { AllowedCommands: ["run", "data"], AllowedTools: ["fitness-*"], CanCreateBlocks: false }
```

### 2. Container Binding

Sessions now have explicit container binding configuration:

```csharp
// Repository-bound session (ProjectSession)
session.Binding.Type == ContainerBindingType.Repository
session.Binding.RepositoryPath // "C:/projects/my-app"
session.Binding.DockerBindPath // "/workspace"
session.Binding.AccessLevel   // ReadWrite, ReadOnly

// Sandbox session (FoundrySession)
session.Binding.Type == ContainerBindingType.Sandbox
session.Binding.SandboxImage // "maestro/sandbox:latest"

// No binding (Workspace)
workspace.Binding.Type == ContainerBindingType.None
```

### 3. File Persistence

All sessions are now persisted to disk:

| Session Type | Location |
|--------------|----------|
| Workspace | `data/workspaces/{id}.workspace.json` |
| ProjectSession | `{project}/.maestro/sessions/{id}.session.json` |
| FoundrySession | `data/foundry/sessions/{id}.session.json` |

### 4. Command/Event History

The `Session` base class provides centralized command and event tracking:

```csharp
// Submit a command
var command = session.SubmitCommand("run fitness-calculator");

// Record result
session.RecordCommandResult(command, success: true, output: "Score: 0.85");

// Access history
foreach (var cmd in session.CommandHistory)
{
    Console.WriteLine($"{cmd.Command} -> {cmd.Success}");
}

// Access events
foreach (var evt in session.EventHistory)
{
    Console.WriteLine($"[{evt.Type}] {evt.Message}");
}
```

---

## Class Hierarchy Reference

```
ContainerSession (abstract)
├── Id, Name, Description
├── Status (ContainerSessionStatus)
├── Permissions (ContextPermissions)
├── Binding (ContainerBinding)
├── GetEffectivePermissions()
├── GetStorageExtension()
│
├── Workspace : ContainerSession
│   ├── WorkspaceType
│   ├── SessionIds, ProjectIds
│   ├── SessionTemplates
│   ├── WorkspaceIsolation
│   └── Storage: .workspace.json
│
└── Session : ContainerSession (abstract)
    ├── ParentWorkspaceId
    ├── ParentSessionId
    ├── Authority
    ├── CommandHistory
    ├── EventHistory
    ├── BlockRegistry
    ├── Start(), Pause(), Resume(), Stop()
    │
    ├── ProjectSession : Session
    │   ├── Config (ProjectSessionConfig)
    │   ├── WorkingDirectory
    │   ├── ModifiedFiles
    │   ├── TestResult, LinterResult
    │   └── Binding: Repository
    │
    └── FoundrySession : Session
        ├── Config (FoundrySessionConfig)
        ├── LoadedDraftId
        ├── FoundryTrainingStatus
        ├── Iterations, Improvements
        └── Binding: Sandbox
```

---

## Troubleshooting

### Error: "Type 'ExecutionSession' not found"

**Cause:** ExecutionSession has been removed.

**Solution:** Replace with `ProjectSession` or `FoundrySession` depending on use case.

### Error: "Cannot convert 'ContainerSessionStatus' to 'SessionStatus'"

**Cause:** Status enums have been unified.

**Solution:** Use `session.GetSessionStatus()` for backwards-compatible status, or update to use `ContainerSessionStatus`.

### Error: "session.Id.Value does not exist"

**Cause:** Session.Id is now a `string`, not a `SessionId` value object.

**Solution:** Use `session.Id` directly instead of `session.Id.Value`.

---

## Support

For questions or issues with the migration, refer to:
- `docs/architecture/DESIGN-CONTAINER-SESSION-HIERARCHY.md` - Full design document
- `docs/issues/REFACTOR-CONTAINER-SESSION-HIERARCHY.md` - Implementation details
