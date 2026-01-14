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
