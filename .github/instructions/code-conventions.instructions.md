---
description: "Code quality and naming conventions for B-One Maestro project"
applyTo: "**/*.cs, **/*.ts, **/*.tsx"
---

# Code Quality and Naming Conventions

## Universal Principles

### Code Quality Standards

1. **Readability First**: Code is read far more often than written
2. **Self-Documenting**: Names should explain intent without comments
3. **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
4. **DRY (Don't Repeat Yourself)**: Extract common logic into reusable components
5. **YAGNI (You Aren't Gonna Need It)**: Don't add functionality until needed
6. **KISS (Keep It Simple, Stupid)**: Prefer simple solutions over complex ones

### Documentation Requirements

- **XML Comments**: All public classes, methods, and properties (C#)
- **JSDoc**: All exported functions and components (TypeScript)
- **README**: Each major component/module should have a README
- **ADRs**: Architectural decisions must be documented in `/docs/adr/`

---

## Backend (.NET/C#) Conventions

### Namespace Convention

Follow project structure for namespaces:
```csharp
Maestro.Domain.Entities
Maestro.Domain.ValueObjects
Maestro.Application.UseCases.CreateWorkflow
Maestro.Infrastructure.LLMGateway
Maestro.Api.Controllers
```

### Naming Conventions

#### Classes and Interfaces
```csharp
// Classes: PascalCase, noun or noun phrase
public class WorkflowOrchestrator { }
public class ExecutionEngine { }

// Interfaces: I + PascalCase
public interface ILLMGateway { }
public interface IWorkflowRepository { }

// Abstract classes: PascalCase, often with "Base" suffix
public abstract class AgentBase { }
public abstract class NodeBase { }

// Exceptions: PascalCase + "Exception" suffix
public class WorkflowExecutionException : Exception { }
public class InvalidNodeConnectionException : DomainException { }
```

#### Methods
```csharp
// PascalCase, verb or verb phrase
public void ExecuteWorkflow() { }
public async Task<Workflow> GetWorkflowById(WorkflowId id) { }
public bool CanExecute() { }
public void AddNode(Node node) { }

// Boolean methods: Start with Is, Has, Can, Should
public bool IsValid() { }
public bool HasNodes() { }
public bool CanExecute() { }
public bool ShouldRetry() { }
```

#### Properties and Fields
```csharp
// Properties: PascalCase
public string Name { get; private set; }
public WorkflowId Id { get; }
public List<Node> Nodes { get; }

// Private fields: _camelCase with underscore
private readonly IWorkflowRepository _repository;
private readonly ILLMGateway _llmGateway;
private string _cachedResult;

// Constants: UPPER_SNAKE_CASE
private const int MAX_RETRY_ATTEMPTS = 3;
private const string DEFAULT_MODEL = "gpt-4";

// Static readonly: PascalCase
private static readonly TimeSpan DefaultTimeout = TimeSpan.FromMinutes(5);
```

#### Parameters and Local Variables
```csharp
// camelCase
public void CreateWorkflow(string workflowName, List<Node> nodes)
{
    var executionContext = new ExecutionContext();
    var isValid = ValidateNodes(nodes);
}
```

#### Async Methods
```csharp
// Always suffix with "Async"
public async Task<Workflow> GetWorkflowAsync(WorkflowId id) { }
public async Task ExecuteNodeAsync(Node node) { }
public async Task<bool> SaveWorkflowAsync(Workflow workflow) { }
```

### Entity and Value Object Patterns

#### Entity Pattern
```csharp
/// <summary>
/// Represents a workflow with multiple nodes and execution logic.
/// </summary>
public class Workflow
{
    // Identity
    public WorkflowId Id { get; private set; }
    
    // Properties with private setters
    public string Name { get; private set; }
    public string Description { get; private set; }
    public List<Node> Nodes { get; private set; }
    
    // Domain events (optional)
    private readonly List<IDomainEvent> _domainEvents = new();
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
    
    // Private constructor for EF Core
    private Workflow() { }
    
    // Public factory method
    public static Workflow Create(string name, string description)
    {
        return new Workflow
        {
            Id = WorkflowId.NewId(),
            Name = name,
            Description = description,
            Nodes = new List<Node>()
        };
    }
    
    // Business logic methods
    public void AddNode(Node node)
    {
        if (node == null)
            throw new ArgumentNullException(nameof(node));
            
        Nodes.Add(node);
        _domainEvents.Add(new NodeAddedEvent(Id, node.Id));
    }
    
    public bool CanExecute()
    {
        return Nodes.Any() && Nodes.All(n => n.IsValid());
    }
}
```

#### Value Object Pattern
```csharp
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
    public bool Equals(WorkflowId other)
    {
        if (other is null) return false;
        return Value == other.Value;
    }
    
    public override bool Equals(object obj) => Equals(obj as WorkflowId);
    public override int GetHashCode() => Value.GetHashCode();
    
    public override string ToString() => Value.ToString();
    
    public static bool operator ==(WorkflowId left, WorkflowId right)
        => left?.Equals(right) ?? right is null;
    
    public static bool operator !=(WorkflowId left, WorkflowId right)
        => !(left == right);
}
```

### Use Case Pattern
```csharp
/// <summary>
/// Use case for executing a workflow.
/// </summary>
public class ExecuteWorkflowUseCase
{
    private readonly IWorkflowRepository _repository;
    private readonly ILLMGateway _llmGateway;
    private readonly IExecutionMonitor _monitor;
    private readonly ILogger<ExecuteWorkflowUseCase> _logger;
    
    public ExecuteWorkflowUseCase(
        IWorkflowRepository repository,
        ILLMGateway llmGateway,
        IExecutionMonitor monitor,
        ILogger<ExecuteWorkflowUseCase> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _llmGateway = llmGateway ?? throw new ArgumentNullException(nameof(llmGateway));
        _monitor = monitor ?? throw new ArgumentNullException(nameof(monitor));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<ExecutionResult> ExecuteAsync(ExecuteWorkflowRequest request)
    {
        try
        {
            _logger.LogInformation("Executing workflow {WorkflowId}", request.WorkflowId);
            
            var workflow = await _repository.GetByIdAsync(request.WorkflowId);
            
            if (workflow == null)
                return ExecutionResult.NotFound($"Workflow {request.WorkflowId} not found");
            
            if (!workflow.CanExecute())
                return ExecutionResult.Invalid("Workflow is not ready for execution");
            
            // Execution logic...
            
            return ExecutionResult.Success(workflow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute workflow {WorkflowId}", request.WorkflowId);
            return ExecutionResult.Failed(ex.Message);
        }
    }
}
```

### Result Pattern (instead of exceptions for expected failures)
```csharp
/// <summary>
/// Represents the result of a workflow execution.
/// </summary>
public class ExecutionResult
{
    public bool IsSuccess { get; }
    public string Error { get; }
    public Workflow Workflow { get; }
    
    private ExecutionResult(bool isSuccess, Workflow workflow, string error)
    {
        IsSuccess = isSuccess;
        Workflow = workflow;
        Error = error;
    }
    
    public static ExecutionResult Success(Workflow workflow)
        => new(true, workflow, null);
    
    public static ExecutionResult Failed(string error)
        => new(false, null, error);
    
    public static ExecutionResult NotFound(string error)
        => new(false, null, error);
    
    public static ExecutionResult Invalid(string error)
        => new(false, null, error);
}
```

### Exception Handling

```csharp
// Domain exceptions for business rule violations
public class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
}

// Specific domain exceptions
public class InvalidWorkflowException : DomainException
{
    public InvalidWorkflowException(string message) : base(message) { }
}

// Usage in domain
public void AddNode(Node node)
{
    if (node == null)
        throw new ArgumentNullException(nameof(node));
    
    if (Nodes.Any(n => n.Id == node.Id))
        throw new DomainException($"Node {node.Id} already exists in workflow");
    
    Nodes.Add(node);
}
```

### Dependency Injection

```csharp
// Program.cs - Service registration
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();
builder.Services.AddScoped<ILLMGateway, LLMGatewayFactory>();
builder.Services.AddScoped<ExecuteWorkflowUseCase>();
builder.Services.AddSingleton<IExecutionMonitor, ExecutionMonitor>();

// Configuration-based registration
builder.Services.Configure<LLMGatewayOptions>(
    builder.Configuration.GetSection("LLM"));
```

---

## Frontend (TypeScript/React) Conventions

### File and Folder Naming

```
src/
├── components/
│   ├── WorkflowEditor/
│   │   ├── WorkflowEditor.tsx       # Component
│   │   ├── WorkflowEditor.test.tsx  # Tests
│   │   ├── WorkflowEditor.module.css # Styles
│   │   └── index.ts                 # Barrel export
│   └── Monitoring/
│       ├── ExecutionTimeline.tsx
│       └── TerminalOutput.tsx
├── services/
│   ├── api.ts                       # API client
│   ├── workflowService.ts           # Workflow operations
│   └── signalrService.ts            # Real-time updates
├── types/
│   ├── workflow.types.ts            # Workflow types
│   └── node.types.ts                # Node types
├── hooks/
│   ├── useWorkflow.ts               # Workflow hook
│   └── useExecution.ts              # Execution hook
└── utils/
    ├── validators.ts                # Validation utilities
    └── formatters.ts                # Formatting utilities
```

### TypeScript Naming Conventions

#### Interfaces and Types
```typescript
// Interfaces: PascalCase with "I" prefix (optional, use sparingly)
interface IWorkflowService {
  getWorkflow(id: string): Promise<Workflow>;
}

// Types: PascalCase
type WorkflowNode = {
  id: string;
  type: NodeType;
  config: NodeConfig;
};

// Enums: PascalCase
enum NodeType {
  Agent = 'agent',
  Tool = 'tool',
  Decision = 'decision'
}

// Type aliases: PascalCase
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';
```

#### Functions and Variables
```typescript
// Functions: camelCase, verb or verb phrase
function executeWorkflow(id: string): Promise<void> { }
function getWorkflowById(id: string): Workflow | null { }
const isValidNode = (node: Node): boolean => { };

// Variables: camelCase
const workflowName = 'My Workflow';
const nodeList: Node[] = [];
let executionStatus: ExecutionStatus = 'pending';

// Constants: UPPER_SNAKE_CASE
const MAX_NODES = 100;
const DEFAULT_TIMEOUT = 5000;
const API_BASE_URL = 'http://localhost:5000';
```

#### React Components
```typescript
// Component names: PascalCase
export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, onSave }) => {
  // Hooks at the top
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Event handlers: handle + PascalCase action
  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
  };
  
  const handleSaveWorkflow = async () => {
    await onSave(workflow);
  };
  
  return (
    <div className="workflow-editor">
      {/* JSX */}
    </div>
  );
};

// Props interface: ComponentName + "Props"
interface WorkflowEditorProps {
  workflow: Workflow;
  onSave: (workflow: Workflow) => Promise<void>;
  readOnly?: boolean;
}
```

#### Custom Hooks
```typescript
// Hook names: use + PascalCase
export function useWorkflow(workflowId: string) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadWorkflow();
  }, [workflowId]);
  
  const loadWorkflow = async () => {
    try {
      setLoading(true);
      const data = await workflowService.getById(workflowId);
      setWorkflow(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { workflow, loading, error, reload: loadWorkflow };
}
```

### API Service Pattern
```typescript
// api.ts - Base API client
import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  
  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }
  
  async post<T>(url: string, data: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }
}

export const apiClient = new ApiClient(process.env.VITE_API_URL!);

// workflowService.ts - Specific service
export const workflowService = {
  async getAll(): Promise<Workflow[]> {
    return apiClient.get<Workflow[]>('/api/workflows');
  },
  
  async getById(id: string): Promise<Workflow> {
    return apiClient.get<Workflow>(`/api/workflows/${id}`);
  },
  
  async execute(id: string): Promise<ExecutionResult> {
    return apiClient.post<ExecutionResult>(`/api/workflows/${id}/execute`, {});
  },
};
```

---

## Code Review Checklist

### Backend (.NET)
- [ ] Follows Clean Architecture layer boundaries
- [ ] No direct LLM SDK imports in Application/Domain
- [ ] Public members have XML documentation
- [ ] Async methods end with "Async"
- [ ] Interfaces defined in correct layer
- [ ] Use Result pattern for expected failures
- [ ] Proper exception handling
- [ ] Unit tests for domain logic
- [ ] Integration tests for infrastructure

### Frontend (TypeScript)
- [ ] Component names are PascalCase
- [ ] Props interface defined for each component
- [ ] Event handlers prefixed with "handle"
- [ ] Custom hooks prefixed with "use"
- [ ] Types/interfaces properly defined
- [ ] No `any` types (use `unknown` if needed)
- [ ] JSDoc for exported functions
- [ ] Proper error handling
- [ ] Loading and error states managed

### Universal
- [ ] Code is self-documenting
- [ ] No magic numbers (use constants)
- [ ] No commented-out code
- [ ] Consistent formatting (use Prettier/EditorConfig)
- [ ] SOLID principles followed
- [ ] DRY - no duplicate logic
- [ ] YAGNI - no unnecessary features

---

## Common Anti-Patterns to Avoid

### ❌ God Objects
```csharp
// WRONG - Too many responsibilities
public class WorkflowManager
{
    public void CreateWorkflow() { }
    public void ExecuteWorkflow() { }
    public void SaveToDatabase() { }
    public void SendEmail() { }
    public void GenerateReport() { }
    public void ValidateNodes() { }
}
```

### ❌ Primitive Obsession
```csharp
// WRONG - Using primitives instead of value objects
public class Workflow
{
    public Guid Id { get; set; }  // Should be WorkflowId
    public string Status { get; set; }  // Should be WorkflowStatus enum
}
```

### ❌ Anemic Domain Model
```csharp
// WRONG - No business logic, just getters/setters
public class Workflow
{
    public WorkflowId Id { get; set; }
    public string Name { get; set; }
    public List<Node> Nodes { get; set; }
}

// Business logic scattered in services instead of domain
```

### ❌ Feature Envy
```csharp
// WRONG - Method accessing another object's data too much
public void ValidateWorkflow(Workflow workflow)
{
    if (workflow.Nodes.Count == 0) { }
    if (workflow.Nodes.Any(n => n.Type == null)) { }
    if (workflow.Nodes.All(n => n.Connections.Count == 0)) { }
    // This should be in Workflow class!
}
```

---

## Formatting and Style

### EditorConfig (.editorconfig)
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.cs]
indent_style = space
indent_size = 4

[*.{ts,tsx,js,jsx}]
indent_style = space
indent_size = 2

[*.{json,yml,yaml}]
indent_style = space
indent_size = 2
```

### Line Length
- **C#**: Max 120 characters
- **TypeScript**: Max 100 characters
- Break long lines at logical points

### Braces
```csharp
// C# - Always use braces, even for single-line
if (condition)
{
    DoSomething();
}

// TypeScript - Braces for multi-line
if (condition) {
  doSomething();
}
```

---

## ROADMAP Task Completion

When completing tasks from `ROADMAP.md`, agents MUST update the file to reflect progress:

### Rules

1. **Mark completed tasks**: Change `- [ ]` to `- [x]` for completed items
2. **Update progress bars**: Adjust the visual progress indicator (e.g., `[██████░░░░] 60%`)
3. **Update timestamps**: Modify `Last Updated` date at the top of ROADMAP
4. **Reference the task**: Use the section/task number in commit messages (e.g., `feat(ui): implement block grid [4f.2]`)

### Example

Before:
```markdown
- [ ] Create `FoundryPage.tsx` with layout structure
- [ ] Create `FoundrySidebar.tsx` with category filters
```

After completing `FoundryPage.tsx`:
```markdown
- [x] Create `FoundryPage.tsx` with layout structure
- [ ] Create `FoundrySidebar.tsx` with category filters
```

### Progress Bar Calculation

| Completion | Bar |
|------------|-----|
| 0% | `[░░░░░░░░░░]  0%` |
| 10% | `[█░░░░░░░░░] 10%` |
| 50% | `[█████░░░░░] 50%` |
| 100% | `[██████████] 100%` |

### Task Completion Prompt

For standardized task completion, use `.github/prompts/complete-task.prompt.md`.

---

## Resources

- [C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Refactoring by Martin Fowler](https://refactoring.com/)
- [Git Workflow Conventions](./git-workflow.instructions.md) - Branch naming and commit message conventions

