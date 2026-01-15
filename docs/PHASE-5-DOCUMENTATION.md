# Phase 5 Complete Documentation

## Executive Summary

Phase 5 implements the **Block Execution Engine** and **Workflow Orchestration System** for Maestro, enabling the execution of individual blocks and complete workflows with support for parallel execution, data flow management, and real-time monitoring.

> **Status**: 85% Complete (as of Phase 5 Analysis)
> **Version**: 0.1.0-preview
> **Last Updated**: Phase 5 Implementation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Block Types and Executors](#block-types-and-executors)
3. [Execution Engine](#execution-engine)
4. [Workflow Orchestration](#workflow-orchestration)
5. [Data Flow Management](#data-flow-management)
6. [CLI and MCP Tools](#cli-and-mcp-tools)
7. [Usage Guide](#usage-guide)
8. [Testing and Verification](#testing-and-verification)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Maestro Execution Layer                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   CLI (Node.js) │    │  MCP Server     │    │   API (.NET)    │  │
│  │   maestro-cli   │    │  maestro-mcp    │    │   Maestro.Api   │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           │                      │                      │            │
│           └──────────────────────┴──────────────────────┘            │
│                                  │                                    │
│                    ┌─────────────▼─────────────┐                     │
│                    │     ExecutionEngine       │                     │
│                    │  (Single Block Execution) │                     │
│                    └─────────────┬─────────────┘                     │
│                                  │                                    │
│                    ┌─────────────▼─────────────┐                     │
│                    │    WorkflowExecutor       │                     │
│                    │  (Workflow Orchestration) │                     │
│                    └─────────────┬─────────────┘                     │
│                                  │                                    │
│  ┌───────────────────────────────┴───────────────────────────────┐  │
│  │                   BlockExecutorRegistry                        │  │
│  ├───────┬───────┬───────┬───────┬───────┬───────┬───────┬──────┤  │
│  │Prompt │Infer- │ Tool  │Decision│Valid- │ Agent │Trigger│Compo-│  │
│  │Block  │ence   │ Block │ Block  │ator   │ Block │ Block │site  │  │
│  │Exec.  │Block  │ Exec. │ Exec.  │ Block │ Exec. │ Exec. │Block │  │
│  │       │Exec.  │       │        │ Exec. │       │       │Exec. │  │
│  └───────┴───────┴───────┴───────┴───────┴───────┴───────┴──────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Clean Architecture Layers

Phase 5 adheres to Maestro's Clean Architecture:

| Layer | Namespace | Responsibility |
|-------|-----------|----------------|
| **Domain** | `Maestro.Domain` | Entities (BlockDefinition, ExecutionContext, WorkflowDefinition), Value Objects |
| **Application** | `Maestro.Application` | Use Cases, DTOs, Interfaces (IBlockExecutor, ILLMGateway) |
| **Infrastructure** | `Maestro.Infrastructure` | Block Executors, LLM Adapters, Repositories |
| **API** | `Maestro.Api` | Controllers, SignalR Hubs |

### Key Files

| File | Purpose |
|------|---------|
| `ExecutionEngine.cs` | Single block execution with pause/resume/cancel |
| `WorkflowExecutor.cs` | DAG-based workflow orchestration |
| `ExecutionGraph.cs` | Dependency graph and cycle detection |
| `DataFlowManager.cs` | Input/output data flow between nodes |
| `BlockExecutorRegistry.cs` | Maps block types to executors |
| `*BlockExecutor.cs` | Type-specific execution logic |

---

## Block Types and Executors

### Block Type Registry

```csharp
// BlockExecutorRegistry.cs - Maps types to executors
private readonly Dictionary<string, IBlockExecutor> _executors = new()
{
    ["prompt"] = new PromptBlockExecutor(),
    ["inference"] = new InferenceBlockExecutor(),
    ["tool"] = new ToolBlockExecutor(),
    ["decision"] = new DecisionBlockExecutor(),
    ["validator"] = new ValidatorBlockExecutor(),
    ["agent"] = new AgentBlockExecutor(),
    ["trigger"] = new TriggerBlockExecutor(),
    ["composite"] = new CompositeBlockExecutor()
};
```

### 1. Prompt Block (`PromptBlockExecutor`)

**Purpose**: Assembles prompts from templates and input variables.

**Input/Output**:
```yaml
Inputs:
  - Variables to substitute into template
  - Optional context data

Outputs:
  - assembledPrompt: The final prompt string
  - Variables passed through
```

**Example Block**:
```json
{
  "id": "commit-description",
  "type": "prompt",
  "name": "Commit Description Prompt",
  "config": {
    "template": "Generate a commit message for:\n{{diff}}"
  }
}
```

**Execution Logic**:
1. Load template from config or file
2. Substitute `{{variable}}` placeholders with inputs
3. Return assembled prompt as output

### 2. Inference Block (`InferenceBlockExecutor`)

**Purpose**: Sends prompts to LLM providers and returns responses.

**Input/Output**:
```yaml
Inputs:
  - prompt: The assembled prompt to send
  - Optional: model, temperature, max_tokens

Outputs:
  - response: LLM response text
  - usage: Token usage statistics
```

**Example Block**:
```json
{
  "id": "describe-commit",
  "type": "inference",
  "name": "Describe Commit",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 500
  }
}
```

**Execution Logic**:
1. Receive prompt from upstream block
2. Call `ILLMGateway.SendPromptAsync()`
3. Parse and return response

### 3. Tool Block (`ToolBlockExecutor`)

**Purpose**: Executes scripts/commands in subprocess.

**Input/Output**:
```yaml
Inputs:
  - Script inputs as environment/arguments

Outputs:
  - stdout: Standard output
  - stderr: Standard error (if any)
  - Or parsed JSON outputs
```

**Example Block**:
```json
{
  "id": "git-diff",
  "type": "tool",
  "name": "Git Diff Tool",
  "config": {
    "runtime": "bash",
    "script": "git diff --cached",
    "timeoutMs": 10000,
    "parseOutput": "json"
  }
}
```

**Execution Logic**:
1. Create subprocess with configured runtime
2. Set working directory (optional sandbox)
3. Execute script with timeout
4. Capture and return output (optionally parse as JSON)

**Security Note**: See [SECURITY-SANDBOXING.md](./SECURITY-SANDBOXING.md)

### 4. Decision Block (`DecisionBlockExecutor`)

**Purpose**: Evaluates conditions and routes execution flow.

**Input/Output**:
```yaml
Inputs:
  - Condition variables

Outputs:
  - branch: Selected output branch name
  - All inputs passed through
```

**Example Block**:
```json
{
  "id": "check-format",
  "type": "decision",
  "config": {
    "expression": "isValid == true",
    "branches": {
      "true": "continue-output",
      "false": "retry-output"
    }
  }
}
```

### 5. Validator Block (`ValidatorBlockExecutor`)

**Purpose**: Validates data against rules or schemas.

**Input/Output**:
```yaml
Inputs:
  - Data to validate

Outputs:
  - isValid: boolean
  - errors: Array of validation errors (if any)
  - Inputs passed through if valid
```

**Example Block**:
```json
{
  "id": "commit-format",
  "type": "validator",
  "config": {
    "customRules": "custom-rules.js",
    "schema": "commit-schema.json"
  }
}
```

### 6. Agent Block (`AgentBlockExecutor`)

**Purpose**: Specialized agent execution (planning, coding, testing, reviewing).

**Execution Logic**:
1. Initialize agent with configuration
2. Execute agent-specific logic
3. Return agent outputs

### 7. Trigger Block (`TriggerBlockExecutor`)

**Purpose**: Entry points for workflows (webhooks, schedules, manual).

**Types**:
- `manual`: User-triggered execution
- `webhook`: HTTP endpoint trigger
- `schedule`: Cron-based execution (future)

### 8. Composite Block (`CompositeBlockExecutor`)

**Purpose**: Embeds a sub-workflow as a single block.

**Execution Logic**:
1. Load embedded workflow definition
2. Create nested `WorkflowExecutor`
3. Execute sub-workflow
4. Return sub-workflow outputs

---

## Execution Engine

### ExecutionEngine Overview

The `ExecutionEngine` handles single block execution with full lifecycle management.

```csharp
public class ExecutionEngine : IExecutionEngine
{
    private readonly IBlockExecutorRegistry _registry;
    private readonly ILLMGateway _llmGateway;
    
    public async Task<BlockExecutionResult> ExecuteBlockAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default)
    {
        // 1. Get appropriate executor
        var executor = _registry.GetExecutor(block.Type);
        
        // 2. Execute with context
        var result = await executor.ExecuteAsync(block, context, inputs, ct);
        
        // 3. Return result
        return result;
    }
}
```

### Execution Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Created │────▶│  Running │────▶│ Completed│     │  Failed  │
└──────────┘     └────┬─────┘     └──────────┘     └──────────┘
                      │                                  ▲
                      ▼                                  │
                 ┌────────┐                              │
                 │ Paused │──────────────────────────────┘
                 └────────┘
```

### State Management

```csharp
public enum ExecutionStatus
{
    Pending,      // Not yet started
    Running,      // Currently executing
    Paused,       // Execution paused
    Completed,    // Successfully completed
    Failed,       // Execution failed
    Cancelled     // User cancelled
}
```

### Pause/Resume/Cancel

```csharp
// Pause execution
await executionEngine.PauseAsync(executionId);

// Resume execution
await executionEngine.ResumeAsync(executionId);

// Cancel execution
await executionEngine.CancelAsync(executionId);
```

---

## Workflow Orchestration

### WorkflowExecutor Overview

The `WorkflowExecutor` orchestrates complete workflow execution using a DAG-based approach.

### Execution Graph (DAG)

```csharp
public class ExecutionGraph
{
    private readonly Dictionary<string, HashSet<string>> _dependencies;
    private readonly Dictionary<string, HashSet<string>> _dependents;
    
    public ExecutionGraph(
        IEnumerable<WorkflowNode> nodes,
        IEnumerable<WorkflowConnection> connections)
    {
        // Build adjacency lists from connections
        foreach (var conn in connections)
        {
            _dependencies[conn.TargetNodeId].Add(conn.SourceNodeId);
            _dependents[conn.SourceNodeId].Add(conn.TargetNodeId);
        }
        
        // Validate no cycles
        if (HasCycle())
            throw new InvalidOperationException("Workflow contains cycles");
    }
    
    public IEnumerable<string> GetReadyNodes(HashSet<string> completed)
    {
        // Return nodes whose dependencies are all completed
        return _nodes
            .Where(n => !completed.Contains(n.Id))
            .Where(n => _dependencies[n.Id].All(d => completed.Contains(d)));
    }
}
```

### Cycle Detection

```csharp
private bool HasCycle()
{
    var visited = new HashSet<string>();
    var recursionStack = new HashSet<string>();
    
    foreach (var node in _nodes.Keys)
    {
        if (DetectCycleDFS(node, visited, recursionStack))
            return true;
    }
    return false;
}

private bool DetectCycleDFS(string node, HashSet<string> visited, HashSet<string> stack)
{
    if (stack.Contains(node)) return true;  // Cycle found
    if (visited.Contains(node)) return false;
    
    visited.Add(node);
    stack.Add(node);
    
    foreach (var dependent in _dependents[node])
    {
        if (DetectCycleDFS(dependent, visited, stack))
            return true;
    }
    
    stack.Remove(node);
    return false;
}
```

### Parallel Execution

```csharp
public async Task ExecuteWorkflowAsync(
    WorkflowDefinition workflow,
    Dictionary<string, object> initialInputs,
    CancellationToken ct = default)
{
    var graph = new ExecutionGraph(workflow.Nodes, workflow.Connections);
    var completed = new HashSet<string>();
    var dataFlow = new DataFlowManager();
    
    // Initialize with trigger inputs
    dataFlow.SetNodeOutputs("trigger", initialInputs);
    
    using var semaphore = new SemaphoreSlim(_maxParallelism);
    
    while (completed.Count < workflow.Nodes.Count)
    {
        var ready = graph.GetReadyNodes(completed).ToList();
        
        if (!ready.Any())
            throw new InvalidOperationException("Workflow deadlock detected");
        
        // Execute ready nodes in parallel
        var tasks = ready.Select(async nodeId =>
        {
            await semaphore.WaitAsync(ct);
            try
            {
                var node = workflow.Nodes.First(n => n.Id == nodeId);
                var inputs = dataFlow.GetNodeInputs(nodeId, workflow.Connections);
                
                var result = await _engine.ExecuteBlockAsync(
                    node.Block, _context, inputs, ct);
                
                dataFlow.SetNodeOutputs(nodeId, result.Outputs);
                completed.Add(nodeId);
            }
            finally
            {
                semaphore.Release();
            }
        });
        
        await Task.WhenAll(tasks);
    }
}
```

---

## Data Flow Management

### DataFlowManager

```csharp
public class DataFlowManager
{
    private readonly Dictionary<string, Dictionary<string, object>> _nodeOutputs = new();
    
    public void SetNodeOutputs(string nodeId, Dictionary<string, object> outputs)
    {
        _nodeOutputs[nodeId] = outputs;
    }
    
    public Dictionary<string, object> GetNodeInputs(
        string nodeId,
        IEnumerable<WorkflowConnection> connections)
    {
        var inputs = new Dictionary<string, object>();
        
        var incomingConnections = connections
            .Where(c => c.TargetNodeId == nodeId);
        
        foreach (var conn in incomingConnections)
        {
            if (_nodeOutputs.TryGetValue(conn.SourceNodeId, out var outputs))
            {
                // Map source output to target input
                var key = conn.TargetPort ?? conn.SourcePort ?? "default";
                if (outputs.TryGetValue(conn.SourcePort ?? "default", out var value))
                {
                    inputs[key] = value;
                }
            }
        }
        
        return inputs;
    }
}
```

### Connection Schema

```json
{
  "sourceNodeId": "git-diff",
  "sourcePort": "diff",
  "targetNodeId": "commit-prompt",
  "targetPort": "changes"
}
```

---

## CLI and MCP Tools

### Maestro CLI (`tools/maestro-cli`)

**Purpose**: Command-line interface for workflow operations.

**Current Status**: Proof-of-Concept (mock execution only)

**Commands**:

```bash
# List available blocks
maestro list blocks

# Execute a single block (mock)
maestro execute block git-diff --input repo=.

# Execute a workflow (mock)
maestro execute workflow commit-generator

# Validate a workflow
maestro validate workflow commit-generator
```

**Usage Example**:

```bash
cd tools/maestro-cli
npm install
npm link

# Now available globally
maestro --help
```

### Maestro MCP Server (`tools/maestro-mcp`)

**Purpose**: Model Context Protocol server for AI integration.

**Current Status**: Proof-of-Concept with stdio transport

**Available Tools**:

| Tool | Description |
|------|-------------|
| `list_blocks` | List all available blocks |
| `execute_block` | Execute a single block |
| `list_workflows` | List available workflows |
| `execute_workflow` | Execute a complete workflow |
| `get_workflow_status` | Get execution status |

**Configuration (Claude Desktop)**:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["path/to/maestro-mcp/src/index.js"],
      "env": {
        "BLOCKS_PATH": "path/to/blocks",
        "WORKFLOWS_PATH": "path/to/workflows"
      }
    }
  }
}
```

---

## Usage Guide

### Running a Single Block

#### Via .NET API

```csharp
// Get the execution engine from DI
var engine = serviceProvider.GetRequiredService<IExecutionEngine>();

// Load block definition
var block = await blockRepository.GetByIdAsync("git-diff");

// Create execution context
var context = new ExecutionContext 
{ 
    Id = Guid.NewGuid(),
    WorkingDirectory = "/path/to/repo" 
};

// Execute
var result = await engine.ExecuteBlockAsync(
    block,
    context,
    new Dictionary<string, object> { ["repository"] = "." },
    CancellationToken.None
);

Console.WriteLine($"Success: {result.Success}");
Console.WriteLine($"Outputs: {JsonSerializer.Serialize(result.Outputs)}");
```

#### Via CLI (Mock)

```bash
maestro execute block git-diff --input repository=.
```

### Running a Workflow

#### Via .NET API

```csharp
var executor = serviceProvider.GetRequiredService<IWorkflowExecutor>();

// Load workflow
var workflow = await workflowRepository.GetByIdAsync("commit-generator");

// Execute
var result = await executor.ExecuteAsync(
    workflow,
    new Dictionary<string, object> 
    { 
        ["repository"] = ".",
        ["staged_only"] = true 
    },
    CancellationToken.None
);

// Get outputs from final node
var commitMessage = result.GetNodeOutput("validator", "validated_message");
```

#### Via CLI (Mock)

```bash
maestro execute workflow commit-generator \
  --input repository=. \
  --input staged_only=true
```

### Creating a Custom Block

1. **Create block directory**:
   ```
   blocks/tools/my-tool/
   ├── block.json
   ├── run.ps1 (or run.sh)
   └── output-schema.json
   ```

2. **Define block.json**:
   ```json
   {
     "id": "my-tool",
     "type": "tool",
     "name": "My Custom Tool",
     "version": "1.0.0",
     "inputs": {
       "required": ["input1"],
       "optional": ["input2"]
     },
     "outputs": ["result"],
     "config": {
       "runtime": "powershell",
       "scriptFile": "run.ps1",
       "timeoutMs": 30000,
       "parseOutput": "json"
     }
   }
   ```

3. **Create script**:
   ```powershell
   # run.ps1
   param($input1, $input2 = "default")
   
   $result = @{
       result = "Processed: $input1, $input2"
       timestamp = Get-Date -Format "o"
   }
   
   $result | ConvertTo-Json
   ```

### Creating a Custom Workflow

1. **Create workflow directory**:
   ```
   workflows/my-workflow/
   ├── workflow.json
   ├── nodes.json
   └── connections.json
   ```

2. **Define nodes.json**:
   ```json
   [
     {
       "id": "trigger",
       "blockId": "manual-trigger",
       "position": { "x": 100, "y": 100 }
     },
     {
       "id": "process",
       "blockId": "my-tool",
       "position": { "x": 300, "y": 100 }
     },
     {
       "id": "output",
       "blockId": "json-output",
       "position": { "x": 500, "y": 100 }
     }
   ]
   ```

3. **Define connections.json**:
   ```json
   [
     {
       "sourceNodeId": "trigger",
       "sourcePort": "output",
       "targetNodeId": "process",
       "targetPort": "input1"
     },
     {
       "sourceNodeId": "process",
       "sourcePort": "result",
       "targetNodeId": "output",
       "targetPort": "data"
     }
   ]
   ```

---

## Testing and Verification

### Running Unit Tests

```bash
# JavaScript block tests
cd blocks
npm test

# .NET unit tests
cd backend
dotnet test tests/Maestro.Workflows.Tests
```

### Running Integration Tests

```bash
# JavaScript integration tests
cd backend/tests/Maestro.Workflows.Integration
npm test

# .NET integration tests
dotnet test tests/Maestro.Workflows.Integration
```

### Manual Verification Steps

#### 1. Verify Block Discovery

```bash
# List discovered blocks
curl http://localhost:5000/api/blocks

# Expected: Array of BlockDto with id, type, name, version
```

#### 2. Verify Single Block Execution

```bash
# Execute git-diff block
curl -X POST http://localhost:5000/api/blocks/git-diff/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"repository": "."}}'

# Expected: BlockExecutionResult with success=true, outputs, logs
```

#### 3. Verify Workflow Execution

```bash
# Execute commit-generator workflow
curl -X POST http://localhost:5000/api/workflows/commit-generator/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"repository": ".", "staged_only": true}}'

# Expected: WorkflowExecutionResult with all node results
```

#### 4. Verify Parallel Execution

```csharp
// In test code - verify nodes execute in parallel
var workflow = CreateParallelWorkflow();  // 3 independent nodes
var sw = Stopwatch.StartNew();

await executor.ExecuteAsync(workflow, inputs);

sw.Stop();
// If each node takes 1s, parallel should complete in ~1s, not 3s
Assert.True(sw.ElapsedMilliseconds < 2000);
```

#### 5. Verify Cycle Detection

```csharp
// This should throw
var cyclicWorkflow = new WorkflowDefinition
{
    Nodes = new[] { nodeA, nodeB },
    Connections = new[]
    {
        new Connection { Source = "A", Target = "B" },
        new Connection { Source = "B", Target = "A" }  // Cycle!
    }
};

Assert.Throws<InvalidOperationException>(() => 
    new ExecutionGraph(cyclicWorkflow.Nodes, cyclicWorkflow.Connections));
```

### Test Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Domain Entities | 90% |
| Execution Engine | 85% |
| Block Executors | 80% |
| Workflow Executor | 80% |
| Data Flow Manager | 85% |

---

## Troubleshooting

### Common Issues

#### "Block executor not found"

**Cause**: Block type not registered in `BlockExecutorRegistry`.

**Solution**:
```csharp
// Ensure executor is registered
services.AddSingleton<IBlockExecutor, MyBlockExecutor>();
```

#### "Workflow contains cycles"

**Cause**: Circular dependency in workflow connections.

**Solution**: Check `connections.json` for circular references. Use the DAG validator in workflow editor.

#### "Workflow deadlock detected"

**Cause**: Node dependencies that can never be satisfied.

**Solution**: Verify all source nodes in connections exist and have valid output ports.

#### "Process killed after timeout"

**Cause**: Tool script exceeded `timeoutMs`.

**Solution**: Increase timeout or optimize script:
```json
{
  "config": {
    "timeoutMs": 60000
  }
}
```

#### "Failed to parse stdout as JSON"

**Cause**: Script output is not valid JSON when `parseOutput: "json"`.

**Solution**: Ensure script outputs valid JSON only, or remove `parseOutput` config.

### Debug Logging

Enable detailed logging:

```json
// appsettings.Development.json
{
  "Logging": {
    "LogLevel": {
      "Maestro.Infrastructure.BlockExecutors": "Debug",
      "Maestro.Infrastructure.Orchestration": "Debug"
    }
  }
}
```

### Execution Monitoring

Use SignalR for real-time monitoring:

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/executionHub")
    .build();

connection.on("NodeStarted", (nodeId) => {
    console.log(`Node ${nodeId} started`);
});

connection.on("NodeCompleted", (nodeId, result) => {
    console.log(`Node ${nodeId} completed:`, result);
});

connection.on("WorkflowCompleted", (result) => {
    console.log("Workflow completed:", result);
});

await connection.start();
```

---

## Appendix

### A. Block Schema Reference

See [block.schema.json](./schemas/block.schema.json)

### B. Workflow Schema Reference

See [workflow-schema.json](./schemas/workflow-schema.json)

### C. Security Documentation

See [SECURITY-SANDBOXING.md](./SECURITY-SANDBOXING.md)

### D. Related Documentation

- [Backend Guide](./backend-guide.md)
- [Workflow Engine Guide](./workflow-engine-guide.md)
- [Agents and Tools Guide](./agents-and-tools-guide.md)
- [MCP Setup Guide](./mcp-setup.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | Phase 5 | Initial implementation |

---

*Document generated during Phase 5 Analysis and Documentation effort.*
