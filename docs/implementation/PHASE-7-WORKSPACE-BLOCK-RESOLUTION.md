# Phase 7: Workspace Block Resolution

**Date**: 3 février 2026
**Status**: Completed
**Prerequisites**: Phases 1-6 (Workspace, Sessions, CLI Executor, Maestro-CLI Block, System Tools, Agent Execution)

---

## Overview

Phase 7 implements workspace-first block resolution, allowing workspace-local blocks to override system blocks. This enables workspaces to customize tool behavior, add specialized blocks, or modify default configurations without affecting other workspaces.

## Architecture

```
Block Resolution Order:
┌────────────────────────────────────────────────────────────────┐
│                    IWorkspaceBlockResolver                      │
│                                                                 │
│  1. Workspace-local blocks (workspaces/{id}/blocks/)           │
│     └─> Highest priority, specific to workspace                │
│                                                                 │
│  2. User overrides (blocks/user/)                              │
│     └─> Global user customizations                             │
│                                                                 │
│  3. System blocks (blocks/system/)                             │
│     └─> Core Maestro functionality                             │
│                                                                 │
│  4. Regular blocks (blocks/)                                   │
│     └─> Project-level blocks                                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/src/Maestro.Application/Interfaces/IWorkspaceBlockResolver.cs` | Interface for workspace-aware block resolution |
| `backend/src/Maestro.Infrastructure/Workspaces/WorkspaceBlockResolver.cs` | Implementation with caching and priority resolution |

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/Maestro.Infrastructure/Cli/CommandHandlers/RunCommandHandler.cs` | Uses IWorkspaceBlockResolver for block lookup |
| `backend/src/Maestro.Api/Program.cs` | Registers IWorkspaceBlockResolver service |

---

## Implementation Details

### 1. IWorkspaceBlockResolver Interface

```csharp
public interface IWorkspaceBlockResolver
{
    /// <summary>
    /// Resolves a block ID with workspace-first priority.
    /// </summary>
    Task<BlockDefinition?> ResolveAsync(
        string blockId,
        string? workspaceId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Lists all blocks available in a workspace context.
    /// </summary>
    Task<IEnumerable<BlockDefinition>> ListAvailableAsync(
        string? workspaceId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Checks if a workspace has a local override for a block.
    /// </summary>
    Task<bool> HasWorkspaceOverrideAsync(
        string blockId,
        string workspaceId,
        CancellationToken ct = default);
}
```

### 2. WorkspaceBlockResolver Implementation

The resolver uses a multi-level cache:

```csharp
// Per-workspace block cache
private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, BlockDefinition>>
    _workspaceBlockCache = new();

public async Task<BlockDefinition?> ResolveAsync(string blockId, string? workspaceId, ...)
{
    // 1. Check workspace-local blocks first
    if (!string.IsNullOrEmpty(workspaceId))
    {
        var workspaceBlock = await GetWorkspaceBlockAsync(blockId, workspaceId, ct);
        if (workspaceBlock != null) return workspaceBlock;
    }

    // 2. Fall back to global discovery (system + user blocks)
    return await _blockDiscoveryService.GetByIdAsync(blockId, ct);
}
```

### 3. RunCommandHandler Integration

The `run` command now uses workspace context:

```csharp
public async Task<CliResult> HandleAsync(
    ParsedCommand command,
    CliExecutionContext context,  // Contains WorkspaceId
    ContextPermissions permissions,
    CancellationToken ct = default)
{
    // Load block with workspace-first resolution
    var block = await _blockResolver.ResolveAsync(
        blockId,
        context.WorkspaceId,  // Workspace context from CLI session
        ct);

    // Log if using workspace override
    if (block.Metadata?.ContainsKey("_isWorkspaceBlock") == true)
    {
        _logger.LogInformation(
            "Using workspace-local block {BlockId} from workspace {WorkspaceId}",
            blockId, context.WorkspaceId);
    }
    // ...
}
```

---

## Workspace Block Structure

```
workspaces/
└── research-workspace/
    ├── workspace.json
    └── blocks/
        ├── custom-search.tool.block.json     # New workspace-specific tool
        ├── system:data-store.tool.block.json # Override of system tool
        └── specialized-agent.agent.block.json
```

### Override Example

To override the system `data-store` tool in a workspace:

```json
{
  "id": "system:data-store",
  "name": "Data Store (Research)",
  "blockType": "tool",
  "description": "Customized data store for research workspace",
  "overridesSystemBlock": "system:data-store",
  "config": {
    "executorType": "cli-bridge",
    "defaultCollection": "research-data"
  }
}
```

---

## Benefits

### 1. Workspace Isolation
Each workspace can have its own set of customized blocks without affecting others.

### 2. System Block Safety
System blocks remain unchanged; workspaces override via file placement.

### 3. Easy Customization
Just drop a `.block.json` file in the workspace's `blocks/` folder.

### 4. Transparent Override
Logs indicate when workspace blocks are used instead of system blocks.

### 5. Cache Efficiency
Per-workspace caching minimizes file system access.

---

## Cache Management

The resolver provides cache invalidation methods:

```csharp
// Invalidate single workspace cache
resolver.InvalidateWorkspaceCache(workspaceId);

// Invalidate all caches (e.g., after system block changes)
resolver.InvalidateAllCaches();
```

---

## Usage Examples

### Agent Using Workspace-Local Tool

```
// Agent in "research-workspace" calls:
{"tool":"maestro_cli","args":{"command":"run data-store --input action=write"}}

// Resolution:
1. Check workspaces/research-workspace/blocks/ for "data-store"
   -> Found: system:data-store.tool.block.json
2. Use workspace override with custom config
3. Execute with "defaultCollection": "research-data"
```

### Listing Available Blocks

```bash
# List blocks available in workspace context
maestro list-blocks --workspace research-workspace

# Shows:
# - All system blocks
# - User overrides
# - Workspace-local blocks (marked with [workspace])
```

---

## Next Steps

- Phase 8: UI Blocks (progress visualization)
- Phase 9: Complete Workspace Setup (research workspace template)
