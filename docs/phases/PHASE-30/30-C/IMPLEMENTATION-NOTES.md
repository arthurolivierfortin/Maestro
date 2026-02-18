# Phase 30-C Implementation Notes

## Status: COMPLETE — 3/3 tests passing (D-1 simple, D-2 moderate, D-3 complex)

## 30-C-1: Rewrite autonomous-development workflow (DONE)

### Workflow Structure (v2.0.0)

6 sequential nodes:
1. `prepare` → `project-preparer` (agent) — analyze project
2. `plan` → `task-planner` (agent) — decompose task into steps
3. `implement` → `implement-single-step` (agent) — implement all steps
4. `test` → `test-executor` (agent) — detect and run tests
5. `review` → `code-reviewer` (inference) — score quality
6. `commit` → `git-committer` (agent) — create conventional commit

### Data Flow

- `{{inputs.task}}` and `{{inputs.repoPath}}` passed from session invoke
- `{{previousOutput}}` chains sequential outputs
- `{{_nodeResult_prepare}}` used by implement for context/conventions
- `{{_nodeResult_implement}}` and `{{_nodeResult_test}}` used by review
- `{{_nodeResult_implement}}` and `{{_nodeResult_review}}` used by commit

## Critical Bug Fixed: Agent 1-Iteration Bug

### Root Cause

`AgentBlockExecutor.GetCliExecutor()` lazily resolved `ICliExecutor` from `IServiceProvider`.
When agents run through `EntryPointExecutor.StartExecution()`, the workflow executes in a
background `Task.Run` (line 50). The HTTP request scope is disposed before the agent loop
completes, causing `_serviceProvider.GetService<ICliExecutor>()` to throw
`ObjectDisposedException`.

The exception was caught silently at AgentBlockExecutor line 217-220, logging
"LLM parse error (tool detection)" without propagating. `toolCalled` stayed `false`,
breaking the loop after 1 iteration.

### Symptoms

- All agents completing in 4-12s (vs 30-120s standalone)
- Only first LLM response in output (tool call JSON visible but unexecuted)
- No errors in session execution log (exception was caught silently)

### Fix (AgentBlockExecutor.cs)

Added `IServiceScopeFactory` field, resolved from `IServiceProvider` in constructor.
`GetCliExecutor()` now creates a new scope via `_scopeFactory.CreateScope()` to resolve
`ICliExecutor` with a scope that lives as long as the agent execution.

```csharp
private readonly IServiceScopeFactory? _scopeFactory;

// Constructor:
_scopeFactory = serviceProvider?.GetService<IServiceScopeFactory>();

// GetCliExecutor():
if (_scopeFactory != null)
{
    var scope = _scopeFactory.CreateScope();
    _cliExecutor = scope.ServiceProvider.GetService<ICliExecutor>();
    return _cliExecutor;
}
```

### Why Not Eager Resolution

Eagerly resolving `ICliExecutor` in the constructor creates a circular dependency:
`AgentBlockExecutor` → `ICliExecutor` → `IPermissionChecker` → `IProjectSessionServer`
→ `EntryPointExecutor` → `BlockExecutorRegistry` → `AgentBlockExecutor`.

Using `IServiceScopeFactory` avoids this because it creates a NEW scope (separate from
the constructor's scope) and only resolves when needed.

## 30-C-2: Simple Test Results (Add a greet function)

### Test 1 (Session cb7c9abd)

- **Task**: "Add a greet function that returns hello world"
- **Repo**: `C:\temp\git-test` (UTF-8 files, clean git repo)
- **Result**: SUCCESS — all 6 nodes completed
- **Duration**: ~4 minutes total
- **Code change verified**: `hello.ts` has new `greet()` function
- **Git commit**: Agent created commit `2b19a3e` with message "feat(hello): add greet function returning hello world"

### Node execution times

| Node | Duration | Output size |
|------|----------|-------------|
| prepare | 42s | 1527 chars |
| plan | 16s | 871 chars |
| implement | 26s | 663 chars |
| test | 1m51s | 1520 chars |
| review | 18s | 2058 chars |
| commit | 11s | 1951 chars |

### Known Issues

1. **Git commit persistence**: The `shell-execute` tool uses `git -C <path>` which sometimes
   creates commits on a different branch than expected. Need investigation.
2. **UTF-16 files**: If the target repo has UTF-16 encoded files, the `file-read` tool returns
   null-byte-padded content. Agents handle this gracefully but it's confusing.

## 30-C-3: Moderate Test Results (Fix TypeScript errors)

### Test (Session d07d899f)

- **Task**: "Fix all TypeScript compilation errors in this project. Run tsc --noEmit to verify."
- **Repo**: `C:\temp\ts-errors-test` (2 TS files with intentional type errors)
- **Errors to fix**:
  1. `utils.ts:11`: `getAge()` returns `"twenty-five"` (string) but declared as `number`
  2. `main.ts:4`: `add("hello", 5)` passes string where number expected
- **Result**: SUCCESS — file-write tool confirmed working, both errors fixed on disk
- **Duration**: ~6 minutes total (prepare 1.5m, plan 1.5m, implement 1m, test 1m, review 0.5m, commit 0.5m)
- **Verification**: `npx tsc --noEmit` returns exit code 0 after fix

### Fixes Applied by Agent

- `utils.ts`: Changed `return "twenty-five"` → `return 25`
- `main.ts`: Changed `add("hello", 5)` → `add(10, 5)`
- Both fixes confirmed on disk via file size change (288→277 and 242→244 bytes)

### Bug Fixed: CLI --input-json parsing

**Root cause**: The `run` command in `cli.ts` (line 5789) did not parse `--input-json` arguments —
only `--input key=value` was supported. The backend `RunCommandHandler` already handled `--input-json`
correctly, but the CLI frontend never passed it through.

**Fix**: Added `--input-json` parsing to the `run` command in `cli.ts`:
```typescript
if (argv['input-json']) {
  const jsonInputs = JSON.parse(argv['input-json']);
  Object.assign(inputs, jsonInputs);
}
```

**Note**: This only affected direct CLI calls (`node index.js run file-write --input-json ...`).
The agent agentic loop path (CliExecutor → RunCommandHandler → ToolBlockExecutor) was not affected
because it goes through the backend's own CLI parser which already handled `--input-json`.

### Debugging the "file-write reports success but files unchanged" issue

**Initial symptom** (previous session): File-write appeared to work but files were unchanged.
**Root cause**: LLM-Provider (port 5010) was not running. Without the LLM service, agents either:
1. Failed with "connection refused" errors, or
2. Produced hallucinated tool results (claiming success without actual tool execution)

**Lesson**: Always verify LLM-Provider is running (`curl http://localhost:5010/api/v1/health/`)
before running composite workflows. Without it, agents degrade silently.

### Git commit node issues

The `git-committer` agent claims to create commits but they don't appear in `git log`.
Diagnostic logging showed only 1 `shell-execute` call total (from implement node's `tsc --noEmit`),
meaning the commit agent is hallucinating its git operations rather than executing them.
This needs prompt improvement — the agent may be including both tool call AND expected result
in the same response, confusing the agentic loop's tool detection.

### Node Execution Summary

| Node | Block | Duration | Tool Calls | Real Tool Calls |
|------|-------|----------|------------|-----------------|
| prepare | project-preparer | ~1.5m | 5 (dir-list, file-read) | 5 ✓ |
| plan | task-planner | ~1.5m | 4 (dir-list, file-read) | 4 ✓ |
| implement | implement-single-step | ~1m | 4 (file-read, file-write, shell-execute) | 4 ✓ |
| test | test-executor | ~1m | multiple | unclear |
| review | code-reviewer (inference) | ~25s | 0 (single LLM call) | N/A |
| commit | git-committer | ~22s | claims 3 (shell-execute) | 0 ✗ (hallucinated) |

## 30-C-AJUSTEMENT Phase D: Final Results (2026-02-17 to 2026-02-18)

### Summary: 3/3 Tests Passing

| Test | Complexity | Task | Result | Session | Commit |
|------|------------|------|--------|---------|--------|
| D-1 | Simple | "Add a multiply function" | ✅ | 9266d092 | `e73b38c` |
| D-2 | Moderate | "Fix all TypeScript compilation errors" | ✅ | 1d55464f | `0d05433` |
| D-3 | Complex | "Create a FileTree component" | ✅ | 2a8f6e35 | `25b7a5e` |

### Infrastructure Fixes Made During Iteration

1. **repoPath auto-injection** (EntryPointExecutor.cs): Session's `RepositoryPath` auto-injected as `repoPath` variable so `{{inputs.repoPath}}` resolves correctly in workflow nodes.

2. **Multi-tool response guard** (AgentBlockExecutor.cs): When "done" is detected but raw response contains "maestro_cli" earlier, reject the response and ask LLM to re-send only the tool call. Critical for preventing file-write loss.

3. **Multi-tool guard recovery** (AgentBlockExecutor.cs): Don't echo the full response (containing "done") back to the LLM history. Instead, use a synthetic assistant ack and explicit "file was NOT written" message. Without this, the LLM sees its own "done" and doesn't retry the write.

4. **FIFO log limit 50→200** (EntryPointExecutor.cs): Better debugging of multi-step pipelines.

5. **Prompt reinforcements** (implement-single-step/system-prompt.md): "ONE tool call per response", "NEVER combine tool+done", "After file-write, WAIT for result".

### Workflow Architecture (v3, 8 nodes)

```
prepare (project-preparer, claude-opus)
  → plan (task-planner, claude-opus)
  → validate-plan (json-validator, tool)
  → store-plan (set-variable)
  → implement-steps (for-each over _planSteps)
      → implement-step (implement-single-step, claude-sonnet)
      → validate-step (step-validator, tool)
  → test (test-executor, claude-sonnet)
  → review (code-reviewer, inference)
  → commit (git-committer, claude-sonnet)
```

### Anti-Hallucination Mechanisms (All Working)

| Mechanism | Description |
|-----------|-------------|
| Done guard | Rejects "done" with 0 tool calls, forces real work |
| json-validator | Validates plan is proper JSON array with required fields |
| step-validator | Verifies files exist on disk after create/modify actions |
| Multi-tool response guard | Catches tool+done combo, rejects, forces single-tool retry |
| git-committer prompt | Mandatory sequence: status→add→commit→log→done |
| test-executor prompt | Must run actual test commands |
| repoPath auto-injection | Ensures workingDir resolves correctly |

### Known Remaining Issues

1. **test-executor exploration**: Agent sometimes wastes time exploring files instead of running the test command immediately. Can time out on 300s budget. Needs prompt improvement to run tests first, explore second.

2. **step-validator for "modify"**: Only checks file EXISTS, not that content changed. Steps that claim "modify" but don't actually write pass validation. Would need content hash or mtime tracking.

3. **JSON escaping in file-write**: Complex file content (React components with JSX, imports with quotes) sometimes causes JSON parse errors in `--input-json`. Agents recover via retry but waste iterations. Could benefit from a base64 content encoding option.

4. **git-committer iteration budget**: Uses all 8 iterations on complex commits (status + multiple add + commit + log + verify). Consider increasing to 10 for repos with many files.
