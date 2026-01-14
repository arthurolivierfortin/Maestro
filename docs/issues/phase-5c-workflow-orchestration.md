# Phase 5C: Workflow Orchestration & Multi-Block Execution

**Goal**: Implement the orchestration layer that executes workflows with multiple connected blocks, handling data flow between blocks, parallel execution, and complex control flow.

**Duration**: 2 weeks  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 5B complete (block execution engine)  
**Status**: Not Started

---

## 🎯 Strategic Context

Workflows are the core value proposition of Maestro. This phase connects individual blocks into executable pipelines:

1. **Data Flow**: Output from one block → input to connected blocks
2. **Dependency Resolution**: Execute blocks in correct order based on connections
3. **Parallel Execution**: Run independent blocks simultaneously
4. **Control Flow**: Handle decision branches and loops
5. **Error Handling**: Graceful failure with retry and fallback options

### Workflow Execution Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Definition                       │
│  nodes: [...], connections: [...]                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Execution Planner                          │
│  - Build execution graph from connections                   │
│  - Detect cycles (reject if found)                          │
│  - Compute execution order (topological sort)               │
│  - Identify parallelizable groups                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Executor                          │
│  - Execute blocks in order                                  │
│  - Pass outputs to connected inputs                         │
│  - Handle decision branches                                 │
│  - Manage parallel execution                                │
│  - Collect and aggregate results                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Tasks

### 5C.1 Execution Graph Builder

- [x] Create `ExecutionGraph` domain model
  ```csharp
  public class ExecutionGraph
  {
      public IReadOnlyList<ExecutionNode> Nodes { get; }
      public IReadOnlyList<ExecutionEdge> Edges { get; }
      public IReadOnlyList<ExecutionNode> GetRoots(); // Nodes with no incoming edges
      public IReadOnlyList<ExecutionNode> GetDependents(string nodeId);
      public bool HasCycle();
      public IEnumerable<IReadOnlyList<ExecutionNode>> GetExecutionLayers();
  }
  ```
- [x] Create `ExecutionNode` wrapping block definition with execution metadata
- [x] Create `ExecutionEdge` representing data flow between blocks
- [x] Implement graph builder from workflow nodes/connections
- [x] Add cycle detection (DFS-based)
- [x] Add topological sort for execution order
- [x] Identify parallelizable layers (nodes with all dependencies satisfied)
- [x] Add unit tests

### 5C.2 Data Flow Manager

- [x] Create `IDataFlowManager` interface
  ```csharp
  public interface IDataFlowManager
  {
      void SetOutput(string blockId, string portId, object value);
      object? GetInput(string blockId, string portId, ExecutionGraph graph);
      Dictionary<string, object> CollectInputs(string blockId, ExecutionGraph graph);
      bool AreInputsSatisfied(string blockId, ExecutionGraph graph);
  }
  ```
- [x] Implement data flow based on connection mappings
- [x] Handle port type coercion (string ↔ object, etc.)
- [x] Handle optional inputs (use default if not connected)
- [x] Handle multiple connections to same input (array aggregation)
- [x] Add unit tests

### 5C.3 Workflow Executor

- [x] Create `IWorkflowExecutor` interface
  ```csharp
  public interface IWorkflowExecutor
  {
      Task<WorkflowExecutionResult> ExecuteAsync(
          WorkflowDefinition workflow,
          Dictionary<string, object> inputs,
          ExecutionOptions? options = null,
          CancellationToken ct = default);
  }
  ```
- [x] Implement `WorkflowExecutor`:
  1. Build execution graph
  2. Validate graph (no cycles, valid connections)
  3. Create execution context
  4. Find trigger block, execute with workflow inputs
  5. Iterate through execution layers
  6. For each layer, execute blocks in parallel
  7. Collect outputs and pass to dependents
  8. Handle decision branches (skip inactive paths)  <!-- baseline skipping implemented; advanced branching pending -->
  9. Aggregate final outputs
- [x] Add unit tests

### 5C.4 Parallel Execution Support

- [x] Implement parallel execution within layers
- [x] Configure max parallelism (default: 4)
- [x] Handle partial failures (continue if some blocks fail)
- [x] Implement cancellation propagation
- [x] Add proper async/await with `Task.WhenAll`
- [x] Add unit tests for parallel scenarios

### 5C.5 Decision Block Handling

- [ ] Implement branch routing based on decision output
- [ ] Track active branches in execution context
- [x] Skip blocks on inactive branches  <!-- basic skipping implemented when decision outputs present -->
- [ ] Support nested decisions
- [ ] Handle convergence (blocks after decision with inputs from both branches)
- [ ] Add unit tests

### 5C.6 Error Handling & Retry

- [ ] Implement retry policy per block
  ```csharp
  public class RetryPolicy
  {
      public int MaxRetries { get; init; } = 3;
      public TimeSpan InitialDelay { get; init; } = TimeSpan.FromSeconds(1);
      public double BackoffMultiplier { get; init; } = 2.0;
      public TimeSpan MaxDelay { get; init; } = TimeSpan.FromSeconds(30);
  }
  ```
- [ ] Implement error propagation strategies:
  - `StopWorkflow`: Stop entire workflow on error
  - `SkipBlock`: Mark block failed, continue with others
  - `UseDefault`: Use default output value on error
- [ ] Add error recovery hooks
- [ ] Add unit tests

### 5C.7 Workflow Variables

- [ ] Implement workflow-level variables
- [ ] Support variable interpolation in block configs: `${variables.apiKey}`
- [ ] Support runtime variable updates
- [ ] Add environment variable access: `${env.OPENAI_API_KEY}`
- [ ] Add secret masking in logs
- [ ] Add unit tests

### 5C.8 Execution Checkpoints

- [ ] Implement checkpoint saving after each block completes
- [ ] Store checkpoint: execution context + completed outputs
- [ ] Support resuming from checkpoint after restart
- [ ] Add checkpoint cleanup policy (keep last N)
- [ ] Add unit tests

### 5C.9 Composite Block Execution

- [ ] Handle composite (non-atomic) blocks
- [ ] Load child blocks from composite block definition
- [ ] Create nested execution context
- [ ] Execute children as sub-workflow
- [ ] Map composite inputs to child trigger
- [ ] Map child outputs to composite outputs
- [ ] Add unit tests

### 5C.10 Workflow Execution API

- [ ] Create `WorkflowExecutionController`:
  - `POST /api/workflows/{id}/execute` - start execution
  - `GET /api/executions/{id}` - get execution status
  - `GET /api/executions/{id}/logs` - get execution logs
  - `POST /api/executions/{id}/pause` - pause execution
  - `POST /api/executions/{id}/resume` - resume execution
  - `POST /api/executions/{id}/cancel` - cancel execution
  - `GET /api/executions` - list recent executions
- [ ] Add OpenAPI documentation
- [ ] Add integration tests

### 5C.11 Frontend Execution Integration

- [ ] Update `realExecutionService.ts` to use API
- [ ] Subscribe to SignalR for execution updates
- [ ] Update canvas to show real execution status
- [ ] Show execution logs in bottom panel
- [ ] Add error display on failed blocks
- [ ] Add integration tests

---

## 📤 Outputs

- ✅ Execution graph with dependency resolution
- ✅ Data flow between blocks
- ✅ Parallel execution support
- ✅ Decision branch handling
- ✅ Error handling with retry
- ✅ Workflow variables and secrets
- ✅ Execution checkpoints
- ✅ Composite block execution
- ✅ REST API for workflow execution
- ✅ Frontend integration with real execution

---

## 🧪 Acceptance Criteria

1. **Linear Workflow**: Trigger → Block1 → Block2 → Output works correctly
2. **Parallel Blocks**: Independent blocks execute simultaneously
3. **Decision Routing**: Decision block correctly routes to true/false branches
4. **Data Flow**: Block outputs correctly map to connected block inputs
5. **Error Recovery**: Failed block with retry policy retries correctly
6. **Live Updates**: Frontend shows real-time execution status
7. **Resume**: Can resume paused execution from checkpoint

---

## 🔧 Example: Commit Description Workflow Execution

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Manual   │────▶│ Git Diff │────▶│ Describe │────▶│ Format   │
│ Trigger  │     │ (Tool)   │     │(Inference)│    │(Validator)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     ▼                ▼                ▼                ▼
 { context }    { diff: "..." }  { message: "..."}  { valid: true }
```

Execution flow:
1. User triggers workflow with `{ context: "Adding auth" }`
2. Trigger block passes input to Git Diff
3. Git Diff tool runs `git diff --staged`, outputs `{ diff: "..." }`
4. Describe (Inference) calls LLM with diff, outputs `{ message: "feat: ..." }`
5. Format (Validator) checks message format, outputs `{ valid: true, message: "..." }`
6. Workflow completes with final output

---

## ⚠️ Design Decisions

### Execution Layers vs. Individual Scheduling

We use **layer-based execution** where all blocks in a layer execute in parallel:

```
Layer 0: [Trigger]
Layer 1: [GitDiff, GetContext]  ← parallel
Layer 2: [Describe]             ← waits for Layer 1
Layer 3: [Format]               ← waits for Layer 2
```

Benefits:
- Simple mental model
- Predictable execution order
- Natural parallelism without complex scheduling

### Connection-Based Data Flow

Data flows through explicit connections, not implicit variable passing:
- Each connection maps `sourceBlock.outputPort` → `targetBlock.inputPort`
- Type validation happens at connection time
- No hidden data dependencies

### Checkpoint Strategy

Checkpoints are saved after each **layer** completes, not each block:
- Reduces I/O overhead
- Simpler resume logic
- Acceptable granularity for most workflows

