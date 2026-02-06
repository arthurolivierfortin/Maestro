# Error Handling Convention

**Date**: February 6, 2026

---

## Core Principle: No Silent Failures

When something goes wrong in Maestro, **errors propagate visibly** to the user. Never catch an error and silently replace it with fake data or default content.

---

## The Rules

### 1. No Fallback Content

**Wrong:**
```csharp
try {
    var result = await _llmGateway.SendAsync(request);
    return result.Content;
}
catch {
    // Silent failure — user has no idea LLM is down
    return "// TODO: Generated code here";
}
```

**Right:**
```csharp
try {
    var result = await _llmGateway.SendAsync(request);
    return result.Content;
}
catch (Exception ex) {
    // Error propagates to execution tree
    throw new BlockExecutionException("LLM request failed", ex);
}
```

### 2. Errors Show in Execution Tree

When a block fails, its status becomes `"error"` in `_executionTree`:

```json
{
  "id": "generate-improvement",
  "status": "error",
  "error": "LLM Gateway unavailable: Connection refused"
}
```

### 3. Monitor Shows Errors in Red

The TUI Monitor displays failed nodes with `✗` in red:

```
├─ ✗ generate-improvement  [error]
│   → LLM Gateway unavailable: Connection refused
```

### 4. User Decides Next Steps

After an error, the user chooses the action:
- Retry the workflow
- Skip the failed step
- Abort the session
- Fix configuration and restart

**Maestro never decides for the user.**

---

## Implementation

### Block Executors

```csharp
public async Task<ExecutionResult> ExecuteAsync(ExecutionContext context)
{
    try {
        // Execute block logic
        return ExecutionResult.Success(output);
    }
    catch (Exception ex) {
        return ExecutionResult.Failure(ex.Message, ex);
    }
}
```

### Workflow Executor

```csharp
foreach (var node in workflow.Nodes) {
    var result = await _executor.ExecuteAsync(context);

    if (!result.Success) {
        node.Status = NodeStatus.Error;
        node.Error = result.ErrorMessage;
        await UpdateExecutionTree();
        break; // Stop workflow execution
    }
}
```

---

## Common Scenarios

| Scenario | Behavior |
|----------|----------|
| LLM service down | Block fails, error shown, workflow stops |
| File not found | Block fails, error shown, workflow stops |
| Invalid configuration | Block fails, error shown, workflow stops |
| Network timeout | Block fails, error shown, workflow stops |

**Never** substitute with placeholder data.

---

*"Fail loudly. The user is in control."*
