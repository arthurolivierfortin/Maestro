# Getting Started with Maestro

This guide walks you through installing Maestro and running your first AI-assisted task.

## Prerequisites

- **Node.js 18+** — check with `node --version`
- **A git repository** — Maestro works on git repos
- **An LLM provider** — Azure OpenAI, Claude Code, Azure AI Inference, or a local model

## Step 1: Install

```bash
npm install -g @maestro/cli
```

Verify the installation:

```bash
maestro --help
```

## Step 2: Configure your LLM provider

```bash
maestro init
```

The interactive wizard will ask you to pick a provider and enter credentials:

```
  ╔══════════════════════════════════════╗
  ║       Welcome to Maestro!            ║
  ║   Let's configure your LLM provider  ║
  ╚══════════════════════════════════════╝

  Which LLM provider do you want to use?

    [1] Azure OpenAI
    [2] Azure AI Inference / GitHub Models
    [3] Claude Code (CLI)
    [4] Local (Python FastAPI)

  Enter choice (1-4):
```

After entering your credentials, Maestro tests the connection and saves the config to `~/.maestro/config.json`.

## Step 3: Launch Maestro

```bash
maestro code --repo /path/to/your/project
```

On first launch, Maestro automatically starts its backend services (you'll see "Starting Maestro services..." briefly). Then the TUI opens:

```
┌─ MAESTRO ─────────────── Agent  Home  Spaces  Foundry  Catalog  Models ─┐
│                                                                          │
│  ┌─ AGENT STATUS ──────────────────────────────────────────────────────┐ │
│  │  Idle — Ready for your task                                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─ CONVERSATION ──────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  Welcome! Describe your task below.                                │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Press / to type...                                                [Send]│
│                                                                          │
│  a:Agent  h:Home  s:Spaces  f:Foundry  c:Catalog  m:Models  ?:Help  q:Q │
└──────────────────────────────────────────────────────────────────────────┘
```

## Step 4: Run your first task

1. Press `/` to focus the input bar
2. Type a task description, for example:

   ```
   Add a README.md with project description, installation steps, and usage examples
   ```

3. Press `Enter` to send

4. The agent reads your codebase, then **confirms its plan before acting**:

   ```
   Agent: I'll create a README.md with:
   1. Project description based on package.json
   2. Installation steps (npm install)
   3. Usage examples from the existing code
   4. Contributing section

   Sound good?
   ```

5. Type `yes` (or `oui`) and press Enter to confirm

6. The agent executes: reads files, writes the README, commits the result. You see progress in the ACTIONS panel.

7. When done, the agent reports what it did:

   ```
   Agent: Done! Created README.md with 85 lines covering description,
   install, usage, and contributing. Committed as "Add project README".
   ```

## Understanding the TUI

### The Agent Page (default)

This is where you interact with the agent. It has three panels:

- **AGENT STATUS** — shows if the agent is idle, working, or completed
- **CONVERSATION** — the chat history between you and the agent
- **ACTIONS** — execution log showing what the agent is doing (reading files, running commands, writing code)

### Other Pages

Press the corresponding key to switch:

| Key | Page | What it shows |
|-----|------|---------------|
| `h` | Home | System overview — backend status, active sessions, quick actions |
| `a` | Agent | Chat + task execution (default page) |
| `s` | Spaces | All sessions and workspaces — browse, filter, open |
| `f` | Foundry | Your blocks — agents, workflows, tools |
| `c` | Catalog | Full block directory with fitness scores |
| `m` | Models | LLM provider status — available models, health |

### Navigation

- `/` — focus the input bar to type
- `Esc` — return to page navigation
- `j` / `k` — scroll the conversation
- `?` — toggle the help overlay with all shortcuts
- `q` — quit

## Step 5: Explore

### Try demo mode (no backend needed)

```bash
maestro code --demo
```

Explore the TUI with simulated data — useful for learning the interface.

### Initialize a project

```bash
maestro init /path/to/project
```

Creates a `.maestro/` directory in the project with conventions, aliases, and block storage.

### Use aliases for quick tasks

After `maestro init <path>`, you can use aliases:

```bash
maestro agent "Fix the failing tests"
maestro dev "Add error handling to the API routes"
```

### Check system health

```bash
maestro health
```

Shows backend and LLM provider status.

### Debug mode

If something isn't working:

```bash
MAESTRO_DEBUG=true maestro code
```

This shows detailed service logs in the TUI.

## Next Steps

- [Examples](examples.md) — 3 concrete task walkthroughs
- [Troubleshooting](troubleshooting.md) — common problems and solutions
- [CLI Reference](tools/cli/README.md) — full command documentation
