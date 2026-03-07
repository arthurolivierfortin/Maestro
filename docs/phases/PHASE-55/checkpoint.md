# Phase 55-A Checkpoint

## Status: DONE

## Date: 2026-03-06

## What was delivered

Created `IBlockDependencyService` with full implementation and 4 new API endpoints for block dependency analysis.

### Files created
- `apps/backend/src/Maestro.Application/Interfaces/IBlockDependencyService.cs` — interface with 4 methods
- `apps/backend/src/Maestro.Application/DTOs/BlockManifestDtos.cs` — `BlockDependencyManifest`, `DependencyValidationResult`, `MissingDependency` records
- `apps/backend/src/Maestro.Infrastructure/BlockStore/BlockDependencyService.cs` — full implementation ported from `adapt-optimize.ts`

### Files modified
- `apps/backend/src/Maestro.Api/Program.cs` — DI registration (`AddScoped<IBlockDependencyService, BlockDependencyService>`)
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs`:
  - Injected `IBlockDependencyService` in constructor
  - Added `Model` and `PlanningModel` properties to `BlockChildInfo` DTO
  - Updated `GetBlockChildrenAsync()` to extract model overrides from `node.config`
  - Added 4 new endpoints:
    - `GET /api/blocks/{id}/manifest` — full recursive dependency tree
    - `GET /api/blocks/{id}/manifest/models` — flat model-to-blockIds map
    - `GET /api/blocks/{id}/manifest/validate` — missing blocks + circular refs
    - `GET /api/blocks/{id}/dependents` — reverse dependency lookup

### Design decisions
- Named the DTO `BlockDependencyManifest` (not `BlockManifest`) to avoid collision with the existing publish-time `BlockManifest` in `Maestro.Application.Interfaces.IBlockPublisher`
- Unresolved blockRefs produce `BlockType = "unresolved"` stubs instead of throwing exceptions
- Circular references produce `BlockType = "circular-ref"` stubs with cycle detection via `HashSet<string>`
- `GetDependentsAsync` checks first-level nodes only (direct references), matching the TS implementation behavior
- blockRef normalization strips `category/` prefix (e.g. `tools/file-read` -> `file-read`) matching existing `BlocksController` pattern

## Build result
```
0 Error(s)
30 Warning(s) (all pre-existing)
```

## Test result
```
Passed! - Failed: 0, Passed: 93, Skipped: 0, Total: 93
```

---

# Phase 55-B Checkpoint

## Status: DONE

## Date: 2026-03-06

## What was delivered

Pre-execution dependency validation in `EntryPointExecutor` and enriched error messages in `BlockRefHandler` for missing block dependencies.

### Files modified

- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`:
  - Added `using Maestro.Application.DTOs` import
  - Resolved `IBlockDependencyService` from DI scope (nullable, via `GetService`)
  - Added `dependencyService` parameter to `ExecuteWorkflowAsync`
  - Added step 1b: pre-execution dependency validation after loading workflow block
  - Calls `dependencyService.ValidateAsync(blockId)` before execution starts
  - Logs WARNING (not error) for each missing block and each circular reference
  - Uses both `_logger.LogWarning()` and `stateManager.AppendExecutionLog(session, "warning", ...)` for dual visibility (structured logs + execution tree)
  - Wrapped in try/catch — validation failures never block execution
  - Saves session after logging warnings so TUI monitor can display them

- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs`:
  - Enriched the "Block not found" exception message at line 60
  - Before: `Block not found: {blockRefId}`
  - After: `Block not found: '{blockRefId}'. Referenced by node '{nodeId}'. Run 'maestro block deps <parent-block>' to see all dependencies.`
  - `nodeId` was already available from line 51

### Design decisions
- `IBlockDependencyService` resolved via `GetService` (nullable) not `GetRequiredService` — validation is a nice-to-have, not a hard dependency. If DI registration is missing, execution proceeds without validation.
- Validation runs ONLY when both `workflowBlock` and `dependencyService` are non-null — no point validating if the block itself wasn't found.
- WARNING level chosen deliberately: some blockRefs are dynamic template variables (e.g. `{{selectedBlock}}`) that can't be resolved statically. Missing = expected for those cases.
- Validation runs ONCE at entry point level, NOT per-node in BlockRefHandler. This avoids N+1 validation calls during execution.

## Build result
```
Build succeeded.
0 Error(s)
25 Warning(s) (all pre-existing)
```

## Test result
```
Passed! - Failed: 0, Passed: 93, Skipped: 0, Total: 93
```

---

# Phase 55-C Checkpoint

## Status: DONE

## Date: 2026-03-06

## What was delivered

Added dependency tree types and methods to the TypeScript SDK (`@maestro/client`), added `block deps` CLI command, and refactored `adapt-optimize.ts` to use the SDK instead of local manifest extraction.

### SDK changes (`packages/maestro-client/`)

**`src/types.ts`** — Added 4 new types:
- `BlockDependencyManifest` — recursive dependency tree node
- `ModelRequirement` — model with associated block IDs
- `MissingDependency` — unresolved blockRef info
- `DependencyValidationResult` — validation result with missing blocks and circular refs

**`src/domains/blocks.ts`** — Added 4 new methods:
- `manifest(id)` — `GET /api/blocks/{id}/manifest`
- `manifestModels(id)` — `GET /api/blocks/{id}/manifest/models`
- `validate(id)` — `GET /api/blocks/{id}/manifest/validate`
- `dependents(id)` — `GET /api/blocks/{id}/dependents`

**`index.ts`** — Re-exported new types: `BlockDependencyManifest`, `ModelRequirement`, `MissingDependency`, `DependencyValidationResult`

### CLI changes (`packages/maestro-cli/`)

**`api-client.ts`** — Added 4 adapter methods:
- `getBlockManifest(id)`, `getBlockManifestModels(id)`, `validateBlock(id)`, `getBlockDependents(id)`

**`cli.ts`** — Added `block deps` subcommand:
- `maestro block deps <blockId>` — tree view with models, validation
- `--json` — raw manifest JSON
- `--models` — model-to-blocks map JSON
- Updated help text and error message to include `deps`

**`adapt-optimize.ts`** — Refactored to use SDK:
- **Removed**: local `BlockManifest` interface, `extractManifest()` (100+ lines), `flattenModels()`, `collectModelBlocks()`
- **Added**: `import type { BlockDependencyManifest, DependencyValidationResult }` from `@maestro/client`
- **Added**: `modelMapToModelBlocks()` — derives `{ blockId, model }[]` from the model map
- **Updated**: `AdaptClient` interface with `getBlockManifest()`, `getBlockManifestModels()`, `validateBlock()`
- **Updated**: `AdaptResult.manifest` type from `BlockManifest` to `BlockDependencyManifest`
- **Updated**: `maestroAdapt()` — uses `client.getBlockManifest()` and `client.getBlockManifestModels()`
- **Updated**: `maestroOptimize()` — uses `client.getBlockManifestModels()` for recursive mode
- **Updated**: exports — removed `extractManifest`, `flattenModels`, `collectModelBlocks`; added `modelMapToModelBlocks`

**`tests/adapt-optimize.test.ts`** — Updated tests:
- Replaced `extractManifest`/`flattenModels`/`collectModelBlocks` test suites with `modelMapToModelBlocks` tests (5 test cases)
- Updated mock client with `getBlockManifest`, `getBlockManifestModels`, `validateBlock` methods
- All existing `detectModels`, `withBlockVariant`, `STRATEGIES` tests preserved

### Type check results
- **maestro-client**: 0 new errors (3 pre-existing: BlockFilter index signature, @microsoft/signalr missing)
- **maestro-cli**: 0 new errors (10 pre-existing: content/system/blocks formatDate.ts invalid characters)

### Test results
```
12 tests passed (adapt-optimize.test.ts)
```

### Design decisions
- Used `import type` for SDK types in CJS file — erased at compile time, no runtime impact
- Kept `FlatModelMap` interface locally since it serves as a readable alias for the `Record<string, string[]>` returned by the API
- `modelMapToModelBlocks()` skips entries ending with ` (planning)` to match the old `collectModelBlocks()` behavior of excluding planning-only references
- `blockDepsCmd` in cli.ts uses tree rendering with `|--` and `+--` connectors for visual clarity

---

# Phase 55-T Checkpoint

## Status: DONE

## Date: 2026-03-06

## What was delivered

12 backend unit tests and 7 integration tests covering all Phase 55 functionality.

### Couche 1 — Type Check
- `dotnet build` : 0 errors
- `npx tsc --noEmit` maestro-client : 0 new errors (3 pre-existing)
- `npx tsc --noEmit` maestro-cli : 0 new errors (10 pre-existing)

### Couche 2 — Tests unitaires backend

**File created**: `apps/backend/tests/Maestro.Execution.Tests/BlockDependencyServiceTests.cs`

12 tests, all passing:
- `GetManifestAsync_AtomicBlock_ReturnsEmptyChildren`
- `GetManifestAsync_CompositeBlock_ResolvesChildren`
- `GetManifestAsync_ExtractsModelFromConfig`
- `GetManifestAsync_DeepNesting_ConditionalWhileForEach`
- `GetManifestAsync_DetectsCycles`
- `GetManifestAsync_UnresolvedBlockRef_ReturnsUnresolved`
- `GetRequiredModelsAsync_FlattensCorrectly`
- `GetRequiredModelsAsync_IncludesPlanningModel`
- `ValidateAsync_AllResolved_ReturnsValid`
- `ValidateAsync_MissingDeps_ReturnsInvalid`
- `ValidateAsync_CircularRefs_ReturnsInvalid`
- `GetDependentsAsync_FindsReferencingBlocks`

```
Passed! - Failed: 0, Passed: 12, Skipped: 0 (BlockDependencyService filter)
Passed! - Failed: 0, Passed: 89, Skipped: 0 (full Execution.Tests)
```

### Couche 5 — Tests d'integration API

**File created**: `packages/maestro-integration-tests/tests/level-1-api/block-manifest.test.ts`

7 tests defined:
- returns manifest with children for composite block
- returns empty children for atomic block
- includes model info in manifest
- returns model requirements map
- validates all dependencies for known block
- returns 404 for non-existent block
- returns dependents for a block

TypeScript compiles cleanly (0 new errors). Tests require running backend to execute.

### adapt-optimize tests
```
12 tests passed (adapt-optimize.test.ts) — modelMapToModelBlocks + existing tests
```

---

# Phase 55 — Overall Status

## Status: COMPLETE

All 4 sub-phases delivered:
- **55-A**: IBlockDependencyService + 4 API endpoints — DONE
- **55-B**: Pre-execution validation + enriched errors — DONE
- **55-C**: SDK + CLI `block deps` + adapt-optimize refactor — DONE
- **55-T**: 12 unit tests + 7 integration tests — DONE

### Verification summary
- `dotnet build`: 0 errors
- `dotnet test` (Execution.Tests): 89/89 passed (12 new BlockDependencyService tests)
- `dotnet test` (Domain.Tests): 93/93 passed
- `npx tsc --noEmit` (maestro-client, maestro-cli): 0 new errors
- `npx vitest run adapt-optimize.test.ts`: 12/12 passed
