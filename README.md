# B-One Maestro

> **An autonomous multi-agent workflow orchestrator for software engineering tasks**

B-One Maestro is a desktop application designed to manage and execute autonomous multi-agent workflows capable of performing end-to-end software engineering tasks including planning, testing, coding, validation, and Pull Request creation.

---

## 🎯 Vision and Long-Term Goals

### What Maestro IS

**Maestro is an orchestrator** — a sophisticated workflow engine that coordinates specialized AI agents to accomplish complex software engineering tasks through visual, composable workflows.

- **Workflow-First Architecture**: Build and visualize multi-agent workflows through an intuitive, n8n-style drag-and-drop interface
- **Model-Agnostic Platform**: Complete independence from any specific LLM or AI model through abstraction layers
- **Agent Orchestration**: Coordinate specialized agents (Planner, Tester, Coder, Reviewer) working together toward common goals
- **Long-Running Automation**: Support workflows that run for minutes, hours, or potentially days in the background
- **Developer-Centric**: Embedded terminal, git integration, and filesystem access for real engineering workflows
- **Desktop Application**: Native desktop app with embedded terminals and execution control
- **Comprehensive Monitoring**: Real-time observability of workflow execution, including live terminal output, execution state, and step-by-step progress
- **Artifact Integration**: Automatically detects and integrates files, scripts, and tools from predefined directories

### What Maestro is NOT

- ❌ **Not an AI model**: Maestro does not implement or train models
- ❌ **Not model-specific**: Zero direct dependencies on OpenAI, Anthropic, or any specific provider
- ❌ **Not a code editor or IDE**: Manual coding is done in external tools (e.g., VS Code, Visual Studio); Maestro orchestrates workflows and integrates the results
- ❌ **Not a web application**: Desktop-first architecture with native terminal integration and execution control
- ❌ **Not a monolithic agent**: Agents are specialized, composable, and workflow-driven

---

## 🏗️ Architecture Philosophy

### Core Principles

1. **Clean Architecture**: Strict separation of Domain, Application, Infrastructure, and Presentation layers
2. **SOLID Principles**: Explicit adherence to Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
3. **Dependency Inversion**: High-level modules never depend on low-level modules; both depend on abstractions
4. **Model Agnosticism**: All AI/LLM interactions flow through adapter layers, never directly from agents
5. **Workflow as Code**: Workflows are serializable, versionable, and stored alongside code in Git

### Why Model-Agnostic?

The AI landscape evolves rapidly. New models emerge, APIs change, and organizations have diverse requirements (local vs. cloud, proprietary vs. open-source). By abstracting model interactions:

- **Future-Proof**: Swap models without rewriting agents or workflows
- **Flexibility**: Run local models (Ollama, LM Studio) or remote APIs (OpenAI, Anthropic, Azure)
- **Cost Control**: Choose models based on task complexity and budget
- **Privacy**: Keep sensitive code local when needed
- **Vendor Independence**: No lock-in to any single provider

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (TypeScript)                │
│                    Workflow Editor + UI                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (.NET)                          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Presentation Layer (API Controllers, SignalR Hubs)     │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Application Layer (Use Cases, Orchestration Logic)     │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Domain Layer (Workflows, Agents, Nodes, Tools)         │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Infrastructure Layer (LLM Gateway, Git, File System)   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Model Adapters    │
                    │  (Local or Remote)  │
                    └─────────────────────┘
```

---

## 🧩 Core Abstractions

### Workflow

A **Workflow** is a directed acyclic graph (DAG) of nodes that defines a multi-step automation process.

- **Properties**: ID, Name, Description, Version, Nodes, Connections
- **Behavior**: Can be executed synchronously or asynchronously
- **Persistence**: Serialized to JSON and stored in Git repository
- **State**: Can be paused, resumed, or cancelled

### Node

A **Node** is a single unit of execution within a workflow.

**Node Types**:
- **Agent Node**: Executes an AI agent with specific context and tools
- **Tool Node**: Runs a bash script, git command, or other executable
- **Decision Node**: Conditional branching based on previous outputs
- **Validator Node**: Validates outputs against rules or schemas
- **Trigger Node**: Initiates workflow based on events (manual, webhook, schedule)

**Node Interface**:
```
- ID: Unique identifier
- Type: Node type enum
- Configuration: Node-specific settings (JSON)
- Inputs: Expected input schema
- Outputs: Produced output schema
- Connections: Links to downstream nodes
```

### Agent

An **Agent** is a specialized component that performs a specific software engineering task.

**Agent Types**:
- **Planner**: Breaks down high-level tasks into actionable steps
- **Coder**: Writes or modifies code based on specifications
- **Tester**: Creates and runs tests
- **Reviewer**: Analyzes code for quality, security, and best practices
- **Debugger**: Investigates and fixes issues

**Agent Interface**:
- **Receive**: Context (codebase state, previous outputs, task description)
- **Access**: Assigned tools (bash, git, filesystem)
- **Produce**: Structured outputs (code, plans, test results, reviews)
- **Communicate**: Via LLM Gateway abstraction (never directly to models)

### Tool

A **Tool** is an executable capability assigned to an agent.

**Tool Categories**:
- **Bash Commands**: Execute shell commands in a controlled environment
- **Git Operations**: Clone, commit, push, create PRs
- **File System**: Read/write files (with security restrictions)
- **Language-Specific**: Run linters, formatters, compilers, test runners

**Tool Interface**:
```
- Name: Tool identifier
- Execute(input): Synchronous or asynchronous execution
- Permissions: Read-only, write, or execute
- Environment: Sandboxed or full system access
```

### Execution Context

An **Execution Context** encapsulates the runtime state of a workflow execution.

**Context Contents**:
- **Workflow Instance ID**: Unique execution identifier
- **Node States**: Status of each node (pending, running, completed, failed)
- **Outputs**: Results from completed nodes
- **Variables**: Shared state across nodes
- **Metadata**: Start time, user, trigger source

---

## 🎨 Frontend Architecture

### Technology Stack
- **Language**: TypeScript (strict mode)
- **Framework**: React (or similar modern framework)
- **UI Library**: React Flow (or equivalent for node-based editors)
- **State Management**: Context API + Reducers or Zustand/Redux
- **Styling**: CSS Modules or Styled Components

### Responsibilities
- **Visualization**: Render workflows as node graphs
- **Configuration**: Provide UI for configuring nodes and connections
- **User Interaction**: Drag-and-drop, connection drawing, node selection
- **Real-Time Updates**: Display workflow execution progress via WebSocket/SignalR

### Non-Responsibilities
- ❌ No business logic (validation, execution)
- ❌ No direct agent or tool management
- ❌ No model communication

---

## 📊 Monitoring and Observability

Maestro provides **comprehensive real-time monitoring** of workflow execution. Unlike traditional monitoring tools focused on system metrics, Maestro's monitoring is workflow-centric and developer-friendly.

### Core Monitoring Features

#### 1. **Live Terminal Output**
- Real-time streaming of terminal output from tool executions
- Embedded terminal view showing bash commands, git operations, and tool results
- Color-coded output with syntax highlighting
- Scrollable history with search and filtering

#### 2. **Execution State Tracking**
- Visual indicators for each node's state (pending, running, completed, failed)
- Workflow-level progress tracking (e.g., "3 of 8 nodes completed")
- Step-by-step execution timeline showing duration of each node
- State persistence across application restarts

#### 3. **Progress Visualization**
- Real-time progress updates similar to GitHub Copilot task steps
- Each workflow step shows:
  - Current status with clear visual indicators
  - Estimated time remaining (when applicable)
  - Input/output data preview
  - Error messages and stack traces (on failure)
- Animated transitions between node states

#### 4. **Execution History**
- Complete log of all workflow executions
- Filterable by workflow, date, status, and duration
- Detailed execution reports with:
  - Node-by-node results
  - Agent decisions and reasoning
  - Tool invocations and outputs
  - Performance metrics

### Implementation

- **Frontend**: SignalR hub for real-time updates pushed from backend
- **Backend**: ExecutionMonitor service publishing events during workflow execution
- **Storage**: Execution logs stored as JSON files (optionally in database for querying)

### Why Desktop Application

The monitoring and execution control requirements **necessitate a desktop application**:

- **Embedded Terminals**: Native terminal integration for live output streaming
- **Process Management**: Direct control over long-running processes
- **File System Access**: Unrestricted access to local files and directories
- **Performance**: Real-time updates without web latency concerns
- **Security**: No need to expose execution control over the network

---

## 🗂️ Artifact Detection and Integration

Maestro **automatically detects and integrates artifacts** from predefined directories, enabling seamless workflow composition.

### Artifact Types

1. **Code Files**: `.cs`, `.ts`, `.py`, `.js`, etc. from source directories
2. **Scripts**: Shell scripts, PowerShell scripts, Python scripts from `scripts/` directory
3. **Tools**: Custom executables and binaries from `tools/` directory
4. **Configurations**: YAML, JSON, and XML configuration files
5. **Documentation**: Markdown files, README files, and inline code documentation

### Artifact Discovery

```
project-root/
├── .maestro/
│   ├── artifacts/              # Predefined artifact directory
│   │   ├── scripts/           # Shell scripts available as tools
│   │   ├── tools/             # Custom executables
│   │   └── templates/         # Code templates
│   └── config.json            # Artifact detection rules
```

### Integration Workflow

1. **Scan**: Application scans predefined directories on startup and file system changes
2. **Index**: Artifacts are indexed with metadata (type, path, last modified)
3. **Expose**: Artifacts become available as tools in workflow nodes
4. **Execute**: Agents can invoke artifacts during workflow execution
5. **Monitor**: Artifact executions are monitored and logged

### External Editor Integration

- **No built-in code editing**: All coding happens in external editors (VS Code, Visual Studio, etc.)
- **File watcher**: Maestro watches for file changes made by external editors
- **Auto-refresh**: Artifacts and code files are automatically refreshed when modified externally
- **Validation**: Modified artifacts are validated before being available in workflows

---

## 🔧 Backend Architecture

### Technology Stack
- **Language**: C# with .NET 8+ (or latest LTS)
- **Architecture**: Clean Architecture with SOLID principles
- **Communication**: REST API + SignalR for real-time updates
- **Persistence**: JSON files in Git repository (workflows) + optional database (execution history)

### Layer Breakdown

#### 1. Domain Layer
**Pure business logic, no dependencies**

- `Entities`: Workflow, Node, Agent, Tool, ExecutionContext
- `Value Objects`: NodeId, WorkflowId, AgentType, NodeStatus
- `Interfaces`: IAgent, ITool, IWorkflowRepository
- `Domain Services`: WorkflowValidator, NodeConnectionRules

#### 2. Application Layer
**Use cases and orchestration**

- `Commands`: CreateWorkflow, ExecuteWorkflow, PauseExecution, ResumeExecution
- `Queries`: GetWorkflow, GetExecutionStatus, ListWorkflows
- `Services`: WorkflowOrchestrator, ExecutionEngine
- `DTOs`: WorkflowDto, NodeDto, ExecutionStatusDto
- `Interfaces`: ILLMGateway, IGitService, IFileSystemService

#### 3. Infrastructure Layer
**External concerns and implementations**

- `Persistence`: JsonWorkflowRepository, FileSystemStorage
- `LLMGateway`: OpenAIAdapter, AnthropicAdapter, OllamaAdapter
- `GitIntegration`: GitCommandExecutor, PRCreationService
- `ToolExecutors`: BashToolExecutor, FileSystemToolExecutor

#### 4. Presentation Layer
**API and communication**

- `Controllers`: WorkflowController, ExecutionController, AgentController
- `Hubs`: ExecutionHub (SignalR for real-time updates)
- `Middleware`: ErrorHandling, Authentication, Logging

### Dependency Rules

- **Domain** depends on nothing
- **Application** depends only on Domain
- **Infrastructure** depends on Application and Domain
- **Presentation** depends on Application and Infrastructure

---

## 📁 Workflow Persistence

Workflows are **stored as JSON files** within the Git repository. This provides:

### Benefits
- **Version Control**: Track workflow changes over time
- **Collaboration**: Share workflows via pull requests
- **Portability**: Workflows are human-readable and editable
- **Reproducibility**: Run the same workflow across different environments

### Structure
```json
{
  "id": "workflow-uuid",
  "name": "Feature Development Pipeline",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node-1",
      "type": "Planner",
      "config": { "task": "Create authentication module" }
    },
    {
      "id": "node-2",
      "type": "Coder",
      "config": { "language": "csharp" }
    }
  ],
  "connections": [
    { "from": "node-1", "to": "node-2", "output": "plan" }
  ]
}
```

---

## 🚫 Non-Goals and Constraints

### Non-Goals (Out of Scope)

1. **Model Training**: Maestro does not train or fine-tune models
2. **Code Editing**: Not a replacement for VS Code, Visual Studio, or JetBrains — manual coding happens in external editors
3. **Project Management**: No issue tracking, no sprint management
4. **General-Purpose Automation**: Focus is software engineering, not marketing or business processes
5. **Multi-User Collaboration**: Initial focus is single-user desktop application
6. **Web Application**: Desktop-only; web UI would compromise terminal integration and execution control

### Technical Constraints

1. **No Direct Model Dependencies**: All AI interactions via abstraction layer
2. **Desktop-First**: Not a web application (though backend is API-based)
3. **Git-Centric**: Assumes workflows run in context of a Git repository
4. **Workflow Serialization**: Must be JSON-serializable for Git storage
5. **Language Constraints**: Backend in .NET, Frontend in TypeScript (non-negotiable)

---

## 📐 Architectural Rules for Contributors

### Mandatory Rules

1. **Respect Layer Boundaries**: Never bypass layers. Infrastructure must not call Domain directly; Application orchestrates.

2. **Dependency Inversion**: Always depend on interfaces/abstractions, not concrete implementations.

3. **Single Responsibility**: Each class/module has one reason to change.

4. **No Model Hardcoding**: Never import OpenAI SDK, Anthropic SDK, or similar directly in Agent code. Use ILLMGateway.

5. **No Business Logic in Frontend**: Frontend is purely presentational.

6. **Test Isolation**: Unit tests must not depend on external services (use mocks/stubs).

7. **Workflow Immutability**: Once a workflow starts executing, its definition is immutable (create new versions instead).

8. **Security by Default**: All tool executions are sandboxed unless explicitly granted elevated permissions.

### Code Quality Standards

- **Code Coverage**: Minimum 80% for Domain and Application layers
- **Static Analysis**: Zero warnings with strict compiler settings
- **Code Reviews**: All PRs require review before merge
- **Naming Conventions**: Follow C# conventions (backend) and TypeScript conventions (frontend)
- **Documentation**: All public APIs must have XML/JSDoc comments

### Git Workflow

- **Branching**: `feature/`, `bugfix/`, `docs/` prefixes
- **Commits**: Conventional Commits (feat, fix, docs, refactor, test, chore)
- **Pull Requests**: Must include description, link to issue, testing notes

---

## 🚀 Future Goals

- **Multi-Workflow Execution**: Run multiple workflows in parallel
- **Multi-PR Management**: Handle multiple pull requests simultaneously
- **Workflow Marketplace**: Share and discover community workflows
- **Advanced Scheduling**: Cron-based triggers, event-driven workflows
- **Plugin System**: Extend with custom agents and tools
- **Cloud Sync**: Optional cloud backup of execution history
- **Team Edition**: Multi-user support with role-based access control

---

## 🧪 Development Status

**Current Phase**: Phase 1 Complete - Moving to Phase 2

### Phase 1: Foundation (Backend Core) - ✅ COMPLETE

This phase has been successfully completed with the following deliverables:

#### ✅ Project Structure
- Solution structure (`Maestro.sln`) with 5 source projects
- Clean Architecture layers: Domain, Application, Infrastructure, Api, Agents
- Test project structure mirroring source projects (5 test projects)

#### ✅ Build & CI/CD
- Central package management configured
- Roslyn analyzers integrated (Microsoft.CodeAnalysis.NetAnalyzers, StyleCop.Analyzers)
- Code coverage tooling set up (Coverlet)
- GitHub Actions CI/CD workflow operational
- `.editorconfig` for code style enforcement

#### ✅ Test Infrastructure
- xUnit test framework configured
- Test dependencies: Moq, FluentAssertions, Coverlet
- All test projects building and passing
- Code coverage collection enabled

#### ✅ Documentation
- README.md with architecture principles
- BUILD.md with build and test instructions
- CONTRIBUTING.md with contribution guidelines
- Clean Architecture guidelines documented

### What's Next

1. ✅ Define architecture and core abstractions (this document)
2. ✅ Set up project structure (backend, frontend, shared schemas)
3. ⏳ Implement Domain layer (Workflow, Node, Agent entities)
4. ⏳ Build LLM Gateway abstraction
5. ⏳ Create basic workflow editor UI
6. ⏳ Implement execution engine
7. ⏳ Add Git and filesystem integrations

---

## 📚 Documentation

- [Project Structure](./docs/PROJECT_STRUCTURE.md) - Detailed folder organization
- [Architecture Decision Records](./docs/adr/) - Key architectural decisions
- [API Documentation](./docs/api/) - Backend API specifications
- [Workflow Schema](./docs/schemas/workflow-schema.json) - Workflow JSON schema
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute

---

## 🤝 Contributing

We welcome contributions from senior developers who understand and respect the architectural principles outlined in this document.

**Before contributing**:
1. Read this entire README
2. Review the [Contributing Guide](./CONTRIBUTING.md)
3. Understand Clean Architecture and SOLID principles
4. Familiarize yourself with the project structure

**Areas needing help**:
- Backend domain modeling
- LLM adapter implementations
- Workflow editor UI components
- Tool executors and sandboxing
- Documentation and examples

---

## 📄 License

[MIT License](LICENSE) - See LICENSE file for details

---

## 🙏 Acknowledgments

Inspired by:
- **n8n**: Workflow automation and visual node editor
- **Langchain**: Agent and tool abstractions
- **AutoGPT**: Autonomous agent concepts
- **Clean Architecture**: Robert C. Martin's architectural philosophy

---

**B-One Maestro** — Orchestrating the future of autonomous software engineering.