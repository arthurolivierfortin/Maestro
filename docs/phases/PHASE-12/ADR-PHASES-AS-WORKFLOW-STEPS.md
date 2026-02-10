# ADR: Phases as Sequential Workflow Steps, Not Loops

## Date
2026-02-09

## Status
Accepted

## Context

The `for-each` control flow node (see ADR-FOR-EACH-CONTROL-FLOW.md) made phase iteration explicit in workflow JSON. However, running the gen-commit foundry session revealed a deeper architectural problem: **all phases were forced through the same improvement loop**, regardless of their purpose.

The foundry-default session defines 4 phases:

| Phase | Purpose | Actual need |
|-------|---------|-------------|
| Creation | Generate initial JSON tool from scratch | Iterative improvement loop (inference + validate + write, repeat until fitness target) |
| Optimization | Reduce token count while keeping structure | Iterative improvement loop with plateau detection |
| Validation | Verify production readiness | One-shot: load artifact, validate schema, fix if needed, write |
| Publish | Add metadata, finalize for distribution | One-shot: enrich artifact, generate docs, write final output |

The previous architecture wrapped all 4 phases in a single `for-each` node, which executed the **same child nodes** (load-artifact -> while-loop -> finalize) for every phase. This is wrong for two reasons:

1. **Validation** doesn't need an iterative loop. It's a single pass: check the artifact against production criteria, fix issues, done.
2. **Publish** doesn't need LLM inference at all. It's about adding metadata, generating documentation, and producing the final package. Running it through `inference -> validate -> write` in a loop makes no semantic sense.

The monitor reflected this problem: every phase showed identical blocks, making it impossible to understand what each phase actually does.

## Decision

**Phases are sequential workflow steps, not loop iterations.** A phase is an organizational unit that groups related work. Some phases may be iterative (improvement loops), others are one-shot transforms, others are documentation generators.

The workflow structure should be:

```
agent-improvement-loop
  ├── ∀ for-each (creation, optimization)    [iterative improvement]
  │   ├── load-artifact
  │   ├── ↻ while (improvement-loop)
  │   │   ├── run-training
  │   │   ├── generate-improvements
  │   │   ├── check-quality
  │   │   └── apply-result
  │   └── finalize-phase
  ├── ○ load-for-validation                  [one-shot validation]
  ├── ○ validate-artifact
  ├── ○ write-validated
  ├── ○ finalize-validation
  ├── ○ load-for-publish                     [one-shot publish]
  ├── ○ enrich-metadata
  ├── ○ write-final
  ├── ○ finalize-publish
  ├── ○ doc-tree                             [post-processing]
  ├── ○ write-metrics
  └── ○ shell-format-report
```

### Key principles

1. **`for-each` is for homogeneous iteration**: When N items need the same processing (test N models, improve through N similar phases). NOT for grouping heterogeneous steps.

2. **Different behavior = different nodes**: If a phase does something fundamentally different, it gets its own nodes in the workflow JSON. The tree should make this visible.

3. **`_phases` tracks status, not execution**: The `_phases` session variable remains useful for tracking phase status (pending/running/done) and displaying progress in the monitor. But it doesn't drive execution for non-iterative phases.

4. **Workflow config per step**: Each step reads its config from `_workflowConfig` using its section key (e.g., `_workflowConfig.agent-improvement-loop.validation`). This keeps prompts and criteria in session data, not in C# code.

## Changes

### 1. `_phases` in session template

Split into improvement phases (for-each) and standalone phases (explicit nodes):

```json
"_phases": [
  { "id": "creation", "name": "Phase 1: Creation", "status": "pending" },
  { "id": "optimization", "name": "Phase 2: Optimization", "status": "pending" },
  { "id": "validation", "name": "Phase 3: Validation", "status": "pending" },
  { "id": "publish", "name": "Phase 4: Publish", "status": "pending" }
]
```

The `_phases` list still contains all 4 for monitor display. But only `creation` and `optimization` are iterated by `for-each`. Validation and publish are explicit nodes that update their phase status directly.

### 2. `_improvementPhases` in session template

New variable that lists only the phases to iterate:

```json
"_improvementPhases": [
  { "id": "creation", "name": "Phase 1: Creation", "status": "pending" },
  { "id": "optimization", "name": "Phase 2: Optimization", "status": "pending" }
]
```

The `for-each` node iterates over `_improvementPhases` instead of `_phases`.

### 3. Workflow block structure

The `agent-improvement-loop` workflow now has explicit nodes for validation and publish instead of routing them through the improvement loop.

### 4. Validation step

Uses `system:inference` for a single LLM call (not a while loop). Validates the artifact against production criteria. If the LLM output is valid, writes it. No iteration.

### 5. Publish step

Uses `system:inference` for a single LLM call to add metadata. Writes the final artifact. No iteration, no fitness evaluation.

## Consequences

### Positive

- **Transparent execution tree**: Each phase shows its actual blocks in the monitor, not the same generic loop.
- **Faster execution**: Validation and publish complete in one LLM call instead of iterating until fitness.
- **Correct semantics**: The workflow JSON describes what actually happens, not a one-size-fits-all loop.
- **Better docs**: Per-phase reports show different structures, making the session's behavior self-documenting.

### Negative

- **More verbose workflow JSON**: Instead of a single `for-each` over 4 items, we have `for-each` over 2 + explicit nodes for 2 more. The workflow block is larger.
- **Phase status management**: Non-iterated phases need explicit `UpdatePhaseStatus` calls from their nodes. This is handled by setting `activePhaseId` in the execution context.

### Neutral

- **No infrastructure changes needed**: The `for-each`, `while`, and regular node execution in `EntryPointExecutor.cs` already support this structure. The change is purely in the workflow block JSON and session template.
- **Compliance-tester unaffected**: Its phases are all homogeneous (test one model each), so the `for-each` over all `_phases` remains correct.

## Alternatives Considered

### Per-item node overrides in `for-each`

Allow each item in `_phases` to specify which child nodes to execute. Rejected because it would make the `for-each` handler complex and the workflow JSON harder to read. Explicit nodes are clearer.

### Separate workflows per phase type

Create `foundry:improvement-loop`, `foundry:validation`, `foundry:publish` as separate workflow blocks, and reference them from the main workflow. This is the ideal long-term architecture but overkill for now. The main workflow can contain all nodes inline.
