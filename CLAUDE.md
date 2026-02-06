# Claude Code Guidelines for Maestro

This document establishes the philosophy, architecture principles, and development practices for the Maestro project.

## Maestro Core Philosophy

**Read the full philosophy documents before making architectural decisions:**
- `docs/system/philosophy/MAESTRO-PHILOSOPHY.md` — Core vision (specialization, orchestration, block hierarchy)
- `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` — V2 evolution (fitness model, self-improvement)
- `docs/phases/PHASE-8/README.md` — Generic vs Specific separation (the cardinal rule)

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

Use the PowerShell script at `scripts/dev-start.ps1`:

```powershell
# Start all services (LLM-Provider, Backend, Frontend) - local mode
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# Start with specific options
powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -BackendOnly    # Backend + LLM only
powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -SkipLLM        # No LLM-Provider
powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -Mode docker    # Use Docker
```

### Stopping Services

```powershell
powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -Stop
```

### Service Ports

| Service      | Port | Health Check URL                    |
|--------------|------|-------------------------------------|
| LLM-Provider | 8000 | http://localhost:8000/health        |
| Backend      | 5000 | http://localhost:5000/              |
| Frontend     | 5173 | http://localhost:5173/              |

### CLI Commands

The Maestro CLI is at `tools/maestro-cli/index.js`:

```bash
cd C:\Meastro\tools\maestro-cli
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
Session templates (`data/foundry/templates/*.session.json`) carry ALL session-specific data:
- `variables` — Initial state including `_phases`, `_monitorDescriptor`, `_workflowConfig`
- `entryPoints` — Maps names to workflow block IDs
- `monitorWidgets` — Widget configs (legacy, used when no `_monitorDescriptor`)
- Template import is done by CLI (`importSessionTemplate` in `tools/maestro-cli/index.js`)
- CLI reads JSON, calls PUT APIs for variables, entry points, widgets
- No backend code changes needed for new session types

### API Contract

When adding properties to domain entities:
1. Add the property to the domain entity
2. Add the property to the DTO
3. Update `FromDomain` method to map the property
4. Update file loaders to read the property from JSON

## Common Pitfalls

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
