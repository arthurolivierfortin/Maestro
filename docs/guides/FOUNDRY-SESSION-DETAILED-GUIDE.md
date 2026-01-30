# Foundry Session - Detailed Guide

## Overview

A **Foundry Session** is an **interactive server environment** for developing, training, and publishing blocks (tools, agents, workflows). The **Authority** (human, AI, or agent) works in an isolated sandbox to forge and validate blocks before publishing to the catalog.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Architecture** | Session Server with API + Event Stream |
| **Environment** | Isolated sandbox (no real project) |
| **Authority** | Human, AI (Claude Code), or Agent |
| **Purpose** | Develop, train, evaluate, publish blocks |
| **Risk** | None (complete isolation) |
| **Persistence** | Metrics, training data, catalog |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FOUNDRY SESSION SERVER                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                         SESSION STATE                               ││
│  │                                                                     ││
│  │  ID: sess-foundry-123           Status: running                     ││
│  │  Draft: code-extractor          Authority: human                    ││
│  │  Version: 0.2.0                 Training: active (25/50 iter)       ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   DRAFT WORKSPACE    │  │  TRAINING STATE      │                    │
│  │                      │  │                      │                    │
│  │ • Definition         │  │ • Iterations: 25/50  │                    │
│  │ • Inputs/Outputs     │  │ • Passed: 22         │                    │
│  │ • Config             │  │ • Failed: 3          │                    │
│  │ • Test data          │  │ • Avg Score: 0.82    │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   EVALUATION         │  │  IMPROVEMENTS        │                    │
│  │                      │  │                      │                    │
│  │ • Mode: hybrid       │  │ • 3 suggestions      │                    │
│  │ • Pending: 5         │  │ • 1 applied          │                    │
│  │ • Model: deepseek    │  │ • +8% estimated      │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    EVENT STREAM (WebSocket)                       │  │
│  │                                                                   │  │
│  │  [10:15:20] CMD      train start --iterations 50                  │  │
│  │  [10:15:21] TRAIN    Starting training run...                     │  │
│  │  [10:15:25] ITER     Iteration 1/50 started                       │  │
│  │  [10:15:28] ITER     Iteration 1/50 completed (score: 0.85)       │  │
│  │  [10:15:30] ITER     Iteration 2/50 started                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                              API Layer
                        (REST + WebSocket)
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
         ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
         │  TERMINAL   │     │    CLI      │     │   AI/SDK    │
         │  (Monitor)  │     │  Maestro    │     │ Claude Code │
         └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Getting Started

### 1. Create a Foundry Session

```bash
# Interactive session for block development
maestro session create --foundry --authority human

# AI-controlled session
maestro session create --foundry --authority ai:claude-code

# Session with specific draft
maestro session create --foundry --authority human --draft code-extractor
```

#### Creation Options

| Option | Description | Example |
|--------|-------------|---------|
| `--foundry` | Create a foundry session | Required |
| `--authority <type>` | Who controls | `human`, `ai:claude-code`, `agent:trainer` |
| `--draft <id>` | Load specific draft | `code-extractor` |
| `--name` | Session name | `"Training v2"` |

### 2. Connect to the Session

```bash
# Interactive terminal
maestro session connect sess-foundry-123

# Monitor only
maestro session monitor sess-foundry-123

# Execute single command
maestro session exec sess-foundry-123 "draft list"
```

### 3. Work Within the Session

```bash
# Load a draft to work on
session> draft load code-extractor

# Test it quickly
session> draft test --input text="function hello() { return 'world'; }"

# Start training
session> train start --iterations 50 --parallel 3

# Monitor progress
session> train status
Training: 25/50 iterations
  Passed: 22 | Failed: 3
  Avg Score: 0.82

# View and submit evaluations
session> eval pending
session> eval submit iter-015 --score 0.9 --feedback "Good extraction"

# Apply improvements
session> improve suggest
session> improve apply 1

# Publish when ready
session> publish --version "1.0.0"
```

---

## Commands Reference

### Draft Management

```bash
# List available drafts
draft list
draft list --status forging
draft list --type tool

# Create a new draft
draft create --name "my-tool" --type tool
draft create --name "my-agent" --type agent --from-file definition.json
draft create --name "v2" --type tool --from-block existing-tool

# Load draft into session
draft load <draft-id>
draft load code-extractor

# Show current draft
draft show
draft show --json

# Edit the draft
draft edit                    # Opens editor
draft edit --field config     # Edit specific field
draft edit --file new-def.json

# Quick test
draft test
draft test --input key="value"
draft test --input-file test-cases.json

# Save changes
draft save
draft save --message "Updated prompt"

# Delete a draft
draft delete <draft-id>
draft delete <draft-id> --force
```

### Training

```bash
# Start training
train start
train start --iterations 50
train start --iterations 100 --parallel 5
train start --iterations 50 --eval-mode auto --eval-model deepseek-coder

# Training options
train start \
  --iterations 50 \
  --parallel 3 \
  --delay-ms 500 \
  --timeout-ms 30000 \
  --eval-mode hybrid \
  --eval-model deepseek-coder \
  --eval-threshold 0.8 \
  --human-review-below 0.6 \
  --input text="test input"

# Control training
train status              # View progress
train pause               # Pause training
train resume              # Resume training
train stop                # Stop training

# View training results
train results
train results --json
train results --export results.json
```

### Evaluation

```bash
# View pending evaluations
eval pending
eval pending --limit 10

# Show iteration details
eval show <iter-id>
eval show iter-025

# Submit evaluation
eval submit <iter-id> --score 0.85
eval submit <iter-id> \
  --score 0.85 \
  --correctness 0.9 \
  --quality 0.8 \
  --efficiency 0.85 \
  --feedback "Good but could be cleaner"

# Bulk evaluation
eval submit-bulk --file evaluations.json

# Run auto-evaluation on pending
eval auto
eval auto --model deepseek-coder
eval auto --limit 10

# Evaluation modes
eval mode                     # Show current mode
eval mode auto                # Switch to auto
eval mode hybrid              # Switch to hybrid
eval mode manual              # Switch to manual
```

### Metrics

```bash
# Show current metrics
metrics
metrics --json

# Detailed breakdown
metrics --detailed
metrics --by-criteria

# Compare with another session
metrics compare <session-id>
metrics compare --baseline

# Export metrics
metrics export metrics.json
```

### Improvements

```bash
# Get improvement suggestions
improve suggest
improve suggest --detailed

# Show suggestions
improve show
improve show 1              # Show specific suggestion

# Apply improvements
improve apply 1             # Apply suggestion #1
improve apply-all           # Apply all suggestions
improve apply 1 2 3         # Apply multiple

# Preview improvement
improve preview 1           # See what would change

# Reject suggestion
improve reject 1 --reason "Not applicable"
```

### Publication

```bash
# Check if ready to publish
publish check
publish check --verbose

# Publish
publish --version "1.0.0"
publish --version "1.0.0" --changelog "Initial release"
publish --version "1.0.0" --category "parsing" --tags "code,extraction"

# Dry run
publish --dry-run

# Unpublish
publish unpublish <block-id>@<version>

# List versions
publish versions <block-id>
publish versions code-extractor

# Set default version
publish set-default <block-id>@<version>
```

### Catalog (Browse Published Blocks)

```bash
# Browse catalog
catalog
catalog --type tool
catalog --type agent
catalog --category development

# Search
catalog search "code review"

# Show details
catalog show <block-id>
catalog show code-developer@1.2.0

# Top performers
catalog top --limit 10
```

### Session Control

```bash
# Pause session
pause

# Resume session
resume

# Exit session
exit
exit --keep          # Keep session running
exit --stop          # Stop session
```

---

## Evaluation Modes

### Auto Mode

The system automatically evaluates every iteration using an LLM:

```bash
train start \
  --iterations 50 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.8
```

**Flow:**
1. Iteration executes
2. LLM receives input + output
3. LLM scores the result
4. Score automatically recorded

### Hybrid Mode (Recommended)

Auto-evaluation with human review for edge cases:

```bash
train start \
  --iterations 50 \
  --eval-mode hybrid \
  --eval-model deepseek-coder \
  --eval-threshold 0.8 \
  --human-review-below 0.7 \
  --human-review-on-error \
  --human-sample-rate 0.1
```

**Human review triggered when:**
- Score below threshold (0.7)
- Execution error
- Random sample (10%)

### Manual Mode

Every iteration requires manual evaluation:

```bash
train start --iterations 10 --eval-mode manual
```

**Flow:**
1. Iteration executes
2. Added to pending queue
3. Human reviews: `eval submit iter-001 --score 0.85`

---

## Workflow Examples

### Interactive Block Development

```bash
# 1. Create foundry session
maestro session create --foundry --authority human

# 2. Connect
maestro session connect sess-foundry-123

# 3. Create a new draft
session> draft create --name "json-parser" --type tool

# 4. Edit the draft
session> draft edit
# (Opens editor with block definition)

# 5. Test it
session> draft test --input data='{"name": "test"}'
Output: { parsed: true, name: "test" }

# 6. Start training with auto-eval
session> train start --iterations 30 --eval-mode auto --eval-model deepseek-coder

# 7. Monitor progress
session> train status
Training: 30/30 iterations (completed)
  Passed: 28 | Failed: 2
  Avg Score: 0.85

# 8. Review metrics
session> metrics
Metrics for json-parser:
  Total: 30 | Passed: 28 | Failed: 2
  Success Rate: 93.3%
  Avg Score: 0.85 (min: 0.45, max: 0.98)
  Criteria:
    Correctness: 0.90
    Quality: 0.82
    Efficiency: 0.83

# 9. Get improvement suggestions
session> improve suggest
Suggestions:
  1. [PROMPT] Clarify error handling instructions (+5% reliability)
  2. [CONFIG] Add input validation schema (+3% correctness)
  3. [OUTPUT] Normalize output format (+2% consistency)

# 10. Apply improvements
session> improve apply 1 2

# 11. Train again with new version
session> draft save --message "Applied suggestions 1 and 2"
session> train start --iterations 30 --eval-mode auto

# 12. Check readiness
session> publish check
✓ Avg score: 0.89 (threshold: 0.80)
✓ Success rate: 96.7%
✓ All criteria above threshold
Ready to publish!

# 13. Publish
session> publish --version "1.0.0" --changelog "Initial release"
Published json-parser@1.0.0 to catalog!

# 14. Exit
session> exit
```

### AI-Controlled Training Pipeline

```bash
# Create session for AI
maestro session create --foundry --authority ai:claude-code --draft code-analyzer

# Monitor what AI does
maestro session monitor sess-foundry-456
```

AI executes via API:

```http
POST /api/sessions/sess-foundry-456/exec

{"command": "train start --iterations 100 --eval-mode auto"}
---
{"command": "train status"}
---
{"command": "metrics"}
---
{"command": "improve suggest"}
---
{"command": "improve apply-all"}
---
{"command": "train start --iterations 50"}
---
{"command": "publish check"}
---
{"command": "publish --version \"1.1.0\""}
```

### Automated Forge-and-Publish Script

```bash
#!/bin/bash
# forge-block.sh

DRAFT_NAME=$1
TARGET_SCORE=${2:-0.85}
MAX_ATTEMPTS=${3:-5}

# Create session
SESSION=$(maestro session create \
  --foundry \
  --authority agent:auto-trainer \
  --draft $DRAFT_NAME \
  --json | jq -r '.id')

echo "Session: $SESSION"

for attempt in $(seq 1 $MAX_ATTEMPTS); do
  echo "=== Attempt $attempt/$MAX_ATTEMPTS ==="

  # Start training
  maestro session exec $SESSION "train start --iterations 50 --eval-mode auto"

  # Wait for completion
  maestro session exec $SESSION "train wait"

  # Check score
  SCORE=$(maestro session exec $SESSION "metrics --json" | jq '.avgScore')
  echo "Score: $SCORE"

  if (( $(echo "$SCORE >= $TARGET_SCORE" | bc -l) )); then
    echo "Target reached! Publishing..."
    maestro session exec $SESSION "publish --version \"1.0.$attempt\""
    maestro session exec $SESSION "exit"
    exit 0
  fi

  # Apply improvements
  maestro session exec $SESSION "improve apply-all"
  maestro session exec $SESSION "draft save"
done

echo "Max attempts reached. Final score: $SCORE"
maestro session exec $SESSION "exit"
exit 1
```

---

## Draft Structure

```json
{
  "id": "draft-abc123",
  "name": "code-extractor",
  "type": "tool",
  "status": "forging",
  "version": "0.2.0",
  "description": "Extracts code blocks from text",

  "definition": {
    "blockType": "tool",
    "inputs": [
      {"id": "text", "type": "string", "required": true, "description": "Text containing code"}
    ],
    "outputs": [
      {"id": "code", "type": "string", "description": "Extracted code"},
      {"id": "language", "type": "string", "description": "Detected language"}
    ],
    "config": {
      "systemPrompt": "You are a code extraction expert...",
      "model": "deepseek-coder",
      "temperature": 0.3
    }
  },

  "testCases": [
    {
      "input": {"text": "Here is some code: ```js\nconsole.log('hello')\n```"},
      "expectedOutput": {"code": "console.log('hello')", "language": "javascript"}
    }
  ],

  "trainingHistory": [
    {"sessionId": "sess-001", "score": 0.72, "iterations": 50},
    {"sessionId": "sess-002", "score": 0.85, "iterations": 50}
  ],

  "currentScore": 0.85,
  "improvements": ["Applied prompt clarification", "Added input validation"],

  "createdAt": "2026-01-30T10:00:00Z",
  "updatedAt": "2026-01-30T14:30:00Z"
}
```

---

## API Reference

### REST Endpoints

```
# Session management
POST   /api/foundry/sessions              Create session
GET    /api/foundry/sessions              List sessions
GET    /api/foundry/sessions/{id}         Get session info
DELETE /api/foundry/sessions/{id}         Delete session

# Session control
POST   /api/foundry/sessions/{id}/start   Start session
POST   /api/foundry/sessions/{id}/pause   Pause session
POST   /api/foundry/sessions/{id}/resume  Resume session
POST   /api/foundry/sessions/{id}/stop    Stop session

# Command execution
POST   /api/foundry/sessions/{id}/exec    Execute command
GET    /api/foundry/sessions/{id}/events  Get events

# Drafts
GET    /api/foundry/drafts                List drafts
POST   /api/foundry/drafts                Create draft
GET    /api/foundry/drafts/{id}           Get draft
PUT    /api/foundry/drafts/{id}           Update draft
DELETE /api/foundry/drafts/{id}           Delete draft

# Catalog
GET    /api/foundry/catalog               List published
GET    /api/foundry/catalog/{id}          Get block details
POST   /api/foundry/catalog/publish       Publish block

# WebSocket
WS     /api/foundry/sessions/{id}/stream  Real-time events
```

---

## Best Practices

### 1. Start with Small Iterations

```bash
# Test with 10-20 iterations first
train start --iterations 20 --eval-mode auto

# Then scale up
train start --iterations 100 --parallel 5
```

### 2. Use Hybrid Evaluation

```bash
# Auto-eval most, human-review edge cases
train start \
  --eval-mode hybrid \
  --human-review-below 0.7 \
  --human-sample-rate 0.1
```

### 3. Apply Improvements Incrementally

```bash
# Apply one at a time
improve apply 1
train start --iterations 30

# Check if it helped
metrics compare --baseline
```

### 4. Version Your Drafts

```bash
# Save with meaningful messages
draft save --message "Improved error handling"
draft save --message "Added input validation"
```

### 5. Test Before Publishing

```bash
# Verify readiness
publish check --verbose

# Dry run
publish --dry-run --version "1.0.0"
```

---

## Quick Reference

```bash
# ===== SESSION =====
maestro session create --foundry --authority <type>
maestro session connect <id>
maestro session monitor <id>

# ===== WITHIN SESSION =====
# Draft
draft list | create | load <id> | show | edit | test | save | delete <id>

# Training
train start [--iterations N] [--eval-mode auto|hybrid|manual]
train status | pause | resume | stop | results

# Evaluation
eval pending | show <iter-id> | submit <iter-id> --score N | auto

# Metrics
metrics | metrics --detailed | metrics compare <id>

# Improvements
improve suggest | show | apply <id> | apply-all | reject <id>

# Publication
publish check | publish --version "X.Y.Z" | publish --dry-run
catalog | catalog search | catalog show <id>

# Control
pause | resume | exit
```

---

## Related Documents

- [GUIDE-SESSION-TYPES.md](GUIDE-SESSION-TYPES.md) - Session architecture overview
- [PROJECT-SESSION-DETAILED-GUIDE.md](PROJECT-SESSION-DETAILED-GUIDE.md) - Project sessions for real work
- [FULL-PIPELINE-GUIDE.md](FULL-PIPELINE-GUIDE.md) - Complete end-to-end workflow
