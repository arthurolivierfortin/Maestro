# Backend Development Guide

> **Purpose**: This guide defines how to build the B-One Maestro backend following Clean Architecture principles, SOLID design, and model-agnostic patterns.

---

## 🎯 Backend Philosophy

### Core Principles

1. **Clean Architecture**: Strict layer separation with dependency inversion
2. **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
3. **Model Agnosticism**: **NEVER** import LLM SDKs in Domain or Application layers
4. **Domain-Driven Design**: Rich domain model with business logic
5. **CQRS Pattern**: Separate read and write operations
6. **Testability**: 80%+ code coverage for Domain and Application layers

### What Backend IS

- ✅ **Business logic and orchestration**
- ✅ **Workflow execution engine**
- ✅ **Model-agnostic LLM Gateway**
- ✅ **API layer** for frontend communication
- ✅ **Real-time updates** via SignalR

### What Backend is NOT

- ❌ **Not a model implementation** - no AI training or fine-tuning
- ❌ **Not model-specific** - no direct OpenAI/Anthropic dependencies in core layers
- ❌ **Not a code editor** - orchestrates external tools, doesn't edit code directly
- ❌ **Not a web UI** - provides API for desktop frontend

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│              (Maestro.Api, Controllers, Hubs)                │
│              - REST API endpoints                            │
│              - SignalR hubs                                  │
│              - Request/response mapping                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│         (Maestro.Application, Use Cases, DTOs)               │
│         - Commands (write operations)                        │
│         - Queries (read operations)                          │
│         - DTOs for data transfer                             │
│         - Interfaces (ILLMGateway, IWorkflowRepository)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│      (Maestro.Domain, Entities, Value Objects, Rules)        │
│      - Pure business logic                                   │
│      - No external dependencies                              │
│      - Domain events                                         │
│      - Business rules and validation                         │
└─────────────────────────────────────────────────────────────┘
                           ↑ depends on
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│     (Maestro.Infrastructure, LLM Gateway, Persistence)       │
│     - ILLMGateway implementation (OpenAI, Ollama adapters)  │
│     - Repository implementations                             │
│     - External service integrations (Git, File System)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 Layer-by-Layer Guide

### 1. Domain Layer (`Maestro.Domain`)

**Rules**:
- ✅ **Zero external dependencies** (only .NET BCL)
- ✅ Pure business logic
- ✅ Rich domain model (not anemic)
- ✅ Domain events for cross-entity communication
- ❌ **NO** Entity Framework, JSON serialization, or infrastructure concerns

#### Entities

```csharp
namespace Maestro.Domain.Entities
{
    /// <summary>
    /// Represents a workflow with multiple nodes and execution logic.
    /// </summary>
    public class Workflow
    {
        // Private setters - encapsulation
        public WorkflowId Id { get; private set; }
        public string Name { get; private set; }
        public string Description { get; private set; }
        public List<Node> Nodes { get; private set; }
        public List<Connection> Connections { get; private set; }
        
        // Domain events
        private readonly List<IDomainEvent> _domainEvents = new();
        public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
        
        // Private constructor - prevent direct instantiation
        private Workflow()
        {
            Nodes = new List<Node>();
            Connections = new List<Connection>();
        }
        
        // Factory method - preferred way to create entities
        public static Workflow Create(string name, string description)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new DomainException("Workflow name cannot be empty");
                
            var workflow = new Workflow
            {
                Id = WorkflowId.NewId(),
                Name = name,
                Description = description
            };
            
            workflow._domainEvents.Add(new WorkflowCreatedEvent(workflow.Id));
            
            return workflow;
        }
        
        // Business logic methods
        public void AddNode(Node node)
        {
            if (node == null)
                throw new ArgumentNullException(nameof(node));
                
            if (Nodes.Any(n => n.Id == node.Id))
                throw new DomainException($"Node {node.Id} already exists");
                
            Nodes.Add(node);
            _domainEvents.Add(new NodeAddedEvent(Id, node.Id));
        }
        
        public void RemoveNode(NodeId nodeId)
        {
            var node = Nodes.FirstOrDefault(n => n.Id == nodeId);
            if (node == null)
                throw new DomainException($"Node {nodeId} not found");
                
            // Remove all connections involving this node
            Connections.RemoveAll(c => c.FromNodeId == nodeId || c.ToNodeId == nodeId);
            
            Nodes.Remove(node);
            _domainEvents.Add(new NodeRemovedEvent(Id, nodeId));
        }
        
        public bool CanExecute()
        {
            // Business rule: workflow must have at least one node
            if (!Nodes.Any())
                return false;
                
            // Business rule: all nodes must be valid
            if (Nodes.Any(n => !n.IsValid()))
                return false;
                
            // Business rule: no cycles in connections
            if (HasCycles())
                return false;
                
            return true;
        }
        
        private bool HasCycles()
        {
            // Domain logic for cycle detection
            var visited = new HashSet<NodeId>();
            var recursionStack = new HashSet<NodeId>();
            
            foreach (var node in Nodes)
            {
                if (HasCycleDFS(node.Id, visited, recursionStack))
                    return true;
            }
            
            return false;
        }
        
        private bool HasCycleDFS(NodeId nodeId, HashSet<NodeId> visited, HashSet<NodeId> recursionStack)
        {
            if (recursionStack.Contains(nodeId))
                return true;
                
            if (visited.Contains(nodeId))
                return false;
                
            visited.Add(nodeId);
            recursionStack.Add(nodeId);
            
            var outgoingConnections = Connections.Where(c => c.FromNodeId == nodeId);
            foreach (var connection in outgoingConnections)
            {
                if (HasCycleDFS(connection.ToNodeId, visited, recursionStack))
                    return true;
            }
            
            recursionStack.Remove(nodeId);
            return false;
        }
        
        public void ClearDomainEvents()
        {
            _domainEvents.Clear();
        }
    }
}
```

#### Value Objects

```csharp
namespace Maestro.Domain.ValueObjects
{
    /// <summary>
    /// Value object representing a workflow identifier.
    /// </summary>
    public class WorkflowId : IEquatable<WorkflowId>
    {
        public Guid Value { get; }
        
        private WorkflowId(Guid value)
        {
            if (value == Guid.Empty)
                throw new ArgumentException("Workflow ID cannot be empty", nameof(value));
                
            Value = value;
        }
        
        public static WorkflowId NewId() => new(Guid.NewGuid());
        public static WorkflowId From(Guid value) => new(value);
        public static WorkflowId From(string value) => new(Guid.Parse(value));
        
        // Equality implementation
        public bool Equals(WorkflowId? other)
        {
            if (other is null) return false;
            return Value == other.Value;
        }
        
        public override bool Equals(object? obj) => Equals(obj as WorkflowId);
        public override int GetHashCode() => Value.GetHashCode();
        public override string ToString() => Value.ToString();
        
        public static bool operator ==(WorkflowId? left, WorkflowId? right)
            => left?.Equals(right) ?? right is null;
        
        public static bool operator !=(WorkflowId? left, WorkflowId? right)
            => !(left == right);
    }
}
```

#### Domain Services

```csharp
namespace Maestro.Domain.Services
{
    /// <summary>
    /// Domain service for validating workflows.
    /// </summary>
    public class WorkflowValidator
    {
        public ValidationResult Validate(Workflow workflow)
        {
            var errors = new List<string>();
            
            // Rule: Workflow must have a name
            if (string.IsNullOrWhiteSpace(workflow.Name))
                errors.Add("Workflow name is required");
                
            // Rule: Workflow must have at least one node
            if (!workflow.Nodes.Any())
                errors.Add("Workflow must have at least one node");
                
            // Rule: All nodes must be valid
            foreach (var node in workflow.Nodes)
            {
                if (!node.IsValid())
                    errors.Add($"Node {node.Id} is invalid");
            }
            
            // Rule: All connections must be valid
            foreach (var connection in workflow.Connections)
            {
                if (!IsValidConnection(workflow, connection))
                    errors.Add($"Connection from {connection.FromNodeId} to {connection.ToNodeId} is invalid");
            }
            
            // Rule: No cycles
            if (workflow.HasCycles())
                errors.Add("Workflow contains cycles");
                
            return errors.Any()
                ? ValidationResult.Failure(errors)
                : ValidationResult.Success();
        }
        
        private bool IsValidConnection(Workflow workflow, Connection connection)
        {
            var fromNode = workflow.Nodes.FirstOrDefault(n => n.Id == connection.FromNodeId);
            var toNode = workflow.Nodes.FirstOrDefault(n => n.Id == connection.ToNodeId);
            
            if (fromNode == null || toNode == null)
                return false;
                
            // Add connection type compatibility checks
            return true;
        }
    }
}
```

---

### 2. Application Layer (`Maestro.Application`)

**Rules**:
- ✅ Depends **ONLY** on Domain layer
- ✅ Defines interfaces for infrastructure (ILLMGateway, IWorkflowRepository)
- ✅ Implements use cases (Commands and Queries)
- ✅ DTOs for data transfer
- ❌ **NO** infrastructure implementations
- ❌ **NO** direct LLM SDK usage

#### Interfaces (Critical Abstractions)

```csharp
namespace Maestro.Application.Interfaces
{
    /// <summary>
    /// Gateway for LLM communication - MODEL AGNOSTIC.
    /// </summary>
    public interface ILLMGateway
    {
        /// <summary>
        /// Sends a prompt to the configured LLM and returns the response.
        /// </summary>
        Task<LLMResponse> SendAsync(
            LLMRequest request, 
            CancellationToken cancellationToken = default);
            
        /// <summary>
        /// Streams a response from the LLM.
        /// </summary>
        IAsyncEnumerable<LLMStreamChunk> StreamAsync(
            LLMRequest request, 
            CancellationToken cancellationToken = default);
    }
    
    /// <summary>
    /// Model-agnostic request to LLM.
    /// </summary>
    public class LLMRequest
    {
        public string SystemPrompt { get; init; } = string.Empty;
        public List<Message> Messages { get; init; } = new();
        public List<Tool> Tools { get; init; } = new();
        public ModelPreferences? Preferences { get; init; }
    }
    
    /// <summary>
    /// Model-agnostic response from LLM.
    /// </summary>
    public class LLMResponse
    {
        public string Content { get; init; } = string.Empty;
        public List<ToolCall> ToolCalls { get; init; } = new();
        public TokenUsage Usage { get; init; } = new();
        public string ModelUsed { get; init; } = string.Empty;
    }
}
```

#### Commands (CQRS - Write Operations)

```csharp
namespace Maestro.Application.Commands.ExecuteWorkflow
{
    /// <summary>
    /// Command to execute a workflow.
    /// </summary>
    public record ExecuteWorkflowCommand(WorkflowId WorkflowId) : IRequest<ExecutionResult>;
    
    /// <summary>
    /// Handler for executing workflows.
    /// </summary>
    public class ExecuteWorkflowCommandHandler : IRequestHandler<ExecuteWorkflowCommand, ExecutionResult>
    {
        private readonly IWorkflowRepository _repository;
        private readonly IExecutionEngine _executionEngine;
        private readonly IExecutionMonitor _monitor;
        private readonly ILogger<ExecuteWorkflowCommandHandler> _logger;
        
        public ExecuteWorkflowCommandHandler(
            IWorkflowRepository repository,
            IExecutionEngine executionEngine,
            IExecutionMonitor monitor,
            ILogger<ExecuteWorkflowCommandHandler> logger)
        {
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
            _executionEngine = executionEngine ?? throw new ArgumentNullException(nameof(executionEngine));
            _monitor = monitor ?? throw new ArgumentNullException(nameof(monitor));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
        
        public async Task<ExecutionResult> Handle(
            ExecuteWorkflowCommand command, 
            CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation("Executing workflow {WorkflowId}", command.WorkflowId);
                
                // Load workflow
                var workflow = await _repository.GetByIdAsync(command.WorkflowId, cancellationToken);
                if (workflow == null)
                {
                    return ExecutionResult.NotFound($"Workflow {command.WorkflowId} not found");
                }
                
                // Validate workflow
                if (!workflow.CanExecute())
                {
                    return ExecutionResult.Invalid("Workflow is not ready for execution");
                }
                
                // Start monitoring
                await _monitor.StartExecutionAsync(command.WorkflowId, cancellationToken);
                
                // Execute workflow
                var result = await _executionEngine.ExecuteAsync(workflow, cancellationToken);
                
                // Complete monitoring
                await _monitor.CompleteExecutionAsync(command.WorkflowId, result, cancellationToken);
                
                _logger.LogInformation("Workflow {WorkflowId} executed successfully", command.WorkflowId);
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute workflow {WorkflowId}", command.WorkflowId);
                return ExecutionResult.Failed(ex.Message);
            }
        }
    }
}
```

#### Queries (CQRS - Read Operations)

```csharp
namespace Maestro.Application.Queries.GetWorkflow
{
    /// <summary>
    /// Query to get a workflow by ID.
    /// </summary>
    public record GetWorkflowQuery(WorkflowId WorkflowId) : IRequest<WorkflowDto?>;
    
    /// <summary>
    /// Handler for getting a workflow.
    /// </summary>
    public class GetWorkflowQueryHandler : IRequestHandler<GetWorkflowQuery, WorkflowDto?>
    {
        private readonly IWorkflowRepository _repository;
        private readonly IMapper _mapper;
        
        public GetWorkflowQueryHandler(IWorkflowRepository repository, IMapper mapper)
        {
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
        }
        
        public async Task<WorkflowDto?> Handle(GetWorkflowQuery query, CancellationToken cancellationToken)
        {
            var workflow = await _repository.GetByIdAsync(query.WorkflowId, cancellationToken);
            return workflow == null ? null : _mapper.Map<WorkflowDto>(workflow);
        }
    }
}
```

---

### 3. Infrastructure Layer (`Maestro.Infrastructure`)

**Rules**:
- ✅ Implements Application interfaces
- ✅ **ONLY PLACE** where LLM SDKs can be imported
- ✅ Concrete implementations of repositories, services
- ❌ **NO** business logic (belongs in Domain/Application)

#### LLM Gateway Implementation ⚠️ CRITICAL

```csharp
namespace Maestro.Infrastructure.LLMGateway
{
    /// <summary>
    /// Factory for creating LLM adapters based on configuration.
    /// </summary>
    public class LLMGateway : ILLMGateway
    {
        private readonly ILLMAdapter _adapter;
        private readonly ILogger<LLMGateway> _logger;
        
        public LLMGateway(IOptions<LLMGatewayOptions> options, ILogger<LLMGateway> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            
            var config = options?.Value ?? throw new ArgumentNullException(nameof(options));
            
            // Select adapter based on configuration
            _adapter = config.DefaultProvider switch
            {
                "OpenAI" => new OpenAIAdapter(config.Providers["OpenAI"]),
                "Anthropic" => new AnthropicAdapter(config.Providers["Anthropic"]),
                "Ollama" => new OllamaAdapter(config.Providers["Ollama"]),
                _ => throw new InvalidOperationException($"Unknown provider: {config.DefaultProvider}")
            };
        }
        
        public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Sending request to LLM via {Provider}", _adapter.ProviderName);
            
            var response = await _adapter.SendAsync(request, cancellationToken);
            
            _logger.LogInformation("Received response from LLM, tokens used: {Tokens}", response.Usage.TotalTokens);
            
            return response;
        }
        
        public IAsyncEnumerable<LLMStreamChunk> StreamAsync(
            LLMRequest request, 
            CancellationToken cancellationToken)
        {
            return _adapter.StreamAsync(request, cancellationToken);
        }
    }
    
    /// <summary>
    /// Adapter for OpenAI API.
    /// ⚠️ IMPORTANT: This is the ONLY place where OpenAI SDK can be imported!
    /// </summary>
    public class OpenAIAdapter : ILLMAdapter
    {
        private readonly OpenAI.OpenAIClient _client; // ✅ OK here (Infrastructure layer)
        private readonly string _model;
        
        public string ProviderName => "OpenAI";
        
        public OpenAIAdapter(ProviderConfiguration config)
        {
            _client = new OpenAI.OpenAIClient(config.ApiKey);
            _model = config.DefaultModel ?? "gpt-4";
        }
        
        public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken)
        {
            // Map LLMRequest to OpenAI format
            var chatRequest = new OpenAI.Chat.ChatCompletionOptions
            {
                Model = _model,
                Messages = request.Messages.Select(m => new OpenAI.Chat.ChatMessage
                {
                    Role = m.Role,
                    Content = m.Content
                }).ToList()
            };
            
            // Call OpenAI API
            var response = await _client.Chat.CompleteChatAsync(chatRequest, cancellationToken);
            
            // Map OpenAI response to LLMResponse
            return new LLMResponse
            {
                Content = response.Content,
                Usage = new TokenUsage
                {
                    PromptTokens = response.Usage.PromptTokens,
                    CompletionTokens = response.Usage.CompletionTokens,
                    TotalTokens = response.Usage.TotalTokens
                },
                ModelUsed = _model
            };
        }
    }
}
```

---

### 4. Presentation Layer (`Maestro.Api`)

**Rules**:
- ✅ Thin layer that delegates to Application
- ✅ API controllers and SignalR hubs
- ❌ **NO** business logic
- ❌ **NO** direct repository access

#### Controllers

```csharp
namespace Maestro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowsController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ILogger<WorkflowsController> _logger;
        
        public WorkflowsController(IMediator mediator, ILogger<WorkflowsController> logger)
        {
            _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
        
        /// <summary>
        /// Gets a workflow by ID.
        /// </summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetWorkflow(string id, CancellationToken cancellationToken)
        {
            var workflowId = WorkflowId.From(id);
            var query = new GetWorkflowQuery(workflowId);
            var workflow = await _mediator.Send(query, cancellationToken);
            
            return workflow == null ? NotFound() : Ok(workflow);
        }
        
        /// <summary>
        /// Executes a workflow.
        /// </summary>
        [HttpPost("{id}/execute")]
        [ProducesResponseType(typeof(ExecutionResult), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> ExecuteWorkflow(string id, CancellationToken cancellationToken)
        {
            var workflowId = WorkflowId.From(id);
            var command = new ExecuteWorkflowCommand(workflowId);
            var result = await _mediator.Send(command, cancellationToken);
            
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
```

#### SignalR Hubs

```csharp
namespace Maestro.Api.Hubs
{
    /// <summary>
    /// SignalR hub for real-time execution monitoring.
    /// </summary>
    public class ExecutionHub : Hub
    {
        private readonly ILogger<ExecutionHub> _logger;
        
        public ExecutionHub(ILogger<ExecutionHub> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
        
        public async Task JoinExecution(string executionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, executionId);
            _logger.LogInformation("Client {ConnectionId} joined execution {ExecutionId}", 
                Context.ConnectionId, executionId);
        }
        
        public async Task LeaveExecution(string executionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, executionId);
            _logger.LogInformation("Client {ConnectionId} left execution {ExecutionId}", 
                Context.ConnectionId, executionId);
        }
    }
}
```

---

## 🧪 Testing Guidelines

### Domain Layer Testing

```csharp
public class WorkflowTests
{
    [Fact]
    public void Create_WithValidParameters_ShouldCreateWorkflow()
    {
        // Arrange
        var name = "Test Workflow";
        var description = "Test Description";
        
        // Act
        var workflow = Workflow.Create(name, description);
        
        // Assert
        workflow.Should().NotBeNull();
        workflow.Id.Should().NotBeNull();
        workflow.Name.Should().Be(name);
        workflow.Description.Should().Be(description);
        workflow.Nodes.Should().BeEmpty();
    }
    
    [Fact]
    public void AddNode_WithValidNode_ShouldAddNodeAndRaiseDomainEvent()
    {
        // Arrange
        var workflow = Workflow.Create("Test", "Description");
        var node = AgentNode.Create("Planner");
        
        // Act
        workflow.AddNode(node);
        
        // Assert
        workflow.Nodes.Should().ContainSingle();
        workflow.Nodes.Should().Contain(node);
        workflow.DomainEvents.Should().ContainSingle(e => e is NodeAddedEvent);
    }
}
```

### Application Layer Testing

```csharp
public class ExecuteWorkflowCommandHandlerTests
{
    private readonly Mock<IWorkflowRepository> _repositoryMock;
    private readonly Mock<IExecutionEngine> _engineMock;
    private readonly Mock<IExecutionMonitor> _monitorMock;
    private readonly ExecuteWorkflowCommandHandler _handler;
    
    public ExecuteWorkflowCommandHandlerTests()
    {
        _repositoryMock = new Mock<IWorkflowRepository>();
        _engineMock = new Mock<IExecutionEngine>();
        _monitorMock = new Mock<IExecutionMonitor>();
        
        _handler = new ExecuteWorkflowCommandHandler(
            _repositoryMock.Object,
            _engineMock.Object,
            _monitorMock.Object,
            Mock.Of<ILogger<ExecuteWorkflowCommandHandler>>()
        );
    }
    
    [Fact]
    public async Task Handle_WithValidWorkflow_ShouldExecuteSuccessfully()
    {
        // Arrange
        var workflow = CreateValidWorkflow();
        _repositoryMock
            .Setup(r => r.GetByIdAsync(workflow.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(workflow);
            
        _engineMock
            .Setup(e => e.ExecuteAsync(workflow, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ExecutionResult.Success());
        
        var command = new ExecuteWorkflowCommand(workflow.Id);
        
        // Act
        var result = await _handler.Handle(command, CancellationToken.None);
        
        // Assert
        result.IsSuccess.Should().BeTrue();
        _monitorMock.Verify(m => m.StartExecutionAsync(workflow.Id, It.IsAny<CancellationToken>()), Times.Once);
        _monitorMock.Verify(m => m.CompleteExecutionAsync(workflow.Id, It.IsAny<ExecutionResult>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Infrastructure in Domain

```csharp
// ❌ BAD: Domain entity with infrastructure dependency
namespace Maestro.Domain.Entities
{
    using Microsoft.EntityFrameworkCore; // ❌ External dependency!
    
    public class Workflow
    {
        [Key] // ❌ EF Core attribute!
        public Guid Id { get; set; }
    }
}

// ✅ GOOD: Pure domain entity
namespace Maestro.Domain.Entities
{
    public class Workflow
    {
        public WorkflowId Id { get; private set; } // ✅ Value object
        
        private Workflow() { } // ✅ Encapsulation
        
        public static Workflow Create(string name) // ✅ Factory method
        {
            // Domain logic
        }
    }
}
```

### ❌ Business Logic in Controllers

```csharp
// ❌ BAD: Business logic in controller
[HttpPost("{id}/execute")]
public async Task<IActionResult> ExecuteWorkflow(string id)
{
    var workflow = await _repository.GetByIdAsync(id); // ❌ Direct repository access
    
    if (workflow.Nodes.Count == 0) // ❌ Validation logic
        return BadRequest("Workflow has no nodes");
        
    foreach (var node in workflow.Nodes) // ❌ Execution logic
    {
        // Execute node...
    }
    
    return Ok();
}

// ✅ GOOD: Delegate to application layer
[HttpPost("{id}/execute")]
public async Task<IActionResult> ExecuteWorkflow(string id, CancellationToken cancellationToken)
{
    var workflowId = WorkflowId.From(id);
    var command = new ExecuteWorkflowCommand(workflowId);
    var result = await _mediator.Send(command, cancellationToken); // ✅ Delegate
    
    return result.IsSuccess ? Ok(result) : BadRequest(result);
}
```

### ❌ Direct LLM SDK in Application Layer

```csharp
// ❌ BAD: OpenAI SDK in Application layer
namespace Maestro.Application.Agents
{
    using OpenAI; // ❌ NEVER do this!
    
    public class PlannerAgent : IAgent
    {
        private readonly OpenAIClient _client; // ❌ Direct coupling
        
        public async Task<AgentOutput> ExecuteAsync(AgentInput input)
        {
            var response = await _client.CompleteChatAsync(...); // ❌
        }
    }
}

// ✅ GOOD: Use ILLMGateway abstraction
namespace Maestro.Application.Agents
{
    public class PlannerAgent : IAgent
    {
        private readonly ILLMGateway _llmGateway; // ✅ Abstraction
        
        public async Task<AgentOutput> ExecuteAsync(AgentInput input)
        {
            var response = await _llmGateway.SendAsync(new LLMRequest
            {
                SystemPrompt = "You are a planning agent",
                Messages = BuildMessages(input)
            });
            
            return ParseResponse(response);
        }
    }
}
```

---

## 📚 Required NuGet Packages

### Domain Layer
- None (only .NET BCL)

### Application Layer
```xml
<ItemGroup>
  <PackageReference Include="MediatR" Version="12.2.0" />
  <PackageReference Include="FluentValidation" Version="11.9.0" />
</ItemGroup>
```

### Infrastructure Layer
```xml
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.Options" Version="8.0.0" />
  <PackageReference Include="LibGit2Sharp" Version="0.27.2" />
  <PackageReference Include="Octokit" Version="9.0.0" />
  <!-- LLM SDKs - ONLY in Infrastructure -->
  <PackageReference Include="OpenAI" Version="1.10.0" />
  <PackageReference Include="Anthropic.SDK" Version="1.0.0" />
</ItemGroup>
```

### API Layer
```xml
<ItemGroup>
  <PackageReference Include="Microsoft.AspNetCore.SignalR" Version="1.1.0" />
  <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
  <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
</ItemGroup>
```

---

## Maestro-Specific Architecture Guidelines

> **Extracted from CLAUDE.md.** These are practical rules for Maestro development.

### Frontend (React + TypeScript)

- **Block types are defined in** `apps/desktop/src/registry/blockTypeDefinitions.ts`
- **Block type registry** at `apps/desktop/src/registry/BlockTypeRegistry.ts` defines containment rules
- **Block type interface** at `apps/desktop/src/types/block.types.ts` defines the `Block` interface
- **isAtomic property** determines if a block can contain children:
  - Atomic blocks (`isAtomic: true`): `prompt`, `instruction`, `tool`, `decision`, `validator`, `trigger`, `inference`, `script`
  - Composite blocks (`isAtomic: false`): `workflow`, `agent`, `task`

### Backend (C# .NET)

- **BlockDto** at `apps/backend/src/Maestro.Application/DTOs/BlockDto.cs` must include all properties from `BlockDefinition`
- **BlockDefinition** at `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs` is the domain entity
- **isAtomic property** MUST be included in API responses — missing this causes UI bugs

### Session Architecture Principles

#### Generic vs Specific Separation (CRITICAL)

Infrastructure code (`apps/backend/src/Maestro.Infrastructure/`) MUST NOT contain session-specific logic:
- **Phase definitions** → session template variables (`_phases`), never hardcoded in C#
- **Monitor descriptors** → session template variables (`_monitorDescriptor`), never hardcoded
- **Workflow structure** → workflow block JSON (`config.nodes`), never hardcoded
- **LLM prompts, output paths, evaluation criteria** → session template variables (`_workflowConfig`), never hardcoded
- **Workflow routing** → read from block metadata, never `if (workflowId.Contains(...))`

**Litmus test**: Can a new session type be created with ONLY JSON changes (template + block)?
If the answer is no, the architecture is violated.

#### Entry Point Execution
- `EntryPointExecutor` bridges Session layer and Execution layer
- Reads workflow structure from `IBlockRepository` (block's `config.nodes`)
- Reads display config from session variables (set by template import)
- New workflows require only new JSON data, zero C# changes

#### Session Variable Conventions
`_` prefix = system/infrastructure variables:

| Variable | Purpose |
|----------|---------|
| `_phases` | Phase definitions for TUI phase-list component |
| `_monitorDescriptor` | TUI layout and component configuration |
| `_executionTree` | Runtime execution tree state |
| `_activeBlock` | Currently executing block detail |
| `_executionLog` | Execution log entries (FIFO 50) |
| `_artifacts` | Files produced by the session |
| `_activeWorkflow` | Currently active workflow ID |
| `_workflowConfig` | Per-workflow config (prompts, paths, eval criteria) |

No-prefix = session-specific state (`currentFitness`, `scoreHistory`, etc.)

#### Template-Driven Configuration
Session templates (`content/system/templates/sessions/*.session.json`) carry ALL session-specific data:
- `variables` — Initial state including `_phases`, `_monitorDescriptor`, `_workflowConfig`
- `entryPoints` — Maps names to workflow block IDs
- `monitorWidgets` — Widget configs (legacy, used when no `_monitorDescriptor`)
- Template import is done by CLI (`importSessionTemplate` in `packages/maestro-cli/cli.ts`)
- CLI reads JSON, calls PUT APIs for variables, entry points, widgets
- No backend code changes needed for new session types

### API Contract

When adding properties to domain entities:
1. Add the property to the domain entity
2. Add the property to the DTO
3. Update `FromDomain` method to map the property
4. Update file loaders to read the property from JSON

#### SDK-Backend Contract Verification (MANDATORY)

The SDK (`packages/maestro-client/src/`) is the ONLY bridge between the TUI/CLI and the backend. Its types and API calls MUST match the backend exactly.

**When writing or modifying SDK domain methods:**
1. `curl` the actual backend endpoint and inspect the JSON response shape
2. Verify the SDK return type matches (array vs wrapper object, field names)
3. Verify the TypeScript interface field names match the backend DTO's JSON serialization (C# PascalCase → JSON camelCase: `ModelId` → `modelId`)

**Rules:**
- **One source of truth for field names**: the backend DTO (`apps/backend/src/Maestro.Application/DTOs/`). SDK mirrors it exactly. TUI uses SDK types. No guessing.
- **No fallback chains**: `model.id || model.name || model.model_id` is ALWAYS wrong — it means you don't know what the backend returns. Check the DTO, use the correct field name.
- **No `[key: string]: unknown` as a substitute for typed fields**: If the backend returns specific fields, type them. Catch-all index signatures hide contract mismatches.

### TUI Monitor Architecture

#### How the Monitor Works

The TUI monitor (`node index.js monitor <session-id>`) polls `GET /api/sessions/{id}` every 2 seconds and renders session state.

**Critical**: The API requires **full UUIDs**, not short ID prefixes. The CLI resolves short IDs to full UUIDs before calling the API, but the monitor's internal API client does NOT — it passes the ID as-is. If the monitor receives a short ID, it will get 404.

#### Monitor Data Dependencies

The monitor reads these session variables. **If they're malformed, the monitor breaks silently.**

| Variable | Expected Format | What Breaks If Wrong |
|----------|----------------|---------------------|
| `_phases` | `[{id: string, name: string, status: string, description?: string}, ...]` | Phases show as white/unnamed, wrong expand behavior |
| `_monitorDescriptor` | `{layout: {mode: string, zones: {...}}, components: [...]}` | Monitor layout collapses, shows nothing |
| `_executionTree` | `[{id, name, status, children: [], output?}, ...]` | Execution tree empty |
| `_executionLog` | `[{time, level, msg}, ...]` | Log panel empty |
| `_llmActivity` | `[{nodeId, time, duration, promptPreview, responsePreview}, ...]` | LLM panel empty |

#### Verifying Monitor Health

After setting variables or invoking entry points, **always verify the data is correct**:

```bash
# Verify _phases is an array of objects with id/name/status
curl -s http://localhost:5000/api/sessions/<FULL-UUID>/variables/_phases | python -m json.tool

# Verify _monitorDescriptor has layout.mode and components
curl -s http://localhost:5000/api/sessions/<FULL-UUID>/variables/_monitorDescriptor | python -m json.tool

# Check the full session response that the monitor sees
curl -s http://localhost:5000/api/sessions/<FULL-UUID> | python -m json.tool | head -50
```

#### Session Invoke vs Run

- `node index.js run <block-id>` — Direct block execution. **No session context, no monitoring.** Results only in CLI output.
- `node index.js session invoke <id> <entry-point>` — Executes through the session. Updates `_executionTree`, `_executionLog`, `_llmActivity`. **The monitor can see it.**

Entry points map to block IDs. The `EntryPointExecutor` dispatches based on block type:
- **Workflow block** → walks `config.nodes`, each node appears in `_executionTree`
- **Agent block** → runs the agent loop, appears as a single node in `_executionTree`
- **Block without config.nodes** → executes as a "passthrough" (does nothing useful)

**Rule**: For the monitor to show meaningful data, always use `session invoke`, never `run`.

---

## Related Documentation

- [README.md](../README.md) - Project overview
- [Clean Architecture Instructions](../.github/instructions/clean-architecture.instructions.md) - Detailed architecture rules
- [ROADMAP.md](../ROADMAP.md) - Development roadmap
- [Frontend Guide](./frontend-guide.md) - Frontend development guide
- [Common Pitfalls](../../guides/ai-agents/common-pitfalls.md) - Known pitfalls and fixes
- [Testing Strategy](../../guides/ai-agents/testing-strategy.md) - Testing requirements

---

**Last Updated**: 2026-03-02
**Maintained by**: Backend Team
