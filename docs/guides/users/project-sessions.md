# Project Session - Detailed Guide

## Overview

A **Project Session** is an **interactive server environment** attached to a real Git repository. The **Authority** (human, AI, or agent) manages the project through shell commands and Maestro commands, can launch sub-agents with restricted permissions, and monitors all activity.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Architecture** | Session Server with API + Event Stream |
| **Environment** | Real Git repository (isolated access) |
| **Authority** | Human, AI (Claude Code), or Agent |
| **Clients** | Monitor (Terminal), CLI, SDK/API |
| **Sub-agents** | Launched with restricted permissions |
| **Persistence** | Git commits, session logs |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PROJECT SESSION SERVER                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                         SESSION STATE                               ││
│  │                                                                     ││
│  │  ID: sess-abc123                   Status: running                  ││
│  │  Project: my-app                   Authority: human                 ││
│  │  Created: 2026-01-30 10:00:00      Uptime: 00:15:23                ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   BLOCK REGISTRY     │  │    PERMISSIONS       │                    │
│  │                      │  │                      │                    │
│  │ • code-developer     │  │ Paths:               │                    │
│  │ • code-reviewer      │  │  ✓ src/**            │                    │
│  │ • file-read          │  │  ✓ tests/**          │                    │
│  │ • file-write         │  │  ✗ .env              │                    │
│  │ • git-diff           │  │  ✗ secrets/**        │                    │
│  │ • git-commit         │  │                      │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    RUNNING EXECUTIONS                             │  │
│  │                                                                   │  │
│  │  exec-001: code-reviewer (running) - "Review auth module"         │  │
│  │  exec-002: test-runner (completed) - "Run unit tests"            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    EVENT STREAM (WebSocket)                       │  │
│  │                                                                   │  │
│  │  [10:15:20] CMD     ls src/                                       │  │
│  │  [10:15:21] OUTPUT  components/ utils/ index.ts                   │  │
│  │  [10:15:25] CMD     agents run code-reviewer --task "..."         │  │
│  │  [10:15:25] EVENT   Agent code-reviewer started                   │  │
│  │  [10:15:28] AGENT   Reading src/auth/login.ts                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                          API Layer
                    (REST + WebSocket)
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
     ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
     │  TERMINAL   │     │    CLI      │     │   AI/SDK    │
     │  (Monitor)  │     │  Maestro    │     │ Claude Code │
     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Getting Started

### 1. Create a Project Session

```bash
# Human authority (interactive)
maestro session create \
  --project my-app \
  --authority human

# AI authority (Claude Code, Cursor, etc.)
maestro session create \
  --project my-app \
  --authority ai:claude-code

# Agent authority (autonomous)
maestro session create \
  --project my-app \
  --authority agent:orchestrator-agent
```

#### Creation Options

| Option | Description | Example |
|--------|-------------|---------|
| `--project <id>` | Project ID or name | `my-app` |
| `--authority <type>` | Who controls | `human`, `ai:claude-code`, `agent:my-agent` |
| `--access <level>` | Access level | `readonly`, `sandbox`, `controlled`, `full` |
| `--allowed-paths` | Allowed paths | `"src/**,tests/**"` |
| `--denied-paths` | Denied paths | `".env,secrets/**"` |
| `--blocks` | Initial blocks to load | `"code-developer,file-read"` |
| `--name` | Session name | `"Feature development"` |

### 2. Connect to the Session

```bash
# Interactive terminal (authority)
maestro session connect sess-abc123

# Monitor only (read-only view)
maestro session monitor sess-abc123

# Execute single command
maestro session exec sess-abc123 "blocks list"
```

### 3. Work Within the Session

Once connected, you have access to shell commands and Maestro commands:

```bash
# Shell commands
session> ls src/
components/  utils/  index.ts

session> cat src/index.ts
// ... file content ...

session> git status
On branch main
nothing to commit

# Maestro commands
session> blocks list
Available blocks:
  • code-developer (agent)
  • code-reviewer (agent)
  • file-read (tool)
  • file-write (tool)

session> agents run code-developer --task "Add input validation"
Agent code-developer started (exec-001)

session> monitor
[Watching execution exec-001...]
```

---

## Commands Reference

### Shell Commands

Standard Linux-like commands for navigating and inspecting the project:

```bash
# Navigation
ls [path]              # List directory contents
cd <path>              # Change directory
pwd                    # Print working directory

# File inspection
cat <file>             # Show file content
head [-n N] <file>     # Show first N lines
tail [-n N] <file>     # Show last N lines
less <file>            # Paginated view

# Search
find <pattern>         # Find files
grep <pattern> [path]  # Search in files

# Git (read operations always allowed)
git status             # Repository status
git diff [file]        # Show changes
git log [--oneline]    # Commit history
git branch             # List branches

# Project commands (if allowed by permissions)
npm/yarn/pnpm ...      # Node.js
dotnet ...             # .NET
python ...             # Python
cargo ...              # Rust
```

### Maestro Commands

#### Block Management

```bash
# List available blocks in session
blocks list
blocks list --type agent
blocks list --type tool

# Show block details
blocks info <block-id>

# Add block from catalog to session
blocks add <catalog-id>
blocks add code-developer@1.2.0

# Remove block from session
blocks remove <block-id>

# Search catalog
blocks search "code review"
```

#### Agent Management

```bash
# List available agents
agents list

# Run an agent
agents run <agent-id> --task "Task description"
agents run <agent-id> --task "..." --context "Additional context"

# With permission restrictions for the agent
agents run <agent-id> --task "..." \
  --allowed-paths "src/auth/**" \
  --allowed-blocks "file-read,file-write"

# Control running agents
agents status <exec-id>        # Check status
agents pause <exec-id>         # Pause execution
agents resume <exec-id>        # Resume execution
agents stop <exec-id>          # Stop execution

# List running executions
agents running
```

#### Monitoring

```bash
# Watch all session activity
monitor

# Watch specific execution
monitor --exec <exec-id>

# View event history
events
events --limit 50
events --filter agent
events --filter command
events --since "10 minutes ago"

# Real-time logs for an execution
logs <exec-id>
logs <exec-id> --follow
```

#### Permissions

```bash
# Show current session permissions
permissions show

# Show permissions for a specific agent
permissions show --agent <agent-id>

# Set permissions for sub-agents
permissions set \
  --agent code-developer \
  --paths "src/**,tests/**" \
  --blocks "file-read,file-write,git-diff"

# Restrict all sub-agents
permissions set \
  --all-agents \
  --deny-paths ".env,secrets/**,*.key"
```

#### Validation & Commit

```bash
# Show all changes
diff
diff --stat

# Show specific file diff
diff <file>

# Run tests
test
test --command "npm test -- --coverage"
test --verbose

# Run linter
lint
lint --command "npm run lint"

# Commit changes
commit --message "feat: add validation"
commit --message "fix: bug" --push
commit --message "feat: feature" --branch feature/my-feature --push
```

#### Session Control

```bash
# Pause the session
pause

# Resume the session
resume

# Take control from AI/agent authority
take-control

# Exit the session
exit
exit --keep          # Keep session running
exit --stop          # Stop session
```

---

## Authority Types

### Human Authority

The human interacts directly via the terminal:

```bash
# Create session
maestro session create --project my-app --authority human

# Connect
maestro session connect sess-abc123

# Work interactively
session> ls
session> agents run code-developer --task "Add feature"
session> monitor
session> diff
session> commit --message "feat: new feature"
session> exit
```

### AI Authority (Claude Code, Cursor, etc.)

An external AI system controls the session via API:

```bash
# Create session
maestro session create --project my-app --authority ai:claude-code
# Returns: sess-abc123

# AI executes commands via API
POST /api/sessions/sess-abc123/exec
Content-Type: application/json

{ "command": "blocks list" }
```

```bash
# Human can monitor what the AI is doing
maestro session monitor sess-abc123

# Human can take control if needed
maestro session take-control sess-abc123
```

### Agent Authority

A Maestro agent autonomously controls the session:

```bash
# Create session with agent authority
maestro session create \
  --project my-app \
  --authority agent:orchestrator-agent \
  --task "Implement user authentication feature"

# The agent receives the session and works autonomously
# Human can monitor
maestro session monitor sess-abc123

# Human can intervene
maestro session take-control sess-abc123
```

---

## Access Levels

### ReadOnly

```bash
maestro session create --project my-app --authority human --access readonly
```

| Permission | Allowed |
|------------|---------|
| Read files | Yes |
| Write files | No |
| Shell commands | Read-only (ls, cat, git status) |
| Run agents | Yes (read-only agents only) |
| Commit | No |

**Use case**: Code review, analysis, documentation

### Sandbox

```bash
maestro session create --project my-app --authority human --access sandbox
```

| Permission | Allowed |
|------------|---------|
| Read files | Yes (original) |
| Write files | Yes (temporary copy) |
| Shell commands | Yes (in sandbox) |
| Run agents | Yes (in sandbox) |
| Commit | No (changes discarded) |

**Use case**: Experimentation, testing dangerous operations

### Controlled (Recommended)

```bash
maestro session create --project my-app --authority human --access controlled \
  --allowed-paths "src/**,tests/**" \
  --denied-paths ".env,secrets/**"
```

| Permission | Allowed |
|------------|---------|
| Read files | Yes |
| Write files | Yes (within allowed paths) |
| Shell commands | Yes (with restrictions) |
| Run agents | Yes (with restrictions) |
| Commit | Yes (after validation) |

**Use case**: Normal development with safety guardrails

### Full

```bash
maestro session create --project my-app --authority human --access full
```

| Permission | Allowed |
|------------|---------|
| Read files | Yes |
| Write files | Yes (no restrictions) |
| Shell commands | Yes |
| Run agents | Yes |
| Commit | Yes (direct) |

**Use case**: Trusted automation, CI/CD (use with caution!)

---

## Sub-Agent Permissions

When the authority launches an agent, it can restrict what the agent can do:

```bash
# Launch agent with full session permissions
session> agents run code-developer --task "Add validation"

# Launch agent with restricted permissions
session> agents run code-developer \
  --task "Fix auth bug" \
  --allowed-paths "src/auth/**,tests/auth/**" \
  --allowed-blocks "file-read,file-write" \
  --deny-commands "rm,git push"
```

### Permission Inheritance

```
Session Permissions (set at creation)
         │
         │  Agent inherits session permissions
         │  BUT can be further restricted
         ▼
Agent Permissions (set at launch)
         │
         │  Cannot exceed session permissions
         │  Can only be equal or more restrictive
         ▼
Agent Execution
```

---

## Workflow Examples

### Interactive Development

```bash
# 1. Create session
maestro session create --project my-app --authority human --access controlled

# 2. Connect
maestro session connect sess-abc123

# 3. Explore the codebase
session> ls
session> cat src/index.ts
session> git log --oneline -5

# 4. Add blocks needed for the task
session> blocks add code-developer
session> blocks add test-generator

# 5. Run an agent
session> agents run code-developer --task "Add email validation to signup form"
Agent started: exec-001

# 6. Monitor the agent
session> monitor --exec exec-001
[10:15:28] Reading src/components/SignupForm.tsx
[10:15:30] Analyzing validation requirements
[10:15:35] Creating src/utils/validation.ts
[10:15:40] Modifying SignupForm.tsx
[10:15:45] Creating tests/validation.test.ts
[10:15:48] Execution completed

# 7. Review changes
session> diff --stat
 src/utils/validation.ts     | 25 +++++++
 src/components/SignupForm.tsx | 8 ++-
 tests/validation.test.ts     | 40 +++++++++++
 3 files changed, 71 insertions(+), 2 deletions(-)

session> diff src/utils/validation.ts

# 8. Run tests
session> test
✓ All tests passed (15/15)

# 9. Commit
session> commit --message "feat(auth): add email validation to signup form" --push

# 10. Exit
session> exit
```

### AI-Controlled Session

```bash
# Human creates session for AI
maestro session create \
  --project my-app \
  --authority ai:claude-code \
  --access controlled \
  --allowed-paths "src/**,tests/**"

# Session ID: sess-xyz789

# Human monitors in another terminal
maestro session monitor sess-xyz789
```

The AI (Claude Code) then controls via API:

```http
POST /api/sessions/sess-xyz789/exec
Content-Type: application/json

{"command": "blocks list"}
---
{"command": "agents run code-developer --task \"Implement feature X\""}
---
{"command": "monitor --exec exec-001"}
---
{"command": "diff"}
---
{"command": "test"}
---
{"command": "commit --message \"feat: implement feature X\""}
```

### Automated Pipeline

```bash
#!/bin/bash
# automated-task.sh

PROJECT="my-app"
TASK="$1"
AGENT="code-developer"

# 1. Create session with agent authority
SESSION=$(maestro session create \
  --project $PROJECT \
  --authority agent:$AGENT \
  --access controlled \
  --json | jq -r '.id')

echo "Session: $SESSION"

# 2. Start monitoring in background
maestro session monitor $SESSION &
MONITOR_PID=$!

# 3. Wait for completion
maestro session wait $SESSION --timeout 600

# 4. Check result
STATUS=$(maestro session info $SESSION --json | jq -r '.status')

if [ "$STATUS" = "completed" ]; then
  echo "Task completed successfully"
else
  echo "Task failed: $STATUS"
fi

# 5. Cleanup
kill $MONITOR_PID 2>/dev/null
```

---

## API Reference

### REST Endpoints

```
# Session management
POST   /api/sessions                    Create session
GET    /api/sessions                    List sessions
GET    /api/sessions/{id}               Get session info
DELETE /api/sessions/{id}               Delete session

# Session control
POST   /api/sessions/{id}/start         Start session
POST   /api/sessions/{id}/pause         Pause session
POST   /api/sessions/{id}/resume        Resume session
POST   /api/sessions/{id}/stop          Stop session
POST   /api/sessions/{id}/take-control  Take control

# Command execution
POST   /api/sessions/{id}/exec          Execute command
GET    /api/sessions/{id}/events        Get events (with pagination)

# WebSocket
WS     /api/sessions/{id}/stream        Real-time event stream
```

### WebSocket Events

```typescript
interface SessionEvent {
  type: 'command' | 'output' | 'agent' | 'error' | 'status';
  timestamp: string;
  data: {
    command?: string;
    output?: string;
    agentId?: string;
    execId?: string;
    message?: string;
    status?: string;
  };
}
```

---

## Best Practices

### 1. Always Use Controlled Access

```bash
# Recommended
--access controlled --allowed-paths "src/**,tests/**"

# Avoid unless necessary
--access full
```

### 2. Restrict Sub-Agent Permissions

```bash
# Give agents only what they need
agents run code-developer \
  --task "Fix auth bug" \
  --allowed-paths "src/auth/**" \
  --allowed-blocks "file-read,file-write"
```

### 3. Monitor AI/Agent Sessions

```bash
# Always monitor autonomous sessions
maestro session monitor sess-abc123
```

### 4. Review Before Commit

```bash
session> diff
session> test
# Review the output...
session> commit --message "..."
```

### 5. Use Branches for Safety

```bash
session> commit --message "feat: new feature" --branch feature/my-feature --push
# Then create PR for review
```

---

## Troubleshooting

### Cannot Connect to Session

```bash
# Check session status
maestro session info sess-abc123

# If stopped, cannot connect
# Create a new session
```

### Permission Denied

```bash
# Check session permissions
session> permissions show

# Check if path is allowed
session> permissions check src/secret/file.ts
# Path denied by rule: deny secrets/**
```

### Agent Stuck

```bash
# Check agent status
session> agents status exec-001

# Pause and inspect
session> agents pause exec-001
session> events --filter exec-001

# Resume or stop
session> agents resume exec-001
# or
session> agents stop exec-001
```

### Take Control from AI

```bash
# If AI is misbehaving
maestro session take-control sess-abc123

# You now have authority
session> agents stop-all
session> diff
session> # ... fix things ...
```

---

## Quick Reference

```bash
# ===== SESSION LIFECYCLE =====
maestro session create --project <id> --authority <type> [options]
maestro session connect <id>          # Interactive mode
maestro session monitor <id>          # Watch only
maestro session exec <id> "command"   # Single command
maestro session take-control <id>     # Take over
maestro session stop <id>             # End session

# ===== WITHIN SESSION =====
# Shell
ls, cd, cat, grep, git status, git diff, ...

# Blocks
blocks list | add <id> | remove <id> | info <id>

# Agents
agents list | run <id> --task "..." | status <id> | stop <id>

# Monitoring
monitor | events | logs <exec-id>

# Permissions
permissions show | set --agent <id> --paths "..." --blocks "..."

# Validation
diff | test | lint

# Commit
commit --message "..." [--branch <name>] [--push]

# Control
pause | resume | exit
```

---

## Related Documents

- [GUIDE-SESSION-TYPES.md](GUIDE-SESSION-TYPES.md) - Session architecture overview
- [FOUNDRY-DETAILED-GUIDE.md](FOUNDRY-DETAILED-GUIDE.md) - Foundry sessions for block development
- [FULL-PIPELINE-GUIDE.md](FULL-PIPELINE-GUIDE.md) - Complete end-to-end workflow
