# Maestro — Getting Started in 5 Minutes

## What is Maestro?

Maestro is an AI orchestration platform built on the concept of **blocks** — reusable units of AI capability that can be composed into workflows, agents, and training pipelines.

## Step 1: Check Services

```bash
cd maestro-cli
node index.js health
```

If you see `Status: healthy`, you're ready.

## Step 2: Explore Blocks

Blocks are the building blocks of Maestro. List them:

```bash
node index.js blocks
```

Filter by type:

```bash
node index.js agents          # Agent blocks
node index.js tools           # Tool blocks
node index.js workflows       # Workflow blocks
```

Get details on a specific block:

```bash
node index.js block info <block-id>
```

## Step 3: Create a Session

Sessions are where work happens. Create one:

```bash
# List available templates
node index.js templates

# Create a session from a template
node index.js session create --project <project-id> --template foundry-default --name "My First Session" --start
```

## Step 4: Monitor

Launch the TUI monitor to watch your session:

```bash
node index.js monitor <session-id>
```

Or list all sessions:

```bash
node index.js monitor
```

## Step 5: Interact

Invoke an entry point to start a workflow:

```bash
node index.js session invoke <session-id> start
```

Check session variables:

```bash
node index.js session vars <session-id>
```

## Key Concepts

### Blocks
Everything is a block. Workflows, agents, tools, prompts — they all share the same interface and metrics.

### Sessions
Sessions carry their own behavior through variables and templates. A session defines its phases, prompts, and monitor layout.

### Entry Points
Entry points map command names to workflow block IDs. `invoke start` runs the workflow mapped to the `start` entry point.

### Templates
Templates are JSON files that define session types. They carry all session-specific configuration — phases, prompts, evaluation criteria.

## CLI Reference

```bash
node index.js --help           # Full command list
node index.js session --help   # Session commands
node index.js projects --help  # Project commands
node index.js auth status      # Security status
```

## Initialize a Repository

Set up Maestro in your project:

```bash
node index.js init /path/to/your/repo
```

This creates `.maestro/` with blocks, docs, logs, artifacts, and metrics directories.

## Next Steps

- Read the [Installation Guide](INSTALLATION.md) for detailed setup
- Explore `docs/system/philosophy/` for Maestro's design philosophy
- Check `content/system/templates/sessions/` for available session templates
