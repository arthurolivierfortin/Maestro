# Checklist — session status vocabulary

**Linked spec:** [2026-05-28-session-status-vocabulary-design.md](2026-05-28-session-status-vocabulary-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (66-K)

## Code
- [x] [SPEC-1] [code-app] Create `sessionStatus.ts` with `SessionStatusGroup` type and `sessionStatusGroup(status)` returning `'active'|'idle'|'pending'|'paused'|'done'|'error'|'neutral'`, lowercasing input, exhaustive over canonical + legacy + `active`, unknown → `'neutral'` — `apps/code/src/services/sessionStatus.ts`
- [x] [SPEC-2] [code-app] Add `canStart(status)` (true: created/new/idle/completed/done/stopped/cancelled/failed/error) and `canStop(status)` (true: running/active/idle/paused/pending) to the module — `apps/code/src/services/sessionStatus.ts`
- [x] [SPEC-3] [code-app] Add `canPause(status)` (true: running/active) and `canResume(status)` (true: paused) to the module — `apps/code/src/services/sessionStatus.ts`
- [x] [SPEC-4] [code-app] Add `statusColorClass(status)` mapping group → theme class (active/idle→`cok`, pending→`ca`, paused→`cwarn`, done→`c3`, error→`cerr`, neutral→`c2`) — `apps/code/src/services/sessionStatus.ts`
- [x] [SPEC-5] [code-app] Refactor `SpacesPage`: delete inline `statusClass` + inline `isActive`/`canStart`/`canStop`; `StatusPip` uses `statusColorClass`; `SessionRow` uses `canStart`/`canStop` from module — `apps/code/src/pages/SpacesPage.tsx`
- [x] [SPEC-6] [code-app] Refactor `SessionDetail`: delete inline `statusClass` + inline can-booleans; badge uses `statusColorClass`; buttons use `canStart`/`canPause`/`canResume`/`canStop` from module — `apps/code/src/components/SessionDetail.tsx`

## Tests
- [x] [TEST-1] Table-driven: each of the 11 real statuses (`running, idle, paused, created, pending, new, completed, done, stopped, error, updated`) + `cancelled` + `active` maps to its expected group — `apps/code/src/services/__tests__/sessionStatus.test.ts::sessionStatusGroup maps each status to its group`
- [x] [TEST-2] Unknown / empty status → `'neutral'`, and `sessionStatusGroup` is case-insensitive (`RUNNING` === `running`) — `sessionStatus.test.ts::handles unknown and casing`
- [x] [TEST-3] Table-driven `canStart` / `canStop` over all statuses match the spec table (incl. `idle` → both true, `updated`/unknown → both false) — `sessionStatus.test.ts::canStart/canStop per status`
- [x] [TEST-4] `canPause` true only for running/active; `canResume` true only for paused — `sessionStatus.test.ts::canPause/canResume`
- [x] [TEST-5] `statusColorClass` returns the right class per status (running→cok, created→ca, paused→cwarn, completed→c3, failed→cerr, updated→c2) — `sessionStatus.test.ts::statusColorClass`
- [x] [TEST-6] `SpacesPage` / `SessionDetail` existing tests still green; add a row test that an `idle` session shows both Start and Stop — `apps/code/src/pages/__tests__/SpacesPage.test.tsx` + `apps/code/src/components/__tests__/SessionDetail.test.tsx`

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None

## Verification gates (TESTING-PROTOCOL layers applicable to [code-app] TUI)
- [x] [GATE-1] Layer 1 Type Check : `cd apps/code && npx tsc --noEmit`
- [x] [GATE-2] Layer 2 Unit Tests : `cd apps/code && npx vitest run` (existing 197 + new green)
- [x] [GATE-3] Layer 3 Visual Gate : N/A if Playwright MCP disconnected — pure logic, verified via vitest + curl against live backend :5000
