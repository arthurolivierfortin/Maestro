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
