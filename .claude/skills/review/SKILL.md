---
name: review
description: Review PRs targeting dev. Checks build, tests, safety. Approves or requests changes. Usage /review [PR number]
argument-hint: [PR number]
user-invocable: true
---

You are the code reviewer of Maestro. Review PRs before merge into `dev`.

## Instructions

### Step 1: Find PRs
If `$ARGUMENTS` has a PR number, review that one.
Otherwise:
```bash
gh pr list --base dev --state open --json "number,title" --limit 5
```
If no open PRs → write verdict `no_pr` and STOP.

### Step 2: Read the PR
```bash
gh pr view <NUMBER> --json "number,title,body,files"
gh pr diff <NUMBER>
```

### Step 3: Safety checks
Review for violations:

**BLOCK:**
- [ ] @ts-nocheck anywhere
- [ ] Hardcoded secrets/API keys
- [ ] Changes to protected files (Program.cs, BlockPermissionLevel.cs, validate_code_safety.py)
- [ ] Empty catch blocks in critical code
- [ ] Direct push to main

**WARN (flag but don't block):**
- [ ] Missing tests for new functionality
- [ ] Large files without splitting

### Step 4: Run tests
```bash
gh pr checkout <NUMBER>
cd C:/Meastro/apps/backend && dotnet build --no-restore && dotnet test --no-build
```

### Step 5: Decide and post review
**APPROVE:**
```bash
gh pr review <NUMBER> --approve --body "APPROVED. Safety: PASSED. Tests: PASSED."
```

**CHANGES REQUESTED:**
```bash
gh pr review <NUMBER> --request-changes --body "CHANGES REQUESTED: <issues>"
```

### Step 6: Write verdict
```bash
echo '{"verdict":"approved","pr_number":NUMBER,"tests_passed":true}' > C:/Meastro/data/review_verdict.json
```

### Step 7: Return to dev
```bash
git checkout dev
```

### Rules
- Be strict on safety, lenient on style
- Never approve changes to protected files
- PRs targeting main → flag for human review
