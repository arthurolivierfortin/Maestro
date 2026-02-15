# Maestro CLI — Command Reference

## Usage

```bash
maestro <command> [subcommand] [options]
maestro                         # Launch interactive shell
maestro <command> --json        # Structured JSON output
maestro <command> --help        # Command-specific help
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output in structured JSON format (for agents/scripting) |
| `--api-url <url>` | Override backend URL (default: `http://localhost:5000`) |
| `--help`, `-h` | Show help |
| `--verbose` | Verbose output (for health, logs) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MAESTRO_API_URL` | Backend URL |
| `MAESTRO_API_KEY` | API key for authentication |
| `MAESTRO_DEBUG` | Enable debug logging (`true`) |

---

## Status & Diagnostics

### `health`
Check backend and service status.

```bash
maestro health              # Quick status
maestro health --verbose    # Full diagnostics (LLM, auth, provider, config)
```

### `llm`
Show LLM provider status and active model.

```bash
maestro llm
```

### `logs [type]`
View logs.

```bash
maestro logs              # Default logs
maestro logs audit        # Audit logs
maestro logs --limit 50   # Limit results
```

---

## Session Management

### `session create`
Create a new interactive session.

```bash
maestro session create --project <id> --name "My Session"
maestro session create --repo C:\path\to\project --name "Direct Repo"
maestro session create --project <id> --template foundry-default --start
```

| Option | Description |
|--------|-------------|
| `--name <name>` | Session name |
| `--project <id>` | Project ID to bind |
| `--repo <path>` | Repository path (alternative to --project) |
| `--authority <type>` | `human` (default), `agent:<name>`, `system` |
| `--template <name>` | Auto-import template after creation |
| `--start` | Auto-start session after creation |
| `--access <level>` | `controlled` (default), `full`, `readonly` |

### `session list`
List sessions with optional filters.

```bash
maestro session list
maestro session list --status running
maestro session list --recent 5
```

### `session info <id>` / `session show <id>`
Show session details (variables, entry points, widgets).

```bash
maestro session info <id>
maestro session show abc123   # Short ID prefix supported
```

### `session last`
Show the most recent session.

### `session start <id>`
Start a session (transition to active).

### `session stop <id>`
Stop a running session.

### `session pause <id>` / `session resume <id>`
Pause or resume a session.

### `session invoke <id> <entry-point>`
Invoke an entry point workflow.

```bash
maestro session invoke <id> start
maestro session invoke <id> start --inputs '{"key":"value"}'
```

### `session import-template <id> <template>`
Import a session template (variables, entry points, widgets).

```bash
maestro session import-template <id> foundry-default
```

### `session bind-repo <id> <path>`
Bind a session to a repository.

### `session exec <id> <command>`
Execute a shell command within the session context.

### `session events <id>`
View session events.

```bash
maestro session events <id> --filter error --limit 20
```

### Session Variables

```bash
maestro session vars <id>                  # List all variables
maestro session get-var <id> <key>         # Get a variable
maestro session set-var <id> <key> <value> # Set a variable
maestro session remove-var <id> <key>      # Remove a variable
```

### `session delete <id>`
Delete a session (with cascade cleanup of workspace references).

```bash
maestro session delete <id>         # Interactive confirmation
maestro session delete <id> --force # Skip confirmation
```

---

## Block Management

### `block list` / `blocks` / `list-blocks`
List blocks with optional filters.

```bash
maestro blocks
maestro block list --designation tool
maestro block list --type Workflow --category inference
```

### `block info <id>` / `show-block <id>`
Show block details.

### `block create`
Create a new block.

```bash
maestro block create --name context-builder --type tool --description "Builds context"
maestro block create --name my-agent --type agent --designation agent --tags "code,review"
```

### `block update <id>`
Update block properties.

### `block delete <id>`
Delete a block (requires `--force`).

### `block content <id> <path>`
Read or write block file content.

```bash
maestro block content <id> scripts/run.ps1              # Read
maestro block content <id> scripts/run.ps1 --set "..."  # Write inline
maestro block content <id> scripts/run.ps1 --set-file ./local-file.ps1  # Write from file
```

### `block metrics <id>`
Show block metrics (runs, score, success rate).

### `block top`
Top blocks by score.

```bash
maestro block top --designation agent --limit 10
```

### `block designate <id> <designation>`
Set block designation (`tool`, `agent`).

### `block search <query>` / `search <query>`
Search blocks by name or description.

### `block children <id>`
Show block hierarchy.

```bash
maestro block children <id> --recursive
```

### Shortcuts

```bash
maestro agents      # = block list --designation agent
maestro tools       # = block list --designation tool
maestro workflows   # = block list --type Workflow
```

---

## Block Approval

```bash
maestro block publish <id>          # Submit for approval
maestro block approve <id>          # Approve
maestro block reject <id> --reason "..." # Reject
```

---

## Execution

### `run <block-id>`
Execute a block.

```bash
maestro run <block-id>
maestro run <block-id> --input key=value --input key2=value2
maestro run <block-id> --mock    # Mock mode (no real execution)
```

### `validate <id>`
Validate a workflow structure.

---

## Monitor

### `monitor [session-id]`
Launch the TUI monitor.

```bash
maestro monitor              # Monitor all sessions
maestro monitor <session-id> # Monitor specific session
maestro monitor <id> --legacy # Use legacy blessed TUI
```

---

## Project Management

### `projects`
List all projects.

### `projects info <id>`
Project details.

### `projects create`
Create a project.

```bash
maestro projects create --name "My Project" --path C:\code\project
```

### `projects delete <id>`
Delete a project (requires `--force`).

### `projects blocks <id>`
List blocks in a project.

---

## Workspace Management

### `workspace list`
List all workspaces.

### `workspace info <id>` / `workspace show <id>`
Workspace details.

### `workspace create`
Create a workspace.

```bash
maestro workspace create --name "Dev" --type development
```

### `workspace delete <id>`
Delete a workspace.

```bash
maestro workspace delete <id>          # Standard delete
maestro workspace delete <id> --force  # Cascade: stop and delete all sessions
```

### `workspace add-session <workspace-id> <session-id>`
Add a session to a workspace.

### `workspace remove-session <workspace-id> <session-id>`
Remove a session from a workspace.

---

## Templates

### `templates`
List available session templates.

```bash
maestro templates
```

---

## Configuration

### `config set <key> <value>`
Set a CLI config value.

```bash
maestro config set backendUrl http://localhost:5000
maestro config set apiKey my-secret-key
```

### `config azure`
Manage Azure OpenAI configuration.

```bash
maestro config azure show                          # Show current config
maestro config azure set --endpoint <url> --api-key <key> --deployment <name>
maestro config azure test                          # Test connection
maestro config azure clear                         # Remove Azure config
```

### `config keybindings`
Manage TUI keybindings.

```bash
maestro config keybindings          # Show current
maestro config keybindings set      # Edit
maestro config keybindings reset    # Reset to defaults
```

---

## Custom Models

### `models custom list`
List custom models from `~/.maestro/models.json`.

### `models add <id>`
Add a custom model.

```bash
maestro models add my-model --name "My Model" --provider openai --api-key <key>
```

### `models remove <id>`
Remove a custom model.

---

## Authentication

### `auth status`
Show authentication status.

### `auth setup`
Create initial admin API key.

### `auth create-key`
Create a new API key.

```bash
maestro auth create-key --name "agent-key" --scope session
```

### `auth list-keys`
List all API keys.

### `auth revoke <id>`
Revoke an API key.

---

## Training & Fitness

### `training`
Training configuration and run management.

### `fitness`
Fitness metrics and leaderboard.

### `experiment`
Training experiments.

### `research`
Research team cycles.

---

## System

### `init [path]`
Initialize `.maestro/` directory structure in a repository.

### `schema`
Output the full command schema as JSON.

### `system`
System block overrides.

### `metrics`
Execution metrics.

### `runs`
Execution history.

---

## ID Shortcuts

All commands that accept resource IDs support prefix matching:

```bash
# Instead of full UUID:
maestro session info f2e8a1b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b

# Use a short prefix (8+ chars recommended):
maestro session info f2e8a1b3
# Or even shorter if unambiguous:
maestro session info f2e8
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | User error (bad input, validation failure) |
| 2 | Resource not found |
| 3 | Server error (backend down, 500) |
| 4 | Timeout |
