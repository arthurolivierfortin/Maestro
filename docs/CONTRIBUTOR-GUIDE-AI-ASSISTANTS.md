# Guide for AI Assistants - Main Index

## Welcome to Maestro

This document is the entry point for autonomous agents (Claude Code, GPT, etc.) working on the Maestro project.

---

## Specific Guides

### Fundamental Guides

| Guide | When to Use |
|-------|-------------|
| [GUIDE-AI-MENTALITY.md](guides/GUIDE-AI-MENTALITY.md) | **Read first** - Philosophy and golden rules |
| [GUIDE-SESSION-TYPES.md](guides/GUIDE-SESSION-TYPES.md) | Understand Foundry vs Project Sessions |
| [FOUNDRY-WORKFLOW.md](FOUNDRY-WORKFLOW.md) | Complete Foundry workflow |

### Operational Guides

| Guide | When to Use |
|-------|-------------|
| [GUIDE-AI-CREATING-BLOCKS.md](guides/GUIDE-AI-CREATING-BLOCKS.md) | Create tools, agents, workflows |
| [GUIDE-AI-CLI-REFERENCE.md](guides/GUIDE-AI-CLI-REFERENCE.md) | CLI quick reference |

### Technical Documentation

| Document | Content |
|----------|---------|
| [SESSION-SYSTEM-UNDERSTANDING.md](SESSION-SYSTEM-UNDERSTANDING.md) | Unified system vision |
| [SESSION-SYSTEM-ARCHITECTURE-PROPOSAL.md](SESSION-SYSTEM-ARCHITECTURE-PROPOSAL.md) | Detailed technical architecture |
| [issues/phase-10-unified-session-system.md](issues/phase-10-unified-session-system.md) | Implementation plan |

---

## Executive Summary

### What is Maestro?

Maestro is an **AI workflow optimization platform** where:
- Every execution collects metrics
- Every evaluation guides improvement
- The cycle: **Execute → Evaluate → Improve → Iterate**

### Block Hierarchy

```
COMPOSITE (can contain children)
├── workflow   → Root container
├── agent      → Orchestrates tools
├── tool       → Reusable capability (contains command, inference, etc.)
└── task       → Validated step

ATOMIC (leaves, no children)
├── prompt, instruction, command, decision
├── validator, trigger, inference, script
```

### Fundamental Rule

> **Tools use shell commands, NOT backend code.**

```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem '{{path}}'"]
  }
}
```

---

## Quick Start

### 1. Check the System

```bash
cd C:\Meastro\tools\maestro-cli
node index.js health
node index.js llm
```

### 2. List Resources

```bash
node index.js blocks      # All blocks
node index.js workflows   # Workflows
node index.js agents      # Agents
node index.js tools       # Tools
```

### 3. Execute a Workflow

```bash
node index.js execute <workflow-id> --input task="My task"
```

### 4. Foundry Session (Forge a Block)

```bash
# Create a draft
node index.js foundry draft create --name "my-tool" --type tool

# Create a session with auto-evaluation
node index.js foundry session create \
  --draft my-tool \
  --iterations 20 \
  --eval-mode auto \
  --eval-model deepseek \
  --eval-threshold 0.8

# Start (fully automatic!)
node index.js foundry session start <session-id> --wait

# View metrics
node index.js foundry session metrics <session-id>

# Publish when satisfied
node index.js foundry publish my-tool --version 1.0.0
```

### 5. Project Session (Real Execution)

```bash
# Create a session on a project
node index.js project session create \
  --project my-app \
  --workflow code-developer \
  --task "Add validation"

# Execute
node index.js project session start <session-id> --wait

# View changes
node index.js project session diff <session-id>

# Commit
node index.js project session commit <session-id> --message "feat: add validation"
```

---

## Architecture

### Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | .NET 10 + C# |
| CLI | Node.js |
| Containers | Docker (optional) |

### Project Structure

```
C:\Meastro\
├── backend/                 # .NET API
├── frontend/                # React UI
├── tools/                   # CLI
│   ├── maestro-cli/         # CLI commands
│   └── shared/              # Shared API client
├── data/                    # Persisted data
│   ├── training/            # Training sessions
│   ├── testing/             # Block tests
│   └── sessions/            # Unified sessions (future)
├── blocks/                  # Block definitions
│   ├── global/              # Built-in blocks
│   └── user/                # User blocks
└── docs/                    # Documentation
    └── guides/              # AI guides
```

---

## Typical Agent Workflow

### Scenario: Optimize an Agent

```bash
# 1. Check the system
maestro health && maestro llm

# 2. Baseline - current metrics
maestro agents metrics <agent-id> > before.txt

# 3. Create a training configuration
maestro training create --name "Optimize V1" --workflow <agent-id> --iterations 20

# 4. Execute the training
maestro training start <config-id>

# 5. Wait and follow
maestro training run <run-id>

# 6. Evaluate the results
maestro test start <agent-id> --iterations 5
maestro test evaluate <test-run-id>

# 7. Compare with baseline
maestro agents metrics <agent-id> > after.txt
diff before.txt after.txt

# 8. If improvement is insufficient, modify and restart
```

---

## What to Remember

### DO

- Always check `maestro health` before starting
- Use the CLI for every action
- Measure before and after each modification
- Test in a sandbox before production
- Document modifications

### DON'T

- Write custom Python/JS code to execute workflows
- Implement tools in the C# backend
- Ignore metrics
- Modify a real project without testing first
- Use `.Result` in async code (deadlock)

---

## Start the Services

```powershell
# Start everything
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# Stop everything
powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -Stop
```

### Ports

| Service | Port | URL |
|---------|------|-----|
| LLM Provider | 8000 | http://localhost:8000/health |
| Backend | 5000 | http://localhost:5000/ |
| Frontend | 5173 | http://localhost:5173/ |

---

## Related Documents

### AI Guides (Priority)

1. [Mentality](guides/GUIDE-AI-MENTALITY.md) - **Read first**
2. [Training](guides/GUIDE-AI-TRAINING-SESSIONS.md)
3. [Testing](guides/GUIDE-AI-TESTING-EVALUATION.md)
4. [Creating Blocks](guides/GUIDE-AI-CREATING-BLOCKS.md)
5. [CLI Reference](guides/GUIDE-AI-CLI-REFERENCE.md)

### Technical Documentation

- [CLAUDE.md](../CLAUDE.md) - Development rules
- [SESSION-SYSTEM-UNDERSTANDING.md](SESSION-SYSTEM-UNDERSTANDING.md) - Unified system vision
- [SESSION-SYSTEM-ARCHITECTURE-PROPOSAL.md](SESSION-SYSTEM-ARCHITECTURE-PROPOSAL.md) - Proposed architecture

### Issues/Phases

- [phase-10-unified-session-system.md](issues/phase-10-unified-session-system.md) - Session implementation plan
