# ADR: Explicit `for-each` Control Flow Node

**Status**: Accepted
**Date**: 2026-02-09
**Context**: Phase 12 — LLM Compliance Testing

## Problem

The Maestro execution engine supports two control flow node types in workflow JSON:
- **`while`** — loop with a condition
- **`conditional`** — if/else branching

However, iterating over a list of items (e.g., testing multiple LLM models) was handled by an **implicit `while(true)` loop** in `EntryPointExecutor.ExecuteWorkflowAsync` (C# infrastructure code). This loop called `FindFirstPendingPhase()` to iterate over the `_phases` session variable, executing the entire workflow block once per phase.

**The problem**: This iteration mechanism was invisible in the workflow JSON. Looking at the workflow block definition, there was no indication that it would be executed multiple times with different configurations. The phase-chaining behavior was a hidden side-effect of having a `_phases` variable — violating the cardinal rule that **control flow is DATA** (visible in block JSON), not code (hidden in C#).

```
BEFORE (hidden in C#):
  EntryPointExecutor.ExecuteWorkflowAsync:
    while(true) {                          ← INVISIBLE in workflow JSON
      phase = FindFirstPendingPhase()
      config = GetWorkflowConfig(phase)
      ExecuteConfigNodesAsync(nodes, config)
    }

Workflow JSON only showed single-phase execution:
  nodes: [load, while-loop, doc-tree, write-metrics, finalize]
```

## Decision

Add `for-each` as a third control flow node type in the workflow JSON, alongside `while` and `conditional`. The phase iteration becomes explicit:

```json
{
  "id": "test-all-models",
  "type": "for-each",
  "source": "_phases",
  "itemId": "id",
  "configLookup": true,
  "resetVariables": {
    "currentIteration": 0,
    "currentFitness": 0,
    "_shouldStop": false
  },
  "nodes": [
    { "id": "load-artifact", ... },
    { "id": "test-loop", "type": "while", ... },
    { "id": "finalize-test", ... }
  ]
}
```

The `for-each` handler in `ExecuteConfigNodesAsync`:
1. Reads the `source` session variable (a list of objects)
2. For each item, extracts the ID via `itemId` field
3. Optionally looks up per-item config via `GetWorkflowConfig(workflowId, itemId)`
4. Resets scoped variables from `resetVariables`
5. Updates item status (`pending` → `running` → `done`) if items have a `status` field
6. Executes child nodes with per-item configuration
7. Stores per-item summary via `StorePhaseSummary`

## Consequences

### Positive
- **Transparency**: The phase iteration is visible in the workflow JSON — anyone reading the block definition understands the execution flow
- **Consistency**: Three control flow types (`while`, `conditional`, `for-each`) follow the same dispatch pattern in `ExecuteConfigNodesAsync`
- **Separation**: Per-phase nodes (load, test, finalize) are clearly separated from post-all-phases nodes (doc-tree, write-metrics, format-report)
- **Reusability**: Any workflow can use `for-each` to iterate over any list variable — not tied to phases
- **Data-driven reset**: Variables to reset per iteration are declared in JSON, not hardcoded in C#

### Negative
- **Breaking change**: Existing sessions using implicit phase auto-chaining must update their workflow blocks to include a `for-each` node
- **Slightly more verbose JSON**: The workflow block grows with the `for-each` wrapper, though this is offset by the clarity gain

### Neutral
- **`_phases` variable unchanged**: The template's `_phases` array and `_workflowConfig` structure remain compatible
- **TUI monitor unaffected**: The `for-each` node appears as a parent with children in the execution tree, which the TUI already handles generically

## Alternatives Considered

### 1. Keep implicit `while(true)` loop
Rejected — violates the cardinal rule. The iteration is invisible and creates a "magic" behavior tied to having a `_phases` variable.

### 2. Phase-specific block type
Could have created a `phase-iterator` or `phase-loop` block type. Rejected — too specific. `for-each` is generic and works with any list, not just phases.

### 3. Nested workflow blocks
Could have the outer workflow call an inner workflow per phase. Rejected — adds unnecessary indirection. `for-each` is simpler and keeps everything in one workflow definition.
