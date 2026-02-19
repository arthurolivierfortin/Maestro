# Maestro CLI

**Location**: `C:\Meastro\maestro-cli\index.js`

---

## Overview

The Maestro CLI is the primary interface for interacting with Maestro. It follows the **CLI-First principle**: humans and agents use the same interface.

---

## Quick Start

```bash
cd C:\Meastro\maestro-cli

# 1. Initialize a project
node index.js init /path/to/your/project

# 2. Run a task interactively
node index.js code

# Or headless (CI, pipes, automation)
node index.js code --headless --task "Add a login page"
```

---

## Command Reference

### Initialization (Phase 32)

```bash
maestro init [path]              # Initialize .maestro/ in a project
```

Detects project stack (Node, C#, Python, Java, Rust), creates `.maestro/config.json` with conventions, and sets up `aliases.json` for quick commands.

### Interactive Mode (Phase 33)

```bash
maestro code                     # TUI mode — Ink-based interactive REPL
maestro code --headless --task "description"  # Headless mode — structured text output
maestro code --template <name>   # Use a specific session template (default: project-autonomous)
maestro code --entry <name>      # Use a specific entry point (default: dev)
maestro code --repo <path>       # Specify repo path (default: cwd)
```

**TUI mode** renders an Ink app with:
- `OutputPanel` — scrollable log with timestamps
- `StatusBar` — session ID and running/ready status
- `InputPrompt` — text input for task descriptions

**Headless mode** outputs structured text to stdout:
```
[HH:MM:SS] [INFO ] Task: Add login page
[HH:MM:SS] [INFO ] Creating session...
[HH:MM:SS] [NODE ] ▶ Plan (running)
[HH:MM:SS] [NODE ] ✓ Plan (completed)
[HH:MM:SS] [DONE ] Task completed successfully
```

Works in CI, pipes, and non-TTY environments (including Claude Code).

**Session lifecycle** (both modes):
1. `POST /api/sessions` — create session
2. `importSessionTemplate()` — set variables, entry points, widgets
3. `POST /api/sessions/{id}/start`
4. `POST /api/sessions/{id}/invoke/dev` — inputs: `{repoPath, task}`
5. Poll `GET /api/sessions/{id}` every 2s for `_executionTree` and `_executionLog`

### Aliases (Phase 32)

```bash
maestro agent "Add login page"   # Alias → runs project-autonomous workflow
maestro aliases                  # List configured aliases
```

Aliases are defined in `.maestro/aliases.json` (created by `maestro init`). Each alias maps a command name to a template + entry point.

### Health & Status

```bash
maestro health              # Check system status (backend + LLM)
maestro llm                 # Check LLM provider status and models
```

### Blocks

```bash
maestro blocks              # List all blocks
maestro workflows           # List workflow blocks
maestro info <block-id>     # Block details
maestro search <query>      # Search blocks
maestro children <block-id> # List child blocks
maestro run <block-id> --input key=value  # Execute a block directly
```

### Sessions (Advanced)

`maestro code` handles session management automatically. These commands are for advanced/manual usage:

```bash
maestro session create --type project --name "..." --repo "..." --template project-autonomous --start
maestro session start <id>
maestro session stop <id>
maestro session invoke <id> <entry-point> --input task="..." repoPath="..."
maestro session vars <id> get <key>
maestro session vars <id> set <key> <value>
maestro session import --template <name>
maestro session list
```

### Monitor

```bash
maestro monitor <session-id>                # Open TUI monitor for a session
maestro monitor <session-id> --layout workflow
```

The monitor polls `GET /api/sessions/{id}` every 2s and renders phases, execution tree, logs, and LLM activity.

### Workspaces & Projects

```bash
maestro workspace list
maestro workspace create --name "..." --repo "..."
maestro workspace add-session <workspace-id> <session-id>
maestro project list
maestro project create
```

---

## CLI-First Principle

```
┌─────────────────────────────────────┐
│  HUMAN                             │
│  $ maestro code --task "..."       │
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
│  maestro_cli("code --headless ...")  │
└─────────────────────────────────────┘
```

Agents have ONE tool: `maestro-cli`. Through it, they access everything their context allows.

The CLI is itself a block: `system:maestro-cli` (see [DESIGN-MAESTRO-CLI-BLOCK.md](../../system/architecture/DESIGN-MAESTRO-CLI-BLOCK.md)).

---

## Testing

CLI interactive components are tested with **vitest** + **ink-testing-library**:

```bash
cd C:\Meastro\maestro-cli
npx vitest run tests/interactive/    # 29 tests (25 App + 4 headless)
```

Test files:
- `tests/interactive/App.test.ts` — OutputPanel, StatusBar, InputPrompt, InteractiveApp, SessionManager
- `tests/interactive/headless.test.ts` — headless mode lifecycle, error handling, output format

Key testing patterns:
- `render(h(Component, props))` → `{lastFrame, stdin}` — renders without TTY
- `await delay()` before `stdin.write()` — React effects run async
- `typeText(stdin, 'text')` — sends characters one by one (Ink's `useInput` expects individual keypresses)
- `stripAnsi(lastFrame())` — removes ANSI codes for text assertions

---

*"One interface for all. CLI-First."*
