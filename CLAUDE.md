# Claude Code Guidelines for Maestro

This document establishes the philosophy, architecture principles, and development practices for the Maestro project.

## Communication Style

**Be critical and honest.** When something in the codebase is poorly designed, badly documented, inconsistent, or missing — say so directly. Don't sugarcoat problems or avoid pointing out gaps. If a guide exists but isn't referenced, say it. If the architecture says one thing but the code does another, flag it. The user values honest assessment over diplomatic silence.

When asked for an opinion, give a real one with reasoning. Don't hedge with "it depends" unless it genuinely does. If there are tradeoffs, name them concretely.

## No Legacy Support (MANDATORY)

**No legacy support.** When a system is replaced, remove the old code entirely. Never maintain deprecated code alongside new implementations. Clean break, no backward compatibility shims. Dead code = confusion + maintenance burden. Delete it.

## Block Development Workflow (MANDATORY)

> **This is the canonical workflow for creating blocks. Skipping steps = broken traceability.**

**Read the full pipeline guide:** `docs/guides/users/full-pipeline.md`

### The Flow

```
1. WORKSPACE    →  Create/use a workspace bound to a repo
2. FOUNDRY      →  Create a foundry session per block to develop/train
3. TEST         →  Measure fitness, iterate (change prompts, models, architecture)
4. PUBLISH      →  When fitness >= threshold, publish the block
5. PROJECT      →  Use published blocks in a project session for real work
```

### Rules

- **Always work inside a workspace.** Never create blocks "loose" in `content/system/blocks/` without a workspace context for traceability.
- **One foundry session per block.** Each block gets its own session for development and training.
- **Test multiple models.** If one model fails (SmolLM2 doesn't follow format), try at least 2 others before concluding the block doesn't work.
- **Never stop at the first obstacle.** If a prompt fails, reformulate it. If a model fails, switch models. If infrastructure breaks, fix it. The only valid reason to stop is a fundamental technical impossibility (GPU crash, API permanently down).
- **Publish before using in production.** Don't use untested blocks in project sessions.

### Reference Guides

| Guide | Content |
|-------|---------|
| `docs/guides/users/full-pipeline.md` | **Complete end-to-end workflow** — Foundry → Publish → Project |
| `docs/guides/users/foundry-sessions.md` | Foundry session templates, entry points, variables, approval system |
| `docs/guides/users/foundry-detailed.md` | Advanced foundry features |
| `docs/guides/users/project-sessions.md` | Project session usage |
| `docs/guides/ai-agents/creating-blocks.md` | Block JSON structure, types, registration |

## Developing Maestro vs Using Maestro (CRITICAL DISTINCTION)

> **Maestro is the app we are building. Sessions are for using Maestro on target projects.**

- **Developing Maestro** = modifying C# backend, CLI code, TUI components, block definitions. This is normal software development — edit files, build, test. NO session needed.
- **Using Maestro** = running agents/workflows on a target project (e.g., Cantante) via sessions. This REQUIRES a workspace, a session with a meaningful name, and the monitor.

**NEVER create a session to "test" Maestro infrastructure.** To verify backend fixes, use `curl` or API calls directly. Sessions are for real work on real projects.

## Session & Workspace Rules (MANDATORY)

### Session Creation Checklist

Every session MUST follow this exact procedure:

```powershell
# 1. Identify or create the workspace
node index.js workspace info <workspace-id>

# 2. Create the session WITH a meaningful feature name (not "test" or "fix")
node index.js session create --type project --name "<Project> - <Feature>" --repo "<path>" --template <template> --start

# 3. IMMEDIATELY add to workspace (no --workspace flag exists yet on session create)
node index.js workspace add-session <workspace-id> <session-id>

# 4. Launch the monitor BEFORE any invoke
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"

# 5. THEN invoke entry points
node index.js session invoke <session-id> <entry-point> --input key=value
```

### Naming Rules

- Session names MUST describe the work being done on the target project: `"Cantante - File Tree Module"`, `"Cantante - Accessibility TTS"`
- NEVER use infrastructure/test names: ~~"Monitor Fix Test"~~, ~~"Agent Test"~~, ~~"Debug Session"~~

### Monitor

The TUI monitor MUST be running before any `session invoke`. Use `Start-Process` to open a new terminal window:

```powershell
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"
```

Reference: `docs/phases/PHASE-26/PIPELINE-MONITORING-GUIDE.md`

## Maestro Core Philosophy

**Read the full philosophy documents before making architectural decisions:**
- `docs/system/philosophy/MAESTRO-PHILOSOPHY.md` — Core vision (specialization, orchestration, block hierarchy)
- `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` — V2 evolution (fitness model, self-improvement)
- `docs/phases/PHASE-8/README.md` — Generic vs Specific separation (the cardinal rule)

### Everything is a Block — The Universal Unit

> *"There is no Agent entity. There is no Tool entity. There are only Blocks with different types."*

- **Every block has metrics**: success rate, avg time, cost, score — not just agents
- **An agent is an enriched inference block**: same interface (prompt → response), more internal capability (workflow inside)
- **Tools are discovered, not declared**: an agent's internal inference block selects tools from the session scope at runtime
- **One discovery system**: `FileSystemBlockDiscoveryService` finds everything
- **One file format**: `*.block.json` for all types
- **One API**: `/api/blocks` with filters (`?type=agent`, `?designation=tool`)

See: `docs/phases/PHASE-18/ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT.md`

#### Agent = Inference Block (CRITICAL — Read This)

> *"An agent is an inference block whose prompt describes available tools. The executor is mechanical plumbing — all intelligence lives in the block's prompt."*

Agent and inference blocks share a base executor class (`LLMBlockExecutorBase`) that provides common LLM plumbing: mock loading, model resolution, template resolution, output parsing, JSON extraction.

- `InferenceBlockExecutor` — thin: template → single LLM call → response
- `AgentBlockExecutor` — thin: systemPrompt → multi-turn agentic loop → tool calls via CLI → response

Both are **mechanical plumbing**. All content (system prompts, tool descriptions, context strategy) comes from block config/files — never from C#.

**What this means concretely:**

| WRONG | RIGHT |
|-------|-------|
| Hardcoded tool lists in C# (`var availableTools = new List<string> { ... }`) | Tools described in the block's `system-prompt.md` or `config.systemPrompt` |
| `tools.json` file loaded by special handler | Available tools listed in the prompt text, like any prompt template |
| Default system prompt built in C# | System prompt MUST exist in block config/file — if missing, error (no fallback) |
| Separate `AgentDefinition` / `ToolDefinition` entities | One entity: `BlockDefinition` with `metadata.designation` |
| Separate `AgentMetrics` / `ToolMetrics` classes | One metrics system on `BlockDefinition` |
| Content-specific logic in executor code | Executor is mechanical: load prompt, call LLM, parse tool calls, loop |

**Tool availability comes from the prompt**, not from code:
```markdown
# system-prompt.md for an agent block
You have ONE tool: maestro_cli. Use it to interact with the system.
Available commands:
- Run a block: {"tool":"maestro_cli","args":{"command":"run <block-id> --input key=value"}}
- Read a file: {"tool":"maestro_cli","args":{"command":"run file-read --input path=<path>"}}
...
```

**Executor class hierarchy:**
```
LLMBlockExecutorBase (abstract — shared LLM plumbing)
├── InferenceBlockExecutor (single call)
└── AgentBlockExecutor (agentic loop, no hardcoded content)
```

**Litmus test**: Can you create a new agent by writing ONLY a `.block.json` file with a `system-prompt.md`? If yes, correct. If you need to modify C# executor code — the architecture is violated.

ADR: `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md`

### The Cardinal Rule: Generic Infrastructure, Specific Content

> *"L'infrastructure est generique, le contenu est specifique. C'est la force de Maestro."*

**Infrastructure** (C# backend, CLI, TUI monitor) is GENERIC — it works with ANY session type.
**Content** (phases, prompts, workflows, evaluation criteria) is SPECIFIC — it lives in JSON templates and session variables.

**Litmus test**: Can a new session type be created with ONLY JSON changes (template + block)?
If the answer is no, the architecture is violated.

Concrete examples of what this means:

| WRONG (specific in infrastructure) | RIGHT (specific in data) |
|-------------------------------------|--------------------------|
| `if (workflowId.Contains("agent-improvement"))` in C# | Read workflow block from `IBlockDiscoveryService`, dispatch generically |
| `InitializePhases()` creating 4 hardcoded phases in C# | `_phases` defined in session template JSON |
| Hardcoded LLM prompts in `EntryPointExecutor` | `_workflowConfig.*.llm.systemPrompt` in session variables |
| `GenerateFallbackCommitTool()` in C# | No fallback — error is an error |
| CLI command `session reset-phases` for a specific session type | Generic `session set-var <id> <key> <value>` via CLI |
| PowerShell script to set up a specific session | CLI commands: `session create`, `session import-template`, `session start`, `session invoke` |

### LLM-Provider Owns All Provider Logic (CRITICAL)

> *"Maestro ne connait pas la logique des providers. Maestro sait quels modeles sont disponibles et fait la demande au provider."*

**Maestro has ONE LLM gateway** — `LLMProviderGateway` — which talks to the LLM-Provider .NET API. **All provider-specific logic lives in LLM-Provider, never in Maestro.**

#### LLM-Provider Architecture (C:\LLM-Provider)

LLM-Provider is a **.NET Clean Architecture solution** (`C:\LLM-Provider\dotnet\`) with a Python FastAPI service (`C:\LLM-Provider\api\`) used ONLY for local GPU inference via PyTorch.

```
LLM-Provider .NET API (port 5010) ← THE multi-provider gateway
├── LLMProvider.Domain         ← ProviderType enum (Azure=1, Local=2, OpenAI=3, Anthropic=4, Ollama=5, AzureInference=6)
├── LLMProvider.Application    ← ILLMProvider, ILLMProviderFactory, LLMOrchestrationService
├── LLMProvider.Infrastructure ← Factories, queue, persistence
├── LLMProvider.Web            ← REST API: /api/v1/llm/complete, /api/v1/models, /api/v1/health
├── LLMProvider.AzureProvider         ← Azure OpenAI (ALREADY IMPLEMENTED)
├── LLMProvider.AzureInferenceProvider ← Azure AI Inference (ALREADY IMPLEMENTED)
├── LLMProvider.LocalProvider          ← Proxy to Python FastAPI (ALREADY IMPLEMENTED)
│       └── Python FastAPI (port 8000) ← PyTorch/CUDA inference ONLY
└── LLMProvider.ClaudeCodeProvider     ← Claude Code CLI (TO CREATE)
```

**Key interfaces (already exist):**
- `ILLMProvider` — CompleteAsync, StreamCompleteAsync, IsAvailableAsync, GetAvailableModelsAsync
- `ILLMProviderFactory` — GetProvider(ProviderType), GetProviderForModelAsync(ModelId)
- `LLMOrchestrationService` — Routes requests to the correct provider by model_id

Maestro sends a `model_id` with each request. LLM-Provider's orchestration service routes it to the correct provider (local GPU, Claude Code CLI, Azure, etc.). Maestro does not know HOW a model is served — only that it sent a prompt and received a response.

**Litmus test**: Can a new LLM provider (e.g., Ollama, OpenAI) be added without changing ANY C# code in Maestro?
If the answer is no, the architecture is violated.

| WRONG (provider logic in Maestro) | RIGHT (provider logic in LLM-Provider) |
|-------------------------------------|----------------------------------------|
| `ClaudeCodeGateway` in Maestro C# | `ClaudeCodeLLMProvider` in LLM-Provider .NET |
| `AnthropicApiGateway` in Maestro C# | `AnthropicLLMProvider` in LLM-Provider .NET |
| `MultiProviderGateway` in Maestro C# | `LLMOrchestrationService` + `ILLMProviderFactory` in LLM-Provider |
| `AzureOpenAIGateway` in Maestro C# | `AzureLLMProvider` in LLM-Provider .NET (already exists) |
| `if (useAzure) ... else ...` in Maestro Program.cs | Provider config in LLM-Provider `appsettings.json` |
| Multiple `ILLMGateway` implementations in Maestro | ONE `LLMProviderGateway` implementation in Maestro |

**What Maestro DOES own:**
- `ILLMGateway` interface (Send, Stream, SwitchModel)
- `LLMProviderGateway` — the single HTTP client to LLM-Provider .NET API
- `ILLMProviderService` / `LLMProviderService` — admin operations (health, model listing)
- Retry logic, timeout handling, error propagation
- Block executors that build prompts and parse responses

**What Maestro NEVER owns:**
- Provider-specific code (Claude, Anthropic, Azure, OpenAI, Ollama...)
- Multi-provider routing logic
- Provider configuration (API keys, CLI paths, endpoints)
- Knowledge of how a model is served (local GPU vs cloud API vs CLI)

**Adding a new provider** = create a new `LLMProvider.XxxProvider` project in `C:\LLM-Provider\dotnet\`, implement `ILLMProvider`, register via DI in `Program.cs`. Zero Maestro changes.

### CLI-First: Everything Goes Through the CLI

> *"An agent has ONE tool: the maestro-cli block. Through this block, it can do EVERYTHING."*

- **ALL operations** go through the CLI — for humans AND agents
- The CLI provides **generic operations** on sessions, blocks, variables, entry points
- The CLI NEVER contains session-specific logic
- **NEVER write custom scripts** (PowerShell, bash) for operations the CLI should handle
- If the CLI doesn't support an operation, **add it to the CLI as a generic command** — don't work around it

```bash
# GOOD: Generic CLI commands
node index.js session create --type foundry --name "My Session"
node index.js session import-template <id> foundry-default
node index.js session start <id>
node index.js session invoke <id> start
node index.js session set-var <id> _phases '[...]'
node index.js monitor <id>

# BAD: Custom scripts for specific sessions
powershell.exe -File scripts/setup-foundry-session.ps1
powershell.exe -File scripts/reset-and-restart-session.ps1
```

### No Silent Failures

Errors must be visible. If the LLM Provider is down, the node fails with status `error` in the execution tree. There is no fallback content, no fake data, no silent degradation. The monitor shows the error in red. The user decides what to do.

### Self-Describing Sessions

Sessions carry their own behavior entirely through variables and template data:
- **`_phases`** — The session defines what its phases are (or has none)
- **`_monitorDescriptor`** — The session defines how the TUI displays it (or uses default)
- **`_workflowConfig`** — The session defines prompts, output paths, eval criteria
- **`entryPoints`** — The session maps command names to workflow block IDs
- **`monitorWidgets`** — The session defines custom widgets with `$.variables.xxx` data binding

The infrastructure reads these — it NEVER creates them. If a variable is missing, log a warning and continue with empty/default display. Don't invent data.

### Everything is a Block

> *"Le type d'un block definit son interface (comment on l'utilise), pas son implementation (ce qu'il contient)."*

- Blocks form a hierarchy: Workflows (orchestration) > Agents (specialization) > Tools (atomic)
- A tool can internally contain workflows, agents, validators — its complexity is invisible to callers
- Conditions, loops, and parallelism are BLOCKS, not arrows (tree structure, not graph)
- Even system agents are blocks with the same interface, metrics, and fitness tracking
- **An agent IS an inference block** — same executor, same interface. The agent's tools are described in its prompt, not in special config or code. See the "Agent = Inference Block" section above for the full rule.

### Specialization over Generality

- Small specialized LLMs with focused context > large generalist LLMs
- One tool = one responsibility
- Composition and orchestration over monolithic solutions
- Model selection is configuration-driven via `ILLMGateway`, never hardcoded

### Documentation Structure

The docs are organized hierarchically. Start from general, drill down to specific:

```
docs/
├── system/              ← Architecture & philosophy (start here)
│   ├── philosophy/      ← WHY Maestro exists
│   ├── architecture/    ← HOW it's built (blocks, sessions, execution)
│   ├── design-decisions/← ADRs
│   └── conventions/     ← Rules (variables, errors, schema)
├── tools/               ← CLI, TUI monitor, frontend reference
├── guides/              ← For AI agents and users
├── phases/              ← Per-phase docs (PHASE-4..10, current = PHASE-8)
├── operations/          ← Deployment, Docker, security
└── archive/             ← Completed/outdated
```

### Key Reference Documents

| Document | When to read |
|----------|-------------|
| `docs/system/README.md` | First — system overview, cardinal rules |
| `docs/guides/users/full-pipeline.md` | **Before creating ANY block** — the mandatory workflow |
| `docs/guides/users/foundry-sessions.md` | Before working with foundry sessions |
| `docs/guides/ai-agents/creating-blocks.md` | Before writing block JSON |
| `docs/system/architecture/sessions.md` | Before ANY session/infrastructure work |
| `docs/system/architecture/blocks.md` | Before block/workflow work |
| `docs/system/architecture/execution.md` | Before execution engine work |
| `docs/system/conventions/error-handling.md` | Before adding error handling |
| `docs/tools/cli/README.md` | Before proposing CLI commands |
| `docs/phases/PHASE-8/README.md` | For current phase context |
| `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` | Core philosophy and fitness model |

## Development Environment Startup

**IMPORTANT: Always use the startup script to manage services. Never start services manually.**

### Starting Services

Use the PowerShell script at `dev-scripts/dev-start.ps1`:

```powershell
# Start all services (LLM-Provider, Backend, Frontend) - local mode
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1

# Start with specific options
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -BackendOnly    # Backend + LLM only
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -SkipLLM        # No LLM-Provider
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -Mode docker    # Use Docker
```

### Stopping Services

```powershell
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -Stop
```

### Service Ports

| Service      | Port | Health Check URL                    |
|--------------|------|-------------------------------------|
| LLM-Provider | 5010 | http://localhost:5010/api/v1/health/ |
| Backend      | 5000 | http://localhost:5000/              |
| Frontend     | 5173 | http://localhost:5173/              |

### CLI Commands

The Maestro CLI is at `maestro-cli/index.js`:

```bash
cd C:\Meastro\maestro-cli
node index.js health              # Check services health
node index.js list-blocks         # List all blocks
node index.js llm                 # Check LLM status
node index.js execute <block-id>  # Execute a block
```

## Testing Requirements

### Before Making Changes

1. **Run tests before starting work**
   - Frontend: `cd frontend && npm test -- --run`
   - Backend: `cd backend && dotnet test`

2. **Understand test baseline**
   - Note the number of passing/failing tests
   - Do not introduce new test failures
   - Known pre-existing failures (ReactFlow mock issues in canvas tests) are acceptable

### After Making Changes

1. **Run tests after every significant change**
   - All tests that passed before must still pass
   - New features should include tests where practical

2. **Verify the frontend build**
   - `cd frontend && npm run build`

3. **Verify the backend build**
   - `cd backend && dotnet build`
   - If processes lock DLLs: `taskkill /F /IM Maestro.Api.exe`

4. **Verify API behavior for session/variable changes**
   - After fixing serialization: `curl` the API endpoint and check the response JSON
   - After fixing session lifecycle: create a session, start it, check `session info` shows correct status
   - After template import: verify `_phases` and `_monitorDescriptor` are proper objects (not nested arrays)
   - **Never claim "it's fixed" based on build success alone** — always verify the actual user-facing behavior

5. **Verify monitor rendering for TUI changes**
   - Start the monitor, check that phases show names and correct statuses
   - Invoke an entry point and verify the execution tree updates
   - If you can't see the TUI, verify the API responses the monitor depends on

## Architecture Guidelines

### Frontend (React + TypeScript)

- **Block types are defined in** `frontend/src/registry/blockTypeDefinitions.ts`
- **Block type registry** at `frontend/src/registry/BlockTypeRegistry.ts` defines containment rules
- **Block type interface** at `frontend/src/types/block.types.ts` defines the `Block` interface
- **isAtomic property** determines if a block can contain children:
  - Atomic blocks (`isAtomic: true`): `prompt`, `instruction`, `tool`, `decision`, `validator`, `trigger`, `inference`, `script`
  - Composite blocks (`isAtomic: false`): `workflow`, `agent`, `task`

### Backend (C# .NET)

- **BlockDto** at `backend/src/Maestro.Application/DTOs/BlockDto.cs` must include all properties from `BlockDefinition`
- **BlockDefinition** at `backend/src/Maestro.Domain/Entities/BlockDefinition.cs` is the domain entity
- **isAtomic property** MUST be included in API responses - missing this causes UI bugs

### Session Architecture Principles

#### Generic vs Specific Separation (CRITICAL)

Infrastructure code (`backend/src/Maestro.Infrastructure/`) MUST NOT contain session-specific logic:
- **Phase definitions** → session template variables (`_phases`), never hardcoded in C#
- **Monitor descriptors** → session template variables (`_monitorDescriptor`), never hardcoded
- **Workflow structure** → workflow block JSON (`config.nodes`), never hardcoded
- **LLM prompts, output paths, evaluation criteria** → session template variables (`_workflowConfig`), never hardcoded
- **Workflow routing** → read from block metadata, never `if (workflowId.Contains(...))`

**Litmus test**: Can a new session type be created with ONLY JSON changes (template + block)?
If the answer is no, the architecture is violated.

#### Entry Point Execution
- `EntryPointExecutor` bridges Session layer and Execution layer
- Reads workflow structure from `IBlockRepository` (block's `config.nodes`)
- Reads display config from session variables (set by template import)
- New workflows require only new JSON data, zero C# changes

#### Session Variable Conventions
`_` prefix = system/infrastructure variables:

| Variable | Purpose |
|----------|---------|
| `_phases` | Phase definitions for TUI phase-list component |
| `_monitorDescriptor` | TUI layout and component configuration |
| `_executionTree` | Runtime execution tree state |
| `_activeBlock` | Currently executing block detail |
| `_executionLog` | Execution log entries (FIFO 50) |
| `_artifacts` | Files produced by the session |
| `_activeWorkflow` | Currently active workflow ID |
| `_workflowConfig` | Per-workflow config (prompts, paths, eval criteria) |

No-prefix = session-specific state (`currentFitness`, `scoreHistory`, etc.)

#### Template-Driven Configuration
Session templates (`content/system/templates/sessions/*.session.json`) carry ALL session-specific data:
- `variables` — Initial state including `_phases`, `_monitorDescriptor`, `_workflowConfig`
- `entryPoints` — Maps names to workflow block IDs
- `monitorWidgets` — Widget configs (legacy, used when no `_monitorDescriptor`)
- Template import is done by CLI (`importSessionTemplate` in `maestro-cli/index.js`)
- CLI reads JSON, calls PUT APIs for variables, entry points, widgets
- No backend code changes needed for new session types

### API Contract

When adding properties to domain entities:
1. Add the property to the domain entity
2. Add the property to the DTO
3. Update `FromDomain` method to map the property
4. Update file loaders to read the property from JSON

## TUI Monitor Architecture

### How the Monitor Works

The TUI monitor (`node index.js monitor <session-id>`) polls `GET /api/sessions/{id}` every 2 seconds and renders session state.

**Critical**: The API requires **full UUIDs**, not short ID prefixes. The CLI resolves short IDs to full UUIDs before calling the API, but the monitor's internal API client does NOT — it passes the ID as-is. If the monitor receives a short ID, it will get 404.

### Monitor Data Dependencies

The monitor reads these session variables. **If they're malformed, the monitor breaks silently.**

| Variable | Expected Format | What Breaks If Wrong |
|----------|----------------|---------------------|
| `_phases` | `[{id: string, name: string, status: string, description?: string}, ...]` | Phases show as white/unnamed, wrong expand behavior |
| `_monitorDescriptor` | `{layout: {mode: string, zones: {...}}, components: [...]}` | Monitor layout collapses, shows nothing |
| `_executionTree` | `[{id, name, status, children: [], output?}, ...]` | Execution tree empty |
| `_executionLog` | `[{time, level, msg}, ...]` | Log panel empty |
| `_llmActivity` | `[{nodeId, time, duration, promptPreview, responsePreview}, ...]` | LLM panel empty |

### Verifying Monitor Health

After setting variables or invoking entry points, **always verify the data is correct**:

```bash
# Verify _phases is an array of objects with id/name/status
curl -s http://localhost:5000/api/sessions/<FULL-UUID>/variables/_phases | python -m json.tool

# Verify _monitorDescriptor has layout.mode and components
curl -s http://localhost:5000/api/sessions/<FULL-UUID>/variables/_monitorDescriptor | python -m json.tool

# Check the full session response that the monitor sees
curl -s http://localhost:5000/api/sessions/<FULL-UUID> | python -m json.tool | head -50
```

If `_phases` shows nested empty arrays like `[[[[]],...]...]` instead of objects, the **JsonElement serialization bug** has struck (see pitfall below).

### Session Invoke vs Run

- `node index.js run <block-id>` — Direct block execution. **No session context, no monitoring.** Results only in CLI output.
- `node index.js session invoke <id> <entry-point>` — Executes through the session. Updates `_executionTree`, `_executionLog`, `_llmActivity`. **The monitor can see it.**

Entry points map to block IDs. The `EntryPointExecutor` dispatches based on block type:
- **Workflow block** → walks `config.nodes`, each node appears in `_executionTree`
- **Agent block** → runs the agent loop, appears as a single node in `_executionTree`
- **Block without config.nodes** → executes as a "passthrough" (does nothing useful)

**Rule**: For the monitor to show meaningful data, always use `session invoke`, never `run`.

## Common Pitfalls

### JsonElement corruption in session variables (CRITICAL)
**Cause**: When the API receives session variables via `PUT /api/sessions/{id}/variables/{key}`, the `SetVariableRequest.Value` (type `object`) is deserialized by `System.Text.Json` as a `JsonElement`, not as native types. When the session is later serialized to disk, `JsonElement` values inside `Dictionary<string, object>` get corrupted — objects become nested empty arrays.
**Symptoms**: `_phases` shows as `[[[[]],[[]],...]...]` instead of `[{id:"plan",name:"Planning",...},...]`. Monitor shows phases without names. `_monitorDescriptor` layout is broken.
**Fix**: The `SetVariable` action in `SessionsController.cs` must normalize `JsonElement` to native types using `NormalizeObjectValue()` before storing. This converts `JsonElement.Object` → `Dictionary<string, object>`, `JsonElement.Array` → `List<object>`, `JsonElement.String` → `string`, etc.
**Verification**: After setting a variable, `curl` the API to verify the response contains proper JSON objects, not nested arrays.
**Location**: `SessionsController.cs` → `SetVariable()`, `FileSystemProjectSessionRepository.cs` → `SerializeSession()`, `FileSystemFoundrySessionRepository.cs` → `SerializeSession()`

### Session status "created" after start (Idle deserialization bug)
**Cause**: `Session.GetSessionStatus()` returns `SessionStatus.Idle` for active sessions with no running workflow. The file repository serializes this as `"status": "idle"`. On deserialization, `MapSessionStatusToContainerStatus()` has no mapping for `SessionStatus.Idle`, so it defaults to `ContainerSessionStatus.Created`.
**Fix**: Add `SessionStatus.Idle => ContainerSessionStatus.Active` in both `FileSystemProjectSessionRepository.cs` and `FileSystemFoundrySessionRepository.cs`.

### All blocks showing as "composite"
**Cause**: `isAtomic` property missing from `BlockDto`
**Fix**: Ensure `BlockDto.FromDomain` includes `IsAtomic = block.IsAtomic`

### Tests expecting wrong type count
**Cause**: New block types added without updating tests
**Fix**: Check `blockTypeDefinitions.ts` for current count and update test expectations

### Test mocks not matching import paths
**Cause**: `vi.mock()` path doesn't match the import path
**Example**: Import is `../store/blockStore` but mock is `../../store/blockStore`
**Fix**: Mock path must exactly match the relative import path

### Backend build fails with "file is locked"
**Cause**: Maestro.Api process is running
**Fix**: `taskkill /F /IM Maestro.Api.exe` before building

### Block API requests hang or timeout
**Cause**: Async deadlock from `.Result` calls or circular dependencies
**Fix**:
- Never use `.Result` inside async methods - use `await` instead
- Check for circular DI dependencies (e.g., AgentBlockExecutor ↔ BlockExecutorRegistry)

### Session-specific logic hardcoded in infrastructure
**Cause**: Putting phase names, LLM prompts, workflow steps, or output paths directly in C# code (e.g., `EntryPointExecutor`)
**Fix**: Put data in session template variables (`_workflowConfig`, `_phases`) and workflow block JSON (`config.nodes`)
**Test**: If adding a new session type requires C# changes, the architecture is wrong

### Writing custom scripts instead of using the CLI
**Cause**: Writing PowerShell/bash scripts to create sessions, set variables, invoke entry points
**Fix**: Use existing CLI commands (`session create`, `session start`, `session invoke`, `session set-var`). If a generic command is missing, add it to the CLI — don't write a one-off script.
**Rule**: The CLI is the universal interface. Scripts hide operations from metrics, logging, and audit.

### Using fallback content when a service is down
**Cause**: Catching LLM/service errors and returning fake data to keep the workflow running
**Fix**: Let the error propagate. The node gets status `error` in the execution tree. The monitor shows it. The user decides. No silent degradation.

### Proposing session-specific CLI commands
**Cause**: Suggesting commands like `session reset-phases` or `session restart-workflow` that only make sense for one session type
**Fix**: Use generic operations: `session set-var <id> <key> <value>` to reset any variable. The CLI operates on generic abstractions (sessions, variables, blocks, entry points), never on session-specific concepts (phases, fitness, iterations).

### Treating agents as special entities
**Cause**: Creating separate entities, metrics classes, or hardcoding content in executor code for agents — treating them as fundamentally different from inference blocks.
**Examples of violations to watch for**:
- Hardcoded tool lists (`var availableTools = new List<string> { ... }`) in C#
- Default system prompt built in C# instead of block config
- `tools.json` file loaded by handler
- Separate `AgentDefinition` / `ToolDefinition` entities alongside `BlockDefinition`
**Fix**: Agent and inference share `LLMBlockExecutorBase`. Both executors are thin and mechanical. All content (system prompts, tools) lives in block config/files. One entity (`BlockDefinition`), one metrics system. The `LegacyToolMapping` is marked `[Obsolete]` for backwards compat.
**ADRs**: `docs/phases/PHASE-18/ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT.md`, `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md`
**Current state**: Refactoring COMPLETED (Phase 26). `AgentDefinition` and `ToolDefinition` deleted. Executors are thin. No hardcoded content.

### Creating blocks outside the workspace/foundry workflow
**Cause**: Writing block JSON files directly into `content/system/blocks/` without a workspace or foundry session, because it's faster
**Fix**: Always follow the canonical workflow: create a workspace → create a foundry session → develop/test the block → publish when fitness is good → use in project session. See `docs/guides/users/full-pipeline.md`.
**Why**: Without the workflow, there's no traceability. The user can't see what was done, what was tested, or what fitness was achieved. Blocks created "loose" are invisible to the session/workspace system.

### Stopping at the first obstacle instead of iterating
**Cause**: A model doesn't follow instructions, a prompt doesn't work, or infrastructure has a bug — and the response is to note "next steps" instead of fixing it
**Fix**: Iterate. If SmolLM2 fails, try Qwen2.5-Coder. If the prompt is bad, rewrite it. If infrastructure is broken, fix the code. Only stop for fundamental technical impossibilities. "Prochaine etape" is not a deliverable.

### Putting LLM provider logic in Maestro instead of LLM-Provider
**Cause**: Creating gateway classes in Maestro C# for specific providers (ClaudeCodeGateway, AnthropicApiGateway, MultiProviderGateway) instead of adding them to LLM-Provider .NET.
**Fix**: Maestro has ONE gateway (`LLMProviderGateway`) that talks to LLM-Provider .NET API (`C:\LLM-Provider\dotnet\`). All provider-specific logic lives in LLM-Provider .NET as `ILLMProvider` implementations (e.g., `AzureLLMProvider`, `LocalLLMProvider`, `ClaudeCodeLLMProvider`). Adding a new provider = create a new project in LLM-Provider .NET, zero Maestro changes.
**Concrete violation that happened**: Phase 26-B initially created `MultiProviderGateway`, `CliAgentGateway`, `ClaudeCodeGateway`, `AnthropicApiGateway` in `Maestro.Infrastructure/LLMGateway/`. This was discarded. The correct approach is to add providers in `C:\LLM-Provider\dotnet\src\LLMProvider.XxxProvider\`.

### Assuming LLM-Provider is Python-only
**Cause**: Only looking at `C:\LLM-Provider\api\` (Python FastAPI) and missing `C:\LLM-Provider\dotnet\` (full .NET Clean Architecture with ILLMProvider, ILLMProviderFactory, orchestration service, 3 concrete providers).
**Fix**: LLM-Provider is a .NET solution that CONTAINS a Python service for local GPU inference only. The multi-provider gateway, routing, factory, conversations, token tracking, and API are all in .NET. Always check `C:\LLM-Provider\dotnet\` first.
**Note**: Maestro currently bypasses the .NET API and talks directly to Python (port 8000). This needs to be fixed — Maestro should point to the .NET API (port 5010).

### Shell commands fail on Windows
**Cause**: Unix commands like `mkdir -p` don't work on Windows cmd
**Fix**: Use PowerShell commands: `powershell -Command "New-Item -ItemType Directory -Force -Path path1, path2"`

## Test Coverage Areas

### Critical Areas (must be tested)

1. **BlockTypeRegistry**
   - Type containment rules (`canContain`)
   - Block creation (`getDefaultBlock`)
   - Config validation (`validateConfig`)

2. **Block Store**
   - Add/remove/update blocks
   - Parent-child relationships
   - History (undo/redo)

3. **Navigation**
   - Route synchronization
   - Block selection
   - Breadcrumb generation

### Known Test Infrastructure Issues

The following tests have pre-existing mock issues and may fail:
- `BlockCanvas.test.tsx` - ReactFlowProvider mock
- `BlockEditPage.test.tsx` - ReactFlowProvider mock
- `AtomicBlockEditorPage.test.tsx` - Store mock issues
- `Breadcrumb.test.tsx` - Store mock issues

These should be fixed but are not blocking.

## Commit Guidelines

1. Run all tests before committing
2. Note any intentional test changes in commit message
3. Do not commit if new tests are failing (unless they're pre-existing failures)
