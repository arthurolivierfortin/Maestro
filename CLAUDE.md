# Claude Code Guidelines for Maestro

This document establishes development practices and testing requirements for the Maestro project.

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
