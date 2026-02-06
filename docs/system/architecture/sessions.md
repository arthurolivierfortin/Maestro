# Session Architecture

> "Context defines permissions, not agent identity. Container defines isolation, not session type."

Sessions are the runtime execution contexts in Maestro. This document describes the session system, container hierarchy, self-describing architecture, and permission model.

---

## Session Types

Maestro has two primary session types:

| Type | Purpose | Environment | Outcome |
|------|---------|-------------|---------|
| **Foundry Session** | Forge and validate blocks | Isolated sandbox | Published block in catalog |
| **Project Session** | Execute on real projects | Attached repository | Task completed, code committed |

### Visual Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         FOUNDRY                              │
│                   (Development Workshop)                     │
│                                                              │
│  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐  │
│  │  DRAFT  │──►│ SESSION  │──►│ IMPROVE │──►│  PUBLISH │  │
│  │(Create) │   │(Exec+Eval)│   │(Iterate)│   │(Catalog) │  │
│  └─────────┘   └──────────┘   └─────────┘   └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Use published blocks
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT SESSION                         │
│                   (Production Execution)                     │
│                                                              │
│  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐  │
│  │ SELECT  │──►│ EXECUTE  │──►│VALIDATE │──►│  COMMIT  │  │
│  │(Workflow)│   │(On Proj) │   │ (Tests) │   │  (Git)   │  │
│  └─────────┘   └──────────┘   └─────────┘   └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Container Session Hierarchy

Sessions inherit from a unified class hierarchy:

```
                         ContainerSession (abstract)
                         ├─ Id, Name, Description
                         ├─ Status (unified enum)
                         ├─ ContextPermissions
                         ├─ ContainerBinding (sandbox | repo | none)
                         ├─ CreatedAt, UpdatedAt
                         ├─ GetEffectivePermissions()
                         └─ GetStorageExtension()
                                          │
                    ┌─────────────────────┴─────────────────┐
                    │                                       │
                    ▼                                       ▼
              Workspace                                Session
              ├─ WorkspaceType                        ├─ ParentWorkspaceId
              ├─ SessionIds, ProjectIds               ├─ ParentSessionId
              ├─ SessionTemplates                     ├─ Authority
              ├─ WorkspaceIsolation                   ├─ CommandHistory
              ├─ EntryPoints                          ├─ EventHistory
              └─ Storage: .workspace.json             ├─ BlockRegistry
                                                      └─ Storage: .session.json
                                                               │
                                                      ┌────────┴────────┐
                                                      │                 │
                                               ProjectSession    FoundrySession
                                               ├─ ProjectId      ├─ LoadedDraftId
                                               ├─ Binding: Repo  ├─ Binding: Sandbox
                                               ├─ FileChanges    ├─ TrainingStatus
                                               └─ CommitInfo     └─ Iterations
```

### Design Principles

1. **Single Responsibility**: Each class handles one level of abstraction
2. **DRY**: Common logic in base classes
3. **Open/Closed**: Easy to extend without modifying base
4. **Liskov Substitution**: Subtypes are substitutable
5. **Backwards Compatible**: Existing APIs continue to work

---

## Self-Describing Sessions

**Key Insight**: Sessions carry their own behavior as data in variables.

### The Cardinal Rule

> **Generic infrastructure, specific content.**

Infrastructure (C#, CLI, TUI) knows nothing about phases, fitness scores, or any particular workflow. All session-specific data lives in session variables.

### Core System Variables

Variables prefixed with `_` are system-managed:

| Variable | Purpose | Example |
|----------|---------|---------|
| `_phases` | Session-specific phase definitions | `[{id:"creation",name:"Creation",...}]` |
| `_workflowConfig` | LLM prompts, output paths, eval criteria | `{workflow-id: {llm:{systemPrompt:...}}}` |
| `_monitorDescriptor` | TUI layout and widget configuration | `{layout:{left:40,right:60},...}` |
| `_entryPoints` | Named workflow invocation mappings | `{start:"workflow:main-loop"}` |
| `_executionTree` | Current execution state for TUI | `{nodeId:"step1",status:"running",...}` |
| `_activeWorkflow` | Currently executing workflow ID | `"agent-improvement-loop"` |

### Template-Driven Configuration

Sessions are created from templates that define:
- Initial variable values
- Entry point mappings
- Monitor layout and widgets
- Permissions and access control

**Example**: Creating a session from template

```bash
# Template defines _phases, _workflowConfig, _monitorDescriptor
maestro session create --template foundry-default

# Backend loads template → initializes session variables
# All infrastructure reads from variables, never hardcoded
```

---

## Entry Points: Generic Mechanism

Entry points are a **generic mechanism** for invoking workflows by name.

### How It Works

1. Session template defines entry points: `{ "start": "workflow:my-main-workflow" }`
2. Backend stores entry points in session
3. User invokes: `POST /api/sessions/{id}/invoke/start`
4. Backend looks up workflow ID from entry point
5. `EntryPointExecutor` loads workflow and executes

### Template-Driven Execution

`EntryPointExecutor` is generic infrastructure:
- Reads `_workflowConfig` for LLM prompts, output paths, eval criteria
- Builds execution tree from workflow block's `config.nodes`
- Updates `_executionTree` and `_activeWorkflow` variables for TUI
- **No hardcoded content** - everything from session variables

```json
// _workflowConfig variable defines behavior per workflow
{
  "agent-improvement-loop": {
    "phaseId": "creation",
    "llm": {
      "systemPrompt": "You are a code generator...",
      "userPromptTemplate": "Generate based on: {{context}}"
    },
    "output": {
      "filename": "gen-commit-tool.json"
    },
    "evaluation": {
      "criteria": ["hasJsonStructure", "hasRequiredFields"]
    }
  }
}
```

**No fallback content**: If execution fails, errors propagate. No placeholder data.

---

## Container Binding Patterns

### Pattern 1: Workspace (No Direct Binding)

Workspaces define isolation config but don't bind to containers directly.

### Pattern 2: ProjectSession (Repository Binding)

Project sessions bind to a Git repository via Docker volume mount.

```csharp
var session = ProjectSession.Create(
    name: "Fix Bug #123",
    workspaceId: "ws-research",
    projectId: "proj-myapp",
    repositoryPath: "C:/projects/my-app",
    authority: Authority.Human
);
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
// Container: isolated, temporary, no volume mounts
```

---

## Permission Model

### Core Principle

> **Context defines permissions, not agent identity.**

Permissions are tied to contexts (workspaces and sessions), not to who is executing.

### Permission Inheritance Chain

```
Workspace.Permissions          (Maximum allowed - ceiling)
         │
         │  GetEffectivePermissions() = parent.Intersect(this)
         ▼
Session.Permissions            (Can only restrict from parent)
         │
         │  GetEffectivePermissions() = parent.Intersect(this)
         ▼
NestedSession.Permissions      (Most restrictive)
```

### ContextPermissions Structure

```typescript
interface ContextPermissions {
  allowedCommands: string[];    // ["run", "list-tools", "*"]
  allowedTools: string[];       // ["system:fitness-*", "*"]
  allowedBlocks: string[];      // ["training-loop", "*"]
  canCreateBlocks: boolean;
  canCreateSessions: boolean;
  dataCollections: string[];    // ["experiments", "*"]
  allowedPaths: string[];       // ["blocks/", "data/"]
}
```

### Session Templates Define Restrictions

```json
// workspace.json
{
  "sessionTemplates": {
    "training": {
      "type": "training",
      "permissions": {
        "allowedCommands": ["run", "data"],
        "allowedTools": ["system:fitness-calculator"],
        "canCreateBlocks": false
      }
    }
  }
}
```

---

## Authority Model

Who can drive sessions?

| Authority | Description | Typical Actions |
|-----------|-------------|-----------------|
| **Human** | User via UI or CLI | Create, evaluate, approve, publish |
| **Maestro Agent** | Internal autonomous agent | Execute, auto-evaluate |
| **External AI** | Claude Code, GPT, etc. | Full automation via CLI |

---

## Storage Patterns

### File Naming Convention

| Entity Type | Extension | Location |
|-------------|-----------|----------|
| Workspace | `.workspace.json` | `data/workspaces/{id}.workspace.json` |
| ProjectSession | `.session.json` | `{project}/.maestro/sessions/{id}.session.json` |
| FoundrySession | `.session.json` | `data/foundry/sessions/{id}.session.json` |

### Session Variable Storage

Session variables are persisted with the session:
- Stored in session JSON under `variables` key
- Loaded on session start
- Updated during execution
- Saved after each significant change

---

## Key Takeaways

1. **Two Types**: Foundry (development) vs Project (production)
2. **Container Hierarchy**: Clean inheritance from ContainerSession
3. **Self-Describing**: Sessions carry behavior as variables
4. **Template-Driven**: Configuration from JSON, not code
5. **Context-Based Permissions**: Not tied to identity
6. **Generic Infrastructure**: Code works with ANY session type
7. **Entry Points**: Generic mechanism for workflow invocation
8. **No Fallbacks**: Errors propagate, no silent failures

---

*See also: [execution.md](execution.md) for execution details, [blocks.md](blocks.md) for block architecture*
