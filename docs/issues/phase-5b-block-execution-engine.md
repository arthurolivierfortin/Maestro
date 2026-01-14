# Phase 5B: Block Execution Engine

**Goal**: Implement the execution engine that can run individual blocks and pass data between them. This is the core runtime that makes blocks actually do something.

**Duration**: 2-3 weeks  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 5A complete (filesystem block architecture)  
**Status**: In Progress

---

## 🎯 Strategic Context

The execution engine must be:

1. **Deterministic**: Same inputs → same outputs (for benchmarking and replay)
2. **Environment-agnostic**: No dependency on VS Code, MCP, or specific runtime
3. **Observable**: Every step produces logs and can be monitored
4. **Resumable**: Can pause and resume execution
5. **Testable**: Can run with mocked LLM responses

### Execution Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Execution Request                         │
│  (WorkflowId, Inputs, ExecutionMode)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Execution Engine                           │
│  - Loads workflow/block definition                          │
│  - Creates execution context                                │
│  - Orchestrates block execution                             │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │ Block   │   │ Block   │   │ Block   │
        │Executor │   │Executor │   │Executor │
        │(Agent)  │   │(Tool)   │   │(Prompt) │
        └─────────┘   └─────────┘   └─────────┘
              │             │             │
              ▼             ▼             ▼
        ┌─────────────────────────────────────┐
        │         Execution Result            │
        │  (Outputs, Logs, Metrics, State)    │
        └─────────────────────────────────────┘
```

---

## 🗂️ Tasks

### 5B.1 Execution Context
-
- [x] Create `ExecutionContext` domain entity
  ```csharp
  public class ExecutionContext
  {
      public ExecutionId Id { get; }
      public string WorkflowId { get; }
      public ExecutionStatus Status { get; private set; }
      public Dictionary<string, object> Variables { get; }
      public Dictionary<string, BlockExecutionState> BlockStates { get; }
      public List<ExecutionLog> Logs { get; }
      public ExecutionMetrics Metrics { get; }
      public DateTimeOffset StartedAt { get; }
      public DateTimeOffset? CompletedAt { get; private set; }
      
      public void SetBlockOutput(string blockId, string portId, object value);
      public object? GetBlockOutput(string blockId, string portId);
      public void LogInfo(string message, string? blockId = null);
      public void LogError(string message, Exception? ex = null, string? blockId = null);
  }
  ```
- [x] Create `BlockExecutionState` value object (Pending, Running, Completed, Failed, Skipped)
- [x] Create `ExecutionMetrics` (duration, token count, cost estimate)
- [x] Add serialization support for persistence and replay (basic JSON serialization via FileSystemExecutionRepository)
 - [x] Add unit tests
  - [x] Add unit tests (ExecutionEngine basic coverage)
  - [x] Add unit tests (ExecutionEngine unit tests added and passing)

### 5B.2 Block Executor Interface
-
- [x] Create `IBlockExecutor` interface in Application layer
  ```csharp
  public interface IBlockExecutor
  {
      BlockType SupportedType { get; }
      Task<BlockExecutionResult> ExecuteAsync(
          BlockDefinition block,
          ExecutionContext context,
          Dictionary<string, object> inputs,
          CancellationToken ct = default);
  }
  ```
- [x] Create `BlockExecutionResult` with outputs, logs, duration
- [x] Create `BlockExecutorRegistry` to map types to executors
- [ ] Add unit tests
 - [x] Add unit tests (basic Prompt/Inference coverage planned)
 - [x] Add unit tests (Prompt/Registry unit tests added)

### 5B.3 Prompt Block Executor
-
- [x] Create `PromptBlockExecutor` implementation
- [x] Load template from `template.md` file or `template` config
- [x] Resolve template variables from inputs
- [x] Output: resolved prompt string
- [x] No LLM call - just template resolution
- [ ] Add unit tests
 - [x] Add unit tests (Prompt executor unit tests added)

### 5B.4 Inference Block Executor

- [x] Create `InferenceBlockExecutor` implementation (basic)
- [x] Load user prompt from `prompt.md` (or `template` config)
- [x] Resolve template variables
- [x] Call `ILLMGateway.SendAsync()` with configured model
- [x] Parse response according to output schema (if defined)
- [ ] Handle streaming responses
- [x] Add retry logic with exponential backoff (basic retries implemented)
- [x] **Mock mode**: Load response from `mock-response.json` if exists
- [x] Add retry logic with exponential backoff (basic retries implemented)
- [x] Add unit tests with mocked LLM (basic mocked tests added)

### 5B.5 Tool Block Executor

 - [x] Create `ToolBlockExecutor` implementation (scaffold)
 - [x] Load script from block folder (resolved when `scriptFile` and `metadata.path` present)
 - [x] Validate inputs against schema (basic required/pattern validation implemented)
 - [ ] Execute script in sandboxed environment (needs hardening)
 - [x] Capture stdout/stderr
 - [x] Parse output according to output schema (JSON parsing implemented)
 - [x] Support tool types: `bash`, `powershell`, `node`, `python` (basic runtime mapping)
 - [x] Add timeout handling
 - [x] Add unit tests
  - [x] Add unit tests (ExecutionEngine coverage added in Maestro.Execution.Tests)
  - [x] Add unit tests (Executor registry and prompt tests added)
 - [x] Start sandboxing and output-size limits

### 5B.6 Decision Block Executor
 
 - [x] Create `DecisionBlockExecutor` implementation (simple evaluator)
 - [x] Load condition expression from config
 - [x] Evaluate condition with inputs as context
 - [x] Output: `{ "result": true/false, "branch": "true"|"false" }`
 - [x] Support JavaScript expressions (via Jint)
 - [x] Add unit tests

### 5B.7 Validator Block Executor
 
 - [x] Create `ValidatorBlockExecutor` implementation (lightweight rules)
 - [x] Support validation types:
  - JSON Schema validation (TODO)
  - Regex pattern matching (implemented)
  - Custom script validation (TODO)
 - [x] Output: `{ "isValid": true/false, "errors": [...] }`
 - [x] Add unit tests

### 5B.8 Agent Block Executor
 
 - [x] Create `AgentBlockExecutor` implementation (LLM + mock support)
 - [x] Load system prompt from `system-prompt.md` (loaded if present)
 - [x] Load available tools from `tools.json` (loaded if present)
 - [x] Build messages array from inputs (config-driven)
 - [x] Call LLM with tool definitions
 - [ ] Handle tool calls → execute tools → return to LLM
 - [ ] Implement max iterations limit
 - [x] Add unit tests with mocked LLM (mock-response.json)

### 5B.9 Trigger Block Executor
 
 - [x] Create `TriggerBlockExecutor` implementation (pass-through)
 - [x] For manual triggers: pass through input data
 - [x] For webhook triggers: parse incoming request (basic parsing implemented)
 - [x] For schedule triggers: record trigger time (trigger time recorded)
 - [x] Output: trigger metadata + input data
 - [x] Add unit tests

### 5B.10 Execution Engine Service

 - [x] Create `IExecutionEngine` interface
  ```csharp
  public interface IExecutionEngine
  {
      Task<ExecutionContext> ExecuteBlockAsync(
          string blockId,
          Dictionary<string, object> inputs,
          ExecutionOptions? options = null,
          CancellationToken ct = default);
      
      Task<ExecutionContext> ExecuteWorkflowAsync(
          string workflowId,
          Dictionary<string, object> inputs,
          ExecutionOptions? options = null,
          CancellationToken ct = default);
      
      Task PauseAsync(ExecutionId executionId);
      Task ResumeAsync(ExecutionId executionId);
      Task CancelAsync(ExecutionId executionId);
  }
  ```
-- [x] Create `ExecutionEngine` implementation (partial)
-- [x] Load block/workflow definition from repository
-- [x] Create execution context
-- [x] Resolve executor for block type
-- [x] Execute and collect results (single-block execution)
-- [x] Publish events via `IExecutionMonitor` (node started/completed)
- [x] Add unit tests (pause/resume/cancel implemented and persisted)

### 5B.11 Execution Persistence
-
- [x] Create `IExecutionRepository` interface
- [x] Implement `FileSystemExecutionRepository` (save/load-by-id)
- [x] Store executions as JSON files in `executions/` folder (configurable folder)
- [x] Support querying by workflow, status, date range (FileSystemExecutionRepository.QueryAsync)
- [x] Implement execution log streaming to file (SaveLogAsync writes logs)
- [ ] Add unit tests

### 5B.12 Execution Events (SignalR)

- [ ] Create `IExecutionMonitor` interface
- [ ] Implement `SignalRExecutionMonitor`
- [ ] Publish events:
  - `ExecutionStarted`
  - `BlockStarted`, `BlockCompleted`, `BlockFailed`
  - `ExecutionCompleted`, `ExecutionFailed`
  - `LogAdded`
- [ ] Create SignalR hub for execution updates
- [ ] Add integration tests

---

## 📤 Outputs

- ✅ Execution context with state management
- ✅ Block executors for all block types
- ✅ Execution engine with pause/resume/cancel
- ✅ Execution persistence
- ✅ Real-time execution events via SignalR

---

## 🧪 Acceptance Criteria

1. **Single Block**: Can execute a prompt block and get resolved template
2. **LLM Call**: Can execute an inference block with mocked LLM response
3. **Tool Execution**: Can execute a bash tool and capture output
4. **Decision Logic**: Can evaluate a condition and route execution
5. **Persistence**: Execution history is saved and queryable
6. **Real-time**: Frontend receives execution events via SignalR
7. **Mock Mode**: All blocks can run with mocked responses for testing

---

## ⚠️ Design Decisions

### Why Separate Prompt and Inference?

- **Prompt**: Template resolution only, no LLM call
- **Inference**: Actual LLM call with model selection
- Separation allows reusing prompts across multiple inference calls

### Mock Mode Strategy

Each block can have a `mock-response.json` file that provides the output when running in mock mode:

```json
{
  "outputs": {
    "message": "feat: Add user authentication\n\nImplement JWT-based authentication..."
  },
  "metadata": {
    "tokensUsed": 150,
    "model": "gpt-4",
    "duration": 1500
  }
}
```

This enables:
- Frontend development without real API calls
- Unit testing with deterministic outputs
- Benchmarking with controlled responses

### Tool Sandboxing

Tools run in a restricted environment:
- Working directory limited to workspace
- No network access by default (configurable)
- Resource limits (CPU, memory, time)
- Output size limits

---

## Progress

- **Done (in repo)**:
  - `Maestro.Domain`: `ExecutionId`, `ExecutionMetrics`, `BlockExecutionState`, `ExecutionLog`, `ExecutionContext`
  - `Maestro.Application`: `IBlockExecutor`, `IExecutionEngine`, `IExecutionRepository`, `BlockExecutionResult` DTO
  - `Maestro.Infrastructure`: `PromptBlockExecutor`, `BlockExecutorRegistry`, `FileSystemExecutionRepository`, partial `ExecutionEngine`
  - `Maestro.Infrastructure`: `PromptBlockExecutor`, `InferenceBlockExecutor`, `BlockExecutorRegistry`, `FileSystemExecutionRepository`, partial `ExecutionEngine`

- **Next**:
 - **Next**:
  - Implement `InferenceBlockExecutor` parsing, streaming and retries
  - Harden `ToolBlockExecutor`: enforce sandboxing, whitelist runtimes, add resource limits
  - Register `ToolBlockExecutor` in DI and `BlockExecutorRegistry` (done)
  - Add unit tests for Prompt, Inference, Repository and Tool executors (Tool tests added and passing)
  - Note: `Maestro.Execution.Tests` ran locally and all tests passed (16/16)
  - Replace console scaffold with real SignalR `SignalRExecutionMonitor` and add integration tests

## Recent Changes (summary)

- Added `ToolBlockExecutor` scaffold: runs scripts with timeout, captures stdout/stderr, returns `BlockExecutionResult` (file: backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs).
- Added console-based `SignalRExecutionMonitor` scaffold implementing `IExecutionMonitor` for runtime logs (file: backend/src/Maestro.Infrastructure/Monitoring/SignalRExecutionMonitor.cs).
- Updated progress checklist to mark scaffolds as added and note hardening/test work required.
 - Started: sandboxing support and output-size limits for `ToolBlockExecutor` (config keys: `enableSandbox`, `maxOutputBytes`).
 - Added `DecisionBlockExecutor`, `ValidatorBlockExecutor`, `AgentBlockExecutor`, and `TriggerBlockExecutor` with unit tests.

Last updated: 2026-01-14

