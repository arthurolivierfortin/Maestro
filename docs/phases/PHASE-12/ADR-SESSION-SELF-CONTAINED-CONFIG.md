# ADR: Session Self-Contained Configuration

**Status**: Accepted
**Date**: 2026-02-09
**Phase**: 12 (Runtime Hardening & CLI Agent Interface)

## Context

Maestro's session hierarchy has a base class `ContainerSession` from which all execution contexts inherit:

```
ContainerSession (abstract base)
├── Workspace
└── Session (abstract)
    ├── ProjectSession
    └── FoundrySession
```

Separately, a `Project` entity exists as a standalone domain object (NOT a child of `ContainerSession`). It represents a "known repository" with configuration for LLM defaults, file access rules, block permissions, and block search paths.

Currently, creating a `ProjectSession` **requires** a registered `Project` entity:

1. `ProjectSessionConfig` has `required string ProjectId`
2. `ProjectSessionServer.CreateAsync()` calls `FindProjectAsync(config.ProjectId)` and fails if not found
3. `ProjectSessionServer.StartAsync()` fetches `project.RootPath` to establish the session's working directory
4. The CLI enforces `--project <id>` as a required flag for `session create`

Meanwhile, `FoundrySession.Create()` does NOT require a Project — it accepts an optional `repositoryPath` parameter directly. This asymmetry is a design problem.

### Phase 12's RepositoryPath

Phase 12 added universal repository binding to `ContainerSession`:

- `RepositoryPath` (string?) — path to bound repo
- `IsBoundToRepository` (bool) — computed property
- `MaestroDataPath` (string?) — computed `.maestro` directory path
- `BindToRepository(path, accessLevel)` — method to bind at creation time

This means ALL session types (Workspace, ProjectSession, FoundrySession) can now be repo-bound independently. The `Project.RootPath` is redundant when `ContainerSession.RepositoryPath` serves the same purpose.

## Problem

The `Project` entity carries 5 properties that are NOT on `ContainerSession` but SHOULD be available to all session types:

| Property | Type | Purpose |
|----------|------|---------|
| `BlockSearchPaths` | `IReadOnlyList<string>` | Additional block discovery paths |
| `DefaultModel` | `string?` | Default LLM model for operations |
| `ModelOverrides` | `IReadOnlyDictionary<string, string>` | Per-block model overrides |
| `FileAccessRules` | `IReadOnlyList<FileAccessRule>` | File/directory access control |
| `BlockPermissions` | `IReadOnlyList<BlockPermission>` | Block availability control |

These properties are currently exclusive to the `Project` entity. To use them, a session must reference a Project. But there is no architectural reason why a `FoundrySession` or `Workspace` shouldn't also have its own file access rules, default model, or block permissions.

The current architecture forces this workflow:

```
1. Register a Project (POST /api/projects/bind)  → get ProjectId
2. Create a Session with ProjectId               → requires Project to exist
3. Import template, set variables                 → works fine
4. Start session                                  → again fetches Project for RootPath
```

When it should be:

```
1. Create a Session with RepositoryPath           → self-contained
2. Import template, set variables                 → works fine
3. Start session                                  → uses session.RepositoryPath directly
```

## Decision

**Move the 5 Project-unique configuration properties to `ContainerSession`.** Make `ProjectSessionConfig.ProjectId` optional. Sessions become self-contained execution contexts that carry all their own configuration.

### What moves to ContainerSession

```csharp
// On ContainerSession (base class for all execution contexts)
public IReadOnlyList<string> BlockSearchPaths { get; protected set; }
public string? DefaultModel { get; protected set; }
public IReadOnlyDictionary<string, string> ModelOverrides { get; protected set; }
public IReadOnlyList<FileAccessRule> FileAccessRules { get; protected set; }
public IReadOnlyList<BlockPermission> BlockPermissions { get; protected set; }
```

### What stays on Project

The `Project` entity remains unchanged. It still serves as:

- A "known repo" registry (the system knows about this directory)
- A persistent configuration source (`.maestro/project.json`)
- A discovery target (`DiscoverProjectsAsync` scans for `.maestro/project.json` files)

### Property inheritance at session creation

When a session IS created with a `ProjectId`:

```
Session.BlockSearchPaths  ← Project.BlockSearchPaths
Session.DefaultModel      ← Project.DefaultModel
Session.ModelOverrides    ← Project.ModelOverrides
Session.FileAccessRules   ← Project.FileAccessRules
Session.BlockPermissions  ← Project.BlockPermissions
```

This is a **one-time copy** at creation time. The session owns its own configuration from that point on. Changes to the Project do NOT retroactively affect existing sessions.

When a session is created WITHOUT a ProjectId (just a RepositoryPath), these properties start at their defaults and can be set independently via API or CLI.

### ProjectId becomes optional

```csharp
// Before
public required string ProjectId { get; set; }

// After
public string? ProjectId { get; set; }
```

The `ProjectSessionServer` handles both cases:

- **With ProjectId**: Look up Project, validate it exists, inherit config → same as today
- **Without ProjectId**: Skip Project lookup, use `session.RepositoryPath` for working directory

### CLI gains --repo flag

```bash
# New: create session with repo path directly (no project needed)
maestro session create --repo C:\path\to\repo --authority human --name "My Session"

# Existing: still works (backward compatible)
maestro session create --project <projectId> --authority human --name "My Session"
```

## Rationale

### Alignment with Maestro Philosophy

- **"Self-describing sessions"**: A session should carry all its own behavior through variables, templates, and configuration. Requiring an external Project entity violates this — the session is not self-contained.

- **"Infrastructure is generic, content is specific"**: The Project entity creates a session-type-specific dependency. FoundrySession works without a Project; ProjectSession doesn't. This is an inconsistency in the generic infrastructure.

- **"Litmus test: can a new session type be created with ONLY JSON changes?"**: Currently NO — you must first register a Project. After this refactor: YES — create session with `--repo`, import template, start.

- **"CLI-first"**: The current flow requires two separate entities (Project + Session) managed through different API endpoints. After this refactor, a single `session create --repo <path>` suffices.

### Property overlap analysis

| Aspect | ContainerSession (already has) | Project (has) | Action |
|--------|-------------------------------|---------------|--------|
| Identity | `Id`, `Name`, `Description` | `Id`, `Name`, `Description` | Already duplicated; no change |
| Path | `RepositoryPath`, `MaestroDataPath` | `RootPath`, `GetMaestroFolderPath()` | Already duplicated; no change |
| Runtime | `Binding.RuntimeConfig` | `Runtime` | Already duplicated; no change |
| Timestamps | `CreatedAt`, `UpdatedAt` | `CreatedAt`, `UpdatedAt` | Already duplicated; no change |
| Permissions | `Permissions` (ContextPermissions) | `FileAccessRules`, `BlockPermissions` | **Move to ContainerSession** |
| LLM config | — | `DefaultModel`, `ModelOverrides` | **Move to ContainerSession** |
| Block discovery | — | `BlockSearchPaths` | **Move to ContainerSession** |

### Why not delete Project entirely?

Project still serves useful purposes:

1. **Discovery**: `FileSystemProjectRepository.DiscoverProjectsAsync()` scans directories for `.maestro/project.json` files. This is how the UI populates the project list.
2. **Shared config source**: Multiple sessions can be created from the same Project, each inheriting its config at creation time.
3. **Container management**: `ProjectContainerService` manages Docker containers keyed by ProjectId.
4. **UI/UX**: The frontend displays "Projects" as a navigation concept. Removing it entirely would break the UI.

The right answer is to keep Project as an **optional, lightweight registry** — not a mandatory prerequisite for session execution.

## Consequences

### Positive

- All session types (`ProjectSession`, `FoundrySession`, `Workspace`) gain LLM config, file access rules, and block permissions
- Sessions become truly self-contained — no external entity dependency
- CLI workflow simplifies from 4 steps to 2 steps
- FoundrySession and ProjectSession become symmetric in their creation requirements
- Template import already works independently of Project — now session creation does too

### Negative

- `ContainerSession` gains 5 more properties (minor complexity increase)
- Serialization must handle the new properties for all session types
- Existing code that assumes `ProjectId` is non-null needs null-checking

### Neutral

- `Project` entity and `ProjectsController` are unchanged
- Existing sessions with `ProjectId` continue to work identically
- The frontend "Projects" page continues to work

## Affected Files

| File | Change |
|------|--------|
| `Domain/Entities/ContainerSession.cs` | +5 properties, +5 mutator methods |
| `Domain/Configuration/ProjectSessionConfig.cs` | `ProjectId` becomes `string?` |
| `Infrastructure/Sessions/ProjectSessionServer.cs` | Optional Project lookup |
| `Infrastructure/Sessions/FileSystemProjectSessionRepository.cs` | Serialize new properties |
| `Api/Controllers/SessionsController.cs` | Accept `RepositoryPath` alternative |
| `tools/maestro-cli/index.js` | `--repo` flag, `--project` optional |
| `tools/shared/api-client.js` | Updated validation |

## Related

- `docs/phases/PHASE-12/ADR-UNIVERSAL-REPO-BINDING.md` — Phase 12 universal repo binding
- `docs/phases/PHASE-12/ADR-NODE-LEVEL-MODEL-SELECTION.md` — Node-level model selection
- `backend/src/Maestro.Domain/Entities/ContainerSession.cs` — Base class
- `backend/src/Maestro.Domain/Entities/Project.cs` — Project entity (stays as-is)
- `backend/src/Maestro.Infrastructure/Sessions/ProjectSessionServer.cs` — Session server
