# B-One Maestro Development Roadmap

> **Status**: Active Development  
> **Last Updated**: 2026-01-12  
> **Purpose**: This roadmap provides a detailed, step-by-step execution plan to build B-One Maestro from its current initialized state to a functional MVP and beyond.

---

## 🎯 Vision Recap

B-One Maestro is an autonomous multi-agent workflow orchestrator for software engineering tasks. This roadmap ensures:

- **Parallel Development**: Multiple teams can work simultaneously
- **Clear Dependencies**: Sequential vs. parallelizable tasks are explicitly marked
- **Architectural Integrity**: All work respects Clean Architecture and SOLID principles
- **Model Agnosticism**: No direct LLM dependencies in domain or application layers
- **Desktop-First**: Native application with embedded terminal and file system access

### 🎨 UI/UX Vision

Maestro combines the best of three paradigms:
- **n8n**: Visual node-based workflow editor with drag-and-drop
- **Claude Code**: Integrated terminal for CLI-first interactions and log viewing
- **VS Code**: IDE-style layout with panels, sidebar explorer, and resizable areas

### 🧱 Block Architecture Vision

Maestro uses a **recursive block system** where:
- **Blocks are composable**: A block can contain other blocks (agents contain prompts, tasks contain agents, etc.)
- **Blocks are reusable**: Any block can be referenced and reused across workflows
- **Drill-down navigation**: Double-click a composite block to enter its internal pipeline
- **Type extensibility**: Core block types are hardcoded, with extension mechanism for custom types

**Core Block Types**:
| Type | Atomic | Description |
|------|--------|-------------|
| `workflow` | No | Top-level container, contains blocks and connections |
| `agent` | No | AI agent, can contain prompts, instructions, sub-agents |
| `task` | No | Task with validation criteria, contains agents and validators |
| `prompt` | Yes | Reusable prompt template |
| `instruction` | Yes | Instruction file reference |
| `tool` | Yes | Executable tool (bash, git, file ops) |
| `decision` | Yes | Conditional branching |
| `validator` | Yes | Output validation |
| `trigger` | Yes | Workflow trigger (manual, webhook, schedule) |

---

## � Frontend-Backend Isolation Architecture

> **CRITICAL**: The frontend MUST be fully testable and functional without a running backend.

### Architectural Principles

1. **Complete Decoupling**: Frontend and backend are completely independent applications
2. **Interface-Based Communication**: All backend calls go through service interfaces
3. **Mock-First Development**: Frontend development uses mock backends by default
4. **Clean Architecture Compliance**: Frontend follows the same clean architecture principles as backend
5. **Seamless Switching**: A single environment variable switches between mock and real backends

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
│              (UI Layer - No Business Logic)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Zustand Stores                            │
│              (State Management Layer)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Service Interfaces                            │
│    (IWorkflowService, IModelService, IExecutionService)      │
└─────────────────────────────────────────────────────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────────┐
│   Mock Backends      │          │    Real API Backends      │
│  (Development/Test)  │          │    (Production)           │
└──────────────────────┘          └──────────────────────────┘
```

### Environment Configuration

The backend mode is controlled by a `maestro.config.json` file at the **project root** (same level as `backend/` and `frontend/`):

```json
// maestro.config.json (at project root)
{
  "$schema": "./schemas/maestro-config.schema.json",
  "environment": "development",
  "frontend": {
    "useMockBackend": true,
    "apiBaseUrl": "https://localhost:5001",
    "mockLatency": {
      "min": 100,
      "max": 300
    }
  },
  "backend": {
    "llmProvider": "openai",
    "enableSwagger": true
  }
}
```

| Property | Values | Description |
|----------|--------|-------------|
| `environment` | `development` / `production` / `test` | Current environment mode |
| `frontend.useMockBackend` | `true` / `false` | When `true`, uses mock services with simulated data |
| `frontend.apiBaseUrl` | URL | Backend API URL (used when mock is disabled) |
| `frontend.mockLatency` | `{min, max}` | Simulated network latency range in ms |

**Benefits of JSON config over .env:**
- Structured data with nesting support
- JSON Schema validation for IDE autocompletion
- Shared between frontend and backend
- Consistent with .NET's `appsettings.json` pattern
- Can include comments (JSON5) or use YAML alternative

### Service Interface Pattern

Every API service MUST implement an interface:

```typescript
// services/interfaces/IModelService.ts
export interface IModelService {
  getAll(): Promise<Model[]>;
  getById(id: string): Promise<Model>;
  create(model: CreateModelDto): Promise<Model>;
  update(id: string, updates: Partial<Model>): Promise<Model>;
  delete(id: string): Promise<void>;
  testConnection(id: string): Promise<ConnectionTestResult>;
}

// services/modelService.ts - Factory that returns mock or real
import { getMockModelService } from './mock/mockModelService';
import { getRealModelService } from './real/realModelService';

export const modelService: IModelService = 
  import.meta.env.VITE_USE_MOCK_BACKEND === 'true'
    ? getMockModelService()
    : getRealModelService();
```

### Mock Backend Requirements

Mock backends MUST:
- ✅ Implement the same interface as real backends
- ✅ Return realistic data with proper delays (simulate network latency)
- ✅ Handle error cases (404, 500, validation errors)
- ✅ Persist state in memory or localStorage for the session
- ✅ Be fully covered by unit tests
- ✅ Support all CRUD operations with realistic behavior

### Testing Strategy

| Test Type | Backend | Purpose |
|-----------|---------|---------|
| Unit Tests | Mock | Test components, stores, and services in isolation |
| Integration Tests | Mock | Test component + store + service integration |
| E2E Tests | Real (optional) | Validate full stack integration |

### File Structure

```
# Project Root
maestro.config.json           # Shared configuration (mock/real, API URL)
maestro.config.local.json     # Local overrides (gitignored)
schemas/
└── maestro-config.schema.json  # JSON Schema for IDE validation

# Frontend Services
frontend/src/
├── config/
│   ├── config.ts             # Config loader (reads maestro.config.json)
│   └── config.types.ts       # TypeScript types for config
├── services/
│   ├── interfaces/
│   │   ├── IModelService.ts
│   │   ├── IWorkflowService.ts
│   │   └── IExecutionService.ts
│   ├── mock/
│   │   ├── mockModelService.ts
│   │   ├── mockWorkflowService.ts
│   │   ├── mockExecutionService.ts
│   │   └── mockData/
│   │       ├── models.ts
│   │       ├── workflows.ts
│   │       └── executions.ts
│   ├── real/
│   │   ├── realModelService.ts
│   │   ├── realWorkflowService.ts
│   │   └── realExecutionService.ts
│   ├── modelService.ts       # Factory export
│   ├── workflowService.ts    # Factory export
│   └── executionService.ts   # Factory export
```

### Benefits

1. **Parallel Development**: Frontend team doesn't wait for backend APIs
2. **Reliable Testing**: Tests run without external dependencies
3. **Fast Development**: No backend startup required for UI work
4. **Contract-First**: Interfaces define the contract before implementation
5. **Easy Debugging**: Isolate issues to frontend or backend
6. **CI/CD Friendly**: Tests run in any environment without backend

---

## �📊 Development Phases Overview

```
Phase 1:  Foundation (Backend Core)             [█████████░] 90%
Phase 2:  Domain & Application Layer            [░░░░░░░░░░]  0%
Phase 3:  Infrastructure Layer                  [░░░░░░░░░░]  0%
Phase 4a: Frontend Foundation                   [██████████] 100%
Phase 4b: Block Architecture & Types            [██████████] 100%
Phase 4c: IDE Layout & Panel System             [██████████] 100%
Phase 4d: Canvas Foundation (React Flow)        [██████████] 100%
Phase 4e: Models Panel & Registry               [██████████] 100%
Phase 4f: Frontend Refactor & Foundry           [████░░░░░░] 40%
Phase 4g: Block Editing, CRUD & UX              [██████████] 100%
Phase 4h: Canvas & Node Functionality           [░░░░░░░░░░]  0%
Phase 4i: Breadcrumb Navigation Fix             [░░░░░░░░░░]  0%
Phase 5:  Workflow Engine & Execution           [░░░░░░░░░░]  0%
Phase 6:  Agent Implementations                 [░░░░░░░░░░]  0%
Phase 7:  Monitoring & Observability            [░░░░░░░░░░]  0%
Phase 8:  Tool Executors & Integration          [░░░░░░░░░░]  0%
Phase 9:  Terminal & CLI Integration            [░░░░░░░░░░]  0%
Phase 10: End-to-End Integration & Testing      [░░░░░░░░░░]  0%
Phase 11: Documentation & Examples              [█████░░░░░] 50%
Phase 12: MVP Release Preparation               [░░░░░░░░░░]  0%
Phase 13: Auto-Optimization & Benchmarking      [░░░░░░░░░░]  0%
```

---

## 🔷 Phase 1: Foundation (Backend Core)

**Goal**: Establish project structure, build system, and basic infrastructure.

**Duration**: 1-2 weeks  
**Team**: Backend (1-2 developers)  
**Dependencies**: None

### Tasks

- [x] Create solution structure (`Maestro.sln`)
- [x] Set up project hierarchy (Domain, Application, Infrastructure, Api, Agents)
- [x] Configure .editorconfig and code style rules
- [x] Set up NuGet package management (Central Package Management)
- [x] Create test projects structure
- [x] Configure CI/CD pipeline basics
- [ ] Add Roslyn analyzers for code quality
- [ ] Set up code coverage tooling (Coverlet)
- [ ] Create initial README and documentation structure
- [ ] Set up dependency injection foundation in API project

**Outputs**:
- ✅ Backend project structure
- ✅ Build and test infrastructure
- ⏳ Documentation framework

**Parallelization**: Can be done by 1-2 developers. Once complete, unblocks all backend work.

---

## 🔷 Phase 2: Domain & Application Layer

**Goal**: Implement core domain entities, value objects, and application use cases.

**Duration**: 3-4 weeks  
**Team**: Backend (2-3 developers)  
**Dependencies**: Phase 1 complete

### Tasks - Domain Layer

#### 2.1 Core Entities
- [ ] Implement `Workflow` entity
  - [ ] Add properties (Id, Name, Description, Version, Nodes, Connections)
  - [ ] Add behavior (AddNode, RemoveNode, CanExecute, Validate)
  - [ ] Implement domain events (WorkflowCreated, NodeAdded, NodeRemoved)
  - [ ] Add unit tests (Workflow entity tests)

- [ ] Implement `Node` abstract base class
  - [ ] Define node types enum (Agent, Tool, Decision, Validator, Trigger)
  - [ ] Add common properties (Id, Type, Configuration, Position)
  - [ ] Add abstract methods (Execute, Validate)
  - [ ] Add unit tests

- [ ] Implement specific node types
  - [ ] `AgentNode` - AI agent execution node
  - [ ] `ToolNode` - Tool/script execution node
  - [ ] `DecisionNode` - Conditional branching
  - [ ] `ValidatorNode` - Output validation
  - [ ] `TriggerNode` - Workflow trigger
  - [ ] Unit tests for each node type

- [ ] Implement `Agent` interface and base class
  - [ ] Define `IAgent` interface
  - [ ] Create `AgentBase` abstract class
  - [ ] Add agent types enum (Planner, Coder, Tester, Reviewer, Debugger)
  - [ ] Define agent input/output contracts

- [ ] Implement `Tool` interface and base class
  - [ ] Define `ITool` interface
  - [ ] Create `ToolBase` abstract class
  - [ ] Add tool categories enum (Bash, Git, FileSystem, Language)
  - [ ] Define tool permissions model

- [ ] Implement `ExecutionContext` entity
  - [ ] Add properties (WorkflowInstanceId, NodeStates, Outputs, Variables, Metadata)
  - [ ] Add state management methods
  - [ ] Add unit tests

#### 2.2 Value Objects
- [ ] Implement `WorkflowId` value object
  - [ ] Add Guid-based identity
  - [ ] Implement equality comparison
  - [ ] Add factory methods
  - [ ] Add unit tests

- [ ] Implement `NodeId` value object
  - [ ] Similar to WorkflowId
  - [ ] Add unit tests

- [ ] Implement `NodeStatus` value object
  - [ ] Define states (Pending, Running, Completed, Failed, Skipped)
  - [ ] Add state transition validation
  - [ ] Add unit tests

- [ ] Implement `AgentType` value object
  - [ ] Define agent types with metadata
  - [ ] Add unit tests

#### 2.3 Domain Services
- [ ] Implement `WorkflowValidator` service
  - [ ] Validate workflow structure
  - [ ] Check for cycles in node connections
  - [ ] Validate node connections (type compatibility)
  - [ ] Add comprehensive unit tests

- [ ] Implement `NodeConnectionRules` service
  - [ ] Define valid connection types
  - [ ] Validate input/output compatibility
  - [ ] Add unit tests

#### 2.4 Domain Exceptions
- [ ] Create `DomainException` base class
- [ ] Create `WorkflowException` (InvalidWorkflowException, WorkflowNotFoundException)
- [ ] Create `NodeExecutionException`
- [ ] Create `ValidationException`

### Tasks - Application Layer

#### 2.5 Interfaces (Abstractions)
- [ ] Define `IWorkflowRepository` interface
  - [ ] Methods: GetById, GetAll, Add, Update, Delete
  - [ ] Async methods with CancellationToken

- [ ] Define `ILLMGateway` interface ⚠️ **CRITICAL**
  - [ ] Methods: SendAsync, StreamAsync
  - [ ] Define LLMRequest/LLMResponse models
  - [ ] Support for tools and function calling
  - [ ] **No direct model SDK dependencies**

- [ ] Define `IGitService` interface
  - [ ] Methods: Clone, Commit, Push, CreatePR, GetStatus

- [ ] Define `IFileSystemService` interface
  - [ ] Methods: ReadFile, WriteFile, ListFiles (with sandboxing)

- [ ] Define `IExecutionMonitor` interface
  - [ ] Methods: StartExecution, UpdateProgress, CompleteExecution
  - [ ] Event publishing for real-time updates

- [ ] Define `IToolExecutor` interface
  - [ ] Method: ExecuteAsync with tool-specific parameters

- [ ] Define `IArtifactScanner` interface
  - [ ] Methods: ScanDirectory, IndexArtifacts, ValidateArtifact

- [ ] Define `IFileWatcher` interface
  - [ ] Methods: WatchDirectory, OnFileChanged event

#### 2.6 DTOs (Data Transfer Objects)
- [ ] Create `WorkflowDto`
  - [ ] Include all serializable workflow properties
  - [ ] Add JSON serialization attributes

- [ ] Create `NodeDto` (base and derived types)
  - [ ] Base DTO with common properties
  - [ ] Derived DTOs for specific node types

- [ ] Create `ExecutionStatusDto`
  - [ ] Workflow execution state
  - [ ] Node statuses
  - [ ] Progress information

- [ ] Create `AgentDto`
- [ ] Create `ToolDto`
- [ ] Create `ExecutionContextDto`

#### 2.7 Commands (CQRS - Write Operations)
- [ ] Implement `CreateWorkflowCommand` and handler
  - [ ] Validate input
  - [ ] Create workflow entity
  - [ ] Persist via repository
  - [ ] Publish domain event
  - [ ] Add unit tests with mocked repository

- [ ] Implement `UpdateWorkflowCommand` and handler
  - [ ] Load existing workflow
  - [ ] Apply updates
  - [ ] Validate
  - [ ] Persist
  - [ ] Add unit tests

- [ ] Implement `DeleteWorkflowCommand` and handler
  - [ ] Add unit tests

- [ ] Implement `ExecuteWorkflowCommand` and handler ⚠️ **CRITICAL**
  - [ ] Load workflow
  - [ ] Validate execution readiness
  - [ ] Initialize execution context
  - [ ] Delegate to execution engine
  - [ ] Add unit tests

- [ ] Implement `PauseExecutionCommand` and handler
  - [ ] Add unit tests

- [ ] Implement `ResumeExecutionCommand` and handler
  - [ ] Add unit tests

- [ ] Implement `CancelExecutionCommand` and handler
  - [ ] Add unit tests

#### 2.8 Queries (CQRS - Read Operations)
- [ ] Implement `GetWorkflowByIdQuery` and handler
  - [ ] Load from repository
  - [ ] Map to DTO
  - [ ] Add unit tests

- [ ] Implement `GetAllWorkflowsQuery` and handler
  - [ ] Add unit tests

- [ ] Implement `GetExecutionStatusQuery` and handler
  - [ ] Add unit tests

- [ ] Implement `GetExecutionHistoryQuery` and handler
  - [ ] Add unit tests

#### 2.9 Application Services
- [ ] Implement `WorkflowOrchestrator` service
  - [ ] Coordinate workflow execution
  - [ ] Manage execution context
  - [ ] Handle state transitions
  - [ ] Add unit tests with mocked dependencies

- [ ] Implement `ExecutionEngine` service ⚠️ **CRITICAL**
  - [ ] Execute workflow nodes in order
  - [ ] Handle dependencies and connections
  - [ ] Pass outputs between nodes
  - [ ] Handle errors and retries
  - [ ] Add comprehensive unit tests

- [ ] Implement `NodeExecutor` service
  - [ ] Execute individual nodes
  - [ ] Delegate to agents or tools
  - [ ] Collect and format outputs
  - [ ] Add unit tests

#### 2.10 Mappings
- [ ] Set up AutoMapper profiles
  - [ ] Workflow entity <-> WorkflowDto
  - [ ] Node entities <-> NodeDtos
  - [ ] Add mapping tests

**Outputs**:
- ✅ Complete domain model with business logic
- ✅ Application layer with use cases and abstractions
- ✅ Comprehensive unit tests (80%+ coverage)

**Parallelization**:
- Domain entities can be developed in parallel (Workflow, Node, Agent, Tool)
- Value objects can be developed in parallel
- Commands and Queries can be split among developers
- **Recommended**: 2-3 developers, each owning specific entities/use cases

---

## 🔷 Phase 3: Infrastructure Layer

**Goal**: Implement infrastructure adapters for LLM, persistence, Git, and file system operations.

**Duration**: 2-3 weeks  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 2 complete

### Tasks

#### 3.1 LLM Gateway Implementation
- [ ] Implement `ILLMGateway` abstraction layer
- [ ] Create `OpenAIAdapter` implementation
- [ ] Create `OllamaAdapter` implementation (local models)
- [ ] Create `AnthropicAdapter` implementation
- [ ] Implement streaming support for all adapters
- [ ] Add retry logic and error handling
- [ ] Add unit tests with mocked HTTP clients
- [ ] Add integration tests (optional, requires API keys)

#### 3.2 Persistence Layer
- [ ] Implement `JsonWorkflowRepository` (file-based storage)
- [ ] Implement workflow versioning via Git
- [ ] Create `BlockRepository` for block management
- [ ] Add caching layer for frequently accessed blocks
- [ ] Add unit tests

#### 3.3 Git Service
- [ ] Implement `IGitService` with LibGit2Sharp
- [ ] Clone, commit, push, branch operations
- [ ] PR creation integration (GitHub API)
- [ ] Add unit tests

#### 3.4 File System Service
- [ ] Implement `IFileSystemService` with sandboxing
- [ ] File read/write with path validation
- [ ] Directory operations
- [ ] Add unit tests

**Outputs**:
- ✅ Working LLM Gateway with multiple providers
- ✅ File-based workflow persistence with Git versioning
- ✅ Secure file system operations

---

## 🔷 Phase 4a: Frontend Foundation ✅ COMPLETE

**Goal**: Establish React project structure, routing, state management, and base components.

**Duration**: 1-2 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: None

### Tasks (Completed)

- [x] Set up Vite + React + TypeScript project
- [x] Configure ESLint, Prettier, Vitest
- [x] Set up React Router with lazy loading
- [x] Implement Zustand stores (workflow, execution)
- [x] Create design tokens and CSS variables
- [x] Create base components (Button, Input, Modal, LoadingSpinner)
- [x] Create basic layout (RootLayout, Sidebar, TopBar)
- [x] Set up API service layer with Axios
- [x] Set up SignalR service for real-time updates
- [x] Create initial page structure (Home, Workflows, History, Editor)
- [x] Define initial TypeScript types (Workflow, Node, Execution)

**Outputs**:
- ✅ Working React application with routing
- ✅ State management infrastructure
- ✅ Base component library
- ✅ API integration layer

---

## 🔷 Phase 4b: Block Architecture & Types

**Goal**: Implement the recursive block type system that enables composable, reusable blocks with drill-down navigation.

**Duration**: 1-2 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: Phase 4a complete

### Tasks

#### 4b.1 Block Type System
- [ ] Create `Block` base interface with recursive structure
  ```typescript
  interface Block {
    id: string;
    name: string;
    blockType: BlockType;
    isAtomic: boolean;
    children?: Block[];
    parentId?: string;
    config: BlockConfig;
    inputs: Port[];
    outputs: Port[];
    position: Position;
    metadata: BlockMetadata;
  }
  ```
- [ ] Define `BlockType` enum with core types
- [ ] Create type-specific config interfaces (AgentBlockConfig, ToolBlockConfig, etc.)
- [ ] Implement `BlockTypeRegistry` for type metadata and validation
- [ ] Add block type icons and color schemes
- [ ] Add unit tests for type system

#### 4b.2 Block Type Registry
- [ ] Create registry singleton with core block types
- [ ] Implement `getBlockTypeInfo(type)` - returns metadata, icon, color, allowed children
- [ ] Implement `canContain(parentType, childType)` - validates nesting rules
- [ ] Implement `getDefaultConfig(type)` - returns default configuration
- [ ] Add validation rules per block type
- [ ] Add unit tests

#### 4b.3 Block Store (Zustand)
- [ ] Create `useBlockStore` with hierarchical state
- [ ] Implement `addBlock(parentId, block)` - adds block to parent
- [ ] Implement `removeBlock(id)` - removes block and children
- [ ] Implement `moveBlock(id, newParentId)` - moves block between containers
- [ ] Implement `updateBlock(id, updates)` - partial updates
- [ ] Implement `getBlockPath(id)` - returns ancestor chain for breadcrumb
- [ ] Implement `getBlockChildren(id)` - returns direct children
- [ ] Add undo/redo support with history stack
- [ ] Add persistence to localStorage
- [ ] Add unit tests

#### 4b.4 Navigation Context
- [ ] Create `useNavigationContext` hook
- [ ] Track current view path (e.g., `/workflow-1/task-2/agent-3`)
- [ ] Implement `navigateInto(blockId)` - drill down into composite block
- [ ] Implement `navigateUp()` - go back to parent
- [ ] Implement `navigateTo(path)` - direct navigation
- [ ] Sync navigation with URL (optional query params)
- [ ] Add unit tests

#### 4b.5 Block Explorer (Sidebar)
- [ ] Refactor Sidebar to display block hierarchy tree
- [ ] Implement recursive tree rendering with expand/collapse
- [ ] Show block type icons and status indicators
- [ ] Implement drag-and-drop reordering within tree
- [ ] Highlight current navigation path
- [ ] Add context menu (rename, duplicate, delete)
- [ ] Fix expand/collapse arrow icons (replace Unicode with SVG)
- [ ] Add unit tests

#### 4b.6 Breadcrumb Navigation
- [ ] Create `Breadcrumb` component
- [ ] Display current path: `Workflow > Task > Agent`
- [ ] Each segment is clickable to navigate up
- [ ] Show block type icon per segment
- [ ] Responsive design (truncate middle on overflow)
- [ ] Add unit tests

**Outputs**:
- ✅ Type-safe block system with validation
- ✅ Hierarchical block store with undo/redo
- ✅ Drill-down navigation between block levels
- ✅ Block explorer sidebar with tree view
- ✅ Breadcrumb navigation component

**Key Design Decisions**:
1. **Hardcoded core types**: `workflow`, `agent`, `task`, `prompt`, `instruction`, `tool`, `decision`, `validator`, `trigger`
2. **Extension mechanism**: Registry allows adding custom types in future
3. **Nesting rules**: Defined per type (e.g., `task` can contain `agent`, `validator`; `agent` can contain `prompt`, `instruction`)

---

## 🔷 Phase 4c: IDE Layout & Panel System

**Goal**: Transform the layout into an IDE-style interface with resizable panels, preparing space for terminal integration.

**Duration**: 1 week  
**Team**: Frontend (1 developer)  
**Dependencies**: Phase 4b complete

### Tasks

#### 4c.1 Panel System
- [ ] Install and configure `react-resizable-panels` or similar
- [ ] Create `PanelLayout` component with named regions
- [ ] Implement resizable dividers between panels
- [ ] Persist panel sizes to localStorage
- [ ] Add collapse/expand functionality per panel
- [ ] Add unit tests

#### 4c.2 IDE Layout Structure
- [ ] Implement main layout:
  ```
  ┌─────────┬─────────────────────────┬──────────────┐
  │         │       Top Bar           │              │
  │ Sidebar ├─────────────────────────┤  Properties  │
  │ (Block  │       Main Canvas       │    Panel     │
  │Explorer)│                         │              │
  │         ├─────────────────────────┴──────────────┤
  │         │       Bottom Panel (Terminal)          │
  └─────────┴────────────────────────────────────────┘
  ```
- [ ] Sidebar: Block explorer tree (from 4b.5)
- [ ] Main Canvas: Block editor area (placeholder for 4d)
- [ ] Properties Panel: Block configuration form
- [ ] Bottom Panel: Terminal/logs area (placeholder for Phase 9)
- [ ] Add keyboard shortcuts for panel focus (Ctrl+1, Ctrl+2, etc.)

#### 4c.3 Properties Panel
- [ ] Create `PropertiesPanel` component
- [ ] Display selected block configuration
- [ ] Generate form fields based on block type schema
- [ ] Implement form validation
- [ ] Live update block on field change
- [ ] Show block metadata (created, updated, type info)
- [ ] Add unit tests

#### 4c.4 Bottom Panel Placeholder
- [ ] Create `BottomPanel` component with tabs
- [ ] Tab 1: "Terminal" (placeholder, shows "Terminal coming in Phase 9")
- [ ] Tab 2: "Output" (execution output placeholder)
- [ ] Tab 3: "Problems" (validation errors)
- [ ] Collapsible by default, opens on execution or error
- [ ] Add unit tests

#### 4c.5 Theme Support
- [ ] Implement theme context (light/dark)
- [ ] Add theme toggle in TopBar
- [ ] Update all CSS to use theme-aware variables
- [ ] Persist theme preference
- [ ] Add unit tests

**Outputs**:
- ✅ IDE-style resizable panel layout
- ✅ Properties panel for block configuration
- ✅ Bottom panel prepared for terminal
- ✅ Light/dark theme support

---

## 🔷 Phase 4d: Canvas Foundation (React Flow)

**Goal**: Implement the visual canvas for block editing using React Flow, with support for composite blocks and connections.

**Duration**: 2 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: Phase 4b, 4c complete

### Tasks

#### 4d.1 React Flow Setup
- [ ] Install and configure `reactflow`
- [ ] Create `BlockCanvas` component wrapper
- [ ] Configure canvas controls (zoom, pan, minimap)
- [ ] Set up custom node types for each block type
- [ ] Set up custom edge types for connections
- [ ] Add unit tests

#### 4d.2 Custom Block Nodes
- [ ] Create `BaseBlockNode` component
- [ ] Create type-specific node renderers:
  - [ ] `AgentBlockNode` - shows agent type, model info
  - [ ] `TaskBlockNode` - shows task name, validation status
  - [ ] `ToolBlockNode` - shows tool type, command preview
  - [ ] `DecisionBlockNode` - shows condition
  - [ ] `ValidatorBlockNode` - shows validation type
  - [ ] `PromptBlockNode` - shows prompt preview
  - [ ] `TriggerBlockNode` - shows trigger type
- [ ] Show composite indicator (badge) for non-atomic blocks
- [ ] Show execution status indicator
- [ ] Add double-click handler to drill into composite blocks
- [ ] Add unit tests

#### 4d.3 Block Palette
- [ ] Create `BlockPalette` component
- [ ] Group blocks by category (Agents, Tools, Flow, etc.)
- [ ] Implement drag-from-palette to canvas
- [ ] Show block type info on hover
- [ ] Filter/search blocks
- [ ] Add unit tests

#### 4d.4 Connection System
- [ ] Implement port-based connections
- [ ] Validate connections based on port types
- [ ] Show connection validation feedback
- [ ] Implement connection labels (optional)
- [ ] Add conditional connection styling
- [ ] Add unit tests

#### 4d.5 Canvas-Store Sync
- [ ] Sync React Flow state with BlockStore
- [ ] Handle node position updates
- [ ] Handle connection add/remove
- [ ] Handle node selection → update PropertiesPanel
- [ ] Implement bulk operations (select all, delete selected)
- [ ] Add unit tests

#### 4d.6 Context Menus
- [ ] Create canvas context menu (add block, paste)
- [ ] Create block context menu (edit, duplicate, delete, drill-in)
- [ ] Create connection context menu (delete, add label)
- [ ] Add unit tests

**Outputs**:
- ✅ Visual block canvas with React Flow
- ✅ Custom block node components per type
- ✅ Drag-and-drop from palette
- ✅ Connection system with validation
- ✅ Context menus for quick actions

---

## 🔷 Phase 4e: Models Panel & Registry

**Goal**: Implement a centralized model management panel where users can configure, compare, and assign AI models to agent blocks with rich metadata for future auto-optimization.

**Duration**: 1-2 weeks  
**Team**: Frontend (1 developer) + Backend (1 developer)  
**Dependencies**: Phase 4a complete, Phase 3 (LLM Gateway) in progress

### Tasks

#### 4e.1 Model Types & Interfaces
- [ ] Create `model.types.ts` with `Model` interface:
  ```typescript
  interface Model {
    id: string;
    provider: ModelProvider;
    displayName: string;
    capabilities: ModelCapability[];
    contextWindow: number;
    costPerInputToken: number;
    costPerOutputToken: number;
    speedRating: number; // 1-10
    qualityRatings: Record<TaskType, number>; // per-task quality
    strengths: string[];
    weaknesses: string[];
    maxOutputTokens: number;
    supportsStreaming: boolean;
    supportsToolCalls: boolean;
    supportsVision: boolean;
    isLocal: boolean;
    isAvailable: boolean;
    apiEndpoint?: string;
  }
  ```
- [ ] Define `ModelProvider` enum (OpenAI, Anthropic, Ollama, Azure, Google, etc.)
- [ ] Define `ModelCapability` enum (code-generation, reasoning, vision, tool-use, etc.)
- [ ] Define `TaskType` for quality ratings (code-generation, summarization, analysis, etc.)
- [ ] Add unit tests for type guards and utilities

#### 4e.2 Model Store (Zustand)
- [ ] Create `useModelStore` with state:
  - `models: Map<string, Model>`
  - `selectedModelId: string | null`
  - `defaultModelId: string`
- [ ] Implement CRUD actions:
  - `addModel(model: Model)`
  - `updateModel(id: string, updates: Partial<Model>)`
  - `removeModel(id: string)`
  - `setDefaultModel(id: string)`
- [ ] Implement query helpers:
  - `getModelsByProvider(provider: ModelProvider)`
  - `getModelsByCapability(capability: ModelCapability)`
  - `getAvailableModels()`
  - `getBestModelForTask(taskType: TaskType, constraints?: ModelConstraints)`
- [ ] Persist to localStorage
- [ ] Add unit tests

#### 4e.3 Models Panel UI
- [ ] Create `ModelsPanel` component for sidebar/modal
- [ ] Implement model list view with:
  - [ ] Provider icon and model name
  - [ ] Capability badges
  - [ ] Cost indicator ($ / $$ / $$$)
  - [ ] Speed/quality rating display
  - [ ] Availability status indicator
- [ ] Implement model detail view:
  - [ ] Full capability list
  - [ ] Strengths/weaknesses display
  - [ ] Cost breakdown (input/output tokens)
  - [ ] Context window size
  - [ ] Quality ratings per task type (radar chart or bar chart)
- [ ] Add unit tests

#### 4e.4 Model Configuration Form
- [ ] Create `ModelConfigForm` component
- [ ] Form fields for all model properties
- [ ] Validation rules (required fields, valid ranges)
- [ ] Test connection button (verify API key works)
- [ ] Import from provider (auto-detect model capabilities)
- [ ] Add unit tests

#### 4e.5 Model Comparison View
- [ ] Create `ModelComparisonView` component
- [ ] Side-by-side comparison of 2-4 models
- [ ] Compare: capabilities, cost, speed, quality ratings
- [ ] Visual diff highlighting (better/worse indicators)
- [ ] Export comparison as markdown/image
- [ ] Add unit tests

#### 4e.6 Model Assignment in Agent Blocks
- [ ] Add `modelId` field to `AgentBlockConfig`
- [ ] Add `fallbackModelId` for automatic fallback
- [ ] Create `ModelSelector` dropdown component
- [ ] Show model info tooltip on hover
- [ ] Validate model capabilities match agent requirements
- [ ] Add unit tests

#### 4e.7 Model Presets & Defaults
- [ ] Create preset model configurations for common providers:
  - [ ] OpenAI: GPT-4o, GPT-4o-mini, GPT-4-turbo, o1, o1-mini
  - [ ] Anthropic: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
  - [ ] Ollama: Llama 3, CodeLlama, Mistral, Mixtral
  - [ ] Google: Gemini Pro, Gemini Flash
  - [ ] Azure OpenAI: Mapped GPT models
- [ ] Import presets on first launch
- [ ] Allow customization of presets
- [ ] Add unit tests

#### 4e.8 Backend Model Registry API
- [ ] Create `ModelRegistryController` (or add to existing controller)
- [ ] Endpoints:
  - [ ] `GET /api/models` - list all configured models
  - [ ] `GET /api/models/{id}` - get model details
  - [ ] `POST /api/models` - add new model
  - [ ] `PUT /api/models/{id}` - update model
  - [ ] `DELETE /api/models/{id}` - remove model
  - [ ] `POST /api/models/{id}/test` - test model connectivity
- [ ] Store model configurations in JSON (like workflows)
- [ ] Validate model configuration on save
- [ ] Add integration tests

**Outputs**:
- ✅ Model type system with rich metadata
- ✅ Model store with CRUD and query capabilities
- ✅ Models Panel UI for configuration and comparison
- ✅ Model assignment in agent blocks
- ✅ Preset configurations for common providers
- ✅ Backend API for model registry

**Design Decisions**:
1. **Model as resource**: Models are first-class resources, not just configuration strings
2. **Rich metadata**: Enables intelligent model selection and future auto-optimization
3. **Provider abstraction**: UI doesn't care about provider implementation details
4. **Local-first storage**: Model configs stored locally, synced optionally

---

## 🔷 Phase 4f: Frontend Refactor & Foundry Page

**Goal**: Consolidate frontend architecture by introducing the Foundry Page — a unified interface for creating and managing all block types. Fix bugs, complete missing CRUD functionality, and prepare UI for self-improving workflows.

**Duration**: 2-3 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: Phase 4e complete  
**Issue**: [docs/issues/phase-4f-frontend-refactor-foundry.md](docs/issues/phase-4f-frontend-refactor-foundry.md)

### Tasks

#### 4f.1 Bug Fixes & Technical Debt
- [x] Add ROADMAP update instructions to code conventions
- [x] Fix expand/collapse arrows in BlockExplorer (use SVG icons)
- [ ] Consolidate duplicate type definitions across files
- [ ] Add proper error boundaries to all pages
- [ ] Implement loading skeletons for async components
- [ ] Add accessibility audit and fixes (ARIA labels, keyboard nav)

#### 4f.2 Foundry Page Foundation
- [x] Create `FoundryPage.tsx` with layout structure
- [x] Create `FoundrySidebar.tsx` with category filters
- [x] Create `FoundrySearchBar.tsx` with type/capability filters
- [x] Create `BlockGrid.tsx` for displaying blocks
- [x] Create `BlockCard.tsx` component with hover actions
- [x] Implement responsive grid (CSS Grid with auto-fit)
- [ ] Add keyboard navigation (arrow keys, enter to select)
- [ ] Add unit tests

#### 4f.3 Block Store Enhancements
- [x] Add `getAllBlocks()` method to blockStore
- [x] Add `getBlocksByType(type: BlockType)` filter
- [x] Add `getBlocksByCapability(cap: string)` filter
- [x] Add `searchBlocks(query: string)` with fuzzy matching
- [x] Add `tags: string[]` field to Block interface
- [x] Add `status: 'draft' | 'active' | 'archived'` field
- [x] Implement `duplicateBlock(id)` action
- [x] Implement `exportBlock(id)` / `importBlock(json)`
- [ ] Add unit tests for all new methods

#### 4f.4 Block Creation Wizard
- [ ] Create `CreateBlockWizard.tsx` modal component
- [ ] Step 1: Select block type (visual cards)
- [ ] Step 2: Basic info (name, description, tags)
- [ ] Step 3: Type-specific configuration
- [ ] Step 4: Preview and confirm
- [ ] Implement template presets per type
- [ ] Add validation at each step
- [ ] Add unit tests

#### 4f.5 Block Detail/Edit Views
- [ ] Create `BlockDetailView.tsx` for viewing block info
- [ ] Implement inline editing for atomic blocks
- [ ] Navigate to Canvas for composite blocks on "Edit Contents"
- [ ] Show block usage (where is this block referenced?)
- [ ] Add unit tests

#### 4f.6 Missing CRUD Functionality
- [ ] **Create**: Via Foundry wizard OR drag template to canvas
- [ ] **Read**: Block detail view, block card hover info
- [ ] **Update**: Inline edit for atomics, Canvas for composites
- [ ] **Delete**: With confirmation, check for usages first
- [ ] Implement `blockService` interface with mock backend
- [ ] Add unit tests

#### 4f.7 Routing Refactor
- [x] Update `router.tsx` with new routes:
  - `/foundry` - FoundryPage (all blocks)
  - `/foundry/:blockType` - FoundryPage filtered
  - `/foundry/:blockId/edit` - Block edit
  - `/canvas/:blockId` - Canvas for composite blocks
- [ ] Add redirects from old routes
- [ ] Update navigation links in Sidebar
- [ ] Add breadcrumbs for deep navigation
- [ ] Add unit tests

#### 4f.8 Self-Improvement Preparation
- [ ] Create `IBlockDiscoveryService` interface
- [ ] Create `mockBlockDiscoveryService` for frontend use
- [ ] Implement block discovery by type/capability
- [ ] Expose discovery methods in stores
- [ ] Document API for agent prompt usage
- [ ] Add unit tests

#### 4f.9 Navigation & UX Improvements
- [ ] Add global search (Cmd+K / Ctrl+K) for blocks, workflows, models
- [ ] Add recent items list in sidebar
- [ ] Add favorites/pinned blocks
- [ ] Add "Create New" quick action menu in TopBar
- [ ] Add keyboard shortcuts panel (? key)
- [ ] Add unit tests

#### 4f.10 Documentation
- [ ] Update frontend/README.md with Foundry documentation
- [ ] Add example blocks for each type
- [ ] Create "Getting Started" workflow example
- [ ] Document block schema and configuration options

**Outputs**:
- ✅ Unified Foundry page for all block management
- ✅ Complete CRUD for blocks
- ✅ Block discovery API for self-improvement
- ✅ Improved navigation and UX
- ✅ Comprehensive documentation

---

## 🔷 Phase 4g: Block Editing, CRUD & UX Refinements ✅ COMPLETE

**Goal**: Complete the Foundry ecosystem with type-specific block editors, Block Creation Wizard, full CRUD service layer, and critical UX improvements (global search, favorites, keyboard shortcuts).

**Duration**: 2-3 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: Phase 4f complete  
**Status**: ✅ **COMPLETE** (2026-01-12)  
**Issue**: [docs/issues/phase-4g-block-editing-crud.md](docs/issues/phase-4g-block-editing-crud.md)

### Tasks

#### 4g.1 Bug Fixes ✅
- [x] Replace emoji icons with `BlockIcon` in FoundrySidebar
- [x] Make BlockExplorer conditional (only visible on Canvas/composite edit)
- [x] Implement BlockEditPage routing and component
- [x] Add unit tests for fixes

#### 4g.2 Block Edit Page & Type-Specific Editors ✅
- [x] Create `BlockEditPage.tsx` route handler
- [x] Create `BaseBlockEditor.tsx` with shared layout
- [x] Create `AgentEditor.tsx` (model selector, prompt, tools, temperature)
- [x] Create `ToolEditor.tsx` (script editor, input/output schemas)
- [x] Create `PromptEditor.tsx` (template, variables, live preview)
- [x] Create `InstructionEditor.tsx` (markdown, scope)
- [x] Create `TaskEditor.tsx` (description, inputs/outputs, validation)
- [x] Create `TriggerEditor.tsx` (cron, webhook, event config)
- [x] Create `ValidatorEditor.tsx` (JSON schema, test button)
- [x] Create `DecisionEditor.tsx` (condition, branches)
- [x] Create `EditorRegistry.ts` (map BlockType → Editor)
- [x] Add form validation and unsaved changes warning
- [x] Add unit tests for each editor

#### 4g.3 Block Creation Wizard Modal ✅
- [x] Create `CreateBlockWizard.tsx` modal with step navigation
- [x] Step 1: Select block type (visual cards)
- [x] Step 2: Basic info (name, description, tags, status)
- [x] Step 3: Type-specific configuration forms
- [x] Step 4: Preview JSON and confirm
- [x] Implement wizard state management (useReducer)
- [x] Add keyboard navigation and validation
- [x] Integrate with FoundryPage
- [x] Add template presets per block type
- [x] Add unit tests

#### 4g.4 CRUD Service Layer ✅
- [x] Define `IBlockService` interface
- [x] Implement `mockBlockService.ts` using blockStore
- [x] Add `findUsages()` to track block references
- [x] Add proper error handling with typed errors
- [x] Prepare `apiBlockService.ts` stub for backend
- [x] Add unit tests

#### 4g.5 Self-Improvement Discovery API ✅
- [x] Define `IBlockDiscoveryService` interface
- [x] Implement `mockDiscoveryService` for frontend
- [x] Expose discovery methods via stores
- [x] Document API for agent prompt templates
- [x] Add unit tests

#### 4g.6 Global Search (Cmd+K) ✅
- [x] Create `CommandPalette.tsx` modal component
- [x] Create `useCommandPalette` hook for keyboard trigger
- [x] Implement search across blocks, workflows, models
- [x] Add recent items tracking (localStorage)
- [x] Add quick action commands
- [x] Add keyboard navigation (arrow keys, enter)
- [x] Add unit tests

#### 4g.7 Favorites & Keyboard Shortcuts ✅
- [x] Add `isFavorite` field to Block interface
- [x] Add "Favorites" section in FoundrySidebar
- [x] Add star/unstar action on BlockCard
- [x] Create `KeyboardShortcutsPanel.tsx` (trigger with `?`)
- [x] Implement shortcuts: `Cmd+K`, `Cmd+N`, `Cmd+S`, `F`, `E`, `D`, `Delete`
- [x] Add unit tests

#### 4g.8 Unit Tests ✅
- [x] Tests for all new editors
- [x] Tests for CreateBlockWizard steps
- [x] Tests for blockService and discoveryService
- [x] Tests for CommandPalette
- [x] Coverage target: > 80%

#### 4g.9 Documentation ✅
- [x] Update frontend/README.md with block editing workflow
- [x] Create `docs/block-editors.md` with detailed specs
- [x] Document keyboard shortcuts reference
- [x] Update ROADMAP.md to mark Phase 4g complete

**Outputs**:
- ✅ Type-specific block editors for all block types
- ✅ Multi-step Block Creation Wizard
- ✅ CRUD service layer with mock backend
- ✅ Block discovery API for self-improvement
- ✅ Global search (Cmd+K) command palette
- ✅ Favorites and keyboard shortcuts
- ✅ Comprehensive unit test coverage (>80%)
- ✅ Complete documentation

---

## 🔷 Phase 4h: Canvas & Node Functionality

**Goal**: Make the canvas and node system fully functional. Users must be able to create workflows, drag nodes from palette, move nodes, connect nodes, and execute workflows with mocked behaviors.

**Duration**: 2-3 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: Phase 4g complete  
**Status**: Not Started  
**Issue**: [docs/issues/phase-4h-canvas-node-functionality.md](docs/issues/phase-4h-canvas-node-functionality.md)

### Tasks

#### 4h.1 Block Palette Component
- [ ] Create `BlockPalette.tsx` component
- [ ] Create `PaletteCategory.tsx` for grouped block types
- [ ] Create `PaletteItem.tsx` with drag functionality
- [ ] Implement drag-and-drop using React DnD or native HTML5 DnD
- [ ] Add search/filter functionality
- [ ] Add tooltips with block type descriptions
- [ ] Add unit tests

#### 4h.2 Drag-and-Drop to Canvas
- [ ] Implement drop zone on `BlockCanvas`
- [ ] Calculate drop position relative to canvas viewport
- [ ] Create new block with correct position via `blockStore.addBlock()`
- [ ] Generate unique block IDs on drop
- [ ] Create default configuration based on block type
- [ ] Auto-select newly added block
- [ ] Add unit tests

#### 4h.3 Node Movement
- [ ] Fix `onNodesChange` handler in `useCanvasSync.ts`
- [ ] Update block position in store after drag ends
- [ ] Ensure position persists (store → localStorage/backend)
- [ ] Add grid snapping option
- [ ] Support multi-node selection and movement
- [ ] Add unit tests

#### 4h.4 Node Connections
- [ ] Fix `onConnect` handler in `useCanvasSync.ts`
- [ ] Implement port validation (input-to-output only)
- [ ] Add visual feedback during connection drag
- [ ] Create connection edge with proper styling
- [ ] Store connections in parent block's `connections` array
- [ ] Prevent duplicate connections
- [ ] Allow connection deletion
- [ ] Add unit tests

#### 4h.5 Node Context Menu & Actions
- [ ] Fix `handleMenuClick` in `BaseBlockNode.tsx`
- [ ] Create `NodeContextMenu.tsx` dropdown component
- [ ] Implement actions: Edit, Duplicate, Delete, Drill into
- [ ] Add keyboard shortcut hints in menu
- [ ] Add unit tests

#### 4h.6 Keyboard Shortcuts
- [ ] Create `useCanvasShortcuts.ts` hook
- [ ] Implement Delete/Backspace, Ctrl+A, Ctrl+C/V/X, Ctrl+D
- [ ] Implement Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- [ ] Implement Escape (clear selection), Enter (drill into)
- [ ] Add visual feedback for operations
- [ ] Add unit tests

#### 4h.7 Workflow Execution (Mock)
- [ ] Create `IExecutionService` interface
- [ ] Create `mockExecutionService.ts` with simulated execution
- [ ] Create `ExecutionBar.tsx` component (Run/Stop/Pause buttons)
- [ ] Implement execution state management
- [ ] Show execution status on nodes (pending → running → completed/failed)
- [ ] Animate connections during execution
- [ ] Display execution logs in bottom panel
- [ ] Add unit tests

#### 4h.8 Example Workflow: Commit Description Generator
- [ ] Create `EXAMPLE_COMMIT_WORKFLOW` in mock data
- [ ] Blocks: Trigger (Manual) → Tool (git diff) → Agent (Describe) → Validator (Format)
- [ ] Add to Foundry examples section
- [ ] Ensure workflow loads correctly on canvas
- [ ] Implement mock execution for each node type
- [ ] Show realistic mock outputs
- [ ] Add unit tests

#### 4h.9 Foundry → Canvas Navigation
- [ ] Clicking composite block in Foundry → opens Canvas with block
- [ ] Breadcrumb updates correctly when entering Canvas
- [ ] Back button returns to Foundry
- [ ] Block hierarchy (BlockExplorer) shows correct context
- [ ] Creating workflow in Foundry → navigate to Canvas for editing
- [ ] Add unit tests

**Outputs**:
- ✅ Fully functional block palette with drag-and-drop
- ✅ Nodes movable and connectable on canvas
- ✅ Node context menu with all actions working
- ✅ Keyboard shortcuts for canvas operations
- ✅ Mock workflow execution with visual feedback
- ✅ Working example workflow (Commit Description Generator)
- ✅ Seamless Foundry ↔ Canvas navigation

---

## 🔷 Phase 4i: Breadcrumb Navigation & Route Synchronization

**Goal**: Fix the breadcrumb navigation system so it always reflects the current page/route accurately, updates immediately when navigating, and is always visible below the TopBar.

**Duration**: 3-5 days  
**Team**: Frontend (1 developer)  
**Dependencies**: Phase 4g complete  
**Status**: Not Started  
**Issue**: [docs/issues/phase-4i-breadcrumb-navigation.md](docs/issues/phase-4i-breadcrumb-navigation.md)

### Tasks

#### 4i.1 Route Synchronization Hook
- [ ] Create `useRouteSync.ts` hook
- [ ] Parse current URL to extract route type and parameters
- [ ] Update `NavigationStore` when URL changes
- [ ] Update URL when `NavigationStore` changes programmatically
- [ ] Handle browser back/forward button events
- [ ] Add unit tests

#### 4i.2 Updated NavigationStore
- [ ] Add `currentRoute: RouteInfo` to state
- [ ] Add `setCurrentRoute(route: RouteInfo)` action
- [ ] Add `getBreadcrumbSegments()` computed method
- [ ] Modify `navigateInto` / `navigateUp` to update URL
- [ ] Remove duplicate history (use browser history instead)
- [ ] Add unit tests

#### 4i.3 Breadcrumb Component Refactor
- [ ] Replace current implementation with route-aware logic
- [ ] Render segments based on `getBreadcrumbSegments()`
- [ ] Use React Router's `Link` for navigation
- [ ] Keep back/forward buttons but sync with browser history
- [ ] Ensure proper styling and accessibility
- [ ] Add unit tests

#### 4i.4 Breadcrumb Layout Position
- [ ] Move Breadcrumb outside `PanelLayout` in `IDELayout.tsx`
- [ ] Place directly below TopBar, above panels
- [ ] Update CSS for fixed positioning (doesn't scroll with content)
- [ ] Ensure breadcrumb visible on all pages
- [ ] Add unit tests

#### 4i.5 Browser History Integration
- [ ] Remove custom `history` array from NavigationStore
- [ ] Use `navigate(-1)` and `navigate(1)` for back/forward
- [ ] `canGoBack()` checks browser history
- [ ] `canGoForward()` uses sessionStorage tracking
- [ ] Add unit tests

**Outputs**:
- ✅ Breadcrumb shows correct path for all routes
- ✅ Breadcrumb updates immediately on navigation
- ✅ Breadcrumb always visible below TopBar (doesn't scroll)
- ✅ Back/forward buttons use browser history
- ✅ Deep links work correctly

---

## 🔷 Phase 5: Backend - Filesystem Block Architecture & Execution Engine

**Goal**: Implement the complete backend for filesystem-based block discovery, execution, and workflow orchestration. This is the **critical foundation** for human-editable, frontend-creatable, and agent-improvable workflows.

**Duration**: 6-8 weeks  
**Team**: Backend (2-3 developers)  
**Dependencies**: Phase 4i complete  
**Status**: Not Started

### Strategic Vision

This phase establishes the backend architecture that will enable:
1. **Human-editable blocks**: Create/modify blocks in any text editor
2. **Frontend-created blocks**: UI writes proper file structures to disk
3. **Agent-generated blocks**: Future auto-improvement generates and compares workflows
4. **Deterministic replay**: Workflows are serializable and replayable identically
5. **Environment-agnostic**: No dependency on VS Code, MCP, or specific runtime
6. **MCP Server**: Expose Maestro as tools for VS Code Copilot and other LLM agents

### Sub-Phases

| Phase | Focus | Duration | Issue |
|-------|-------|----------|-------|
| 5A | Filesystem Block Architecture | 2-3 weeks | [phase-5a-filesystem-block-architecture.md](docs/issues/phase-5a-filesystem-block-architecture.md) |
| 5B | Block Execution Engine | 2-3 weeks | [phase-5b-block-execution-engine.md](docs/issues/phase-5b-block-execution-engine.md) |
| 5C | Workflow Orchestration | 2 weeks | [phase-5c-workflow-orchestration.md](docs/issues/phase-5c-workflow-orchestration.md) |
| 5D | Commit Workflow & MCP Server | 1-2 weeks | [phase-5d-commit-workflow-mcp.md](docs/issues/phase-5d-commit-workflow-mcp.md) |

---

### 🔹 Phase 5A: Filesystem Block Architecture

**Goal**: Design and implement filesystem-based block definitions discovered dynamically from folders.

#### Block Folder Structure
```
blocks/
├── agents/
│   └── planner/
│       ├── block.json          # Block metadata
│       ├── system-prompt.md    # System prompt
│       └── tools.json          # Available tools
├── prompts/
│   └── commit-description/
│       ├── block.json
│       └── template.md
├── tools/
│   └── git-diff/
│       ├── block.json
│       └── script.sh
├── workflows/
│   └── commit-generator/
│       ├── block.json
│       ├── nodes.json
│       └── connections.json
└── inference/
    └── describe-changes/
        ├── block.json
        └── output-schema.json
```

#### Tasks
- [ ] Create `docs/schemas/block.schema.json` with JSON Schema for block.json
- [ ] Create `IBlockDiscoveryService` interface (Application layer)
- [ ] Implement `FileSystemBlockDiscoveryService` (Infrastructure layer)
- [ ] Create `IBlockRepository` interface for CRUD operations
- [ ] Implement block type handlers (Agent, Prompt, Tool, Inference, Workflow, etc.)
- [ ] Implement multi-location discovery (global, project `.maestro/`, user)
- [ ] Implement file watcher for live block updates
- [ ] Create `BlocksController` REST API endpoints
- [ ] Update frontend `realBlockService.ts` to use backend API
- [ ] Add comprehensive unit tests

---

### 🔹 Phase 5B: Block Execution Engine

**Goal**: Implement the execution engine that runs individual blocks with proper data flow.

#### Execution Model
```
ExecutionRequest → ExecutionEngine → BlockExecutor → ExecutionResult
                        ↓
                  ExecutionContext
                  (Variables, Logs, Metrics)
```

#### Tasks
- [ ] Create `ExecutionContext` domain entity with state management
- [ ] Create `IBlockExecutor` interface and `BlockExecutorRegistry`
- [ ] Implement `PromptBlockExecutor` (template resolution only)
- [ ] Implement `InferenceBlockExecutor` (LLM calls via ILLMGateway)
- [ ] Implement `ToolBlockExecutor` (sandboxed script execution)
- [ ] Implement `DecisionBlockExecutor` (condition evaluation)
- [ ] Implement `ValidatorBlockExecutor` (schema/regex validation)
- [ ] Implement `AgentBlockExecutor` (with tool calling loop)
- [ ] Implement `TriggerBlockExecutor` (manual/webhook/schedule)
- [ ] Create `IExecutionEngine` service interface
- [ ] Implement execution persistence to filesystem
- [ ] Implement SignalR events for real-time updates
- [ ] Support mock mode (load `mock-response.json` for testing)
- [ ] Add comprehensive unit tests

---

### 🔹 Phase 5C: Workflow Orchestration

**Goal**: Execute multi-block workflows with proper dependency resolution and data flow.

#### Execution Graph
```
Layer 0: [Trigger]
Layer 1: [GitDiff, GetContext]  ← parallel
Layer 2: [Describe]             ← waits for Layer 1
Layer 3: [Format]               ← waits for Layer 2
```

#### Tasks
- [ ] Create `ExecutionGraph` with topological sort
- [ ] Implement cycle detection (reject workflows with cycles)
- [ ] Create `IDataFlowManager` for passing data between blocks
- [ ] Implement `IWorkflowExecutor` with layer-based parallel execution
- [ ] Implement decision branch routing
- [ ] Implement error handling with retry policies
- [ ] Support workflow variables and environment secrets
- [ ] Implement execution checkpoints for resume
- [ ] Support composite block execution (nested workflows)
- [ ] Create workflow execution REST API endpoints
- [ ] Update frontend execution service to use real API
- [ ] Add comprehensive unit tests

---

### 🔹 Phase 5D: Commit Description Workflow & MCP Server

**Goal**: Create first working end-to-end workflow and MCP server foundation.

#### Commit Generator Workflow
```
Manual Trigger → Git Diff (Tool) → Describe (Inference) → Format (Validator)
```

#### Tasks
- [ ] Create `blocks/tools/git-diff/` tool block
- [ ] Create `blocks/prompts/commit-description/` prompt block
- [ ] Create `blocks/inference/describe-commit/` inference block
- [ ] Create `blocks/validators/commit-format/` validator block
- [ ] Create `blocks/workflows/commit-generator/` workflow
- [ ] Create `Maestro.Cli` project with `maestro execute` command
- [ ] Create `Maestro.McpServer` project for VS Code integration
- [ ] Implement MCP tools: `execute-workflow`, `list-workflows`, `get-workflow`
- [ ] Support `.maestro/blocks/` for project-specific blocks
- [ ] Create MCP setup documentation
- [ ] Add end-to-end integration tests

---

### Outputs (Phase 5 Complete)
- ✅ Filesystem-based block discovery and persistence
- ✅ JSON Schema validation for all block types
- ✅ Block executors for all block types
- ✅ Workflow execution with parallel support
- ✅ Real-time execution events via SignalR
- ✅ Working commit description generator workflow
- ✅ CLI for executing workflows (`maestro execute`)
- ✅ MCP server for VS Code Copilot integration
- ✅ Project-level blocks (`.maestro/` folder support)

### Acceptance Criteria
1. **Manual block creation**: Create block in text editor → appears in frontend
2. **Frontend block creation**: Create in UI → proper files written to disk
3. **Hot reload**: Edit block.json → frontend updates immediately
4. **Workflow execution**: Run commit-generator → get valid commit message
5. **Mock mode**: Run with `--mock` → uses mock responses
6. **MCP integration**: VS Code Copilot can call Maestro workflows

---

## 🔷 Phase 6: Agent Implementations

**Goal**: Implement the core AI agents (Planner, Coder, Tester, Reviewer).

**Duration**: 2-3 weeks  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 3, 5 complete

### Tasks

- [ ] Implement `PlannerAgent` - task decomposition
- [ ] Implement `CoderAgent` - code generation
- [ ] Implement `TesterAgent` - test generation and execution
- [ ] Implement `ReviewerAgent` - code review
- [ ] Implement `DebuggerAgent` - error analysis
- [ ] Create agent prompt templates
- [ ] Add unit tests with mocked LLM responses

**Outputs**:
- ✅ 5 working AI agents
- ✅ Prompt templates library

---

## 🔷 Phase 7: Monitoring & Observability

**Goal**: Implement real-time monitoring UI for workflow execution.

**Duration**: 1-2 weeks  
**Team**: Frontend + Backend (2 developers)  
**Dependencies**: Phase 4d, 5 complete

### Tasks

- [ ] Implement execution timeline component
- [ ] Implement live log streaming
- [ ] Implement block status visualization on canvas
- [ ] Add execution metrics (duration, tokens, cost)
- [ ] Add unit tests

**Outputs**:
- ✅ Real-time execution monitoring
- ✅ Live log viewer
- ✅ Execution metrics dashboard

---

## 🔷 Phase 8: Tool Executors & Integration

**Goal**: Implement tool executors for bash, git, and file operations.

**Duration**: 1-2 weeks  
**Team**: Backend (1-2 developers)  
**Dependencies**: Phase 3, 5 complete

### Tasks

- [ ] Implement `BashToolExecutor` - shell command execution
- [ ] Implement `GitToolExecutor` - Git operations
- [ ] Implement `FileToolExecutor` - file read/write
- [ ] Implement sandboxing and security
- [ ] Add unit tests

**Outputs**:
- ✅ Working tool executors
- ✅ Secure sandboxed execution

---

## 🔷 Phase 9: Terminal & CLI Integration

**Goal**: Implement the integrated terminal panel for CLI interactions and log viewing.

**Duration**: 2 weeks  
**Team**: Frontend (1-2 developers)  
**Dependencies**: Phase 4c, 7 complete

### Tasks

#### 9.1 Terminal Emulator
- [ ] Integrate xterm.js for terminal emulation
- [ ] Create `TerminalPanel` component
- [ ] Implement terminal tabs (multiple sessions)
- [ ] Style terminal to match application theme
- [ ] Add unit tests

#### 9.2 Maestro CLI
- [ ] Implement CLI command parser
- [ ] Implement commands:
  - [ ] `maestro list` - list workflows/blocks
  - [ ] `maestro run <id>` - execute workflow
  - [ ] `maestro logs [--follow]` - view execution logs
  - [ ] `maestro create <type> <name>` - create new block
  - [ ] `maestro status` - show current execution status
  - [ ] `maestro help` - show available commands
- [ ] Implement command autocomplete
- [ ] Implement command history
- [ ] Add unit tests

#### 9.3 Log Viewer Integration
- [ ] Stream execution logs to terminal
- [ ] Color-coded log levels
- [ ] Clickable file paths and line numbers
- [ ] Search within logs
- [ ] Add unit tests

**Outputs**:
- ✅ Integrated terminal emulator
- ✅ Maestro CLI with core commands
- ✅ Real-time log streaming

---

## 🔷 Phase 10: End-to-End Integration & Testing

**Goal**: Integrate all components and perform comprehensive testing.

**Duration**: 2-3 weeks  
**Team**: Full team  
**Dependencies**: Phases 5-9 complete

### Tasks

- [ ] E2E test suite with Playwright
- [ ] Integration testing (frontend + backend)
- [ ] Performance testing
- [ ] Security audit
- [ ] Bug fixes and polish

**Outputs**:
- ✅ Fully integrated application
- ✅ Comprehensive test coverage
- ✅ Performance benchmarks

---

## 🔷 Phase 11: Documentation & Examples

**Goal**: Complete documentation and example workflows.

**Duration**: 1-2 weeks  
**Team**: Documentation (1-2 developers)  
**Dependencies**: Phase 10 complete

### Tasks

- [ ] User documentation
- [ ] API documentation
- [ ] Example workflows (simple to complex)
- [ ] Video tutorials (optional)
- [ ] Troubleshooting guide

**Outputs**:
- ✅ Complete documentation
- ✅ Example workflow library

---

## 🔷 Phase 12: MVP Release Preparation

**Goal**: Prepare for MVP release.

**Duration**: 1 week  
**Team**: Full team  
**Dependencies**: Phase 11 complete

### Tasks

- [ ] Final testing
- [ ] Release notes
- [ ] Deployment preparation
- [ ] Marketing materials (optional)

**Outputs**:
- ✅ MVP release ready

---

## � Phase 13: Auto-Optimization & Benchmarking (Post-MVP)

**Goal**: Enable workflows to self-optimize by benchmarking different model configurations and automatically selecting the best model for each task based on cost, quality, and speed requirements.

**Duration**: 3-4 weeks  
**Team**: Backend (2 developers) + Frontend (1 developer)  
**Dependencies**: Phases 4e, 5, 6, 7 complete

### Vision

Maestro will be able to **improve its own workflows** by:
1. Running benchmarks with different model configurations
2. Learning which models perform best for specific task types
3. Automatically suggesting or applying model changes to optimize cost/quality/speed
4. Tracking improvements over time

### Tasks

#### 13.1 Execution Metrics Collection
- [ ] Extend execution context to collect detailed metrics:
  - [ ] Token usage (input/output per node)
  - [ ] Response time per node
  - [ ] Cost per node (calculated from model pricing)
  - [ ] Quality score (when validator provides feedback)
- [ ] Store metrics in execution history
- [ ] Create metrics aggregation service
- [ ] Add unit tests

#### 13.2 Benchmark Engine
- [ ] Create `IBenchmarkEngine` interface
- [ ] Implement `BenchmarkRunner` service:
  - [ ] Run workflow with different model configurations
  - [ ] Compare results across runs
  - [ ] Calculate aggregate scores (cost, quality, speed)
- [ ] Implement benchmark configuration:
  - [ ] Models to compare
  - [ ] Number of runs per configuration
  - [ ] Evaluation criteria weights
- [ ] Add unit tests

#### 13.3 Shadow Execution Mode
- [ ] Implement shadow execution for A/B testing:
  - [ ] Run primary workflow with current configuration
  - [ ] Simultaneously run with alternative model (shadow)
  - [ ] Compare outputs without affecting primary workflow
- [ ] Store shadow results for analysis
- [ ] Add unit tests

#### 13.4 Optimization Strategies
- [ ] Implement optimization strategy interfaces:
  - [ ] `CostOptimizer`: Find cheapest model meeting quality threshold
  - [ ] `QualityOptimizer`: Find best model within budget
  - [ ] `SpeedOptimizer`: Minimize latency for time-critical tasks
  - [ ] `HybridOptimizer`: Balance cost/quality/speed with weights
- [ ] Create strategy selector based on user preferences
- [ ] Add unit tests

#### 13.5 Model Recommendation Engine
- [ ] Analyze execution history to learn model performance patterns
- [ ] Build task-type to model-performance mapping
- [ ] Generate recommendations:
  - [ ] "Switch Agent X from GPT-4 to Claude 3 Sonnet for 40% cost reduction with similar quality"
  - [ ] "Use GPT-4o-mini for simple tasks, reserve GPT-4o for complex reasoning"
- [ ] Confidence scores for recommendations
- [ ] Add unit tests

#### 13.6 Auto-Apply Optimizations
- [ ] Create optimization proposal system:
  - [ ] Generate proposals from recommendations
  - [ ] Show expected impact (cost savings, quality change)
  - [ ] Allow user to approve/reject/modify
- [ ] Implement auto-apply mode (with user consent):
  - [ ] Automatically apply high-confidence optimizations
  - [ ] Rollback if quality degrades
- [ ] Add unit tests

#### 13.7 Optimization Dashboard UI
- [ ] Create `OptimizationDashboard` component:
  - [ ] Show current workflow cost/performance metrics
  - [ ] Display optimization opportunities
  - [ ] Visualize potential savings
- [ ] Create `BenchmarkResultsView` component:
  - [ ] Compare model performance side-by-side
  - [ ] Charts: cost vs quality, speed vs quality
  - [ ] Recommendation cards with action buttons
- [ ] Create `OptimizationHistory` component:
  - [ ] Track applied optimizations over time
  - [ ] Show cost savings achieved
  - [ ] Allow rollback of changes
- [ ] Add unit tests

#### 13.8 Workflow Improvement Suggestions
- [ ] Analyze workflow structure for optimization opportunities:
  - [ ] Identify redundant agent calls
  - [ ] Suggest parallel execution where possible
  - [ ] Recommend caching for repeated queries
- [ ] Generate improvement proposals with explanations
- [ ] Add unit tests

**Outputs**:
- ✅ Execution metrics collection and storage
- ✅ Benchmark engine for model comparison
- ✅ Shadow execution for safe A/B testing
- ✅ Multiple optimization strategies
- ✅ AI-powered model recommendation engine
- ✅ Auto-apply optimizations with approval workflow
- ✅ Optimization dashboard with actionable insights

**Design Decisions**:
1. **Opt-in auto-optimization**: Users must explicitly enable auto-apply
2. **Rollback safety**: All changes can be reverted if quality degrades
3. **Transparency**: All recommendations include reasoning and confidence scores
4. **Learning from history**: System improves recommendations over time
5. **Cost-aware by default**: Always show cost impact of changes

**Example Optimization Flow**:
```
1. User runs workflow 10 times with GPT-4o ($2.50 total)
2. System runs shadow benchmark with Claude 3 Sonnet
3. Shadow results show similar quality at $0.80 total (68% savings)
4. System proposes: "Switch Coder Agent to Claude 3 Sonnet"
5. User approves → workflow updated
6. System monitors next 5 runs to confirm quality maintained
7. If quality drops, system alerts and offers rollback
```

---

## �🔄 Parallelization Strategy

### Work Streams

To maximize parallel development, the project is divided into **5 primary work streams**:

#### 1️⃣ **Backend Core** (2-3 developers)
- **Phases**: 1, 2, 3, 5, 6, 8
- **Focus**: Domain model, application layer, infrastructure, agents
- **Critical path**: Yes (blocks frontend integration)

#### 2️⃣ **Frontend Core** (2-3 developers)
- **Phases**: 4a, 4b, 4c, 4d, 4e, 9
- **Focus**: Block architecture, canvas editor, models panel, terminal integration
- **Critical path**: No (can start independently with mocks)

#### 3️⃣ **Monitoring & Real-Time** (1-2 developers)
- **Phases**: 7
- **Focus**: SignalR integration, monitoring UI
- **Critical path**: No (depends on Phase 5, but can start early with mocks)

#### 4️⃣ **Documentation & QA** (1-2 developers)
- **Phases**: 11, 12
- **Focus**: Documentation, examples, testing
- **Critical path**: No (continuous throughout development)

#### 5️⃣ **Auto-Optimization** (Post-MVP, 2 developers)
- **Phases**: 13
- **Focus**: Benchmarking engine, model recommendations, self-improvement
- **Critical path**: No (post-MVP enhancement)

### Parallel Execution Plan

```
Week 1-2:   Phase 1 (Backend Core)    ║ Phase 4a (Frontend Foundation) ✓
Week 3-4:   Phase 2 (Domain/App)      ║ Phase 4b (Block Architecture)
Week 5-6:   Phase 2 (continued)       ║ Phase 4c (IDE Layout) + Phase 4e (Models Panel)
Week 7-8:   Phase 3 (Infrastructure)  ║ Phase 4d (Canvas Foundation)
Week 9-10:  Phase 4i (Breadcrumb)     ║ Phase 4g (Block Editing)
Week 11-14: Phase 5A (Filesystem)     ║ Phase 5B (Execution Engine)
Week 15-16: Phase 5C (Orchestration)  ║ Phase 5D (MCP + CLI)
Week 17-18: Phase 6 (Agents)          ║ Phase 7 (Monitoring)
Week 19-20: Phase 8 (Tools)           ║ Phase 9 (Terminal CLI)
Week 21-23: Phase 10 (Integration & Testing) - Full Team
Week 24-25: Phase 11 (Documentation)  ║ Phase 12 (Release Prep)
Week 26+:   Phase 13 (Auto-Optimization) - Post-MVP
```

### Dependencies Matrix

| Phase | Depends On | Blocks |
|-------|------------|--------|
| 1     | None       | 2, 3   |
| 2     | 1          | 3, 5A, 6 |
| 3     | 2          | 4e (backend), 5A, 6, 7, 8 |
| 4a    | None       | 4b, 4e |
| 4b    | 4a         | 4c, 4d |
| 4c    | 4b         | 4d, 9  |
| 4d    | 4b, 4c     | 7, 10  |
| 4e    | 4a, 3 (partial) | 6, 13 |
| 4g    | 4b         | 5A     |
| 4i    | 4c         | 5A     |
| **5A**| 2, 3, 4i   | 5B, 5C |
| **5B**| 5A         | 5C, 5D |
| **5C**| 5B         | 5D, 7, 10 |
| **5D**| 5A, 5B, 5C | 9, 10, 13 |
| 6     | 2, 3, 4e, 5B | 10, 13 |
| 7     | 4d, 5C     | 10, 13 |
| 8     | 3, 6       | 10     |
| 9     | 4c, 5D, 7  | 10     |
| 10    | 5D, 6-9    | 11, 12 |
| 11    | 10         | 12     |
| 12    | 11         | Release |
| 13    | 4e, 5D, 6, 7 | Future |

### Team Allocation Recommendations

**Ideal team size**: 6-8 developers

- **Backend**: 3 developers
  - Developer 1: Domain model, use cases
  - Developer 2: Infrastructure, LLM Gateway
  - Developer 3: Agents, tools

- **Frontend**: 2 developers
  - Developer 1: Workflow editor, canvas
  - Developer 2: Monitoring UI, API integration

- **Full-Stack**: 1 developer
  - SignalR integration (backend + frontend)

- **QA/Docs**: 1-2 developers
  - Testing, documentation, examples

---

## 📋 Issue Creation Guidelines

Each task in this roadmap should be converted into a GitHub issue with:

### Issue Template

```markdown
## Description
[Brief description of the task]

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Unit tests added (if applicable)
- [ ] Documentation updated (if applicable)

## Dependencies
- Depends on: #123, #124
- Blocks: #125, #126

## Estimated Effort
- [ ] Small (< 1 day)
- [ ] Medium (1-3 days)
- [ ] Large (3-5 days)
- [ ] Extra Large (> 5 days)

## Labels
- `backend` or `frontend`
- `phase-X` (e.g., `phase-2`)
- `priority: high/medium/low`
- `domain`, `application`, `infrastructure`, `ui`, etc.
```

---

## 🎯 Success Metrics

### MVP Success Criteria

- [ ] Users can create workflows visually
- [ ] Users can execute workflows with at least 1 agent
- [ ] Real-time execution monitoring works
- [ ] Workflows are saved and versioned in Git
- [ ] LLM Gateway supports at least 2 providers (OpenAI + Ollama)
- [ ] Example workflows are provided and functional
- [ ] Documentation is complete and clear

### Quality Metrics

- [ ] **Code Coverage**: 80%+ for Domain/Application, 70%+ for Infrastructure/Frontend
- [ ] **Architecture Compliance**: 100% adherence to Clean Architecture rules (no layer violations)
- [ ] **Build Success**: 100% green builds on CI/CD
- [ ] **Test Success**: 100% passing tests
- [ ] **Documentation Coverage**: All public APIs documented

---

## 🔗 Related Documentation

- [README.md](./README.md) - Project overview and architecture
- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
- [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) - Detailed folder structure
- [Frontend Guide](./docs/frontend-guide.md) - Frontend development guide
- [Backend Guide](./docs/backend-guide.md) - Backend development guide
- [Workflow Engine Guide](./docs/workflow-engine-guide.md) - Workflow execution guide
- [Agents and Tools Guide](./docs/agents-and-tools-guide.md) - Agent and tool development guide

---

## 📝 Notes

- This roadmap is a living document and should be updated as the project evolves.
- Task estimates are approximate and may need adjustment.
- Priorities may shift based on feedback and changing requirements.
- **Critical rule**: All work must respect Clean Architecture and model-agnostic design principles.

---

**Last Updated**: 2025-01-27  
**Maintained by**: Architecture Team
