---
name: improve
description: Fix the top issue found by /health. Acquires lock, diagnoses, fixes, verifies, releases.
user-invocable: true
---

Run the autonomous improvement cycle for Maestro.

## Instructions

### Step 0: Acquire lock
```bash
python C:/Meastro/scripts/task_coordinator.py acquire improvement_cycle
```
If busy → say "Improvement cycle already running. Skipping." and STOP.

### Step 1: Diagnose
Run /health to identify the top issue.

### Step 2: Fix
Dispatch l'agent builder (socle dev-kit) to fix the top issue:
- If build fails → fix compilation errors
- If tests fail → fix failing tests
- If service down → check logs, fix config
- If deploy failed → check deploy.log, fix the issue

### Step 3: Verify
Run l'agent judge (socle dev-kit) to confirm the fix:
- Build passes
- Tests pass
- No regressions

### Step 4: Commit (if changes made)
```bash
cd C:/Meastro
git add -A
git commit -m "fix: <what was fixed>"
git push origin dev
```

### Step 5: Release lock
```bash
python C:/Meastro/scripts/task_coordinator.py release improvement_cycle
```

### Rules
- Fix ONE issue per cycle
- Always verify after fixing
- Always release the lock (even on failure)
- Never modify protected files
