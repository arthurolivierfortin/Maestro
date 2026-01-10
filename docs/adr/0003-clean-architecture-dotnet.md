# ADR 0003: Clean Architecture with .NET

**Status**: Accepted  
**Date**: 2024-01-09  
**Decision Makers**: Architecture Team

---

## Context

B-One Maestro requires a backend architecture that is maintainable, testable, and scalable. The backend will handle complex orchestration logic, agent coordination, and integration with external systems.

### The Problem

- Need clear separation between business logic and technical concerns
- Must support dependency inversion (model-agnostic design)
- Require high testability (unit, integration, end-to-end)
- Want to minimize coupling between layers
- Need to support future extensibility

### Requirements

1. Business logic isolated from frameworks and infrastructure
2. Easy to test without external dependencies
3. Clear dependency flow (toward domain)
4. Framework independence (swap out tools without breaking core)
5. Scalable codebase as project grows

---

## Decision

**We will implement Clean Architecture with SOLID principles using .NET.**

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│           (API Controllers, SignalR Hubs)               │
│                  Maestro.Api                            │
└────────────────────┬────────────────────────────────────┘
                     │ depends on
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│         (Use Cases, DTOs, Interfaces)                   │
│               Maestro.Application                       │
└────────────────────┬────────────────────────────────────┘
                     │ depends on
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Domain Layer                          │
│       (Entities, Value Objects, Domain Logic)           │
│                  Maestro.Domain                         │
└─────────────────────────────────────────────────────────┘
                     ▲
                     │ implemented by
                     │
┌─────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                     │
│    (Persistence, External APIs, LLM Gateway)            │
│              Maestro.Infrastructure                     │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. Domain Layer (`Maestro.Domain`)

**Purpose**: Core business logic and rules

**Contains**:
- `Entities`: Workflow, Node, Agent, Tool, ExecutionContext
- `Value Objects`: WorkflowId, NodeId, AgentType, NodeStatus
- `Interfaces`: IAgent, ITool, IWorkflowRepository (abstractions only)
- `Domain Services`: WorkflowValidator, NodeConnectionRules
- `Exceptions`: Domain-specific exceptions

**Rules**:
- ✅ No external dependencies (pure C#)
- ✅ Contains ALL business rules
- ✅ Framework-agnostic
- ❌ No infrastructure concerns (database, HTTP, file system)
- ❌ No serialization attributes
- ❌ No dependency on Application or Infrastructure

**Example**:
```csharp
namespace Maestro.Domain.Entities;

public class Workflow
{
    private readonly List<Node> _nodes = new();
    
    public WorkflowId Id { get; private set; }
    public string Name { get; private set; }
    public IReadOnlyCollection<Node> Nodes => _nodes.AsReadOnly();
    
    private Workflow() { } // Required for EF Core, not public
    
    public static Workflow Create(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Workflow name cannot be empty");
            
        return new Workflow 
        { 
            Id = WorkflowId.New(), 
            Name = name 
        };
    }
    
    public void AddNode(Node node)
    {
        if (_nodes.Any(n => n.Id == node.Id))
            throw new DomainException("Node with this ID already exists");
            
        _nodes.Add(node);
    }
    
    public void Validate()
    {
        if (_nodes.Count == 0)
            throw new DomainException("Workflow must have at least one node");
            
        // Check for cycles, orphaned nodes, etc.
    }
}
```

#### 2. Application Layer (`Maestro.Application`)

**Purpose**: Use cases and application logic

**Contains**:
- `Commands`: CreateWorkflow, ExecuteWorkflow, PauseExecution (CQRS)
- `Queries`: GetWorkflow, GetExecutionStatus, ListWorkflows
- `DTOs`: WorkflowDto, NodeDto, ExecutionStatusDto
- `Interfaces`: ILLMGateway, IGitService, IFileSystemService (contracts for infrastructure)
- `Services`: WorkflowOrchestrator, ExecutionEngine
- `Mappings`: AutoMapper profiles

**Rules**:
- ✅ Depends only on Domain
- ✅ Defines interfaces for infrastructure
- ✅ Contains orchestration logic
- ❌ No implementation of external concerns
- ❌ No concrete infrastructure classes

**Example**:
```csharp
namespace Maestro.Application.Commands.ExecuteWorkflow;

public record ExecuteWorkflowCommand(WorkflowId WorkflowId) : IRequest<ExecutionResult>;

public class ExecuteWorkflowCommandHandler : IRequestHandler<ExecuteWorkflowCommand, ExecutionResult>
{
    private readonly IWorkflowRepository _repository;
    private readonly IExecutionEngine _executionEngine;
    
    public ExecuteWorkflowCommandHandler(
        IWorkflowRepository repository,
        IExecutionEngine executionEngine)
    {
        _repository = repository;
        _executionEngine = executionEngine;
    }
    
    public async Task<ExecutionResult> Handle(
        ExecuteWorkflowCommand request, 
        CancellationToken cancellationToken)
    {
        var workflow = await _repository.GetByIdAsync(request.WorkflowId, cancellationToken);
        
        if (workflow is null)
            throw new WorkflowNotFoundException(request.WorkflowId);
        
        workflow.Validate(); // Domain validation
        
        return await _executionEngine.ExecuteAsync(workflow, cancellationToken);
    }
}
```

#### 3. Infrastructure Layer (`Maestro.Infrastructure`)

**Purpose**: Implementation of external concerns

**Contains**:
- `Persistence`: JsonWorkflowRepository, FileSystemStorage
- `LLMGateway`: LLMGateway, OpenAIAdapter, OllamaAdapter
- `Git`: GitService, PRCreationService
- `FileSystem`: FileSystemService, SandboxedFileSystem
- `ToolExecutors`: BashToolExecutor, GitToolExecutor

**Rules**:
- ✅ Implements interfaces from Application layer
- ✅ Contains all framework/library code
- ✅ Depends on Application and Domain
- ❌ Never referenced by Domain

**Example**:
```csharp
namespace Maestro.Infrastructure.Persistence;

public class JsonWorkflowRepository : IWorkflowRepository
{
    private readonly string _workflowsPath;
    private readonly ILogger<JsonWorkflowRepository> _logger;
    
    public JsonWorkflowRepository(
        IOptions<WorkflowOptions> options,
        ILogger<JsonWorkflowRepository> logger)
    {
        _workflowsPath = options.Value.StoragePath;
        _logger = logger;
    }
    
    public async Task<Workflow?> GetByIdAsync(
        WorkflowId id, 
        CancellationToken cancellationToken)
    {
        var files = Directory.GetFiles(_workflowsPath, "*.json", SearchOption.AllDirectories);
        
        foreach (var file in files)
        {
            var json = await File.ReadAllTextAsync(file, cancellationToken);
            var dto = JsonSerializer.Deserialize<WorkflowDto>(json);
            
            if (dto?.Id == id.Value.ToString())
                return MapToDomain(dto);
        }
        
        return null;
    }
    
    private Workflow MapToDomain(WorkflowDto dto)
    {
        // Mapping logic
    }
}
```

#### 4. Presentation Layer (`Maestro.Api`)

**Purpose**: HTTP API and real-time communication

**Contains**:
- `Controllers`: REST API endpoints
- `Hubs`: SignalR for real-time updates
- `Middleware`: Error handling, logging, authentication
- `Filters`: Validation, authorization
- `Program.cs`: DI configuration

**Rules**:
- ✅ Thin layer - delegates to Application
- ✅ Depends on Application and Infrastructure (for DI)
- ✅ HTTP-specific concerns only
- ❌ No business logic

**Example**:
```csharp
namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowsController : ControllerBase
{
    private readonly IMediator _mediator;
    
    public WorkflowsController(IMediator mediator)
    {
        _mediator = mediator;
    }
    
    [HttpPost("{id}/execute")]
    public async Task<ActionResult<ExecutionResult>> Execute(
        Guid id, 
        CancellationToken cancellationToken)
    {
        var command = new ExecuteWorkflowCommand(new WorkflowId(id));
        var result = await _mediator.Send(command, cancellationToken);
        
        return Ok(result);
    }
}
```

---

## SOLID Principles

### Single Responsibility Principle (SRP)
Each class has one reason to change.

✅ **Good**: `CreateWorkflowCommandHandler` only creates workflows
❌ **Bad**: `WorkflowService` that creates, executes, and validates

### Open/Closed Principle (OCP)
Open for extension, closed for modification.

✅ **Good**: Add new `ILLMAdapter` implementations without changing `LLMGateway`
❌ **Bad**: Modify `Agent` class to support new model

### Liskov Substitution Principle (LSP)
Subtypes must be substitutable for base types.

✅ **Good**: Any `ILLMAdapter` can replace another
❌ **Bad**: `OllamaAdapter` throws exception for feature that `OpenAIAdapter` supports

### Interface Segregation Principle (ISP)
No client should depend on methods it doesn't use.

✅ **Good**: `ILLMGateway` with focused methods
❌ **Bad**: Giant `IAgentService` with 20+ methods

### Dependency Inversion Principle (DIP)
Depend on abstractions, not concretions.

✅ **Good**: `Agent` depends on `ILLMGateway`
❌ **Bad**: `Agent` depends on `OpenAIClient`

---

## Dependency Injection

All dependencies registered in `Program.cs`:

```csharp
// Domain has no dependencies

// Application services
builder.Services.AddMediatR(cfg => 
    cfg.RegisterServicesFromAssembly(typeof(ExecuteWorkflowCommand).Assembly));
builder.Services.AddAutoMapper(typeof(MappingProfile).Assembly);

// Infrastructure services
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();
builder.Services.AddScoped<ILLMGateway, LLMGateway>();
builder.Services.AddScoped<ILLMAdapter, OpenAIAdapter>();
builder.Services.AddScoped<IGitService, GitService>();
```

---

## Testing Strategy

### Domain Tests
Pure unit tests, no mocking:

```csharp
[Fact]
public void Workflow_Create_WithEmptyName_ThrowsException()
{
    var act = () => Workflow.Create("");
    act.Should().Throw<DomainException>();
}
```

### Application Tests
Mock infrastructure interfaces:

```csharp
[Fact]
public async Task ExecuteWorkflow_ValidWorkflow_ReturnsSuccess()
{
    var repositoryMock = new Mock<IWorkflowRepository>();
    repositoryMock.Setup(x => x.GetByIdAsync(It.IsAny<WorkflowId>(), It.IsAny<CancellationToken>()))
        .ReturnsAsync(Workflow.Create("Test"));
    
    var handler = new ExecuteWorkflowCommandHandler(repositoryMock.Object, /* ... */);
    
    var result = await handler.Handle(new ExecuteWorkflowCommand(/* ... */), CancellationToken.None);
    
    result.Should().NotBeNull();
}
```

### Infrastructure Tests
Integration tests with real dependencies (or test doubles):

```csharp
[Fact]
public async Task JsonWorkflowRepository_Save_PersistsToFile()
{
    var repository = new JsonWorkflowRepository(/* ... */);
    var workflow = Workflow.Create("Test Workflow");
    
    await repository.SaveAsync(workflow);
    
    var retrieved = await repository.GetByIdAsync(workflow.Id);
    retrieved.Should().NotBeNull();
}
```

---

## Consequences

### Positive

1. **Testability**: Each layer tested independently
2. **Maintainability**: Clear boundaries and responsibilities
3. **Flexibility**: Swap implementations without breaking core
4. **Scalability**: Easy to add features without breaking existing code
5. **Team Collaboration**: Developers can work on different layers independently

### Negative

1. **Initial Complexity**: More files and projects than simple architecture
2. **Learning Curve**: Team must understand Clean Architecture
3. **Boilerplate**: DTOs and mappings add code
4. **Abstraction Cost**: Extra interfaces and indirection

### Mitigations

- Provide documentation and examples
- Use code generators for boilerplate (AutoMapper, MediatR)
- Enforce architecture with ArchUnit tests
- Regular code reviews to ensure compliance

---

## Alternatives Considered

### Alternative 1: Layered Architecture (Traditional N-Tier)

UI → Business Logic → Data Access

**Rejected because**:
- Tight coupling to database
- Hard to test
- Business logic often leaks into other layers

### Alternative 2: Vertical Slice Architecture

Organize by feature, not layer.

**Considered but deferred**:
- Good for simpler applications
- Clean Architecture provides better separation
- May revisit for specific features

### Alternative 3: Hexagonal Architecture (Ports and Adapters)

Similar to Clean Architecture, but different terminology.

**Note**: Clean Architecture and Hexagonal are very similar. We chose Clean Architecture for better .NET community familiarity.

---

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [.NET Clean Architecture Template by Jason Taylor](https://github.com/jasontaylordev/CleanArchitecture)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)

---

## Status History

- 2024-01-09: Accepted
