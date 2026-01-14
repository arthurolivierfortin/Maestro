📡 Feature : MAESTRO-5B – Publish execution lifecycle events and SignalR monitoring

# 🎯 Purpose
This PR implements real-time execution monitoring and lifecycle event publishing across the execution engine, adds SignalR scaffolding and a SignalR-backed `IExecutionMonitor`, and includes tests and documentation updates required by Phase 5B (Block Execution Engine). It centralizes lifecycle notification logic so external clients (UI, real-time dashboards, or monitoring systems) can subscribe to execution progress and logs.

# 📋 Changes Summary
- Published execution lifecycle events from `ExecutionEngine`: `ExecutionStarted`, `Block/NodeStarted`, `Block/NodeCompleted`, `Block/NodeFailed`, `ExecutionCompleted`, `ExecutionFailed`, and `LogAdded`.
- Added SignalR integration: `ExecutionHub`, `IExecutionClient` and a `SignalRExecutionMonitor` implementation; mapped hub at `/hubs/execution` and registered the monitor in DI.
- Implemented LLM streaming forwarding and monitor publish calls in the inference executor path.
- Improved execution persistence and added FileSystem-backed execution repository tests.
- Added integration-style and unit tests for the SignalR monitor and streaming behavior.
- Updated Phase 5B checklist documentation to reflect completed items and remaining follow-ups.

# 🏗️ Technical Details
- Layers affected:
  - Presentation (`backend/src/Maestro.Api`): new `ExecutionHub`, hub mapping in `Program.cs`, minor controller updates.
  - Application (`backend/src/Maestro.Application`): expanded `IExecutionMonitor` interface and related contracts.
  - Infrastructure (`backend/src/Maestro.Infrastructure`): `ExecutionEngine` now emits lifecycle events; `SignalRExecutionMonitor` implemented; executors (Inference, Agent, Tool, Decision, Trigger) updated to publish logs/streaming data; persistence improvements in `FileSystemExecutionRepository`.
  - Tests (`backend/tests/*`): new unit and integration-style tests for streaming, persistence, and monitor behavior.

- Key design notes:
  - `IExecutionMonitor` is an application-layer abstraction used by `ExecutionEngine` and executors to publish progress and logs. This keeps the domain and orchestration decoupled from SignalR specifics.
  - `SignalRExecutionMonitor` uses the typed hub client interface `IExecutionClient` to forward events to connected clients.
  - Streaming LLM responses are consumed via the gateway streaming API and forwarded to `IExecutionMonitor.PublishTerminalOutputAsync` as partial chunks, with fallback to non-streaming calls.
  - The `ToolBlockExecutor` contains sandbox scaffolding and a best-effort `disableNetwork` mode; this is NOT secure for production and needs OS/container isolation for full hardening.

# 🧪 Testing
- Added and updated tests (run with `dotnet test`):
  - `InferenceBlockExecutorStreamingTests` — verifies streaming chunks are forwarded to the monitor and final result aggregation.
  - `FileSystemExecutionRepositoryPersistenceTests` / `FileSystemExecutionRepositoryTests` — verify save/load of `ExecutionContext`.
  - `SignalRExecutionMonitorTests` — unit tests asserting monitor forwards calls to the Hub client.
  - `ExecutionMonitorIntegrationTests` — integration-style test that starts the test server and connects a SignalR client to `/hubs/execution` to validate `ExecutionStarted` is received.

Run tests locally:
```bash
cd backend
dotnet test
```

# 📖 Documentation
- Updated `docs/issues/phase-5b-block-execution-engine.md` to mark published lifecycle events, SignalR scaffold, streaming, and tests added. The doc lists remaining work (sandbox hardening and broader end-to-end SignalR tests).

# 🚀 Deployment Notes
- New SignalR hub route: `/hubs/execution` — ensure the server is reachable by any real-time clients.
- No breaking API changes are introduced to existing REST endpoints, but the DI registration for `IExecutionMonitor` was extended; ensure DI registrations in `Program.cs` remain consistent if customizing monitors.

# 🔄 Migration Guide
- None required for existing persisted executions. New events are emitted but do not change persisted data schema.

# 🔗 Affected Files (high level)
- backend/src/Maestro.Api/Program.cs
- backend/src/Maestro.Api/Hubs/ExecutionHub.cs
- backend/src/Maestro.Api/Hubs/IExecutionClient.cs
- backend/src/Maestro.Application/Interfaces/IExecutionMonitor.cs
- backend/src/Maestro.Infrastructure/Execution/ExecutionEngine.cs
- backend/src/Maestro.Infrastructure/Monitoring/SignalRExecutionMonitor.cs
- backend/src/Maestro.Infrastructure/BlockExecutors/* (Inference, Agent, Tool, Decision, Trigger)
- backend/src/Maestro.Infrastructure/Persistence/FileSystemExecutionRepository.cs
- backend/tests/** (new/updated streaming, persistence, and SignalR tests)
- docs/issues/phase-5b-block-execution-engine.md

# 👥 Review Notes
- Pay close attention to `ExecutionEngine` changes — the engine now publishes lifecycle events at multiple points. Ensure the event semantics and ordering meet consumers' expectations.
- `ToolBlockExecutor` sandboxing is intentionally lightweight; do not treat current sandboxing as production-safe. Recommend blocking production merge until sandbox hardening or explicit accept of current limitations.
- SignalR integration tests are integration-style and may require stable timing; review test timeouts and WebApplicationFactory configuration for CI reliability.

# Checklist
- [x] Emit execution lifecycle events from `ExecutionEngine`
- [x] Add `ExecutionHub` and `IExecutionClient`
- [x] Implement `SignalRExecutionMonitor` and register hub route
- [x] Forward LLM streaming chunks to monitor and persist execution context
- [x] Add unit and integration-style tests for streaming, persistence, and monitor
- [x] Update Phase 5B documentation
- [ ] Harden tool sandbox (follow-up)
- [ ] Expand end-to-end SignalR tests and verify stability in CI (follow-up)

# Related Commits
- feat(infrastructure): add pause/resume/cancel support and persist execution state
- feat(infrastructure): add execution query/logging and executor enhancements
- feat(infrastructure): enable integration tests and JSON persistence
- docs(phase-5b): update checklist — streaming, agent loop, persistence tests, SignalR scaffold

# Next Steps
- Stage and commit any remaining unstaged changes then push the branch and open a PR targeting `main` with this description.
- Run the full test matrix in CI and stabilize any timing-sensitive SignalR integration tests.
- Plan a follow-up PR to implement secure sandboxing (container/OS-level) for `ToolBlockExecutor`.
🏛️ Feature : MAESTRO-5A – Filesystem-based Block Architecture and Frontend Realtime Integration

# 🎯 Purpose
This PR implements the filesystem-based block architecture (Phase 5A) and integrates realtime block updates into the frontend. It delivers the backend discovery/repository/validation plumbing, type-specific handler skeletons, SignalR-based block hub, and frontend wiring to consume discovered blocks and real-time events. The changes enable human-editable, git-friendly blocks, live updates in the UI, and basic end-to-end CRUD coverage via integration tests.

# 📋 Changes Summary
- Backend: Add filesystem block discovery, repository, JSON-schema validator, block handlers (skeletons), SignalR publisher, BlocksController endpoints, and application interfaces.
- Tests: Add unit and integration tests covering discovery, repository, handlers, validator, SignalR publisher, and a BlocksController integration test.
- Frontend: Wire realtime block updates via SignalR (`blockHub.ts`), expose `initRealBlockRealtime()` in `realBlockService.ts`, start realtime client on app startup, and adapt block store to accept backend-discovered blocks.
- Docs & Schemas: Add JSON schemas for `block.json`, `workflow-nodes.json`, and `connections.json`; update Phase 5A documentation and supporting docs.
- Misc: Add helper scripts, project file adjustments, and example workflows/data used by frontend tests.

# 🏗️ Technical Details
- Architecture & layering
  - Application interfaces (`IBlockDiscoveryService`, `IBlockRepository`, `IBlockValidator`, `IBlockChangePublisher`) are defined in `backend/src/Maestro.Application/Interfaces` to respect Clean Architecture.
  - Infrastructure implements discovery and persistence (`FileSystemBlockDiscoveryService`, `FileSystemBlockRepository`) and a JSON-schema-based validator (`JsonSchemaBlockValidator`).
  - SignalR events are published via `IBlockChangePublisher` implemented by `SignalRBlockChangePublisher` in the API project; `FileSystemBlockRepository` depends on the publisher interface (not SignalR directly) to avoid layer leaks.

- Backend API
  - `BlocksController` exposes CRUD endpoints and file content endpoints for block management.
  - `BlockHub` (SignalR) broadcasts `BlockAdded`, `BlockUpdated`, and `BlockDeleted` events to connected clients.

- Frontend
  - `frontend/src/services/signalr/blockHub.ts` provides a small SignalR client to connect to `/hubs/blocks`, subscribe to block events, and update the `useBlockStore` directly.
  - `initRealBlockRealtime()` added to `realBlockService.ts` and invoked from `frontend/src/main.tsx` on startup (best-effort connect using `VITE_API_URL`).

- Tests
  - Backend: Multiple new tests were added under `backend/tests/Maestro.Infrastructure.Tests/` including handler tests, repository/discovery integration tests, validator tests, publisher tests, and `BlocksControllerIntegrationTests.cs` which exercises controller CRUD flows against an in-memory test host.
  - Frontend: Added/updated unit tests for hooks and components to account for discovery and realtime flows.

# 🧪 Testing
- Run backend tests (requires .NET 10):
```bash
dotnet test backend/tests/Maestro.Infrastructure.Tests/Maestro.Infrastructure.Tests.csproj
```

- Run frontend tests (Node + Vitest):
```bash
cd frontend
pnpm install
pnpm test
```

- Manual E2E check:
  1. Start backend (ensure `VITE_API_URL` matches backend URL).
 2. Start frontend.
 3. Create a `block.json` under a configured discovery path or use `POST /api/blocks`.
 4. Observe the frontend updates (Block Explorer / Foundry) and check SignalR console logs.

# 📖 Documentation
- Added `docs/schemas/block.schema.json`, `docs/schemas/workflow-nodes.schema.json`, `docs/schemas/connections.schema.json`.
- Updated `docs/issues/phase-5a-filesystem-block-architecture.md` with implementation status and next steps.
- Added `docs/block-schema-reference.md` describing expected files per block type.

# 🚀 Deployment Notes
- Backend configuration: ensure discovery paths are configured in `appsettings.json` / `maestro.config.json` and that the API exposes SignalR hubs at `/hubs/blocks` behind any proxies.
- Frontend: set `VITE_API_URL` to the backend base URL in environment (used by `initRealBlockRealtime`).

# 🔄 Migration Guide
- No database migrations required — filesystem-based blocks are compatible with git and do not alter existing storage.

# 📸 Screenshots/Examples
- N/A (UI wiring added; visuals unchanged in this PR)

# 🔗 Related Issues
- Phase 5A: Filesystem-Based Block Architecture (roadmap)
- Phase 5B/C: Block Execution Engine & Workflow Orchestration (next phases)

# 👥 Review Notes
- Focus review on:
  - Correct layering: confirm no infrastructure types leak into Application/Domain.
  - SignalR behavior: ensure `IBlockChangePublisher` is used in infra and SignalR implementation lives in API layer.
  - Tests: verify `BlocksControllerIntegrationTests` runs in local environment (may need tool-specific setup for file paths).
  - Frontend: check `initRealBlockRealtime` is best-effort and does not break on missing backend; connection errors are logged and do not crash the app.

- Risks:
  - Handler implementations are skeletons — they will need to be extended to fully populate `BlockDefinition.Metadata` for richer UI usage.
  - If discovery paths are misconfigured, frontend may not show blocks until the paths are corrected.

---

Checklist before merge:
- [ ] All backend tests pass in CI (including integration tests)
- [ ] Frontend tests pass and build succeeds
- [ ] Confirm `VITE_API_URL` configuration in deployment pipelines
- [ ] Optional: Add retry/backoff and test coverage for SignalR client
