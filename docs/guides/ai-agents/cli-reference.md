# Guide: Complete CLI Reference

## For Autonomous Agents (Claude Code, GPT, etc.)

---

## 1. Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MAESTRO_API_URL` | Backend URL | http://localhost:5000 |
| `MAESTRO_API_TIMEOUT` | Timeout in ms | 30000 |
| `MAESTRO_DEBUG` | Debug mode | false |
| `LLM_PROVIDER_URL` | LLM provider URL | http://localhost:8000 |

### Global Options

| Option | Description |
|--------|-------------|
| `--api-url <url>`, `-u` | Override backend URL |
| `--mock` | Offline mode (simulated execution) |
| `--help`, `-h` | Help |
| `--force` | Force deletions |

---

## 2. System Commands

### Health Check

```bash
# Check the system
maestro health
```
**Output:** status, version, uptime, block count, services

### LLM Status

```bash
# Check the LLM provider
maestro llm
```
**Output:** health, available models, status

---

## 3. Block Commands

### List Blocks

```bash
# All blocks
maestro blocks

# Only workflows
maestro workflows

# Search
maestro search <query>
```

### Block Details

```bash
maestro info <block-id>
```
**Output:** name, type, version, description, capabilities, inputs, outputs

---

## 4. Tool Commands

### List

```bash
# All tools
maestro tools

# By category
maestro tools --category filesystem
maestro tools --category git
maestro tools --category llm
```

### Create

```bash
maestro tools create \
  --name "My Tool" \
  --block <workflow-block-id> \
  --description "Description" \
  --version "1.0.0" \
  --category "general" \
  --tags "tag1,tag2" \
  --author "claude-code"
```

### Details

```bash
maestro tools info <tool-id>
```

### Metrics

```bash
maestro tools metrics <tool-id>
```
**Output:** success rate, avg execution time, avg tokens, overall score

### Delete

```bash
maestro tools delete <tool-id> --force
```

---

## 5. Agent Commands

### List

```bash
# All agents
maestro agents

# By category
maestro agents --category development
```

### Create

```bash
maestro agents create \
  --name "My Agent" \
  --block <workflow-block-id> \
  --description "Description" \
  --version "1.0.0" \
  --category "development" \
  --capabilities "code-generation,file-manipulation" \
  --tools "file-read,file-write,shell-execute" \
  --agents "sub-agent-1,sub-agent-2" \
  --tags "agent,autonomous" \
  --author "claude-code"
```

### Details

```bash
maestro agents info <agent-id>
```

### Metrics

```bash
maestro agents metrics <agent-id>
```
**Output:** completion rate, avg steps, tools used, overall score

### Delete

```bash
maestro agents delete <agent-id> --force
```

---

## 6. Execution Commands

### Execute a Workflow

```bash
maestro execute <workflow-id> \
  --input task="My task" \
  --input projectPath="C:/sandbox" \
  --working-dir "C:/sandbox"
```

### Execute a Block Directly

```bash
maestro run <block-id> \
  --input key1=value1 \
  --input key2=value2 \
  --working-dir "C:/sandbox"
```

### Mock Mode (Offline)

```bash
maestro execute <workflow-id> --mock
```

### Validate a Workflow

```bash
maestro validate <workflow-id>
```
**Output:** valid (bool), node count

---

## 7. Training Commands

### List Configurations

```bash
maestro training
```

### Create Configuration

```bash
maestro training create \
  --name "My Training" \
  --workflow <workflow-id> \
  --iterations 50 \
  --parallel 3 \
  --delay 1000 \
  --goal quality \
  --description "Description" \
  --tags "optimization,test"
```

**Goal options:** `quality`, `cost`, `speed`

### Configuration Details

```bash
maestro training info <config-id>
```

### List Runs

```bash
# All runs
maestro training runs

# Filter
maestro training runs --config <config-id>
maestro training runs --workflow <workflow-id>
maestro training runs --status running
maestro training runs --status completed
maestro training runs --status failed
```

### Run Details

```bash
maestro training run <run-id>
```
**Output:** status, iterations, metrics, errors

### Start Run

```bash
maestro training start <config-id> \
  --name "Run 2026-01-30" \
  --inputs '{"task": "...", "path": "..."}'
```

### Control Run

```bash
# Pause
maestro training pause <run-id>

# Resume
maestro training resume <run-id>

# Cancel
maestro training cancel <run-id>
```

---

## 8. Testing Commands

### Create Test Run

```bash
maestro test start <block-id> \
  --iterations 5 \
  --variant "v1" \
  --variant-desc "Initial version" \
  --evaluator manual \
  --evaluator-model "deepseek" \
  --tags "test,baseline"
```

**Evaluator options:** `manual`, `llm`, `heuristic`

### List Test Runs

```bash
# All
maestro test runs

# Filter
maestro test runs --block <block-id>
maestro test runs --type agent
maestro test runs --status awaiting_evaluation
maestro test runs --status completed
```

### Test Run Details

```bash
maestro test runs <run-id>
```

### View Pending

```bash
maestro test pending <run-id>
```

### Evaluate

```bash
# Interactive mode
maestro test evaluate <run-id>
```

### Compare

```bash
maestro test compare <run-id-1>,<run-id-2>,<run-id-3>
```

### Suggest Improvements

```bash
maestro test improve <run-id> \
  --suggestions "Improve prompt,Add validation"
```

---

## 9. Metrics Commands

### List Metrics

```bash
maestro metrics \
  --workflow <workflow-id> \
  --from 2026-01-01 \
  --to 2026-01-30 \
  --limit 100
```

### Summary

```bash
maestro metrics summary \
  --from 2026-01-01 \
  --to 2026-01-30 \
  --group-by workflow
```

---

## 10. Runs Commands (History)

### List Executions

```bash
maestro runs \
  --workflow <workflow-id> \
  --block <block-id> \
  --status completed \
  --from 2026-01-01 \
  --to 2026-01-30 \
  --limit 50
```

### Execution Details

```bash
maestro runs info <run-id>
```

---

## 11. Foundry Commands

### Overview

```bash
maestro foundry
```

### Leaderboard

```bash
maestro foundry leaderboard --limit 20
```

### Promote a Block

```bash
maestro foundry promote \
  --block <block-id> \
  --name "My Agent" \
  --type agent \
  --description "Description" \
  --category "development" \
  --tags "agent,promoted" \
  --tools "tool1,tool2"
```

---

## 12. Project Commands

### List

```bash
maestro projects
```

### Create

```bash
maestro projects create \
  --name "My Project" \
  --path "C:/my-project" \
  --description "Description" \
  --runtime docker \
  --image "node:20" \
  --work-dir "/app" \
  --model "deepseek" \
  --block-paths "blocks/custom"
```

**Runtime options:** `none`, `docker`, `process`

### Bind (Existing Project)

```bash
maestro projects bind \
  --path "C:/my-project" \
  --name "My Project" \
  --runtime process
```

### Open

```bash
maestro projects open "C:/my-project"
```

### Details

```bash
maestro projects info <project-id>
```

### Project Blocks

```bash
maestro projects blocks <project-id>
```

### Discover

```bash
maestro projects discover "C:/projects"
```

### Delete

```bash
maestro projects delete <project-id> --force
```

---

## 13. Container Commands

### Status

```bash
maestro projects status <project-id>
```

### Start

```bash
maestro projects start <project-id>
```

### Stop

```bash
maestro projects stop <project-id>
```

### Restart

```bash
maestro projects restart <project-id>
```

### Logs

```bash
maestro projects logs <project-id> \
  --lines 100 \
  --since "2026-01-30T00:00:00"
```

---

## 14. Quick Reference Card

```bash
# === SYSTEM ===
maestro health                    # Check backend
maestro llm                       # Check LLM

# === BLOCKS ===
maestro blocks                    # List blocks
maestro workflows                 # List workflows
maestro info <id>                 # Block details

# === TOOLS ===
maestro tools                     # List tools
maestro tools create [opts]       # Create tool
maestro tools metrics <id>        # Tool metrics

# === AGENTS ===
maestro agents                    # List agents
maestro agents create [opts]      # Create agent
maestro agents metrics <id>       # Agent metrics

# === EXECUTION ===
maestro execute <id> [--input]    # Execute workflow
maestro run <id> [--input]        # Execute block
maestro validate <id>             # Validate workflow

# === TRAINING ===
maestro training                  # List configs
maestro training create [opts]    # Create config
maestro training start <cfg>      # Start run
maestro training run <run>        # Run status
maestro training pause <run>      # Pause
maestro training resume <run>     # Resume
maestro training cancel <run>     # Cancel

# === TESTING ===
maestro test start <id> [opts]    # Create test
maestro test runs                 # List tests
maestro test pending <run>        # Pending evals
maestro test evaluate <run>       # Evaluate
maestro test compare <ids>        # Compare

# === METRICS ===
maestro metrics                   # List metrics
maestro metrics summary           # Summary
maestro foundry leaderboard       # Top performers

# === PROJECTS ===
maestro projects                  # List projects
maestro projects create [opts]    # Create project
maestro projects start <id>       # Start container
maestro projects stop <id>        # Stop container
```

---

## Related Documents

- `GUIDE-AI-MENTALITY.md` - Philosophy and mentality
- `GUIDE-AI-TRAINING-SESSIONS.md` - Training sessions
- `GUIDE-AI-TESTING-EVALUATION.md` - Testing and evaluation
- `GUIDE-AI-CREATING-BLOCKS.md` - Creating blocks
