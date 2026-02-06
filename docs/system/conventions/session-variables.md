# Session Variables Convention

**Date**: February 6, 2026

---

## Overview

Session variables are a generic key-value store where sessions define their own keys and values. Variables are **template-driven**: they come from the session template JSON, never from hardcoded C# logic.

---

## The Underscore Convention

Variables prefixed with `_` (underscore) are **system/infrastructure variables** used by Maestro infrastructure components (TUI Monitor, workflow executor, etc.).

```
_phases              → Used by phase-list TUI component
currentPhase         → Session-specific variable (no underscore)
```

**Rule**: Infrastructure variables use `_` prefix. Session-specific variables do not.

---

## System Variables Reference

| Variable | Type | Purpose | Used By |
|----------|------|---------|---------|
| `_phases` | array | List of session phases with status | TUI phase-list component |
| `_monitorDescriptor` | object | Layout and components for TUI display | TUI Monitor (descriptor mode) |
| `_executionTree` | array | Current workflow execution tree | TUI workflow-tree component |
| `_activeBlock` | object | Currently executing block details | TUI block-detail component |
| `_executionLog` | array | Scrollable execution log entries | TUI execution-log component |
| `_artifacts` | array | Files produced by session | TUI artifacts component |
| `_activeWorkflow` | string | Current workflow ID | Monitor header |
| `_workflowConfig` | object | Per-workflow configuration | EntryPointExecutor |

---

## Template-Driven Architecture

### How It Works

1. Session template JSON defines initial variables
2. Backend imports template → stores variables in `session.Variables`
3. Workflow executor reads variables as needed
4. TUI Monitor reads variables to render display

### Example Template Variables

```json
{
  "variables": {
    "currentPhase": "exploration",
    "maxIterations": 50,
    "_phases": [
      { "id": "creation", "name": "Phase 1: Creation", "status": "pending" },
      { "id": "optimization", "name": "Phase 2: Optimization", "status": "pending" }
    ],
    "_monitorDescriptor": {
      "layout": { "zones": { "left": { "width": "40%" } } },
      "components": [{ "id": "phases", "type": "phase-list", "data": "$.variables._phases" }]
    }
  }
}
```

---

## Adding New Variable Types

To add a new variable type to a session:

1. Add the variable to your session template JSON
2. Access via `session.GetVariable<T>("variableName")`
3. If needed by TUI, add to `_monitorDescriptor.components[]`

**No C# changes required** — the infrastructure is fully generic.

---

## Variable Access

### Backend (C#)

```csharp
// Read variable
var phases = session.GetVariable<List<Phase>>("_phases");

// Write variable
session.SetVariable("currentPhase", "optimization");
await _repository.SaveAsync(session);
```

### CLI

```bash
# Get variable
maestro session vars <id> get currentPhase

# Set variable
maestro session vars <id> set currentPhase optimization
```

---

## Best Practices

1. Use `_` prefix for infrastructure variables consumed by generic components
2. Use descriptive names without `_` for session-specific business logic
3. Keep system variable schemas consistent (e.g., all phases use same structure)
4. Document your custom variables in the session template's `description` field
5. Never hardcode variable names in infrastructure code — read from template

---

*"Variables are data, not code. Sessions define their data structure."*
