✨ Feature : MAESTRO-5D – Commit Description Workflow & MCP Server Foundation

# 🎯 Purpose
This PR delivers the Commit Description workflow and the MCP/CLI server foundation (Phase 5D). It wires a new commit-generator workflow into the execution stack, adds block definitions and handlers for commit description, tools and validators, and provides a minimal MCP/CLI PoC and server scaffolding to run and discover workflows remotely. The changes bundle backend execution improvements, block discovery and schemas, frontend wiring for execution controls, and end-to-end tests for the new commit workflow.

# 📋 Changes Summary
This branch contains changes across multiple layers: Domain, Application, Infrastructure, API/Presentation, Frontend, Blocks, Tools, Tests and Docs. Highlights below.

- Domain
  - Add `ExecutionId`, `BlockExecutionState`, `ExecutionMetrics` value objects and `ExecutionContext` entity updates to track checkpoints, logs and active branches.
  - Add `RetryPolicy` and `DecisionResult` under domain execution types.

- Application
  - Add `ExecutionCoordinator` (in-memory queue) and `IWorkflowExecutor`/`IWorkflowOrchestration` interfaces for orchestration.
  - Introduce `IVariableResolver`, `IExecutionRepository`, `IExecutionEngine` and `IExecutionErrorHandler` interfaces.
  - DTOs: `BlockExecutionResult`, `BlockType`.

- Infrastructure
  - Add `ExecutionEngine`, `WorkflowExecutor`, `ExecutionGraph`, and `DataFlowManager` for DAG execution and data flow between blocks.
  - Implement a registry and multiple `BlockExecutor` implementations: Prompt, Inference, Tool, Decision, Validator, Trigger, Agent, Composite (nested workflow) and a `BlockExecutorRegistry`.
  - Block discovery and repository: `FileSystemBlockDiscoveryService`, `FileSystemBlockRepository`, and file-schema validation via `JsonSchemaBlockValidator` (NJsonSchema).
  - Persistence: `FileSystemExecutionRepository` for checkpointing execution contexts.
  - Monitoring & error handling: `ExecutionErrorHandler`, `ExecutionMonitor` improvements and `SignalRExecutionMonitor` for real-time events.
  - Variable resolution implementation in `VariableResolver`.

- API / Presentation
  - Add `WorkflowExecutionController` with endpoints to start, resume and query executions.
  - SignalR hubs: `ExecutionHub`, `BlockHub`, and SignalR client interfaces to stream lifecycle events.
  - `BlocksController` additions for block discovery/publishing endpoints.

- Frontend
  - Add `ExecutionBar` component, execution wiring in `realExecutionService.ts`, and SignalR client code (`blockHub` service) to subscribe to execution events.
  - Minor editor and canvas updates to surface execution status and controls.

- Blocks & Tools
  - Add `blocks/workflows/commit-generator` workflow with `nodes.json`, `connections.json`, unit tests and README.
  - Add new blocks for `prompts/commit-description`, `inference/describe-commit`, and `tools/git-diff` with example scripts and test fixtures.
  - Add validator block `commit-format` with custom rules and tests.

- CLI / MCP PoC & Tools
  - Add `tools/maestro-cli` and `tools/maestro-mcp` packages with basic integration tests and README. These provide a proof-of-concept for running workflows and discovery from a separate client.

- Tests
  - Add/extend many unit and integration tests in `backend/tests/*` for execution engine, block executors, discovery, persistence and SignalR monitoring.
  - Add workflow integration tests for the commit-generator end-to-end flow.

- Docs
  - Add/update Phase 5 docs, security sandboxing guidance, block schema references and issue checklists under `docs/` and `docs/issues/`.

# 🏗️ Technical Details

- Commit-generator workflow
  - The commit-generator is a composite workflow that uses a `git-diff` tool block, an `describe-commit` inference block (LLM), and a `commit-description` prompt block to produce suggested commit messages. Outputs flow via `ExecutionGraph` dataflow mappings.

- Execution model & persistence
  - `ExecutionEngine` orchestrates block execution using a `BlockExecutorRegistry`. Each block may define `retry` and `onError` strategies; the engine persists checkpoint state via `IExecutionRepository` (file-backed default) to allow resume and inspection.

- Variable resolution
  - `VariableResolver` resolves `${variables.*}` and `${env.*}` tokens iteratively with depth protection to avoid cycles.

- Block discovery & validation
  - `FileSystemBlockDiscoveryService` finds block definitions on disk; `JsonSchemaBlockValidator` validates `block.json`, `nodes.json`, and `connections.json` against schemas in `docs/schemas/`.

- MCP / CLI PoC
  - `tools/maestro-mcp` provides a small server and `tools/maestro-cli` a client to discover and invoke workflows remotely (PoC). They talk to the API endpoints added in `Maestro.Api` and exercise block discovery/publishing flows.

# 🧪 Testing

Run tests from repository root:

```bash
cd backend
dotnet test Maestro.sln
```

Run targeted test projects:

```bash
dotnet test tests/Maestro.Execution.Tests/Maestro.Execution.Tests.csproj
dotnet test tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj
```

Frontend quick run (dev):

```bash
cd frontend
npm install
npm run dev
```

Notes:
- I ran unit tests locally for the new execution tests during development; they passed. CI should run the full matrix.
- Some integration tests (SignalR, filesystem discovery, CLI/MCP) may require environment adjustments or paths on CI; see test fixtures and `docs/mcp-setup.md` for local setup.

# 📖 Documentation

- Updated issues and guides: `docs/issues/phase-5d-commit-workflow-mcp.md`, `docs/PHASE-5-DOCUMENTATION.md`, `docs/SECURITY-SANDBOXING.md`.
- Block schemas: `docs/schemas/block.schema.json`, `docs/schemas/workflow-nodes.schema.json`, `docs/schemas/connections.schema.json`.
- MCP/CLI READMEs: `tools/maestro-cli/README.md`, `tools/maestro-mcp/README.md`.

# 🚀 Deployment Notes

- Persistence: Default `FileSystemExecutionRepository` is file-backed. For production, replace with a durable store (database or blob storage) and ensure a migration strategy for existing checkpoints.
- Ensure `NJsonSchema` (or required NuGet package) is available in CI images and included in `Maestro.Infrastructure` project.
- LLM provider environment variables (OpenAI/Anthropic/etc.) are unchanged; verify provider keys are present in target environments if inference blocks are used.
- Frontend uses SignalR — ensure CORS and SignalR endpoints are reachable from deployed frontend.

# 🔄 Migration Guide

- No breaking DB schema migrations introduced. API additions are additive (new endpoints for execution and block publishing). Review clients that may rely on older `BlocksController` behavior.

# 📸 Screenshots / Examples

- Frontend wiring is scaffolded; run frontend and backend locally to view the `ExecutionBar` and real-time execution events.

# 🔗 Related Issues

- Branch: feat/MAESTRO-5D-commit-description-workflow-mcp-server-foundation (this branch)
- Related ADRs: see `docs/adr/` for model-agnostic design and execution architecture rationale.

# 👥 Review Notes

- Focus review on:
  - `blocks/workflows/commit-generator` nodes/connections and handler mappings.
  - `ExecutionEngine` orchestration (retry/backoff, `onError` strategies, checkpointing and resume semantics).
  - `ToolBlockExecutor` and script/tool sandboxing — security risk surface.
  - MCP/CLI server endpoints: discovery, publish and invoke flows in `Maestro.Api` and `tools/maestro-mcp`.
  - SignalR hubs and `SignalRExecutionMonitor` ordering and event semantics.

- Known risks & mitigations:
  - `ExecutionCoordinator` is in-memory and not durable — plan to replace with durable queue (Redis/Service Bus) for production.
  - Tool/script execution must be sandboxed in a secure runtime (OS container / restricted permissions) before enabling on production.

# Checklist for merge

- [ ] CI green (build + tests)
- [ ] Security review for Tool/Agent executors
- [ ] Confirm `NJsonSchema` availability in CI images
- [ ] Decide durable queue strategy for `ExecutionCoordinator`

---

If you want, I can push this branch and open the PR against `main` and attach this description as the PR body. I can also split large infra changes into smaller follow-ups if desired.
