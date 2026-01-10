# B-One Maestro Development Roadmap

> **Status**: Active Development  
> **Last Updated**: 2026-01-10  
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

## 📊 Development Phases Overview

```
Phase 1:  Foundation (Backend Core)             [█████████░] 90%
Phase 2:  Domain & Application Layer            [░░░░░░░░░░]  0%
Phase 3:  Infrastructure Layer                  [░░░░░░░░░░]  0%
Phase 4a: Frontend Foundation                   [██████████] 100%
Phase 4b: Block Architecture & Types            [░░░░░░░░░░]  0%
Phase 4c: IDE Layout & Panel System             [░░░░░░░░░░]  0%
Phase 4d: Canvas Foundation (React Flow)        [░░░░░░░░░░]  0%
Phase 5:  Workflow Engine & Execution           [░░░░░░░░░░]  0%
Phase 6:  Agent Implementations                 [░░░░░░░░░░]  0%
Phase 7:  Monitoring & Observability            [░░░░░░░░░░]  0%
Phase 8:  Tool Executors & Integration          [░░░░░░░░░░]  0%
Phase 9:  Terminal & CLI Integration            [░░░░░░░░░░]  0%
Phase 10: End-to-End Integration & Testing      [░░░░░░░░░░]  0%
Phase 11: Documentation & Examples              [█████░░░░░] 50%
Phase 12: MVP Release Preparation               [░░░░░░░░░░]  0%
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

## 🔷 Phase 5: Workflow Engine & Execution

**Goal**: Implement the backend execution engine that runs workflows/blocks.

**Duration**: 2-3 weeks  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 2, 3 complete

### Tasks

#### 5.1 Execution Engine Core
- [ ] Implement `IExecutionEngine` interface
- [ ] Create `WorkflowExecutor` - top-level orchestrator
- [ ] Create `BlockExecutor` - executes individual blocks
- [ ] Implement execution context and state management
- [ ] Handle recursive block execution (composite blocks)
- [ ] Add pause/resume/cancel support
- [ ] Add unit tests

#### 5.2 Block Executors
- [ ] Implement `AgentBlockExecutor` - calls LLM Gateway
- [ ] Implement `ToolBlockExecutor` - runs tools
- [ ] Implement `DecisionBlockExecutor` - evaluates conditions
- [ ] Implement `ValidatorBlockExecutor` - validates outputs
- [ ] Add unit tests for each executor

#### 5.3 Execution State & Events
- [ ] Implement execution state machine
- [ ] Publish events via SignalR (started, progress, completed, failed)
- [ ] Store execution history
- [ ] Add unit tests

**Outputs**:
- ✅ Working execution engine
- ✅ Real-time execution updates via SignalR
- ✅ Execution history persistence

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

## 🔄 Parallelization Strategy

### Work Streams

To maximize parallel development, the project is divided into **4 primary work streams**:

#### 1️⃣ **Backend Core** (2-3 developers)
- **Phases**: 1, 2, 3, 5, 6, 8
- **Focus**: Domain model, application layer, infrastructure, agents
- **Critical path**: Yes (blocks frontend integration)

#### 2️⃣ **Frontend Core** (2-3 developers)
- **Phases**: 4a, 4b, 4c, 4d, 9
- **Focus**: Block architecture, canvas editor, terminal integration
- **Critical path**: No (can start independently with mocks)

#### 3️⃣ **Monitoring & Real-Time** (1-2 developers)
- **Phases**: 7
- **Focus**: SignalR integration, monitoring UI
- **Critical path**: No (depends on Phase 5, but can start early with mocks)

#### 4️⃣ **Documentation & QA** (1-2 developers)
- **Phases**: 11, 12
- **Focus**: Documentation, examples, testing
- **Critical path**: No (continuous throughout development)

### Parallel Execution Plan

```
Week 1-2:   Phase 1 (Backend Core)    ║ Phase 4a (Frontend Foundation) ✓
Week 3-4:   Phase 2 (Domain/App)      ║ Phase 4b (Block Architecture)
Week 5-6:   Phase 2 (continued)       ║ Phase 4c (IDE Layout)
Week 7-8:   Phase 3 (Infrastructure)  ║ Phase 4d (Canvas Foundation)
Week 9-12:  Phase 5 (Execution) + Phase 6 (Agents) ║ Phase 4d (continued)
Week 13-14: Phase 7 (Monitoring)      ║ Phase 8 (Tool Executors)
Week 15-16: Phase 9 (Terminal & CLI)
Week 17-19: Phase 10 (Integration & Testing) - Full Team
Week 20-21: Phase 11 (Documentation)  ║ Phase 12 (Release Prep)
```

### Dependencies Matrix

| Phase | Depends On | Blocks |
|-------|------------|--------|
| 1     | None       | 2, 3   |
| 2     | 1          | 3, 5, 6 |
| 3     | 2          | 5, 6, 7, 8 |
| 4a    | None       | 4b     |
| 4b    | 4a         | 4c, 4d |
| 4c    | 4b         | 4d, 9  |
| 4d    | 4b, 4c     | 7, 10  |
| 5     | 2, 3       | 7, 10  |
| 6     | 2, 3       | 10     |
| 7     | 4d, 5      | 10     |
| 8     | 3, 6       | 10     |
| 9     | 4c, 7      | 10     |
| 10    | 5-9        | 11, 12 |
| 11    | 10         | 12     |
| 12    | 11         | Release |

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

**Last Updated**: 2026-01-10  
**Maintained by**: Architecture Team
