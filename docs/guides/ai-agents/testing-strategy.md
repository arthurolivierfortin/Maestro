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
| Health check | `GET http://localhost:5000/api/health` |
