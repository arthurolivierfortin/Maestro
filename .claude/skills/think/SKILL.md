---
name: think
description: Propose the next feature to build based on the active roadmap phase. Reads roadmap, phase README, and existing issues. Usage /think [single]
argument-hint: [single]
user-invocable: true
---

You are the strategic brain of Maestro. You propose features STRICTLY from the active roadmap phase.

**Mode**: If `$ARGUMENTS` contains "single", propose exactly 1 feature (used by /dev-cycle).

## Instructions

### Step 1: Read the roadmap and find the active phase
```bash
cat C:/Meastro/docs/ROADMAP.md | head -200
```

Find the phase marked `[EN COURS]` in the dependency chain. That is the ONLY phase you can propose features for.

### Step 2: Read the active phase README
```bash
cat C:/Meastro/docs/phases/PHASE-<NUMBER>/README.md
```

This tells you:
- What sub-phases exist and their status (DONE vs A FAIRE)
- What the Definition of Done requires
- What is NOT in scope

**RULE: You can ONLY propose features that are in the active phase's scope.**
Do NOT propose features from future phases.

### Step 3: Check existing issues
```bash
gh issue list --label "feature" --state open --limit 50
```

**HARD LIMIT: 5 open feature issues maximum.**
If 5+ open → write verdict with `backlog_full` and STOP.

Check which parts of the active phase already have issues. Don't duplicate.

### Step 4: Identify what's missing
Compare the phase README's Definition of Done with existing issues.
What's needed but doesn't have an issue yet?

Priority order:
1. Sub-phases marked "A FAIRE" that don't have issues
2. Dependencies blocking other sub-phases
3. Bugs found by /health that block the active phase

### Step 5: Propose
Create a GitHub Issue for the highest-priority missing item:
```bash
gh issue create --title "FEAT: <title>" --body "$(cat <<'EOF'
## Description
What it does and why.

## Phase
Phase <NUMBER>, sub-phase <LETTER>

## Impact
high|medium|low

## Effort
small (<1 day) | medium (1-2 days) | large (3+ days)

## Depends on
- #<issue> (if any)

## Definition of Done
- [ ] Concrete acceptance criteria from the phase README

## Files likely affected
- list of files/directories
EOF
)" --label "feature,proposed,<priority>-priority"
```

### Step 6: Write verdict
```bash
echo '{"status":"proposed","phase":"<NUMBER>","issue_number":NUMBER}' > C:/Meastro/data/think_verdict.json
```

### Rules
- **ONLY propose from the active phase** — never from future phases
- **Maximum 5 open issues** — if 5+ open, say backlog_full
- **Single mode**: propose exactly 1, the highest priority missing piece
- **Check the phase README** — it's the source of truth for what to build
- **Include phase and sub-phase** in every issue body
- **Don't re-propose** features that already have open issues
