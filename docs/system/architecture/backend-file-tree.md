# Backend File Tree & Inheritance Hierarchy

> **Last updated**: 2026-03-06 (Post Phase 53-C — INodeHandler decomposition)
> **Purpose**: Living reference for the backend architecture. Update after each phase that modifies the execution layer.

---

## 1. File Tree

```
apps/backend/src/
├── Maestro.Domain/                          -- DOMAIN LAYER --
│   ├── Entities/
│   │   ├── BlockDefinition.cs               # Universal entity — everything is a block
│   │   ├── ContainerSession.cs
│   │   ├── Conversation.cs
│   │   ├── ExecutionContext.cs
│   │   ├── ExecutionLog.cs
│   │   ├── FoundrySession.cs
│   │   ├── MemoryStore.cs
│   │   ├── PendingBlockApproval.cs
│   │   ├── ProjectSession.cs
│   │   ├── Sandbox.cs / SandboxImage.cs
│   │   ├── Session.cs
│   │   ├── SessionBlockRegistry.cs
│   │   ├── Workspace.cs
│   │   └── Training*.cs / Project*.cs / AgentActivity.cs / ...
│   ├── ValueObjects/
│   │   ├── FitnessScore.cs          (306 L) # Fitness formula: (P*S*W) / (C)^lambda
│   │   ├── WorkflowExecutionMetrics.cs (206 L)
│   │   ├── ModelProfile.cs          (370 L)
│   │   ├── TaskEntropy.cs           (182 L)
│   │   ├── FitnessConfig.cs         (133 L)
│   │   ├── BlockMetrics.cs / AggregatedBlockMetrics.cs
│   │   └── ExecutionId, SessionId, ProjectId, QualityScore, ...
│   ├── Enums/
│   │   └── ContainerSessionStatus.cs, SessionEnums.cs, ...
│   └── Execution/
│       └── DecisionResult.cs, RetryPolicy.cs
│
├── Maestro.Application/                     -- APPLICATION LAYER (Interfaces + DTOs) --
│   ├── Interfaces/
│   │   ├── IBlockExecutor.cs                # Root interface for ALL executors
│   │   ├── ISessionStateManager.cs          # Phase 53 — extracted from EntryPointExecutor
│   │   ├── IExecutionEngine.cs
│   │   ├── IBlockDiscoveryService.cs
│   │   ├── IConversationManager.cs
│   │   ├── ILLMGateway.cs
│   │   ├── IFitnessService.cs
│   │   ├── ISessionServer.cs               # IProjectSessionServer, ICommandExecutor, ISessionContext
│   │   └── 40+ other interfaces (repos, services, orchestration)
│   ├── DTOs/
│   │   ├── ContractTestResult.cs    (118 L) # Phase 54 — PerformanceScore + FitnessBreakdown
│   │   ├── BlockDto.cs, BlockType.cs, FitnessDto.cs, ...
│   │   └── ...
│   └── Execution/
│       └── ExecutionCoordinator.cs
│
├── Maestro.Infrastructure/                  -- INFRASTRUCTURE LAYER --
│   │
│   ├── BlockExecutors/                      --- EXECUTION: Block Executors ---
│   │   │
│   │   │  REGISTRY
│   │   ├── BlockExecutorRegistry.cs  (18 L) # blockType -> IBlockExecutor dispatch
│   │   │
│   │   │  ABSTRACT BASES
│   │   ├── MultiNodeBlockExecutor.cs(155 L) # Phase 53 — base for agent/tool/workflow
│   │   ├── LLMBlockExecutorBase.cs  (295 L) # Base for atomic LLM blocks
│   │   │
│   │   │  COMPOSITE EXECUTORS (inherit MultiNodeBlockExecutor)
│   │   ├── AgentBlockExecutor.cs    (124 L) # Conversational agents
│   │   ├── ToolBlockExecutor.cs      (78 L) # Composite tools
│   │   ├── WorkflowBlockExecutor.cs  (37 L) # Workflows
│   │   │
│   │   │  ATOMIC EXECUTORS — Phase 53 new
│   │   ├── ResponseParserBlockExecutor.cs (192 L) # Parse LLM response
│   │   ├── ToolDispatcherBlockExecutor.cs (185 L) # Dispatch tool calls
│   │   ├── ConversationReadBlockExecutor.cs (52 L) # Read conversation
│   │   ├── ConversationAppendBlockExecutor.cs (50 L) # Append to conversation
│   │   ├── MessageBuilderBlockExecutor.cs   (82 L) # Build structured messages
│   │   ├── ShellBlockExecutor.cs   (147 L) # Shell/git commands
│   │   ├── FileReadBlockExecutor.cs  (68 L) # Read file
│   │   ├── TreeDocumenterBlockExecutor.cs (126 L) # File tree documentation
│   │   ├── PhaseBlockExecutor.cs   (104 L) # Phase management
│   │   │
│   │   │  ATOMIC EXECUTORS — Phase 54 new
│   │   ├── FileWriteBlockExecutor.cs (62 L) # Write file
│   │   ├── FileEditBlockExecutor.cs  (84 L) # Edit file (old->new)
│   │   │
│   │   │  ATOMIC EXECUTORS — Pre-existing
│   │   ├── InferenceBlockExecutor.cs(231 L) # LLM call (inherits LLMBlockExecutorBase)
│   │   ├── DecisionBlockExecutor.cs  (89 L) # LLM-assisted decision
│   │   ├── ValidatorBlockExecutor.cs (93 L) # Block validation
│   │   ├── ContextBlockExecutor.cs  (221 L) # Context assembly
│   │   ├── MemoryBlockExecutor.cs   (261 L) # Memory read/write
│   │   ├── ConversationBlockExecutor.cs (181 L) # Conversation management
│   │   ├── PromptBlockExecutor.cs    (55 L) # Simple prompt
│   │   ├── TriggerBlockExecutor.cs   (67 L) # Event trigger
│   │   └── CompositeBlockExecutor.cs (49 L) # Generic composition
│   │
│   ├── Sessions/                            --- EXECUTION: Session Engine ---
│   │   ├── NodeExecutionEngine.cs  (834 L)  # Phase 53-C — control flow only (while/cond/seq/parallel/phase)
│   │   ├── SessionStateManager.cs  (670 L)  # Phase 53 — execution tree, logs, metrics
│   │   ├── EntryPointExecutor.cs   (207 L)  # Phase 53 — entry point lifecycle only
│   │   ├── TemplateResolver.cs     (201 L)  # Phase 53-B — template {{var}} resolution
│   │   ├── ConditionEvaluator.cs   (113 L)  # Phase 53-B — condition evaluation
│   │   ├── SessionHelper.cs        (292 L)  # Phase 53-B — session utilities
│   │   ├── NodeHandlers/                    # Phase 53-C — INodeHandler implementations
│   │   │   ├── ForEachNodeHandler.cs  (503 L) # for-each loop + source resolution
│   │   │   ├── BlockRefHandler.cs     (273 L) # blockRef dispatch via BlockExecutorRegistry
│   │   │   └── SetVariableNodeHandler.cs (183 L) # set-variable with JSON parsing
│   │   ├── ProjectSessionServer.cs (474 L)  # Session server implementation
│   │   ├── FileSystemProjectSessionRepository.cs  (879 L)
│   │   ├── FileSystemFoundrySessionRepository.cs  (715 L)
│   │   ├── SessionContextStorage.cs  (45 L)
│   │   ├── MaestroDirectoryInitializer.cs (62 L)
│   │   └── CommandExecutors/
│   │       ├── ControlCommandExecutor.cs
│   │       ├── MaestroCommandExecutor.cs
│   │       └── ShellCommandExecutor.cs
│   │
│   ├── BlockStore/                          --- DISCOVERY & VALIDATION ---
│   │   ├── FileSystemBlockDiscoveryService.cs (838 L) # Scans *.block.json
│   │   ├── FileSystemBlockRepository.cs     (267 L)
│   │   ├── SystemBlockService.cs            (164 L)
│   │   ├── JsonSchemaBlockValidator.cs      (200 L)
│   │   └── Handlers/                        # Parsing per block type
│   │       ├── IBlockTypeHandler.cs           (9 L)
│   │       ├── AgentBlockHandler.cs          (43 L)
│   │       ├── ToolBlockHandler.cs           (63 L)
│   │       ├── WorkflowBlockHandler.cs       (45 L)
│   │       ├── InferenceBlockHandler.cs      (55 L)
│   │       ├── DecisionBlockHandler.cs       (44 L)
│   │       ├── PromptBlockHandler.cs         (61 L)
│   │       ├── TriggerBlockHandler.cs        (42 L)
│   │       └── ValidatorBlockHandler.cs      (42 L)
│   │
│   ├── Testing/                             --- CONTRACTS (Phase 54) ---
│   │   ├── ContractTestRunner.cs   (553 L)  # Runs contract tests + FitnessScore
│   │   └── FileSystemBlockTestRepository.cs
│   │
│   ├── Fitness/                             --- FITNESS ---
│   │   ├── FitnessService.cs       (201 L)
│   │   ├── FileSystemModelProfileRepository.cs
│   │   └── FileSystemTaskEntropyRepository.cs
│   │
│   ├── LLMGateway/                          --- LLM ---
│   │   ├── LLMProviderGateway.cs            # Single gateway -> LLM-Provider :5010
│   │   └── LLMProviderService.cs
│   ├── Context/
│   │   ├── ContextAssembler.cs
│   │   ├── InMemoryConversationManager.cs
│   │   └── SlidingWindowContextProcessor.cs
│   ├── Memory/
│   │   └── FileSystemMemoryManager.cs
│   ├── Workspaces/
│   │   ├── WorkspaceService.cs, WorkspaceGateway.cs
│   │   ├── FileSystemWorkspaceRepository.cs
│   │   └── WorkspaceBlockResolver.cs
│   ├── Orchestration/
│   │   ├── OrchestratorService.cs, WorkflowExecutor.cs
│   │   ├── DataFlowManager.cs, ExecutionGraph.cs
│   ├── Publishing/
│   │   └── FileSystemBlockPublisher.cs
│   ├── Cli/ Containers/ Training/ Metrics/ Monitoring/ ...
│   └── ...
│
├── Maestro.Api/                             -- API LAYER --
│   ├── Program.cs                           # DI registration (all executors)
│   ├── Controllers/
│   │   ├── SessionsController.cs   (838 L)  # REST sessions
│   │   ├── BlocksController.cs     (768 L)  # REST blocks
│   │   ├── ContractsController.cs   (67 L)  # Phase 54 — contract CRUD
│   │   ├── ContractTestController.cs (87 L) # Phase 54 — run contract tests
│   │   ├── FitnessController.cs    (352 L)
│   │   ├── WorkspacesController.cs (765 L)
│   │   └── 25+ other controllers
│   ├── Hubs/                                # SignalR real-time
│   │   ├── SessionHub.cs, ExecutionHub.cs, BlockHub.cs, ...
│   └── Middleware/ Security/ Configuration/
│
content/system/
├── contracts/                               --- Phase 54 ---
│   ├── maestro-assistant.contract.json  (257 L, 3 features, 16 tests)
│   ├── test-designer.contract.json      (183 L, 4 features, 24 tests)
│   ├── agent-creator.contract.json      (128 L, 5 features)
│   └── block-forge.contract.json        (104 L, 4 features)
├── blocks/
│   ├── agents/    (18 agents with config.nodes)
│   └── tools/     (25 atomic tool blocks)
└── templates/
    ├── agent-nodes/                         --- Phase 53 ---
    │   ├── agent-loop-standard.json
    │   ├── agent-loop-planning.json
    │   └── agent-loop-simple.json
    └── sessions/  (*.session.json templates)
```

---

## 2. Inheritance Hierarchy — Block Executors

```
IBlockExecutor                                     (Application layer interface)
│
├─ MultiNodeBlockExecutor [abstract, 155 L]        Phase 53 — composite base
│  │  ExecuteAsync()
│  │    -> PrepareExecutionAsync()      (subclass)
│  │    -> ExecuteConfigNodesAsync()    (NodeExecutionEngine)
│  │    -> ExtractResultAsync()         (subclass)
│  │
│  ├─ AgentBlockExecutor [124 L]                   Conversational agents
│  │     Prepare: create/reuse persistent conversation, add user prompt
│  │     Extract: read _agentResult from context
│  │
│  ├─ ToolBlockExecutor [78 L]                     Composite tools
│  │     Prepare: map inputs from caller
│  │     Extract: map outputs from block schema
│  │
│  └─ WorkflowBlockExecutor [37 L]                 Workflows
│        Prepare: pass-through
│        Extract: return all variables
│
├─ LLMBlockExecutorBase [abstract, 295 L]          LLM plumbing base
│  │  TryLoadMockResponse(), ResolveModelId(),
│  │  ResolveGenerationParams(), ResolveTemplate(),
│  │  ParseOutputs(), ExtractJson()
│  │
│  └─ InferenceBlockExecutor [231 L]               Single LLM call
│
├─ ResponseParserBlockExecutor [192 L]             Parse LLM response -> tool_call | text | step-complete
├─ ToolDispatcherBlockExecutor [185 L]             Dispatch tool_call -> blockRef via registry
├─ ConversationReadBlockExecutor [52 L]            Read messages from conversation
├─ ConversationAppendBlockExecutor [50 L]          Append message to conversation
├─ MessageBuilderBlockExecutor [82 L]              Build structured messages from template
├─ ShellBlockExecutor [147 L]                      Execute shell/git commands
├─ FileReadBlockExecutor [68 L]                    Read file content
├─ FileWriteBlockExecutor [62 L]                   Write file content (Phase 54)
├─ FileEditBlockExecutor [84 L]                    Edit file old->new (Phase 54)
├─ TreeDocumenterBlockExecutor [126 L]             Generate file tree documentation
├─ PhaseBlockExecutor [104 L]                      Phase status management
├─ DecisionBlockExecutor [89 L]                    LLM-assisted branching
├─ ValidatorBlockExecutor [93 L]                   Input validation
├─ ContextBlockExecutor [221 L]                    Context assembly
├─ MemoryBlockExecutor [261 L]                     Persistent knowledge stores
├─ ConversationBlockExecutor [181 L]               Conversation lifecycle
├─ PromptBlockExecutor [55 L]                      Simple prompt resolution
├─ TriggerBlockExecutor [67 L]                     Event forwarding
└─ CompositeBlockExecutor [49 L]                   Generic composition
```

---

## 3. Session/Execution Engine Decomposition

```
┌──────────────────────────┐
│    EntryPointExecutor    │ (207 L)
│  Entry point lifecycle:  │
│  resolve -> load -> run  │
└────────────┬─────────────┘
             │ creates & orchestrates
     ┌───────┼───────────────────┐
     ▼       ▼                   ▼
┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│ NodeExecution    │  │ SessionState     │  │ BlockExecutor     │
│ Engine (834 L)   │  │ Manager (670 L)  │  │ Registry (18 L)   │
│                  │  │                  │  │                   │
│ Built-in control │  │ Execution tree,  │  │ blockType ->      │
│ flow:            │  │ logs, metrics,   │  │ IBlockExecutor    │
│ while,           │  │ phase tracking,  │  │ dispatch          │
│ conditional,     │  │ active block     │  │                   │
│ sequence,        │  │ state            │  │                   │
│ parallel, phase  │  │                  │  │                   │
│                  │  │                  │  │                   │
│ Implements       │  │                  │  │                   │
│ INodeExecution-  │  │                  │  │                   │
│ Callback         │  │                  │  │                   │
└────────┬─────────┘  └──────────────────┘  └───────────────────┘
         │ dispatches to INodeHandler registry
   ┌─────┼──────────────────────┐
   ▼     ▼                      ▼
┌────────────────┐ ┌─────────────────────┐ ┌──────────────────────┐
│ ForEachNode    │ │ BlockRefHandler     │ │ SetVariableNode      │
│ Handler(503 L) │ │ (273 L)             │ │ Handler (183 L)      │
│                │ │                     │ │                      │
│ for-each loop, │ │ Block resolution,   │ │ Template resolve,    │
│ source resolve,│ │ input building,     │ │ JSON parsing,        │
│ checkpoint     │ │ executor dispatch,  │ │ append mode,         │
│ resume         │ │ output serialization│ │ embedded array       │
└────────────────┘ └─────────────────────┘ └──────────────────────┘
         │ all handlers use (static helpers)
   ┌─────┼──────────────┐
   ▼     ▼              ▼
┌────────────┐ ┌────────────────┐ ┌─────────────┐
│ Template   │ │ Condition      │ │ Session     │
│ Resolver   │ │ Evaluator      │ │ Helper      │
│ (201 L)    │ │ (113 L)        │ │ (292 L)     │
└────────────┘ └────────────────┘ └─────────────┘
```

### Adding a New Node Type

1. Create `MyNodeHandler : INodeHandler` in `Sessions/NodeHandlers/`
2. Set `NodeType => "my-type"`
3. Register in `Program.cs` as `INodeHandler`
4. Zero changes to `NodeExecutionEngine` — the handler registry picks it up automatically

---

## 4. Fitness & Contract System

```
┌───────────────────────────┐
│   ContractTestController  │ (87 L) — POST /api/contracts/{id}/test
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│    ContractTestRunner     │ (553 L)
│  1. Load contract JSON    │
│  2. Run tests per feature │
│  3. Call FitnessScore     │
│  4. Return results        │
└─────────────┬─────────────┘
              │ uses
    ┌─────────┼──────────────┐
    ▼         ▼              ▼
┌──────────┐ ┌────────────┐ ┌─────────────┐
│ Fitness  │ │ Model      │ │ Task        │
│ Score    │ │ Profile    │ │ Entropy     │
│ (306 L)  │ │ (370 L)    │ │ (182 L)     │
│          │ │            │ │             │
│Calculate │ │ Provider,  │ │ Feature     │
│(P*S*W)/  │ │ cost data, │ │ count,      │
│ C^lambda │ │ speed      │ │ complexity  │
└──────┬───┘ └────────────┘ └─────────────┘
       ▼
┌──────────────────┐
│ContractTestResult│ (118 L)
│ .PerformanceScore│ (raw P, 0-1)
│ .FitnessBreakdown│ (full formula)
└──────────────────┘

Contracts (JSON, tests inside):
  maestro-assistant.contract.json  — 3 features, 16 tests
  test-designer.contract.json     — 4 features, 24 tests
  agent-creator.contract.json     — 5 features
  block-forge.contract.json       — 4 features
```

---

## 5. Quantitative Summary

| Layer | Files | Total Lines |
|-------|-------|-------------|
| BlockExecutors/ | 26 .cs | ~3,800 L |
| Sessions/ | 14 .cs | ~4,860 L |
| BlockStore/ | 13 .cs | ~1,870 L |
| Testing/ + Fitness/ | 5 .cs | ~2,220 L |
| Api/Controllers/ | 31 .cs | ~10,190 L |
| Domain/ValueObjects/ | 20+ .cs | ~2,500 L |

**Largest files** (candidates for future extraction):

| File | Lines | Notes |
|------|-------|-------|
| NodeExecutionEngine.cs | 834 | Phase 53-C: decomposed via INodeHandler |
| FileSystemProjectSessionRepository.cs | 879 | CRUD — inherently large |
| FileSystemBlockDiscoveryService.cs | 838 | File scanning — inherently large |
| SessionsController.cs | 838 | REST endpoints — many routes |
| BlocksController.cs | 768 | REST endpoints — many routes |
| WorkspacesController.cs | 765 | REST endpoints — many routes |
| SessionStateManager.cs | 670 | State management — single responsibility |

---

## 6. NodeExecutionEngine — Decomposition (COMPLETED Phase 53-C)

| Before (1,792 L) | After | Lines | Reduction |
|-------------------|-------|-------|-----------|
| NodeExecutionEngine (monolith) | NodeExecutionEngine (control flow only) | 834 | -53% |
| (inline) | ForEachNodeHandler | 503 | extracted |
| (inline) | BlockRefHandler | 273 | extracted |
| (inline) | SetVariableNodeHandler | 183 | extracted |
| (inline) | INodeHandler + INodeExecutionCallback + NodeExecutionContext | 85 | new interface |
| **Total** | | **1,878** | +86 lines (interfaces) |

### What Stays in the Engine (834 lines)
- Main dispatch loop with checkpoint/resume
- while, conditional, sequence, parallel, phase (tightly coupled to display tree + checkpoint)
- `CheckPauseAsync` (pause/resume lifecycle)
- Handler registry dispatch (nodeType -> INodeHandler)

### What Was Extracted
- **ForEachNodeHandler**: for-each iteration, source resolution (JArray/JsonElement/JObject/string), checkpoint resume, item result processing
- **BlockRefHandler**: block resolution via BlockDiscoveryService, input building, executor dispatch, output serialization, LLM activity logging
- **SetVariableNodeHandler**: template resolution, JSON parsing (JToken), append mode, embedded array extraction

### Extension Point
New node types = new `INodeHandler`, registered in DI. Zero engine changes.

---

*See also: [execution.md](execution.md), [blocks.md](blocks.md), [sessions.md](sessions.md)*
