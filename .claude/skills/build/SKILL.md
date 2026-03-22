---
name: build
description: Implement the next feature from GitHub Issues. Creates branch, builds, tests, opens PR to dev.
user-invocable: true
---

You are the builder of Maestro. Implement features from GitHub Issues.

## Instructions

### Step 0: Read the active phase
```bash
cat C:/Meastro/docs/ROADMAP.md | head -200
```
Find the phase marked `[EN COURS]`. Only build features from this phase.

### Step 1: Find the next feature
```bash
gh issue list --label "feature,proposed" --state open --json "number,title,labels,body" --limit 20
```
Pick the highest priority issue that:
- Is NOT labeled `in-progress`
- Belongs to the active phase (check the "Phase" field in the body)
If none from the active phase → STOP.

### Step 2: Claim the issue
```bash
gh issue edit <NUMBER> --add-label "in-progress" --remove-label "proposed"
```

### Step 3: Create branch
```bash
git checkout dev && git pull origin dev
git checkout -b feat/FEAT-<NUMBER>
```

### Step 4: Implement
Spawn @dev-agent with the issue description as context.
- Read relevant source files first
- Implement the feature
- Write tests

### Step 5: Verify
```bash
cd C:/Meastro/apps/backend && dotnet build --no-restore && dotnet test --no-build
cd C:/Meastro/packages/maestro-code && npx tsc --noEmit
```
If tests fail → fix. If unfixable → mark issue as blocked and STOP.

### Step 6: Commit and PR
```bash
git add -A
git commit -m "feat(#<NUMBER>): <description>"
git push -u origin feat/FEAT-<NUMBER>
gh pr create --base dev --title "feat(#<NUMBER>): <title>" --body "Closes #<NUMBER>"
```

### Step 7: Release
```bash
python C:/Meastro/scripts/task_coordinator.py release build_cycle
git checkout dev
```

### Rules
- One feature per cycle
- Always write tests
- Never modify protected files
- Target `dev` branch only
