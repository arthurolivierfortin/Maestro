# Project Session - Detailed Guide

## Overview

A **Project Session** allows executing workflows from the catalog on a **real project**, with access to the file system, Git integration, and access control.

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Environment** | Real project (Git repository) |
| **Access** | Configurable (ReadOnly → Full) |
| **Validation** | Tests, linter, review |
| **Persistence** | Git commits |
| **Risk** | Controlled by access level |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT SESSION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ SELECT   │ → │ EXECUTE  │ → │ VALIDATE │ → │  COMMIT  │     │
│  │ Workflow │   │ On Proj  │   │  Tests   │   │   Git    │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │              │               │              │           │
│       ▼              ▼               ▼              ▼           │
│   Catalog        Container      Test Runner     Git Commit      │
│   Query          Execution       Linter         Push (opt)      │
│                                                                  │
│  Access Control: ──────────────────────────────────────────     │
│  │ ReadOnly │ Sandbox │ Controlled │ Full │                    │
│  └──────────┴─────────┴────────────┴──────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Configured Maestro Project

```bash
# Check that the project exists
maestro projects

# If not, create or open
maestro projects create --name "my-app" --path "C:/dev/my-app"
# or
maestro projects open "C:/dev/my-app"
```

### 2. Workflow Available in Catalog

```bash
# Check published workflows
maestro foundry catalog --type workflow
maestro foundry catalog --type agent

# View details
maestro foundry catalog show code-developer
```

### 3. Active Services

```bash
# Check the system
maestro health
maestro llm
```

---

## Complete Commands

### Create a Session

```bash
maestro project session create [options]
```

#### Required Options

| Option | Description | Example |
|--------|-------------|---------|
| `--project <id>` | Project ID or name | `my-app` |
| `--workflow <id>` | Catalog workflow | `code-developer@1.0.0` |
| `--task <description>` | Task to accomplish | `"Add email validation"` |

#### Access Options

| Option | Description | Values |
|--------|-------------|--------|
| `--access <level>` | Access level | `readonly`, `sandbox`, `controlled`, `full` |
| `--allowed-paths <paths>` | Allowed paths | `"src/**,tests/**"` |
| `--denied-paths <paths>` | Denied paths | `".env,secrets/**"` |
| `--require-approval <paths>` | Paths requiring approval | `"package.json,*.config.js"` |

#### Execution Options

| Option | Description | Default |
|--------|-------------|---------|
| `--context <text>` | Additional context | - |
| `--max-steps <n>` | Maximum number of steps | `50` |
| `--timeout <ms>` | Timeout in ms | `600000` |

#### Validation Options

| Option | Description | Default |
|--------|-------------|---------|
| `--run-tests` | Run tests | `false` |
| `--test-command <cmd>` | Test command | `npm test` |
| `--run-linter` | Run linter | `false` |
| `--linter-command <cmd>` | Linter command | `npm run lint` |
| `--require-clean-diff` | Diff must be clean | `false` |

#### Output Options

| Option | Description |
|--------|-------------|
| `--json` | JSON output |
| `--quiet` | Minimal output |

### Creation Examples

```bash
# Basic session
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Add an email validation function"

# Session with access control
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Refactor the auth module" \
  --access controlled \
  --allowed-paths "src/auth/**,tests/auth/**" \
  --denied-paths ".env,secrets/**"

# Session with complete validation
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Implement pagination" \
  --context "Use cursor-based pagination, not offset" \
  --access controlled \
  --run-tests \
  --test-command "npm test -- --coverage" \
  --run-linter \
  --max-steps 30

# Session with specific workflow version
maestro project session create \
  --project my-app \
  --workflow code-developer@1.2.0 \
  --task "Optimize SQL queries"
```

---

### Start a Session

```bash
maestro project session start <session-id> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--wait` | Wait for completion |
| `--follow` | Follow logs in real-time |
| `--timeout <ms>` | Override timeout |

#### Examples

```bash
# Start and return immediately
maestro project session start sess-abc123

# Start and wait for completion
maestro project session start sess-abc123 --wait

# Start and follow logs
maestro project session start sess-abc123 --follow
```

---

### View Status

```bash
maestro project session status <session-id> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--json` | JSON output |
| `--watch` | Auto-refresh |

#### Example Output

```
Project Session: sess-abc123
Status: completed
Project: my-app
Workflow: code-developer@1.2.0
Task: Add an email validation function

Progress:
  Steps: 12/30
  Duration: 45.2s
  Files Modified: 3

Modified Files:
  • src/utils/validation.ts (created)
  • src/components/SignupForm.tsx (modified)
  • tests/utils/validation.test.ts (created)

Validation:
  Tests: ✓ Passed (12/12)
  Linter: ✓ Clean
```

---

### View Changes (Diff)

```bash
maestro project session diff <session-id> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--file <path>` | Specific file diff |
| `--stat` | Statistics only |
| `--unified <n>` | Context lines |
| `--color` | Syntax highlighting |

#### Examples

```bash
# View entire diff
maestro project session diff sess-abc123

# Statistics only
maestro project session diff sess-abc123 --stat

# Specific file diff
maestro project session diff sess-abc123 --file src/utils/validation.ts
```

#### Example Output

```diff
diff --git a/src/utils/validation.ts b/src/utils/validation.ts
new file mode 100644
--- /dev/null
+++ b/src/utils/validation.ts
@@ -0,0 +1,15 @@
+export function validateEmail(email: string): boolean {
+  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
+  return regex.test(email);
+}
+
+export function validatePassword(password: string): boolean {
+  return password.length >= 8;
+}
```

---

### Run Tests

```bash
maestro project session test <session-id> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--command <cmd>` | Override test command |
| `--coverage` | Include coverage |
| `--verbose` | Detailed output |

#### Examples

```bash
# Standard tests
maestro project session test sess-abc123

# With custom command
maestro project session test sess-abc123 --command "npm test -- --coverage"

# Verbose mode
maestro project session test sess-abc123 --verbose
```

#### Example Output

```
Running tests for session sess-abc123...

Command: npm test

 PASS  tests/utils/validation.test.ts
  ✓ validateEmail returns true for valid email (3ms)
  ✓ validateEmail returns false for invalid email (1ms)
  ✓ validatePassword returns true for valid password (1ms)
  ✓ validatePassword returns false for short password (1ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Time:        1.234s

Result: ✓ All tests passed
```

---

### Commit Changes

```bash
maestro project session commit <session-id> [options]
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--message <msg>` | Commit message | `"feat: add email validation"` |
| `--type <type>` | Conventional type | `feat`, `fix`, `refactor`, etc. |
| `--scope <scope>` | Commit scope | `auth`, `api`, etc. |
| `--push` | Push after commit | - |
| `--branch <name>` | Target branch | `feature/validation` |
| `--force` | Force even if tests fail | - |

#### Examples

```bash
# Simple commit
maestro project session commit sess-abc123 \
  --message "feat: add email validation"

# Commit with type and scope
maestro project session commit sess-abc123 \
  --type feat \
  --scope auth \
  --message "add email validation to signup form"

# Commit and push
maestro project session commit sess-abc123 \
  --message "feat: add validation" \
  --push

# Commit on a new branch
maestro project session commit sess-abc123 \
  --branch feature/email-validation \
  --message "feat: add email validation" \
  --push
```

#### Example Output

```
Committing changes for session sess-abc123...

Files to commit:
  A  src/utils/validation.ts
  M  src/components/SignupForm.tsx
  A  tests/utils/validation.test.ts

Commit: abc1234
Author: Maestro Agent <maestro@local>
Message: feat(auth): add email validation to signup form

✓ Committed successfully
```

---

### Cancel a Session

```bash
maestro project session cancel <session-id> [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--discard` | Delete changes |
| `--keep` | Keep uncommitted changes |

#### Examples

```bash
# Cancel and delete changes
maestro project session cancel sess-abc123 --discard

# Cancel but keep changes
maestro project session cancel sess-abc123 --keep
```

---

### List Sessions

```bash
maestro project session list [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--project <id>` | Filter by project |
| `--status <status>` | Filter by status |
| `--workflow <id>` | Filter by workflow |
| `--limit <n>` | Max number of results |
| `--json` | JSON output |

#### Examples

```bash
# All project sessions
maestro project session list --project my-app

# Running sessions
maestro project session list --project my-app --status running

# Recent sessions with specific workflow
maestro project session list --workflow code-developer --limit 10
```

---

## Detailed Access Levels

### ReadOnly

```bash
maestro project session create \
  --project my-app \
  --workflow analyzer \
  --task "Analyze code structure" \
  --access readonly
```

| Permission | Allowed |
|------------|---------|
| Read files | ✓ |
| Write files | ✗ |
| Execute commands | Limited (read-only) |
| Create commit | ✗ |

**Use case**: Analysis, audit, documentation

### Sandbox

```bash
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Test a refactoring" \
  --access sandbox
```

| Permission | Allowed |
|------------|---------|
| Read files | ✓ (original project) |
| Write files | ✓ (temporary copy) |
| Execute commands | ✓ (in sandbox) |
| Create commit | ✗ |

**Use case**: Experimentation, risky tests

### Controlled (Recommended)

```bash
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Add feature" \
  --access controlled \
  --run-tests
```

| Permission | Allowed |
|------------|---------|
| Read files | ✓ |
| Write files | ✓ (with restrictions) |
| Execute commands | ✓ |
| Create commit | ✓ (after validation) |

**Use case**: Normal development with review

### Full

```bash
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Urgent fix" \
  --access full
```

| Permission | Allowed |
|------------|---------|
| Read files | ✓ |
| Write files | ✓ (without restriction) |
| Execute commands | ✓ |
| Create commit | ✓ (direct) |

**Use case**: Hotfix, CI/CD automation (with caution!)

---

## Complete Workflows

### Standard Workflow: Feature Development

```bash
#!/bin/bash
# develop-feature.sh

PROJECT="my-app"
WORKFLOW="code-developer"
TASK="$1"
BRANCH="feature/$(echo $TASK | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"

# 1. Create the session
echo "Creating session..."
SESSION=$(maestro project session create \
  --project $PROJECT \
  --workflow $WORKFLOW \
  --task "$TASK" \
  --access controlled \
  --run-tests \
  --json | jq -r '.id')

echo "Session: $SESSION"

# 2. Execute
echo "Executing..."
maestro project session start $SESSION --wait

# 3. Check status
STATUS=$(maestro project session status $SESSION --json | jq -r '.status')
if [ "$STATUS" != "completed" ]; then
  echo "Session failed: $STATUS"
  exit 1
fi

# 4. View diff
echo "Changes:"
maestro project session diff $SESSION --stat

# 5. Run tests
echo "Running tests..."
maestro project session test $SESSION

# 6. Ask for confirmation
read -p "Commit these changes? (y/n) " confirm
if [ "$confirm" != "y" ]; then
  echo "Cancelled"
  maestro project session cancel $SESSION --discard
  exit 0
fi

# 7. Commit on a branch
echo "Committing..."
maestro project session commit $SESSION \
  --branch $BRANCH \
  --message "feat: $TASK" \
  --push

echo "Done! Branch: $BRANCH"
```

**Usage:**
```bash
./develop-feature.sh "Add email validation to signup form"
```

### Automated Workflow: CI/CD

```bash
#!/bin/bash
# ci-auto-fix.sh

PROJECT="$1"
TASK="$2"

# Create and execute in full mode for CI
SESSION=$(maestro project session create \
  --project $PROJECT \
  --workflow code-fixer \
  --task "$TASK" \
  --access full \
  --run-tests \
  --require-clean-diff \
  --json | jq -r '.id')

maestro project session start $SESSION --wait

# Check success
STATUS=$(maestro project session status $SESSION --json | jq -r '.status')
TESTS=$(maestro project session status $SESSION --json | jq -r '.validation.testsPass')

if [ "$STATUS" = "completed" ] && [ "$TESTS" = "true" ]; then
  maestro project session commit $SESSION \
    --message "fix: $TASK [auto]" \
    --push
  echo "SUCCESS"
  exit 0
else
  echo "FAILED"
  exit 1
fi
```

### Review Workflow: Code Analysis

```bash
#!/bin/bash
# analyze-code.sh

PROJECT="$1"
FOCUS="${2:-src/}"

# Readonly session for analysis
SESSION=$(maestro project session create \
  --project $PROJECT \
  --workflow code-analyzer \
  --task "Analyze code quality and suggest improvements" \
  --context "Focus on: $FOCUS" \
  --access readonly \
  --json | jq -r '.id')

maestro project session start $SESSION --wait

# Display the report
maestro project session status $SESSION
```

---

## Best Practices

### 1. Always Use `--access controlled`

```bash
# GOOD ✓
--access controlled

# RISKY ✗
--access full  # Only if really necessary
```

### 2. Always Enable Tests

```bash
# GOOD ✓
--run-tests --test-command "npm test"

# RISKY ✗
# No tests = unvalidated changes
```

### 3. Restrict Paths

```bash
# GOOD ✓
--allowed-paths "src/feature/**" --denied-paths ".env,secrets/**"

# RISKY ✗
# No restriction = access to everything
```

### 4. Use Branches

```bash
# GOOD ✓
maestro project session commit $SESSION \
  --branch feature/my-feature \
  --push

# RISKY ✗
# Direct commit on main
```

### 5. Review Before Commit

```bash
# GOOD ✓
maestro project session diff $SESSION
maestro project session test $SESSION
# ... review ...
maestro project session commit $SESSION

# RISKY ✗
# Automatic commit without review
```

---

## Troubleshooting

### Session fails immediately

```bash
# Check the workflow
maestro foundry catalog show <workflow-id>

# Check the project
maestro projects info <project-id>

# Check permissions
maestro project session status <session-id> --json
```

### Access denied to a file

```bash
# Check allowed-paths and denied-paths
maestro project session status <session-id> --json | jq '.config.access'

# Recreate with correct paths
maestro project session create \
  --allowed-paths "path/to/file/**"
```

### Tests fail

```bash
# View test details
maestro project session test <session-id> --verbose

# Check the test command
maestro project session status <session-id> --json | jq '.config.validation'
```

### Commit refused

```bash
# Check validations
maestro project session status <session-id> --json | jq '.validation'

# If tests required but failed
maestro project session test <session-id>

# Force if necessary (with caution!)
maestro project session commit <session-id> --force
```

---

## Quick Reference

```bash
# === CREATION ===
maestro project session create \
  --project <id> \
  --workflow <id> \
  --task "<description>" \
  [--access <level>] \
  [--run-tests] \
  [--context "<context>"]

# === EXECUTION ===
maestro project session start <id> [--wait] [--follow]
maestro project session status <id>
maestro project session cancel <id> [--discard]

# === REVIEW ===
maestro project session diff <id> [--stat]
maestro project session test <id> [--verbose]

# === COMMIT ===
maestro project session commit <id> \
  --message "<msg>" \
  [--branch <name>] \
  [--push]

# === LISTING ===
maestro project session list [--project <id>] [--status <status>]
```

---

## Related Documents

- [GUIDE-SESSION-TYPES.md](GUIDE-SESSION-TYPES.md) - Foundry vs Project comparison
- [FOUNDRY-DETAILED-GUIDE.md](FOUNDRY-DETAILED-GUIDE.md) - Foundry Guide
- [FULL-PIPELINE-GUIDE.md](FULL-PIPELINE-GUIDE.md) - Complete pipeline
