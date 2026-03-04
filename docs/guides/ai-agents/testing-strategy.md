# Testing Strategy — AI Agent Reference

> **This document is extracted from CLAUDE.md.** It consolidates all testing requirements, coverage areas, and commands.

---

## Before Making Changes

1. **Run tests before starting work**
   - Frontend: `cd apps/desktop && npm test -- --run`
   - Backend: `cd apps/backend && dotnet test`
   - CLI interactive: `cd packages/maestro-code && npx vitest run tests/`
   - TUI toolkit: `cd packages/tui && npx vitest run tests/`
   - Monitor: `cd packages/maestro-monitor && npx vitest run tests/`

2. **Understand test baseline**
   - Note the number of passing/failing tests
   - Do not introduce new test failures
   - Known pre-existing failures (ReactFlow mock issues in canvas tests) are acceptable

## After Making Changes

1. **Run tests after every significant change**
   - All tests that passed before must still pass
   - New features should include tests where practical

2. **Verify the frontend build**
   - `cd apps/desktop && npm run build`

3. **Verify the backend build**
   - `cd apps/backend && dotnet build`
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

## Dogfooding (MANDATORY for Interactive Features)

**Read and follow `docs/guides/ai-agents/dogfooding-methodology.md`** for any dogfooding session.

Key rules:
- **You are a System Validator** — see the interface, test everything, take notes, judge quality
- **Verify observation tools exist** before starting (TuiDriver, health endpoints, filesystem access)
- **Discover the interface** — inventory every visible element before testing
- **Test systematically** — visual, interaction, flow, API state, UX quality
- **Take notes in real-time** — create `dogfood-notes-YYYY-MM-DD.md` with structured results
- **NEVER write test scripts** — do the verification yourself directly via Bash/TuiDriver inline
- **NEVER trust script PASS/FAIL** — read the frames with your eyes, decide yourself

---

## Integration Test Requirements (maestro-code)

> **Added 2026-03-03 after incident: `@ts-nocheck` on all files + zero SessionManager tests = critical bug shipped undetected.**

### SessionManager Integration Tests (MANDATORY)

The `SessionManager` class (`packages/maestro-code/services/SessionManager.ts`) is the most critical service in maestro-code. It manages session lifecycle, template import, entry point invocation, polling, and output extraction. **It MUST have integration tests.**

Required test coverage:
- **Session creation flow**: `createSession` → `importTemplate` → `startSession` → `invokeEntryPoint`
- **Session reuse**: `.maestro/session.json` exists → reuse session, don't recreate
- **Error handling**: backend down, template import fails, invoke fails, timeout
- **Polling**: completion detection, error detection, output extraction
- **Multi-message**: second message reuses session, doesn't recreate

### First-Run Flow Test (MANDATORY)

The first-run flow (no providers configured → provider setup → backend start → session creation → first message) MUST be tested. This is the primary path for new users.

Required test coverage:
- Provider setup completes → SessionManager created with ALL required options (especially `importSessionTemplate`)
- First message after setup → template imported, entry point invoked, response received
- Skip setup → TUI accessible without backend

**Incident (2026-03-03)**: `App.ts` created a new `SessionManager` after provider setup WITHOUT passing `importSessionTemplate`. The callback defaulted to a no-op. Template was never imported. Every new user got "Entry point 'message' not found" on their first message. This would have been caught by: (1) TypeScript type checking (the property was missing), (2) a first-run flow test.

### TypeScript Type Checking (MANDATORY)

**Never use `@ts-nocheck` in production code.** If type errors are difficult to fix immediately, fix them — don't disable the compiler. `@ts-nocheck` directly caused the 2026-03-03 incident by hiding a missing property that would have been a compile error.

Run `npx tsc --noEmit` as part of verification for any maestro-code change.

---

## Critical Test Coverage Areas

### 1. BlockTypeRegistry (must be tested)
- Type containment rules (`canContain`)
- Block creation (`getDefaultBlock`)
- Config validation (`validateConfig`)

### 2. Block Store (must be tested)
- Add/remove/update blocks
- Parent-child relationships
- History (undo/redo)

### 3. Navigation (must be tested)
- Route synchronization
- Block selection
- Breadcrumb generation

### Known Test Infrastructure Issues

The following tests have pre-existing mock issues and may fail:
- `BlockCanvas.test.tsx` — ReactFlowProvider mock
- `BlockEditPage.test.tsx` — ReactFlowProvider mock
- `AtomicBlockEditorPage.test.tsx` — Store mock issues
- `Breadcrumb.test.tsx` — Store mock issues

These should be fixed but are not blocking.

---

## Integration Tests — Backend Pipeline (`@maestro/integration-tests`)

> **Added 2026-03-03 (Phase 47).** These tests exercise the REAL backend, verify REAL workflow execution, and catch bugs that unit tests with mocks cannot.

### Architecture

- **Location**: `packages/maestro-integration-tests/`
- **One sidecar per suite**: `vitest globalSetup` starts `MaestroSidecar({ skipLlm: true })` once (~10s), all tests share it
- **Each test creates its own session**: Full isolation, no cross-test contamination
- **Zero LLM cost**: Level 1-2 use `skipLlm: true`, Level 3 uses `mock-response.json` for deterministic agent responses
- **Polling**: `waitForWorkflowComplete()` polls `_activeWorkflow === ""` every 500ms (timeout 30s)

### Test Levels

| Level | What it tests | Count | LLM cost |
|-------|--------------|-------|----------|
| Level 1 — API | CRUD (sessions, variables, blocks, templates), health check | 15 | $0 |
| Level 2 — Workflow | new-conversation, clear-conversation, conditionals, variable propagation | 8 | $0 |
| Level 3 — Pipeline | Full maestro-assistant-workflow: ensure-conversation → save-user-message → load-history → execute-agent → save-assistant-response | 8 | $0 |

### Running

```bash
cd packages/maestro-integration-tests

# All levels
npx vitest run

# Individual levels
npx vitest run tests/level-1-api/
npx vitest run tests/level-2-workflow/
npx vitest run tests/level-3-pipeline/
```

### Key discoveries from Phase 47

- `repositoryPath` is required for `sessions.create()` (not just `projectId`)
- `variables.get()` returns `{ key, value }` wrapper, not raw value
- Sessions must be explicitly `start()`ed before invoking entry points
- **BUG CONFIRMED**: Level 3 tests 3.1-3.6 fail with `save-user-message` error — `_activeConversation` remains empty when set inside conditional else branch of `ensure-conversation`. This is the "Conversation '' not found" bug discovered during dogfooding.

### Current results (2026-03-04)

```
Level 1 (API):      15 passed
Level 2 (Workflow):  8 passed
Level 3 (Pipeline):  8 passed
Total:              31 passed (31 tests)
```

Level 3 initially failed (6/8 tests) confirming the `Conversation '' not found` bug. Root cause: `EvaluateSimpleComparison()` didn't strip surrounding quotes from operands. Condition `{{var}} != ""` evaluated to `True` when `var` was empty because `""` (empty) was compared to `""` (quoted literal with the quotes included). Fixed by adding `StripSurroundingQuotes()` helper.

---

## Testing Commands Quick Reference

| Package | Command |
|---------|---------|
| Backend build | `powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"` |
| Backend tests | `cd apps/backend && dotnet test` |
| Frontend tests | `cd apps/desktop && npm test -- --run` |
| TUI toolkit | `powershell.exe -Command "cd C:\Meastro\packages\tui; npx vitest run tests/"` |
| Monitor | `powershell.exe -Command "cd C:\Meastro\packages\maestro-monitor; npx vitest run tests/"` |
| Interactive TUI | `powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"` |
| Visual gate | `cd packages/maestro-code && npm run test:visual` |
| Real demo check | `cd packages/maestro-code && node tests/real-demo-check.cjs` |
| Integration tests | `cd packages/maestro-integration-tests && npx vitest run` |
| Integration L1 | `cd packages/maestro-integration-tests && npx vitest run tests/level-1-api/` |
| Integration L2 | `cd packages/maestro-integration-tests && npx vitest run tests/level-2-workflow/` |
| Integration L3 | `cd packages/maestro-integration-tests && npx vitest run tests/level-3-pipeline/` |
| Health check | `GET http://localhost:5000/api/health` |
