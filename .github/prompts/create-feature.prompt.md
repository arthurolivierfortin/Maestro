---
mode: 'agent'
description: 'Create new features for B-One Maestro following Clean Architecture and SOLID principles'
---

# Create New Feature for Maestro

Generate a new feature implementation for B-One Maestro, following Clean Architecture principles and ensuring proper layer separation.

## MANDATORY PRE-EXECUTION STEPS

**Before starting ANY work, you MUST:**

1. **Read instruction files:**
   - `.github/instructions/clean-architecture.instructions.md` - Architecture rules
   - `.github/instructions/code-conventions.instructions.md` - Coding standards
   - `.github/instructions/testing.instructions.md` - Testing requirements

2. **Understand the project structure:**
   ```
   Maestro/
   ├── backend/
   │   ├── src/
   │   │   ├── Maestro.Domain/          # Entities, Value Objects, Interfaces
   │   │   ├── Maestro.Application/     # Use Cases, DTOs, App Interfaces
   │   │   ├── Maestro.Infrastructure/  # Implementations, LLM adapters
   │   │   ├── Maestro.Api/             # Controllers, SignalR Hubs
   │   │   └── Maestro.Agents/          # Specialized agents
   │   └── tests/
   │       ├── Maestro.Domain.Tests/
   │       ├── Maestro.Application.Tests/
   │       └── Maestro.Infrastructure.Tests/
   └── frontend/
       └── src/
           ├── components/
           ├── services/
           ├── hooks/
           └── types/
   ```

3. **Review existing code:**
   - Check similar features to maintain consistency
   - Review existing entities and value objects
   - Understand current patterns and conventions

## Parameters:
- **featureType**: Type of feature (`agent`, `node`, `workflow-engine`, `api`, `ui`, `integration`)
- **featureName**: Name of the feature (e.g., "Planner Agent", "Git Integration", "Execution Monitor")
- **description**: Detailed description of what the feature should do
- **includeTests**: Set to `true` to generate comprehensive tests (recommended: always true)
- **createADR**: Set to `true` to create an Architecture Decision Record if architectural decision is needed

## Feature Implementation Checklist

### Phase 1: Domain Layer (if applicable)

#### Step 1: Define Domain Entities
- [ ] Create entity class in `Maestro.Domain/Entities/`
- [ ] Ensure entity has private setters
- [ ] Add factory methods instead of public constructors
- [ ] Implement business logic methods
- [ ] Add domain events if needed
- [ ] Create entity unit tests

**Example Structure:**
```csharp
// Maestro.Domain/Entities/Agent.cs
namespace Maestro.Domain.Entities
{
    public class Agent
    {
        public AgentId Id { get; private set; }
        public string Name { get; private set; }
        public AgentType Type { get; private set; }
        public List<Tool> AssignedTools { get; private set; }
        
        private Agent() { } // EF Core
        
        public static Agent Create(string name, AgentType type)
        {
            return new Agent
            {
                Id = AgentId.NewId(),
                Name = name,
                Type = type,
                AssignedTools = new List<Tool>()
            };
        }
        
        public void AssignTool(Tool tool)
        {
            if (tool == null)
                throw new ArgumentNullException(nameof(tool));
            
            if (AssignedTools.Any(t => t.Id == tool.Id))
                throw new DomainException($"Tool {tool.Name} already assigned");
            
            AssignedTools.Add(tool);
        }
    }
}
```

#### Step 2: Create Value Objects
- [ ] Create value object in `Maestro.Domain/ValueObjects/`
- [ ] Implement `IEquatable<T>`
- [ ] Override `Equals`, `GetHashCode`, `ToString`
- [ ] Add equality operators
- [ ] Validate in constructor
- [ ] Create value object unit tests

**Example Structure:**
```csharp
// Maestro.Domain/ValueObjects/AgentId.cs
namespace Maestro.Domain.ValueObjects
{
    public class AgentId : IEquatable<AgentId>
    {
        public Guid Value { get; }
        
        private AgentId(Guid value)
        {
            if (value == Guid.Empty)
                throw new ArgumentException("Agent ID cannot be empty");
            Value = value;
        }
        
        public static AgentId NewId() => new(Guid.NewGuid());
        public static AgentId From(Guid value) => new(value);
        
        public bool Equals(AgentId other) => other != null && Value == other.Value;
        public override bool Equals(object obj) => Equals(obj as AgentId);
        public override int GetHashCode() => Value.GetHashCode();
        public override string ToString() => Value.ToString();
    }
}
```

#### Step 3: Define Domain Interfaces
- [ ] Create interfaces in `Maestro.Domain/Interfaces/`
- [ ] Define repository interfaces for persistence
- [ ] Define service interfaces for domain logic
- [ ] NO implementation in Domain layer

**Example:**
```csharp
// Maestro.Domain/Interfaces/IAgentRepository.cs
namespace Maestro.Domain.Interfaces
{
    public interface IAgentRepository
    {
        Task<Agent> GetByIdAsync(AgentId id);
        Task<IEnumerable<Agent>> GetAllAsync();
        Task<Agent> AddAsync(Agent agent);
        Task UpdateAsync(Agent agent);
        Task DeleteAsync(AgentId id);
    }
}
```

### Phase 2: Application Layer

#### Step 4: Create Use Cases
- [ ] Create use case folder in `Maestro.Application/UseCases/[FeatureName]/`
- [ ] Implement use case class with clear responsibility
- [ ] Define request and response DTOs
- [ ] Add validation logic
- [ ] Use domain entities, not infrastructure
- [ ] Create use case unit tests with mocks

**Example Structure:**
```csharp
// Maestro.Application/UseCases/CreateAgent/CreateAgentUseCase.cs
namespace Maestro.Application.UseCases.CreateAgent
{
    public class CreateAgentUseCase
    {
        private readonly IAgentRepository _repository;
        private readonly ILogger<CreateAgentUseCase> _logger;
        
        public CreateAgentUseCase(
            IAgentRepository repository,
            ILogger<CreateAgentUseCase> logger)
        {
            _repository = repository;
            _logger = logger;
        }
        
        public async Task<CreateAgentResponse> ExecuteAsync(CreateAgentRequest request)
        {
            _logger.LogInformation("Creating agent {Name}", request.Name);
            
            // Validation
            if (string.IsNullOrWhiteSpace(request.Name))
                return CreateAgentResponse.Invalid("Agent name is required");
            
            // Business logic
            var agent = Agent.Create(request.Name, request.Type);
            
            // Persistence
            var created = await _repository.AddAsync(agent);
            
            return CreateAgentResponse.Success(AgentDto.FromDomain(created));
        }
    }
}
```

#### Step 5: Define DTOs
- [ ] Create DTOs in `Maestro.Application/DTOs/`
- [ ] DTOs should be simple data containers
- [ ] Add mapping methods to/from domain entities
- [ ] Use records for immutability

**Example:**
```csharp
// Maestro.Application/DTOs/AgentDto.cs
namespace Maestro.Application.DTOs
{
    public record AgentDto(
        string Id,
        string Name,
        string Type,
        List<ToolDto> AssignedTools
    )
    {
        public static AgentDto FromDomain(Agent agent)
        {
            return new AgentDto(
                agent.Id.ToString(),
                agent.Name,
                agent.Type.ToString(),
                agent.AssignedTools.Select(ToolDto.FromDomain).ToList()
            );
        }
    }
}
```

#### Step 6: Define Application Interfaces (for Infrastructure)
- [ ] Create interfaces in `Maestro.Application/Interfaces/`
- [ ] Define contracts for external services
- [ ] NO implementation here (belongs in Infrastructure)

**Example:**
```csharp
// Maestro.Application/Interfaces/IAgentCoordinator.cs
namespace Maestro.Application.Interfaces
{
    public interface IAgentCoordinator
    {
        Task<AgentExecutionResult> ExecuteAgentAsync(AgentId agentId, AgentContext context);
        Task<bool> IsAgentAvailableAsync(AgentId agentId);
    }
}
```

### Phase 3: Infrastructure Layer

#### Step 7: Implement Repositories
- [ ] Create repository implementation in `Maestro.Infrastructure/Persistence/`
- [ ] Implement interface from Domain
- [ ] Use proper data access pattern (EF Core, Dapper, JSON files)
- [ ] Create integration tests

**Example:**
```csharp
// Maestro.Infrastructure/Persistence/JsonAgentRepository.cs
namespace Maestro.Infrastructure.Persistence
{
    public class JsonAgentRepository : IAgentRepository
    {
        private readonly string _filePath;
        private readonly ILogger<JsonAgentRepository> _logger;
        
        public JsonAgentRepository(
            IConfiguration config,
            ILogger<JsonAgentRepository> logger)
        {
            _filePath = config["Storage:AgentsPath"];
            _logger = logger;
        }
        
        public async Task<Agent> GetByIdAsync(AgentId id)
        {
            var agents = await LoadAgentsAsync();
            return agents.FirstOrDefault(a => a.Id == id);
        }
        
        // Other implementations...
    }
}
```

#### Step 8: Implement External Service Adapters
- [ ] Create adapter in appropriate Infrastructure subfolder
- [ ] Implement interface from Application layer
- [ ] Handle external service communication
- [ ] Add proper error handling
- [ ] Create integration tests

**Example:**
```csharp
// Maestro.Infrastructure/LLMGateway/OpenAIAgentAdapter.cs
namespace Maestro.Infrastructure.LLMGateway
{
    public class OpenAIAgentAdapter : IAgentCoordinator
    {
        private readonly ILLMGateway _gateway;
        private readonly ILogger<OpenAIAgentAdapter> _logger;
        
        public OpenAIAgentAdapter(
            ILLMGateway gateway,
            ILogger<OpenAIAgentAdapter> logger)
        {
            _gateway = gateway;
            _logger = logger;
        }
        
        public async Task<AgentExecutionResult> ExecuteAgentAsync(
            AgentId agentId, 
            AgentContext context)
        {
            // Implementation using LLM Gateway abstraction
        }
    }
}
```

### Phase 4: Presentation Layer (API)

#### Step 9: Create API Controllers
- [ ] Create controller in `Maestro.Api/Controllers/`
- [ ] Inject use cases via dependency injection
- [ ] Map DTOs to/from HTTP requests/responses
- [ ] Add proper HTTP status codes
- [ ] Add XML documentation comments
- [ ] Create API integration tests

**Example:**
```csharp
// Maestro.Api/Controllers/AgentsController.cs
namespace Maestro.Api.Controllers
{
    /// <summary>
    /// Manages AI agents for workflow execution
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AgentsController : ControllerBase
    {
        private readonly CreateAgentUseCase _createAgent;
        private readonly GetAgentUseCase _getAgent;
        private readonly ILogger<AgentsController> _logger;
        
        public AgentsController(
            CreateAgentUseCase createAgent,
            GetAgentUseCase getAgent,
            ILogger<AgentsController> logger)
        {
            _createAgent = createAgent;
            _getAgent = getAgent;
            _logger = logger;
        }
        
        /// <summary>
        /// Creates a new agent
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(AgentDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Create([FromBody] CreateAgentRequest request)
        {
            var result = await _createAgent.ExecuteAsync(request);
            
            if (!result.IsSuccess)
                return BadRequest(result.Error);
            
            return CreatedAtAction(
                nameof(GetById), 
                new { id = result.Agent.Id }, 
                result.Agent
            );
        }
        
        /// <summary>
        /// Retrieves an agent by ID
        /// </summary>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(AgentDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetById(string id)
        {
            var result = await _getAgent.ExecuteAsync(new GetAgentRequest(id));
            
            if (!result.IsSuccess)
                return NotFound(result.Error);
            
            return Ok(result.Agent);
        }
    }
}
```

#### Step 10: Register Dependencies
- [ ] Register services in `Program.cs` or `Startup.cs`
- [ ] Register with appropriate lifetime (Scoped, Singleton, Transient)
- [ ] Configure options if needed

**Example:**
```csharp
// Maestro.Api/Program.cs
builder.Services.AddScoped<IAgentRepository, JsonAgentRepository>();
builder.Services.AddScoped<IAgentCoordinator, OpenAIAgentAdapter>();
builder.Services.AddScoped<CreateAgentUseCase>();
builder.Services.AddScoped<GetAgentUseCase>();
```

### Phase 5: Frontend (if UI component needed)

#### Step 11: Create TypeScript Types
- [ ] Define types in `frontend/src/types/`
- [ ] Match backend DTOs
- [ ] Export from index file

**Example:**
```typescript
// frontend/src/types/agent.types.ts
export enum AgentType {
  Planner = 'planner',
  Coder = 'coder',
  Tester = 'tester',
  Reviewer = 'reviewer'
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  assignedTools: Tool[];
}

export interface CreateAgentRequest {
  name: string;
  type: AgentType;
}
```

#### Step 12: Create API Service
- [ ] Create service in `frontend/src/services/`
- [ ] Use apiClient for HTTP calls
- [ ] Handle errors appropriately

**Example:**
```typescript
// frontend/src/services/agentService.ts
import { apiClient } from './api';
import { Agent, CreateAgentRequest } from '../types/agent.types';

export const agentService = {
  async getAll(): Promise<Agent[]> {
    return apiClient.get<Agent[]>('/api/agents');
  },
  
  async getById(id: string): Promise<Agent> {
    return apiClient.get<Agent>(`/api/agents/${id}`);
  },
  
  async create(request: CreateAgentRequest): Promise<Agent> {
    return apiClient.post<Agent>('/api/agents', request);
  },
  
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/agents/${id}`);
  }
};
```

#### Step 13: Create React Component
- [ ] Create component in `frontend/src/components/[FeatureName]/`
- [ ] Use custom hooks for state management
- [ ] Add proper TypeScript types
- [ ] Create component tests

**Example:**
```typescript
// frontend/src/components/AgentManager/AgentManager.tsx
import React, { useState } from 'react';
import { Agent, AgentType } from '../../types/agent.types';
import { useAgents } from '../../hooks/useAgents';

interface AgentManagerProps {
  onAgentCreated?: (agent: Agent) => void;
}

export const AgentManager: React.FC<AgentManagerProps> = ({ onAgentCreated }) => {
  const { agents, loading, error, createAgent } = useAgents();
  const [name, setName] = useState('');
  const [type, setType] = useState<AgentType>(AgentType.Planner);
  
  const handleCreate = async () => {
    const agent = await createAgent({ name, type });
    setName('');
    onAgentCreated?.(agent);
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div className="agent-manager">
      <h2>Agent Manager</h2>
      
      <div className="create-agent">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name"
        />
        <select value={type} onChange={(e) => setType(e.target.value as AgentType)}>
          <option value={AgentType.Planner}>Planner</option>
          <option value={AgentType.Coder}>Coder</option>
          <option value={AgentType.Tester}>Tester</option>
          <option value={AgentType.Reviewer}>Reviewer</option>
        </select>
        <button onClick={handleCreate}>Create Agent</button>
      </div>
      
      <div className="agent-list">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <h3>{agent.name}</h3>
            <p>Type: {agent.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Step 14: Create Custom Hook
- [ ] Create hook in `frontend/src/hooks/`
- [ ] Manage state and side effects
- [ ] Use service for API calls
- [ ] Create hook tests

**Example:**
```typescript
// frontend/src/hooks/useAgents.ts
import { useState, useEffect } from 'react';
import { agentService } from '../services/agentService';
import { Agent, CreateAgentRequest } from '../types/agent.types';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadAgents();
  }, []);
  
  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await agentService.getAll();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const createAgent = async (request: CreateAgentRequest): Promise<Agent> => {
    const agent = await agentService.create(request);
    setAgents([...agents, agent]);
    return agent;
  };
  
  return { agents, loading, error, reload: loadAgents, createAgent };
}
```

### Phase 6: Testing

#### Step 15: Write Tests
- [ ] Domain layer tests (pure unit tests, no mocks)
- [ ] Application layer tests (use mocks for infrastructure)
- [ ] Infrastructure layer tests (integration tests)
- [ ] API tests (integration tests)
- [ ] Frontend component tests
- [ ] Frontend service tests
- [ ] Frontend hook tests

See `testing.instructions.md` for detailed testing patterns.

### Phase 7: Documentation

#### Step 16: Update Documentation
- [ ] Add XML comments to all public APIs
- [ ] Update API documentation if applicable
- [ ] Create/update ADR if architectural decision was made
- [ ] Update README if feature is significant
- [ ] Add usage examples

#### Step 17: Create ADR (if needed)
- [ ] Use `create-adr.prompt.md` to generate ADR
- [ ] Document why this approach was chosen
- [ ] List alternatives considered
- [ ] Document trade-offs

## Feature Type Templates

### Agent Feature
When creating a new agent type:
1. Define agent interface in Domain
2. Create agent entity with capabilities
3. Implement agent coordinator in Application
4. Create LLM-backed implementation in Infrastructure
5. Add agent configuration options
6. Create API endpoints for agent management
7. Build UI for agent interaction

### Workflow Node Feature
When creating a new node type:
1. Define node entity in Domain with node-specific behavior
2. Create node configuration DTO
3. Implement node executor in Application
4. Add node to workflow editor UI
5. Create node configuration panel
6. Add node validation logic

### Integration Feature
When integrating external service:
1. Define interface in Application layer
2. Create adapter in Infrastructure layer
3. Add configuration options
4. Implement error handling and retry logic
5. Create integration tests
6. Document usage and configuration

## Quality Checklist

Before considering feature complete:

### Architecture
- [ ] Respects Clean Architecture layer boundaries
- [ ] Dependencies point inward (toward Domain)
- [ ] No direct LLM SDK imports in Application/Domain
- [ ] Proper use of dependency injection
- [ ] Follows SOLID principles

### Code Quality
- [ ] Follows naming conventions
- [ ] Proper XML documentation (backend)
- [ ] Proper JSDoc (frontend)
- [ ] No code duplication
- [ ] Error handling implemented
- [ ] Logging added where appropriate

### Testing
- [ ] Domain layer: 90%+ coverage
- [ ] Application layer: 80%+ coverage
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] All tests are maintainable

### Documentation
- [ ] Public APIs documented
- [ ] ADR created if architectural decision made
- [ ] Usage examples provided
- [ ] README updated if needed

### Commit
- [ ] Follows conventional commits format
- [ ] Clear commit message with list of changes
- [ ] References issue/ticket if applicable

## Common Pitfalls to Avoid

1. ❌ **Infrastructure in Domain**: Never import infrastructure concerns in domain entities
2. ❌ **Business Logic in Controllers**: Keep controllers thin, delegate to use cases
3. ❌ **Anemic Domain Model**: Put business logic in entities, not in services
4. ❌ **God Objects**: Keep classes focused with single responsibility
5. ❌ **Missing Tests**: Always write tests, preferably before implementation (TDD)
6. ❌ **Direct Model Access**: Always use ILLMGateway abstraction
7. ❌ **Exposing Domain Entities**: Use DTOs for API responses
8. ❌ **Magic Strings**: Use constants or enums

## Example: Complete Feature Flow

For a "Git Integration" feature:

1. **Domain**: Define `GitOperation` entity, `RepositoryPath` value object
2. **Application**: Create `IGitService` interface, `ExecuteGitOperationUseCase`
3. **Infrastructure**: Implement `GitService` using LibGit2Sharp or CLI
4. **API**: Create `GitController` with commit, push, PR endpoints
5. **Frontend**: Create `GitPanel` component, `useGitOperations` hook
6. **Tests**: Unit tests for domain, integration tests for git operations
7. **Documentation**: Update README, create ADR for git integration approach

---

## Resources

- Clean Architecture Instructions: `.github/instructions/clean-architecture.instructions.md`
- Code Conventions: `.github/instructions/code-conventions.instructions.md`
- Testing Guidelines: `.github/instructions/testing.instructions.md`
- ADR Template: `.github/prompts/create-adr.prompt.md`
