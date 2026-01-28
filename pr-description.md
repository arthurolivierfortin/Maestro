🏗️ Architecture : MAESTRO-6A – Unified Block Source Architecture

# 🎯 Purpose
This PR consolidates the backend into a single source-of-truth for block data (Phase 6A). It centralizes block discovery and reading in the backend, exposes a CRUD HTTP API for blocks, and updates tests and documentation to reflect the unified block-source architecture.

# 📋 Changes Summary
- Backend: Implemented BlocksController CRUD API and supporting repository to treat the backend as the single filesystem-backed block source.
- Testing: Added/updated integration tests validating BlocksController and block discovery behavior (see backend tests).
- Docs: Updated Phase 6A issue and completion summary documents to reflect implementation and acceptance of the unified block source approach.
- Build/CI: No breaking build changes expected; tests added to existing test projects.

# 🏗️ Technical Details
- Centralized block access via a backend repository (filesystem reader) so the API is the canonical source for blocks rather than ad-hoc CLI or multiple readers.
- `BlocksController` exposes standard CRUD: GET (list & single), POST (create/import), PUT (update), DELETE (remove).
- Domain and DTO boundaries preserved: controller maps to application DTOs; repository implements filesystem reading and mapping to domain objects.
- Integration tests exercise the full stack (controller → application → repository) to ensure the filesystem-backed approach behaves as expected across environments.

# 🧪 Testing
Run backend tests (runs unit + integration tests):

```powershell
dotnet test backend/tests
```

Run frontend tests (if validating UI changes):

```bash
npm test --prefix frontend
```

Key tests to check:
- `backend/tests/*BlocksControllerIntegrationTests*` — validates CRUD and discovery behavior.
- Any updated test fixtures that point to the unified blocks filesystem.

# 📖 Documentation
- Updated: `docs/issues/phase-6a-unified-block-source.md` — task list and acceptance criteria updated.
- Updated: `PHASE-6ABC-COMPLETION-SUMMARY.md` — marks Phase 6A as implemented.
- README / Unified Block Architecture section updated to describe the backend-as-source approach.

# 🚀 Deployment Notes
- No database migrations required.
- Deployment must ensure the backend service has access to the blocks filesystem (permissions, mount path). Validate any environment-specific file paths used by the repository.
- If CI creates test fixtures that mount a blocks folder, ensure those mounts exist in the target environment.

# 🔄 Migration Guide
Clients that previously read blocks directly from multiple sources should be migrated to use the Blocks API endpoints. Recommended steps:
1. Stop relying on local CLI filesystem reads in downstream integrations.
2. Replace direct reads with `GET /api/blocks` and `GET /api/blocks/{id}` calls.
3. If you previously wrote to local block files, use `POST /api/blocks` or the import endpoint instead.

# 📸 Screenshots / Examples
N/A for backend-only architecture changes.

# 🔗 Related Issues
- `docs/issues/phase-6a-unified-block-source.md` (Phase 6A tasks)
- `PHASE-6ABC-COMPLETION-SUMMARY.md`
- Branch: `feat/MAESTRO-6A-unified-block-source-architecture`

# 👥 Review Notes
- Focus on API contract stability: verify DTO shapes and HTTP status codes.
- Verify error handling for missing/malformed block files.
- Validate test fixtures are deterministic and do not depend on developer-local state.
- Performance: check that large block directories are paginated or streamed appropriately.

# ✅ Reviewer Checklist
- [ ] Run `dotnet test backend/tests` and confirm all tests pass
- [ ] Validate `BlocksController` endpoints (manual or via integration test)
- [ ] Confirm `docs/issues/phase-6a-unified-block-source.md` reflects the final acceptance state
- [ ] Confirm deployment environment provides access to the blocks filesystem

---

This file is generated to create the PR body for branch `feat/MAESTRO-6A-unified-block-source-architecture` against `development`.
⚙️ Feature : MAESTRO-5C – Implement Workflow Execution Engine and API

# 🎯 Purpose
This PR implements Phase 5C: a first-class workflow execution orchestration layer and API surface. It provides the core pieces required to run workflows end-to-end: execution state and checkpoints, retry and error strategies, composite/nested workflow execution, variable interpolation, schema-based validation for blocks, a minimal background coordinator, and SignalR hooks for real-time monitoring. The implementation is a scaffold intended for iteration and hardening; it is focused on correctness, testability, and respecting Clean Architecture boundaries.

# 📋 Changes Summary
This PR spans Domain, Application, Infrastructure, API, and Frontend layers. Highlights:

- Domain
  - Enhance `ExecutionContext` with active branch tracking, checkpoint metadata, and improved logging/metrics.
  - Add domain types: `RetryPolicy`, `DecisionResult`, `WorkflowDefinition`, and execution-related value objects.

- Application
  - Add `ExecutionCoordinator` (simple in-memory queue) to enqueue background workflow runs.
  - Introduce `IVariableResolver` and `BlockExecutionResult` DTOs.
  - Add `IExecutionErrorHandler` interface for pluggable error handling.

- Infrastructure
  - Implement core `ExecutionEngine` orchestrator with retry/backoff, `onError` strategies (StopWorkflow, SkipBlock, UseDefault), active-branch skipping, and checkpoint persistence hooks.
  - Add `CompositeBlockExecutor` to execute nested workflows and map child outputs to parent outputs.
  - Restore `JsonSchemaBlockValidator` using `NJsonSchema` to validate `block.json`, `nodes.json`, and `connections.json` during discovery and publishing.
  - Implement `VariableResolver` for `${variables.*}` and `${env.*}` interpolation.
  - Add `ExecutionErrorHandler` to persist failing contexts and emit logs.
  - Provide a set of block executors (Prompt, Inference, Tool, Decision, Validator, Trigger, Agent scaffolds) and a registry for executor lookup.
  - File-based persistence: add `FileSystemExecutionRepository` for checkpointing execution contexts.

- API / Presentation
  - Add `WorkflowExecutionController` endpoints to start executions (returns `executionId`), resume and query executions (scaffolded behavior persists checkpoint and enqueues work when available).
  - Add SignalR hubs and `SignalRExecutionMonitor` to publish execution lifecycle events for frontend consumption.

- Frontend
  - Add `realExecutionService.ts` (scaffold) to start executions and subscribe to SignalR events; update UI components to consume execution events (scaffolded wiring).

- Tests
  - Add and update multiple unit and integration tests under `backend/tests/*` for ExecutionEngine behavior, block executors, persistence, discovery, and SignalR monitors. Local execution tests passed during development.

- Docs
  - Update `docs/issues/phase-5c-workflow-orchestration.md` to reflect implemented Phase 5C checklist items and add JSON schema files under `docs/schemas/`.

# 🏗️ Technical Details

- Execution model
  - `ExecutionEngine` processes `BlockDefinition` graphs, runs executors via a registry, and persists checkpoints via `IExecutionRepository`.
  - Blocks support per-block `retry` config and `onError` strategies encoded in block config.
  - Decision blocks update `ExecutionContext.ActiveBranches` to enable branch routing and skipping.

- Error handling
  - `IExecutionErrorHandler` allows infrastructure to plug in custom handling (default persists and logs). The engine respects configured `onError` behavior and uses the handler for unexpected exceptions.

- Composite execution
  - Composite blocks invoke nested workflow execution using the same engine, producing a nested `ExecutionContext` whose outputs are mapped to the parent block outputs.

- Variable resolution
  - `VariableResolver` performs iterative token replacement for `${variables.key}` and `${env.KEY}` tokens, with a max depth to avoid infinite loops.

- Schema validation
  - `JsonSchemaBlockValidator` locates `docs/schemas/` (by walking directories or assembly base) and validates schema files using `NJsonSchema`.

# 🧪 Testing

Commands to run locally (from repository root):

```bash
cd backend
dotnet test Maestro.sln
```

Or run targeted projects for faster feedback:

```bash
dotnet test tests/Maestro.Execution.Tests/Maestro.Execution.Tests.csproj
dotnet test tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj
```

Notes:
- I executed `Maestro.Execution.Tests` locally and those tests passed. CI should run the full solution tests.
- Some integration tests (SignalR, file-system discovery) rely on environment or file paths; reviewers may need to adjust paths for CI or local environment.

# 📖 Documentation

- `docs/issues/phase-5c-workflow-orchestration.md` — updated checklist and implementation notes.
- `docs/schemas/` — contains `block.schema.json`, `workflow-nodes.schema.json`, and `connections.schema.json` used by the validator.

# 🚀 Deployment Notes

- Persistence: current execution checkpoints use the `FileSystemExecutionRepository` (file-backed). For production, replace or augment with a durable DB-backed repository.
- Environment variables for LLM gateways remain unchanged; ensure provider keys are present in deployment if using LLM integrations.

# 🔄 Migration Guide

- No breaking DB migrations. Execution persistence format is file-based; if migrating to a DB-backed repository, plan a migration path for existing checkpoints.

# 📸 Screenshots / Examples

- Frontend wiring is scaffolded; manually run frontend with backend to verify runtime behaviors and SignalR events.

# 🔗 Related Issues

- Branch: feat/MESTRO-5C-workflow-orchestration-multi-block-execution (this branch)
- See ADRs under `docs/adr/` for model-agnostic and architecture decisions.

# 👥 Review Notes

- Areas to review carefully:
  - `ExecutionEngine` orchestration logic (retry/backoff, `onError` strategies, checkpoint persistence).
  - `CompositeBlockExecutor` behavior and output mapping.
  - Block executor sandboxing (ToolBlockExecutor) — requires a security review before production use.
  - SignalR hooks and `IExecutionMonitor` contracts for ordering and event semantics.
  - `JsonSchemaBlockValidator` path discovery in CI environments.

- Known risks & mitigations:
  - `ExecutionCoordinator` is currently in-memory and not durable — replace with durable queue in future PR.
  - Tool execution sandboxing is best-effort; do not run untrusted scripts without proper OS/container isolation.

# Checklist for merge

- [ ] CI green (build + tests)
- [ ] Security review for Tool/Agent executors
- [ ] Confirm `NJsonSchema` availability in CI images
- [ ] Decide durable queue strategy for `ExecutionCoordinator`

---

If you want, I can push this branch and open the PR against `main` and attach this description as the PR body. I can also split large infra changes into smaller follow-ups if desired.
