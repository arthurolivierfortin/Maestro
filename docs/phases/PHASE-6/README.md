# Phase 6: Agent Execution with Maestro-CLI

**Date**: 3 février 2026
**Status**: Completed
**Prerequisites**: Phases 1-5 (Workspace, Sessions, CLI Executor, Maestro-CLI Block, System Tools)

---

## Overview

Phase 6 transforms how agents interact with the Maestro system. Instead of a hardcoded mapping of individual tools, agents now use a single `maestro_cli` tool that provides access to the entire Maestro CLI interface, with permission enforcement through the session context.

## Key Changes

### Before (Multiple Tool Mapping)

```csharp
// Old approach: Each tool mapped individually
private static readonly Dictionary<string, string> ToolMapping = new()
{
    { "list_files", "directory-list" },
    { "read_file", "file-read" },
    { "write_file", "file-write" },
    // ... more mappings
};
```

### After (Single CLI Tool)

```csharp
// New approach: Single maestro_cli tool
// All commands route through ICliExecutor with permission enforcement
if (toolId == "maestro_cli" || toolId == "maestro-cli")
{
    var cliResult = await cliExecutor.ExecuteAsync(command, cliContext, ct);
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Block                               │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐ │
│  │ LLM Gateway  │────▶│ Tool Parser  │────▶│ Tool Router      │ │
│  └──────────────┘     └──────────────┘     └──────────────────┘ │
│                                                    │             │
│         ┌──────────────────────────────────────────┘             │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                             │
│  │ maestro_cli     │                                             │
│  │ (single tool)   │                                             │
│  └─────────────────┘                                             │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLI Executor                                 │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐ │
│  │ CLI Parser   │────▶│ Permission   │────▶│ Command Handler  │ │
│  │              │     │ Checker      │     │ Registry         │ │
│  └──────────────┘     └──────────────┘     └──────────────────┘ │
│                                                    │             │
└────────────────────────────────────────────────────┼─────────────┘
                                                     │
                                                     ▼
                              ┌────────────────────────────────────┐
                              │ Command Handlers                   │
                              │ - RunCommandHandler                │
                              │ - ListToolsHandler                 │
                              │ - ListBlocksHandler                │
                              │ - DescribeHandler                  │
                              │ - DataHandler                      │
                              │ - SessionHandler                   │
                              │ - WorkspaceHandler                 │
                              │ - HelpHandler                      │
                              └────────────────────────────────────┘
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Replaced ToolMapping with ICliExecutor routing |

---

## Implementation Details

### 1. CLI Executor Injection

The `AgentBlockExecutor` now gets `ICliExecutor` from the service provider:

```csharp
private ICliExecutor? _cliExecutor;

private ICliExecutor? GetCliExecutor()
{
    if (_cliExecutor == null && _serviceProvider != null)
    {
        _cliExecutor = _serviceProvider.GetService<ICliExecutor>();
    }
    return _cliExecutor;
}
```

### 2. Updated System Prompt

Agents receive a new system prompt that teaches them about `maestro_cli`:

```
You have ONE tool: maestro_cli. Use it to interact with the system.

Available commands via maestro_cli:
- List files: {"tool":"maestro_cli","args":{"command":"run directory-list --input path=<path>"}}
- Read file: {"tool":"maestro_cli","args":{"command":"run file-read --input path=<path>"}}
- Write file: {"tool":"maestro_cli","args":{"command":"run file-write --input path=<path> --input content=<content>"}}
- List blocks: {"tool":"maestro_cli","args":{"command":"list-blocks"}}
- List tools: {"tool":"maestro_cli","args":{"command":"list-tools"}}
- Run any block: {"tool":"maestro_cli","args":{"command":"run <block-id> --input <key>=<value>"}}
- Get help: {"tool":"maestro_cli","args":{"command":"help [command]"}}
```

### 3. Tool Call Routing

When the agent makes a tool call:

```csharp
if (toolId == "maestro_cli" || toolId == "maestro-cli")
{
    // Extract command from args
    command = args.TryGetProperty("command", out var cmdProp)
        ? cmdProp.GetString() : null;

    // Build CLI context from execution context
    var cliContext = new CliExecutionContext
    {
        WorkspaceId = context.Variables["workspaceId"],
        SessionId = context.Variables["sessionId"],
        AgentId = block.Id
    };

    // Execute with permission enforcement
    var cliResult = await cliExecutor.ExecuteAsync(command, cliContext, ct);
}
```

### 4. Legacy Tool Support

Backwards compatibility is maintained for legacy tool names:

```csharp
private static readonly Dictionary<string, string> LegacyToolMapping = new()
{
    { "list_files", "run directory-list --input path=" },
    { "read_file", "run file-read --input path=" },
    { "write_file", "run file-write" },
    // ... more mappings
};

// Convert legacy tool calls to CLI commands
private string? ConvertLegacyToolToCommand(string toolId, JsonElement args)
{
    if (!LegacyToolMapping.TryGetValue(toolId, out var baseCommand))
        return null;
    // Build full command from args...
}
```

---

## Benefits

### 1. Unified Interface
All system capabilities accessible through one tool, reducing complexity for LLMs.

### 2. Permission Enforcement
Every command goes through the permission checker, ensuring agents stay within their granted permissions.

### 3. Discoverability
Agents can use `list-tools`, `list-blocks`, and `help` to discover available capabilities.

### 4. Extensibility
Adding new capabilities requires only adding new command handlers, not modifying agent code.

### 5. Backwards Compatibility
Legacy tool names continue to work, allowing gradual migration.

---

## Usage Example

### Agent Task Execution

```
Agent receives task: "Read the contents of README.md"

Agent thinks: I need to read a file. I'll use maestro_cli.

Agent outputs:
{"tool":"maestro_cli","args":{"command":"run file-read --input path=./README.md"}}

System executes:
1. Parse command: run file-read --input path=./README.md
2. Check permissions for agent's session
3. Execute file-read block
4. Return result to agent

Agent receives: "# Maestro\n\nAn autonomous multi-agent orchestrator..."
```

---

## Next Steps

- Phase 7: Workspace Block Resolution (workspace-local blocks override system blocks)
- Phase 8: UI Blocks (progress visualization)
- Phase 9: Complete Workspace Setup (research workspace template)
