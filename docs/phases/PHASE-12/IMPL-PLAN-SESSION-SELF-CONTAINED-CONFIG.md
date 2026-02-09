# Implementation Plan: Session Self-Contained Configuration

**Phase**: 12 (Runtime Hardening & CLI Agent Interface)
**ADR**: `docs/phases/PHASE-12/ADR-SESSION-SELF-CONTAINED-CONFIG.md`
**Date**: 2026-02-09

## Goal

Move 5 configuration properties from the `Project` entity to the `ContainerSession` base class, and make `ProjectSessionConfig.ProjectId` optional. This allows sessions to be created directly with a `RepositoryPath` instead of requiring a registered `Project` entity.

## Prerequisites

- Maestro backend builds successfully (`cd backend && dotnet build`)
- All 90 existing tests pass (`cd backend && dotnet test`)
- Understanding of the class hierarchy:
  ```
  ContainerSession (abstract) → Workspace
  ContainerSession (abstract) → Session (abstract) → ProjectSession
  ContainerSession (abstract) → Session (abstract) → FoundrySession
  ```
- `Project` is a **separate entity** (NOT in the ContainerSession hierarchy)

## Properties Being Moved

These 5 properties currently exist ONLY on `Project` (`backend/src/Maestro.Domain/Entities/Project.cs`):

| Property | Type | Default |
|----------|------|---------|
| `BlockSearchPaths` | `IReadOnlyList<string>` | `Array.Empty<string>()` |
| `DefaultModel` | `string?` | `null` |
| `ModelOverrides` | `IReadOnlyDictionary<string, string>` | `new Dictionary<string, string>()` |
| `FileAccessRules` | `IReadOnlyList<FileAccessRule>` | `Array.Empty<FileAccessRule>()` |
| `BlockPermissions` | `IReadOnlyList<BlockPermission>` | `Array.Empty<BlockPermission>()` |

`FileAccessRule` is defined in `backend/src/Maestro.Domain/ValueObjects/FileAccessRule.cs`.
`BlockPermission` is defined in `backend/src/Maestro.Domain/ValueObjects/BlockPermission.cs`.

---

## Step 1: Add properties to ContainerSession

**File**: `backend/src/Maestro.Domain/Entities/ContainerSession.cs`

### 1a. Add properties

After the existing `Permissions` property (line 64), add a new section:

```csharp
// ===== Configuration (available to all session types) =====

/// <summary>
/// Additional search paths for block discovery, relative to RepositoryPath.
/// </summary>
public IReadOnlyList<string> BlockSearchPaths { get; protected set; } = Array.Empty<string>();

/// <summary>
/// Default LLM model for this session's operations.
/// </summary>
public string? DefaultModel { get; protected set; }

/// <summary>
/// Per-block model overrides (blockId or pattern -> modelId).
/// </summary>
public IReadOnlyDictionary<string, string> ModelOverrides { get; protected set; } =
    new Dictionary<string, string>();

/// <summary>
/// File access rules controlling visibility and permissions within the session context.
/// </summary>
public IReadOnlyList<FileAccessRule> FileAccessRules { get; protected set; } = Array.Empty<FileAccessRule>();

/// <summary>
/// Block permission rules controlling which blocks are available to this session.
/// </summary>
public IReadOnlyList<BlockPermission> BlockPermissions { get; protected set; } = Array.Empty<BlockPermission>();
```

### 1b. Add mutator methods

After the `UpdateDescription` method (around line 336), add:

```csharp
// ===== Configuration Mutators =====

/// <summary>
/// Sets additional block search paths.
/// </summary>
public void SetBlockSearchPaths(IReadOnlyList<string> paths)
{
    BlockSearchPaths = paths ?? Array.Empty<string>();
    UpdatedAt = DateTimeOffset.UtcNow;
}

/// <summary>
/// Sets the default LLM model.
/// </summary>
public void SetDefaultModel(string? model)
{
    DefaultModel = model;
    UpdatedAt = DateTimeOffset.UtcNow;
}

/// <summary>
/// Sets per-block model overrides.
/// </summary>
public void SetModelOverrides(IReadOnlyDictionary<string, string> overrides)
{
    ModelOverrides = overrides ?? new Dictionary<string, string>();
    UpdatedAt = DateTimeOffset.UtcNow;
}

/// <summary>
/// Sets file access rules.
/// </summary>
public void SetFileAccessRules(IReadOnlyList<FileAccessRule> rules)
{
    FileAccessRules = rules ?? Array.Empty<FileAccessRule>();
    UpdatedAt = DateTimeOffset.UtcNow;
}

/// <summary>
/// Sets block permission rules.
/// </summary>
public void SetBlockPermissions(IReadOnlyList<BlockPermission> permissions)
{
    BlockPermissions = permissions ?? Array.Empty<BlockPermission>();
    UpdatedAt = DateTimeOffset.UtcNow;
}
```

### 1c. Verify imports

`ContainerSession.cs` already imports `Maestro.Domain.ValueObjects` (line 2), which contains both `FileAccessRule` and `BlockPermission`. No new `using` statements needed.

---

## Step 2: Make ProjectSessionConfig.ProjectId optional

**File**: `backend/src/Maestro.Domain/Configuration/ProjectSessionConfig.cs`

### Change

Line 13: Change from:
```csharp
public required string ProjectId { get; set; }
```

To:
```csharp
/// <summary>
/// The project ID where the session runs. Optional - sessions can be created
/// directly with a RepositoryPath without a registered Project.
/// </summary>
public string? ProjectId { get; set; }
```

### Impact

This change will cause compile errors anywhere `ProjectId` is accessed without null-checking. The subsequent steps fix each of these.

---

## Step 3: Update ProjectSessionServer — make Project lookup optional

**File**: `backend/src/Maestro.Infrastructure/Sessions/ProjectSessionServer.cs`

### 3a. Update CreateAsync (line 44)

Replace the current method body with:

```csharp
public async Task<ProjectSession> CreateAsync(
    string name,
    Authority authority,
    ProjectSessionConfig config,
    CancellationToken ct = default)
{
    Project? project = null;
    string? repoPath = null;

    // If ProjectId is specified, validate the project exists
    if (!string.IsNullOrEmpty(config.ProjectId))
    {
        project = await FindProjectAsync(config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {config.ProjectId} not found");
        }
        repoPath = project.RootPath;
    }

    // Create session (repoPath is null if no project — caller may set RepositoryPath separately)
    var session = ProjectSession.Create(name, authority, config, repoPath);

    // If project found, inherit project-level config into session
    if (project != null)
    {
        session.SetBlockSearchPaths(project.BlockSearchPaths);
        session.SetDefaultModel(project.DefaultModel);
        session.SetModelOverrides(project.ModelOverrides);
        session.SetFileAccessRules(project.FileAccessRules);
        session.SetBlockPermissions(project.BlockPermissions);
    }

    // Initialize block registry with all available blocks
    var blocks = await _blockRepository.GetAllAsync(ct);
    session.InitializeBlockRegistry(blocks.Select(b => b.Id));

    // Subscribe to session events
    session.OnEvent += (_, evt) => BroadcastEvent(session.Id, evt);

    // Save to repository
    await _repository.SaveAsync(session, ct);

    // Ensure event channel exists for this session
    _contextStorage.GetOrCreateEventChannel(session.Id);

    _logger.LogInformation(
        "Created project session {SessionId} for project {ProjectId} with authority {Authority}",
        session.Id, config.ProjectId ?? "(no project)", authority);

    return session;
}
```

### 3b. Update StartAsync (line 94)

Replace the project lookup section with:

```csharp
public async Task<ProjectSession> StartAsync(SessionId id, CancellationToken ct = default)
{
    var session = await _repository.GetByIdAsync(id, ct)
        ?? throw new InvalidOperationException($"Session {id.Value} not found");

    // Determine project path: try Project first, then RepositoryPath
    string projectPath;
    if (!string.IsNullOrEmpty(session.Config.ProjectId))
    {
        var project = await FindProjectAsync(session.Config.ProjectId, ct)
            ?? throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");
        projectPath = project.RootPath;
    }
    else if (!string.IsNullOrEmpty(session.RepositoryPath))
    {
        projectPath = session.RepositoryPath;
    }
    else
    {
        _logger.LogWarning("Session {SessionId} has no ProjectId or RepositoryPath, using current directory", id.Value);
        projectPath = Environment.CurrentDirectory;
    }

    // Subscribe to session events if not already subscribed
    session.OnEvent += (_, evt) => BroadcastEvent(session.Id, evt);

    // Start the session
    session.Start();

    // Create session context and store in singleton storage
    var context = new ProjectSessionContext(
        session,
        projectPath,
        evt => BroadcastEvent(session.Id, evt));
    _contextStorage.SetContext(session.Id, context);

    // Ensure event channel exists
    _contextStorage.GetOrCreateEventChannel(session.Id);

    await _repository.SaveAsync(session, ct);

    _logger.LogInformation("Started project session {SessionId}", id.Value);

    return session;
}
```

---

## Step 4: Update FileSystemProjectSessionRepository — handle nullable ProjectId and serialize new properties

**File**: `backend/src/Maestro.Infrastructure/Sessions/FileSystemProjectSessionRepository.cs`

### 4a. Update SaveAsync (line 132)

The `SaveAsync` method currently requires `session.Config.ProjectId` to find the project and determine the save path. With optional ProjectId, we need to fall back to `session.RepositoryPath`.

Replace lines 132-154 with:

```csharp
public async Task SaveAsync(ProjectSession session, CancellationToken ct = default)
{
    ArgumentNullException.ThrowIfNull(session);

    string sessionsFolder;

    if (!string.IsNullOrEmpty(session.Config.ProjectId))
    {
        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project != null)
        {
            sessionsFolder = GetSessionsFolderPath(project.RootPath);
        }
        else if (!string.IsNullOrEmpty(session.RepositoryPath))
        {
            sessionsFolder = GetSessionsFolderPath(session.RepositoryPath);
        }
        else
        {
            throw new InvalidOperationException($"Cannot save session: Project {session.Config.ProjectId} not found and no RepositoryPath");
        }
    }
    else if (!string.IsNullOrEmpty(session.RepositoryPath))
    {
        sessionsFolder = GetSessionsFolderPath(session.RepositoryPath);
    }
    else
    {
        throw new InvalidOperationException("Cannot save session: no ProjectId or RepositoryPath");
    }

    Directory.CreateDirectory(sessionsFolder);

    var sessionPath = Path.Combine(sessionsFolder, $"{session.Id}.json");
    var json = SerializeSession(session);
    await File.WriteAllTextAsync(sessionPath, json, ct);

    // Update cache
    _cache[session.Id] = session;

    _logger?.LogInformation("Saved session {SessionId}", session.Id);
}
```

### 4b. Update GetByIdAsync (line 39)

After the existing project scan loop (line 50-63), add a scan of known repository paths. The current code only searches project directories. With sessions that have no ProjectId but do have RepositoryPath, we also need to search the session's own RepositoryPath. However, for the initial implementation, the cache will handle most cases since SaveAsync puts the session in the cache. No change needed for GetByIdAsync — the cache covers it.

### 4c. Update GetAllAsync (line 79)

The `GetAllAsync` currently only loads from project directories. Sessions without ProjectId need to also be discoverable. For now, the cache handles in-memory sessions. We can add a scan of known repo paths later. No change needed for this step.

### 4d. Update DeleteAsync (line 156)

Replace lines 156-173 with:

```csharp
public async Task DeleteAsync(SessionId id, CancellationToken ct = default)
{
    var sessionId = id.Value;
    var session = await GetByIdAsync(id, ct);
    if (session == null) return;

    string? sessionsFolder = null;

    if (!string.IsNullOrEmpty(session.Config.ProjectId))
    {
        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project != null)
        {
            sessionsFolder = GetSessionsFolderPath(project.RootPath);
        }
    }

    if (sessionsFolder == null && !string.IsNullOrEmpty(session.RepositoryPath))
    {
        sessionsFolder = GetSessionsFolderPath(session.RepositoryPath);
    }

    if (sessionsFolder != null)
    {
        var sessionPath = Path.Combine(sessionsFolder, $"{sessionId}.json");
        if (File.Exists(sessionPath))
        {
            File.Delete(sessionPath);
        }
    }

    _cache.TryRemove(sessionId, out _);
    _logger?.LogInformation("Deleted session {SessionId}", sessionId);
}
```

### 4e. Update SerializeSession (line 230)

Add new fields to `SessionJsonDto` serialization. After the `MonitorWidgets` line (310), add:

```csharp
// Session-level configuration (from ContainerSession)
BlockSearchPaths = session.BlockSearchPaths?.ToList(),
DefaultModel = session.DefaultModel,
ModelOverrides = session.ModelOverrides?.Count > 0
    ? new Dictionary<string, string>(session.ModelOverrides)
    : null,
FileAccessRules = session.FileAccessRules?.Select(r => new FileAccessRuleJsonDto
{
    Path = r.Path,
    Type = r.Type.ToString().ToLowerInvariant(),
    Permission = r.Permission.ToString().ToLowerInvariant(),
    Reason = r.Reason
}).ToList(),
BlockPermissionsConfig = session.BlockPermissions?.Select(p => new BlockPermissionJsonDto
{
    BlockPattern = p.BlockPattern,
    Permission = p.Permission.ToString().ToLowerInvariant(),
    Reason = p.Reason
}).ToList()
```

### 4f. Update DeserializeSession (line 316)

After the monitor widgets restoration (line 443), add restoration of the new properties:

```csharp
// Restore session-level configuration
var blockSearchPaths = dto.BlockSearchPaths ?? new List<string>();
var defaultModel = dto.DefaultModel;
var modelOverrides = dto.ModelOverrides != null
    ? (IReadOnlyDictionary<string, string>)new Dictionary<string, string>(dto.ModelOverrides)
    : new Dictionary<string, string>();
var fileAccessRules = dto.FileAccessRules != null
    ? dto.FileAccessRules.Select(r => new FileAccessRule
    {
        Path = r.Path,
        Type = Enum.Parse<FileAccessType>(r.Type, ignoreCase: true),
        Permission = Enum.Parse<FileAccessPermission>(r.Permission, ignoreCase: true),
        Reason = r.Reason
    }).ToList().AsReadOnly() as IReadOnlyList<FileAccessRule>
    : Array.Empty<FileAccessRule>();
var blockPermissions = dto.BlockPermissionsConfig != null
    ? dto.BlockPermissionsConfig.Select(p => new BlockPermission
    {
        BlockPattern = p.BlockPattern,
        Permission = Enum.Parse<BlockPermissionLevel>(p.Permission, ignoreCase: true),
        Reason = p.Reason
    }).ToList().AsReadOnly() as IReadOnlyList<BlockPermission>
    : Array.Empty<BlockPermission>();
```

Then after the `Reconstitute` call (line 446-473), set the new properties on the reconstituted session:

```csharp
var session = ProjectSession.Reconstitute(...);

// Restore session-level configuration
session.SetBlockSearchPaths(blockSearchPaths);
if (defaultModel != null) session.SetDefaultModel(defaultModel);
if (modelOverrides.Count > 0) session.SetModelOverrides(modelOverrides);
if (fileAccessRules.Count > 0) session.SetFileAccessRules(fileAccessRules);
if (blockPermissions.Count > 0) session.SetBlockPermissions(blockPermissions);

return session;
```

### 4g. Add new DTO classes

After the existing `CommitInfoJsonDto` class (line 614), add:

```csharp
private class FileAccessRuleJsonDto
{
    public string Path { get; set; } = string.Empty;
    public string Type { get; set; } = "file";
    public string Permission { get; set; } = "readWrite";
    public string? Reason { get; set; }
}

private class BlockPermissionJsonDto
{
    public string BlockPattern { get; set; } = string.Empty;
    public string Permission { get; set; } = "allowed";
    public string? Reason { get; set; }
}
```

### 4h. Update SessionJsonDto

Add to the `SessionJsonDto` class (after line 550 `MonitorWidgets`):

```csharp
public List<string>? BlockSearchPaths { get; set; }
public string? DefaultModel { get; set; }
public Dictionary<string, string>? ModelOverrides { get; set; }
public List<FileAccessRuleJsonDto>? FileAccessRules { get; set; }
public List<BlockPermissionJsonDto>? BlockPermissionsConfig { get; set; }
```

### 4i. Update SessionConfigJsonDto.ProjectId

In `SessionConfigJsonDto` (line 562), change:
```csharp
public string ProjectId { get; set; } = string.Empty;
```
To:
```csharp
public string? ProjectId { get; set; }
```

---

## Step 5: Update SessionsController — accept RepositoryPath as alternative

**File**: `backend/src/Maestro.Api/Controllers/SessionsController.cs`

### 5a. Update CreateInteractiveSessionRequest (line 597)

Change line 600 from:
```csharp
public required string ProjectId { get; init; }
```
To:
```csharp
public string? ProjectId { get; init; }
public string? RepositoryPath { get; init; }
```

### 5b. Update Create action (line 68)

Replace lines 70-71 from:
```csharp
if (string.IsNullOrWhiteSpace(request.ProjectId))
    return BadRequest(new { error = "ProjectId is required" });
```
To:
```csharp
if (string.IsNullOrWhiteSpace(request.ProjectId) && string.IsNullOrWhiteSpace(request.RepositoryPath))
    return BadRequest(new { error = "Either ProjectId or RepositoryPath is required" });
```

### 5c. Update config creation (line 80-104)

After creating `config` (line 104), add repository binding when RepositoryPath is provided:

```csharp
var sessionName = request.Name ?? $"Session-{DateTime.UtcNow:yyyyMMdd-HHmmss}";
var session = await _sessionServer.CreateAsync(sessionName, authority, config);

// Bind to repository if RepositoryPath provided (and session wasn't already bound via Project)
if (!string.IsNullOrEmpty(request.RepositoryPath) && !session.IsBoundToRepository)
{
    session.BindToRepository(request.RepositoryPath);
    await _sessionServer.SaveAsync(session);
}
```

Also update the `config` creation at line 82 to handle nullable ProjectId. Since `ProjectSessionConfig.ProjectId` is now `string?`, the assignment `ProjectId = request.ProjectId` just works (both are nullable now).

---

## Step 6: Update CLI — --project optional, add --repo

**File**: `tools/maestro-cli/index.js`

### 6a. Update createSession validation (line 797)

Replace:
```javascript
if (!options.projectId) { formatter.error('--project is required', 'MISSING_PARAM'); process.exit(1); }
```
With:
```javascript
if (!options.projectId && !options.repo) {
    formatter.error('Either --project or --repo is required', 'MISSING_PARAM');
    process.exit(1);
}
```

### 6b. Update request body (line 805)

Change line 806 from:
```javascript
projectId: options.projectId,
```
To:
```javascript
projectId: options.projectId || undefined,
repositoryPath: options.repo || undefined,
```

### 6c. Update help text (line 4283)

Change:
```
  --project <id>        Project ID (required)
```
To:
```
  --project <id>        Project ID (optional if --repo is provided)
  --repo <path>         Repository path (optional if --project is provided)
```

### 6d. Update session create command parser

In the `session` subcommand parsing section (around line 4722), ensure the `repo` argument is captured from `argv.repo`.

**File**: `tools/shared/api-client.js`

### 6e. Update createSession validation (line 746-751)

Replace:
```javascript
async createSession(request) {
    if (!request || !request.projectId) {
      throw new Error('Session requires projectId');
    }
    return this._fetch('POST', '/api/sessions', { body: request });
}
```
With:
```javascript
async createSession(request) {
    if (!request || (!request.projectId && !request.repositoryPath)) {
      throw new Error('Session requires either projectId or repositoryPath');
    }
    return this._fetch('POST', '/api/sessions', { body: request });
}
```

### 6f. Update JSDoc (line 729)

Change:
```javascript
* @param {string} request.projectId - Project ID (required)
```
To:
```javascript
* @param {string} [request.projectId] - Project ID (optional if repositoryPath provided)
* @param {string} [request.repositoryPath] - Repository path (optional if projectId provided)
```

---

## Step 7: Build and Test

### 7a. Build
```bash
cd backend && dotnet build
```
Expected: 0 errors. The `required` removal from `ProjectSessionConfig.ProjectId` may cause errors in places that were relying on it being non-null. Fix any by adding null-checks.

### 7b. Run tests
```bash
cd backend && dotnet test
```
Expected: All existing tests pass.

### 7c. Verify CLI with --repo

Start backend, then:
```bash
cd tools/maestro-cli
node index.js session create --repo C:\Meastro\test-repos\llm-compliance-testing --authority human --name "Test Direct Repo"
```
Expected: Session created successfully without needing a Project.

### 7d. Verify CLI with --project (backward compat)

```bash
node index.js session create --project <existing-project-id> --authority human --name "Test With Project"
```
Expected: Session created as before. Project config is inherited into session properties.

### 7e. Verify session start with repo-only session

```bash
node index.js session start <session-id-from-7c>
```
Expected: Session starts using RepositoryPath as working directory.

---

## Files Modified (Summary)

| # | File | Change Type |
|---|------|-------------|
| 1 | `backend/src/Maestro.Domain/Entities/ContainerSession.cs` | Add 5 properties + 5 mutator methods |
| 2 | `backend/src/Maestro.Domain/Configuration/ProjectSessionConfig.cs` | `ProjectId`: `required string` → `string?` |
| 3 | `backend/src/Maestro.Infrastructure/Sessions/ProjectSessionServer.cs` | Optional Project lookup in CreateAsync/StartAsync |
| 4 | `backend/src/Maestro.Infrastructure/Sessions/FileSystemProjectSessionRepository.cs` | Nullable ProjectId handling, serialize new properties |
| 5 | `backend/src/Maestro.Api/Controllers/SessionsController.cs` | `ProjectId` optional, `RepositoryPath` alternative |
| 6 | `tools/maestro-cli/index.js` | `--repo` flag, `--project` optional |
| 7 | `tools/shared/api-client.js` | Updated validation |

## Files NOT Modified

- `backend/src/Maestro.Domain/Entities/Project.cs` — Project entity stays as-is
- `backend/src/Maestro.Api/Controllers/ProjectsController.cs` — Project API unchanged
- `backend/src/Maestro.Infrastructure/Projects/FileSystemProjectRepository.cs` — Project persistence unchanged
- `backend/src/Maestro.Application/Interfaces/IProjectRepository.cs` — Interface unchanged
- `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — Already uses session.RepositoryPath fallback
