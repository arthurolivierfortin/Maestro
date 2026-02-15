# Maestro — Getting Started (5 Minutes)

This guide takes you from a fresh install to your first session result.

## Step 1: Start services (1 min)

```powershell
powershell -File dev-scripts/dev-start.ps1 -SkipLLM
```

Wait for "Backend ready on port 5000".

## Step 2: Verify health (30 sec)

```bash
cd maestro-cli
node index.js health
```

You should see `Backend: OK`.

## Step 3: Explore blocks (30 sec)

```bash
# List all available blocks
node index.js list-blocks

# See details of a specific block
node index.js show-block <block-id>
```

## Step 4: Create a session (1 min)

```bash
# Create a new interactive session
node index.js session create --name "My First Session" --repo C:\path\to\your\project

# List sessions to see it
node index.js session list
```

## Step 5: Import a template (30 sec)

Templates pre-configure sessions with workflows, phases, and monitor layouts.

```bash
# See available templates
node index.js templates

# Import a template into your session
node index.js session import-template <session-id> foundry-default
```

## Step 6: Start and run (1 min)

```bash
# Start the session
node index.js session start <session-id>

# Invoke a workflow entry point
node index.js session invoke <session-id> start

# Monitor progress in the TUI
node index.js monitor <session-id>
```

## Step 7: Check results (30 sec)

```bash
# View session details and variables
node index.js session show <session-id>

# Check execution tree
node index.js session get-var <session-id> _executionTree
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Block** | Universal unit — tool, agent, workflow, or any component |
| **Session** | Runtime environment that holds state, variables, and execution context |
| **Template** | Pre-built session config (phases, workflows, monitor layout) |
| **Entry Point** | Named command that triggers a workflow in a session |
| **Workspace** | Container for organizing sessions and projects |

## Next Steps

- Read the [CLI Command Reference](../tools/cli/COMMAND-REFERENCE.md) for all available commands
- Explore [Architecture Overview](../system/README.md) for deep understanding
- Check [Troubleshooting](./TROUBLESHOOTING.md) if something goes wrong
