# B-One Maestro Project Structure

This document describes the complete project structure for B-One Maestro, organized to support scalability, testability, and maintainability.

---

## 📂 Repository Layout

```
Meastro/
├── README.md                          # Main project documentation
├── LICENSE                            # MIT License
├── .gitignore                         # Git ignore patterns
├── .editorconfig                      # Editor configuration
├── docker-compose.yml                 # Optional: For local development
├──
├── docs/                              # Documentation
│   ├── PROJECT_STRUCTURE.md           # This file
│   ├── ARCHITECTURE.md                # Deep-dive architecture
│   ├── API.md                         # API documentation
│   ├── WORKFLOWS.md                   # Workflow design guide
│   ├── adr/                           # Architecture Decision Records
│   │   ├── 0001-model-agnostic-design.md
│   │   ├── 0002-workflow-persistence.md
│   │   └── 0003-clean-architecture.md
│   ├── schemas/                       # JSON Schemas
│   │   ├── workflow-schema.json       # Workflow definition schema
│   │   ├── node-schema.json           # Node definition schema
│   │   └── execution-context-schema.json
│   └── images/                        # Architecture diagrams
│       ├── architecture-overview.png
│       └── workflow-example.png
│
├── workflows/                         # User-defined workflows (versioned)
│   ├── examples/                      # Example workflows
│   │   ├── simple-coder.json
│   │   ├── full-feature-pipeline.json
│   │   └── pr-review-workflow.json
│   └── .gitkeep
│
├── backend/                           # .NET Backend
│   ├── Maestro.sln                    # Solution file
│   ├── .editorconfig                  # C# code style
│   ├── Directory.Build.props          # Common MSBuild properties
│   ├── Directory.Packages.props       # Central Package Management
│   │
│   ├── src/                           # Source code
│   │   ├── Maestro.Domain/            # Domain Layer
│   │   │   ├── Entities/
│   │   │   │   ├── Workflow.cs
│   │   │   │   ├── Node.cs
│   │   │   │   ├── Agent.cs
│   │   │   │   ├── Tool.cs
│   │   │   │   └── ExecutionContext.cs
│   │   │   ├── ValueObjects/
│   │   │   │   ├── WorkflowId.cs
│   │   │   │   ├── NodeId.cs
│   │   │   │   ├── AgentType.cs
│   │   │   │   └── NodeStatus.cs
│   │   │   ├── Interfaces/
│   │   │   │   ├── IAgent.cs
│   │   │   │   ├── ITool.cs
│   │   │   │   ├── IWorkflowRepository.cs
│   │   │   │   └── IExecutionContext.cs
│   │   │   ├── Services/
│   │   │   │   ├── WorkflowValidator.cs
│   │   │   │   └── NodeConnectionRules.cs
│   │   │   ├── Exceptions/
│   │   │   │   ├── WorkflowException.cs
│   │   │   │   └── NodeExecutionException.cs
│   │   │   └── Maestro.Domain.csproj
│   │   │
│   │   ├── Maestro.Application/       # Application Layer
│   │   │   ├── Commands/
│   │   │   │   ├── CreateWorkflow/
│   │   │   │   │   ├── CreateWorkflowCommand.cs
│   │   │   │   │   ├── CreateWorkflowCommandHandler.cs
│   │   │   │   │   └── CreateWorkflowCommandValidator.cs
│   │   │   │   ├── ExecuteWorkflow/
│   │   │   │   │   ├── ExecuteWorkflowCommand.cs
│   │   │   │   │   └── ExecuteWorkflowCommandHandler.cs
│   │   │   │   ├── PauseExecution/
│   │   │   │   └── ResumeExecution/
│   │   │   ├── Queries/
│   │   │   │   ├── GetWorkflow/
│   │   │   │   │   ├── GetWorkflowQuery.cs
│   │   │   │   │   └── GetWorkflowQueryHandler.cs
│   │   │   │   ├── GetExecutionStatus/
│   │   │   │   └── ListWorkflows/
│   │   │   ├── DTOs/
│   │   │   │   ├── WorkflowDto.cs
│   │   │   │   ├── NodeDto.cs
│   │   │   │   ├── ExecutionStatusDto.cs
│   │   │   │   └── AgentDto.cs
│   │   │   ├── Interfaces/
│   │   │   │   ├── ILLMGateway.cs      # Critical abstraction
│   │   │   │   ├── IGitService.cs
│   │   │   │   ├── IFileSystemService.cs
│   │   │   │   └── IToolExecutor.cs
│   │   │   ├── Services/
│   │   │   │   ├── WorkflowOrchestrator.cs
│   │   │   │   ├── ExecutionEngine.cs
│   │   │   │   └── NodeExecutor.cs
│   │   │   ├── Mappings/
│   │   │   │   └── MappingProfile.cs  # AutoMapper profiles
│   │   │   └── Maestro.Application.csproj
│   │   │
│   │   ├── Maestro.Infrastructure/    # Infrastructure Layer
│   │   │   ├── Persistence/
│   │   │   │   ├── JsonWorkflowRepository.cs
│   │   │   │   ├── FileSystemStorage.cs
│   │   │   │   └── ExecutionHistoryRepository.cs
│   │   │   ├── LLMGateway/            # Model abstraction implementations
│   │   │   │   ├── LLMGateway.cs      # Main gateway
│   │   │   │   ├── Adapters/
│   │   │   │   │   ├── ILLMAdapter.cs
│   │   │   │   │   ├── OpenAIAdapter.cs
│   │   │   │   │   ├── AnthropicAdapter.cs
│   │   │   │   │   ├── OllamaAdapter.cs
│   │   │   │   │   └── AzureOpenAIAdapter.cs
│   │   │   │   ├── Models/
│   │   │   │   │   ├── LLMRequest.cs
│   │   │   │   │   ├── LLMResponse.cs
│   │   │   │   │   └── ModelConfiguration.cs
│   │   │   │   └── Configuration/
│   │   │   │       └── LLMGatewayOptions.cs
│   │   │   ├── Git/
│   │   │   │   ├── GitService.cs
│   │   │   │   ├── GitCommandExecutor.cs
│   │   │   │   └── PRCreationService.cs
│   │   │   ├── FileSystem/
│   │   │   │   ├── FileSystemService.cs
│   │   │   │   └── SandboxedFileSystem.cs
│   │   │   ├── ToolExecutors/
│   │   │   │   ├── BashToolExecutor.cs
│   │   │   │   ├── GitToolExecutor.cs
│   │   │   │   └── FileSystemToolExecutor.cs
│   │   │   ├── DependencyInjection/
│   │   │   │   └── ServiceCollectionExtensions.cs
│   │   │   └── Maestro.Infrastructure.csproj
│   │   │
│   │   ├── Maestro.Api/               # Presentation Layer (API)
│   │   │   ├── Controllers/
│   │   │   │   ├── WorkflowController.cs
│   │   │   │   ├── ExecutionController.cs
│   │   │   │   ├── AgentController.cs
│   │   │   │   └── ToolController.cs
│   │   │   ├── Hubs/                  # SignalR for real-time
│   │   │   │   └── ExecutionHub.cs
│   │   │   ├── Middleware/
│   │   │   │   ├── ExceptionHandlingMiddleware.cs
│   │   │   │   └── RequestLoggingMiddleware.cs
│   │   │   ├── Filters/
│   │   │   │   └── ValidationFilter.cs
│   │   │   ├── Program.cs
│   │   │   ├── appsettings.json
│   │   │   ├── appsettings.Development.json
│   │   │   └── Maestro.Api.csproj
│   │   │
│   │   └── Maestro.Agents/            # Agent implementations
│   │       ├── Planner/
│   │       │   ├── PlannerAgent.cs
│   │       │   └── PlannerConfiguration.cs
│   │       ├── Coder/
│   │       │   ├── CoderAgent.cs
│   │       │   └── CoderConfiguration.cs
│   │       ├── Tester/
│   │       │   ├── TesterAgent.cs
│   │       │   └── TesterConfiguration.cs
│   │       ├── Reviewer/
│   │       │   ├── ReviewerAgent.cs
│   │       │   └── ReviewerConfiguration.cs
│   │       ├── Debugger/
│   │       │   ├── DebuggerAgent.cs
│   │       │   └── DebuggerConfiguration.cs
│   │       └── Maestro.Agents.csproj
│   │
│   └── tests/                         # Test projects
│       ├── Maestro.Domain.Tests/
│       │   ├── Entities/
│       │   ├── ValueObjects/
│       │   ├── Services/
│       │   └── Maestro.Domain.Tests.csproj
│       ├── Maestro.Application.Tests/
│       │   ├── Commands/
│       │   ├── Queries/
│       │   ├── Services/
│       │   └── Maestro.Application.Tests.csproj
│       ├── Maestro.Infrastructure.Tests/
│       │   ├── Persistence/
│       │   ├── LLMGateway/
│       │   ├── Git/
│       │   └── Maestro.Infrastructure.Tests.csproj
│       ├── Maestro.Api.Tests/
│       │   ├── Controllers/
│       │   ├── Integration/
│       │   └── Maestro.Api.Tests.csproj
│       └── Maestro.Agents.Tests/
│           └── Maestro.Agents.Tests.csproj
│
├── frontend/                          # TypeScript Frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts                 # Or webpack/other bundler
│   ├── .eslintrc.json
│   ├── .prettierrc
│   │
│   ├── public/                        # Static assets
│   │   ├── index.html
│   │   └── favicon.ico
│   │
│   └── src/
│       ├── main.tsx                   # Entry point
│       ├── App.tsx                    # Root component
│       │
│       ├── components/                # React components
│       │   ├── WorkflowEditor/
│       │   │   ├── WorkflowEditor.tsx
│       │   │   ├── NodePalette.tsx
│       │   │   ├── Canvas.tsx
│       │   │   └── NodeConfigPanel.tsx
│       │   ├── Nodes/                 # Individual node components
│       │   │   ├── AgentNode.tsx
│       │   │   ├── ToolNode.tsx
│       │   │   ├── DecisionNode.tsx
│       │   │   └── TriggerNode.tsx
│       │   ├── Execution/
│       │   │   ├── ExecutionPanel.tsx
│       │   │   ├── ExecutionStatus.tsx
│       │   │   └── ExecutionLogs.tsx
│       │   └── Common/
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       └── Modal.tsx
│       │
│       ├── hooks/                     # Custom React hooks
│       │   ├── useWorkflow.ts
│       │   ├── useExecution.ts
│       │   └── useSignalR.ts
│       │
│       ├── services/                  # API clients
│       │   ├── api.ts                 # Base API client
│       │   ├── workflowService.ts
│       │   ├── executionService.ts
│       │   └── signalRService.ts
│       │
│       ├── types/                     # TypeScript types
│       │   ├── workflow.types.ts
│       │   ├── node.types.ts
│       │   ├── agent.types.ts
│       │   └── execution.types.ts
│       │
│       ├── store/                     # State management
│       │   ├── workflowStore.ts
│       │   ├── executionStore.ts
│       │   └── uiStore.ts
│       │
│       ├── utils/                     # Utility functions
│       │   ├── validation.ts
│       │   ├── formatting.ts
│       │   └── nodeHelpers.ts
│       │
│       ├── styles/                    # Global styles
│       │   ├── globals.css
│       │   ├── variables.css
│       │   └── themes.css
│       │
│       └── __tests__/                 # Frontend tests
│           ├── components/
│           ├── hooks/
│           └── utils/
│
└── shared/                            # Shared schemas and types
    ├── schemas/                       # JSON schemas (for validation)
    │   ├── workflow.schema.json
    │   ├── node.schema.json
    │   └── agent.schema.json
    └── README.md                      # Shared resources documentation
```

---

## 🎯 Design Principles

### 1. **Backend Structure**

The backend follows **Clean Architecture** with strict layer separation:

- **Domain**: Pure C# with no external dependencies. Contains business logic and rules.
- **Application**: Use Cases and orchestration logic. Depends only on Domain.
- **Infrastructure**: External concerns (database, APIs, file system). Implements Application interfaces.
- **Presentation (API)**: HTTP endpoints and SignalR hubs. Thin layer that delegates to Application.

**Key Points**:
- Each layer is a separate `.csproj` (project)
- Dependencies flow inward (Presentation → Application → Domain)
- Infrastructure is "pluggable" via dependency injection
- Unit tests mirror source structure

### 2. **Frontend Structure**

The frontend is organized by **feature and component type**:

- **Components**: Organized by feature area (WorkflowEditor, Execution, etc.)
- **Services**: API communication layer (no business logic)
- **Store**: Centralized state management
- **Types**: Shared TypeScript interfaces and types
- **Tests**: Co-located or in dedicated `__tests__` directory

**Key Points**:
- No business logic in components (keep them presentational)
- API calls through service layer
- Type-safe throughout (strict TypeScript)
- Reusable components in `Common/`

### 3. **Workflow Storage**

Workflows are stored in the `workflows/` directory at the repository root:

- **Version controlled**: Committed to Git like code
- **JSON format**: Human-readable and editable
- **Examples included**: `workflows/examples/` contains sample workflows
- **User workflows**: Users save workflows in `workflows/` root or subdirectories

### 4. **Shared Schemas**

The `shared/` directory contains:

- **JSON Schemas**: For workflow, node, and agent definitions
- **Used by both**: Backend validates against schemas, frontend uses for typing
- **Single source of truth**: Prevents drift between frontend and backend

---

## 🔧 Technology Stack

### Backend
- **.NET 8+** (or latest LTS)
- **ASP.NET Core** (Web API)
- **SignalR** (real-time communication)
- **FluentValidation** (input validation)
- **AutoMapper** (DTO mapping)
- **MediatR** (CQRS pattern)
- **xUnit** or **NUnit** (testing)
- **Moq** (mocking)

### Frontend
- **TypeScript 5+** (strict mode)
- **React 18+**
- **React Flow** or **ReactFlow** (node-based UI)
- **Zustand** or **Redux Toolkit** (state management)
- **Vite** (build tool)
- **Vitest** or **Jest** (testing)
- **React Testing Library** (component testing)
- **TanStack Query** (API caching, optional)

### Development
- **Docker** (optional containerization)
- **ESLint** + **Prettier** (frontend linting)
- **Roslyn Analyzers** (backend linting)
- **Husky** (git hooks, optional)

---

## 📦 Build and Run

### Backend

```bash
cd backend
dotnet restore
dotnet build
dotnet test
dotnet run --project src/Maestro.Api
```

Backend runs on `https://localhost:5001` (or configured port).

### Frontend

```bash
cd frontend
npm install
npm run dev    # Development server
npm run build  # Production build
npm run test   # Run tests
```

Frontend runs on `http://localhost:5173` (Vite default).

---

## 🧪 Testing Strategy

### Backend Tests

1. **Domain Tests**: Pure unit tests, no mocking needed
2. **Application Tests**: Test use cases with mocked interfaces
3. **Infrastructure Tests**: Integration tests with real dependencies (or test doubles)
4. **API Tests**: Integration tests with WebApplicationFactory

**Coverage Goal**: 80%+ for Domain and Application layers.

### Frontend Tests

1. **Component Tests**: Test individual components with React Testing Library
2. **Hook Tests**: Test custom hooks in isolation
3. **Integration Tests**: Test workflows with mocked API
4. **E2E Tests** (optional): Playwright or Cypress for critical flows

**Coverage Goal**: 70%+ overall.

---

## 🔐 Security Considerations

### Tool Execution

- All tool executions are **sandboxed by default**
- File system access is **restricted to project directory**
- Bash commands run in a **controlled environment**
- Elevated permissions require **explicit user approval**

### API Security

- **Authentication**: JWT or similar (to be defined)
- **Authorization**: Role-based access (future)
- **Input validation**: All inputs validated against schemas
- **Rate limiting**: Prevent abuse

### Model Communication

- **Secrets management**: API keys stored securely (not in code)
- **TLS/HTTPS**: All remote API calls over HTTPS
- **No model exposure**: Frontend never talks directly to models

---

## 📝 Configuration

### Backend Configuration (`appsettings.json`)

```json
{
  "LLMGateway": {
    "DefaultProvider": "OpenAI",
    "Providers": {
      "OpenAI": {
        "ApiKey": "env:OPENAI_API_KEY",
        "Model": "gpt-4"
      },
      "Ollama": {
        "BaseUrl": "http://localhost:11434",
        "Model": "llama2"
      }
    }
  },
  "Workflows": {
    "StoragePath": "../workflows"
  },
  "Git": {
    "DefaultBranch": "main"
  }
}
```

### Frontend Configuration (`.env`)

```env
VITE_API_BASE_URL=https://localhost:5001
VITE_SIGNALR_HUB_URL=https://localhost:5001/hubs/execution
```

---

## 🚀 Next Steps

1. **Set up projects**: Create `.csproj` and `package.json` files
2. **Define schemas**: Create JSON schemas for workflows and nodes
3. **Implement Domain**: Start with core entities (Workflow, Node)
4. **Build LLM Gateway**: Create ILLMGateway interface and first adapter
5. **Create UI mockup**: Build basic workflow editor UI
6. **Wire up API**: Connect frontend to backend via REST + SignalR

---

## 📚 Additional Resources

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Flow Documentation](https://reactflow.dev/)
- [.NET Clean Architecture Template](https://github.com/jasontaylordev/CleanArchitecture)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

This structure is designed to be **scalable**, **testable**, and **maintainable** while adhering to the architectural principles defined in the main README.
