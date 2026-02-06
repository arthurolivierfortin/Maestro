# Implementation Plan: Research Workspace Infrastructure

**Purpose**: Phased implementation to achieve the Research Workspace architecture
**Target**: `docs/analysis/RESEARCH-WORKSPACE-ARCHITECTURE-ANALYSIS.md`
**Prerequisite Documents**:
- `docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md`
- `docs/architecture/DESIGN-MAESTRO-CLI-BLOCK.md`

---

## Overview

This plan implements the infrastructure needed to support the Model Research workspace. The key architectural pattern is the **maestro-cli block**: agents interact with Maestro through a single CLI interface block that enforces permissions per context (workspace/session).

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAESTRO SYSTEM                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    WORKSPACE / SESSION CONTEXT                          ││
│  │                                                                         ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │                          AGENT                                     │ ││
│  │  │                                                                    │ ││
│  │  │  Has ONE tool: maestro-cli                                        │ ││
│  │  │                                                                    │ ││
│  │  │  Agent calls: maestro_cli({ command: "list-tools" })              │ ││
│  │  │  Agent calls: maestro_cli({ command: "run fitness-calculator" })  │ ││
│  │  │                                                                    │ ││
│  │  └──────────────────────────────┬────────────────────────────────────┘ ││
│  │                                 │                                       ││
│  │                                 ▼                                       ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │              system:maestro-cli (Tool Block)                       │ ││
│  │  │                                                                    │ ││
│  │  │  1. Receives command                                               │ ││
│  │  │  2. Adds context (workspaceId, sessionId)                          │ ││
│  │  │  3. Sends to backend: POST /api/cli/execute                        │ ││
│  │  │                                                                    │ ││
│  │  └──────────────────────────────┬────────────────────────────────────┘ ││
│  │                                 │                                       ││
│  └─────────────────────────────────┼───────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         BACKEND CLI EXECUTOR                            ││
│  │                                                                         ││
│  │  1. Parse command                                                       ││
│  │  2. Load context permissions                                            ││
│  │  3. Verify permission for command/target                                ││
│  │  4. Resolve block (workspace first, then system)                        ││
│  │  5. Execute and return result                                           ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| **Agents use CLI** | Agents have ONE tool: `maestro-cli` |
| **Permissions at backend** | All permission checks happen in CLI Executor |
| **Workspace-scoped** | Blocks resolved from workspace first |
| **Session isolation** | Sessions restrict permissions from parent |
| **System blocks shared** | Fitness calculator etc. are system blocks |

---

## Phase 1: Workspace Foundation

**Goal**: Enable workspace creation, loading, and permission configuration

### 1.1 Backend: Workspace Entity

**File:** `backend/src/Maestro.Domain/Entities/Workspace.cs`

```csharp
public class Workspace
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Path { get; set; }
    public string Type { get; set; }  // "research", "development", etc.
    public WorkspaceConfig Config { get; set; }
    public WorkspacePermissions Permissions { get; set; }
    public Dictionary<string, string> EntryPoints { get; set; }
    public Dictionary<string, SessionTemplate> SessionTemplates { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class WorkspacePermissions
{
    public ContextPermissions DefaultAgentPermissions { get; set; }
    public Dictionary<string, ContextPermissions> AgentOverrides { get; set; }
}

public class ContextPermissions
{
    public List<string> AllowedCommands { get; set; }  // ["run", "list-tools", "data"]
    public List<string> AllowedTools { get; set; }     // ["fitness-calculator", "*"]
    public List<string> AllowedBlocks { get; set; }    // ["training-loop", "*"]
    public bool CanCreateBlocks { get; set; }
    public bool CanCreateSessions { get; set; }
    public List<string> DataCollections { get; set; }  // ["experiments", "metrics"]
    public List<string> AllowedPaths { get; set; }     // ["blocks/", "data/"]
}

public class SessionTemplate
{
    public string Type { get; set; }
    public ContextPermissions Permissions { get; set; }
    public bool LogAllCommands { get; set; }
}
```

### 1.2 Backend: Workspace Repository & Service

**Files to create:**

| File | Purpose |
|------|---------|
| `backend/src/Maestro.Application/Interfaces/IWorkspaceRepository.cs` | Repository interface |
| `backend/src/Maestro.Application/Interfaces/IWorkspaceService.cs` | Service interface |
| `backend/src/Maestro.Infrastructure/Workspaces/FileSystemWorkspaceRepository.cs` | File storage |
| `backend/src/Maestro.Infrastructure/Workspaces/WorkspaceService.cs` | Business logic |

### 1.3 Backend: Workspaces Controller

**File:** `backend/src/Maestro.Api/Controllers/WorkspacesController.cs`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | List all workspaces |
| GET | `/api/workspaces/{id}` | Get workspace details |
| PUT | `/api/workspaces/{id}` | Update workspace |
| DELETE | `/api/workspaces/{id}` | Delete workspace |
| POST | `/api/workspaces/{id}/validate` | Validate structure |

### 1.4 Verification

```bash
cd backend && dotnet build
# Test workspace CRUD via API
```

---

## Phase 2: Session Management

**Goal**: Enable session creation with permission inheritance

### 2.1 Backend: Session Entity

**File:** `backend/src/Maestro.Domain/Entities/Session.cs`

```csharp
public class Session
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Type { get; set; }  // "training", "foundry", "project"
    public string ParentWorkspaceId { get; set; }
    public string ParentSessionId { get; set; }  // For nested sessions
    public string CreatedByAgentId { get; set; }
    public ContextPermissions Permissions { get; set; }
    public SessionState State { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EndedAt { get; set; }
}

public class SessionState
{
    public string Status { get; set; }  // "running", "paused", "ended"
    public string CurrentAgentId { get; set; }
    public Dictionary<string, object> Context { get; set; }
}
```

### 2.2 Backend: Session Service

**File:** `backend/src/Maestro.Infrastructure/Sessions/SessionService.cs`

```csharp
public interface ISessionService
{
    Task<Session> CreateAsync(CreateSessionRequest request);
    Task<Session> GetAsync(string sessionId);
    Task<IEnumerable<Session>> ListByWorkspaceAsync(string workspaceId);
    Task<Session> AttachAsync(string sessionId, string agentId);
    Task EndAsync(string sessionId);
    Task<ContextPermissions> GetEffectivePermissionsAsync(string sessionId);
}
```

Key logic:
- Session permissions cannot exceed parent workspace permissions
- Nested sessions inherit from parent session (not workspace)
- `GetEffectivePermissions` computes the intersection

### 2.3 Verification

```bash
# Create session via API
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "model-research", "type": "training", "allowedTools": ["fitness-calculator"]}'
```

---

## Phase 3: CLI Executor (Core)

**Goal**: Backend command routing with permission enforcement

### 3.1 Backend: CLI Controller

**File:** `backend/src/Maestro.Api/Controllers/CliController.cs`

```csharp
[ApiController]
[Route("api/cli")]
public class CliController : ControllerBase
{
    private readonly ICliExecutor _executor;

    [HttpPost("execute")]
    public async Task<ActionResult<CliResult>> Execute([FromBody] CliRequest request)
    {
        // request = { command: "run fitness-calculator --input ...", context: { workspaceId, sessionId } }
        var result = await _executor.ExecuteAsync(request.Command, request.Context);
        return Ok(result);
    }
}

public record CliRequest
{
    public string Command { get; init; }
    public ExecutionContext Context { get; init; }
}

public record CliResult
{
    public bool Success { get; init; }
    public object Output { get; init; }
    public string Error { get; init; }
    public int ExitCode { get; init; }
}
```

### 3.2 Backend: CLI Executor

**File:** `backend/src/Maestro.Infrastructure/Cli/CliExecutor.cs`

```csharp
public class CliExecutor : ICliExecutor
{
    private readonly IPermissionChecker _permissionChecker;
    private readonly Dictionary<string, ICommandHandler> _handlers;

    public async Task<CliResult> ExecuteAsync(string command, ExecutionContext context)
    {
        // 1. Parse command
        var parsed = CliParser.Parse(command);
        // parsed = { verb: "run", target: "fitness-calculator", args: {...} }

        // 2. Load context permissions
        var permissions = await _permissionChecker.GetPermissionsAsync(context);

        // 3. Check command permission
        if (!permissions.AllowedCommands.Contains(parsed.Verb) &&
            !permissions.AllowedCommands.Contains("*"))
        {
            return CliResult.PermissionDenied($"Command '{parsed.Verb}' not allowed");
        }

        // 4. Check target permission (for 'run' command)
        if (parsed.Verb == "run")
        {
            if (!permissions.AllowedTools.Contains(parsed.Target) &&
                !permissions.AllowedBlocks.Contains(parsed.Target) &&
                !permissions.AllowedTools.Contains("*"))
            {
                return CliResult.PermissionDenied($"'{parsed.Target}' not accessible");
            }
        }

        // 5. Route to handler
        if (!_handlers.TryGetValue(parsed.Verb, out var handler))
        {
            return CliResult.Error($"Unknown command: {parsed.Verb}");
        }

        return await handler.HandleAsync(parsed, context, permissions);
    }
}
```

### 3.3 Backend: Command Handlers

**Directory:** `backend/src/Maestro.Infrastructure/Cli/CommandHandlers/`

| File | Commands |
|------|----------|
| `RunCommandHandler.cs` | `run <block-id>` |
| `ListCommandHandler.cs` | `list-tools`, `list-blocks`, `list-strategies` |
| `DescribeCommandHandler.cs` | `describe <block-id>` |
| `DataCommandHandler.cs` | `data read/write/list/delete` |
| `SessionCommandHandler.cs` | `session create/list/attach/end` |
| `BlockCommandHandler.cs` | `block create/edit/delete/copy` |
| `WorkspaceCommandHandler.cs` | `workspace info/files/config` |

### 3.4 Backend: Permission Checker

**File:** `backend/src/Maestro.Infrastructure/Cli/PermissionChecker.cs`

```csharp
public class PermissionChecker : IPermissionChecker
{
    public async Task<ContextPermissions> GetPermissionsAsync(ExecutionContext context)
    {
        // If in session, get session permissions
        if (!string.IsNullOrEmpty(context.SessionId))
        {
            var session = await _sessionService.GetAsync(context.SessionId);
            return session.Permissions;
        }

        // If in workspace, get workspace permissions for agent
        if (!string.IsNullOrEmpty(context.WorkspaceId))
        {
            var workspace = await _workspaceService.GetAsync(context.WorkspaceId);

            // Check for agent-specific overrides
            if (context.AgentId != null &&
                workspace.Permissions.AgentOverrides.TryGetValue(context.AgentId, out var agentPerms))
            {
                return agentPerms;
            }

            return workspace.Permissions.DefaultAgentPermissions;
        }

        // No context = no permissions
        return ContextPermissions.None;
    }
}
```

### 3.5 Verification

```bash
# Test CLI executor directly
curl -X POST http://localhost:5000/api/cli/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "list-tools", "context": {"workspaceId": "model-research"}}'

# Should return list of allowed tools
```

---

## Phase 4: Maestro-CLI Block

**Goal**: Create the system block that agents use

### 4.1 Block Definition

**File:** `blocks/system/maestro-cli.tool.block.json`

```json
{
  "id": "system:maestro-cli",
  "name": "Maestro CLI",
  "blockType": "tool",
  "version": "1.0.0",
  "isSystem": true,
  "isAtomic": true,
  "description": "CLI interface for agents to interact with Maestro",

  "config": {
    "executorType": "cli-bridge",
    "timeout": 60000
  },

  "inputs": {
    "command": {
      "type": "string",
      "required": true,
      "description": "Maestro command (without 'maestro' prefix)"
    }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "output": { "type": "any" },
    "error": { "type": "string" },
    "exitCode": { "type": "number" }
  }
}
```

### 4.2 Backend: CLI Bridge Executor

**File:** `backend/src/Maestro.Infrastructure/Execution/ToolExecutors/CliBridgeExecutor.cs`

```csharp
public class CliBridgeExecutor : IToolExecutor
{
    private readonly ICliExecutor _cliExecutor;

    public async Task<ExecutionResult> ExecuteAsync(
        BlockDefinition block,
        Dictionary<string, object> inputs,
        ExecutionContext context)
    {
        var command = inputs["command"]?.ToString();
        if (string.IsNullOrEmpty(command))
        {
            return ExecutionResult.Failure("Command is required");
        }

        // Execute via CLI executor (which handles permissions)
        var result = await _cliExecutor.ExecuteAsync(command, context);

        return new ExecutionResult
        {
            Success = result.Success,
            Data = new {
                success = result.Success,
                output = result.Output,
                error = result.Error,
                exitCode = result.ExitCode
            }
        };
    }
}
```

### 4.3 Backend: Register Executor

**Modify:** `backend/src/Maestro.Api/Program.cs`

```csharp
// Register CLI executor
builder.Services.AddSingleton<ICliExecutor, CliExecutor>();
builder.Services.AddSingleton<IPermissionChecker, PermissionChecker>();

// Register command handlers
builder.Services.AddSingleton<ICommandHandler, RunCommandHandler>();
builder.Services.AddSingleton<ICommandHandler, ListCommandHandler>();
// ... etc

// Register CLI bridge tool executor
builder.Services.AddKeyedSingleton<IToolExecutor, CliBridgeExecutor>("cli-bridge");
```

### 4.4 Verification

```bash
# Test via block execution
curl -X POST http://localhost:5000/api/blocks/execute \
  -H "Content-Type: application/json" \
  -d '{
    "blockId": "system:maestro-cli",
    "inputs": { "command": "list-tools" },
    "context": { "workspaceId": "model-research" }
  }'
```

---

## Phase 5: System Tool Blocks

**Goal**: Create system-level tools available to all workspaces

### 5.1 Fitness Calculator (System Block)

**File:** `blocks/system/tools/fitness-calculator.tool.block.json`

```json
{
  "id": "system:fitness-calculator",
  "name": "Fitness Calculator",
  "blockType": "tool",
  "version": "1.0.0",
  "isSystem": true,
  "isAtomic": true,
  "overridable": true,
  "description": "Calculates model fitness using Maestro formula",

  "config": {
    "executorType": "script",
    "runtime": "javascript",
    "script": "fitness-calculator.js"
  },

  "inputs": {
    "executionMetrics": { "type": "object", "required": true },
    "modelId": { "type": "string", "required": true },
    "taskType": { "type": "string", "default": "general" },
    "configOverrides": { "type": "object", "required": false }
  },

  "outputs": {
    "totalFitness": { "type": "number" },
    "breakdown": { "type": "object" },
    "interpretation": { "type": "string" }
  },

  "provides": {
    "capabilities": ["fitness-calculation", "model-evaluation"]
  }
}
```

**Script:** `blocks/system/tools/scripts/fitness-calculator.js`

(Same implementation as before, but reads default config from system path with workspace override support)

### 5.2 Data Store (System Block)

**File:** `blocks/system/tools/data-store.tool.block.json`

```json
{
  "id": "system:data-store",
  "name": "Data Store",
  "blockType": "tool",
  "version": "1.0.0",
  "isSystem": true,
  "isAtomic": true,
  "overridable": true,
  "description": "Read/write JSON data in workspace data folder",

  "config": {
    "executorType": "script",
    "runtime": "javascript",
    "script": "data-store.js"
  },

  "inputs": {
    "action": { "type": "string", "enum": ["read", "write", "list", "delete"] },
    "collection": { "type": "string", "required": true },
    "id": { "type": "string" },
    "data": { "type": "object" },
    "filter": { "type": "object" }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "data": { "type": "any" },
    "error": { "type": "string" }
  },

  "provides": {
    "capabilities": ["storage", "persistence", "json-data"]
  }
}
```

### 5.3 Other System Tools

| Block | File | Purpose |
|-------|------|---------|
| `system:metrics-collector` | `metrics-collector.tool.block.json` | Aggregate metrics |
| `system:leaderboard-manager` | `leaderboard-manager.tool.block.json` | Manage rankings |
| `system:checkpoint-manager` | `checkpoint-manager.tool.block.json` | Save/load state |

### 5.4 Verification

```bash
# Test fitness calculator via CLI block
curl -X POST http://localhost:5000/api/cli/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "run system:fitness-calculator --input modelId=smollm2:1.7b --input-json {\"executionMetrics\":{\"qualityScore\":0.8}}",
    "context": {"workspaceId": "model-research"}
  }'
```

---

## Phase 6: Agent Execution with maestro-cli

**Goal**: Agents execute using only the maestro-cli tool

### 6.1 Backend: Agent Executor Update

**Modify:** `backend/src/Maestro.Infrastructure/Execution/BlockExecutors/AgentBlockExecutor.cs`

```csharp
public async Task<ExecutionResult> ExecuteAsync(
    BlockDefinition block,
    Dictionary<string, object> inputs,
    ExecutionContext context)
{
    // Build tool definition for LLM
    var tools = new List<ToolDefinition>
    {
        new ToolDefinition
        {
            Name = "maestro_cli",
            Description = BuildCliToolDescription(context),
            Parameters = new {
                type = "object",
                properties = new {
                    command = new {
                        type = "string",
                        description = "Maestro command (without 'maestro' prefix)"
                    }
                },
                required = new[] { "command" }
            }
        }
    };

    // Execute agent with maestro-cli as only tool
    var response = await _llmService.ChatWithToolsAsync(
        model: block.Config.Model,
        systemPrompt: block.SystemPrompt,
        userMessage: BuildUserMessage(inputs),
        tools: tools,
        onToolCall: async (toolCall) => {
            if (toolCall.Name == "maestro_cli")
            {
                var command = toolCall.Arguments["command"]?.ToString();
                return await _cliExecutor.ExecuteAsync(command, context);
            }
            return CliResult.Error($"Unknown tool: {toolCall.Name}");
        }
    );

    return new ExecutionResult { Success = true, Data = response };
}

private string BuildCliToolDescription(ExecutionContext context)
{
    return @"Execute Maestro CLI commands.

Available commands:
- list-tools: See available tools
- list-blocks: See all accessible blocks
- describe <block-id>: Get block details
- run <block-id> --input key=value: Execute a block
- data read/write/list: Manage workspace data

Always start with 'list-tools' to see what you can use.";
}
```

### 6.2 Verification

```bash
# Test agent execution (agent will use maestro-cli internally)
curl -X POST http://localhost:5000/api/blocks/execute \
  -H "Content-Type: application/json" \
  -d '{
    "blockId": "experiment-manager",
    "inputs": { "_action": "list" },
    "context": { "workspaceId": "model-research" }
  }'
```

---

## Phase 7: Workspace Block Resolution

**Goal**: Blocks resolved from workspace first, then system

### 7.1 Backend: Enhanced Block Repository

**Modify:** `backend/src/Maestro.Infrastructure/Blocks/FileSystemBlockRepository.cs`

```csharp
public async Task<BlockDefinition> GetByIdAsync(string blockId, ExecutionContext context)
{
    // 1. If explicit system prefix, load from system only
    if (blockId.StartsWith("system:"))
    {
        return await LoadSystemBlock(blockId.Substring(7));
    }

    // 2. Try workspace-local first (if in workspace context)
    if (!string.IsNullOrEmpty(context?.WorkspaceId))
    {
        var workspace = await _workspaceService.GetAsync(context.WorkspaceId);
        var localBlock = await TryLoadFromWorkspace(blockId, workspace.Path);
        if (localBlock != null)
        {
            return localBlock;
        }
    }

    // 3. Fall back to system blocks
    return await LoadSystemBlock(blockId);
}

private async Task<BlockDefinition> TryLoadFromWorkspace(string blockId, string workspacePath)
{
    var searchPaths = new[]
    {
        Path.Combine(workspacePath, "blocks", "tools", $"{blockId}.tool.block.json"),
        Path.Combine(workspacePath, "blocks", "agents", $"{blockId}.agent.block.json"),
        Path.Combine(workspacePath, "blocks", "workflows", $"{blockId}.workflow.block.json"),
        Path.Combine(workspacePath, "blocks", "strategies", $"{blockId}.workflow.block.json")
    };

    foreach (var path in searchPaths)
    {
        if (File.Exists(path))
        {
            return await LoadBlockFromFile(path);
        }
    }

    return null;
}
```

### 7.2 Verification

```bash
# Create workspace-local override
# Copy system:fitness-calculator to workspace/blocks/tools/fitness-calculator.tool.block.json
# Modify it
# Run - should use workspace version
```

---

## Phase 8: UI Blocks

**Goal**: Render custom dashboards from workspace UI blocks

(Same as before - UI block rendering via iframe with postMessage)

---

## Phase 9: Complete Workspace Setup

**Goal**: Create full Model Research workspace

### 9.1 Workspace Structure

```
workspaces/model-research/
├── workspace.json
├── blocks/
│   ├── agents/
│   │   ├── experiment-manager.agent.block.json
│   │   ├── researcher-agent.agent.block.json
│   │   ├── trainer-agent.agent.block.json
│   │   └── ...
│   ├── workflows/
│   │   ├── research-team.workflow.block.json
│   │   ├── training-loop.workflow.block.json
│   │   └── ...
│   ├── strategies/
│   │   └── (copied from system, customized)
│   └── ui/
│       └── research-dashboard.ui.block.json
├── data/
│   ├── experiments/
│   ├── metrics/
│   ├── leaderboard/
│   └── checkpoints/
└── config/
    ├── models.json
    └── fitness-config.json
```

### 9.2 workspace.json

```json
{
  "id": "model-research",
  "name": "Model Research",
  "type": "research",

  "permissions": {
    "defaultAgentPermissions": {
      "allowedCommands": ["run", "list-tools", "list-blocks", "describe", "data", "session", "block"],
      "allowedTools": ["*"],
      "allowedBlocks": ["*"],
      "canCreateBlocks": true,
      "canCreateSessions": true,
      "dataCollections": ["*"]
    },
    "agentOverrides": {
      "trainer-agent": {
        "allowedCommands": ["run", "list-tools", "data"],
        "allowedTools": ["system:fitness-calculator", "system:data-store", "system:metrics-collector"],
        "canCreateBlocks": false,
        "canCreateSessions": false
      }
    }
  },

  "sessionTemplates": {
    "training": {
      "permissions": {
        "allowedCommands": ["run", "list-tools", "data"],
        "allowedTools": ["system:fitness-calculator", "system:data-store"],
        "canCreateBlocks": false,
        "canCreateSessions": false
      }
    }
  },

  "entryPoints": {
    "main": "research-team",
    "dashboard": "research-dashboard",
    "experiments": "experiment-manager"
  }
}
```

### 9.3 Verification Checklist

```bash
# 1. Create workspace structure
# 2. Copy block definitions from docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md

# 3. Test agent can list tools
curl -X POST http://localhost:5000/api/cli/execute \
  -d '{"command": "list-tools", "context": {"workspaceId": "model-research"}}'

# 4. Test agent can run fitness calculator
curl -X POST http://localhost:5000/api/cli/execute \
  -d '{"command": "run system:fitness-calculator --input modelId=smollm2:1.7b", "context": {"workspaceId": "model-research"}}'

# 5. Test session creation with restricted permissions
curl -X POST http://localhost:5000/api/cli/execute \
  -d '{"command": "session create --type training", "context": {"workspaceId": "model-research"}}'

# 6. Test restricted session cannot access unauthorized tools
# (Should fail)
curl -X POST http://localhost:5000/api/cli/execute \
  -d '{"command": "block create --type tool", "context": {"sessionId": "training-session-id"}}'
```

---

## Phase Summary

| Phase | Goal | Key Deliverables |
|-------|------|------------------|
| **1** | Workspace Foundation | Workspace entity with permissions |
| **2** | Session Management | Session creation with permission inheritance |
| **3** | CLI Executor | Backend command routing + permission checks |
| **4** | Maestro-CLI Block | The single tool agents use |
| **5** | System Tools | Fitness calculator, data store as system blocks |
| **6** | Agent Execution | Agents use only maestro-cli tool |
| **7** | Block Resolution | Workspace-first resolution |
| **8** | UI Blocks | Custom dashboards |
| **9** | Complete Setup | Full workspace with all blocks |

---

## Execution Order

```
Phase 1 (Workspace Foundation)
    │
    └─► Phase 2 (Session Management)
            │
            └─► Phase 3 (CLI Executor) ◄── CRITICAL PATH
                    │
                    └─► Phase 4 (Maestro-CLI Block)
                            │
                            ├─► Phase 5 (System Tools)
                            │
                            └─► Phase 6 (Agent Execution)
                                    │
                                    └─► Phase 7 (Block Resolution)
                                            │
                                            ├─► Phase 8 (UI Blocks)
                                            │
                                            └─► Phase 9 (Complete Setup)
```

**Minimum viable path**: Phases 1 → 2 → 3 → 4 → 5 → 6 → 9

---

## Files Summary

### New Backend Files

```
backend/src/Maestro.Domain/Entities/
├── Workspace.cs (updated with permissions)
└── Session.cs

backend/src/Maestro.Application/Interfaces/
├── IWorkspaceService.cs
├── ISessionService.cs
├── ICliExecutor.cs
├── IPermissionChecker.cs
└── ICommandHandler.cs

backend/src/Maestro.Infrastructure/
├── Workspaces/
│   ├── FileSystemWorkspaceRepository.cs
│   └── WorkspaceService.cs
├── Sessions/
│   ├── FileSystemSessionRepository.cs
│   └── SessionService.cs
├── Cli/
│   ├── CliExecutor.cs
│   ├── CliParser.cs
│   ├── PermissionChecker.cs
│   └── CommandHandlers/
│       ├── RunCommandHandler.cs
│       ├── ListCommandHandler.cs
│       ├── DataCommandHandler.cs
│       ├── SessionCommandHandler.cs
│       ├── BlockCommandHandler.cs
│       └── DescribeCommandHandler.cs
└── Execution/ToolExecutors/
    └── CliBridgeExecutor.cs

backend/src/Maestro.Api/Controllers/
├── CliController.cs
├── WorkspacesController.cs
└── SessionsController.cs
```

### New Block Files

```
blocks/system/
├── maestro-cli.tool.block.json
└── tools/
    ├── fitness-calculator.tool.block.json
    ├── data-store.tool.block.json
    ├── metrics-collector.tool.block.json
    ├── leaderboard-manager.tool.block.json
    ├── checkpoint-manager.tool.block.json
    └── scripts/
        ├── fitness-calculator.js
        ├── data-store.js
        └── ...
```

---

## Related Documents

- `docs/architecture/DESIGN-MAESTRO-CLI-BLOCK.md` - Detailed design rationale
- `docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md` - Workspace configuration
- `docs/analysis/RESEARCH-WORKSPACE-ARCHITECTURE-ANALYSIS.md` - Architecture analysis

---

*"The agent sees a terminal. The terminal is a block. Everything is a block."*
