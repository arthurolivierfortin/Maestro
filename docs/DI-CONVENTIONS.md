# Dependency Injection Conventions

This document describes the dependency injection patterns and conventions used in B-One Maestro.

## Overview

B-One Maestro uses the built-in ASP.NET Core dependency injection container to manage dependencies following Clean Architecture principles.

## Service Registration

All service registrations happen in `backend/src/Maestro.Api/Program.cs`.

### Registration by Layer

#### Domain Layer
The Domain layer has **NO dependencies** and registers **nothing**. It's pure business logic.

#### Application Layer
The Application layer defines **interfaces only**. It does not register any services.

Interfaces defined in Application:
- `ILLMGateway` - Abstraction for LLM communication
- `IWorkflowRepository` - Abstraction for workflow persistence
- `IExecutionMonitor` - Abstraction for execution monitoring
- `IGitService` - Abstraction for Git operations
- `IFileSystemService` - Abstraction for file system operations

#### Infrastructure Layer
Infrastructure implementations are registered as follows:

```csharp
// In Program.cs

// Persistence
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();

// LLM Gateway
builder.Services.AddScoped<ILLMGateway, LLMGateway>();

// Monitoring
builder.Services.AddScoped<IExecutionMonitor, ExecutionMonitor>();

// Git Service (when implemented)
builder.Services.AddScoped<IGitService, GitService>();

// File System Service (when implemented)
builder.Services.AddScoped<IFileSystemService, FileSystemService>();
```

#### Presentation Layer (API)
Controllers and hubs are automatically registered by ASP.NET Core:

```csharp
builder.Services.AddControllers();
```

## Service Lifetimes

### Singleton
Use for stateless services that can be shared across the application lifetime:
```csharp
builder.Services.AddSingleton<ICacheService, MemoryCacheService>();
```

**When to use:**
- Configuration services
- Caching services
- Services with no state

### Scoped
Use for services that should live for the duration of a single request:
```csharp
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();
```

**When to use:**
- Database contexts
- Repositories
- Use cases
- Services that may hold request-specific state

**Default choice** for most application services.

### Transient
Use for lightweight, stateless services that are created each time they're requested:
```csharp
builder.Services.AddTransient<IEmailService, EmailService>();
```

**When to use:**
- Lightweight services
- Services that should not be reused
- Services that are not thread-safe

## Dependency Injection Patterns

### Constructor Injection (Preferred)
Always use constructor injection for required dependencies:

```csharp
public class WorkflowsController : ControllerBase
{
    private readonly IWorkflowRepository _repository;
    private readonly ILogger<WorkflowsController> _logger;

    public WorkflowsController(
        IWorkflowRepository repository,
        ILogger<WorkflowsController> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
}
```

### Property Injection (Avoid)
❌ Do not use property injection. It makes dependencies unclear and harder to test.

### Method Injection (Rare)
Only use when a dependency is needed for a single method and nowhere else:

```csharp
public IActionResult ProcessWorkflow([FromServices] ISpecialService service)
{
    // Use service only in this method
}
```

## Testing with Dependency Injection

### Unit Tests
Mock dependencies using Moq or similar:

```csharp
public class WorkflowsControllerTests
{
    private readonly Mock<IWorkflowRepository> _mockRepository;
    private readonly Mock<ILogger<WorkflowsController>> _mockLogger;
    private readonly WorkflowsController _controller;

    public WorkflowsControllerTests()
    {
        _mockRepository = new Mock<IWorkflowRepository>();
        _mockLogger = new Mock<ILogger<WorkflowsController>>();
        _controller = new WorkflowsController(
            _mockRepository.Object,
            _mockLogger.Object
        );
    }

    [Fact]
    public async Task GetWorkflows_ShouldReturnAllWorkflows()
    {
        // Arrange
        var workflows = new List<Workflow> { /* ... */ };
        _mockRepository
            .Setup(r => r.GetAllAsync())
            .ReturnsAsync(workflows);

        // Act
        var result = await _controller.GetAll();

        // Assert
        Assert.NotNull(result);
        _mockRepository.Verify(r => r.GetAllAsync(), Times.Once);
    }
}
```

### Integration Tests
Use `WebApplicationFactory` for end-to-end testing:

```csharp
public class WorkflowApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public WorkflowApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetWorkflows_ReturnsSuccessStatusCode()
    {
        var response = await _client.GetAsync("/api/workflows");
        response.EnsureSuccessStatusCode();
    }
}
```

## Configuration-Based Service Registration

For services that depend on configuration:

```csharp
// Register configuration section
builder.Services.Configure<LLMGatewayOptions>(
    builder.Configuration.GetSection("LLM")
);

// Use IOptions<T> in services
public class LLMGateway : ILLMGateway
{
    private readonly LLMGatewayOptions _options;

    public LLMGateway(IOptions<LLMGatewayOptions> options)
    {
        _options = options.Value;
    }
}
```

## Factory Pattern for Complex Services

When service creation is complex, use the factory pattern:

```csharp
// Register factory
builder.Services.AddScoped<ILLMGateway>(serviceProvider =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    var provider = configuration["LLM:Provider"];
    
    return provider switch
    {
        "OpenAI" => new OpenAIAdapter(configuration),
        "Anthropic" => new AnthropicAdapter(configuration),
        "Ollama" => new OllamaAdapter(configuration),
        _ => throw new InvalidOperationException($"Unknown LLM provider: {provider}")
    };
});
```

## Service Locator Anti-Pattern

❌ **DO NOT** use service locator pattern:

```csharp
// BAD - Service Locator
public class BadService
{
    public void DoSomething(IServiceProvider serviceProvider)
    {
        var repository = serviceProvider.GetService<IWorkflowRepository>();
        // ...
    }
}
```

✅ **DO** use constructor injection:

```csharp
// GOOD - Constructor Injection
public class GoodService
{
    private readonly IWorkflowRepository _repository;

    public GoodService(IWorkflowRepository repository)
    {
        _repository = repository;
    }

    public void DoSomething()
    {
        // Use _repository
    }
}
```

## Conditional Registration

For environment-specific services:

```csharp
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddScoped<IEmailService, FakeEmailService>();
}
else
{
    builder.Services.AddScoped<IEmailService, SendGridEmailService>();
}
```

## Validation

Services should validate their dependencies:

```csharp
public class WorkflowOrchestrator
{
    private readonly IWorkflowRepository _repository;
    private readonly ILLMGateway _llmGateway;

    public WorkflowOrchestrator(
        IWorkflowRepository repository,
        ILLMGateway llmGateway)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _llmGateway = llmGateway ?? throw new ArgumentNullException(nameof(llmGateway));
    }
}
```

## Common Mistakes to Avoid

### ❌ Captive Dependencies
Don't inject a service with a longer lifetime into a service with a shorter lifetime:

```csharp
// BAD - Singleton depends on Scoped
builder.Services.AddSingleton<CacheService>(); // Singleton
builder.Services.AddScoped<IWorkflowRepository, WorkflowRepository>(); // Scoped

public class CacheService // Singleton
{
    private readonly IWorkflowRepository _repository; // Scoped - WRONG!
}
```

### ❌ New Keyword for Services
Don't create service instances with `new`:

```csharp
// BAD
public class WorkflowsController
{
    private readonly IWorkflowRepository _repository = new JsonWorkflowRepository(); // WRONG!
}

// GOOD
public class WorkflowsController
{
    private readonly IWorkflowRepository _repository;

    public WorkflowsController(IWorkflowRepository repository)
    {
        _repository = repository;
    }
}
```

### ❌ Circular Dependencies
Avoid circular dependencies between services:

```csharp
// BAD - Circular dependency
public class ServiceA
{
    public ServiceA(ServiceB b) { }
}

public class ServiceB
{
    public ServiceB(ServiceA a) { } // Circular!
}
```

## Summary

1. **Always use constructor injection** for dependencies
2. **Register services in Program.cs** following layer boundaries
3. **Use Scoped lifetime** as default for application services
4. **Validate dependencies** in constructors (null checks)
5. **Avoid service locator** anti-pattern
6. **Mock dependencies** in unit tests
7. **Follow Clean Architecture** - Infrastructure implements Application interfaces

## Resources

- [ASP.NET Core Dependency Injection](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection)
- [Clean Architecture Dependency Rules](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
