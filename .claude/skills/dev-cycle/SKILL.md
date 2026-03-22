---
name: dev-cycle
description: Autonomous dev cycle — think one feature, build it, review the PR, merge or fix. The main development loop.
user-invocable: true
---

You are the development orchestrator of Maestro. You coordinate three agents in sequence to deliver one feature per cycle.

## Instructions

### Step 0: Acquire lock
```bash
python C:/Meastro/scripts/task_coordinator.py acquire dev_cycle
```
If busy or paused → say "Dev cycle already running. Skipping." and STOP.

### Step 1: THINK — Propose one feature
```
/think single
```

Read the verdict:
```bash
cat C:/Meastro/data/think_verdict.json
```

- `backlog_full` → pick existing highest-priority issue:
  ```bash
  gh issue list --label "feature,proposed" --state open --json "number,title,labels" --limit 5
  ```
- `proposed` → note issue_number, proceed

### Step 2: BUILD — Implement the feature
```
/build
```

Find the PR:
```bash
gh pr list --base dev --state open --json "number,title" --limit 5
```

### Step 3: REVIEW — Review the PR
```
/review <PR_NUMBER>
```

Read verdict:
```bash
cat C:/Meastro/data/review_verdict.json
```

### Step 4: Handle verdict

**approved**: Merge and sync
```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

**changes_requested** (max 2 retries):
```bash
gh pr checkout <PR_NUMBER>
# Fix issues, commit, push
git add -A && git commit -m "fix: address review feedback" && git push
```
→ Go back to Step 3

**rejected** (or 3rd retry):
```bash
gh pr close <PR_NUMBER> --comment "Closing after review rejection."
gh issue edit <ISSUE_NUMBER> --add-label "proposed" --remove-label "in-progress"
```

### Step 5: Release lock
```bash
python C:/Meastro/scripts/task_coordinator.py release dev_cycle
git checkout dev
```

### Rules
- One feature per cycle — never batch
- Max 2 review retries
- Always release the lock
- Never skip review
- Always target `dev` branch
