# Foundry Workflow - Complete Guide

## Overview

Foundry is the **central workshop** of Maestro where blocks (tools, agents, workflows) are:
1. **Created** as drafts
2. **Forged** through training sessions
3. **Evaluated** automatically or manually
4. **Improved** iteratively
5. **Published** to the catalog

---

## 1. Foundry Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           FOUNDRY                                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      WORKSHOP                               │ │
│  │                                                             │ │
│  │  ┌─────────┐   ┌─────────────┐   ┌─────────────────────┐  │ │
│  │  │ DRAFTS  │   │  SESSIONS   │   │    IMPROVEMENTS     │  │ │
│  │  │         │   │             │   │                     │  │ │
│  │  │ • Draft │──►│ • Execute   │──►│ • Suggestions       │  │ │
│  │  │ • Draft │   │ • Evaluate  │   │ • Apply             │  │ │
│  │  │ • Draft │   │ • Metrics   │   │ • New Version       │  │ │
│  │  └─────────┘   └─────────────┘   └─────────────────────┘  │ │
│  │       ▲                                    │               │ │
│  │       └────────────────────────────────────┘               │ │
│  │                    (Iterate until satisfied)               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼ [Publish]                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      CATALOG                                │ │
│  │                                                             │ │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │ │
│  │  │     TOOLS     │ │    AGENTS     │ │   WORKFLOWS   │    │ │
│  │  │  (Published)  │ │  (Published)  │ │  (Published)  │    │ │
│  │  │               │ │               │ │               │    │ │
│  │  │ • git-commit  │ │ • code-dev    │ │ • ci-pipeline │    │ │
│  │  │ • file-read   │ │ • reviewer    │ │ • deploy      │    │ │
│  │  │ • api-call    │ │ • planner     │ │ • test-suite  │    │ │
│  │  └───────────────┘ └───────────────┘ └───────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Block Lifecycle

### Block States

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│  DRAFT  │───►│ FORGING  │───►│ VALIDATED │───►│ PUBLISHED │
└─────────┘    └──────────┘    └───────────┘    └───────────┘
     │              │                │                │
     │              │                │                │
   Created       Active          Score ≥           In the
  initial       sessions        threshold         catalog
```

### Transitions

| From | To | Condition |
|------|-----|-----------|
| Draft | Forging | Session created and started |
| Forging | Validated | Average score ≥ threshold |
| Validated | Published | Manual publication |
| Published | Forging | New version (improvement) |

---

## 3. Draft Management

### Create a Draft

```bash
# New empty draft
maestro foundry draft create \
  --name "my-tool" \
  --type tool \
  --description "Tool that does X"

# Draft from a JSON file
maestro foundry draft create \
  --name "my-agent" \
  --type agent \
  --from-file ./agent-definition.json

# Draft from an existing block (copy)
maestro foundry draft create \
  --name "my-tool-v2" \
  --type tool \
  --from-block existing-tool-id
```

### Draft Structure

```json
{
  "id": "draft-abc123",
  "name": "code-extractor",
  "type": "tool",
  "status": "draft",
  "version": "0.1.0",
  "description": "Extracts code from text",

  "definition": {
    "blockType": "tool",
    "inputs": [
      {"id": "text", "type": "string", "required": true}
    ],
    "outputs": [
      {"id": "code", "type": "string"},
      {"id": "language", "type": "string"}
    ],
    "config": {
      "command": "powershell",
      "args": ["-Command", "..."]
    }
  },

  "sessions": [],
  "currentScore": null,
  "improvements": [],

  "createdAt": "2026-01-30T10:00:00Z",
  "updatedAt": "2026-01-30T10:00:00Z"
}
```

### Draft Commands

```bash
# List drafts
maestro foundry draft list
maestro foundry draft list --type tool
maestro foundry draft list --status forging

# View a draft
maestro foundry draft show <draft-id>

# Edit a draft
maestro foundry draft edit <draft-id> --file updated-definition.json

# Delete a draft
maestro foundry draft delete <draft-id>
```

---

## 4. Foundry Sessions

### Create a Session

```bash
maestro foundry session create \
  --draft <draft-id> \
  --name "Training v1" \
  --iterations 50 \
  --parallel 3 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.8 \
  --eval-criteria correctness:0.4,quality:0.3,efficiency:0.2,reliability:0.1 \
  --input text="function hello() { return 'world'; }" \
  --tags "baseline,v1"
```

### Complete Configuration

```json
{
  "id": "session-xyz789",
  "draftId": "draft-abc123",
  "name": "Training v1",
  "status": "created",

  "execution": {
    "iterations": 50,
    "parallel": 3,
    "delayMs": 500,
    "timeout": 300000,
    "inputs": {
      "text": "function hello() { return 'world'; }"
    }
  },

  "evaluation": {
    "mode": "auto",
    "autoEvaluator": {
      "type": "llm",
      "modelId": "deepseek-coder",
      "criteria": [
        {"id": "correctness", "name": "Correctness", "weight": 0.4},
        {"id": "quality", "name": "Quality", "weight": 0.3},
        {"id": "efficiency", "name": "Efficiency", "weight": 0.2},
        {"id": "reliability", "name": "Reliability", "weight": 0.1}
      ],
      "passThreshold": 0.8
    },
    "humanReviewTrigger": null
  },

  "results": {
    "iterations": [],
    "metrics": null,
    "improvements": []
  },

  "tags": ["baseline", "v1"],
  "createdAt": "2026-01-30T10:30:00Z"
}
```

### Evaluation Modes

#### Auto Mode

```bash
maestro foundry session create \
  --draft my-tool \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.8
```

The system:
1. Executes each iteration
2. Sends input and output to the LLM model
3. The model returns a score and criteria
4. Automatically stores the evaluation

#### Hybrid Mode

```bash
maestro foundry session create \
  --draft my-tool \
  --eval-mode hybrid \
  --eval-model deepseek-coder \
  --eval-threshold 0.8 \
  --human-review-below 0.7 \
  --human-review-on-error \
  --human-sample-rate 0.1
```

The system:
1. Auto-evaluates each iteration
2. Marks for human review if:
   - Score < 0.7
   - Execution error
   - 10% random sample
3. Human/AI reviews the marked cases

#### Manual Mode

```bash
maestro foundry session create \
  --draft my-tool \
  --eval-mode manual \
  --iterations 10
```

The system:
1. Executes the iterations
2. Waits for manual evaluation for each
3. Usable via CLI or UI

### Start and Follow

```bash
# Start (returns immediately)
maestro foundry session start <session-id>

# Start and wait for completion
maestro foundry session start <session-id> --wait

# Follow in real-time
maestro foundry session follow <session-id>

# View status
maestro foundry session status <session-id>

# View metrics
maestro foundry session metrics <session-id>
```

### Control Execution

```bash
# Pause
maestro foundry session pause <session-id>

# Resume
maestro foundry session resume <session-id>

# Cancel
maestro foundry session cancel <session-id>
```

---

## 5. Evaluation and Metrics

### Collected Metrics

```json
{
  "metrics": {
    "totalIterations": 50,
    "completedIterations": 48,
    "failedIterations": 2,
    "successRate": 0.96,

    "avgScore": 0.82,
    "minScore": 0.45,
    "maxScore": 0.98,
    "medianScore": 0.85,

    "criteriaScores": {
      "correctness": 0.88,
      "quality": 0.79,
      "efficiency": 0.81,
      "reliability": 0.76
    },

    "performance": {
      "avgDurationMs": 1234,
      "avgTokens": 456,
      "totalCostUsd": 0.23
    },

    "iterationsBelowThreshold": 8,
    "iterationsNeedingReview": 3
  }
}
```

### Manual Evaluation (CLI)

```bash
# View pending iterations
maestro foundry session pending <session-id>

# Evaluate an iteration
maestro foundry session evaluate <session-id> \
  --iteration <iter-id> \
  --score 0.85 \
  --correctness 0.9 \
  --quality 0.8 \
  --explanation "Code correct but could be cleaner"

# Bulk evaluation
maestro foundry session evaluate <session-id> \
  --from-file evaluations.json
```

### Evaluation by Custom Agent

```bash
# Use a Maestro agent as evaluator
maestro foundry session create \
  --draft my-tool \
  --eval-mode auto \
  --eval-agent quality-evaluator-agent \
  --eval-threshold 0.85
```

The evaluator agent receives:
```json
{
  "iteration": {
    "inputs": {"text": "..."},
    "outputs": {"code": "...", "language": "javascript"},
    "success": true,
    "durationMs": 1234
  },
  "criteria": [
    {"id": "correctness", "weight": 0.4},
    {"id": "quality", "weight": 0.3}
  ]
}
```

And returns:
```json
{
  "score": 0.85,
  "criteriaScores": [
    {"id": "correctness", "score": 0.9},
    {"id": "quality", "score": 0.8}
  ],
  "explanation": "The code is correct...",
  "suggestions": ["Add error handling"]
}
```

---

## 6. Improvements

### Improvement Generation

After a session, the system automatically generates suggestions:

```bash
# View suggestions
maestro foundry session improvements <session-id>
```

Output:
```
Improvements for session xyz789:

1. [PROMPT] Improve system prompt clarity
   Estimated impact: +5% score
   File: config.systemPrompt

2. [INPUT] Add input validation
   Estimated impact: +3% reliability
   File: inputs schema

3. [CONFIG] Reduce temperature to 0.5
   Estimated impact: +2% consistency
   File: config.temperature
```

### Apply Improvements

```bash
# Apply a specific improvement
maestro foundry session improve <session-id> --apply 1

# Apply all improvements
maestro foundry session improve <session-id> --apply-all

# Create a new version with improvements
maestro foundry session improve <session-id> --apply-all --new-version
```

### Compare Sessions

```bash
# Compare two sessions
maestro foundry session compare <session-1> <session-2>

# Compare with baseline
maestro foundry session compare <session-id> --with-baseline
```

Output:
```
Comparison: session-1 vs session-2

                    session-1    session-2    Diff
─────────────────────────────────────────────────
Avg Score           0.72         0.85         +18%
Correctness         0.75         0.90         +20%
Quality             0.68         0.82         +21%
Efficiency          0.78         0.80         +3%
Success Rate        0.90         0.96         +7%
Avg Duration        1500ms       1200ms       -20%

Verdict: session-2 is significantly better ✓
```

---

## 7. Publication

### Prerequisites

- Average score ≥ configured threshold
- All evaluations completed
- No critical error iterations

### Publish a Block

```bash
# Check if ready
maestro foundry draft ready <draft-id>

# Publish
maestro foundry publish <draft-id> \
  --version "1.0.0" \
  --changelog "Initial release"

# Publish with category and tags
maestro foundry publish <draft-id> \
  --version "1.0.0" \
  --category "parsing" \
  --tags "code,extraction,utility"
```

### Version Management

```bash
# List published versions
maestro foundry versions <block-id>

# View a specific version
maestro foundry catalog show <block-id>@1.0.0

# Unpublish a version
maestro foundry unpublish <block-id>@1.0.0

# Set default version
maestro foundry set-default <block-id>@1.2.0
```

---

## 8. Catalog

### Explore the Catalog

```bash
# All published blocks
maestro foundry catalog

# By type
maestro foundry catalog --type tool
maestro foundry catalog --type agent

# By category
maestro foundry catalog --category development

# Search
maestro foundry catalog search "code"

# Top performers
maestro foundry catalog --sort score --limit 10
```

### Use a Block from Catalog

```bash
# In a Project Session
maestro project session create \
  --project my-app \
  --workflow code-developer@1.2.0 \  # Specific version
  --task "Add feature X"

# Or latest version
maestro project session create \
  --project my-app \
  --workflow code-developer \  # Latest
  --task "Add feature X"
```

---

## 9. Complete Automation

### Script: Forge and Publish a Tool

```bash
#!/bin/bash
# forge-and-publish.sh

DRAFT_NAME=$1
TARGET_SCORE=${2:-0.85}
MAX_ATTEMPTS=${3:-5}

# 1. Create the draft (if not existing)
if ! maestro foundry draft show $DRAFT_NAME &>/dev/null; then
  echo "Creating draft..."
  maestro foundry draft create --name $DRAFT_NAME --type tool
fi

# 2. Improvement loop
for attempt in $(seq 1 $MAX_ATTEMPTS); do
  echo "=== Attempt $attempt/$MAX_ATTEMPTS ==="

  # Create session with auto-evaluation
  SESSION=$(maestro foundry session create \
    --draft $DRAFT_NAME \
    --name "Forge attempt $attempt" \
    --iterations 30 \
    --eval-mode auto \
    --eval-model deepseek-coder \
    --eval-threshold $TARGET_SCORE \
    --json | jq -r '.id')

  echo "Session: $SESSION"

  # Execute and wait
  maestro foundry session start $SESSION --wait

  # Check the score
  SCORE=$(maestro foundry session metrics $SESSION --json | jq '.avgScore')
  echo "Score: $SCORE (target: $TARGET_SCORE)"

  # If score reached, publish
  if (( $(echo "$SCORE >= $TARGET_SCORE" | bc -l) )); then
    echo "Target reached! Publishing..."
    maestro foundry publish $DRAFT_NAME --version "1.0.$attempt"
    echo "Published as $DRAFT_NAME@1.0.$attempt"
    exit 0
  fi

  # Otherwise, apply improvements
  echo "Applying improvements..."
  maestro foundry session improve $SESSION --apply-all

done

echo "Max attempts reached. Current score: $SCORE"
exit 1
```

### Usage

```bash
./forge-and-publish.sh code-extractor 0.85 5
```

### Script: CI/CD for Foundry

```bash
#!/bin/bash
# foundry-ci.sh - To run in CI/CD

BLOCK_ID=$1
MIN_SCORE=0.80

# 1. Create validation session
SESSION=$(maestro foundry session create \
  --draft $BLOCK_ID \
  --name "CI Validation $(date +%Y%m%d-%H%M)" \
  --iterations 20 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold $MIN_SCORE \
  --json | jq -r '.id')

# 2. Execute
maestro foundry session start $SESSION --wait

# 3. Check results
SCORE=$(maestro foundry session metrics $SESSION --json | jq '.avgScore')
SUCCESS_RATE=$(maestro foundry session metrics $SESSION --json | jq '.successRate')

echo "Score: $SCORE"
echo "Success Rate: $SUCCESS_RATE"

# 4. Fail if below threshold
if (( $(echo "$SCORE < $MIN_SCORE" | bc -l) )); then
  echo "FAIL: Score below threshold"
  exit 1
fi

if (( $(echo "$SUCCESS_RATE < 0.95" | bc -l) )); then
  echo "FAIL: Success rate below 95%"
  exit 1
fi

echo "PASS: All checks passed"
exit 0
```

---

## 10. Command Summary

```bash
# === DRAFTS ===
maestro foundry draft create [options]    # Create
maestro foundry draft list [filters]      # List
maestro foundry draft show <id>           # Details
maestro foundry draft edit <id>           # Edit
maestro foundry draft delete <id>         # Delete
maestro foundry draft ready <id>          # Check if publishable

# === SESSIONS ===
maestro foundry session create [options]  # Create
maestro foundry session start <id>        # Start
maestro foundry session status <id>       # Status
maestro foundry session metrics <id>      # Metrics
maestro foundry session follow <id>       # Follow in real-time
maestro foundry session pause <id>        # Pause
maestro foundry session resume <id>       # Resume
maestro foundry session cancel <id>       # Cancel
maestro foundry session pending <id>      # Pending evaluations
maestro foundry session evaluate <id>     # Evaluate manually
maestro foundry session improvements <id> # View suggestions
maestro foundry session improve <id>      # Apply improvements
maestro foundry session compare <a> <b>   # Compare

# === PUBLICATION ===
maestro foundry publish <draft-id>        # Publish
maestro foundry unpublish <id>@<version>  # Unpublish
maestro foundry versions <id>             # List versions
maestro foundry set-default <id>@<ver>    # Default version

# === CATALOG ===
maestro foundry catalog [filters]         # Explore
maestro foundry catalog search <query>    # Search
maestro foundry catalog show <id>         # Published block details
```

---

## Related Documents

- [GUIDE-SESSION-TYPES.md](GUIDE-SESSION-TYPES.md) - Foundry vs Project comparison
- [PROJECT-SESSION-DETAILED-GUIDE.md](PROJECT-SESSION-DETAILED-GUIDE.md) - Project Sessions guide
- [FULL-PIPELINE-GUIDE.md](FULL-PIPELINE-GUIDE.md) - Complete end-to-end pipeline
- [GUIDE-AI-CLI-REFERENCE.md](GUIDE-AI-CLI-REFERENCE.md) - Complete CLI reference
