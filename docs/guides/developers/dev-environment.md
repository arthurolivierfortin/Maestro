# Development Environment

> **This document is extracted from CLAUDE.md.** It covers service startup, ports, and CLI usage.

---

## Starting Services

**IMPORTANT: Always use the startup script to manage services. Never start services manually.**

Use the PowerShell script at `dev-scripts/dev-start.ps1`:

```powershell
# Start all services (LLM-Provider, Backend, Frontend) - local mode
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1

# Start with specific options
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -BackendOnly    # Backend + LLM only
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -SkipLLM        # No LLM-Provider
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -Mode docker    # Use Docker
```

## Stopping Services

```powershell
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -Stop
```

## Service Ports

| Service      | Port | Health Check URL                    |
|--------------|------|-------------------------------------|
| LLM-Provider | 5010 | http://localhost:5010/api/v1/health/ |
| Backend      | 5000 | http://localhost:5000/              |
| Frontend     | 5173 | http://localhost:5173/              |

---

## CLI Commands

The Maestro CLI is at `packages/maestro-cli/index.js`:

```bash
cd C:\Meastro\packages\maestro-cli

# Quick start (Phase 32-33)
node index.js init                                    # Initialize .maestro/ in current project
node index.js code                                    # Interactive TUI mode (Ink)
node index.js code --headless --task "description"    # Headless mode (CI, pipes, Claude Code)

# Aliases (defined in .maestro/aliases.json)
node index.js agent "Add login page"                  # Alias -> project-autonomous workflow

# Status
node index.js health              # Check services health
node index.js list-blocks         # List all blocks
node index.js llm                 # Check LLM status

# Block execution
node index.js execute <block-id>  # Execute a block
node index.js run <block-id> --input key=value

# Sessions (advanced -- maestro code handles this automatically)
node index.js session create --type project --name "..." --repo "..." --template project-autonomous --start
node index.js session invoke <id> dev --input task="..." repoPath="..."
node index.js monitor <id>        # TUI monitor for a session
```

---

## Windows/PowerShell Gotchas

- Bash tool runs under WSL — use `powershell.exe -Command` for Windows commands
- Dollar signs consumed by bash — write scripts to files instead
- `Start-Process` for background processes, `taskkill /F /IM` to kill locked processes
- Unix commands like `mkdir -p` don't work on Windows cmd — use PowerShell: `powershell -Command "New-Item -ItemType Directory -Force -Path path1, path2"`
