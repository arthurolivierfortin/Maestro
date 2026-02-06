# Design Document: Maestro CLI Block Architecture

**Date**: February 3, 2026
**Status**: Approved
**Scope**: Agent-Backend Communication Pattern

---

## 1. Executive Summary

This document defines the architectural pattern for how agents interact with Maestro: through a single `maestro-cli` block that serves as the sole interface between agents and the backend.

### Core Principle

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   An agent has ONE tool: the maestro-cli block                  │
│                                                                  │
│   Through this block, it can do EVERYTHING its context allows   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

This mirrors how humans use Maestro: by typing CLI commands.

---

## 2. Design Rationale

### 2.1 Why This Pattern?

| Alternative | Problem |
|-------------|---------|
| Inject all tools directly into agent | Requires knowing tools at startup, no dynamic discovery |
| Agent calls backend APIs directly | Bypasses permission system, not CLI-first |
| MCP for internal agents | Overcomplicated, MCP is for external clients |
| Hardcode tools in agent definition | Not flexible, violates composability |

### 2.2 Benefits

| Benefit | Description |
|---------|-------------|
| **Philosophy Aligned** | "Tout est un Block" - the CLI interface IS a block |
| **CLI-First** | Agents use CLI exactly like humans |
| **Uniform** | Same pattern for workspaces, project sessions, foundry sessions |
| **Secure** | All permissions checked at one place (backend) |
| **Discoverable** | Agents can list available tools dynamically |
| **Composable** | Agents can create sessions with different permissions |

---

## 3. Architecture

### 3.1 Context Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKSPACE (extended permissions)                                            │
│                                                                              │
│  Researcher agent can:                                                       │
│  • List and run any tool in workspace                                        │
│  • Create new blocks (in workspace/blocks/)                                  │
│  • Create restricted sessions for training                                   │
│  • Access research tools (web search, file access, etc.)                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  PROJECT SESSION (moderate permissions)                                │ │
│  │                                                                        │ │
│  │  Development agent can:                                                │ │
│  │  • Run specific tools for the project                                  │ │
│  │  • Read/write project files                                            │ │
│  │  • Cannot create blocks or sessions                                    │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  TRAINING SESSION (restricted permissions)                             │ │
│  │                                                                        │ │
│  │  Trainer agent can:                                                    │ │
│  │  • Run only: fitness-calculator, data-store, metrics-collector         │ │
│  │  • Cannot create anything                                              │ │
│  │  • Cannot access files outside data/ folder                            │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  FOUNDRY SESSION (sandboxed)                                           │ │
│  │                                                                        │ │
│  │  Agent being tested can:                                               │ │
│  │  • Run only tools specified in test config                             │ │
│  │  • All actions logged for evaluation                                   │ │
│  │  • Completely isolated from other sessions                             │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 The maestro-cli Block

```json
{
  "id": "system:maestro-cli",
  "name": "Maestro CLI",
  "blockType": "tool",
  "version": "1.0.0",
  "isSystem": true,
  "isAtomic": true,
  "description": "CLI interface for agents to interact with Maestro. All commands are permission-checked against the current context (workspace/session).",

  "config": {
    "contextAware": true,
    "permissionCheck": "backend",
    "timeout": 60000
  },

  "inputs": {
    "command": {
      "type": "string",
      "required": true,
      "description": "Maestro command to execute (without 'maestro' prefix). Example: 'run fitness-calculator --input modelId=smollm2:1.7b'"
    }
  },

  "outputs": {
    "success": {
      "type": "boolean",
      "description": "Whether the command executed successfully"
    },
    "output": {
      "type": "any",
      "description": "Command output (JSON for structured data, string for text)"
    },
    "error": {
      "type": "string",
      "description": "Error message if command failed"
    },
    "exitCode": {
      "type": "number",
      "description": "Exit code (0 = success, non-zero = error)"
    }
  },

  "metadata": {
    "category": "system",
    "tags": ["cli", "interface", "core"]
  }
}
```

### 3.3 Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENT (in workspace or session)                                             │
│                                                                              │
│  The agent has ONE tool in its LLM context:                                 │
│                                                                              │
│  tools: [{                                                                   │
│    name: "maestro_cli",                                                      │
│    description: "Execute Maestro commands. Use 'list-tools' to see what's   │
│                  available, 'run <tool> --input ...' to execute.",          │
│    parameters: {                                                             │
│      command: { type: "string", description: "Command without 'maestro'" }  │
│    }                                                                         │
│  }]                                                                          │
│                                                                              │
│  Agent decides: "I need to calculate fitness"                               │
│  Agent calls: maestro_cli({ command: "run fitness-calculator --input ..." })│
│                                                                              │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAESTRO-CLI BLOCK EXECUTOR                                                  │
│                                                                              │
│  1. Receives: { command: "run fitness-calculator --input ..." }             │
│  2. Adds context from execution environment:                                 │
│     - sessionId (if in session)                                              │
│     - workspaceId (if in workspace)                                          │
│     - agentId (executing agent)                                              │
│  3. Sends to backend: POST /api/cli/execute                                 │
│                                                                              │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND - CliController                                                     │
│                                                                              │
│  POST /api/cli/execute                                                       │
│  {                                                                           │
│    "command": "run fitness-calculator --input modelId=smollm2:1.7b",        │
│    "context": {                                                              │
│      "sessionId": "sess-001",                                                │
│      "workspaceId": "model-research",                                        │
│      "agentId": "trainer-agent"                                              │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND - CliExecutor                                                       │
│                                                                              │
│  1. Parse command: verb="run", target="fitness-calculator", args={...}      │
│                                                                              │
│  2. Load context permissions:                                                │
│     Session "sess-001" allows: ["fitness-calculator", "data-store"]         │
│                                                                              │
│  3. Permission check:                                                        │
│     "fitness-calculator" in allowedTools? → YES                             │
│                                                                              │
│  4. Resolve block:                                                           │
│     - Check workspace/blocks/tools/fitness-calculator.json                  │
│     - Fallback to system:fitness-calculator                                  │
│                                                                              │
│  5. Execute block with inputs                                                │
│                                                                              │
│  6. Return result                                                            │
│                                                                              │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENT receives:                                                             │
│                                                                              │
│  {                                                                           │
│    "success": true,                                                          │
│    "output": {                                                               │
│      "totalFitness": 0.756,                                                  │
│      "breakdown": { "performance": 0.85, "cost": 0.1, ... }                 │
│    },                                                                        │
│    "exitCode": 0                                                             │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Available Commands

### 4.1 Discovery Commands

```bash
# List tools accessible in current context
maestro list-tools
# Output: ["fitness-calculator", "data-store", "metrics-collector"]

# List all blocks accessible (tools, workflows, agents)
maestro list-blocks [--type <type>]

# Get details about a specific block
maestro describe <block-id>
# Output: { "id": "...", "name": "...", "inputs": {...}, "outputs": {...} }

# List available strategies (for training)
maestro list-strategies [--category <cat>]
```

### 4.2 Execution Commands

```bash
# Run a block with inputs
maestro run <block-id> --input key=value --input key2=value2

# Run with JSON input
maestro run <block-id> --input-json '{"key": "value"}'

# Run and wait for completion
maestro run <block-id> --wait

# Run in background
maestro run <block-id> --background
```

### 4.3 Data Commands

```bash
# Read data from workspace data folder
maestro data read --collection <name> --id <id>

# Write data
maestro data write --collection <name> --id <id> --data '{"key": "value"}'

# List data in collection
maestro data list --collection <name> [--filter '{"status": "running"}']

# Delete data
maestro data delete --collection <name> --id <id>
```

### 4.4 Session Commands (if permitted)

```bash
# Create a new session with restricted permissions
maestro session create \
  --type training \
  --name "RL Training Session" \
  --allowed-tools fitness-calculator,data-store \
  --allowed-blocks training-loop

# List sessions
maestro session list [--status running]

# Get session details
maestro session describe <session-id>

# Attach to a session (execute commands in that context)
maestro session attach <session-id>

# End a session
maestro session end <session-id>
```

### 4.5 Block Management Commands (if permitted)

```bash
# Create a new block in workspace
maestro block create \
  --type tool \
  --name "my-custom-tool" \
  --template basic-tool

# Edit block configuration
maestro block edit <block-id> --set config.timeout=30000

# Copy a system block to workspace for customization
maestro block copy system:fitness-calculator --to blocks/tools/

# Delete a block
maestro block delete <block-id>
```

### 4.6 Workspace Commands (if permitted)

```bash
# Get workspace info
maestro workspace info

# List files in workspace
maestro workspace files [--path blocks/tools]

# Get workspace configuration
maestro workspace config
```

---

## 5. Permission Model

### 5.1 Context Types

| Context | Description | Typical Permissions |
|---------|-------------|---------------------|
| **Workspace** | Top-level container | Full access to workspace resources |
| **Project Session** | Development context | Moderate access, no session creation |
| **Training Session** | Training runs | Restricted to training tools |
| **Foundry Session** | Agent testing | Sandboxed, logged, minimal tools |

### 5.2 Permission Categories

```typescript
interface ContextPermissions {
  // Tool/Block execution
  allowedTools: string[];           // ["fitness-calculator", "data-store"]
  allowedBlocks: string[];          // ["training-loop", "sft-strategy"]
  allowedCommands: string[];        // ["run", "list-tools", "data"]

  // Block management
  canCreateBlocks: boolean;         // Can create new blocks
  canEditBlocks: boolean;           // Can modify existing blocks
  canDeleteBlocks: boolean;         // Can delete blocks

  // Session management
  canCreateSessions: boolean;       // Can create child sessions
  canEndSessions: boolean;          // Can end sessions
  maxChildSessions: number;         // Limit on concurrent sessions

  // Data access
  dataCollections: string[];        // ["experiments", "metrics"]
  canWriteData: boolean;
  canDeleteData: boolean;

  // File access
  allowedPaths: string[];           // ["blocks/", "data/", "config/"]
  canWriteFiles: boolean;
}
```

### 5.3 Permission Inheritance

```
Workspace Permissions
    │
    ├─→ Project Session (inherits subset)
    │       │
    │       └─→ Nested Session (inherits smaller subset)
    │
    └─→ Training Session (minimal permissions)
            │
            └─→ Foundry Session (sandboxed, logged)
```

### 5.4 Permission Checking Flow

```
Command received: "run secret-tool --input ..."
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Load context (session or workspace)                         │
│                                                                 │
│  context = {                                                    │
│    type: "training-session",                                    │
│    allowedTools: ["fitness-calculator", "data-store"],          │
│    ...                                                          │
│  }                                                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Check command permission                                    │
│                                                                 │
│  "run" in allowedCommands? → YES                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Check target permission                                     │
│                                                                 │
│  "secret-tool" in allowedTools? → NO                           │
│                                                                 │
│  Return error:                                                  │
│  {                                                              │
│    "success": false,                                            │
│    "error": "Permission denied: 'secret-tool' is not           │
│              accessible in this context",                       │
│    "exitCode": 403                                              │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Context Configuration

### 6.1 Workspace Configuration

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
      "dataCollections": ["*"],
      "allowedPaths": ["blocks/", "data/", "config/"]
    },

    "agentOverrides": {
      "researcher-agent": {
        "canCreateBlocks": true,
        "canCreateSessions": true
      },
      "trainer-agent": {
        "canCreateBlocks": false,
        "canCreateSessions": false
      }
    }
  },

  "sessionTemplates": {
    "training": {
      "allowedCommands": ["run", "list-tools", "data"],
      "allowedTools": ["fitness-calculator", "data-store", "metrics-collector"],
      "allowedBlocks": ["training-loop"],
      "canCreateBlocks": false,
      "canCreateSessions": false,
      "dataCollections": ["experiments", "metrics", "checkpoints"]
    },
    "foundry": {
      "allowedCommands": ["run", "list-tools"],
      "allowedTools": [],
      "allowedBlocks": [],
      "canCreateBlocks": false,
      "canCreateSessions": false,
      "logging": "full"
    }
  }
}
```

### 6.2 Session Configuration

```json
{
  "id": "sess-training-001",
  "type": "training",
  "parentWorkspace": "model-research",
  "createdBy": "researcher-agent",
  "createdAt": "2026-02-03T10:00:00Z",

  "permissions": {
    "allowedCommands": ["run", "list-tools", "data"],
    "allowedTools": ["fitness-calculator", "data-store"],
    "allowedBlocks": ["training-loop", "sft-strategy"],
    "canCreateBlocks": false,
    "canCreateSessions": false,
    "dataCollections": ["experiments", "metrics"]
  },

  "state": {
    "status": "running",
    "currentAgent": "trainer-agent",
    "startedAt": "2026-02-03T10:00:00Z"
  }
}
```

---

## 7. Agent Integration

### 7.1 How Agents Use maestro-cli

When an agent is executed, its ONLY available tool is `maestro_cli`:

```python
# Agent's tool definition (injected by Maestro runtime)
tools = [{
    "name": "maestro_cli",
    "description": """Execute Maestro CLI commands.

Available commands:
- list-tools: List tools you can use
- list-blocks: List all accessible blocks
- describe <block-id>: Get block details
- run <block-id> --input key=value: Execute a block
- data read/write/list: Manage data

Always use 'list-tools' first to see what's available.""",
    "parameters": {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "Command to execute (without 'maestro' prefix)"
            }
        },
        "required": ["command"]
    }
}]
```

### 7.2 Typical Agent Workflow

```
Agent receives task: "Calculate and store fitness for model X"
                            │
                            ▼
Agent thinks: "First, let me see what tools I have"
Agent calls: maestro_cli({ command: "list-tools" })
                            │
                            ▼
Agent receives: ["fitness-calculator", "data-store"]
                            │
                            ▼
Agent thinks: "I have fitness-calculator, let me check its inputs"
Agent calls: maestro_cli({ command: "describe fitness-calculator" })
                            │
                            ▼
Agent receives: { inputs: { modelId, executionMetrics }, outputs: { totalFitness } }
                            │
                            ▼
Agent thinks: "Now I can calculate fitness"
Agent calls: maestro_cli({
  command: "run fitness-calculator --input modelId=smollm2:1.7b --input-json '{\"executionMetrics\": {...}}'"
})
                            │
                            ▼
Agent receives: { totalFitness: 0.756, breakdown: {...} }
                            │
                            ▼
Agent thinks: "Now I'll store this result"
Agent calls: maestro_cli({
  command: "data write --collection metrics --id metric-001 --data '{\"fitness\": 0.756}'"
})
                            │
                            ▼
Task complete
```

---

## 8. Implementation Requirements

### 8.1 Backend Components

```
backend/src/Maestro.Api/Controllers/
└── CliController.cs              # POST /api/cli/execute

backend/src/Maestro.Application/Interfaces/
├── ICliExecutor.cs               # Command execution interface
├── IPermissionChecker.cs         # Permission verification
└── IContextManager.cs            # Session/workspace context

backend/src/Maestro.Infrastructure/Cli/
├── CliExecutor.cs                # Main command router
├── CliParser.cs                  # Parse command strings
├── PermissionChecker.cs          # Check permissions
└── CommandHandlers/
    ├── RunCommandHandler.cs      # Handle 'run' command
    ├── ListCommandHandler.cs     # Handle 'list-*' commands
    ├── DataCommandHandler.cs     # Handle 'data' commands
    ├── SessionCommandHandler.cs  # Handle 'session' commands
    ├── BlockCommandHandler.cs    # Handle 'block' commands
    └── DescribeCommandHandler.cs # Handle 'describe' command
```

### 8.2 Block Definition

```
blocks/system/
└── maestro-cli.tool.block.json   # The CLI interface block
```

### 8.3 Frontend Components

None required - this is backend/agent infrastructure.

---

## 9. Security Considerations

### 9.1 Command Injection Prevention

All commands are parsed and validated before execution. Raw shell execution is never used.

### 9.2 Path Traversal Prevention

File paths are validated to be within allowed workspace paths.

### 9.3 Permission Escalation Prevention

- Sessions cannot grant more permissions than their parent
- Workspace-level permissions are the maximum
- Agent overrides can only restrict, not expand

### 9.4 Audit Logging

All CLI commands are logged with:
- Timestamp
- Context (session/workspace)
- Agent ID
- Command
- Result (success/failure)
- Duration

---

## 10. Future Considerations

### 10.1 MCP Integration (for External Clients)

The `maestro-cli` pattern is for internal agents. For external clients (VS Code, Claude Desktop), a separate MCP server can be implemented that:
- Exposes Maestro commands as MCP tools
- Uses the same permission system
- Routes to the same backend handlers

### 10.2 Command Plugins

Future commands can be added by:
- Creating new CommandHandler classes
- Registering in CliExecutor
- No changes to maestro-cli block needed

---

## 11. Summary

The `maestro-cli` block architecture provides:

| Aspect | Implementation |
|--------|----------------|
| **Single Interface** | One tool for all agent-Maestro interaction |
| **CLI-First** | Agents use commands like humans |
| **Permission Control** | Backend validates all commands |
| **Context Awareness** | Commands respect workspace/session context |
| **Discoverability** | Agents can list available tools |
| **Composability** | Agents can create restricted sessions |
| **Philosophy Aligned** | The CLI interface is itself a block |

---

*"The agent sees a terminal. The terminal is a block. Everything is a block."*
