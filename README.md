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

## 🔐 Backend as Single Source of Truth

### Unified Block Architecture

**Critical Design Principle**: The Backend is the **exclusive owner** of all block and workflow data. All clients (Frontend, CLI, MCP Server, future agents) access blocks through the Backend HTTP API.

```
┌──────────────────────────────────────────────────────────────────┐
│                    FILESYSTEM (Real Blocks)                      │
│         blocks/, .maestro/blocks/, ~/.maestro/blocks/            │
└─────────────────────────┬────────────────────────────────────────┘
                          │ READ/WRITE (exclusive)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BACKEND (Single Source of Truth)                │
│  FileSystemBlockDiscoveryService → BlocksController → REST API   │
│  Real-time events via SignalR for file changes                   │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP API + SignalR
          ┌───────────────┼───────────────┬────────────────┐
          ▼               ▼               ▼                ▼
    ┌──────────┐   ┌──────────────┐   ┌─────────┐   ┌───────────┐
    │ Frontend │   │ Maestro CLI  │   │  MCP    │   │  Future   │
    │ (React)  │   │ (Node.js)    │   │ Server  │   │  Agents   │
    └──────────┘   └──────────────┘   └─────────┘   └───────────┘
```

### Why This Matters

1. **Docker Isolation**: Backend can run in a container; clients connect via HTTP
2. **Auto-Training Ready**: Agents can create/modify blocks through API with validation
3. **Consistency**: All clients see the same block state
4. **Security**: Centralized validation and access control
5. **Real-time Updates**: SignalR broadcasts changes to all connected clients

### Block Discovery Paths

The backend discovers blocks from multiple locations (in priority order):

| Location | Purpose | Example Path |
|----------|---------|--------------|
| Project | Project-specific blocks | `./.maestro/blocks/` |
| User | User's personal blocks | `~/.maestro/blocks/` |
| Global | Shipped with Maestro | `{install}/blocks/` |

### API-First Design

All block operations go through the REST API:

| Operation | Endpoint | Description |
|-----------|----------|-------------|
| List | `GET /api/blocks` | Get all blocks with filtering |
| Get | `GET /api/blocks/{id}` | Get single block details |
| Create | `POST /api/blocks` | Create new block |
| Update | `PUT /api/blocks/{id}` | Update existing block |
| Delete | `DELETE /api/blocks/{id}` | Delete block |
| Search | `GET /api/blocks/search?q=...` | Search blocks |

### Self-Improvement Architecture

This architecture enables Maestro's long-term goal of **self-improvement**:

1. **Agent Creates Block**: An agent generates a new prompt or tool block
2. **API Validates**: Backend validates against JSON schema
3. **Persistence**: Block written to filesystem
4. **Broadcast**: SignalR notifies all connected clients
5. **Comparison**: New block can be benchmarked against existing solutions
6. **Iteration**: Agent refines based on benchmark results

```
┌─────────────────────────────────────────────────────────────┐
│                    Self-Improvement Loop                     │
├─────────────────────────────────────────────────────────────┤
│  1. Agent identifies improvement opportunity                 │
│  2. Agent generates new/modified block via API              │
│  3. Backend validates and persists block                    │
│  4. Benchmark compares new vs existing approach             │
│  5. If improvement: promote new block                       │
│  6. If regression: revert and log learnings                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Model Registry & Auto-Optimization

### Model as a First-Class Resource

Maestro treats **AI Models as first-class resources** with rich metadata, enabling intelligent model selection and workflow optimization.

#### Model Definition

Each model in the registry includes:

| Property | Description |
|----------|-------------|
| `id` | Unique identifier (e.g., `gpt-4o`, `claude-3-opus`, `llama3-70b`) |
| `provider` | Provider adapter (OpenAI, Anthropic, Ollama, Azure, etc.) |
| `displayName` | Human-readable name |
| `capabilities` | Array of capabilities (`code-generation`, `reasoning`, `vision`, `tool-use`, etc.) |
| `contextWindow` | Maximum context size in tokens |
| `costPerInputToken` | Cost per input token (USD) |
| `costPerOutputToken` | Cost per output token (USD) |
| `speedRating` | Relative speed (1-10, higher = faster) |
| `qualityRating` | Relative quality for different tasks |
| `strengths` | What this model excels at |
| `weaknesses` | Known limitations |
| `maxOutputTokens` | Maximum output size |
| `supportsStreaming` | Whether streaming is supported |
| `supportsToolCalls` | Whether function/tool calling is supported |

#### Example Model Definition

```json
{
  "id": "gpt-4o",
  "provider": "openai",
  "displayName": "GPT-4o",
  "capabilities": ["code-generation", "reasoning", "vision", "tool-use"],
  "contextWindow": 128000,
  "costPerInputToken": 0.000005,
  "costPerOutputToken": 0.000015,
  "speedRating": 8,
  "qualityRating": {
    "code-generation": 9,
    "reasoning": 9,
    "summarization": 8,
    "creative-writing": 7
  },
  "strengths": ["Fast responses", "Excellent code generation", "Good tool use"],
  "weaknesses": ["May be verbose", "Occasional hallucinations on niche topics"],
  "maxOutputTokens": 16384,
  "supportsStreaming": true,
  "supportsToolCalls": true
}
```

### Models Panel (UI)

The **Models Panel** provides a centralized interface for:

1. **Model Configuration**: Add, edit, and remove model definitions
2. **Capability Comparison**: Side-by-side comparison of model capabilities
3. **Cost Analysis**: Visualize cost per task type
4. **Performance Metrics**: Track response times and quality scores
5. **Usage Statistics**: Monitor token usage and costs over time

### Model Assignment

Models are attached to **Agent Blocks** in workflows:

```json
{
  "id": "agent-coder-1",
  "blockType": "agent",
  "config": {
    "agentType": "Coder",
    "modelId": "gpt-4o",
    "fallbackModelId": "claude-3-sonnet",
    "maxTokens": 4096
  }
}
```

### Auto-Optimization Vision (Future)

Maestro will enable **self-optimizing workflows** through:

#### 1. Benchmarking Engine
- Run workflows with different model configurations
- Measure: quality, speed, cost, token efficiency
- Compare results across model variants

#### 2. Optimization Strategies
- **Cost Optimization**: Find the cheapest model that meets quality threshold
- **Quality Optimization**: Find the best model within budget
- **Speed Optimization**: Minimize latency for time-critical tasks
- **Hybrid Optimization**: Balance cost/quality/speed with weights

#### 3. Adaptive Model Selection
- Learn from execution history which models perform best for specific task types
- Automatically suggest or apply model changes
- A/B testing of model configurations

#### 4. Workflow Self-Improvement
- Run shadow executions with alternative models
- Track quality metrics over time
- Propose workflow modifications to reduce cost or improve output

```
┌─────────────────────────────────────────────────────────────┐
│                    Auto-Optimization Loop                    │
├─────────────────────────────────────────────────────────────┤
│  1. Execute workflow with current model configuration       │
│  2. Collect metrics (cost, quality, speed)                  │
│  3. Run benchmark with alternative models (shadow mode)     │
│  4. Compare results against optimization goal               │
│  5. Propose/apply model changes if improvement found        │
│  6. Track improvements over time                            │
└─────────────────────────────────────────────────────────────┘
```

---

## �🧩 Core Abstractions

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

## ⚙️ Configuration

Maestro uses a central configuration file (`maestro.config.json`) at the project root to control application behavior, including backend switching and environment settings.

### Configuration File

Create or edit `maestro.config.json` at the project root:

```json
{
  "$schema": "./docs/schemas/maestro-config.schema.json",
  "environment": "development",
  "frontend": {
    "useMockBackend": true,
    "apiBaseUrl": "http://localhost:5000",
    "mockLatency": {
      "minMs": 100,
      "maxMs": 300
    }
  },
  "backend": {
    "llmProvider": "openai",
    "logLevel": "debug"
  }
}
```

### Mock Backend (for Development)

The frontend can run independently of the .NET backend using mock services:

| Setting | Description | Default |
|---------|-------------|---------|
| `useMockBackend` | When `true`, uses in-memory mock services | `true` in dev |
| `mockLatency.minMs` | Minimum simulated API latency | `100` |
| `mockLatency.maxMs` | Maximum simulated API latency | `300` |

**Benefits of Mock Backend**:
- ✅ Develop UI without running .NET backend
- ✅ Fast, predictable tests
- ✅ Offline development
- ✅ Isolated frontend testing

### Switching to Real Backend

1. Start the .NET backend: `dotnet run --project backend/src/Maestro.Api`
2. Update `maestro.config.json`:
   ```json
   {
     "frontend": {
       "useMockBackend": false,
       "apiBaseUrl": "http://localhost:5000"
     }
   }
   ```
3. Restart the frontend dev server

### Environment-Specific Configs

Create environment-specific config files:
- `maestro.config.json` - Development defaults
- `maestro.config.production.json` - Production settings

---

## 🐳 Docker Deployment

Maestro can be deployed in Docker containers for isolated execution, consistent environments, and multi-user deployments.

### Quick Start

```bash
# 1. Create .env file from template
cp .env.example .env

# 2. Add your API keys to .env
# Edit .env and set OPENAI_API_KEY or other provider keys

# 3. Start backend in Docker
docker-compose up -d backend

# 4. Verify health
curl http://localhost:5000/api/discovery/health

# 5. Connect CLI/MCP/Frontend
export MAESTRO_API_URL=http://localhost:5000
node tools/maestro-cli/index.js blocks
```

### Development Mode with Hot Reload

```bash
# Start backend with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Backend will reload on code changes
# Frontend runs at http://localhost:5173
# Backend API at http://localhost:5000
```

### Benefits of Docker Deployment

- ✅ **Isolated Execution**: Safe environment for tool execution
- ✅ **Consistent Environment**: Same configuration across machines
- ✅ **Block Persistence**: Blocks persist via volume mounts
- ✅ **Multi-Client**: CLI, MCP, Frontend all connect via HTTP
- ✅ **Future Ready**: Foundation for multi-user and auto-training features

### Volume Mounts

Blocks are persisted through volume mounts:

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./blocks` | `/app/blocks` | Global project blocks |
| `./.maestro` | `/app/.maestro` | Project-specific blocks |
| `~/.maestro/blocks` | `/root/.maestro/blocks` | User blocks (read-only) |

### Complete Documentation

See [Docker Deployment Guide](./docs/DOCKER-DEPLOYMENT.md) for comprehensive documentation including:
- Environment variables
- Troubleshooting
- CLI/MCP/Frontend integration
- Security best practices
- CI/CD integration

---

## 🧪 Development Status

**Current Phase**: Architecture and Foundation

This README represents the architectural vision. Implementation is in progress.

### What's Next

1. ✅ Define architecture and core abstractions (this document)
2. ⏳ Set up project structure (backend, frontend, shared schemas)
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