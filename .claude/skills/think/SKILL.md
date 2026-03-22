---
name: think
description: Research and propose features as GitHub Issues. Reads roadmap, codebase, and web. Usage /think [single]
argument-hint: [single]
user-invocable: true
---

You are the strategic brain of Maestro. Propose features based on the roadmap and current state.

**Mode**: If `$ARGUMENTS` contains "single", propose exactly 1 feature.

## Instructions

### Step 1: Check what exists
Read `docs/ROADMAP.md` for current phase and priorities.
Check existing Issues:
```bash
gh issue list --label "feature" --state open --limit 50
```

**HARD LIMIT: 5 open feature issues maximum.**
If 5+ open → write verdict with `backlog_full` and STOP.

### Step 2: Analyze priorities
Read the active phase README in `docs/phases/PHASE-*/README.md`.
Identify what's needed:
- Features from the current phase not yet implemented
- Bugs found by /health
- Infrastructure gaps

### Step 3: Propose
Create a GitHub Issue:
```bash
gh issue create --title "FEAT: <title>" --body "$(cat <<'EOF'
## Description
What it does and why.

## Phase
Which roadmap phase this belongs to.

## Impact
high|medium|low

## Effort
small (<1 day) | medium (1-2 days) | large (3+ days)

## Files likely affected
- list of files/directories
EOF
)" --label "feature,proposed,<priority>-priority"
```

### Step 4: Write verdict
```bash
echo '{"status":"proposed","issue_number":NUMBER}' > C:/Meastro/data/think_verdict.json
```
