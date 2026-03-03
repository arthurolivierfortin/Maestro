# Maestro

AI agent orchestrator for software development. Maestro creates sessions, launches specialized agents, and monitors their progress — so you describe what you want, and agents do the work.

Maestro is not a code editor or a chatbot. It's an **orchestration layer** that manages AI agents working on your codebase: planning tasks, writing code, running tests, committing results.

## Quick Start

```bash
# Install globally
npm install -g @maestro/cli

# Configure your LLM provider (interactive wizard)
maestro init

# Launch the TUI on your project
maestro code --repo /path/to/your/project
```

On first launch, Maestro starts its backend services automatically. Type a task in the input bar and the agent will confirm its plan before executing.

## What Can You Do?

- **Add features** — "Add a login page with email/password authentication"
- **Fix bugs** — "Fix the TypeScript compilation errors in src/api/"
- **Generate docs** — "Create API documentation for all endpoints"
- **Write tests** — "Add unit tests for the UserService class"
- **Refactor code** — "Convert the callback-based API to async/await"
- **Set up tooling** — "Add ESLint and Prettier with the Airbnb config"

The agent confirms its plan before executing. You stay in control.

## Commands

| Command | Description |
|---------|-------------|
| `maestro code` | Launch the interactive TUI (main entry point) |
| `maestro code --repo <path>` | Launch on a specific project |
| `maestro code --demo` | Launch in demo mode (no backend needed) |
| `maestro init` | Configure LLM provider (onboarding wizard) |
| `maestro init <path>` | Initialize a project directory for Maestro |
| `maestro health` | Check backend and LLM provider status |
| `maestro session list` | List all sessions |
| `maestro workspace list` | List all workspaces |
| `maestro monitor <session-id>` | Launch the session monitor TUI |
| `maestro aliases` | List available task aliases |

## TUI Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `/` | Focus the input bar |
| `Esc` | Return to navigation |
| `?` | Toggle help overlay |
| `q` | Quit |
| `Ctrl+C` | Cancel task or quit |

### Page Navigation

| Key | Page |
|-----|------|
| `h` | Home — system overview |
| `a` | Agent — chat + task execution (default) |
| `s` | Spaces — sessions and workspaces |
| `f` | Foundry — your blocks |
| `c` | Catalog — block directory with fitness scores |
| `m` | Models — LLM provider status |

### Agent Page

| Key | Action |
|-----|--------|
| `j` / `k` | Scroll conversation |
| `g` | Go to session monitor |

## Slash Commands

Type these in the input bar:

| Command | Action |
|---------|--------|
| `/help` | Show available commands |
| `/status` | Show session info (ID, template, backend) |
| `/new` | Start a new conversation |
| `/clear` | Clear conversation history |
| `/stop` | Cancel the current task |
| `/purge` | Delete idle sessions |
| `/quit` | Quit Maestro |

## Supported LLM Providers

Configure via `maestro init`:

- **Azure OpenAI** — Azure-hosted OpenAI models
- **Azure AI Inference / GitHub Models** — Azure AI or GitHub Models endpoint
- **Claude Code** — Uses the Claude CLI on your machine
- **Local** — Python FastAPI server for local GPU inference

## Troubleshooting

**"Services failed to start"**
- Check that no other process is using ports 5000/5010
- Run `MAESTRO_DEBUG=true maestro code` for detailed logs

**"Agent doesn't respond"**
- Verify your LLM provider config: `maestro init` to reconfigure
- Check provider health: `maestro health`

**"Permission denied" errors**
- Ensure the target repo path exists and is writable
- On Windows, run your terminal as administrator if needed

**Reset configuration**
- Delete `~/.maestro/config.json` and run `maestro init` again

**Debug mode**
```bash
MAESTRO_DEBUG=true maestro code
```

## Requirements

- Node.js >= 18
- A git repository to work on
- An LLM provider (Azure OpenAI, Claude Code, or local)

## Documentation

- [Getting Started Guide](../../docs/getting-started.md)
- [Examples](../../docs/examples.md)
- [Troubleshooting](../../docs/troubleshooting.md)
- [CLI Reference](../../docs/tools/cli/README.md)

## License

Proprietary
