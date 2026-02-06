# Workflow Engine Development Guide

> **Purpose**: This guide defines how to build the workflow execution engine, including execution philosophy, node lifecycle, error handling, and long-running execution considerations.

---

## 🎯 Workflow Engine Philosophy

### Core Principles

1. **DAG Execution**: Workflows are Directed Acyclic Graphs (DAGs) executed in topological order
2. **State Management**: Persistent execution state for pause/resume capabilities
3. **Error Resilience**: Graceful error handling with configurable retry policies
4. **Real-Time Monitoring**: Live progress updates via SignalR
5. **Long-Running Support**: Background execution for workflows that run minutes to hours

### What the Engine IS

- ✅ **Execution orchestrator** for multi-node workflows
- ✅ **State machine** managing execution lifecycle
- ✅ **Data pipeline** passing outputs between nodes
- ✅ **Error handler** with retry and recovery logic
- ✅ **Progress tracker** publishing real-time events

### What the Engine is NOT

- ❌ **Not a task scheduler** - no cron or scheduled execution (Phase 1)
- ❌ **Not a parallel executor** - sequential execution initially (parallel in Phase 2)
- ❌ **Not a distributed system** - single-machine execution
- ❌ **Not a workflow designer** - only executes workflows, doesn't create them

---

## 🔄 Workflow Execution Lifecycle

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

### State Definitions

- **Pending**: Workflow queued, not yet started
- **Running**: Actively executing nodes
- **Paused**: Temporarily suspended (can be resumed)
- **Completed**: All nodes successfully executed
- **Failed**: Execution failed (retries exhausted)
- **Cancelled**: User-initiated cancellation

---

## 🧩 Node Execution Model

### Node Lifecycle

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

### Node Types and Execution

#### 1. Agent Node
- **Purpose**: Execute an AI agent (Planner, Coder, Tester, etc.)
- **Execution**:
  1. Load agent configuration
  2. Prepare agent input (context, previous outputs, tools)
  3. Call agent via IAgent interface
  4. Agent uses ILLMGateway to communicate with LLM
  5. Parse and validate agent output
  6. Store output in ExecutionContext

#### 2. Tool Node
- **Purpose**: Execute a tool (bash command, git operation, file system access)
- **Execution**:
  1. Load tool configuration
  2. Validate tool permissions
  3. Execute tool via IToolExecutor
  4. Capture stdout/stderr
  5. Store output in ExecutionContext

#### 3. Decision Node
- **Purpose**: Conditional branching based on previous outputs
- **Execution**:
  1. Evaluate condition (JavaScript expression or simple comparison)
  2. Determine which output port to activate
  3. Route execution flow accordingly

#### 4. Validator Node
- **Purpose**: Validate outputs against rules or schemas
- **Execution**:
  1. Load validation rules
  2. Apply rules to input data
  3. Pass or fail based on validation result
  4. Optionally halt execution on failure

#### 5. Trigger Node
- **Purpose**: Initiate workflow execution
- **Types**:
  - Manual: User-initiated
  - Webhook: HTTP POST to trigger endpoint
  - Schedule: Cron-based (future)

---

## 🔧 ExecutionEngine Implementation

### Core Components

```csharp
public interface IExecutionEngine
{
    /// <summary>
    /// Executes a workflow asynchronously.
    /// </summary>
    Task<ExecutionResult> ExecuteAsync(Workflow workflow, CancellationToken cancellationToken);
    
    /// <summary>
    /// Pauses an active execution.
    /// </summary>
    Task PauseAsync(ExecutionId executionId, CancellationToken cancellationToken);
    
    /// <summary>
    /// Resumes a paused execution.
    /// </summary>
    Task ResumeAsync(ExecutionId executionId, CancellationToken cancellationToken);
    
    /// <summary>
    /// Cancels an active execution.
    /// </summary>
    Task CancelAsync(ExecutionId executionId, CancellationToken cancellationToken);
}

public class ExecutionEngine : IExecutionEngine
{
    private readonly INodeExecutor _nodeExecutor;
    private readonly IExecutionMonitor _monitor;
    private readonly IExecutionContextRepository _contextRepository;
    private readonly ILogger<ExecutionEngine> _logger;
    
    public async Task<ExecutionResult> ExecuteAsync(Workflow workflow, CancellationToken cancellationToken)
    {
        // 1. Create execution context
        var context = ExecutionContext.Create(workflow);
        
        // 2. Publish start event
        await _monitor.StartExecutionAsync(context.Id, cancellationToken);
        
        try
        {
            // 3. Get execution order (topological sort)
            var executionOrder = GetExecutionOrder(workflow);
            
            // 4. Execute nodes in order
            foreach (var node in executionOrder)
            {
                cancellationToken.ThrowIfCancellationRequested();
                
                // Execute node
                var nodeResult = await _nodeExecutor.ExecuteAsync(node, context, cancellationToken);
                
                // Update context
                context.SetNodeResult(node.Id, nodeResult);
                
                // Publish progress
                await _monitor.UpdateProgressAsync(context.Id, node.Id, nodeResult, cancellationToken);
                
                // Handle failure
                if (!nodeResult.IsSuccess)
                {
                    var shouldRetry = await HandleNodeFailure(node, nodeResult, context, cancellationToken);
                    if (!shouldRetry)
                    {
                        return ExecutionResult.Failed($"Node {node.Id} failed");
                    }
                }
                
                // Persist context (for pause/resume)
                await _contextRepository.SaveAsync(context, cancellationToken);
            }
            
            // 5. Complete execution
            await _monitor.CompleteExecutionAsync(context.Id, ExecutionResult.Success(), cancellationToken);
            
            return ExecutionResult.Success();
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Execution {ExecutionId} was cancelled", context.Id);
            return ExecutionResult.Cancelled();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Execution {ExecutionId} failed with exception", context.Id);
            return ExecutionResult.Failed(ex.Message);
        }
    }
    
    private List<Node> GetExecutionOrder(Workflow workflow)
    {
        // Topological sort using Kahn's algorithm
        var inDegree = new Dictionary<NodeId, int>();
        var adjList = new Dictionary<NodeId, List<NodeId>>();
        
        // Build graph
        foreach (var node in workflow.Nodes)
        {
            inDegree[node.Id] = 0;
            adjList[node.Id] = new List<NodeId>();
        }
        
        foreach (var connection in workflow.Connections)
        {
            adjList[connection.FromNodeId].Add(connection.ToNodeId);
            inDegree[connection.ToNodeId]++;
        }
        
        // Find nodes with no incoming edges
        var queue = new Queue<NodeId>(inDegree.Where(kv => kv.Value == 0).Select(kv => kv.Key));
        var sorted = new List<Node>();
        
        while (queue.Count > 0)
        {
            var nodeId = queue.Dequeue();
            var node = workflow.Nodes.First(n => n.Id == nodeId);
            sorted.Add(node);
            
            foreach (var neighbor in adjList[nodeId])
            {
                inDegree[neighbor]--;
                if (inDegree[neighbor] == 0)
                {
                    queue.Enqueue(neighbor);
                }
            }
        }
        
        // Check for cycles
        if (sorted.Count != workflow.Nodes.Count)
        {
            throw new InvalidOperationException("Workflow contains cycles");
        }
        
        return sorted;
    }
}
```

---

## 🔁 Error Handling and Retry Logic

### Retry Policies

```csharp
public class RetryPolicy
{
    public int MaxAttempts { get; set; } = 3;
    public TimeSpan InitialDelay { get; set; } = TimeSpan.FromSeconds(1);
    public TimeSpan MaxDelay { get; set; } = TimeSpan.FromMinutes(5);
    public double BackoffMultiplier { get; set; } = 2.0;
    public bool UseExponentialBackoff { get; set; } = true;
}

public class NodeExecutor : INodeExecutor
{
    public async Task<NodeResult> ExecuteAsync(
        Node node, 
        ExecutionContext context, 
        CancellationToken cancellationToken)
    {
        var policy = node.RetryPolicy ?? new RetryPolicy();
        var attempt = 0;
        
        while (attempt < policy.MaxAttempts)
        {
            attempt++;
            
            try
            {
                var result = await ExecuteNodeInternalAsync(node, context, cancellationToken);
                
                if (result.IsSuccess)
                    return result;
                    
                if (attempt < policy.MaxAttempts)
                {
                    var delay = CalculateDelay(attempt, policy);
                    _logger.LogWarning("Node {NodeId} failed (attempt {Attempt}/{Max}), retrying in {Delay}ms", 
                        node.Id, attempt, policy.MaxAttempts, delay.TotalMilliseconds);
                    
                    await Task.Delay(delay, cancellationToken);
                }
                else
                {
                    _logger.LogError("Node {NodeId} failed after {Attempts} attempts", node.Id, attempt);
                    return result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Node {NodeId} threw exception (attempt {Attempt}/{Max})", 
                    node.Id, attempt, policy.MaxAttempts);
                    
                if (attempt >= policy.MaxAttempts)
                {
                    return NodeResult.Failed($"Node failed with exception: {ex.Message}");
                }
            }
        }
        
        return NodeResult.Failed("Max retry attempts exceeded");
    }
    
    private TimeSpan CalculateDelay(int attempt, RetryPolicy policy)
    {
        if (!policy.UseExponentialBackoff)
            return policy.InitialDelay;
            
        var delay = policy.InitialDelay.TotalMilliseconds * Math.Pow(policy.BackoffMultiplier, attempt - 1);
        return TimeSpan.FromMilliseconds(Math.Min(delay, policy.MaxDelay.TotalMilliseconds));
    }
}
```

---

## 💾 Execution Context and State Persistence

### ExecutionContext Design

```csharp
public class ExecutionContext
{
    public ExecutionId Id { get; private set; }
    public WorkflowId WorkflowId { get; private set; }
    public Dictionary<NodeId, NodeResult> NodeResults { get; private set; }
    public Dictionary<string, object> Variables { get; private set; }
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }
    public ExecutionStatus Status { get; private set; }
    
    public static ExecutionContext Create(Workflow workflow)
    {
        return new ExecutionContext
        {
            Id = ExecutionId.NewId(),
            WorkflowId = workflow.Id,
            NodeResults = new Dictionary<NodeId, NodeResult>(),
            Variables = new Dictionary<string, object>(),
            StartTime = DateTime.UtcNow,
            Status = ExecutionStatus.Pending
        };
    }
    
    public void SetNodeResult(NodeId nodeId, NodeResult result)
    {
        NodeResults[nodeId] = result;
        
        // Store output in variables for downstream nodes
        if (result.IsSuccess && result.Output != null)
        {
            Variables[$"node_{nodeId}_output"] = result.Output;
        }
    }
    
    public T? GetNodeOutput<T>(NodeId nodeId)
    {
        var key = $"node_{nodeId}_output";
        if (Variables.TryGetValue(key, out var value) && value is T typedValue)
        {
            return typedValue;
        }
        return default;
    }
}
```

### State Persistence

```csharp
public interface IExecutionContextRepository
{
    Task SaveAsync(ExecutionContext context, CancellationToken cancellationToken);
    Task<ExecutionContext?> GetByIdAsync(ExecutionId id, CancellationToken cancellationToken);
}

public class JsonExecutionContextRepository : IExecutionContextRepository
{
    private readonly string _storagePath;
    
    public async Task SaveAsync(ExecutionContext context, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(context, new JsonSerializerOptions
        {
            WriteIndented = true
        });
        
        var filePath = Path.Combine(_storagePath, $"{context.Id}.json");
        await File.WriteAllTextAsync(filePath, json, cancellationToken);
    }
}
```

---

## 📡 Real-Time Monitoring Integration

### Progress Events

```csharp
public interface IExecutionMonitor
{
    Task StartExecutionAsync(ExecutionId id, CancellationToken cancellationToken);
    Task UpdateProgressAsync(ExecutionId id, NodeId nodeId, NodeResult result, CancellationToken cancellationToken);
    Task CompleteExecutionAsync(ExecutionId id, ExecutionResult result, CancellationToken cancellationToken);
    Task PublishTerminalOutputAsync(ExecutionId id, string output, CancellationToken cancellationToken);
}

public class ExecutionMonitor : IExecutionMonitor
{
    private readonly IHubContext<ExecutionHub> _hubContext;
    private readonly ILogger<ExecutionMonitor> _logger;
    
    public async Task UpdateProgressAsync(
        ExecutionId id, 
        NodeId nodeId, 
        NodeResult result, 
        CancellationToken cancellationToken)
    {
        var progressEvent = new NodeProgressEvent
        {
            ExecutionId = id,
            NodeId = nodeId,
            Status = result.IsSuccess ? "completed" : "failed",
            Output = result.Output,
            Error = result.Error,
            Timestamp = DateTime.UtcNow
        };
        
        // Broadcast to connected clients
        await _hubContext.Clients
            .Group(id.ToString())
            .SendAsync("NodeProgress", progressEvent, cancellationToken);
            
        _logger.LogInformation("Published progress for node {NodeId} in execution {ExecutionId}", 
            nodeId, id);
    }
}
```

---

## ⏱️ Long-Running Execution Support

### Background Execution

```csharp
public class BackgroundExecutionService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ConcurrentDictionary<ExecutionId, CancellationTokenSource> _runningExecutions = new();
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background execution service started");
        
        // Process execution queue
        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessExecutionQueue(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
        
        _logger.LogInformation("Background execution service stopped");
    }
    
    public async Task StartExecutionAsync(Workflow workflow, CancellationToken cancellationToken)
    {
        var executionId = ExecutionId.NewId();
        var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        
        _runningExecutions.TryAdd(executionId, cts);
        
        // Execute in background
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var engine = scope.ServiceProvider.GetRequiredService<IExecutionEngine>();
                
                await engine.ExecuteAsync(workflow, cts.Token);
            }
            finally
            {
                _runningExecutions.TryRemove(executionId, out _);
            }
        }, cancellationToken);
    }
    
    public async Task PauseExecutionAsync(ExecutionId executionId)
    {
        if (_runningExecutions.TryGetValue(executionId, out var cts))
        {
            cts.Cancel();
            // State is persisted, can resume later
        }
    }
}
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Synchronous Blocking

```csharp
// ❌ BAD: Blocking execution
public ExecutionResult Execute(Workflow workflow)
{
    var result = ExecuteAsync(workflow).Result; // ❌ Blocking
    return result;
}

// ✅ GOOD: Async all the way
public async Task<ExecutionResult> ExecuteAsync(Workflow workflow, CancellationToken cancellationToken)
{
    // Async implementation
}
```

### ❌ Missing Cancellation Support

```csharp
// ❌ BAD: No cancellation
public async Task ExecuteAsync(Workflow workflow)
{
    foreach (var node in workflow.Nodes)
    {
        await ExecuteNodeAsync(node); // Can't cancel
    }
}

// ✅ GOOD: Respect cancellation tokens
public async Task ExecuteAsync(Workflow workflow, CancellationToken cancellationToken)
{
    foreach (var node in workflow.Nodes)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await ExecuteNodeAsync(node, cancellationToken);
    }
}
```

---

## 🔗 Related Documentation

- [README.md](../README.md) - Project overview
- [Backend Guide](./backend-guide.md) - Backend development guide
- [Agents and Tools Guide](./agents-and-tools-guide.md) - Agent development guide
- [ROADMAP.md](../ROADMAP.md) - Development roadmap

---

**Last Updated**: 2026-01-10  
**Maintained by**: Backend Team
