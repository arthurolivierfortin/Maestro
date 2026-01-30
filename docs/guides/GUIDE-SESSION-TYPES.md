# Guide: Maestro Session Types

## Overview

Maestro uses two types of sessions depending on the usage context:

| Type | Objective | Environment | Use Case |
|------|-----------|-------------|----------|
| **Foundry Session** | Forge, test, improve blocks | Isolated sandbox | Tool/agent development |
| **Project Session** | Execute workflows on a real project | Attached project | Real task automation |

---

## 1. Foundry Session (Workshop)

### Objective

A **Foundry Session** is used to **develop and validate** blocks (tools, agents, workflows) before publishing them to the catalog.

### Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│                    FOUNDRY SESSION                           │
├─────────────────────────────────────────────────────────────┤
│  Environment: Isolated sandbox (Docker/Process)              │
│  Objective: Forge and validate a block                       │
│  Data: Test/mock data                                        │
│  Risk: None (total isolation)                                │
│  Evaluation: Automatic (LLM) or manual                       │
│  Result: Block ready for publication                         │
└─────────────────────────────────────────────────────────────┘
```

### Typical Workflow

```
1. DRAFT      → Create or import a draft block
2. SESSION    → Configure and launch a training session
3. EXECUTE    → System executes N iterations
4. EVALUATE   → Each iteration is evaluated (auto or manual)
5. IMPROVE    → Apply improvement suggestions
6. ITERATE    → Repeat 2-5 until satisfied
7. PUBLISH    → Publish to the catalog
```

### CLI Commands

```bash
# Create a draft
maestro foundry draft create \
  --name "my-tool" \
  --type tool \
  --description "Tool description"

# Create a Foundry session
maestro foundry session create \
  --block my-tool \
  --iterations 30 \
  --parallel 3 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.8

# Start the session
maestro foundry session start <session-id> --wait

# View status
maestro foundry session status <session-id>

# Apply improvements
maestro foundry session improve <session-id> --apply-all

# Publish when satisfied
maestro foundry publish my-tool
```

### Evaluation Configuration

```json
{
  "evaluation": {
    "mode": "auto",
    "autoEvaluator": {
      "type": "llm",
      "modelId": "deepseek-coder",
      "criteria": [
        {"id": "correctness", "weight": 0.4},
        {"id": "quality", "weight": 0.3},
        {"id": "efficiency", "weight": 0.2},
        {"id": "reliability", "weight": 0.1}
      ],
      "passThreshold": 0.8
    }
  }
}
```

### Available Evaluation Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| `manual` | Human-only evaluation | Critical validation, new concepts |
| `auto` | Automatic LLM/Agent evaluation | Bulk training, CI/CD |
| `hybrid` | Auto by default + human if problem | Recommended for production |

### Complete Example

```bash
#!/bin/bash
# Forge a new tool

# 1. Create the draft
maestro foundry draft create \
  --name "code-analyzer" \
  --type tool \
  --from-file ./my-tool-definition.json

# 2. Session with auto-evaluation
SESSION=$(maestro foundry session create \
  --block code-analyzer \
  --iterations 50 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.85 \
  --input code="function test() { return 1; }" \
  --json | jq -r '.id')

# 3. Execute (fully automatic)
maestro foundry session start $SESSION --wait

# 4. Check the result
SCORE=$(maestro foundry session status $SESSION --json | jq '.metrics.avgScore')
echo "Final score: $SCORE"

# 5. If OK, publish
if (( $(echo "$SCORE >= 0.85" | bc -l) )); then
  maestro foundry publish code-analyzer
  echo "Published to catalog!"
fi
```

---

## 2. Project Session (Real Execution)

### Objective

A **Project Session** is used to **execute workflows on a real project**, with access to the file system and project resources.

### Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│                    PROJECT SESSION                           │
├─────────────────────────────────────────────────────────────┤
│  Environment: Real project (Git repo, files)                │
│  Objective: Automate tasks on the project                   │
│  Data: Real project data                                    │
│  Risk: Real modifications (with control)                    │
│  Evaluation: Optional (result validation)                   │
│  Result: Task accomplished on the project                   │
└─────────────────────────────────────────────────────────────┘
```

### Typical Workflow

```
1. SELECT     → Select an existing project
2. CONFIGURE  → Choose workflow and parameters
3. EXECUTE    → Execute the workflow on the project
4. VALIDATE   → Verify changes (git diff, tests)
5. COMMIT     → Commit if satisfied
```

### CLI Commands

```bash
# List projects
maestro projects

# Create/Open a project
maestro projects create --name "my-app" --path "C:/dev/my-app"
maestro projects open "C:/dev/my-app"

# Create a Project session
maestro project session create \
  --project my-app \
  --workflow code-developer \
  --task "Add a validation function"

# Execute
maestro project session start <session-id>

# View changes
maestro project session diff <session-id>

# Validate and commit
maestro project session commit <session-id> --message "feat: add validation"
```

### Access Levels

| Level | Description | Permissions |
|-------|-------------|-------------|
| `readonly` | Read-only | Analyze, read files |
| `sandbox` | Isolated modifications | Write to temporary copy |
| `controlled` | Modifications with validation | Write, but review before commit |
| `full` | Full access | Write and commit directly |

### Project Session Configuration

```json
{
  "type": "project",
  "projectId": "my-app",
  "workflow": "code-developer",
  "access": {
    "level": "controlled",
    "allowedPaths": ["src/**", "tests/**"],
    "deniedPaths": [".env", "secrets/**"],
    "requireApproval": ["*.config.js", "package.json"]
  },
  "execution": {
    "task": "Implement feature X",
    "context": "See JIRA-123 ticket",
    "maxSteps": 20,
    "timeout": 600000
  },
  "validation": {
    "runTests": true,
    "runLinter": true,
    "requireCleanDiff": false
  }
}
```

### Complete Example

```bash
#!/bin/bash
# Automate a task on a real project

PROJECT="my-app"
TASK="Add email validation to the signup form"

# 1. Create the session
SESSION=$(maestro project session create \
  --project $PROJECT \
  --workflow code-developer \
  --task "$TASK" \
  --access controlled \
  --run-tests \
  --json | jq -r '.id')

# 2. Execute
maestro project session start $SESSION --wait

# 3. View changes
echo "=== Changes made ==="
maestro project session diff $SESSION

# 4. Run tests
echo "=== Tests ==="
maestro project session test $SESSION

# 5. Ask for confirmation before commit
read -p "Commit these changes? (y/n) " confirm
if [ "$confirm" = "y" ]; then
  maestro project session commit $SESSION \
    --message "feat: add email validation to signup form"
  echo "Changes committed!"
fi
```

---

## 3. Detailed Comparison

### Comparison Table

| Aspect | Foundry Session | Project Session |
|--------|-----------------|-----------------|
| **Objective** | Develop/validate blocks | Execute on real project |
| **Environment** | Isolated sandbox | Attached project |
| **Data** | Test/Mock | Real |
| **Risk** | None | Controlled |
| **Iterations** | Multiple (training) | Generally one |
| **Evaluation** | Critical (scoring) | Optional (validation) |
| **Result** | Published block | Accomplished task |
| **Persistence** | Metrics and improvements | Git commits |

### When to Use Which?

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  "I want to create/improve a tool or agent"                 │
│                     │                                        │
│                     ▼                                        │
│            ┌───────────────┐                                │
│            │FOUNDRY SESSION│                                │
│            └───────────────┘                                │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  "I want to automate a task on my project"                  │
│                     │                                        │
│                     ▼                                        │
│            ┌───────────────┐                                │
│            │PROJECT SESSION│                                │
│            └───────────────┘                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Combined Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT                               │
│                                                              │
│  1. Foundry: Create an agent "feature-developer"            │
│  2. Foundry: Train with 100 iterations                      │
│  3. Foundry: Evaluate and improve                           │
│  4. Foundry: Publish to the catalog                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    USAGE                                     │
│                                                              │
│  5. Project: Open my project "my-app"                       │
│  6. Project: Use "feature-developer" from catalog           │
│  7. Project: Execute to add a feature                       │
│  8. Project: Validate and commit                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Architecture

### Unified Data Model

```typescript
interface Session {
  id: string;
  name: string;
  type: "foundry" | "project";
  status: SessionStatus;
  createdAt: DateTimeOffset;

  // Common
  workflowId: string;
  authority: AuthorityInfo;

  // Type-specific
  foundryConfig?: FoundrySessionConfig;
  projectConfig?: ProjectSessionConfig;

  // Results
  iterations: SessionIteration[];
  metrics?: SessionMetrics;
}

interface FoundrySessionConfig {
  iterations: number;
  parallel: number;
  evaluation: EvaluationConfig;
  inputs: Record<string, any>;
}

interface ProjectSessionConfig {
  projectId: string;
  task: string;
  access: AccessConfig;
  validation: ValidationConfig;
}
```

### API Endpoints

```
# Foundry Sessions
POST   /api/foundry/sessions              # Create
GET    /api/foundry/sessions              # List
GET    /api/foundry/sessions/{id}         # Details
POST   /api/foundry/sessions/{id}/start   # Start
POST   /api/foundry/sessions/{id}/improve # Improve
DELETE /api/foundry/sessions/{id}         # Delete

# Project Sessions
POST   /api/projects/{pid}/sessions              # Create
GET    /api/projects/{pid}/sessions              # List
GET    /api/projects/{pid}/sessions/{id}         # Details
POST   /api/projects/{pid}/sessions/{id}/start   # Start
GET    /api/projects/{pid}/sessions/{id}/diff    # View diff
POST   /api/projects/{pid}/sessions/{id}/commit  # Commit
DELETE /api/projects/{pid}/sessions/{id}         # Delete
```

---

## 5. Summary

| Session | Creation Command | Main Usage |
|---------|-----------------|------------|
| **Foundry** | `maestro foundry session create` | Forge blocks |
| **Project** | `maestro project session create` | Automate tasks |

### Simple Rule

- **Foundry** = Development workshop (sandbox)
- **Project** = Production execution (real)

---

## Related Documents

- [FOUNDRY-WORKFLOW.md](FOUNDRY-WORKFLOW.md) - Complete Foundry flow
- [GUIDE-AI-TRAINING-SESSIONS.md](GUIDE-AI-TRAINING-SESSIONS.md) - Training (will be merged into Foundry)
- [GUIDE-AI-TESTING-EVALUATION.md](GUIDE-AI-TESTING-EVALUATION.md) - Evaluation (will be merged into Foundry)
