# Contributing to B-One Maestro

Thank you for your interest in contributing to B-One Maestro! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Architectural Guidelines](#architectural-guidelines)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Areas for Contribution](#areas-for-contribution)

---

## 🤝 Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow:

- **Be respectful**: Treat everyone with respect and professionalism
- **Be collaborative**: Work together and help each other
- **Be patient**: Remember that everyone has different skill levels
- **Be constructive**: Provide helpful feedback and suggestions

---

## 🚀 Getting Started

### Prerequisites

**Backend**:
- .NET 8 SDK or later
- Git
- A code editor (Visual Studio, VS Code, Rider)

**Frontend**:
- Node.js 18+ and npm/yarn/pnpm
- Git
- A code editor (VS Code recommended)

### Setting Up the Development Environment

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Meastro.git
   cd Meastro
   ```

2. **Set up the backend**:
   ```bash
   cd backend
   dotnet restore
   dotnet build
   dotnet test
   ```

3. **Set up the frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Configure environment variables**:
   - Copy `backend/src/Maestro.Api/appsettings.Development.json.example` to `appsettings.Development.json`
   - Copy `frontend/.env.example` to `frontend/.env`
   - Add any required API keys or configuration

---

## 🔄 Development Workflow

### Branching Strategy

We use the following branch naming conventions:

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions or improvements

### Workflow Steps

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the guidelines in this document

3. **Write tests** for your changes

4. **Run tests** to ensure nothing is broken:
   ```bash
   # Backend
   cd backend
   dotnet test
   
   # Frontend
   cd frontend
   npm run test
   ```

5. **Commit your changes** using Conventional Commits:
   ```bash
   git commit -m "feat: add workflow execution engine"
   git commit -m "fix: resolve null reference in agent executor"
   git commit -m "docs: update architecture documentation"
   ```

6. **Push to your fork** and create a Pull Request

---

## 🏗️ Architectural Guidelines

### Critical Rules (Must Follow)

#### 1. **Respect Layer Boundaries**

**Backend**:
- Domain layer has **no dependencies** (not even System.Text.Json for serialization)
- Application layer depends **only on Domain**
- Infrastructure implements interfaces from Application
- Presentation (API) depends on Application and Infrastructure for DI

**Example** (WRONG ❌):
```csharp
// Domain/Entities/Workflow.cs
using Microsoft.EntityFrameworkCore; // ❌ External dependency in Domain

public class Workflow
{
    [Key] // ❌ EF Core attribute in Domain
    public Guid Id { get; set; }
}
```

**Example** (CORRECT ✅):
```csharp
// Domain/Entities/Workflow.cs
public class Workflow
{
    public WorkflowId Id { get; private set; } // ✅ Value object, no dependencies
    
    private Workflow() { } // ✅ Private constructor for domain logic
    
    public static Workflow Create(string name) // ✅ Factory method
    {
        // Domain validation
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Workflow name is required");
            
        return new Workflow { Id = WorkflowId.New(), Name = name };
    }
}
```

#### 2. **Dependency Inversion**

Always depend on abstractions, not concrete implementations.

**Example** (WRONG ❌):
```csharp
// Application/Services/WorkflowOrchestrator.cs
public class WorkflowOrchestrator
{
    private readonly OpenAIAdapter _openAI; // ❌ Concrete dependency
    
    public WorkflowOrchestrator(OpenAIAdapter openAI)
    {
        _openAI = openAI;
    }
}
```

**Example** (CORRECT ✅):
```csharp
// Application/Services/WorkflowOrchestrator.cs
public class WorkflowOrchestrator
{
    private readonly ILLMGateway _llmGateway; // ✅ Abstraction
    
    public WorkflowOrchestrator(ILLMGateway llmGateway)
    {
        _llmGateway = llmGateway;
    }
}
```

#### 3. **No Model Hardcoding**

Never import AI model SDKs directly in Agent code.

**Example** (WRONG ❌):
```csharp
// Agents/Coder/CoderAgent.cs
using OpenAI; // ❌ Direct model dependency

public class CoderAgent : IAgent
{
    private readonly OpenAIClient _client; // ❌
}
```

**Example** (CORRECT ✅):
```csharp
// Agents/Coder/CoderAgent.cs
public class CoderAgent : IAgent
{
    private readonly ILLMGateway _llmGateway; // ✅ Via abstraction
    
    public async Task<AgentOutput> ExecuteAsync(AgentInput input)
    {
        var response = await _llmGateway.SendAsync(new LLMRequest
        {
            Prompt = BuildPrompt(input),
            Tools = input.Tools
        });
        
        return ParseResponse(response);
    }
}
```

#### 4. **No Business Logic in Frontend**

The frontend is **purely presentational**.

**Example** (WRONG ❌):
```typescript
// components/WorkflowEditor/WorkflowEditor.tsx
export const WorkflowEditor = () => {
  const validateWorkflow = (workflow: Workflow) => {
    // ❌ Business logic in frontend
    if (workflow.nodes.length === 0) return false;
    // Check for cycles, validate connections, etc.
  };
};
```

**Example** (CORRECT ✅):
```typescript
// components/WorkflowEditor/WorkflowEditor.tsx
export const WorkflowEditor = () => {
  const { validateWorkflow } = useWorkflowService(); // ✅ Call backend API
  
  const handleSave = async () => {
    const result = await validateWorkflow(workflow); // ✅ Backend validates
    if (result.isValid) {
      await saveWorkflow(workflow);
    }
  };
};
```

#### 5. **Single Responsibility**

Each class/module should have one reason to change.

**Example** (WRONG ❌):
```csharp
public class WorkflowService
{
    public void CreateWorkflow() { }
    public void ExecuteWorkflow() { }
    public void ValidateWorkflow() { }
    public void SaveWorkflowToFile() { }
    public void SendEmail() { } // ❌ Too many responsibilities
}
```

**Example** (CORRECT ✅):
```csharp
public class CreateWorkflowCommandHandler { } // ✅ One responsibility
public class ExecuteWorkflowCommandHandler { } // ✅ One responsibility
public class WorkflowValidator { } // ✅ One responsibility
public class WorkflowRepository { } // ✅ One responsibility
```

---

## 📝 Code Standards

### Backend (C#)

#### Naming Conventions
- **Classes/Interfaces**: PascalCase (`WorkflowOrchestrator`, `ILLMGateway`)
- **Methods**: PascalCase (`ExecuteAsync`, `Validate`)
- **Properties**: PascalCase (`WorkflowId`, `NodeStatus`)
- **Private fields**: _camelCase with underscore (`_llmGateway`, `_logger`)
- **Local variables**: camelCase (`workflowId`, `nodeName`)

#### Code Style
- **Async suffix**: All async methods end with `Async`
- **Interface prefix**: All interfaces start with `I`
- **Null safety**: Use nullable reference types (`string?`)
- **XML comments**: Required for all public APIs

**Example**:
```csharp
/// <summary>
/// Executes a workflow asynchronously.
/// </summary>
/// <param name="workflowId">The unique identifier of the workflow.</param>
/// <param name="cancellationToken">Cancellation token.</param>
/// <returns>The execution result.</returns>
public async Task<ExecutionResult> ExecuteWorkflowAsync(
    WorkflowId workflowId,
    CancellationToken cancellationToken = default)
{
    var workflow = await _repository.GetByIdAsync(workflowId, cancellationToken);
    
    if (workflow is null)
        throw new WorkflowNotFoundException(workflowId);
    
    return await _executor.ExecuteAsync(workflow, cancellationToken);
}
```

### Frontend (TypeScript)

#### Naming Conventions
- **Components**: PascalCase (`WorkflowEditor`, `NodePalette`)
- **Functions/Variables**: camelCase (`executeWorkflow`, `nodeId`)
- **Types/Interfaces**: PascalCase (`Workflow`, `NodeConfig`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_NODES`, `API_BASE_URL`)

#### Code Style
- **Strict mode**: Always use TypeScript strict mode
- **JSDoc comments**: Required for complex functions
- **Functional components**: Use function declarations, not arrow functions
- **Hooks**: Custom hooks start with `use` prefix

**Example**:
```typescript
/**
 * Hook for managing workflow state and operations.
 */
export function useWorkflow(workflowId: string) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadWorkflow(workflowId);
  }, [workflowId]);
  
  const loadWorkflow = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await workflowService.getWorkflow(id);
      setWorkflow(data);
    } finally {
      setIsLoading(false);
    }
  };
  
  return { workflow, isLoading, reload: () => loadWorkflow(workflowId) };
}
```

---

## 🧪 Testing Requirements

### Backend Testing

**Minimum coverage**: 80% for Domain and Application layers

**Test structure**:
```csharp
public class CreateWorkflowCommandHandlerTests
{
    private readonly Mock<IWorkflowRepository> _repositoryMock;
    private readonly CreateWorkflowCommandHandler _handler;
    
    public CreateWorkflowCommandHandlerTests()
    {
        _repositoryMock = new Mock<IWorkflowRepository>();
        _handler = new CreateWorkflowCommandHandler(_repositoryMock.Object);
    }
    
    [Fact]
    public async Task Handle_ValidCommand_CreatesWorkflow()
    {
        // Arrange
        var command = new CreateWorkflowCommand { Name = "Test Workflow" };
        
        // Act
        var result = await _handler.Handle(command, CancellationToken.None);
        
        // Assert
        result.Should().NotBeNull();
        _repositoryMock.Verify(x => x.AddAsync(It.IsAny<Workflow>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

### Frontend Testing

**Minimum coverage**: 70% overall

**Test structure**:
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowEditor } from './WorkflowEditor';

describe('WorkflowEditor', () => {
  it('should render workflow nodes', async () => {
    const workflow = createMockWorkflow();
    
    render(<WorkflowEditor workflow={workflow} />);
    
    await waitFor(() => {
      expect(screen.getByText('Planner Node')).toBeInTheDocument();
    });
  });
  
  it('should add node on drag and drop', async () => {
    const user = userEvent.setup();
    const onNodeAdd = jest.fn();
    
    render(<WorkflowEditor onNodeAdd={onNodeAdd} />);
    
    // Simulate drag and drop
    await user.drag(screen.getByText('Agent Node'), screen.getByRole('canvas'));
    
    expect(onNodeAdd).toHaveBeenCalled();
  });
});
```

---

## 🔍 Pull Request Process

### Before Submitting

- [ ] All tests pass (`dotnet test`, `npm run test`)
- [ ] Code follows style guidelines (run linters)
- [ ] New code has tests (80%+ coverage for backend)
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow Conventional Commits
- [ ] No merge conflicts with `main`

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issue
Closes #123

## Testing
Describe how you tested this change.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] My code follows the architectural guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] All tests pass locally
```

### Review Process

1. **Automated checks**: CI/CD runs tests and linters
2. **Code review**: At least one maintainer reviews the code
3. **Changes requested**: Address feedback and push updates
4. **Approval**: Once approved, maintainers merge the PR

---

## 🎯 Areas for Contribution

We especially welcome contributions in these areas:

### High Priority
- **Domain modeling**: Workflow, Node, Agent entities
- **LLM Gateway**: Adapters for different model providers
- **Workflow editor UI**: React Flow implementation
- **Execution engine**: Core orchestration logic
- **Tool executors**: Bash, Git, file system tools

### Medium Priority
- **Agent implementations**: Planner, Coder, Tester agents
- **Workflow validation**: Business rules and constraints
- **SignalR integration**: Real-time execution updates
- **API documentation**: OpenAPI/Swagger specs
- **Example workflows**: Sample JSON workflows

### Documentation
- **Architecture Decision Records**: Document key decisions
- **API documentation**: REST endpoints
- **Tutorials**: How to create custom agents/tools
- **Workflow guides**: Best practices for workflow design

---

## 📚 Additional Resources

- [Main README](../README.md) - Project overview
- [Project Structure](./docs/PROJECT_STRUCTURE.md) - Folder organization
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## ❓ Questions?

If you have questions:
- Check existing [Issues](https://github.com/arthurolivierfortin/Meastro/issues)
- Open a new [Discussion](https://github.com/arthurolivierfortin/Meastro/discussions)
- Ask in the PR review

---

Thank you for contributing to B-One Maestro! 🎉
