# Phase 1: Workspace Foundation - Detailed Implementation Plan

**Status**: ✅ COMPLETED

## Overview

**Goal**: Enable workspace creation, loading, and permission configuration for context-based CLI access.

**Key Concept**: Permissions are tied to **contexts** (workspaces and sessions), not to agent identities. The existing `WorkspacePermissions` handles **cross-workspace** permissions (can read from, write to, promote to). This phase adds `ContextPermissions` which control what can be done via CLI within a workspace or session.

**Design Document**: `docs/architecture/DESIGN-SESSION-BASED-PERMISSIONS.md`

---

## Gap Analysis

### What Exists

| File | Current State |
|------|---------------|
| `Workspace.cs` | Has `WorkspaceType`, `WorkspaceStatus`, `WorkspaceSettings`, `WorkspaceIsolation` |
| `WorkspaceIsolation.cs` | Has `WorkspacePermissions` for **cross-workspace** access (read/write/promote) |
| `BlockPermission.cs` | Has block-level permission rules (Allow/Deny/RequiresApproval) |
| `IWorkspaceService.cs` | Has CRUD operations, session/project management, topology |
| `WorkspaceDto.cs` | Has DTOs matching current entity structure |

### What's Missing (Now Implemented)

| Component | Purpose | Status |
|-----------|---------|--------|
| `ContextPermissions` | Command/tool/block permissions within context | ✅ |
| `SessionTemplate` | Pre-configured session types with permissions | ✅ |
| `Workspace.Path` | Filesystem path for workspace | ✅ |
| `Workspace.EntryPoints` | Named block references (main, dashboard, etc.) | ✅ |
| `Workspace.Permissions` | Default permissions for this workspace context | ✅ |

---

## Implementation Steps

### Step 1: Create ContextPermissions Value Object

**File**: `backend/src/Maestro.Domain/ValueObjects/ContextPermissions.cs`

```csharp
namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Permissions for an execution context (workspace or session).
/// Controls what commands and tools an agent can use.
/// </summary>
public record ContextPermissions
{
    /// <summary>Allowed CLI commands (e.g., "run", "list-tools", "data").</summary>
    public List<string> AllowedCommands { get; init; } = new();

    /// <summary>Allowed tool blocks (e.g., "system:fitness-calculator", "*").</summary>
    public List<string> AllowedTools { get; init; } = new();

    /// <summary>Allowed blocks of any type (e.g., "training-loop", "*").</summary>
    public List<string> AllowedBlocks { get; init; } = new();

    /// <summary>Whether agent can create new blocks.</summary>
    public bool CanCreateBlocks { get; init; }

    /// <summary>Whether agent can create new sessions.</summary>
    public bool CanCreateSessions { get; init; }

    /// <summary>Allowed data collections for read/write (e.g., "experiments", "*").</summary>
    public List<string> DataCollections { get; init; } = new();

    /// <summary>Allowed filesystem paths relative to workspace (e.g., "blocks/", "data/").</summary>
    public List<string> AllowedPaths { get; init; } = new();

    // Factory methods...
    public static ContextPermissions Full => new()
    {
        AllowedCommands = new() { "*" },
        AllowedTools = new() { "*" },
        AllowedBlocks = new() { "*" },
        CanCreateBlocks = true,
        CanCreateSessions = true,
        DataCollections = new() { "*" },
        AllowedPaths = new() { "*" }
    };

    public static ContextPermissions None => new();

    public static ContextPermissions ReadOnly => new()
    {
        AllowedCommands = new() { "list-tools", "list-blocks", "describe", "data" },
        AllowedTools = new(),
        AllowedBlocks = new(),
        CanCreateBlocks = false,
        CanCreateSessions = false,
        DataCollections = new() { "*" },
        AllowedPaths = new()
    };

    // Permission checking methods...
    public bool HasCommand(string command) =>
        AllowedCommands.Contains("*") || AllowedCommands.Contains(command);

    public bool HasTool(string toolId) =>
        AllowedTools.Contains("*") || AllowedTools.Contains(toolId) ||
        AllowedTools.Any(pattern => MatchesPattern(toolId, pattern));

    public bool HasBlock(string blockId) =>
        AllowedBlocks.Contains("*") || AllowedBlocks.Contains(blockId) ||
        AllowedBlocks.Any(pattern => MatchesPattern(blockId, pattern));

    public bool HasDataCollection(string collection) =>
        DataCollections.Contains("*") || DataCollections.Contains(collection);

    private static bool MatchesPattern(string value, string pattern)
    {
        if (pattern.EndsWith("/*"))
        {
            var prefix = pattern[..^2];
            return value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
        }
        return false;
    }

    /// <summary>
    /// Computes intersection of two permission sets (for session inheritance).
    /// Result has only permissions present in BOTH sets.
    /// </summary>
    public ContextPermissions Intersect(ContextPermissions other)
    {
        return new ContextPermissions
        {
            AllowedCommands = IntersectLists(AllowedCommands, other.AllowedCommands),
            AllowedTools = IntersectLists(AllowedTools, other.AllowedTools),
            AllowedBlocks = IntersectLists(AllowedBlocks, other.AllowedBlocks),
            CanCreateBlocks = CanCreateBlocks && other.CanCreateBlocks,
            CanCreateSessions = CanCreateSessions && other.CanCreateSessions,
            DataCollections = IntersectLists(DataCollections, other.DataCollections),
            AllowedPaths = IntersectLists(AllowedPaths, other.AllowedPaths)
        };
    }

    private static List<string> IntersectLists(List<string> a, List<string> b)
    {
        if (a.Contains("*")) return new List<string>(b);
        if (b.Contains("*")) return new List<string>(a);
        return a.Intersect(b).ToList();
    }
}
```

---

### Step 2: Create AgentPermissions Value Object

**File**: `backend/src/Maestro.Domain/ValueObjects/AgentPermissions.cs`

```csharp
namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Workspace-level agent permissions configuration.
/// Contains default permissions and per-agent overrides.
/// </summary>
public record AgentPermissions
{
    /// <summary>Default permissions for all agents in this workspace.</summary>
    public ContextPermissions DefaultAgentPermissions { get; init; } = ContextPermissions.Full;

    /// <summary>Per-agent permission overrides (key = agent ID).</summary>
    public Dictionary<string, ContextPermissions> AgentOverrides { get; init; } = new();

    /// <summary>
    /// Get effective permissions for a specific agent.
    /// </summary>
    public ContextPermissions GetPermissionsForAgent(string? agentId)
    {
        if (agentId != null && AgentOverrides.TryGetValue(agentId, out var overridePerms))
        {
            return overridePerms;
        }
        return DefaultAgentPermissions;
    }

    public static AgentPermissions FullAccess => new()
    {
        DefaultAgentPermissions = ContextPermissions.Full,
        AgentOverrides = new()
    };

    public static AgentPermissions ReadOnlyDefault => new()
    {
        DefaultAgentPermissions = ContextPermissions.ReadOnly,
        AgentOverrides = new()
    };
}
```

---

### Step 3: Create SessionTemplate Value Object

**File**: `backend/src/Maestro.Domain/ValueObjects/SessionTemplate.cs`

```csharp
namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Template for creating sessions with pre-configured permissions.
/// </summary>
public record SessionTemplate
{
    /// <summary>Session type identifier (e.g., "training", "foundry", "project").</summary>
    public string Type { get; init; } = string.Empty;

    /// <summary>Human-readable description.</summary>
    public string? Description { get; init; }

    /// <summary>Permissions for sessions created from this template.</summary>
    public ContextPermissions Permissions { get; init; } = ContextPermissions.None;

    /// <summary>Whether to log all CLI commands in this session.</summary>
    public bool LogAllCommands { get; init; } = true;

    /// <summary>Maximum allowed duration in minutes (0 = unlimited).</summary>
    public int MaxDurationMinutes { get; init; }

    /// <summary>Maximum iterations/steps allowed (0 = unlimited).</summary>
    public int MaxIterations { get; init; }

    public static SessionTemplate Training => new()
    {
        Type = "training",
        Description = "Training session with restricted permissions",
        Permissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "list-tools", "data" },
            AllowedTools = new() { "system:fitness-calculator", "system:data-store", "system:metrics-collector" },
            AllowedBlocks = new() { "*" },
            CanCreateBlocks = false,
            CanCreateSessions = false,
            DataCollections = new() { "experiments", "metrics", "checkpoints" }
        },
        LogAllCommands = true
    };

    public static SessionTemplate Foundry => new()
    {
        Type = "foundry",
        Description = "Block development session with full access",
        Permissions = ContextPermissions.Full,
        LogAllCommands = true
    };
}
```

---

### Step 4: Modify Workspace Entity

**File**: `backend/src/Maestro.Domain/Entities/Workspace.cs`

**Changes**:

```csharp
public class Workspace
{
    // ... existing properties ...

    // NEW: Filesystem path for workspace (required for file-based workspaces)
    public string? Path { get; private set; }

    // NEW: Agent permissions (distinct from cross-workspace permissions)
    public AgentPermissions AgentPermissions { get; private set; } = AgentPermissions.FullAccess;

    // NEW: Session templates for this workspace
    public Dictionary<string, SessionTemplate> SessionTemplates { get; private set; } = new();

    // NEW: Named entry points (main workflow, dashboard, etc.)
    public Dictionary<string, string> EntryPoints { get; private set; } = new();

    // NEW: Factory method with full configuration
    public static Workspace CreateWithPath(
        string name,
        string path,
        WorkspaceType type,
        string? description = null,
        string? createdBy = null,
        AgentPermissions? agentPermissions = null,
        Dictionary<string, SessionTemplate>? sessionTemplates = null,
        Dictionary<string, string>? entryPoints = null)
    {
        var workspace = Create(name, type, description, createdBy);
        workspace.Path = path;
        workspace.AgentPermissions = agentPermissions ?? AgentPermissions.FullAccess;
        workspace.SessionTemplates = sessionTemplates ?? new();
        workspace.EntryPoints = entryPoints ?? new();
        return workspace;
    }

    // NEW: Update methods
    public void UpdatePath(string path)
    {
        Path = path;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateAgentPermissions(AgentPermissions permissions)
    {
        AgentPermissions = permissions ?? throw new ArgumentNullException(nameof(permissions));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetSessionTemplate(string templateType, SessionTemplate template)
    {
        SessionTemplates[templateType] = template ?? throw new ArgumentNullException(nameof(template));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void RemoveSessionTemplate(string templateType)
    {
        if (SessionTemplates.Remove(templateType))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void SetEntryPoint(string name, string blockId)
    {
        EntryPoints[name] = blockId ?? throw new ArgumentNullException(nameof(blockId));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void RemoveEntryPoint(string name)
    {
        if (EntryPoints.Remove(name))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }
}
```

---

### Step 5: Create ContextPermissions DTO

**File**: `backend/src/Maestro.Application/DTOs/ContextPermissionsDto.cs`

```csharp
namespace Maestro.Application.DTOs;

public class ContextPermissionsDto
{
    public List<string> AllowedCommands { get; set; } = new();
    public List<string> AllowedTools { get; set; } = new();
    public List<string> AllowedBlocks { get; set; } = new();
    public bool CanCreateBlocks { get; set; }
    public bool CanCreateSessions { get; set; }
    public List<string> DataCollections { get; set; } = new();
    public List<string> AllowedPaths { get; set; } = new();

    public static ContextPermissionsDto FromDomain(ContextPermissions permissions)
    {
        return new ContextPermissionsDto
        {
            AllowedCommands = permissions.AllowedCommands.ToList(),
            AllowedTools = permissions.AllowedTools.ToList(),
            AllowedBlocks = permissions.AllowedBlocks.ToList(),
            CanCreateBlocks = permissions.CanCreateBlocks,
            CanCreateSessions = permissions.CanCreateSessions,
            DataCollections = permissions.DataCollections.ToList(),
            AllowedPaths = permissions.AllowedPaths.ToList()
        };
    }

    public ContextPermissions ToDomain()
    {
        return new ContextPermissions
        {
            AllowedCommands = AllowedCommands,
            AllowedTools = AllowedTools,
            AllowedBlocks = AllowedBlocks,
            CanCreateBlocks = CanCreateBlocks,
            CanCreateSessions = CanCreateSessions,
            DataCollections = DataCollections,
            AllowedPaths = AllowedPaths
        };
    }
}

public class AgentPermissionsDto
{
    public ContextPermissionsDto DefaultAgentPermissions { get; set; } = new();
    public Dictionary<string, ContextPermissionsDto> AgentOverrides { get; set; } = new();

    public static AgentPermissionsDto FromDomain(AgentPermissions permissions)
    {
        return new AgentPermissionsDto
        {
            DefaultAgentPermissions = ContextPermissionsDto.FromDomain(permissions.DefaultAgentPermissions),
            AgentOverrides = permissions.AgentOverrides.ToDictionary(
                kvp => kvp.Key,
                kvp => ContextPermissionsDto.FromDomain(kvp.Value))
        };
    }

    public AgentPermissions ToDomain()
    {
        return new AgentPermissions
        {
            DefaultAgentPermissions = DefaultAgentPermissions.ToDomain(),
            AgentOverrides = AgentOverrides.ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value.ToDomain())
        };
    }
}

public class SessionTemplateDto
{
    public string Type { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ContextPermissionsDto Permissions { get; set; } = new();
    public bool LogAllCommands { get; set; }
    public int MaxDurationMinutes { get; set; }
    public int MaxIterations { get; set; }

    public static SessionTemplateDto FromDomain(SessionTemplate template)
    {
        return new SessionTemplateDto
        {
            Type = template.Type,
            Description = template.Description,
            Permissions = ContextPermissionsDto.FromDomain(template.Permissions),
            LogAllCommands = template.LogAllCommands,
            MaxDurationMinutes = template.MaxDurationMinutes,
            MaxIterations = template.MaxIterations
        };
    }

    public SessionTemplate ToDomain()
    {
        return new SessionTemplate
        {
            Type = Type,
            Description = Description,
            Permissions = Permissions.ToDomain(),
            LogAllCommands = LogAllCommands,
            MaxDurationMinutes = MaxDurationMinutes,
            MaxIterations = MaxIterations
        };
    }
}
```

---

### Step 6: Update WorkspaceDto

**File**: `backend/src/Maestro.Application/DTOs/WorkspaceDto.cs`

**Changes** (add to existing class):

```csharp
public class WorkspaceDto
{
    // ... existing properties ...

    // NEW properties
    public string? Path { get; set; }
    public AgentPermissionsDto AgentPermissions { get; set; } = new();
    public Dictionary<string, SessionTemplateDto> SessionTemplates { get; set; } = new();
    public Dictionary<string, string> EntryPoints { get; set; } = new();

    public static WorkspaceDto FromDomain(Workspace workspace)
    {
        return new WorkspaceDto
        {
            // ... existing mappings ...
            Id = workspace.Id,
            Name = workspace.Name,
            Description = workspace.Description,
            Type = workspace.Type.ToString(),
            Status = workspace.Status.ToString(),
            SessionIds = workspace.SessionIds,
            ProjectIds = workspace.ProjectIds,
            CatalogRef = workspace.CatalogRef,
            Settings = WorkspaceSettingsDto.FromDomain(workspace.Settings),
            Isolation = WorkspaceIsolationDto.FromDomain(workspace.Isolation),
            CreatedAt = workspace.CreatedAt,
            UpdatedAt = workspace.UpdatedAt,
            CreatedBy = workspace.CreatedBy,

            // NEW mappings
            Path = workspace.Path,
            AgentPermissions = AgentPermissionsDto.FromDomain(workspace.AgentPermissions),
            SessionTemplates = workspace.SessionTemplates.ToDictionary(
                kvp => kvp.Key,
                kvp => SessionTemplateDto.FromDomain(kvp.Value)),
            EntryPoints = new Dictionary<string, string>(workspace.EntryPoints)
        };
    }
}

// Update CreateWorkspaceRequest
public class CreateWorkspaceRequest
{
    // ... existing properties ...

    // NEW
    public string? Path { get; set; }
    public AgentPermissionsDto? AgentPermissions { get; set; }
    public Dictionary<string, SessionTemplateDto>? SessionTemplates { get; set; }
    public Dictionary<string, string>? EntryPoints { get; set; }
}
```

---

### Step 7: Update IWorkspaceService Interface

**File**: `backend/src/Maestro.Application/Interfaces/IWorkspaceService.cs`

**Add new methods**:

```csharp
public interface IWorkspaceService
{
    // ... existing methods ...

    // NEW: Permission management
    Task<Workspace> UpdateAgentPermissionsAsync(
        string workspaceId,
        AgentPermissions permissions,
        CancellationToken ct = default);

    Task<ContextPermissions> GetAgentPermissionsAsync(
        string workspaceId,
        string? agentId,
        CancellationToken ct = default);

    // NEW: Session template management
    Task<Workspace> SetSessionTemplateAsync(
        string workspaceId,
        string templateType,
        SessionTemplate template,
        CancellationToken ct = default);

    Task<SessionTemplate?> GetSessionTemplateAsync(
        string workspaceId,
        string templateType,
        CancellationToken ct = default);

    // NEW: Entry point management
    Task<Workspace> SetEntryPointAsync(
        string workspaceId,
        string entryPointName,
        string blockId,
        CancellationToken ct = default);

    // NEW: Load workspace from filesystem path
    Task<Workspace> LoadFromPathAsync(
        string path,
        CancellationToken ct = default);

    // NEW: Create workspace with full configuration
    Task<Workspace> CreateWorkspaceAsync(
        string name,
        string path,
        WorkspaceType type,
        string? description = null,
        AgentPermissions? agentPermissions = null,
        Dictionary<string, SessionTemplate>? sessionTemplates = null,
        Dictionary<string, string>? entryPoints = null,
        CancellationToken ct = default);
}
```

---

### Step 8: Update WorkspaceService Implementation

**File**: `backend/src/Maestro.Infrastructure/Workspaces/WorkspaceService.cs`

**Add implementations for new interface methods**:

```csharp
public class WorkspaceService : IWorkspaceService
{
    // ... existing implementation ...

    public async Task<Workspace> UpdateAgentPermissionsAsync(
        string workspaceId,
        AgentPermissions permissions,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new KeyNotFoundException($"Workspace not found: {workspaceId}");

        workspace.UpdateAgentPermissions(permissions);
        await _repository.UpdateAsync(workspace, ct);
        return workspace;
    }

    public async Task<ContextPermissions> GetAgentPermissionsAsync(
        string workspaceId,
        string? agentId,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new KeyNotFoundException($"Workspace not found: {workspaceId}");

        return workspace.AgentPermissions.GetPermissionsForAgent(agentId);
    }

    public async Task<Workspace> SetSessionTemplateAsync(
        string workspaceId,
        string templateType,
        SessionTemplate template,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new KeyNotFoundException($"Workspace not found: {workspaceId}");

        workspace.SetSessionTemplate(templateType, template);
        await _repository.UpdateAsync(workspace, ct);
        return workspace;
    }

    public async Task<SessionTemplate?> GetSessionTemplateAsync(
        string workspaceId,
        string templateType,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new KeyNotFoundException($"Workspace not found: {workspaceId}");

        return workspace.SessionTemplates.TryGetValue(templateType, out var template) ? template : null;
    }

    public async Task<Workspace> SetEntryPointAsync(
        string workspaceId,
        string entryPointName,
        string blockId,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new KeyNotFoundException($"Workspace not found: {workspaceId}");

        workspace.SetEntryPoint(entryPointName, blockId);
        await _repository.UpdateAsync(workspace, ct);
        return workspace;
    }

    public async Task<Workspace> LoadFromPathAsync(string path, CancellationToken ct = default)
    {
        var workspaceJsonPath = Path.Combine(path, "workspace.json");
        if (!File.Exists(workspaceJsonPath))
        {
            throw new FileNotFoundException($"workspace.json not found at: {path}");
        }

        var json = await File.ReadAllTextAsync(workspaceJsonPath, ct);
        var dto = JsonSerializer.Deserialize<WorkspaceDto>(json, _jsonOptions);

        // Convert DTO to domain entity and save
        var workspace = ConvertToDomain(dto);
        workspace.UpdatePath(path);

        // Check if already exists
        var existing = await _repository.GetByIdAsync(workspace.Id, ct);
        if (existing != null)
        {
            // Update existing
            await _repository.UpdateAsync(workspace, ct);
        }
        else
        {
            // Create new
            await _repository.CreateAsync(workspace, ct);
        }

        return workspace;
    }

    public async Task<Workspace> CreateWorkspaceAsync(
        string name,
        string path,
        WorkspaceType type,
        string? description = null,
        AgentPermissions? agentPermissions = null,
        Dictionary<string, SessionTemplate>? sessionTemplates = null,
        Dictionary<string, string>? entryPoints = null,
        CancellationToken ct = default)
    {
        var workspace = Workspace.CreateWithPath(
            name, path, type, description, null,
            agentPermissions, sessionTemplates, entryPoints);

        await _repository.CreateAsync(workspace, ct);
        return workspace;
    }
}
```

---

### Step 9: Update WorkspacesController

**File**: `backend/src/Maestro.Api/Controllers/WorkspacesController.cs`

**Add new endpoints**:

```csharp
[ApiController]
[Route("api/workspaces")]
public class WorkspacesController : ControllerBase
{
    // ... existing endpoints ...

    // NEW: Get agent permissions for workspace
    [HttpGet("{id}/permissions")]
    public async Task<ActionResult<ContextPermissionsDto>> GetAgentPermissions(
        string id,
        [FromQuery] string? agentId,
        CancellationToken ct)
    {
        var permissions = await _service.GetAgentPermissionsAsync(id, agentId, ct);
        return Ok(ContextPermissionsDto.FromDomain(permissions));
    }

    // NEW: Update agent permissions
    [HttpPut("{id}/permissions")]
    public async Task<ActionResult<WorkspaceDto>> UpdateAgentPermissions(
        string id,
        [FromBody] AgentPermissionsDto request,
        CancellationToken ct)
    {
        var workspace = await _service.UpdateAgentPermissionsAsync(id, request.ToDomain(), ct);
        return Ok(WorkspaceDto.FromDomain(workspace));
    }

    // NEW: Get session templates
    [HttpGet("{id}/session-templates")]
    public async Task<ActionResult<Dictionary<string, SessionTemplateDto>>> GetSessionTemplates(
        string id,
        CancellationToken ct)
    {
        var workspace = await _service.GetWorkspaceAsync(id, ct);
        if (workspace == null) return NotFound();

        var templates = workspace.SessionTemplates.ToDictionary(
            kvp => kvp.Key,
            kvp => SessionTemplateDto.FromDomain(kvp.Value));
        return Ok(templates);
    }

    // NEW: Set session template
    [HttpPut("{id}/session-templates/{templateType}")]
    public async Task<ActionResult<WorkspaceDto>> SetSessionTemplate(
        string id,
        string templateType,
        [FromBody] SessionTemplateDto template,
        CancellationToken ct)
    {
        var workspace = await _service.SetSessionTemplateAsync(id, templateType, template.ToDomain(), ct);
        return Ok(WorkspaceDto.FromDomain(workspace));
    }

    // NEW: Load workspace from path
    [HttpPost("load")]
    public async Task<ActionResult<WorkspaceDto>> LoadFromPath(
        [FromBody] LoadWorkspaceRequest request,
        CancellationToken ct)
    {
        var workspace = await _service.LoadFromPathAsync(request.Path, ct);
        return Ok(WorkspaceDto.FromDomain(workspace));
    }

    // NEW: Validate workspace structure
    [HttpPost("{id}/validate")]
    public async Task<ActionResult<WorkspaceValidationResult>> Validate(string id, CancellationToken ct)
    {
        var workspace = await _service.GetWorkspaceAsync(id, ct);
        if (workspace == null) return NotFound();

        var result = new WorkspaceValidationResult
        {
            IsValid = true,
            Errors = new List<string>(),
            Warnings = new List<string>()
        };

        // Validate path exists
        if (!string.IsNullOrEmpty(workspace.Path) && !Directory.Exists(workspace.Path))
        {
            result.Errors.Add($"Workspace path does not exist: {workspace.Path}");
            result.IsValid = false;
        }

        // Validate entry points reference valid blocks
        foreach (var (name, blockId) in workspace.EntryPoints)
        {
            // Check if block exists (would need block service)
            result.Warnings.Add($"Entry point '{name}' references block '{blockId}' - validation pending");
        }

        return Ok(result);
    }
}

public class LoadWorkspaceRequest
{
    public string Path { get; set; } = string.Empty;
}

public class WorkspaceValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}
```

---

## Files Summary

### New Files (4)

| File | Purpose |
|------|---------|
| `backend/src/Maestro.Domain/ValueObjects/ContextPermissions.cs` | Agent context permissions |
| `backend/src/Maestro.Domain/ValueObjects/AgentPermissions.cs` | Workspace agent permission config |
| `backend/src/Maestro.Domain/ValueObjects/SessionTemplate.cs` | Session creation templates |
| `backend/src/Maestro.Application/DTOs/ContextPermissionsDto.cs` | DTOs for new value objects |

### Modified Files (4)

| File | Changes |
|------|---------|
| `backend/src/Maestro.Domain/Entities/Workspace.cs` | Add Path, AgentPermissions, SessionTemplates, EntryPoints |
| `backend/src/Maestro.Application/DTOs/WorkspaceDto.cs` | Add new properties and mappings |
| `backend/src/Maestro.Application/Interfaces/IWorkspaceService.cs` | Add permission and template methods |
| `backend/src/Maestro.Api/Controllers/WorkspacesController.cs` | Add new API endpoints |

### Implementation Required (1)

| File | Notes |
|------|-------|
| `backend/src/Maestro.Infrastructure/Workspaces/WorkspaceService.cs` | Implement new interface methods |

---

## Verification Steps

### 1. Build Backend

```bash
cd backend && dotnet build
```

### 2. Unit Tests

```bash
cd backend && dotnet test
```

### 3. API Tests

```bash
# Start services
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# Test workspace creation with permissions
curl -X POST http://localhost:5000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Research",
    "type": "Research",
    "path": "C:/Meastro/workspaces/test-research",
    "agentPermissions": {
      "defaultAgentPermissions": {
        "allowedCommands": ["run", "list-tools", "data"],
        "allowedTools": ["*"],
        "canCreateBlocks": true
      },
      "agentOverrides": {
        "trainer-agent": {
          "allowedCommands": ["run", "data"],
          "allowedTools": ["system:fitness-calculator"]
        }
      }
    }
  }'

# Test get permissions for specific agent
curl http://localhost:5000/api/workspaces/test-research/permissions?agentId=trainer-agent

# Test load workspace from path
curl -X POST http://localhost:5000/api/workspaces/load \
  -H "Content-Type: application/json" \
  -d '{"path": "C:/Meastro/workspaces/model-research"}'
```

---

## Notes

### Relationship to Existing WorkspacePermissions

The existing `WorkspacePermissions` in `WorkspaceIsolation.cs` handles **cross-workspace** access:
- `CanReadFrom` - Which workspaces can be read
- `CanWriteTo` - Which workspaces can be written to
- `CanPromoteTo` - Which workspaces agents can be promoted to

The new `ContextPermissions` handles **agent execution** within a workspace:
- `AllowedCommands` - Which CLI commands are allowed
- `AllowedTools` - Which tool blocks can be used
- `CanCreateBlocks` - Whether new blocks can be created

These are complementary, not overlapping.

### Data Migration

Existing workspaces will have default `AgentPermissions.FullAccess` which maintains backward compatibility.

---

## Next Phase

After Phase 1 is complete, Phase 2 (Session Management) will:
- Create `Session` entity with `ContextPermissions`
- Implement permission inheritance from workspace
- Add session CRUD operations

---

*Phase 1 establishes the foundation for context-aware permission enforcement.*

---

## Actual Implementation Summary (Simplified Model)

**Note**: The code samples above show the original plan with `AgentPermissions`. The actual implementation uses a **simplified session-based model** per the design document `DESIGN-SESSION-BASED-PERMISSIONS.md`.

### Files Created

| File | Purpose |
|------|---------|
| `backend/src/Maestro.Domain/ValueObjects/ContextPermissions.cs` | Context permissions (workspace/session) |
| `backend/src/Maestro.Domain/ValueObjects/SessionTemplate.cs` | Session creation templates |
| `backend/src/Maestro.Application/DTOs/ContextPermissionsDto.cs` | DTOs |
| `backend/tests/Maestro.Domain.Tests/ContextPermissionsTests.cs` | Unit tests |

### Files Modified

| File | Changes |
|------|---------|
| `backend/src/Maestro.Domain/Entities/Workspace.cs` | Added `Path`, `Permissions`, `SessionTemplates`, `EntryPoints` |
| `backend/src/Maestro.Application/DTOs/WorkspaceDto.cs` | Added new properties |
| `backend/src/Maestro.Api/Controllers/WorkspacesController.cs` | Added permission, template, entry point endpoints |

### Key Simplification

The original plan included `AgentPermissions` with agent-specific overrides. This was **removed** in favor of a pure session-based model:

```
ORIGINAL (Rejected):
  workspace.AgentPermissions.GetPermissionsForAgent(agentId)
  → Different agents get different permissions based on identity

SIMPLIFIED (Implemented):
  workspace.Permissions  // Workspace default permissions
  session.Permissions    // Session restricts from workspace
  → All agents in same context get same permissions
  → To restrict an agent, run it in a restricted session
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/workspaces/{id}/permissions` | Get workspace permissions |
| PUT | `/api/workspaces/{id}/permissions` | Update workspace permissions |
| GET | `/api/workspaces/{id}/session-templates` | List session templates |
| PUT | `/api/workspaces/{id}/session-templates/{type}` | Set session template |
| GET | `/api/workspaces/{id}/entry-points` | List entry points |
| PUT | `/api/workspaces/{id}/entry-points/{name}` | Set entry point |
| POST | `/api/workspaces/{id}/validate` | Validate workspace structure |

### Tests

- 11 unit tests for `ContextPermissions` - all passing

---

*Completed: February 3, 2026*
