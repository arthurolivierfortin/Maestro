---
description: "Clean Architecture guidelines for B-One Maestro project"
applyTo: "**/*.cs, **/Program.cs, **/Controllers/*.cs, **/Services/*.cs"
---

# Clean Architecture Guidelines for Maestro

## Architecture Overview

Maestro follows **Clean Architecture** principles with strict layer separation and dependency rules. This document defines mandatory architectural rules that MUST be followed when creating or modifying code.

## Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│              (Maestro.Api, Controllers, Hubs)                │
└─────────────────────────────────────────────────────────────┘
                            │ depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│         (Maestro.Application, Use Cases, DTOs)               │
└─────────────────────────────────────────────────────────────┘
                            │ depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│      (Maestro.Domain, Entities, Value Objects, Rules)        │
│                   ← DEPENDS ON NOTHING                       │
└─────────────────────────────────────────────────────────────┘
                            ↑ depends on
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│     (Maestro.Infrastructure, LLM Gateway, Persistence)       │
└─────────────────────────────────────────────────────────────┘
```

## Dependency Rules (MANDATORY)

### Rule 1: Domain Layer Independence
**The Domain layer MUST NOT depend on any other layer.**

✅ **Allowed:**
- Domain entities reference other domain entities
- Domain services use domain interfaces
- Value objects are self-contained
- Domain events and exceptions

❌ **Forbidden:**
- Importing `Maestro.Application` namespace
- Importing `Maestro.Infrastructure` namespace
- Importing `Maestro.Api` namespace
- Importing external libraries (except primitives and standard library)
- Using `ILLMGateway` directly in domain entities
- Database context or EF Core in domain layer

**Example - Correct Domain Entity:**
```csharp
namespace Maestro.Domain.Entities
{
    public class Workflow
    {
        public WorkflowId Id { get; private set; }
        public string Name { get; private set; }
        public List<Node> Nodes { get; private set; }
        
        // Domain logic only - no infrastructure concerns
        public void AddNode(Node node)
        {
            if (node == null)
                throw new DomainException("Node cannot be null");
            
            Nodes.Add(node);
        }
        
        public bool CanExecute()
        {
            return Nodes.Any() && Nodes.All(n => n.IsValid());
        }
    }
}
```

### Rule 2: Application Layer Dependencies
**Application layer MUST depend ONLY on Domain layer.**

✅ **Allowed:**
- Use domain entities and value objects
- Define interfaces for infrastructure services (ILLMGateway, IWorkflowRepository)
- Implement use cases and orchestration logic
- Define DTOs for API communication

❌ **Forbidden:**
- Direct implementation of ILLMGateway (belongs in Infrastructure)
- Database context or EF Core (belongs in Infrastructure)
- SignalR hubs (belongs in Presentation)
- HTTP clients or external APIs (belongs in Infrastructure)

**Example - Correct Use Case:**
```csharp
namespace Maestro.Application.UseCases
{
    public class ExecuteWorkflowUseCase
    {
        private readonly IWorkflowRepository _repository;
        private readonly ILLMGateway _llmGateway;
        private readonly IExecutionMonitor _monitor;
        
        public ExecuteWorkflowUseCase(
            IWorkflowRepository repository,
            ILLMGateway llmGateway,
            IExecutionMonitor monitor)
        {
            _repository = repository;
            _llmGateway = llmGateway;
            _monitor = monitor;
        }
        
        public async Task<ExecutionResult> Execute(WorkflowId id)
        {
            var workflow = await _repository.GetById(id);
            
            if (!workflow.CanExecute())
                return ExecutionResult.Failed("Workflow not ready");
            
            // Orchestration logic here
            return await ExecuteNodes(workflow);
        }
    }
}
```

### Rule 3: Infrastructure Layer Implementation
**Infrastructure implements interfaces defined in Application layer.**

✅ **Allowed:**
- Implement ILLMGateway with OpenAI, Anthropic, Ollama adapters
- Implement IWorkflowRepository with JSON or database persistence
- Implement IGitService for Git operations
- Third-party library integrations

❌ **Forbidden:**
- Domain entities depending on infrastructure implementations
- Infrastructure types leaked to Application or Domain
- Infrastructure-specific exceptions in Domain layer

**Example - Correct Infrastructure Implementation:**
```csharp
namespace Maestro.Infrastructure.LLMGateway
{
    public class OpenAIAdapter : ILLMGateway
    {
        private readonly OpenAIClient _client;
        
        public OpenAIAdapter(IConfiguration config)
        {
            _client = new OpenAIClient(config["OpenAI:ApiKey"]);
        }
        
        public async Task<LLMResponse> SendPrompt(LLMRequest request)
        {
            var response = await _client.GetCompletionAsync(
                request.Model,
                request.Messages
            );
            
            return new LLMResponse
            {
                Content = response.Content,
                TokensUsed = response.Usage.TotalTokens
            };
        }
    }
}
```

### Rule 4: Presentation Layer Coordination
**Presentation layer coordinates Application layer and Infrastructure.**

✅ **Allowed:**
- Controllers call use cases from Application layer
- SignalR hubs publish events
- Dependency injection configuration
- Request/response mapping

❌ **Forbidden:**
- Business logic in controllers
- Direct database access from controllers
- Domain entities exposed in API responses (use DTOs)

**Example - Correct Controller:**
```csharp
namespace Maestro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowsController : ControllerBase
    {
        private readonly ExecuteWorkflowUseCase _executeUseCase;
        
        public WorkflowsController(ExecuteWorkflowUseCase executeUseCase)
        {
            _executeUseCase = executeUseCase;
        }
        
        [HttpPost("{id}/execute")]
        public async Task<IActionResult> Execute(string id)
        {
            var workflowId = new WorkflowId(id);
            var result = await _executeUseCase.Execute(workflowId);
            
            if (!result.IsSuccess)
                return BadRequest(result.Error);
            
            return Ok(WorkflowDto.FromDomain(result.Workflow));
        }
    }
}
```

## Model-Agnostic Design (CRITICAL)

### Abstraction Rule
**NEVER import OpenAI, Anthropic, or any LLM SDK directly in Application or Domain layers.**

✅ **Correct Approach:**
```csharp
// Application Layer - Define interface
public interface ILLMGateway
{
    Task<LLMResponse> SendPrompt(LLMRequest request);
}

// Infrastructure Layer - Implement for each provider
public class OpenAIAdapter : ILLMGateway { }
public class AnthropicAdapter : ILLMGateway { }
public class OllamaAdapter : ILLMGateway { }
```

❌ **Incorrect Approach:**
```csharp
// NEVER do this in Application layer
using OpenAI;

public class PlannerAgent
{
    private readonly OpenAIClient _client; // ❌ Direct coupling!
}
```

### Configuration-Based Model Selection
Models are selected via configuration, not hardcoded:

```json
{
  "LLM": {
    "DefaultProvider": "OpenAI",
    "Providers": {
      "OpenAI": {
        "ApiKey": "...",
        "DefaultModel": "gpt-4"
      },
      "Anthropic": {
        "ApiKey": "...",
        "DefaultModel": "claude-3-opus"
      }
    }
  }
}
```

## File Organization

### Domain Layer Structure
```
Maestro.Domain/
├── Entities/
│   ├── Workflow.cs
│   ├── Node.cs
│   ├── Agent.cs
│   └── ExecutionContext.cs
├── ValueObjects/
│   ├── WorkflowId.cs
│   ├── NodeId.cs
│   └── NodeStatus.cs
├── Interfaces/
│   ├── IWorkflowRepository.cs
│   └── IAgent.cs
├── Services/
│   └── WorkflowValidator.cs
└── Exceptions/
    └── DomainException.cs
```

### Application Layer Structure
```
Maestro.Application/
├── UseCases/
│   ├── CreateWorkflow/
│   │   ├── CreateWorkflowUseCase.cs
│   │   ├── CreateWorkflowRequest.cs
│   │   └── CreateWorkflowResponse.cs
│   └── ExecuteWorkflow/
│       ├── ExecuteWorkflowUseCase.cs
│       └── ExecutionResult.cs
├── DTOs/
│   ├── WorkflowDto.cs
│   └── NodeDto.cs
└── Interfaces/
    ├── ILLMGateway.cs
    ├── IGitService.cs
    └── IExecutionMonitor.cs
```

### Infrastructure Layer Structure
```
Maestro.Infrastructure/
├── LLMGateway/
│   ├── LLMGateway.cs (factory)
│   ├── OpenAIAdapter.cs
│   ├── AnthropicAdapter.cs
│   └── OllamaAdapter.cs
├── Persistence/
│   ├── JsonWorkflowRepository.cs
│   └── FileSystemStorage.cs
├── Git/
│   └── GitService.cs
└── Monitoring/
    └── ExecutionMonitor.cs
```

## Testing Strategy

### Unit Tests
- **Domain Layer**: Pure logic tests, no mocks needed
- **Application Layer**: Mock infrastructure interfaces (ILLMGateway, IWorkflowRepository)
- **Infrastructure Layer**: Integration tests with real services

### Test Naming Convention
```csharp
[Fact]
public void Workflow_AddNode_ShouldAddNodeToCollection()
{
    // Arrange
    var workflow = new Workflow("Test");
    var node = new AgentNode("node1");
    
    // Act
    workflow.AddNode(node);
    
    // Assert
    Assert.Contains(node, workflow.Nodes);
}
```

## Code Review Checklist

When reviewing code, verify:

- [ ] Domain layer has zero external dependencies
- [ ] Application layer only imports Domain
- [ ] Infrastructure implements Application interfaces
- [ ] No direct LLM SDK usage in Application or Domain
- [ ] Controllers delegate to use cases
- [ ] DTOs used for API responses (not domain entities)
- [ ] Interfaces defined in correct layer (Application defines, Infrastructure implements)
- [ ] Dependency injection properly configured
- [ ] Unit tests cover domain logic
- [ ] Integration tests cover infrastructure implementations

## Common Mistakes to Avoid

### ❌ Mistake 1: Infrastructure in Domain
```csharp
// WRONG - Domain entity with infrastructure concern
public class Workflow
{
    private readonly ILLMGateway _llmGateway; // ❌ Infrastructure in domain!
}
```

### ❌ Mistake 2: Business Logic in Controllers
```csharp
// WRONG - Business logic in controller
[HttpPost]
public IActionResult Execute(WorkflowDto dto)
{
    if (dto.Nodes.Count == 0) // ❌ Validation logic here!
        return BadRequest();
    
    // ❌ Orchestration logic in controller!
    foreach (var node in dto.Nodes)
    {
        // Execute logic...
    }
}
```

### ❌ Mistake 3: Domain Entities in API Responses
```csharp
// WRONG - Exposing domain entity directly
[HttpGet("{id}")]
public Workflow GetWorkflow(string id) // ❌ Should return DTO!
{
    return _repository.GetById(new WorkflowId(id));
}
```

## Exceptions and Edge Cases

### When to Deviate
Clean Architecture rules should be followed strictly. Deviations require:
1. Architectural Decision Record (ADR) documenting the reason
2. Approval from tech lead
3. Clear comment in code explaining deviation

### Example ADR Reference
```csharp
// ADR-005: Direct database access in read model for performance
// This violates layer separation but is necessary for query optimization
public class WorkflowReadModel
{
    // Special case implementation...
}
```

## Resources

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Maestro Architecture Decision Records](../../docs/adr/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## Summary

**Remember:**
1. **Domain is sacred** - No external dependencies
2. **Interfaces in Application** - Implementations in Infrastructure
3. **Model agnostic** - No direct LLM SDK imports
4. **DTOs for API** - Never expose domain entities
5. **Use cases orchestrate** - Controllers delegate
6. **Test each layer** - Unit tests for domain, integration for infrastructure
