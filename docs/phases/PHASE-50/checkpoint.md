# Phase 50 — Checkpoint

**Date**: 2026-03-04
**Status**: COMPLETE (50-A + 50-B + 50-C + E2E Dogfooding)

## 50-A: Contract System (DONE)

- Added `contract` field to `BlockDefinition.cs` (C# domain)
- Added `Contract` to `BlockDto.cs` with `FromDomain()` mapping
- `BlocksController.cs`: `?contract=` query filter on `GetBlocks` and `SearchBlocks`
- `ContractsController.cs`: new `GET /api/contracts`, `GET /api/contracts/{id}`
- Contract definitions in `content/system/contracts/maestro-assistant.contract.json`
- `maestro-assistant` block: added `contract` + 5 capabilities
- `maestro-assistant-compact` block: added `contract` + 1 capability (conversation)
- `contract-resolver.ts`: `getBlocksForContract()`, `computeActiveFeatures()`
- `services/index.ts`: barrel exports for contract resolver
- `contract-resolver.test.ts`: 5 tests for feature gating

## 50-B: Adapt-Optimize + SDK Fitness (DONE)

- Removed `@ts-nocheck` from `adapt-optimize.ts`
- Added typed interfaces: `AdaptClient`, `CliColors`, `StrategyOptions`, `LLMModelInfo`, `ExecutionResult`, `SandboxManagerInstance`
- All `any` parameters replaced with proper types
- Kept CJS `require()`/`module.exports` (consistent with CLI package)
- SDK: Added `FitnessScore`, `FitnessBreakdown`, `FitnessConfig`, `CalculateFitnessRequest`, `ModelFitnessRanking`, `AggregateFitnessStats` to types.ts
- Created `domains/fitness.ts`: 7 API methods (calculate, history, stats, config, updateConfig, resetConfig, leaderboard)
- Registered `fitness` domain in `MaestroClient`

## 50-C: Assistant Selector + Demo Data (DONE)

- Created `AssistantSelector.ts` component: fetches blocks by contract, shows features ✓/✗
- Added 2 demo assistant blocks to `demo-data.ts` (full + compact, with contract field)
- `DemoApiClient`: contract query support (`?contract=`), `DEMO_CONTRACTS`, `/api/contracts/` endpoints
- Wired into `App.ts`: shows after provider setup (first-run only), saves choice to config
- `activeAgent` state initialized from saved config (`_selectedAssistant`)
- Defensive: `getBlocksForContract` handles non-array responses gracefully
- Updated `first-run.test.ts` to handle new AssistantSelector step
- Created `AssistantSelector.test.ts`: 4 tests (loading, block display, features, counts)
- Updated block count in visual-gate tests (12 → 14)

## E2E Dogfooding Fixes (post 50-C)

Three bugs found during real-mode dogfooding, fixed in-session:

1. **Backend ignores `?contract=` param** → Changed to client-side filter: fetch all blocks, filter by name containing contractId + blockType=agent
2. **`/api/contracts/` returns 404** → Added `EMBEDDED_CONTRACTS` fallback in `contract-resolver.ts`
3. **`totalFeatures` wrong for non-first blocks** → Changed from `blocks[0]` to `Math.max()` across all blocks

Final dogfooding score: **5/5** (all 14 tests PASS, clean rendering, natural flow)

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (maestro-code) | 0 errors |
| `npx vitest run` (maestro-code) | 141 tests, 16 files, ALL PASS |
| `node tests/real-demo-check.cjs` | 4/4 PASS |
| Backend `dotnet build` | 0 errors (when not locked by running process) |
| adapt-optimize tests | 16/16 pass |

## Test Count Change

- Before: 134 tests (15 files)
- After: 141 tests (16 files)
- New tests: +3 DemoApiClient contract tests, +4 AssistantSelector tests

## Files Created

- `packages/maestro-code/components/AssistantSelector.ts`
- `packages/maestro-code/tests/AssistantSelector.test.ts`
- `packages/maestro-code/services/contract-resolver.ts` (50-A)
- `packages/maestro-code/tests/contract-resolver.test.ts` (50-A)
- `packages/maestro-client/src/domains/fitness.ts` (50-B)
- `content/system/contracts/maestro-assistant.contract.json` (50-A)
- `apps/backend/src/Maestro.Api/Controllers/ContractsController.cs` (50-A)

## Files Modified

- `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs`
- `apps/backend/src/Maestro.Application/DTOs/BlockDto.cs`
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs`
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs`
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockRepository.cs`
- `packages/maestro-code/App.ts`
- `packages/maestro-code/services/index.ts`
- `packages/maestro-code/mocks/DemoApiClient.ts`
- `packages/maestro-code/mocks/demo-data.ts`
- `packages/maestro-code/tests/DemoApiClient.test.ts`
- `packages/maestro-code/tests/first-run.test.ts`
- `packages/maestro-code/tests/visual-gate.test.ts`
- `packages/maestro-cli/adapt-optimize.ts`
- `packages/maestro-client/src/types.ts`
- `packages/maestro-client/src/client.ts`
- `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json`
- `content/system/blocks/system/maestro-assistant-compact/maestro-assistant-compact.agent.block.json`
