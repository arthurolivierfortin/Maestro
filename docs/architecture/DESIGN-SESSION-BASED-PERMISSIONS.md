# Design: Session-Based Permission Model

**Status**: Approved
**Date**: February 3, 2026
**Related**: `DESIGN-MAESTRO-CLI-BLOCK.md`, `MAESTRO-PHILOSOPHY-V2.md`

---

## Summary

Permissions in Maestro are tied to **contexts** (workspaces and sessions), not to agent identities. When an agent executes via `maestro-cli`, the permissions come from the context in which it runs.

---

## Core Principle

```
┌─────────────────────────────────────────────────────────────┐
│  Context defines permissions, not agent identity            │
└─────────────────────────────────────────────────────────────┘
```

**What this means:**
- A workspace has `ContextPermissions` - the maximum possible in that workspace
- A session has `ContextPermissions` - can only restrict from parent, never exceed
- Agents execute within a context and inherit its permissions
- The same agent can have different permissions in different contexts

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WORKSPACE (model-research)                                  │
│  ├─ Permissions: { allowedCommands: ["*"], ... }            │
│  │                                                           │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │  SESSION (training-session-001)                     │ │
│  │  │  ├─ Permissions: {                                  │ │
│  │  │  │    allowedCommands: ["run", "data"],             │ │
│  │  │  │    allowedTools: ["fitness-calculator"],         │ │
│  │  │  │    canCreateBlocks: false                        │ │
│  │  │  │  }                                               │ │
│  │  │  │                                                  │ │
│  │  │  │  trainer-agent executes here                     │ │
│  │  │  │  → Can only use fitness-calculator               │ │
│  │  │  │  → Cannot create blocks                          │ │
│  │  └──┴──────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │  SESSION (evaluation-session-001)                   │ │
│  │  │  ├─ Permissions: {                                  │ │
│  │  │  │    allowedCommands: ["run", "list-tools"],       │ │
│  │  │  │    allowedTools: ["fitness-calculator"],         │ │
│  │  │  │    canCreateBlocks: false,                       │ │
│  │  │  │    maxIterations: 100                            │ │
│  │  │  │  }                                               │ │
│  │  │  │                                                  │ │
│  │  │  │  evaluator-agent executes here                   │ │
│  │  │  │  → Limited to 100 iterations                     │ │
│  │  └──┴──────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  experiment-manager runs directly in workspace           │
│  │  → Has full workspace permissions                        │
│  │                                                           │
└──┴───────────────────────────────────────────────────────────┘
```

---

## Why This Design

### Alternative Considered: Agent-Specific Permissions

```json
// REJECTED: AgentPermissions with overrides
{
  "agentPermissions": {
    "defaultAgentPermissions": { ... },
    "agentOverrides": {
      "trainer-agent": { ... },
      "evaluator-agent": { ... }
    }
  }
}
```

**Problems with agent-specific permissions:**
1. Ties permissions to agent identity - breaks composability
2. Same agent can't have different permissions in different contexts
3. Requires knowing all agents upfront
4. Implicit magic - hard to see what an agent can do

### Chosen: Session-Based Permissions

**Advantages:**
1. **Explicit** - You create a session with specific permissions
2. **Composable** - Same agent can run in different contexts
3. **Consistent** - Context IS the permission boundary
4. **Flexible** - Sessions can be nested with further restrictions

---

## How It Works

### 1. Workspace Defines Maximum

```json
// workspace.json
{
  "id": "model-research",
  "permissions": {
    "allowedCommands": ["run", "list-tools", "list-blocks", "describe", "data", "session", "block"],
    "allowedTools": ["*"],
    "allowedBlocks": ["*"],
    "canCreateBlocks": true,
    "canCreateSessions": true,
    "dataCollections": ["*"]
  }
}
```

### 2. Session Templates Define Restrictions

```json
// workspace.json
{
  "sessionTemplates": {
    "training": {
      "type": "training",
      "description": "Restricted session for training runs",
      "permissions": {
        "allowedCommands": ["run", "data"],
        "allowedTools": ["system:fitness-calculator", "system:data-store"],
        "canCreateBlocks": false,
        "canCreateSessions": false
      },
      "logAllCommands": true
    },
    "evaluation": {
      "type": "evaluation",
      "permissions": {
        "allowedCommands": ["run", "list-tools"],
        "allowedTools": ["system:fitness-calculator"],
        "canCreateBlocks": false
      },
      "maxIterations": 100
    }
  }
}
```

### 3. Orchestrator Creates Sessions

```
research-team workflow:

1. experiment-manager starts (workspace context - full access)

2. experiment-manager calls:
   maestro_cli({ command: "session create --type training" })
   → Returns session ID: "training-session-001"

3. experiment-manager calls:
   maestro_cli({ command: "run trainer-agent --session training-session-001" })
   → trainer-agent executes with training session permissions

4. experiment-manager calls:
   maestro_cli({ command: "session create --type evaluation" })
   → Returns session ID: "eval-session-001"

5. experiment-manager calls:
   maestro_cli({ command: "run evaluator-agent --session eval-session-001" })
   → evaluator-agent executes with evaluation session permissions
```

### 4. Workflows Can Declare Session Context

```json
// research-team.workflow.block.json
{
  "id": "research-team",
  "blockType": "workflow",
  "steps": [
    {
      "id": "manage",
      "block": "experiment-manager"
      // No session specified - uses workflow's context
    },
    {
      "id": "train",
      "block": "trainer-agent",
      "sessionTemplate": "training"
      // Auto-creates session from template
    },
    {
      "id": "evaluate",
      "block": "evaluator-agent",
      "sessionTemplate": "evaluation"
      // Auto-creates session from template
    }
  ]
}
```

---

## Permission Inheritance

```
Workspace Permissions
        │
        │  Session.Permissions = intersection(Parent, Template)
        │
        ▼
Session Permissions (cannot exceed workspace)
        │
        │  NestedSession.Permissions = intersection(Parent, Template)
        │
        ▼
Nested Session Permissions (cannot exceed parent session)
```

**Example:**

```javascript
// Workspace allows everything
workspace.permissions = { allowedCommands: ["*"], allowedTools: ["*"] }

// Training template restricts
trainingTemplate.permissions = { allowedCommands: ["run", "data"], allowedTools: ["fitness-*"] }

// Effective session permissions = intersection
session.permissions = { allowedCommands: ["run", "data"], allowedTools: ["fitness-*"] }
```

---

## ContextPermissions Structure

```typescript
interface ContextPermissions {
  // CLI commands allowed
  allowedCommands: string[];    // ["run", "list-tools", "data", "*"]

  // Tools that can be executed
  allowedTools: string[];       // ["system:fitness-calculator", "system:*", "*"]

  // Blocks that can be executed
  allowedBlocks: string[];      // ["training-loop", "*"]

  // Can create new blocks
  canCreateBlocks: boolean;

  // Can create new sessions
  canCreateSessions: boolean;

  // Data collections accessible
  dataCollections: string[];    // ["experiments", "metrics", "*"]

  // Filesystem paths accessible (relative to workspace)
  allowedPaths: string[];       // ["blocks/", "data/"]
}
```

---

## CLI Commands for Sessions

```bash
# Create a session from template
maestro session create --type training --workspace model-research
# Returns: session-id: training-session-abc123

# List active sessions
maestro session list --workspace model-research

# Attach to a session (for debugging)
maestro session attach training-session-abc123

# End a session
maestro session end training-session-abc123

# Run a block in a specific session
maestro run trainer-agent --session training-session-abc123

# Run with auto-created session from template
maestro run trainer-agent --session-type training
```

---

## Comparison with Alternatives

| Approach | Explicit | Composable | Simple | Flexible |
|----------|----------|------------|--------|----------|
| **Session-based** (chosen) | ✅ | ✅ | ✅ | ✅ |
| Agent-specific overrides | ❌ | ❌ | ❌ | ✅ |
| Role-based access | ❌ | ❌ | ✅ | ❌ |
| Block-level permissions | ✅ | ❌ | ❌ | ✅ |

---

## Trade-offs

### Advantages

1. **Explicit** - Permissions are visible where they're used
2. **Composable** - Same agent works in any context
3. **Auditable** - Session logs show exactly what happened with what permissions
4. **Debuggable** - Can inspect session permissions at runtime
5. **Philosophy-aligned** - Context is the boundary, not identity

### Limitations

1. **Verbosity** - Must create sessions for restricted agents
2. **Orchestrator knowledge** - Someone must know which agents need restrictions
3. **Session lifecycle** - Must manage session creation/cleanup

### Mitigations

1. **Session templates** - Predefined configurations reduce boilerplate
2. **Workflow declarations** - `sessionTemplate` field automates creation
3. **CLI shortcuts** - `--session-type training` creates ephemeral sessions

---

## Related Documents

- `DESIGN-MAESTRO-CLI-BLOCK.md` - How agents interact via CLI
- `MAESTRO-PHILOSOPHY-V2.md` - Core principles
- `IMPLEMENTATION-PLAN-RESEARCH-WORKSPACE.md` - Implementation details

---

*"The context defines what's possible. The agent just executes within it."*
