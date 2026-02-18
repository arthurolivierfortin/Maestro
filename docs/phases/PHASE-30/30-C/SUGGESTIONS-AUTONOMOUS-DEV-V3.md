# Suggestions: Autonomous Development Workflow v3

**Date**: 2026-02-17
**Phase**: 30-C
**Status**: PROPOSAL — requires review and approval before implementation

## Table of Contents

1. [Current State (Honest Assessment)](#1-current-state)
2. [Problems Identified](#2-problems)
3. [Proposed Architecture](#3-architecture)
4. [New Blocks Needed](#4-new-blocks)
5. [Infrastructure Changes](#5-infrastructure-changes)
6. [Workflow JSON v3](#6-workflow-json)
7. [Data Flow Diagram](#7-data-flow)
8. [Migration Path](#8-migration)
9. [What This Does NOT Change](#9-non-changes)

---

## 1. Current State (Honest Assessment) <a name="1-current-state"></a>

### Current workflow: `autonomous-development` v2.0.0

```
prepare (agent) → plan (agent) → implement (agent) → test (agent) → review (inference) → commit (agent)
```

6 sequential nodes. Each is a blockRef to an agent (or inference) block. Outputs chain via `{{previousOutput}}` and `{{_nodeResult_xxx}}`.

### What works

- **Simple tasks** (1-3 files): All 6 nodes execute, real tool calls happen, files written, commits created.
- **Infrastructure**: `for-each`, `while`, `conditional`, `phase` node types all exist and work. The executor is fully generic.
- **Agent loop**: When Claude makes tool calls, the CLI executes them and feeds results back correctly. The mechanical plumbing works.

### What doesn't work

- **Complex tasks** (5+ files): The implement agent hallucates `{"tool":"done"}` immediately, making zero real tool calls.
- **No validation between agents**: The plan output is raw text passed directly to implement. If the plan is malformed, nobody catches it.
- **No step tracking**: The implement agent receives ALL steps as one blob and processes them internally. No visibility per step.
- **Output pollution**: The `result: ` prefix on outputs makes inter-agent data passing fragile and noisy.
- **No feedback loops**: If a step fails, there's no mechanism to retry just that step.

---

## 2. Problems Identified <a name="2-problems"></a>

### Problem 1: The plan is invisible

The task-planner agent produces a JSON array of steps inside a `{"tool":"done","args":{"summary":"[...]"}}` response. This JSON string is then:

1. Stored in `result.Outputs["result"]` by AgentBlockExecutor
2. Formatted as `"result: [{"id":1,...}]"` by EntryPointExecutor (line 1086-1091)
3. Passed as raw text to the implement agent via `{{previousOutput}}`

The plan is never parsed, validated, or made visible to the infrastructure. It exists only as text that the next agent must mentally parse.

**Consequences:**
- No validation that the plan has the right structure
- No way to count steps or track progress
- No way to detect hallucinated plans
- The "result:" prefix must be stripped by the receiving agent

### Problem 2: One agent does too much

The implement agent receives 1-25 steps and is expected to:
- Parse the plan JSON from text
- For each step: read context files, write code, verify
- Track which steps it completed
- Report final summary

This is the antithesis of "one block = one responsibility". When a task has 10 steps, Claude takes a shortcut and fabricates the entire result in one response.

**Root cause**: The problem isn't Claude being dumb — it's Claude being TOO smart. Given 10 steps, Claude can "see" what all the files should contain and produces a summary. A smaller scope (1 step) forces it to actually use tools because the task is concrete and verifiable.

### Problem 3: No Maestro control flow for steps

The for-each infrastructure exists and is excellent (resume support, status tracking, display tree updates, per-item config). But the autonomous-development workflow doesn't use it. Instead, it delegates all iteration to the agent's internal loop.

This means:
- Steps don't appear in the execution tree
- The monitor shows "Implement" as one block, not "Step 3/7: Create FileTree.tsx"
- No per-step retry
- No per-step metrics

### Problem 4: No validation anywhere

Between every agent pair, there's an implicit contract:
- prepare → plan: "here's the project context as JSON"
- plan → implement: "here's an array of step objects with id, action, target, description..."
- implement → test: "here's what was implemented"
- test → review: "here's the test results"

None of these contracts are validated. If any agent produces garbage, the next agent receives garbage and either hallucinates or fails silently.

---

## 3. Proposed Architecture <a name="3-architecture"></a>

### Core Principles

1. **The plan is a first-class data structure** — parsed, validated, stored as a session variable
2. **One step = one agent execution** — the for-each infrastructure handles iteration
3. **Validation between every boundary** — dedicated validator blocks check contracts
4. **Feedback loops on failure** — if validation fails, retry with error context

### Workflow Structure v3

```
prepare (agent)
    ↓
validate-context (tool: json-validator)
    ↓ error → retry prepare with feedback (max 2)
    ↓ success
plan (agent)
    ↓
validate-plan (tool: json-validator)
    ↓ error → retry plan with feedback (max 2)
    ↓ success → stores _planSteps as session variable
for-each step in _planSteps:
    ├── implement-step (agent: implement-single-step)
    ├── validate-step (tool: step-validator)
    │   ↓ error → retry implement-step with feedback (max 1)
    └── [step marked done in execution tree]
test (agent)
    ↓
review (inference)
    ↓
conditional: review.score >= 0.7
    then → commit (agent)
    else → log "quality too low, skipping commit"
```

### Why This Is More "Maestro"

| Aspect | v2 (current) | v3 (proposed) |
|--------|-------------|---------------|
| **Plan visibility** | Hidden in text between agents | First-class session variable, visible in monitor |
| **Step tracking** | None — one "Implement" block | Each step visible in execution tree |
| **Validation** | None — agents trust each other | Dedicated validator blocks between agents |
| **Feedback** | None — errors propagate silently | Retry with error context on validation failure |
| **Scope per agent** | 1-25 steps (too much) | 1 step (focused, concrete) |
| **Block composition** | 6 flat nodes | Nested: workflow → for-each → agent + validator |
| **Infrastructure** | Custom iteration inside agent | Generic for-each from EntryPointExecutor |
| **Resumability** | None — restart from scratch | for-each skips completed steps |

---

## 4. New Blocks Needed <a name="4-new-blocks"></a>

### Block 1: `json-validator` (tool block)

**Purpose**: Validates that a JSON string matches an expected shape. Reports structured errors.

**Location**: `content/system/blocks/tools/json-validator.tool.block.json`

```json
{
  "id": "json-validator",
  "name": "JSON Validator",
  "blockType": "tool",
  "isAtomic": true,
  "description": "Validates JSON data against expected fields and types. Returns isValid + errors.",
  "inputs": [
    { "id": "data", "type": "string", "required": true, "description": "JSON string to validate" },
    { "id": "schema", "type": "string", "required": true, "description": "Schema name: 'project-context', 'plan-steps', 'step-result', 'test-results'" }
  ],
  "outputs": [
    { "id": "isValid", "type": "boolean" },
    { "id": "errors", "type": "string", "description": "JSON array of error messages" },
    { "id": "parsed", "type": "string", "description": "The cleaned, validated JSON (no 'result:' prefix)" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "validate.js"
  }
}
```

**validate.js** — A simple Node script that:
1. Strips the `result: ` / `content: ` prefix if present
2. Extracts JSON from markdown code blocks if wrapped
3. Parses the JSON
4. Checks required fields based on schema name:
   - `plan-steps`: Must be an array, each item has `id` (number), `action` (string), `target` (string), `description` (string)
   - `project-context`: Must have `project`, `stack`, `conventions`
   - `step-result`: Must have `success` (boolean), `filesWritten` (array)
   - `test-results`: Must have `passed` (number), `failed` (number)
5. Outputs `{ isValid, errors, parsed }`

**Why a script, not C#?** Because validation schemas are content, not infrastructure. A user can add new schemas by editing `validate.js` or adding schema files. Zero C# changes.

### Block 2: `plan-to-steps` (tool block)

**Purpose**: Takes validated plan JSON and stores each step as a session variable for for-each consumption.

**Location**: `content/system/blocks/tools/plan-to-steps.tool.block.json`

```json
{
  "id": "plan-to-steps",
  "name": "Plan to Steps Converter",
  "blockType": "tool",
  "isAtomic": true,
  "description": "Parses a validated plan JSON array and stores it as a _planSteps session variable for for-each iteration.",
  "inputs": [
    { "id": "plan", "type": "string", "required": true, "description": "Validated plan JSON array string" }
  ],
  "outputs": [
    { "id": "stepCount", "type": "number" },
    { "id": "steps", "type": "string", "description": "The stored steps as JSON" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "plan-to-steps.js"
  }
}
```

**Wait — does this need to be a block?**

Actually, the simpler approach: the `for-each` node already calls `NormalizeJsonElementToList()` on its source variable. And `_nodeResult_validate-plan` (from the json-validator) would contain the cleaned JSON. If we fix the output format issue (Problem 1), the for-each could read the plan directly from `_nodeResult_validate-plan`.

**Verdict**: This block may not be needed if we fix the output formatting. See [Infrastructure Changes](#5-infrastructure-changes).

### Block 3: `step-validator` (tool block)

**Purpose**: After each implementation step, verifies the step was actually done.

**Location**: `content/system/blocks/tools/step-validator.tool.block.json`

```json
{
  "id": "step-validator",
  "name": "Step Validator",
  "blockType": "tool",
  "isAtomic": true,
  "description": "Validates that an implementation step was actually completed: checks files exist, have content, and match acceptance criteria.",
  "inputs": [
    { "id": "step", "type": "string", "required": true, "description": "The step definition JSON" },
    { "id": "result", "type": "string", "required": true, "description": "The implement agent's claimed result" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Repository root path" }
  ],
  "outputs": [
    { "id": "isValid", "type": "boolean" },
    { "id": "errors", "type": "string" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "step-validator.js"
  }
}
```

**step-validator.js** — Checks:
1. For `action: "create"` — Does the file exist at `target` path? Is it non-empty?
2. For `action: "modify"` — Is the file different from before? (compare with git)
3. For `action: "delete"` — Does the file NOT exist?
4. For `action: "add-dependency"` — Is the package in `package.json`?
5. For `action: "run-command"` — Was the exit code 0?

This is the anti-hallucination guard. The agent says "I wrote FileTree.tsx" — the validator checks if `FileTree.tsx` actually exists on disk.

---

## 5. Infrastructure Changes <a name="5-infrastructure-changes"></a>

### Change 1: Fix output formatting (CRITICAL)

**Current** (EntryPointExecutor lines 1084-1091):
```csharp
var outputParts = new List<string>();
foreach (var kv in result.Outputs)
{
    outputParts.Add($"{kv.Key}: {kv.Value}");
}
var output = string.Join("\n", outputParts);
```

This produces `"result: [{"id":1,...}]"` — the `result: ` prefix breaks JSON parsing downstream.

**Proposed**: If the block has a single output key that matches a known primary key (`result`, `content`, `response`, `summary`, `output`), use just the value:

```csharp
var output = "";
if (result.Outputs.Count == 1)
{
    // Single output — use raw value (no key prefix)
    output = result.Outputs.Values.First()?.ToString() ?? "";
}
else if (result.Outputs.Count > 1)
{
    // Multiple outputs — keep key:value format for disambiguation
    var outputParts = new List<string>();
    foreach (var kv in result.Outputs)
        outputParts.Add($"{kv.Key}: {kv.Value}");
    output = string.Join("\n", outputParts);
}
```

**Impact**: All agents now receive clean data. `{{previousOutput}}` for the plan node would be `[{"id":1,...}]` instead of `result: [{"id":1,...}]`. This is backwards-compatible because agents that already handle the prefix will just see cleaner input.

### Change 2: AgentBlockExecutor loop hardening (3 bugs)

These are the three bugs from the hallucination analysis. Separate from the architectural changes but complementary:

1. **"done" guard**: Reject `{"tool":"done"}` if `actualToolCallCount == 0`. Feed back a message forcing real work.
2. **Non-JSON retry**: If `ExtractJson` fails, send a nudge message ("respond with JSON only") and retry (max 2).
3. **Exception retry**: Parse exceptions trigger retry, not silent break.

### Change 3: for-each source from `_nodeResult_xxx`

The for-each node currently reads its source from a session variable name. After Change 1 (clean output), the validated plan stored in `_nodeResult_validate-plan` would be a clean JSON array string like `[{"id":1,...}]`.

`NormalizeJsonElementToList` already handles strings containing JSON arrays (line 270+ in EntryPointExecutor). So this should work without any additional changes.

**However**, there's a subtlety: the for-each node config says `"source": "_planSteps"`, and the plan JSON is in `_nodeResult_validate-plan`. We need either:
- (a) A node that copies `_nodeResult_validate-plan` → `_planSteps` (a "set-variable" node type)
- (b) Allow for-each `source` to reference `_nodeResult_xxx` directly
- (c) The json-validator block writes to a configurable session variable

Option (c) is most Maestro: the json-validator outputs `parsed`, and a write-variable node stores it. But we don't have a write-variable node type.

Option (b) is simplest: `"source": "_nodeResult_validate-plan"` — it's already a session variable.

**Recommendation**: Option (b). No infrastructure change needed. The for-each just references the right variable name.

### Change 4: `currentItem` template variable for for-each

Currently, for-each iterates over items and dispatches child nodes, but child nodes access data via per-item config lookup (`GetWorkflowConfig`), not via a template variable representing the current item.

For the step-by-step implementation to work, the implement agent needs to receive the CURRENT step object, not all steps. We need:

```csharp
// In ExecuteForEachNodeAsync, before dispatching child nodes:
session.SetVariable("_currentItem", itemDict);
session.SetVariable("_currentItemJson", JsonSerializer.Serialize(itemDict));
```

Then in the workflow JSON:
```json
{
  "id": "implement-step",
  "blockRef": "implement-single-step",
  "inputs": {
    "step": "{{_currentItemJson}}",
    "workingDir": "{{inputs.repoPath}}"
  }
}
```

**This is a small infrastructure change** (~3 lines in ExecuteForEachNodeAsync) that makes for-each much more useful for data-driven iteration.

---

## 6. Workflow JSON v3 <a name="6-workflow-json"></a>

```json
{
  "id": "autonomous-development",
  "name": "Autonomous Development Workflow",
  "blockType": "workflow",
  "version": "3.0.0",
  "isAtomic": false,
  "description": "Plan → validate → implement step-by-step → test → review → commit",

  "inputs": [
    { "id": "task", "type": "string", "required": true },
    { "id": "repoPath", "type": "string", "required": true }
  ],

  "config": {
    "nodes": [
      {
        "id": "prepare",
        "name": "Analyze Project",
        "blockRef": "project-preparer",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "task": "{{inputs.task}}"
        }
      },

      {
        "id": "validate-context",
        "name": "Validate Project Context",
        "blockRef": "json-validator",
        "inputs": {
          "data": "{{previousOutput}}",
          "schema": "project-context"
        }
      },

      {
        "id": "plan",
        "name": "Plan Implementation",
        "blockRef": "task-planner",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "task": "{{inputs.task}}",
          "context": "{{_nodeResult_prepare}}"
        }
      },

      {
        "id": "validate-plan",
        "name": "Validate Plan",
        "blockRef": "json-validator",
        "inputs": {
          "data": "{{previousOutput}}",
          "schema": "plan-steps"
        }
      },

      {
        "id": "implement-steps",
        "name": "Implement Steps",
        "type": "for-each",
        "source": "_nodeResult_validate-plan",
        "itemId": "id",
        "configLookup": false,
        "nodes": [
          {
            "id": "implement-step",
            "name": "Implement Step",
            "blockRef": "implement-single-step",
            "inputs": {
              "step": "{{_currentItemJson}}",
              "context": "{{_nodeResult_prepare}}",
              "workingDir": "{{inputs.repoPath}}"
            }
          },
          {
            "id": "validate-step",
            "name": "Verify Step",
            "blockRef": "step-validator",
            "inputs": {
              "step": "{{_currentItemJson}}",
              "result": "{{previousOutput}}",
              "workingDir": "{{inputs.repoPath}}"
            }
          }
        ]
      },

      {
        "id": "test",
        "name": "Run Tests",
        "blockRef": "test-executor",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "task": "{{inputs.task}}"
        }
      },

      {
        "id": "review",
        "name": "Review Code Quality",
        "blockRef": "code-reviewer",
        "inputs": {
          "code": "{{_nodeResult_implement-steps}}",
          "task": "{{inputs.task}}"
        }
      },

      {
        "id": "maybe-commit",
        "name": "Commit If Quality OK",
        "type": "conditional",
        "condition": "{{_reviewScore}} >= 0.7",
        "then": {
          "id": "commit",
          "blockRef": "git-committer",
          "inputs": {
            "repoPath": "{{inputs.repoPath}}",
            "task": "{{inputs.task}}",
            "changes": "{{_nodeResult_implement-steps}}",
            "review": "{{_nodeResult_review}}"
          }
        },
        "else": {
          "id": "skip-commit",
          "blockRef": "json-validator",
          "inputs": {
            "data": "{}",
            "schema": "none"
          }
        }
      }
    ]
  }
}
```

### What changed vs v2

| v2 | v3 | Why |
|----|-----|-----|
| 6 flat sequential nodes | 8 nodes with nesting (for-each, conditional) | Step-level visibility and control |
| No validation | `json-validator` after prepare and plan | Catch malformed data before it propagates |
| Single implement agent for all steps | `for-each` → one implement agent per step | Smaller scope = less hallucination |
| No step verification | `step-validator` after each step | Anti-hallucination: check files on disk |
| Always commit | Conditional commit based on review score | Don't commit garbage |
| No feedback on failure | Validators produce error messages | Future: retry nodes with error context |

---

## 7. Data Flow Diagram <a name="7-data-flow"></a>

```
                        Session Variables
                        ─────────────────
invoke develop          _nodeResult_prepare     = "{project context JSON}"
  │                     _nodeResult_plan        = "[step1, step2, ...]"
  │                     _nodeResult_validate-plan = "[validated steps]"
  ▼                     _currentItem            = {id:1, action:"create", ...}
                        _currentItemJson        = '{"id":1,"action":"create",...}'
┌──────────────┐        _nodeResult_implement-step = "step result"
│   prepare    │        _nodeResult_test        = "{passed:5, failed:0}"
│  (agent)     │──→ project context JSON
└──────┬───────┘
       ▼
┌──────────────┐
│  validate-   │──→ isValid: true/false, parsed: cleaned JSON
│  context     │    (if false: error messages for retry)
└──────┬───────┘
       ▼
┌──────────────┐
│    plan      │──→ plan steps JSON array
│  (agent)     │    [{"id":1,"action":"create","target":"src/types/FileNode.ts",...}]
└──────┬───────┘
       ▼
┌──────────────┐
│  validate-   │──→ isValid: true/false, parsed: validated steps array
│  plan        │    Checks: is array, each has id/action/target/description
└──────┬───────┘
       ▼
┌──────────────────────────────────────────┐
│  for-each step in _nodeResult_validate-plan │
│                                          │
│  ┌────────────────┐  ┌────────────────┐  │
│  │ implement-step │→ │ validate-step  │  │  ← Step 1/N
│  │ (agent, 1 step)│  │ (check disk)   │  │
│  └────────────────┘  └────────────────┘  │
│                                          │
│  ┌────────────────┐  ┌────────────────┐  │
│  │ implement-step │→ │ validate-step  │  │  ← Step 2/N
│  │ (agent, 1 step)│  │ (check disk)   │  │
│  └────────────────┘  └────────────────┘  │
│         ...              ...             │
└──────────────────────────────────────────┘
       ▼
┌──────────────┐
│    test      │──→ test results JSON
│  (agent)     │
└──────┬───────┘
       ▼
┌──────────────┐
│   review     │──→ score, feedback
│ (inference)  │
└──────┬───────┘
       ▼
┌──────────────┐
│ conditional  │──→ if score >= 0.7:
│              │      commit (agent)
│              │    else:
│              │      skip
└──────────────┘
```

### Monitor Display (what the user would see)

```
autonomous-development                    [running]
├── Analyze Project                       [done]     42s
├── Validate Project Context              [done]     <1s
├── Plan Implementation                   [done]     1m 15s
├── Validate Plan                         [done]     <1s
├── Implement Steps                       [running]  Step 3/7
│   ├── Step 1: Create FileNode type      [done]     25s  ✓
│   ├── Step 2: Create tree utils         [done]     30s  ✓
│   ├── Step 3: Create FileTree component [running]  ...
│   ├── Step 4: Create FileTree styles    [pending]
│   ├── Step 5: Update App.tsx            [pending]
│   ├── Step 6: Create FileTree tests     [pending]
│   └── Step 7: Update barrel exports     [pending]
├── Run Tests                             [pending]
├── Review Code Quality                   [pending]
└── Commit If Quality OK                  [pending]
```

Compare with v2:

```
autonomous-development                    [running]
├── Analyze Project                       [done]     42s
├── Plan Implementation                   [done]     1m 15s
├── Implement Changes                     [running]  ???
├── Run Tests                             [pending]
├── Review Code Quality                   [pending]
└── Commit Changes                        [pending]
```

No step visibility. No progress. No way to know if "Implement Changes" is doing real work or hallucinating.

---

## 8. Migration Path <a name="8-migration"></a>

### Phase A: Infrastructure fixes (no architectural change)

1. **Fix output formatting** — Change EntryPointExecutor to not add `key: ` prefix for single-output blocks
2. **Fix AgentBlockExecutor 3 bugs** — Done guard, non-JSON retry, exception retry
3. **Add `_currentItem`/`_currentItemJson`** to for-each handler

These are all backwards-compatible. The existing v2 workflow keeps working.

**Effort**: ~80 lines of C#. Can be done first, tested independently.

### Phase B: New tool blocks

1. **Create `json-validator` block** — Script-based, validates JSON against named schemas
2. **Create `step-validator` block** — Script-based, checks files exist on disk
3. **Test both blocks** via direct `node index.js run json-validator --input-json '{...}'`

**Effort**: 2 block.json files + 2 Node.js scripts (~100 lines each). Can be tested via CLI without a session.

### Phase C: Workflow v3

1. **Update `autonomous-development.workflow.block.json`** — New structure with for-each and validators
2. **Update `implement-single-step` system prompt** — Simplify for single-step scope (remove multi-step handling)
3. **Test with simple task** first (1-3 steps), then moderate (5-7 steps), then complex (10+ steps)

**Effort**: JSON changes + prompt edits. Zero C# changes if Phase A is done.

### Phase D: Feedback loops (future)

1. Add retry-on-validation-failure mechanism
2. If validate-plan fails, re-invoke plan agent with error context
3. If validate-step fails, re-invoke implement agent for that step

This requires a new node type (`retry` or `retry-on-error`) or a `while` wrapper around the validate node. Can be done later — v3 works without it (validation just reports errors, doesn't retry).

---

## 9. What This Does NOT Change <a name="9-non-changes"></a>

- **No new block types in C#** — json-validator and step-validator are `tool` blocks with scripts
- **No changes to AgentBlockExecutor's tool protocol** — Still text-based JSON, still maestro_cli
- **No provider-specific code** — Everything remains provider-agnostic
- **No changes to the monitor** — The execution tree already supports nested nodes from for-each
- **No changes to the CLI** — `session invoke` works the same way
- **No breaking changes** — v2 workflow can coexist with v3 during migration

The only infrastructure changes are:
1. Output formatting (how block results are stringified) — ~10 lines
2. Loop hardening in AgentBlockExecutor — ~50 lines
3. `_currentItemJson` in for-each handler — ~5 lines

Everything else is content: block JSON files, Node.js scripts, system prompts.

**This is the Maestro way**: infrastructure generic, content specific.

---

## Appendix: Agent Prompt Changes

### implement-single-step v3 prompt (simplified for single step)

The current prompt handles both single steps AND full plans. In v3, it only handles one step at a time:

```markdown
# Implement Step Agent

You implement ONE step from a development plan.

## Input
You receive:
- **step**: A JSON object with {id, action, target, description, context_files, acceptance}
- **context**: Project context (stack, conventions, architecture)
- **workingDir**: The repository root path

## Your Workflow

1. Read context files listed in `step.context_files`
2. Read the target file (if action is "modify")
3. Write the code (create, modify, or delete)
4. Verify: run `npx tsc --noEmit` if TypeScript
5. Report what you did

## Rules
- You implement EXACTLY ONE step. Not more, not less.
- Your FIRST action must be a tool call (file-read or directory-list). NEVER start with "done".
- You MUST make at least one file-write tool call for create/modify actions.
- The system checks your work after you finish. If the file doesn't exist, you failed.
```

This is much simpler than the current prompt (89 lines → ~30 lines) because:
- No multi-step handling
- No step parsing
- No "process steps in order" logic
- The scope is small enough that Claude will use tools instead of hallucinating
