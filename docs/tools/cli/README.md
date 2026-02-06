# Maestro CLI

**Location**: `C:\Meastro\tools\maestro-cli\index.js`

---

## Overview

The Maestro CLI is the primary interface for interacting with Maestro. It follows the **CLI-First principle**: humans and agents use the same interface.

---

## CLI-First Principle

```
┌─────────────────────────────────────┐
│  HUMAN                             │
│  $ maestro session start sess-001  │
└─────────────────┬───────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │   MAESTRO CLI  │  ← Same interface
         └────────┬───────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  AGENT                              │
│  maestro_cli("session start ...")   │
└─────────────────────────────────────┘
```

Agents have ONE tool: `maestro-cli`. Through it, they access everything their context allows.

---

## CLI as a Block

The CLI is itself a block: `system:maestro-cli` (see [DESIGN-MAESTRO-CLI-BLOCK.md](../../system/architecture/DESIGN-MAESTRO-CLI-BLOCK.md)).

This aligns with Maestro's philosophy: **"Everything is a block"**.

---

## Command Categories

### Health & Status

```bash
maestro health              # Check system status
maestro llm                 # Check LLM provider status
```

### Blocks

```bash
maestro blocks              # List all blocks
maestro workflows           # List workflow blocks
maestro info <block-id>     # Block details
maestro search <query>      # Search blocks
maestro children <block-id> # List child blocks
```

### Sessions

```bash
maestro session create      # Create new session
maestro session start <id>  # Start session
maestro session stop <id>   # Stop session
maestro session invoke <id> <entry-point>  # Invoke entry point
maestro session vars <id> get <key>        # Get variable
maestro session vars <id> set <key> <val>  # Set variable
maestro session import --template <name>   # Import template
maestro session list        # List all sessions
```

### Monitor

```bash
maestro monitor <session-id>               # Open TUI monitor
maestro monitor <session-id> --layout workflow
maestro monitor --sessions <id1>,<id2> --split horizontal
```

### Projects

```bash
maestro project list        # List projects
maestro project create      # Create new project
maestro project open <id>   # Open project
```

### Training & Tools

```bash
maestro tools               # List all tools
maestro tools --category <category>
maestro run <block-id> --input key=value
maestro data read/write/list  # Manage workspace data
```

---

## Usage for Agents

Agents execute CLI commands via the `maestro_cli` tool:

```python
# Agent discovers available tools
maestro_cli({ command: "list-tools" })

# Agent gets block details
maestro_cli({ command: "describe fitness-calculator" })

# Agent executes a block
maestro_cli({ command: "run fitness-calculator --input modelId=xyz" })
```

---

## Permission System

All CLI commands are permission-checked against the current context (workspace/session). An agent in a restricted training session cannot create blocks or access unauthorized tools.

---

*"One interface for all. CLI-First."*
