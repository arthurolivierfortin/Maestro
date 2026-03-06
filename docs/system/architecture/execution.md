# Workflow Execution Architecture

This document describes how workflows are executed in Maestro, including the execution engine, entry point system, and template-driven architecture.

---

## Workflow Execution Engine

### Core Execution Model

Workflows are **Directed Acyclic Graphs (DAGs)** executed in topological order with:
- Persistent execution state for pause/resume
- Graceful error handling with configurable retry policies
- Real-time progress updates via SignalR
- Long-running support for workflows that take minutes to hours

### Execution Lifecycle

```
                    ┌─────────┐
                    │ Pending │
                    └────┬────┘
                         │ Start execution
                         ▼
                    ┌─────────┐
            ┌──────▶│ Running │◀──────┐
            │       └────┬────┘       │
            │            │             │
            │   ┌────────┼────────┐   │
            │   │        │        │   │
            │   ▼        ▼        ▼   │
            │ Paused  Failed  Cancelled│
            │   │        │        │   │
            │   │Resume  │Retry   │   │
            └───┘        │        │   │
                         ▼        │   │
                    ┌─────────┐  │   │
                    │Completed│  │   │
                    └─────────┘  │   │
                         ▲       │   │
                         └───────┴───┘
```

### Node Execution Lifecycle

```
┌──────────────┐
│   Pending    │ Initial state
└──────┬───────┘
       │ ExecutionEngine picks node
       ▼
┌──────────────┐
│   Running    │ Node is executing
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
Completed Failed
   │       │
   │       ▼
   │    Retry? ───No──▶ Mark workflow as Failed
   │       │
   │      Yes
   │       │
   └───────┴──▶ Continue to next node
```

---

## Entry Point System

### What Are Entry Points?

Entry points are a **generic mechanism** for invoking workflows by name. They provide a stable API for starting workflows without hardcoding workflow IDs.

### How Entry Points Work

1. **Session Definition**: Template defines entry points
   ```json
   {
     "entryPoints": {
       "start": "workflow:main-loop",
       "custom": "workflow:another-workflow"
     }
   }
   ```

2. **Invocation**: User calls entry point by name
   ```bash
   POST /api/sessions/{id}/invoke/start
   ```

3. **Resolution**: Backend looks up workflow ID from entry point name

4. **Execution**: `EntryPointExecutor` loads and executes the workflow

### Generic CLI Commands

```bash
# Invoke any entry point
maestro session invoke <id> <entry-point-name>

# List available entry points for a session
maestro session entry-points <id>
```

---

## EntryPointExecutor: Template-Driven Execution

### Architecture Principle

`EntryPointExecutor` is **generic infrastructure**. All session-specific content comes from session variables defined in JSON templates.

### Template-Driven Data Sources

| Session Variable | Content | Example |
|------------------|---------|---------|
| `_workflowConfig` | LLM prompts, output paths, eval criteria | `{workflow-id: {llm: {systemPrompt: "..."}}}` |
| `_phases` | Session-specific phase definitions | `[{id: "creation", name: "Creation"}]` |
| `_monitorDescriptor` | TUI layout and widgets | `{layout: {left: 40, right: 60}}` |
| `_entryPoints` | Named workflow mappings | `{start: "workflow:main-loop"}` |

### Execution Flow

```
User invokes entry point
         │
         ▼
EntryPointExecutor.StartExecution()
         │
         ├─ Resolve workflow ID from entry point
         ├─ Load workflow block from IBlockRepository
         ├─ Read _workflowConfig from session variables
         ├─ Read _phases from session variables
         │
         ▼
Build execution tree from workflow block.config.nodes
         │
         ▼
Execute nodes sequentially
         │
         ├─ For each node:
         │    ├─ Update _executionTree variable
         │    ├─ Update _activeWorkflow variable
         │    ├─ Execute node (reads prompts from _workflowConfig)
         │    └─ Save session (TUI monitor reads updated variables)
         │
         ▼
Complete execution
```

### Workflow Config Structure

The `_workflowConfig` variable defines behavior per workflow:

```json
{
  "agent-improvement-loop": {
    "phaseId": "creation",
    "llm": {
      "systemPrompt": "You are a code generator specialized in...",
      "userPromptTemplate": "Generate based on: {{context}}",
      "maxTokens": 1024,
      "temperature": 0.7
    },
    "output": {
      "filename": "gen-commit-tool.json",
      "path": "blocks/"
    },
    "evaluation": {
      "criteria": ["hasJsonStructure", "hasRequiredFields", "minLength"]
    },
    "fallback": {
      "enabled": false
    }
  },
  "another-workflow": {
    "phaseId": "optimization",
    "llm": {
      "systemPrompt": "Different prompt for different workflow..."
    }
  }
}
```

### No Hardcoded Content

**Before (incorrect)**:
```csharp
// Hardcoded prompts in C#
var prompt = "You are a code generator...";
var outputPath = "gen-commit-tool.json";
```

**After (correct)**:
```csharp
// Read from session variables
var config = session.GetVariable<WorkflowConfig>($"_workflowConfig.{workflowId}");
var prompt = config.Llm.SystemPrompt;
var outputPath = config.Output.Filename;
```

---

## Execution Tree Building

Workflows define their structure in `config.nodes`:

```json
{
  "id": "agent-improvement-loop",
  "blockType": "workflow",
  "config": {
    "nodes": [
      {
        "id": "evaluate-current",
        "type": "evaluator",
        "label": "Evaluate current"
      },
      {
        "id": "generate-improvement",
        "type": "generator",
        "label": "Generate improvement"
      },
      {
        "id": "apply-changes",
        "type": "applicator",
        "label": "Apply changes"
      }
    ]
  }
}
```

`EntryPointExecutor` builds the execution tree dynamically from `config.nodes`.

---

## Node Dispatch Pattern

### Current Implementation (Pragmatic)

Dispatch uses pattern matching on node IDs:

```csharp
private async Task ExecuteNodeAsync(ExecutionNode node, ...)
{
    if (node.Id.Contains("evaluate"))
    {
        await ExecuteEvaluateStepAsync(...);
    }
    else if (node.Id.Contains("generate"))
    {
        await ExecuteGenerateStepAsync(...);
    }
    // ...
}
```

This is **temporary** - better than routing by workflow ID, but not fully generic.

### Future Implementation (Fully Generic)

Connect to existing infrastructure:
1. Use `BlockExecutorRegistry` to dispatch each node
2. Each node executed by its `IBlockExecutor`
3. No pattern matching needed

This requires bridging `ExecutionContext` and session variables.

---

## Error Handling

### No Fallback Content

Maestro follows the principle: **errors propagate, no silent failures**.

If a workflow step fails:
- Error is logged to session events
- `_executionTree` updated with error status
- TUI monitor displays error
- Session status set to `Failed`

**No placeholder data is generated**. If LLM fails to generate content, the session fails cleanly rather than proceeding with dummy data.

### Retry Logic

Workflows can define retry policies per node:

```json
{
  "id": "flaky-step",
  "retryPolicy": {
    "maxAttempts": 3,
    "delayMs": 1000,
    "backoffMultiplier": 2.0
  }
}
```

---

## Real-Time Monitoring

### Variable Updates for TUI

During execution, `EntryPointExecutor` updates session variables that the TUI Monitor reads:

| Variable | Updated When | TUI Use |
|----------|--------------|---------|
| `_executionTree` | After each node starts/completes | Display execution progress |
| `_activeWorkflow` | When workflow starts | Show current workflow name |
| `currentPhase` | When phase changes (if session uses phases) | Phase indicator widget |
| Custom metrics | Per workflow logic | Custom widgets |

### Auto-Refresh

The TUI Monitor auto-refreshes every 2 seconds, reading the latest variable values from the session.

---

## Block Executor Hierarchy

Block executors implement `IBlockExecutor` and are registered in DI. The `BlockExecutorRegistry` resolves the correct executor by block type.

```
IBlockExecutor (interface)
├── MultiNodeBlockExecutor (abstract — config.nodes execution via NodeExecutionEngine)
│   ├── WorkflowBlockExecutor — I/O: arbitrary inputs → all variables
│   ├── AgentBlockExecutor — I/O: prompt/messages → text (same as inference)
│   └── ToolBlockExecutor — I/O: defined by block.json schema
├── LLMBlockExecutorBase (abstract — shared LLM plumbing for atomic blocks)
│   └── InferenceBlockExecutor — single LLM call (atomic)
├── ResponseParserBlockExecutor — parse LLM response (atomic)
├── ToolDispatcherBlockExecutor — resolve & execute tool by block-id (atomic)
├── ConversationReadBlockExecutor — read conversation messages (atomic)
├── ConversationAppendBlockExecutor — add message to conversation (atomic)
├── MessageBuilderBlockExecutor — build messages from prompt (atomic)
├── ShellBlockExecutor — execute shell command (atomic)
├── TreeDocumenterBlockExecutor — document file tree (atomic)
├── PhaseBlockExecutor — execute phase with status tracking (atomic)
├── FileReadBlockExecutor — read file content (atomic)
├── ContextBlockExecutor — context management (atomic)
├── DecisionBlockExecutor — conditional branching (atomic)
├── PromptBlockExecutor — template resolution (atomic)
├── TriggerBlockExecutor — event forwarding (atomic)
├── ValidatorBlockExecutor — input validation (atomic)
└── MemoryBlockExecutor — persistent knowledge stores (atomic)
```

### Multi-Node Blocks (Phase 53)

Agent, workflow, and tool blocks share the same internal structure: `config.nodes` defines
the execution graph, `MultiNodeBlockExecutor` delegates to `NodeExecutionEngine` to walk it.
The only difference is the I/O contract (prepare/extract):

| Executor | PrepareExecutionAsync | ExtractResultAsync |
|----------|----------------------|-------------------|
| WorkflowBlockExecutor | Pass inputs through | Return all variables |
| AgentBlockExecutor | Create/reuse conversation, add user prompt | Read `_agentResult` from context |
| ToolBlockExecutor | Pass inputs through | Map outputs from block schema |

All composite blocks **must** have `config.nodes`. Blocks without config.nodes will fail with `InvalidOperationException`.

The `NodeExecutionEngine` handles control flow (while, conditional, sequence, parallel, for-each, set-variable). When it encounters a `blockRef` node, it dispatches via `BlockExecutorRegistry` to the appropriate atomic executor (InferenceBlockExecutor, ShellBlockExecutor, etc.).

### LLMBlockExecutorBase

Abstract base class providing shared LLM plumbing for atomic inference blocks:

| Method | Purpose |
|--------|---------|
| `TryLoadMockResponse()` | Checks for `mock-response.json` in block path |
| `ResolveModelId()` | Input override > config > null (use active model) |
| `ResolveGenerationParams()` | `maxTokens` + `temperature` from config |
| `ResolveTemplate()` | `{{key}}` placeholder resolution |
| `ParseOutputs()` | Structured output extraction from LLM response |
| `ExtractJson()` | JSON extraction from markdown/prose responses |

**Principle**: The executor is mechanical plumbing. All content (prompts, tool descriptions, context strategy) lives in block config, never in C#.

---

## Key Principles

1. **Template-Driven**: All content from session variables, not code
2. **Generic Infrastructure**: Works with ANY session type
3. **No Fallbacks**: Errors propagate clearly
4. **Self-Describing**: Execution tree built from block config
5. **config.nodes Everywhere**: All composite blocks (agent, workflow, tool) define their behavior via config.nodes
6. **Thin Executors**: Composite executors handle only I/O contract; all logic lives in config.nodes and atomic executors

---

*See also: [sessions.md](sessions.md) for session architecture, [blocks.md](blocks.md) for block types*
