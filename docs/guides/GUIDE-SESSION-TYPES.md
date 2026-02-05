# Guide: Maestro Session Types

## Overview

A **Session** in Maestro is an **interactive server environment** where an **Authority** (human, AI, or agent) manages and orchestrates work. Sessions provide isolation, monitoring, and command execution capabilities.

| Type | Objective | Environment | Authority Use Case |
|------|-----------|-------------|-------------------|
| **Foundry Session** | Develop, test, improve blocks | Isolated sandbox | Block development and training |
| **Project Session** | Manage and execute on real project | Project repository | Real task automation and orchestration |

---

## Core Architecture: Session as Server

Both session types share the same **Session Server** architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SESSION SERVER                                  │
│                   (Foundry Session OR Project Session)                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         SESSION STATE                               │ │
│  │                                                                     │ │
│  │  • Authority: Who controls (human, agent, AI)                       │ │
│  │  • Block Registry: Available blocks in this session                 │ │
│  │  • Permissions: What's allowed (paths, commands, blocks)           │ │
│  │  • Executions: Running agents/workflows                            │ │
│  │  • Event History: Full audit log                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Command Queue  │  │  Event Stream   │  │  File System Access     │ │
│  │  (REST API)     │  │  (WebSocket)    │  │  (Isolated/Controlled)  │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────┘ │
│           │                    │                                        │
└───────────┼────────────────────┼────────────────────────────────────────┘
            │                    │
            │    API Layer       │
            │  (REST + WebSocket)│
            │                    │
┌───────────┴────────────────────┴────────────────────────────────────────┐
│                              CLIENTS                                      │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   MONITOR    │    │     CLI      │    │      AGENT / IA          │  │
│  │  (Terminal)  │    │   Maestro    │    │   (Claude Code, etc)     │  │
│  │              │    │              │    │                          │  │
│  │ • View events│    │ • Send cmds  │    │ • Send commands via API  │  │
│  │ • Read-only  │    │ • Connect to │    │ • Subscribe to events    │  │
│  │   or interact│    │   session    │    │ • Autonomous operation   │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

#### 1. Authority
The entity that controls and makes decisions within the session.

| Authority Type | Description | Example |
|---------------|-------------|---------|
| `human` | Interactive human control | Developer using CLI |
| `agent` | Maestro agent as controller | `orchestrator-agent` managing sub-agents |
| `ai` | External AI system | Claude Code, Cursor, etc. |

#### 2. Block Registry
Each session has its own registry of available blocks:
- **Inherited**: Blocks from the global catalog
- **Added**: Blocks explicitly added by the authority
- **Restricted**: Blocks allowed for sub-agents (subset of available)

#### 3. Permissions
Controls what can be done within the session:
- **Paths**: Allowed/denied file system paths
- **Commands**: Allowed shell commands
- **Blocks**: Which blocks agents can use
- **Network**: Network access rules

---

## Session Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ CREATED │────►│ RUNNING │────►│ PAUSED  │────►│ STOPPED │
└─────────┘     └────┬────┘     └────┬────┘     └─────────┘
                     │               │
                     │◄──────────────┘
                     │         (Resume)
                     ▼
               ┌──────────┐
               │COMPLETED │
               │ or ERROR │
               └──────────┘
```

### States

| State | Description |
|-------|-------------|
| `created` | Session configured but not started |
| `running` | Session active, accepting commands |
| `paused` | Temporarily suspended |
| `completed` | Finished successfully |
| `error` | Terminated with error |
| `stopped` | Manually stopped |

---

## 1. Project Session

### Purpose

A **Project Session** is an interactive environment for managing a real project. The authority can:
- Navigate the project file system
- Run shell commands (within permissions)
- List and manage available blocks
- Launch agent executions
- Monitor running agents
- Configure permissions for sub-agents

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PROJECT SESSION SERVER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Context: Real Git repository                                            │
│  Authority: Human / AI / Agent                                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AUTHORITY CAPABILITIES                         │   │
│  │                                                                   │   │
│  │  Shell Commands:          Maestro Commands:                       │   │
│  │  • ls, cd, cat, etc.      • blocks list                          │   │
│  │  • git status, diff       • agents list                          │   │
│  │  • npm, dotnet, etc.      • agent run <id>                       │   │
│  │  (within permissions)     • agent stop <id>                       │   │
│  │                           • monitor                               │   │
│  │                           • blocks add <catalog-id>               │   │
│  │                           • permissions set ...                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SUB-AGENT EXECUTION                            │   │
│  │                                                                   │   │
│  │  Agent launched by authority:                                     │   │
│  │  • Receives ONLY blocks configured by authority                   │   │
│  │  • Restricted to paths set by authority                          │   │
│  │  • Cannot modify its own permissions                              │   │
│  │  • Actions visible in session event stream                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    VALIDATION & COMMIT                            │   │
│  │                                                                   │   │
│  │  • View changes: diff                                             │   │
│  │  • Run tests: test [--command]                                    │   │
│  │  • Run linter: lint [--command]                                   │   │
│  │  • Commit: commit --message "..." [--push]                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Commands Available in Project Session

#### Shell Commands (Standard Linux-like)
```bash
# Navigation and file operations
ls [path]
cd <path>
pwd
cat <file>
head/tail <file>
find <pattern>
grep <pattern> [path]

# Git operations
git status
git diff
git log
git branch

# Project-specific (if allowed)
npm/yarn/pnpm ...
dotnet ...
python ...
```

#### Maestro Commands
```bash
# Block management
blocks list                    # List available blocks in session
blocks info <id>               # Show block details
blocks add <catalog-id>        # Add block from catalog to session
blocks remove <id>             # Remove block from session

# Agent management
agents list                    # List available agents
agents run <id> [--task "..."] # Launch an agent
agents stop <id>               # Stop a running agent
agents status <id>             # Check agent status

# Monitoring
monitor                        # Watch all activity in real-time
monitor --agent <id>           # Watch specific agent
events                         # List recent events
events --filter <type>         # Filter events

# Permissions (for sub-agents)
permissions show               # Show current permissions
permissions set --paths "..."  # Set allowed paths
permissions set --blocks "..." # Set allowed blocks

# Validation
diff                           # Show all changes
diff <file>                    # Show specific file diff
test [--command "..."]         # Run tests
lint [--command "..."]         # Run linter

# Commit
commit --message "..."         # Commit changes
commit --message "..." --push  # Commit and push

# Session control
pause                          # Pause session
resume                         # Resume session
exit                           # End session
```

### Access Levels

| Level | Authority Can | Sub-Agents Can |
|-------|--------------|----------------|
| `readonly` | Read all, no writes | Read only |
| `sandbox` | Read all, write to temp | Write to temp only |
| `controlled` | Read/write with review | Write with restrictions |
| `full` | Full access | As configured |

---

## 2. Foundry Session

### Purpose

A **Foundry Session** is an isolated sandbox for developing and training blocks. The authority can:
- Test block executions
- Run training iterations
- Evaluate outputs
- Apply improvements
- Publish to catalog

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FOUNDRY SESSION SERVER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Context: Isolated sandbox (no real project)                             │
│  Authority: Human / AI / Agent                                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    DRAFT MANAGEMENT                               │   │
│  │                                                                   │   │
│  │  • draft load <id>           Load a draft to work on              │   │
│  │  • draft edit                Edit draft definition                 │   │
│  │  • draft test                Quick test execution                  │   │
│  │  • draft save                Save current changes                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    TRAINING                                       │   │
│  │                                                                   │   │
│  │  • train start --iterations 50 --parallel 3                       │   │
│  │  • train status              View training progress               │   │
│  │  • train pause / resume      Control training                     │   │
│  │  • train stop                Stop training                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EVALUATION                                     │   │
│  │                                                                   │   │
│  │  • eval pending              List iterations awaiting eval        │   │
│  │  • eval show <iter-id>       Show iteration details               │   │
│  │  • eval submit <iter-id> --score 0.85 --feedback "..."            │   │
│  │  • eval auto --model deepseek-coder  Run auto-evaluation         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    IMPROVEMENTS                                   │   │
│  │                                                                   │   │
│  │  • improve suggest           Get improvement suggestions          │   │
│  │  • improve apply <id>        Apply a suggestion                   │   │
│  │  • improve apply-all         Apply all suggestions                │   │
│  │  • metrics                   View current metrics                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PUBLICATION                                    │   │
│  │                                                                   │   │
│  │  • publish --version "1.0.0" Publish to catalog                   │   │
│  │  • publish --dry-run         Preview publication                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Commands Available in Foundry Session

```bash
# Draft management
draft load <id>                # Load draft into session
draft list                     # List available drafts
draft edit                     # Open draft for editing
draft test [--input "..."]     # Quick test execution
draft save                     # Save changes

# Training
train start [options]          # Start training run
train status                   # View progress
train pause                    # Pause training
train resume                   # Resume training
train stop                     # Stop training

# Evaluation
eval pending                   # List pending evaluations
eval show <iter-id>            # Show iteration details
eval submit <iter-id> [opts]   # Submit manual evaluation
eval auto [--model <id>]       # Run auto-evaluation

# Improvements
improve suggest                # Get AI suggestions
improve show                   # List suggestions
improve apply <id>             # Apply suggestion
improve apply-all              # Apply all suggestions

# Metrics
metrics                        # Show current metrics
metrics compare <session-id>   # Compare with another session

# Publication
publish [--version "..."]      # Publish to catalog
publish --dry-run              # Preview publication

# Session control
pause                          # Pause session
resume                         # Resume session
exit                           # End session
```

---

## 3. Client Types

### Monitor (Terminal)

A read-only (or interactive) terminal that displays session events in real-time.

```bash
# Connect as monitor (read-only)
maestro session monitor <session-id>

# Connect as interactive terminal
maestro session connect <session-id>
```

**Monitor Display:**
```
┌─ Session: sess-abc123 (Project: my-app) ─────────────────────────────┐
│ Authority: human | Status: running | Uptime: 00:05:23                │
├──────────────────────────────────────────────────────────────────────┤
│ [10:23:45] COMMAND  ls src/                                          │
│ [10:23:45] OUTPUT   components/  utils/  index.ts                    │
│ [10:23:52] COMMAND  agents run code-reviewer --task "Review auth"    │
│ [10:23:52] EVENT    Agent code-reviewer started (exec-xyz)           │
│ [10:23:55] AGENT    Reading file: src/auth/login.ts                  │
│ [10:24:01] AGENT    Analysis complete, 3 issues found                │
│ [10:24:01] EVENT    Agent code-reviewer completed                    │
│ [10:24:05] COMMAND  diff                                             │
│ [10:24:05] OUTPUT   No uncommitted changes                           │
└──────────────────────────────────────────────────────────────────────┘
```

### CLI (External)

The Maestro CLI connects to a session and sends commands.

```bash
# Execute a single command
maestro session exec <session-id> "blocks list"

# Interactive mode
maestro session connect <session-id>
session> blocks list
session> agents run code-developer --task "Add feature"
session> monitor
session> exit
```

### Agent/AI SDK

For programmatic access by AI systems or agents.

```typescript
// Connect to session
const session = await maestro.connectSession('sess-abc123');

// Subscribe to events
session.onEvent((event) => {
  console.log(`[${event.type}] ${event.message}`);
});

// Execute commands
const blocks = await session.execute('blocks list');
const result = await session.execute('agents run code-reviewer', {
  task: 'Review the authentication module'
});

// Monitor agent execution
session.onAgentEvent('code-reviewer', (event) => {
  console.log(`Agent: ${event.action}`);
});
```

---

## 4. Authority Hierarchy

```
┌──────────────────────────────────────────────────────────────────┐
│                         AUTHORITY                                  │
│                  (Human, AI, or Agent)                            │
│                                                                   │
│  Full access to session:                                          │
│  • All Maestro commands                                           │
│  • Shell commands (within session permissions)                    │
│  • Can configure sub-agent permissions                            │
│  • Can intervene in agent executions                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ Launches with restricted permissions
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SUB-AGENTS                                   │
│              (Launched by authority)                              │
│                                                                   │
│  Limited access:                                                  │
│  • Only blocks assigned by authority                              │
│  • Only paths allowed by authority                                │
│  • Cannot modify own permissions                                  │
│  • Cannot launch other agents (unless explicitly allowed)         │
│  • All actions logged to session event stream                     │
└──────────────────────────────────────────────────────────────────┘
```

### Example: Human Authority with Agent

```bash
# Human starts a project session
maestro session create --project my-app --authority human
maestro session connect sess-123

# Human configures what the code-developer agent can do
session> permissions set --agent code-developer \
           --paths "src/**,tests/**" \
           --blocks "file-read,file-write,git-diff"

# Human launches the agent with a task
session> agents run code-developer --task "Implement user validation"

# Human monitors the agent's work
session> monitor --agent code-developer

# Agent works autonomously within its constraints...
# Human can intervene at any time

session> agents pause code-developer   # Pause if needed
session> agents resume code-developer  # Resume

# When agent completes, human reviews
session> diff
session> test
session> commit --message "feat: add user validation"
```

### Example: AI Authority (Claude Code)

```bash
# Claude Code creates and controls a session
maestro session create --project my-app --authority ai:claude-code

# Claude Code executes commands via API
POST /api/sessions/sess-123/exec
{ "command": "blocks list" }

POST /api/sessions/sess-123/exec
{ "command": "agents run code-developer", "args": { "task": "Fix bug #123" } }

# Human can monitor what Claude Code is doing
maestro session monitor sess-123   # Read-only view

# Human can take control if needed
maestro session take-control sess-123
```

---

## 5. Comparison Table

| Aspect | Project Session | Foundry Session |
|--------|-----------------|-----------------|
| **Purpose** | Manage real project | Develop blocks |
| **Environment** | Git repository | Isolated sandbox |
| **File Access** | Real project files | Test/mock data |
| **Authority Actions** | Run agents, shell cmds | Train, evaluate, publish |
| **Sub-agents** | Execute on project | Execute in sandbox |
| **Persistence** | Git commits | Metrics, catalog |
| **Risk** | Controlled (permissions) | None (isolated) |

---

## 6. CLI Quick Reference

```bash
# ===== SESSION MANAGEMENT =====
maestro session create --project <id> --authority <type>   # Project session
maestro session create --foundry --authority <type>        # Foundry session
maestro session list [--status <status>]                   # List sessions
maestro session info <id>                                  # Session details

# ===== CONNECTION =====
maestro session connect <id>                               # Interactive mode
maestro session monitor <id>                               # Monitor only
maestro session exec <id> "<command>"                      # Single command

# ===== CONTROL =====
maestro session pause <id>                                 # Pause
maestro session resume <id>                                # Resume
maestro session stop <id>                                  # Stop
maestro session take-control <id>                          # Take over from AI

# ===== WITHIN SESSION =====
# (See detailed guides for Project and Foundry commands)
```

---

## Related Documents

- [PROJECT-SESSION-DETAILED-GUIDE.md](PROJECT-SESSION-DETAILED-GUIDE.md) - Complete Project Session guide
- [FOUNDRY-DETAILED-GUIDE.md](FOUNDRY-DETAILED-GUIDE.md) - Complete Foundry Session guide
- [FULL-PIPELINE-GUIDE.md](FULL-PIPELINE-GUIDE.md) - End-to-end workflow
