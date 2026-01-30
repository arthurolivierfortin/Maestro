# Understanding the Maestro Session System (v2)

## Document Purpose

This document captures the understanding of Maestro's unified session architecture, centered around **Foundry** for block development and **Project Sessions** for real-world execution.

---

## 1. The Core Vision

Maestro is an **AI workflow optimization platform** where:

> **Every block (tool, agent, workflow) is forged through iterative execution, evaluation, and improvement before being published for production use.**

### Key Insight

The previous separation of "Training" and "Testing" was artificial. Both are really the same thing:
- Execute a block multiple times
- Evaluate the quality of outputs
- Improve based on feedback
- Repeat until satisfied

This is now unified as **Foundry Sessions**.

---

## 2. Two Session Types

| Type | Purpose | Environment | Outcome |
|------|---------|-------------|---------|
| **Foundry Session** | Forge and validate blocks | Sandbox (isolated) | Published block in catalog |
| **Project Session** | Execute on real projects | Project (attached) | Task completed, code committed |

### Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FOUNDRY                                  │
│                   (Development Workshop)                         │
│                                                                  │
│  ┌─────────┐   ┌─────────────┐   ┌─────────┐   ┌─────────────┐ │
│  │  DRAFT  │──►│   SESSION   │──►│ IMPROVE │──►│   PUBLISH   │ │
│  │ (Create)│   │(Execute+Eval)│   │(Iterate)│   │ (Catalog)   │ │
│  └─────────┘   └─────────────┘   └─────────┘   └─────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Use published blocks
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT SESSION                             │
│                   (Production Execution)                         │
│                                                                  │
│  ┌─────────┐   ┌─────────────┐   ┌─────────┐   ┌─────────────┐ │
│  │ SELECT  │──►│   EXECUTE   │──►│ VALIDATE│──►│   COMMIT    │ │
│  │(Workflow)│   │  (On Project)│   │ (Tests) │   │  (Git)     │ │
│  └─────────┘   └─────────────┘   └─────────┘   └─────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Foundry Sessions

### What is Foundry?

Foundry is the **workshop** where blocks are:
1. **Created** as drafts
2. **Forged** through sessions (execution + evaluation)
3. **Improved** based on feedback
4. **Published** to the catalog when ready

### The Forging Process

```
┌─────────────────────────────────────────────────────────────┐
│                    FOUNDRY SESSION                           │
│                                                              │
│  Configuration (set at creation):                           │
│  ├── iterations: 50                                         │
│  ├── parallel: 3                                            │
│  ├── evaluation:                                            │
│  │   ├── mode: "auto"                                       │
│  │   ├── evaluator: "deepseek-coder"                        │
│  │   └── threshold: 0.8                                     │
│  └── inputs: { ... }                                        │
│                                                              │
│  Execution (automatic):                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  For each iteration:                                  │  │
│  │    1. Execute workflow with inputs                    │  │
│  │    2. Capture outputs and metrics                     │  │
│  │    3. Auto-evaluate (LLM scores the output)          │  │
│  │    4. Store results                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Results:                                                   │
│  ├── Aggregate metrics (avg score, success rate)           │
│  ├── Improvement suggestions (generated automatically)      │
│  └── Ready for publish if score >= threshold               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Evaluation Modes

| Mode | How it Works | When to Use |
|------|-------------|-------------|
| **Auto** | LLM/Agent evaluates each iteration automatically | Bulk training, CI/CD |
| **Manual** | Human evaluates each iteration | Critical validation |
| **Hybrid** | Auto by default, human if score low or error | Production recommended |

### Key Feature: Evaluation at Creation

The evaluation strategy is configured **when creating the session**, not after:

```bash
maestro foundry session create \
  --draft my-tool \
  --iterations 50 \
  --eval-mode auto \           # ← Configured upfront
  --eval-model deepseek \      # ← Which model evaluates
  --eval-threshold 0.8         # ← Pass threshold

maestro foundry session start <session-id>
# Everything runs automatically - no manual intervention needed!
```

---

## 4. Project Sessions

### What is a Project Session?

A Project Session executes a workflow from the catalog **on a real project**, with:
- Access to the actual file system
- Git integration for commits
- Validation (tests, linter)

### The Execution Process

```
┌─────────────────────────────────────────────────────────────┐
│                    PROJECT SESSION                           │
│                                                              │
│  Configuration:                                             │
│  ├── projectId: "my-app"                                    │
│  ├── workflow: "code-developer@1.2.0"  (from catalog)       │
│  ├── task: "Add email validation to signup form"           │
│  ├── access:                                                │
│  │   ├── level: "controlled"                                │
│  │   ├── allowed: ["src/**", "tests/**"]                    │
│  │   └── denied: [".env", "secrets/**"]                     │
│  └── validation:                                            │
│      ├── runTests: true                                     │
│      └── testCommand: "npm test"                            │
│                                                              │
│  Execution:                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Load workflow from catalog                        │  │
│  │  2. Execute in project context                        │  │
│  │  3. Track all file modifications                      │  │
│  │  4. Run validation (tests)                            │  │
│  │  5. Present diff for review                           │  │
│  │  6. Commit if approved                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Access Levels

| Level | Can Read | Can Write | Commit |
|-------|----------|-----------|--------|
| **ReadOnly** | Yes | No | No |
| **Sandbox** | Yes | Temp copy | No |
| **Controlled** | Yes | Yes | After review |
| **Full** | Yes | Yes | Direct |

---

## 5. The Authority Model

### Who Can Drive Sessions?

| Authority | Description | Typical Actions |
|-----------|-------------|-----------------|
| **Human** | User via UI or CLI | Create, evaluate, approve, publish |
| **Maestro Agent** | Internal autonomous agent | Execute, auto-evaluate |
| **External AI** | Claude Code, GPT, etc. | Full automation via CLI |

### Multi-Authority Example

```
Foundry Session "Optimize Code Generator"
├── Created by: Human (via UI)
├── Executed by: System (automatic)
├── Evaluated by: LLM (deepseek-coder, configured at creation)
├── Reviewed by: External AI (Claude Code, for flagged iterations)
└── Published by: Human (final approval)
```

---

## 6. The Complete Workflow

### Developing a New Tool

```bash
# 1. CREATE DRAFT
maestro foundry draft create \
  --name "code-extractor" \
  --type tool

# 2. CONFIGURE AND START SESSION
maestro foundry session create \
  --draft code-extractor \
  --iterations 30 \
  --eval-mode auto \
  --eval-model deepseek-coder \
  --eval-threshold 0.8

maestro foundry session start <session-id> --wait

# 3. CHECK RESULTS
maestro foundry session metrics <session-id>

# 4. IF SCORE < THRESHOLD, IMPROVE AND RETRY
maestro foundry session improve <session-id> --apply-all
# Go back to step 2

# 5. WHEN SATISFIED, PUBLISH
maestro foundry publish code-extractor --version 1.0.0
```

### Using the Tool in Production

```bash
# 1. CREATE PROJECT SESSION
maestro project session create \
  --project my-app \
  --workflow code-extractor@1.0.0 \
  --task "Extract code from documentation"

# 2. EXECUTE
maestro project session start <session-id> --wait

# 3. REVIEW CHANGES
maestro project session diff <session-id>

# 4. RUN TESTS
maestro project session test <session-id>

# 5. COMMIT
maestro project session commit <session-id> \
  --message "feat: extract code examples from docs"
```

---

## 7. Data Model Summary

### Session Entity

```
Session
├── id, name, type (Foundry/Project)
├── status (Created/Running/Completed/...)
├── blockId (target block)
├── createdBy (Authority)
│
├── foundryConfig (if type=Foundry)
│   ├── iterations, parallel, delayMs
│   ├── inputs
│   └── evaluation
│       ├── mode (Auto/Manual/Hybrid)
│       ├── autoEvaluator
│       │   ├── type (LLM/Agent/Heuristic)
│       │   ├── modelId or agentId
│       │   ├── criteria
│       │   └── passThreshold
│       └── humanReviewTrigger (for Hybrid)
│
├── projectConfig (if type=Project)
│   ├── projectId, task
│   ├── access (level, paths)
│   └── validation (tests, linter)
│
├── iterations[]
│   ├── inputs, outputs
│   ├── metrics
│   ├── evaluation (score, criteria)
│   └── needsHumanReview
│
└── metrics (aggregate)
```

### Draft Entity (Foundry-specific)

```
Draft
├── id, name, type (tool/agent/workflow)
├── status (draft/forging/validated/published)
├── version
├── definition (block JSON)
├── sessions[] (history)
├── currentScore
└── improvements[]
```

---

## 8. Key Differences from Old System

| Aspect | Old (Training + Testing) | New (Foundry + Project) |
|--------|-------------------------|-------------------------|
| Concepts | Two separate systems | Two session types |
| Evaluation | Manual call after run | Configured at creation |
| Automation | Partial | Full (no intervention needed) |
| Publication | Not integrated | Built-in workflow |
| Production use | Separate execute command | Project Sessions |

---

## 9. CLI Reference

### Foundry Commands

```bash
# Drafts
maestro foundry draft create/list/show/edit/delete/ready

# Sessions
maestro foundry session create/start/status/metrics
maestro foundry session pause/resume/cancel
maestro foundry session pending/evaluate
maestro foundry session improvements/improve
maestro foundry session compare

# Publication
maestro foundry publish/unpublish/versions
maestro foundry catalog/search
```

### Project Session Commands

```bash
maestro project session create/start/status
maestro project session diff/test/commit/cancel
```

---

## 10. Summary

The unified session system provides:

1. **Foundry Sessions** - Complete development workflow for blocks
   - Draft → Forge → Improve → Publish

2. **Project Sessions** - Production execution on real projects
   - Select → Execute → Validate → Commit

3. **Evaluation at Creation** - No manual intervention for happy path

4. **Full Automation** - External AIs can drive the entire workflow via CLI

5. **Clear Separation** - Development (Foundry) vs Production (Project)

---

## Documents Connexes

- [FOUNDRY-WORKFLOW.md](FOUNDRY-WORKFLOW.md) - Guide complet Foundry
- [SESSION-SYSTEM-ARCHITECTURE-PROPOSAL.md](SESSION-SYSTEM-ARCHITECTURE-PROPOSAL.md) - Architecture technique
- [guides/GUIDE-SESSION-TYPES.md](guides/GUIDE-SESSION-TYPES.md) - Comparaison des types de sessions
- [issues/phase-10-unified-session-system.md](issues/phase-10-unified-session-system.md) - Plan d'implémentation
