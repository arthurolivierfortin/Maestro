# Complete Pipeline: From Development to Production

> **Note**: This document describes the **complete foundry vision** with features like draft management, auto-evaluation, improvement suggestions, and session comparison. Most of these features are **not yet implemented**. For the actual pipeline that works today, see **[current-pipeline.md](current-pipeline.md)**.

## Overview

This guide presents the **complete workflow** of Maestro:

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: FOUNDRY (Development)                                 │
│  ┌────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Draft  │─►│ Session │─►│ Improve │─►│ Publish │             │
│  └────────┘  └─────────┘  └─────────┘  └─────────┘             │
│                                              │                   │
│                                              ▼                   │
│  PHASE 2: PROJECT (Production)          CATALOG                 │
│  ┌────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Select │─►│ Execute │─►│ Validate│─►│ Commit  │             │
│  └────────┘  └─────────┘  └─────────┘  └─────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Concrete Scenario

We will create a **code validation agent** that:
1. Analyzes TypeScript code
2. Checks best practices
3. Suggests improvements

Then use it on a **real project**.

---

## Phase 1: Foundry - Create and Forge the Agent

### Step 1.1: Check the System

```bash
# Always start by checking
maestro health
maestro llm

# Expected result:
# ✓ Backend: healthy
# ✓ LLM Provider: healthy
# ✓ Models: deepseek-ai/deepseek-coder-1.3b-instruct
```

### Step 1.2: Create the Draft

```bash
# Create an agent draft
maestro foundry draft create \
  --name "code-validator" \
  --type agent \
  --description "Agent that validates and improves TypeScript code"

# Output:
# Draft created: draft-code-validator-abc123
# Status: draft
# Path: data/foundry/drafts/draft-code-validator-abc123.draft.json
```

### Step 1.3: Define the Agent

Create the definition file:

```bash
# Create the agent definition
cat > /tmp/code-validator-definition.json << 'EOF'
{
  "id": "code-validator",
  "name": "Code Validator",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Validates TypeScript code and suggests improvements",

  "inputs": [
    {
      "id": "code",
      "name": "Code",
      "type": "string",
      "required": true,
      "description": "The TypeScript code to validate"
    },
    {
      "id": "rules",
      "name": "Rules",
      "type": "array",
      "required": false,
      "default": ["no-any", "explicit-return-types", "no-unused-vars"]
    }
  ],

  "outputs": [
    {
      "id": "valid",
      "name": "Valid",
      "type": "boolean"
    },
    {
      "id": "issues",
      "name": "Issues",
      "type": "array"
    },
    {
      "id": "suggestions",
      "name": "Suggestions",
      "type": "array"
    },
    {
      "id": "improvedCode",
      "name": "Improved Code",
      "type": "string"
    }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxSteps": 5,
    "maxTokens": 4000,
    "temperature": 0.3,
    "timeoutMs": 60000,
    "tools": [],
    "systemPrompt": "You are an expert in TypeScript and code quality.\n\nYour task:\n1. Analyze the provided code\n2. Identify issues according to specified rules\n3. Suggest improvements\n4. Propose an improved version of the code\n\nRules to check:\n- no-any: No 'any' type\n- explicit-return-types: Explicit return types\n- no-unused-vars: No unused variables\n\nRespond in JSON:\n{\n  \"valid\": boolean,\n  \"issues\": [{\"line\": number, \"rule\": string, \"message\": string}],\n  \"suggestions\": [string],\n  \"improvedCode\": string\n}"
  },

  "capabilities": ["code-analysis", "typescript", "validation"],

  "metadata": {
    "category": "quality",
    "tags": ["typescript", "validation", "quality", "agent"],
    "author": "maestro-user"
  }
}
EOF

# Apply the definition to the draft
maestro foundry draft edit code-validator \
  --from-file /tmp/code-validator-definition.json

# Verify
maestro foundry draft show code-validator
```

### Step 1.4: Create a Foundry Session with Auto-Evaluation

```bash
# Create the session with automatic evaluation
maestro foundry session create \
  --draft code-validator \
  --name "Training v1 - Quality Focus" \
  --iterations 30 \
  --parallel 3 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.8 \
  --eval-criteria "correctness:0.4,quality:0.3,completeness:0.2,format:0.1" \
  --input code="function add(a, b) { return a + b; }" \
  --input rules='["no-any", "explicit-return-types"]' \
  --tags "v1,quality,baseline"

# Output:
# Session created: sess-cv-12345
# Draft: code-validator
# Iterations: 30 (parallel: 3)
# Evaluation: auto (deepseek-coder, threshold: 0.8)
# Status: created
```

### Step 1.5: Start Training

```bash
# Start and wait
maestro foundry session start sess-cv-12345 --wait

# Or start and follow in real-time
maestro foundry session start sess-cv-12345 --follow

# Output (during execution):
# Starting session sess-cv-12345...
# [1/30] Executing... ✓ Score: 0.72
# [2/30] Executing... ✓ Score: 0.85
# [3/30] Executing... ✓ Score: 0.78
# ...
# [30/30] Executing... ✓ Score: 0.91
#
# Session completed.
# Average Score: 0.82
# Success Rate: 96.7%
# Iterations below threshold: 4
```

### Step 1.6: Analyze Results

```bash
# View detailed metrics
maestro foundry session metrics sess-cv-12345

# Output:
# Session Metrics: sess-cv-12345
# ─────────────────────────────────
# Total Iterations:     30
# Completed:            29
# Failed:               1
# Success Rate:         96.7%
#
# Scores:
#   Average:            0.82
#   Min:                0.45
#   Max:                0.95
#   Median:             0.84
#
# By Criteria:
#   correctness:        0.88
#   quality:            0.79
#   completeness:       0.81
#   format:             0.76
#
# Performance:
#   Avg Duration:       1.2s
#   Avg Tokens:         890
#   Total Cost:         $0.04
#
# Below Threshold:      4 iterations
# Needs Human Review:   0 iterations

# View problematic iterations
maestro foundry session list-iterations sess-cv-12345 --below-threshold

# Output:
# Iterations below threshold (0.8):
# [5]  Score: 0.72  Issues: incorrect format
# [12] Score: 0.68  Issues: missing suggestions
# [18] Score: 0.45  Issues: execution error
# [25] Score: 0.75  Issues: incomplete analysis
```

### Step 1.7: View and Apply Improvements

```bash
# View generated improvement suggestions
maestro foundry session improvements sess-cv-12345

# Output:
# Improvement Suggestions for sess-cv-12345:
#
# 1. [PROMPT] Clarify JSON output format
#    Estimated impact: +8% on 'format'
#    Suggestion: Add an output example in the prompt
#
# 2. [PROMPT] Add edge case handling
#    Estimated impact: +5% on 'completeness'
#    Suggestion: Specify how to handle empty or invalid code
#
# 3. [CONFIG] Increase maxTokens
#    Estimated impact: +3% on 'completeness'
#    Suggestion: Increase from 4000 to 6000 tokens

# Apply all improvements
maestro foundry session improve sess-cv-12345 --apply-all

# Output:
# Applied 3 improvements to draft code-validator
# New version: 1.0.1
```

### Step 1.8: New Session with Improvements

```bash
# Create a new session to validate improvements
maestro foundry session create \
  --draft code-validator \
  --name "Training v2 - After Improvements" \
  --iterations 30 \
  --parallel 3 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.85 \
  --tags "v2,improved"

maestro foundry session start sess-cv-67890 --wait

# Compare with previous session
maestro foundry session compare sess-cv-12345 sess-cv-67890

# Output:
# Comparison: sess-cv-12345 vs sess-cv-67890
#
#                     v1          v2          Diff
# ─────────────────────────────────────────────────
# Avg Score           0.82        0.89        +8.5%
# correctness         0.88        0.92        +4.5%
# quality             0.79        0.87        +10.1%
# completeness        0.81        0.88        +8.6%
# format              0.76        0.86        +13.2%
# Success Rate        96.7%       100%        +3.3%
# Avg Duration        1.2s        1.4s        +16.7%
#
# Verdict: v2 is significantly better ✓
```

### Step 1.9: Publish to the Catalog

```bash
# Check that the draft is ready
maestro foundry draft ready code-validator

# Output:
# Draft: code-validator
# Current Score: 0.89 (threshold: 0.85) ✓
# All evaluations complete: ✓
# No critical errors: ✓
#
# Ready for publication: YES

# Publish
maestro foundry publish code-validator \
  --version "1.0.0" \
  --category "quality" \
  --tags "typescript,validation,production-ready" \
  --changelog "Initial release with 89% quality score"

# Output:
# Published: code-validator@1.0.0
# Category: quality
# Score: 0.89
# Available in catalog: ✓

# Verify in the catalog
maestro foundry catalog show code-validator

# Output:
# code-validator@1.0.0
# ─────────────────────
# Type: agent
# Category: quality
# Score: 89/100
# Published: 2026-01-30
#
# Description: Validates TypeScript code and suggests improvements
#
# Capabilities: code-analysis, typescript, validation
#
# Versions:
#   • 1.0.0 (current) - Initial release
```

---

## Phase 2: Project Session - Use in Production

### Step 2.1: Prepare the Project

```bash
# Check/create the Maestro project
maestro projects

# If project doesn't exist
maestro projects create \
  --name "my-app" \
  --path "C:/dev/my-app" \
  --runtime process

# Or open an existing project
maestro projects open "C:/dev/my-app"

# Check status
maestro projects info my-app

# Output:
# Project: my-app
# Path: C:/dev/my-app
# Runtime: process
# Status: ready
#
# Git:
#   Branch: main
#   Clean: yes
#   Last commit: abc1234 "feat: initial setup"
```

### Step 2.2: Create a Project Session

```bash
# Create a session to use our agent
maestro project session create \
  --project my-app \
  --workflow code-validator@1.0.0 \
  --task "Validate and improve all TypeScript files in src/utils/" \
  --context "Focus on quality and strict types" \
  --access controlled \
  --allowed-paths "src/utils/**" \
  --denied-paths "node_modules/**,.env" \
  --run-tests \
  --test-command "npm test -- --testPathPattern=utils"

# Output:
# Project Session created: proj-sess-abc123
# Project: my-app
# Workflow: code-validator@1.0.0
# Task: Validate and improve all TypeScript files in src/utils/
# Access: controlled
# Status: created
```

### Step 2.3: Execute the Session

```bash
# Start and follow
maestro project session start proj-sess-abc123 --follow

# Output (during execution):
# Starting project session proj-sess-abc123...
#
# [Step 1] Reading project structure...
# [Step 2] Analyzing src/utils/validation.ts...
#   Issues found: 3
#   - Line 5: 'any' type used
#   - Line 12: Missing return type
#   - Line 18: Unused variable 'temp'
# [Step 3] Generating improvements...
# [Step 4] Writing improved file...
# [Step 5] Analyzing src/utils/format.ts...
#   Issues found: 1
#   - Line 8: 'any' type used
# [Step 6] Generating improvements...
# [Step 7] Writing improved file...
#
# Session completed.
# Files modified: 2
# Issues fixed: 4
```

### Step 2.4: Verify Changes

```bash
# View status
maestro project session status proj-sess-abc123

# Output:
# Project Session: proj-sess-abc123
# Status: completed
# Duration: 23.4s
#
# Files Modified:
#   M src/utils/validation.ts
#   M src/utils/format.ts
#
# Summary:
#   Issues found: 4
#   Issues fixed: 4
#   Suggestions applied: 6

# View detailed diff
maestro project session diff proj-sess-abc123

# Output:
# diff --git a/src/utils/validation.ts b/src/utils/validation.ts
# --- a/src/utils/validation.ts
# +++ b/src/utils/validation.ts
# @@ -5,7 +5,7 @@
# -export function validate(data: any) {
# +export function validate(data: Record<string, unknown>): boolean {
#    // ...
#  }
# @@ -12,7 +12,7 @@
# -function checkFormat(input) {
# +function checkFormat(input: string): boolean {
#    // ...
#  }
# @@ -18,7 +18,6 @@
# -  const temp = 'unused';
#    return result;
#  }
#
# diff --git a/src/utils/format.ts b/src/utils/format.ts
# --- a/src/utils/format.ts
# +++ b/src/utils/format.ts
# @@ -8,7 +8,7 @@
# -export function formatDate(date: any): string {
# +export function formatDate(date: Date): string {
#    // ...
#  }

# Statistics
maestro project session diff proj-sess-abc123 --stat

# Output:
# src/utils/validation.ts | 8 +++++---
# src/utils/format.ts     | 2 +-
# 2 files changed, 6 insertions(+), 4 deletions(-)
```

### Step 2.5: Run Tests

```bash
# Launch tests
maestro project session test proj-sess-abc123

# Output:
# Running tests for session proj-sess-abc123...
# Command: npm test -- --testPathPattern=utils
#
#  PASS  tests/utils/validation.test.ts
#  PASS  tests/utils/format.test.ts
#
# Test Suites: 2 passed, 2 total
# Tests:       12 passed, 12 total
# Time:        2.341s
#
# Result: ✓ All tests passed
```

### Step 2.6: Commit Changes

```bash
# Create the commit on a feature branch
maestro project session commit proj-sess-abc123 \
  --branch feature/code-quality-improvements \
  --message "refactor(utils): improve type safety and remove unused code

- Add explicit return types to all functions
- Replace 'any' with proper types
- Remove unused variables

Validated by code-validator@1.0.0" \
  --push

# Output:
# Creating branch: feature/code-quality-improvements
# Staging files:
#   A src/utils/validation.ts
#   A src/utils/format.ts
#
# Commit: def5678
# Author: Maestro Agent <maestro@local>
#
# Pushing to origin...
#
# ✓ Committed and pushed successfully
#
# Branch: feature/code-quality-improvements
# Remote: origin
# PR URL: https://github.com/user/my-app/compare/feature/code-quality-improvements
```

---

## Complete Automation Script

### Script: Complete Pipeline

```bash
#!/bin/bash
# full-pipeline.sh
# Usage: ./full-pipeline.sh <agent-name> <project-name> <task>

set -e  # Exit on error

AGENT_NAME="${1:-code-validator}"
PROJECT_NAME="${2:-my-app}"
TASK="${3:-Validate and improve code quality}"
TARGET_SCORE="${4:-0.85}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           MAESTRO FULL PIPELINE                                ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Agent: $AGENT_NAME"
echo "║  Project: $PROJECT_NAME"
echo "║  Task: $TASK"
echo "║  Target Score: $TARGET_SCORE"
echo "╚════════════════════════════════════════════════════════════════╝"

# ═══════════════════════════════════════════════════════════════
# PHASE 1: FOUNDRY - Forge the Agent
# ═══════════════════════════════════════════════════════════════

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  PHASE 1: FOUNDRY"
echo "══════════════════════════════════════════════════════════════════"

# Check if agent exists in catalog
if maestro foundry catalog show $AGENT_NAME &>/dev/null; then
  echo "✓ Agent $AGENT_NAME already in catalog"
  AGENT_VERSION=$(maestro foundry catalog show $AGENT_NAME --json | jq -r '.version')
  echo "  Version: $AGENT_VERSION"
else
  echo "Agent not in catalog. Starting forge process..."

  # Check if draft exists
  if ! maestro foundry draft show $AGENT_NAME &>/dev/null; then
    echo "Creating draft..."
    maestro foundry draft create \
      --name $AGENT_NAME \
      --type agent \
      --description "Auto-created agent"
  fi

  # Create and run forging session
  echo "Creating forging session..."
  SESSION_ID=$(maestro foundry session create \
    --draft $AGENT_NAME \
    --name "Auto-forge $(date +%Y%m%d-%H%M)" \
    --iterations 20 \
    --parallel 2 \
    --eval-mode auto \
    --eval-model deepseek-coder \
    --eval-threshold $TARGET_SCORE \
    --json | jq -r '.id')

  echo "Session: $SESSION_ID"
  echo "Starting forging..."
  maestro foundry session start $SESSION_ID --wait

  # Check score
  SCORE=$(maestro foundry session metrics $SESSION_ID --json | jq '.avgScore')
  echo "Score: $SCORE (target: $TARGET_SCORE)"

  if (( $(echo "$SCORE >= $TARGET_SCORE" | bc -l) )); then
    echo "✓ Target reached! Publishing..."
    maestro foundry publish $AGENT_NAME \
      --version "1.0.0" \
      --changelog "Auto-published after reaching score $SCORE"
    AGENT_VERSION="1.0.0"
  else
    echo "✗ Target not reached. Applying improvements..."
    maestro foundry session improve $SESSION_ID --apply-all

    # Try again
    SESSION_ID=$(maestro foundry session create \
      --draft $AGENT_NAME \
      --iterations 20 \
      --eval-mode auto \
      --eval-threshold $TARGET_SCORE \
      --json | jq -r '.id')

    maestro foundry session start $SESSION_ID --wait
    SCORE=$(maestro foundry session metrics $SESSION_ID --json | jq '.avgScore')

    if (( $(echo "$SCORE >= $TARGET_SCORE" | bc -l) )); then
      maestro foundry publish $AGENT_NAME --version "1.0.0"
      AGENT_VERSION="1.0.0"
    else
      echo "✗ Could not reach target score after improvements"
      exit 1
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════
# PHASE 2: PROJECT - Execute on Real Project
# ═══════════════════════════════════════════════════════════════

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  PHASE 2: PROJECT SESSION"
echo "══════════════════════════════════════════════════════════════════"

# Check project exists
if ! maestro projects info $PROJECT_NAME &>/dev/null; then
  echo "✗ Project $PROJECT_NAME not found"
  exit 1
fi

# Create project session
echo "Creating project session..."
PROJ_SESSION=$(maestro project session create \
  --project $PROJECT_NAME \
  --workflow "${AGENT_NAME}@${AGENT_VERSION}" \
  --task "$TASK" \
  --access controlled \
  --run-tests \
  --json | jq -r '.id')

echo "Session: $PROJ_SESSION"

# Execute
echo "Executing..."
maestro project session start $PROJ_SESSION --wait

# Check status
STATUS=$(maestro project session status $PROJ_SESSION --json | jq -r '.status')
if [ "$STATUS" != "completed" ]; then
  echo "✗ Session failed: $STATUS"
  exit 1
fi

# Show changes
echo ""
echo "Changes made:"
maestro project session diff $PROJ_SESSION --stat

# Run tests
echo ""
echo "Running tests..."
TEST_RESULT=$(maestro project session test $PROJ_SESSION --json | jq -r '.passed')
if [ "$TEST_RESULT" != "true" ]; then
  echo "✗ Tests failed"
  maestro project session test $PROJ_SESSION --verbose
  exit 1
fi
echo "✓ Tests passed"

# ═══════════════════════════════════════════════════════════════
# PHASE 3: COMMIT
# ═══════════════════════════════════════════════════════════════

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  PHASE 3: COMMIT"
echo "══════════════════════════════════════════════════════════════════"

# Show diff for review
echo "Review changes:"
maestro project session diff $PROJ_SESSION

# Ask for confirmation
echo ""
read -p "Commit these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  BRANCH="auto/${AGENT_NAME}-$(date +%Y%m%d-%H%M)"

  maestro project session commit $PROJ_SESSION \
    --branch $BRANCH \
    --message "refactor: $TASK

Applied by: ${AGENT_NAME}@${AGENT_VERSION}
Session: $PROJ_SESSION" \
    --push

  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║  ✓ PIPELINE COMPLETED SUCCESSFULLY                            ║"
  echo "╠════════════════════════════════════════════════════════════════╣"
  echo "║  Agent: ${AGENT_NAME}@${AGENT_VERSION}"
  echo "║  Branch: $BRANCH"
  echo "║  Changes: $(maestro project session diff $PROJ_SESSION --stat | tail -1)"
  echo "╚════════════════════════════════════════════════════════════════╝"
else
  echo "Cancelled. Changes not committed."
  maestro project session cancel $PROJ_SESSION --keep
fi
```

### Usage

```bash
# Make executable
chmod +x full-pipeline.sh

# Execute
./full-pipeline.sh code-validator my-app "Improve type safety in utils"

# With custom target score
./full-pipeline.sh code-validator my-app "Refactor auth module" 0.9
```

---

## Quick Reference Commands

### Phase 1: Foundry

```bash
# Draft
maestro foundry draft create --name X --type agent
maestro foundry draft show X
maestro foundry draft edit X --from-file definition.json

# Session
maestro foundry session create --draft X --iterations N --eval-mode auto --eval-threshold 0.8
maestro foundry session start <id> --wait
maestro foundry session metrics <id>
maestro foundry session improvements <id>
maestro foundry session improve <id> --apply-all
maestro foundry session compare <id1> <id2>

# Publish
maestro foundry draft ready X
maestro foundry publish X --version 1.0.0
maestro foundry catalog show X
```

### Phase 2: Project

```bash
# Session
maestro project session create --project P --workflow W --task "..." --access controlled
maestro project session start <id> --wait
maestro project session status <id>
maestro project session diff <id>
maestro project session test <id>
maestro project session commit <id> --branch B --message "..." --push
```

---

## Best Practices

### 1. Always Forge Before Production

```bash
# GOOD ✓
# 1. Create and test in Foundry
# 2. Publish when score OK
# 3. Use in Project

# BAD ✗
# Use directly without validation
```

### 2. Define Realistic Thresholds

```bash
# Start low, increase progressively
--eval-threshold 0.7   # First attempt
--eval-threshold 0.8   # After improvements
--eval-threshold 0.85  # Production version
```

### 3. Use Branches

```bash
# GOOD ✓
--branch feature/improvement

# RISKY ✗
# Direct commit on main
```

### 4. Always Test

```bash
# GOOD ✓
--run-tests --test-command "npm test"

# RISKY ✗
# No tests
```

---

## Related Documents

- [FOUNDRY-DETAILED-GUIDE.md](FOUNDRY-DETAILED-GUIDE.md) - Complete Foundry guide
- [PROJECT-SESSION-DETAILED-GUIDE.md](PROJECT-SESSION-DETAILED-GUIDE.md) - Complete Project Sessions guide
- [GUIDE-SESSION-TYPES.md](GUIDE-SESSION-TYPES.md) - Session types comparison
- [GUIDE-AI-CLI-REFERENCE.md](GUIDE-AI-CLI-REFERENCE.md) - CLI reference
