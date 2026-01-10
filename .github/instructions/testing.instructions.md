---
description: "Testing guidelines and best practices for B-One Maestro project"
applyTo: "**/*.Tests/*.cs, **/*.test.ts, **/*.test.tsx, **/*.spec.ts"
---

# Testing Guidelines for Maestro

## Testing Philosophy

Maestro follows a comprehensive testing strategy aligned with Clean Architecture principles:

1. **Test Pyramid**: Many unit tests, fewer integration tests, minimal E2E tests
2. **Test in Isolation**: Each layer tested independently with appropriate mocks
3. **Behavior over Implementation**: Test what code does, not how it does it
4. **Fast Feedback**: Tests should run quickly to support TDD workflow
5. **Maintainable Tests**: Tests are code too - apply SOLID principles

## Test Coverage Requirements

### Minimum Coverage Targets
- **Domain Layer**: 90% coverage (critical business logic)
- **Application Layer**: 80% coverage (use cases and orchestration)
- **Infrastructure Layer**: 70% coverage (integration tests preferred)
- **Presentation Layer**: 60% coverage (focus on critical paths)

### What Must Be Tested
- ✅ All domain entities and their business rules
- ✅ All value objects and their validation
- ✅ All use cases (application services)
- ✅ All domain services
- ✅ Critical infrastructure implementations (LLM Gateway, repositories)
- ✅ API endpoints (integration tests)

### What Can Be Skipped
- ⚠️ Simple DTOs with no logic
- ⚠️ Auto-generated code
- ⚠️ Third-party library wrappers (unless complex)
- ⚠️ Configuration classes

---

## Backend Testing (.NET/xUnit)

### Project Structure

```
Maestro.sln
├── src/
│   ├── Maestro.Domain/
│   ├── Maestro.Application/
│   ├── Maestro.Infrastructure/
│   └── Maestro.Api/
└── tests/
    ├── Maestro.Domain.Tests/
    │   ├── Entities/
    │   │   ├── WorkflowTests.cs
    │   │   └── NodeTests.cs
    │   ├── ValueObjects/
    │   │   └── WorkflowIdTests.cs
    │   └── Services/
    │       └── WorkflowValidatorTests.cs
    ├── Maestro.Application.Tests/
    │   ├── UseCases/
    │   │   ├── CreateWorkflowUseCaseTests.cs
    │   │   └── ExecuteWorkflowUseCaseTests.cs
    │   └── Mocks/
    │       ├── MockLLMGateway.cs
    │       └── MockWorkflowRepository.cs
    ├── Maestro.Infrastructure.Tests/
    │   ├── LLMGateway/
    │   │   └── OpenAIAdapterTests.cs
    │   └── Persistence/
    │       └── JsonWorkflowRepositoryTests.cs
    └── Maestro.Api.Tests/
        ├── Controllers/
        │   └── WorkflowsControllerTests.cs
        └── Integration/
            └── WorkflowApiTests.cs
```

### Domain Layer Testing

Domain tests should have **zero external dependencies** - no mocks, no infrastructure.

#### Testing Entities

```csharp
using Xunit;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Domain.Exceptions;

namespace Maestro.Domain.Tests.Entities
{
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
            Assert.NotNull(workflow);
            Assert.NotNull(workflow.Id);
            Assert.Equal(name, workflow.Name);
            Assert.Equal(description, workflow.Description);
            Assert.Empty(workflow.Nodes);
        }
        
        [Fact]
        public void AddNode_WithValidNode_ShouldAddNodeToCollection()
        {
            // Arrange
            var workflow = Workflow.Create("Test", "Description");
            var node = new AgentNode(NodeId.NewId(), "Planner");
            
            // Act
            workflow.AddNode(node);
            
            // Assert
            Assert.Single(workflow.Nodes);
            Assert.Contains(node, workflow.Nodes);
        }
        
        [Fact]
        public void AddNode_WithNullNode_ShouldThrowArgumentNullException()
        {
            // Arrange
            var workflow = Workflow.Create("Test", "Description");
            
            // Act & Assert
            Assert.Throws<ArgumentNullException>(() => workflow.AddNode(null));
        }
        
        [Fact]
        public void AddNode_WithDuplicateNode_ShouldThrowDomainException()
        {
            // Arrange
            var workflow = Workflow.Create("Test", "Description");
            var node = new AgentNode(NodeId.NewId(), "Planner");
            workflow.AddNode(node);
            
            // Act & Assert
            var exception = Assert.Throws<DomainException>(() => workflow.AddNode(node));
            Assert.Contains("already exists", exception.Message);
        }
        
        [Fact]
        public void CanExecute_WithNoNodes_ShouldReturnFalse()
        {
            // Arrange
            var workflow = Workflow.Create("Test", "Description");
            
            // Act
            var canExecute = workflow.CanExecute();
            
            // Assert
            Assert.False(canExecute);
        }
        
        [Theory]
        [InlineData(1)]
        [InlineData(5)]
        [InlineData(10)]
        public void CanExecute_WithValidNodes_ShouldReturnTrue(int nodeCount)
        {
            // Arrange
            var workflow = Workflow.Create("Test", "Description");
            for (int i = 0; i < nodeCount; i++)
            {
                workflow.AddNode(new AgentNode(NodeId.NewId(), $"Agent{i}"));
            }
            
            // Act
            var canExecute = workflow.CanExecute();
            
            // Assert
            Assert.True(canExecute);
        }
    }
}
```

#### Testing Value Objects

```csharp
public class WorkflowIdTests
{
    [Fact]
    public void NewId_ShouldCreateUniqueId()
    {
        // Act
        var id1 = WorkflowId.NewId();
        var id2 = WorkflowId.NewId();
        
        // Assert
        Assert.NotEqual(id1, id2);
    }
    
    [Fact]
    public void From_WithValidGuid_ShouldCreateWorkflowId()
    {
        // Arrange
        var guid = Guid.NewGuid();
        
        // Act
        var id = WorkflowId.From(guid);
        
        // Assert
        Assert.Equal(guid, id.Value);
    }
    
    [Fact]
    public void From_WithEmptyGuid_ShouldThrowArgumentException()
    {
        // Arrange
        var emptyGuid = Guid.Empty;
        
        // Act & Assert
        Assert.Throws<ArgumentException>(() => WorkflowId.From(emptyGuid));
    }
    
    [Fact]
    public void Equals_WithSameValue_ShouldReturnTrue()
    {
        // Arrange
        var guid = Guid.NewGuid();
        var id1 = WorkflowId.From(guid);
        var id2 = WorkflowId.From(guid);
        
        // Act & Assert
        Assert.Equal(id1, id2);
        Assert.True(id1 == id2);
        Assert.False(id1 != id2);
    }
    
    [Fact]
    public void Equals_WithDifferentValue_ShouldReturnFalse()
    {
        // Arrange
        var id1 = WorkflowId.NewId();
        var id2 = WorkflowId.NewId();
        
        // Act & Assert
        Assert.NotEqual(id1, id2);
        Assert.False(id1 == id2);
        Assert.True(id1 != id2);
    }
}
```

### Application Layer Testing

Application tests use **mocks for infrastructure dependencies** but real domain objects.

#### Testing Use Cases

```csharp
using Xunit;
using Moq;
using Maestro.Application.UseCases;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;

namespace Maestro.Application.Tests.UseCases
{
    public class ExecuteWorkflowUseCaseTests
    {
        private readonly Mock<IWorkflowRepository> _mockRepository;
        private readonly Mock<ILLMGateway> _mockLLMGateway;
        private readonly Mock<IExecutionMonitor> _mockMonitor;
        private readonly ExecuteWorkflowUseCase _useCase;
        
        public ExecuteWorkflowUseCaseTests()
        {
            _mockRepository = new Mock<IWorkflowRepository>();
            _mockLLMGateway = new Mock<ILLMGateway>();
            _mockMonitor = new Mock<IExecutionMonitor>();
            
            _useCase = new ExecuteWorkflowUseCase(
                _mockRepository.Object,
                _mockLLMGateway.Object,
                _mockMonitor.Object
            );
        }
        
        [Fact]
        public async Task Execute_WithValidWorkflow_ShouldReturnSuccess()
        {
            // Arrange
            var workflow = CreateValidWorkflow();
            var workflowId = workflow.Id;
            
            _mockRepository
                .Setup(r => r.GetByIdAsync(workflowId))
                .ReturnsAsync(workflow);
            
            // Act
            var result = await _useCase.ExecuteAsync(new ExecuteWorkflowRequest(workflowId));
            
            // Assert
            Assert.True(result.IsSuccess);
            Assert.NotNull(result.Workflow);
            _mockMonitor.Verify(m => m.StartExecution(workflowId), Times.Once);
        }
        
        [Fact]
        public async Task Execute_WithNonExistentWorkflow_ShouldReturnNotFound()
        {
            // Arrange
            var workflowId = WorkflowId.NewId();
            
            _mockRepository
                .Setup(r => r.GetByIdAsync(workflowId))
                .ReturnsAsync((Workflow)null);
            
            // Act
            var result = await _useCase.ExecuteAsync(new ExecuteWorkflowRequest(workflowId));
            
            // Assert
            Assert.False(result.IsSuccess);
            Assert.Contains("not found", result.Error);
        }
        
        [Fact]
        public async Task Execute_WithInvalidWorkflow_ShouldReturnInvalid()
        {
            // Arrange
            var workflow = Workflow.Create("Empty", "No nodes");
            
            _mockRepository
                .Setup(r => r.GetByIdAsync(workflow.Id))
                .ReturnsAsync(workflow);
            
            // Act
            var result = await _useCase.ExecuteAsync(new ExecuteWorkflowRequest(workflow.Id));
            
            // Assert
            Assert.False(result.IsSuccess);
            Assert.Contains("not ready", result.Error);
        }
        
        private Workflow CreateValidWorkflow()
        {
            var workflow = Workflow.Create("Test", "Description");
            workflow.AddNode(new AgentNode(NodeId.NewId(), "Planner"));
            return workflow;
        }
    }
}
```

#### Creating Test Mocks

```csharp
// Mocks/MockLLMGateway.cs
public class MockLLMGateway : ILLMGateway
{
    private readonly Queue<LLMResponse> _responses = new();
    
    public string ProviderName => "Mock";
    
    public void EnqueueResponse(LLMResponse response)
    {
        _responses.Enqueue(response);
    }
    
    public Task<LLMResponse> SendPromptAsync(LLMRequest request)
    {
        if (_responses.Count == 0)
            return Task.FromResult(new LLMResponse { Content = "Default response" });
        
        return Task.FromResult(_responses.Dequeue());
    }
    
    public Task<bool> IsAvailableAsync()
    {
        return Task.FromResult(true);
    }
}
```

### Infrastructure Layer Testing

Infrastructure tests should use **integration tests with real dependencies** when possible.

#### Testing LLM Gateway Adapter

```csharp
public class OpenAIAdapterTests : IDisposable
{
    private readonly OpenAIAdapter _adapter;
    private readonly IConfiguration _config;
    
    public OpenAIAdapterTests()
    {
        // Load test configuration
        _config = new ConfigurationBuilder()
            .AddJsonFile("appsettings.test.json")
            .Build();
        
        _adapter = new OpenAIAdapter(_config);
    }
    
    [Fact]
    [Trait("Category", "Integration")]
    public async Task SendPrompt_WithValidRequest_ShouldReturnResponse()
    {
        // Arrange
        var request = new LLMRequest
        {
            Model = "gpt-3.5-turbo",
            Messages = new List<Message>
            {
                new Message { Role = "user", Content = "Say hello" }
            }
        };
        
        // Act
        var response = await _adapter.SendPromptAsync(request);
        
        // Assert
        Assert.NotNull(response);
        Assert.NotEmpty(response.Content);
        Assert.True(response.TokensUsed > 0);
    }
    
    [Fact]
    public async Task IsAvailable_WithValidConfig_ShouldReturnTrue()
    {
        // Act
        var isAvailable = await _adapter.IsAvailableAsync();
        
        // Assert
        Assert.True(isAvailable);
    }
    
    public void Dispose()
    {
        // Cleanup if needed
    }
}
```

### API Integration Testing

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
    public async Task GetWorkflow_WithExistingId_ShouldReturn200()
    {
        // Arrange
        var workflowId = await CreateTestWorkflow();
        
        // Act
        var response = await _client.GetAsync($"/api/workflows/{workflowId}");
        
        // Assert
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        var workflow = JsonSerializer.Deserialize<WorkflowDto>(content);
        Assert.NotNull(workflow);
    }
    
    [Fact]
    public async Task ExecuteWorkflow_WithValidId_ShouldReturn200()
    {
        // Arrange
        var workflowId = await CreateTestWorkflow();
        
        // Act
        var response = await _client.PostAsync($"/api/workflows/{workflowId}/execute", null);
        
        // Assert
        response.EnsureSuccessStatusCode();
    }
    
    private async Task<string> CreateTestWorkflow()
    {
        var createRequest = new
        {
            name = "Test Workflow",
            description = "Integration test workflow"
        };
        
        var response = await _client.PostAsJsonAsync("/api/workflows", createRequest);
        response.EnsureSuccessStatusCode();
        
        var workflow = await response.Content.ReadFromJsonAsync<WorkflowDto>();
        return workflow.Id;
    }
}
```

---

## Frontend Testing (TypeScript/Jest/React Testing Library)

### Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── WorkflowEditor/
│   │   │   ├── WorkflowEditor.tsx
│   │   │   └── WorkflowEditor.test.tsx
│   │   └── Monitoring/
│   │       ├── ExecutionTimeline.tsx
│   │       └── ExecutionTimeline.test.tsx
│   ├── services/
│   │   ├── workflowService.ts
│   │   └── workflowService.test.ts
│   └── hooks/
│       ├── useWorkflow.ts
│       └── useWorkflow.test.ts
└── __tests__/
    └── integration/
        └── WorkflowEditor.integration.test.tsx
```

### Component Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowEditor } from './WorkflowEditor';
import { Workflow } from '../../types/workflow.types';

describe('WorkflowEditor', () => {
  const mockWorkflow: Workflow = {
    id: '123',
    name: 'Test Workflow',
    description: 'Test Description',
    nodes: [],
    connections: []
  };
  
  const mockOnSave = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should render workflow name', () => {
    // Arrange & Act
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} />);
    
    // Assert
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
  });
  
  it('should call onSave when save button is clicked', async () => {
    // Arrange
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} />);
    
    // Act
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    
    // Assert
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(mockWorkflow);
    });
  });
  
  it('should add node when add button is clicked', () => {
    // Arrange
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} />);
    
    // Act
    const addButton = screen.getByRole('button', { name: /add node/i });
    fireEvent.click(addButton);
    
    // Assert
    expect(screen.getByTestId('node-0')).toBeInTheDocument();
  });
  
  it('should display error message when save fails', async () => {
    // Arrange
    const errorMessage = 'Failed to save workflow';
    mockOnSave.mockRejectedValue(new Error(errorMessage));
    render(<WorkflowEditor workflow={mockWorkflow} onSave={mockOnSave} />);
    
    // Act
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
```

### Service Testing

```typescript
import { workflowService } from './workflowService';
import { apiClient } from './api';

jest.mock('./api');

describe('workflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getAll', () => {
    it('should fetch all workflows', async () => {
      // Arrange
      const mockWorkflows = [
        { id: '1', name: 'Workflow 1' },
        { id: '2', name: 'Workflow 2' }
      ];
      
      (apiClient.get as jest.Mock).mockResolvedValue(mockWorkflows);
      
      // Act
      const result = await workflowService.getAll();
      
      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/api/workflows');
      expect(result).toEqual(mockWorkflows);
    });
    
    it('should throw error when API call fails', async () => {
      // Arrange
      const errorMessage = 'Network error';
      (apiClient.get as jest.Mock).mockRejectedValue(new Error(errorMessage));
      
      // Act & Assert
      await expect(workflowService.getAll()).rejects.toThrow(errorMessage);
    });
  });
  
  describe('execute', () => {
    it('should execute workflow and return result', async () => {
      // Arrange
      const workflowId = '123';
      const mockResult = { success: true, executionId: 'exec-1' };
      
      (apiClient.post as jest.Mock).mockResolvedValue(mockResult);
      
      // Act
      const result = await workflowService.execute(workflowId);
      
      // Assert
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/workflows/${workflowId}/execute`,
        {}
      );
      expect(result).toEqual(mockResult);
    });
  });
});
```

### Custom Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflow } from './useWorkflow';
import { workflowService } from '../services/workflowService';

jest.mock('../services/workflowService');

describe('useWorkflow', () => {
  const mockWorkflow = {
    id: '123',
    name: 'Test Workflow',
    nodes: []
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should load workflow on mount', async () => {
    // Arrange
    (workflowService.getById as jest.Mock).mockResolvedValue(mockWorkflow);
    
    // Act
    const { result } = renderHook(() => useWorkflow('123'));
    
    // Assert
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.workflow).toEqual(mockWorkflow);
      expect(result.current.error).toBeNull();
    });
  });
  
  it('should set error when loading fails', async () => {
    // Arrange
    const errorMessage = 'Failed to load';
    (workflowService.getById as jest.Mock).mockRejectedValue(new Error(errorMessage));
    
    // Act
    const { result } = renderHook(() => useWorkflow('123'));
    
    // Assert
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.workflow).toBeNull();
      expect(result.current.error).toBe(errorMessage);
    });
  });
  
  it('should reload workflow when reload is called', async () => {
    // Arrange
    (workflowService.getById as jest.Mock).mockResolvedValue(mockWorkflow);
    const { result } = renderHook(() => useWorkflow('123'));
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    // Act
    result.current.reload();
    
    // Assert
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(workflowService.getById).toHaveBeenCalledTimes(2);
    });
  });
});
```

---

## Test Naming Conventions

### Backend (C#)
```csharp
[MethodUnderTest]_[Scenario]_[ExpectedBehavior]

// Examples:
AddNode_WithValidNode_ShouldAddNodeToCollection
Execute_WithNonExistentWorkflow_ShouldReturnNotFound
Create_WithEmptyName_ShouldThrowArgumentException
```

### Frontend (TypeScript)
```typescript
should [expected behavior] when [scenario]

// Examples:
'should render workflow name'
'should call onSave when save button is clicked'
'should display error message when save fails'
```

## Running Tests

### Backend
```bash
# Run all tests
dotnet test

# Run specific test project
dotnet test tests/Maestro.Domain.Tests

# Run with coverage
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov

# Run tests by category
dotnet test --filter "Category=Unit"
dotnet test --filter "Category=Integration"
```

### Frontend
```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- WorkflowEditor.test.tsx
```

## Continuous Integration

Tests should run automatically on:
- ✅ Every commit (pre-commit hook)
- ✅ Every pull request (CI pipeline)
- ✅ Before merge to main (required checks)

---

## Resources

- [xUnit Documentation](https://xunit.net/)
- [Moq Documentation](https://github.com/moq/moq4)
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Test-Driven Development by Kent Beck](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)
