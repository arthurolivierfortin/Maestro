# Design: ContainerSession Hierarchy

**Status**: Implemented ✅
**Date**: February 4, 2026
**Implementation**: Phases 1-6 Complete
**Related**: `DESIGN-SESSION-BASED-PERMISSIONS.md`, `MAESTRO-PHILOSOPHY-V2.md`

---

## Summary

This document describes the refactoring of Workspace and Session entities into a unified class hierarchy based on `ContainerSession`. This design eliminates code duplication, centralizes container binding logic, and creates a clean inheritance chain for permission management.

---

## Problem Statement

### Current State (Fragmented)

The current codebase has four separate entity classes with significant overlap:

```
Workspace              ExecutionSession        ProjectSession          FoundrySession
├─ ContextPermissions  ├─ ContextPermissions   ├─ AccessConfig         ├─ SessionSource
├─ WorkspaceIsolation  ├─ Status (4 states)    ├─ CommandHistory       ├─ CommandHistory
├─ Status (3 states)   ├─ ParentWorkspaceId    ├─ EventHistory         ├─ EventHistory
├─ NetworkConfig       ├─ CommandCount         ├─ Status (7 states)    ├─ Status (7 states)
└─ File: .workspace    └─ IN-MEMORY ONLY       └─ File: .session       └─ Iterations
```

### Issues Identified

| Issue | Impact |
|-------|--------|
| **ContextPermissions duplicated** | Workspace and ExecutionSession both implement permission logic |
| **Command/EventHistory duplicated** | ProjectSession and FoundrySession have identical implementations |
| **Status management scattered** | 4 different status enums with overlapping transitions |
| **Container binding not unified** | SessionSource (Sandbox/Repository) vs ProjectContainerService |
| **ExecutionSession has no persistence** | Data lost on application restart |
| **No clear inheritance** | No way to share behavior across session types |

### Lines of Code Duplicated

- Status transition logic: ~80 lines × 4 = 320 lines
- Command/Event history: ~150 lines × 2 = 300 lines
- Permission inheritance: ~50 lines × 2 = 100 lines
- **Total duplication: ~720 lines**

---

## Solution: ContainerSession Hierarchy

### Design Principles

1. **Single Responsibility**: Each class handles one level of abstraction
2. **DRY (Don't Repeat Yourself)**: Common logic in base classes
3. **Open/Closed**: Easy to extend without modifying base classes
4. **Liskov Substitution**: Subtypes are substitutable for their base types
5. **Backwards Compatible**: Existing APIs continue to work

### Class Hierarchy

```
                         ContainerSession (abstract)
                         ├─ Id, Name, Description
                         ├─ Status (unified enum)
                         ├─ ContextPermissions
                         ├─ ContainerBinding (sandbox | repo | none)
                         ├─ CreatedAt, UpdatedAt
                         ├─ GetEffectivePermissions() ← unified
                         └─ GetStorageExtension() ← abstract
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
              Workspace                                    Session
              : ContainerSession                           : ContainerSession
              ├─ WorkspaceType                             ├─ ParentWorkspaceId
              ├─ SessionIds, ProjectIds                    ├─ ParentSessionId (nesting)
              ├─ SessionTemplates                          ├─ Authority
              ├─ WorkspaceIsolation                        ├─ CommandHistory ← centralized
              │   (network, resources)                     ├─ EventHistory ← centralized
              ├─ EntryPoints                               ├─ BlockRegistry
              └─ Storage: .workspace.json                  └─ Storage: .session.json
                                                                    │
                                                     ┌──────────────┴───────────────┐
                                                     │                              │
                                               ProjectSession                 FoundrySession
                                               : Session                      : Session
                                               ├─ ProjectId                   ├─ LoadedDraftId
                                               ├─ Binding: Repository         ├─ Binding: Sandbox
                                               ├─ Creates .maestro/           ├─ TrainingStatus
                                               ├─ FileChanges                 ├─ Iterations
                                               ├─ TestResult                  ├─ Improvements
                                               ├─ CommitInfo                  └─ Metrics
                                               └─ RunningAgents
```

---

## Core Components

### 1. ContainerSession (Base Class)

The abstract base class providing:

- **Identity**: Id, Name, Description
- **Lifecycle**: Status with unified transitions
- **Permissions**: ContextPermissions with inheritance chain
- **Container Binding**: Unified sandbox/repository/none binding
- **Timestamps**: CreatedAt, UpdatedAt, CreatedBy

```csharp
public abstract class ContainerSession
{
    public string Id { get; protected set; }
    public string Name { get; protected set; }
    public ContainerSessionStatus Status { get; protected set; }
    public ContextPermissions Permissions { get; protected set; }
    public ContainerBinding Binding { get; protected set; }

    // Template method for permission inheritance
    public virtual ContextPermissions GetEffectivePermissions()
    {
        var parent = GetParentContext();
        return parent == null
            ? Permissions
            : parent.GetEffectivePermissions().Intersect(Permissions);
    }

    public abstract ContainerSession? GetParentContext();
    public abstract string GetStorageExtension();
    protected abstract bool CanTransitionTo(ContainerSessionStatus newStatus);
}
```

### 2. ContainerBinding (Value Object)

Unified container binding configuration:

```csharp
public record ContainerBinding
{
    public ContainerBindingType Type { get; init; }  // None, Sandbox, Repository

    // Sandbox
    public string? SandboxImage { get; init; }

    // Repository
    public string? RepositoryPath { get; init; }
    public string DockerBindPath { get; init; } = "/workspace";
    public RepositoryAccessLevel AccessLevel { get; init; }
    public IReadOnlyList<string> ExcludePatterns { get; init; }

    // Runtime
    public RuntimeConfiguration? RuntimeConfig { get; init; }
}
```

### 3. ContainerSessionStatus (Unified Enum)

Single status enum for all container sessions:

```csharp
public enum ContainerSessionStatus
{
    Created,    // Initial state (all)
    Active,     // Running/operational (all)
    Paused,     // Temporarily suspended (all)
    Ended,      // Completed/terminated (Session only)
    Archived,   // Long-term storage (Workspace only)
    Expired     // Timed out (Session only)
}
```

### 4. Session (Intermediate Class)

Base for all interactive sessions:

```csharp
public abstract class Session : ContainerSession
{
    public string ParentWorkspaceId { get; protected set; }
    public string? ParentSessionId { get; protected set; }
    public Authority Authority { get; protected set; }

    // Centralized command/event tracking
    public IReadOnlyList<SessionCommand> CommandHistory { get; }
    public IReadOnlyList<SessionEvent> EventHistory { get; }

    public SessionCommand SubmitCommand(string input);
    public void RecordCommandResult(SessionCommand cmd, bool success, ...);
}
```

---

## Permission Inheritance

### Chain of Responsibility

```
Workspace.Permissions          (Maximum allowed - defines ceiling)
         │
         │  GetEffectivePermissions() calls parent.Intersect(this)
         ▼
Session.Permissions            (Can only restrict from parent)
         │
         │  GetEffectivePermissions() calls parent.Intersect(this)
         ▼
NestedSession.Permissions      (Most restrictive - intersection of chain)
```

### Example

```csharp
// Workspace allows everything
workspace.Permissions = { AllowedCommands: ["*"], AllowedTools: ["*"] }

// Session restricts to training only
session.Permissions = { AllowedCommands: ["run", "data"], AllowedTools: ["fitness-*"] }

// Effective = intersection
session.GetEffectivePermissions()
// → { AllowedCommands: ["run", "data"], AllowedTools: ["fitness-*"] }
```

---

## Container Binding Patterns

### Pattern 1: Workspace (No Direct Binding)

Workspaces don't bind to containers directly. They define isolation configuration for child sessions.

```csharp
var workspace = Workspace.Create("Research", WorkspaceType.Research);
// workspace.Binding = ContainerBinding.None
// workspace.Isolation = WorkspaceIsolation with network/resource config
```

### Pattern 2: ProjectSession (Repository Binding)

Project sessions bind to a real Git repository via Docker volume mount.

```csharp
var session = ProjectSession.Create(
    name: "Fix Bug #123",
    workspaceId: "ws-research",
    projectId: "proj-myapp",
    repositoryPath: "C:/projects/my-app",
    authority: Authority.Human
);
// session.Binding.Type = ContainerBindingType.Repository
// session.Binding.RepositoryPath = "C:/projects/my-app"
// session.Binding.DockerBindPath = "/workspace"

// Container mount: C:/projects/my-app:/workspace:rw
```

### Pattern 3: FoundrySession (Sandbox Binding)

Foundry sessions use isolated sandbox containers with no persistence.

```csharp
var session = FoundrySession.Create(
    name: "Train commit-generator",
    workspaceId: "ws-research",
    authority: Authority.Agent,
    draftId: "draft-commit-gen"
);
// session.Binding.Type = ContainerBindingType.Sandbox
// session.Binding.SandboxImage = "maestro/sandbox:latest"

// Container: isolated, temporary, no volume mounts
```

---

## Storage Patterns

### File Naming Convention

| Entity Type | Extension | Location |
|-------------|-----------|----------|
| Workspace | `.workspace.json` | `data/workspaces/{id}.workspace.json` |
| ProjectSession | `.session.json` | `{project}/.maestro/sessions/{id}.session.json` |
| FoundrySession | `.session.json` | `data/foundry/sessions/{id}.session.json` |

### JSON Structure

Both session types share the same base structure:

```json
{
  "id": "sess-abc123",
  "name": "Training Session",
  "type": "foundry",
  "status": "active",
  "parentWorkspaceId": "ws-research",
  "authority": "agent:trainer-agent",

  "permissions": {
    "allowedCommands": ["run", "data"],
    "allowedTools": ["fitness-calculator"],
    "canCreateBlocks": false
  },

  "binding": {
    "type": "sandbox",
    "sandboxImage": "maestro/sandbox:latest"
  },

  "commandHistory": [...],
  "eventHistory": [...],

  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:30:00Z"
}
```

---

## Migration Strategy

### Backwards Compatibility

1. **Existing APIs preserved**: All existing service methods continue to work
2. **DTOs unchanged**: API contracts remain the same
3. **Gradual migration**: Old entities coexist during transition

### ExecutionSession Removal (Completed)

`ExecutionSession` has been **removed** and replaced by the `Session` hierarchy:

| ExecutionSession (Removed) | Session Equivalent |
|----------------------------|-------------------|
| `ParentWorkspaceId` | `ParentWorkspaceId` |
| `ParentSessionId` | `ParentSessionId` |
| `Permissions` | `Permissions` (inherited from ContainerSession) |
| `Status` | `Status` (unified ContainerSessionStatus enum) |
| `CommandCount` | `CommandHistory.Count` |
| `MaxIterations` | Config property on concrete session types |
| `CurrentAgentId` | `Authority` (with Human/Agent/AI tracking) |

**Files Removed:**
- `ExecutionSession.cs` - Domain entity
- `IExecutionSessionRepository.cs` - Repository interface
- `IExecutionSessionService.cs` - Service interface
- `InMemoryExecutionSessionRepository.cs` - In-memory implementation
- `ExecutionSessionService.cs` - Service implementation
- `ExecutionSessionDto.cs` - DTO
- `ExecutionSessionsController.cs` - API controller

**Migration Path:**
- Use `ProjectSession` for repository-bound development sessions
- Use `FoundrySession` for sandboxed training/experimentation sessions
- Both inherit from `Session` which provides all ExecutionSession functionality with persistence

---

## Trade-offs

### Advantages

| Benefit | Description |
|---------|-------------|
| **~720 lines removed** | Eliminates duplicated code |
| **Single permission chain** | One implementation for inheritance |
| **Unified container binding** | Sandbox/Repository in one place |
| **Persistence for all sessions** | No more in-memory only sessions |
| **Extensible** | Easy to add new session types |
| **Testable** | Base classes can be unit tested once |

### Limitations

| Limitation | Mitigation |
|------------|------------|
| **More classes** | Clear hierarchy reduces cognitive load |
| **Migration effort** | Phased approach minimizes risk |
| **Breaking changes** | Backwards-compatible APIs |

---

## Related Documents

- `DESIGN-SESSION-BASED-PERMISSIONS.md` - Permission model details
- `MAESTRO-PHILOSOPHY-V2.md` - Core principles
- `IMPLEMENTATION-CONTAINER-SESSION-REFACTOR.md` - Implementation phases

---

*"Context defines permissions, not agent identity. Container defines isolation, not session type."*
