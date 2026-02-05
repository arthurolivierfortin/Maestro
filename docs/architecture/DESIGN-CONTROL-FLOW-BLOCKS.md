# Design Document: Control Flow Blocks Architecture

**Date**: February 4, 2026
**Status**: Approved
**Scope**: Workflow Control Flow Model

---

## 1. Executive Summary

This document defines how Maestro handles control flow (conditions, loops, parallelism) in workflows. The core principle is radical simplicity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   CONDITIONS, LOOPS, AND PARALLELISM ARE BLOCKS, NOT ARROWS.                │
│                                                                              │
│   Like in code:                                                              │
│   • if    is an instruction  →  If block                                    │
│   • for   is an instruction  →  ForEach block                               │
│   • while is an instruction  →  While block                                 │
│   • parallel is an instruction  →  Parallel block                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fundamental Principle

### 2.1 The Golden Rule

> **A workflow reads top-to-bottom like code.**
> **Depth = structure.**
> **Vertical order = time.**

This rule must NEVER be broken. It ensures:
- Readability at any scale
- Clean Git diffs
- CLI-friendly representation
- LLM-friendly reasoning
- Simple execution model

### 2.2 Why NOT Graphs?

| Aspect | Free-Form Graphs | Hierarchical Tree (Chosen) |
|--------|------------------|---------------------------|
| Readability | Spaghetti at scale | Always linear |
| Versioning | Impossible to diff | Clean JSON/YAML diffs |
| CLI editing | Not possible | Natural |
| LLM reasoning | Confusing | Perfect |
| Execution | Complex state machine | Simple recursion |
| Debugging | Hard to trace | Clear path |

---

## 3. Control Flow Blocks

### 3.1 Decision Block (If/Else)

#### Visual Representation

```
▶ Workflow: Release Pipeline
   │
   ├─ ▶ Workflow: Build
   │
   ├─ ▶ If: Build success?
   │    │
   │    ├─ Then
   │    │    └─ ▶ Workflow: Test
   │    │
   │    └─ Else
   │         └─ ▶ Command: notify failure
   │
   └─ ▶ Workflow: Publish
```

#### Block Definition

```json
{
  "id": "decision",
  "name": "Decision",
  "blockType": "decision",
  "isAtomic": false,
  "description": "Conditional branching. Evaluates a condition and executes either 'then' or 'else' branch.",

  "config": {
    "condition": {
      "type": "expression",
      "description": "Expression that evaluates to boolean",
      "examples": [
        "build.status == 'success'",
        "coverage >= 80",
        "errors.length == 0"
      ]
    }
  },

  "children": {
    "then": {
      "type": "branch",
      "required": true,
      "description": "Blocks to execute if condition is true"
    },
    "else": {
      "type": "branch",
      "required": false,
      "description": "Blocks to execute if condition is false"
    }
  },

  "outputs": {
    "branchTaken": {
      "type": "string",
      "enum": ["then", "else"],
      "description": "Which branch was executed"
    },
    "result": {
      "type": "any",
      "description": "Output from the executed branch"
    }
  }
}
```

#### Example Instance

```json
{
  "id": "check-build-success",
  "blockType": "decision",
  "name": "Build success?",
  "config": {
    "condition": "blocks.build.outputs.exitCode == 0"
  },
  "children": {
    "then": [
      { "ref": "run-tests" }
    ],
    "else": [
      { "ref": "notify-failure" }
    ]
  }
}
```

---

### 3.2 Retry Block

#### Visual Representation

```
▶ Retry (max: 3, delay: 5s)
   │
   └─ ▶ Workflow: Flaky Test
        ├─ Command: npm test
        └─ Validator: all tests pass
```

#### Block Definition

```json
{
  "id": "retry",
  "name": "Retry",
  "blockType": "retry",
  "isAtomic": false,
  "description": "Retries child blocks on failure, up to a maximum number of attempts.",

  "config": {
    "maxAttempts": {
      "type": "number",
      "default": 3,
      "description": "Maximum number of retry attempts"
    },
    "delayMs": {
      "type": "number",
      "default": 1000,
      "description": "Delay between retries in milliseconds"
    },
    "backoffMultiplier": {
      "type": "number",
      "default": 1,
      "description": "Multiplier for exponential backoff (1 = no backoff)"
    },
    "retryOn": {
      "type": "array",
      "items": "string",
      "default": ["error", "failure"],
      "description": "Conditions that trigger a retry"
    }
  },

  "children": {
    "body": {
      "type": "sequence",
      "required": true,
      "description": "Blocks to execute (and potentially retry)"
    },
    "onExhausted": {
      "type": "sequence",
      "required": false,
      "description": "Blocks to execute if all retries fail"
    }
  },

  "outputs": {
    "attempts": {
      "type": "number",
      "description": "Number of attempts made"
    },
    "succeeded": {
      "type": "boolean",
      "description": "Whether any attempt succeeded"
    },
    "lastError": {
      "type": "string",
      "description": "Error from the last failed attempt"
    }
  }
}
```

---

### 3.3 While Block

#### Visual Representation

```
▶ While: coverage < 90%
   │
   └─ ▶ Workflow: Improve Tests
        ├─ Agent: test improver
        └─ Command: npm test --coverage
```

#### Block Definition

```json
{
  "id": "while",
  "name": "While Loop",
  "blockType": "while",
  "isAtomic": false,
  "description": "Repeats child blocks while a condition remains true.",

  "config": {
    "condition": {
      "type": "expression",
      "description": "Loop continues while this evaluates to true"
    },
    "maxIterations": {
      "type": "number",
      "default": 100,
      "description": "Safety limit to prevent infinite loops"
    },
    "evaluateFirst": {
      "type": "boolean",
      "default": true,
      "description": "If true, check condition before first iteration (while). If false, execute once first (do-while)."
    }
  },

  "children": {
    "body": {
      "type": "sequence",
      "required": true,
      "description": "Blocks to execute each iteration"
    }
  },

  "outputs": {
    "iterations": {
      "type": "number",
      "description": "Number of iterations completed"
    },
    "exitReason": {
      "type": "string",
      "enum": ["condition_false", "max_iterations", "break", "error"],
      "description": "Why the loop terminated"
    }
  }
}
```

---

### 3.4 ForEach Block

#### Visual Representation

```
▶ ForEach: package in packages
   │
   └─ ▶ Workflow: Build Package
        └─ Command: npm build --workspace={package.name}
```

#### Block Definition

```json
{
  "id": "foreach",
  "name": "For Each",
  "blockType": "foreach",
  "isAtomic": false,
  "description": "Iterates over a collection, executing child blocks for each item.",

  "config": {
    "collection": {
      "type": "expression",
      "description": "Expression that evaluates to an array"
    },
    "itemVariable": {
      "type": "string",
      "default": "item",
      "description": "Variable name for the current item"
    },
    "indexVariable": {
      "type": "string",
      "default": "index",
      "description": "Variable name for the current index"
    },
    "parallel": {
      "type": "boolean",
      "default": false,
      "description": "If true, process items in parallel"
    },
    "maxConcurrency": {
      "type": "number",
      "default": 5,
      "description": "Maximum parallel executions (when parallel=true)"
    }
  },

  "children": {
    "body": {
      "type": "sequence",
      "required": true,
      "description": "Blocks to execute for each item"
    }
  },

  "outputs": {
    "results": {
      "type": "array",
      "description": "Array of results from each iteration"
    },
    "itemsProcessed": {
      "type": "number",
      "description": "Number of items successfully processed"
    },
    "failures": {
      "type": "array",
      "description": "Array of failed items and their errors"
    }
  }
}
```

---

### 3.5 Parallel Block

#### Visual Representation

```
▶ Parallel
   │
   ├─ ▶ Workflow: Lint
   ├─ ▶ Workflow: Unit Tests
   └─ ▶ Workflow: Integration Tests

▶ Join (waitFor: all)
```

#### Block Definition

```json
{
  "id": "parallel",
  "name": "Parallel",
  "blockType": "parallel",
  "isAtomic": false,
  "description": "Executes child blocks concurrently.",

  "config": {
    "waitFor": {
      "type": "string",
      "enum": ["all", "any", "none"],
      "default": "all",
      "description": "all=wait for all, any=wait for first success, none=fire and forget"
    },
    "failFast": {
      "type": "boolean",
      "default": false,
      "description": "If true, cancel remaining branches on first failure"
    },
    "maxConcurrency": {
      "type": "number",
      "default": null,
      "description": "Limit concurrent executions (null=unlimited)"
    },
    "timeout": {
      "type": "number",
      "default": null,
      "description": "Timeout in milliseconds for all branches"
    }
  },

  "children": {
    "branches": {
      "type": "parallel-branches",
      "required": true,
      "description": "Blocks to execute in parallel"
    }
  },

  "outputs": {
    "results": {
      "type": "object",
      "description": "Map of branch ID to result"
    },
    "completed": {
      "type": "array",
      "description": "IDs of branches that completed successfully"
    },
    "failed": {
      "type": "array",
      "description": "IDs of branches that failed"
    },
    "cancelled": {
      "type": "array",
      "description": "IDs of branches that were cancelled"
    }
  }
}
```

---

## 4. Execution Visualization

During execution, the tree shows real-time status:

### 4.1 Decision Execution

```
▶ If: build.ok                    [✓ evaluated: true]
   │
   ├─ Then                        [✓ executed]
   │    └─ ▶ Workflow: Test       [✓ completed]
   │
   └─ Else                        [◼ skipped]
        └─ ▶ Command: notify      [◼ skipped]
```

### 4.2 Retry Execution

```
▶ Retry (max: 3)                  [⟳ attempt 2/3]
   │
   └─ ▶ Workflow: Flaky Test
        ├─ Command: npm test      [✗ failed]      ← attempt 1
        ├─ Command: npm test      [⟳ running]     ← attempt 2
        └─ Validator: pass        [◯ pending]
```

### 4.3 Parallel Execution

```
▶ Parallel                        [⟳ 2/3 complete]
   │
   ├─ ▶ Workflow: Lint            [✓ 12s]
   ├─ ▶ Workflow: Unit Tests      [✓ 45s]
   └─ ▶ Workflow: Integration     [⟳ running 30s...]

▶ Join                            [◯ waiting]
```

### 4.4 Status Icons

| Icon | Status |
|------|--------|
| `◯` | Pending |
| `⟳` | Running |
| `✓` | Success |
| `✗` | Failed |
| `◼` | Skipped |
| `⊘` | Cancelled |

---

## 5. Complex Example

### 5.1 CI/CD Pipeline

```
▶ Workflow: CI/CD Pipeline
   │
   ├─ ▶ Parallel
   │    ├─ ▶ Workflow: Lint
   │    ├─ ▶ Workflow: Type Check
   │    └─ ▶ Workflow: Security Scan
   │
   ├─ ▶ If: all checks passed
   │    │
   │    ├─ Then
   │    │    │
   │    │    ├─ ▶ Retry (max: 2)
   │    │    │    └─ ▶ Workflow: Unit Tests
   │    │    │
   │    │    └─ ▶ If: branch == 'main'
   │    │         │
   │    │         ├─ Then
   │    │         │    ├─ ▶ Workflow: Integration Tests
   │    │         │    └─ ▶ Workflow: Deploy Staging
   │    │         │
   │    │         └─ Else
   │    │              └─ ▶ Command: echo "PR build complete"
   │    │
   │    └─ Else
   │         └─ ▶ Workflow: Notify Failure
   │
   └─ ▶ Command: cleanup
```

### 5.2 Equivalent JSON

```json
{
  "id": "cicd-pipeline",
  "blockType": "workflow",
  "name": "CI/CD Pipeline",
  "children": [
    {
      "id": "parallel-checks",
      "blockType": "parallel",
      "config": { "waitFor": "all", "failFast": true },
      "children": {
        "branches": [
          { "ref": "lint-workflow" },
          { "ref": "typecheck-workflow" },
          { "ref": "security-scan-workflow" }
        ]
      }
    },
    {
      "id": "check-results",
      "blockType": "decision",
      "config": {
        "condition": "blocks['parallel-checks'].outputs.failed.length == 0"
      },
      "children": {
        "then": [
          {
            "id": "retry-tests",
            "blockType": "retry",
            "config": { "maxAttempts": 2 },
            "children": {
              "body": [{ "ref": "unit-tests-workflow" }]
            }
          },
          {
            "id": "check-branch",
            "blockType": "decision",
            "config": { "condition": "context.branch == 'main'" },
            "children": {
              "then": [
                { "ref": "integration-tests-workflow" },
                { "ref": "deploy-staging-workflow" }
              ],
              "else": [
                {
                  "blockType": "command",
                  "config": { "command": "echo 'PR build complete'" }
                }
              ]
            }
          }
        ],
        "else": [
          { "ref": "notify-failure-workflow" }
        ]
      }
    },
    {
      "blockType": "command",
      "config": { "command": "cleanup" }
    }
  ]
}
```

### 5.3 Agent Improvement Loop with Validator

This pattern is fundamental for agent training and iterative quality improvement.

#### Visual Representation

```
▶ While: quality < threshold
   │
   └─ ▶ Workflow: Improve Solution
        ├─ Agent: code-writer
        └─ Validator: quality-check
```

#### Detailed Execution Flow

```
▶ Workflow: Iterative Code Improvement
   │
   ├─ ▶ Prompt: initial-task
   │    "Write a function that calculates fibonacci"
   │
   ├─ ▶ While: validator.quality < 0.9
   │    │
   │    └─ ▶ Workflow: Improve Solution
   │         │
   │         ├─ ▶ Agent: code-writer
   │         │    config:
   │         │      model: "gpt-4"
   │         │      systemPrompt: "You are a code improvement expert..."
   │         │    inputs:
   │         │      task: "Improve the code based on feedback"
   │         │      previousCode: ${context.lastOutput.code}
   │         │      feedback: ${context.lastOutput.feedback}
   │         │
   │         └─ ▶ Validator: quality-check
   │              config:
   │                checks:
   │                  - type: "syntax"
   │                  - type: "tests"
   │                    command: "npm test"
   │                  - type: "coverage"
   │                    threshold: 80
   │                  - type: "lint"
   │                    command: "npm run lint"
   │              outputs:
   │                quality: 0.75  ← aggregated score
   │                feedback: "Missing edge case for n=0"
   │
   └─ ▶ Command: save-final-result
```

#### Execution Visualization

```
Iteration 1:
▶ While: quality < 0.9              [⟳ iteration 1, quality=0.0]
   └─ ▶ Workflow: Improve Solution
        ├─ Agent: code-writer       [✓ generated code]
        └─ Validator: quality-check [✓ quality=0.65]
                                    feedback: "No tests, missing edge cases"

Iteration 2:
▶ While: quality < 0.9              [⟳ iteration 2, quality=0.65]
   └─ ▶ Workflow: Improve Solution
        ├─ Agent: code-writer       [✓ improved code]
        └─ Validator: quality-check [✓ quality=0.82]
                                    feedback: "Coverage at 75%, needs 80%"

Iteration 3:
▶ While: quality < 0.9              [⟳ iteration 3, quality=0.82]
   └─ ▶ Workflow: Improve Solution
        ├─ Agent: code-writer       [✓ final improvements]
        └─ Validator: quality-check [✓ quality=0.91]
                                    feedback: "All checks passed"

▶ While: quality < 0.9              [✓ condition false, exiting]
                                    total iterations: 3
```

#### JSON Definition

```json
{
  "id": "iterative-improvement",
  "blockType": "workflow",
  "name": "Iterative Code Improvement",
  "children": [
    {
      "id": "initial-task",
      "blockType": "prompt",
      "config": {
        "content": "Write a function that calculates fibonacci"
      }
    },
    {
      "id": "improvement-loop",
      "blockType": "while",
      "config": {
        "condition": "blocks['quality-check'].outputs.quality < 0.9",
        "maxIterations": 10
      },
      "children": {
        "body": [
          {
            "id": "improve-solution",
            "blockType": "workflow",
            "children": [
              {
                "id": "code-writer",
                "blockType": "agent",
                "config": {
                  "model": "gpt-4",
                  "systemPrompt": "You are a code improvement expert. Analyze feedback and improve the code."
                },
                "inputs": {
                  "task": "Improve the code based on validator feedback",
                  "previousCode": "${context.lastIteration.outputs.code}",
                  "feedback": "${context.lastIteration.outputs.feedback}"
                }
              },
              {
                "id": "quality-check",
                "blockType": "validator",
                "config": {
                  "checks": [
                    { "type": "syntax", "weight": 0.2 },
                    { "type": "tests", "command": "npm test", "weight": 0.3 },
                    { "type": "coverage", "threshold": 80, "weight": 0.3 },
                    { "type": "lint", "command": "npm run lint", "weight": 0.2 }
                  ],
                  "aggregation": "weighted_average"
                },
                "outputs": {
                  "quality": "number",
                  "feedback": "string",
                  "details": "object"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "save-result",
      "blockType": "command",
      "config": {
        "command": "save-artifact --name final-code --content ${blocks['code-writer'].outputs.code}"
      }
    }
  ]
}
```

#### Validator Block Definition

```json
{
  "id": "validator",
  "name": "Validator",
  "blockType": "validator",
  "isAtomic": true,
  "description": "Validates outputs against defined quality checks. Returns aggregated quality score and detailed feedback.",

  "config": {
    "checks": {
      "type": "array",
      "description": "List of validation checks to perform",
      "items": {
        "type": {
          "enum": ["syntax", "tests", "coverage", "lint", "custom", "llm-judge"]
        },
        "command": "string (optional)",
        "threshold": "number (optional)",
        "weight": "number (default: 1.0)",
        "prompt": "string (for llm-judge)"
      }
    },
    "aggregation": {
      "type": "string",
      "enum": ["weighted_average", "min", "all_pass"],
      "default": "weighted_average"
    },
    "failThreshold": {
      "type": "number",
      "default": 0.0,
      "description": "Quality below this fails the validator"
    }
  },

  "inputs": {
    "content": {
      "type": "any",
      "description": "Content to validate (code, text, data)"
    },
    "context": {
      "type": "object",
      "description": "Additional context for validation"
    }
  },

  "outputs": {
    "quality": {
      "type": "number",
      "range": [0, 1],
      "description": "Aggregated quality score"
    },
    "passed": {
      "type": "boolean",
      "description": "Whether quality >= failThreshold"
    },
    "feedback": {
      "type": "string",
      "description": "Human-readable feedback for improvement"
    },
    "details": {
      "type": "object",
      "description": "Per-check results and scores"
    }
  }
}
```

#### Why This Pattern Matters

| Aspect | Benefit |
|--------|---------|
| **Iterative Refinement** | Agent improves based on concrete feedback |
| **Measurable Progress** | Quality score tracks improvement |
| **Automatic Termination** | Loop exits when threshold reached |
| **Safety Limit** | `maxIterations` prevents infinite loops |
| **Debuggable** | Each iteration is visible in execution tree |
| **Training Data** | Each iteration generates training pairs |

This pattern is the foundation for:
- Agent self-improvement loops
- Automated code review cycles
- Quality-driven content generation
- Reinforcement learning from validator feedback

---

## 6. LLM Reasoning Example

When an LLM agent sees this structure, it reasons naturally:

```
Task: "Build and deploy if tests pass"

Agent thinking:
1. I see a workflow with sequential steps
2. First, there's a parallel block - I'll wait for all checks
3. Then there's a decision - I check if checks passed
4. If yes, I run tests with retry (in case of flakiness)
5. Then another decision for the branch
6. Finally, cleanup runs regardless

This is exactly like reading code:
- parallel { lint, typecheck, security }
- if (all passed) {
    retry(2) { tests }
    if (main) { integration; deploy }
    else { echo "done" }
  } else { notify }
- cleanup
```

The hierarchical structure maps 1:1 to how the LLM reasons about control flow.

---

## 7. Anti-Patterns to Avoid

### 7.1 Graph-Based Connections

```
❌ DON'T: Arrows between arbitrary nodes

    [Build] ──────┐
                  ├──► [Test] ──► [Deploy]
    [Lint] ───────┘
         │
         └──────────────────────► [Notify]
```

This becomes unreadable and unmaintainable.

### 7.2 Implicit Control Flow

```
❌ DON'T: Magic conditions in edges

    [Build] ──(success)──► [Test]
         │
         └──(failure)──► [Notify]
```

The control flow is hidden in edge labels.

### 7.3 Correct Approach

```
✓ DO: Explicit control flow blocks

    ▶ Build
    ▶ If: build.success
       ├─ Then: ▶ Test
       └─ Else: ▶ Notify
```

Control flow is visible and explicit.

---

## 8. Implementation Notes

### 8.1 Block Type Registration

Add these block types to `blockTypeDefinitions.ts`:

```typescript
const controlFlowBlocks = [
  { type: 'decision', isAtomic: false, canContain: ['*'] },
  { type: 'retry', isAtomic: false, canContain: ['*'] },
  { type: 'while', isAtomic: false, canContain: ['*'] },
  { type: 'foreach', isAtomic: false, canContain: ['*'] },
  { type: 'parallel', isAtomic: false, canContain: ['*'] },
];
```

### 8.2 Execution Engine

The executor handles control flow blocks specially:

```typescript
async function executeBlock(block: Block, context: Context): Promise<Result> {
  switch (block.blockType) {
    case 'decision':
      return executeDecision(block, context);
    case 'retry':
      return executeRetry(block, context);
    case 'while':
      return executeWhile(block, context);
    case 'foreach':
      return executeForEach(block, context);
    case 'parallel':
      return executeParallel(block, context);
    default:
      return executeStandard(block, context);
  }
}
```

### 8.3 UI Components

Each control flow block needs a specialized renderer:

| Block | UI Component | Key Features |
|-------|--------------|--------------|
| Decision | `DecisionBlockNode` | Then/Else branches, condition display |
| Retry | `RetryBlockNode` | Attempt counter, retry icon |
| While | `WhileBlockNode` | Iteration counter, condition display |
| ForEach | `ForEachBlockNode` | Collection display, progress |
| Parallel | `ParallelBlockNode` | Branch status indicators |

---

## 9. Summary

| Concept | Block Type | Key Config |
|---------|------------|------------|
| Condition | `decision` | `condition`, `then`, `else` |
| Retry | `retry` | `maxAttempts`, `delayMs` |
| While Loop | `while` | `condition`, `maxIterations` |
| For-Each | `foreach` | `collection`, `itemVariable` |
| Parallel | `parallel` | `waitFor`, `failFast` |

### Core Principles

1. **Control flow is explicit** - blocks, not arrows
2. **Top-to-bottom execution** - time flows down
3. **Depth indicates structure** - nesting shows scope
4. **Always serializable** - clean JSON/YAML
5. **LLM-friendly** - reads like pseudocode

---

*"Un workflow se lit comme du code. La complexité est dans les blocs, pas dans les flèches."*
