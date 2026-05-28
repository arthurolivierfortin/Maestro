# Checklist — session management

**Linked spec:** [2026-05-28-session-management-design.md](2026-05-28-session-management-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (66-I)

## Code
- [x] [SPEC-1] [code-app] Add `CreateSessionRequest` type + `createSession(request)` (POST /api/sessions, returns created SessionDto) — `apps/code/src/services/sessionService.ts`
- [x] [SPEC-2] [code-app] Add `getSession(id)` (GET /api/sessions/{id}, returns SessionDto) — `apps/code/src/services/sessionService.ts`
- [x] [SPEC-3] [code-app] Add `pauseSession(id)` + `resumeSession(id)` (POST /api/sessions/{id}/pause|/resume, return SessionDto) — `apps/code/src/services/sessionService.ts`
- [x] [SPEC-4] [code-app] Add `deleteSession(id)` (DELETE /api/sessions/{id}, returns void, does NOT parse body) — `apps/code/src/services/sessionService.ts`
- [x] [SPEC-5] [code-app] Extend `useSessions` with `createSession`, `pauseSession`, `resumeSession`, `deleteSession` actions, each refreshing the list after the mutation — `apps/code/src/hooks/useSessions.ts`
- [x] [SPEC-6] [code-app] `NewSessionForm` component: `.box` with name/repoPath/task inputs, requires non-empty repoPath, Submit calls `onSubmit(request)`, Cancel calls `onCancel()` — `apps/code/src/components/NewSessionForm.tsx`
- [x] [SPEC-7] [code-app] `SessionDetail` component: `.box` panel rendering status/type/authority/repo/commandCount/createdAt + start/pause/resume/stop/delete buttons enabled by status, Close button — `apps/code/src/components/SessionDetail.tsx`
- [x] [SPEC-8] [code-app] `SpacesPage`: `[+] New Session` button toggles inline `NewSessionForm`; clicking a session row selects it and renders `SessionDetail`; wire create/pause/resume/delete to the hook — `apps/code/src/pages/SpacesPage.tsx`

## Tests
- [x] [TEST-1] `createSession` POSTs to `/api/sessions` with JSON body and returns parsed DTO — `apps/code/src/services/__tests__/sessionService.test.ts::createSession calls POST /api/sessions with body`
- [x] [TEST-2] `getSession` calls `GET /api/sessions/{id}` and returns parsed DTO — `sessionService.test.ts::getSession calls GET /api/sessions/{id}`
- [x] [TEST-3] `pauseSession` and `resumeSession` POST to the right paths — `sessionService.test.ts::pauseSession/resumeSession call correct endpoints`
- [x] [TEST-4] `deleteSession` calls `DELETE /api/sessions/{id}` and resolves without calling `res.json()` — `sessionService.test.ts::deleteSession calls DELETE and does not parse body`
- [x] [TEST-5] `useSessions` exposes `createSession`/`pauseSession`/`resumeSession`/`deleteSession`, each calls the service and re-fetches — `apps/code/src/hooks/__tests__/useSessions.test.ts::action <name> calls service and refreshes`
- [x] [TEST-6] `NewSessionForm` renders inputs, blocks submit when repoPath empty, calls `onSubmit` with entered values, `onCancel` on cancel — `apps/code/src/components/__tests__/NewSessionForm.test.tsx`
- [x] [TEST-7] `SessionDetail` renders fields, shows the right action buttons per status, calls handlers, Close calls `onClose` — `apps/code/src/components/__tests__/SessionDetail.test.tsx`
- [x] [TEST-8] `SpacesPage`: New Session button toggles form; clicking a row shows detail; existing read-only tests still pass — `apps/code/src/pages/__tests__/SpacesPage.test.tsx::shows form on New Session / shows detail on row click`

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None

## Verification gates (TESTING-PROTOCOL layers applicable to [code-app] TUI)
- [x] [GATE-1] Layer 1 Type Check : `cd apps/code && npx tsc --noEmit`
- [x] [GATE-2] Layer 2 Unit Tests : `cd apps/code && npx vitest run` (all existing 158 + new tests green)
- [x] [GATE-3] Layer 3 Visual Gate : N/A this cycle — Playwright MCP disconnected; verification deferred to a later dogfooding session
