# Checklist — Spaces Page

**Linked spec:** [2026-05-27-spaces-page-design.md](2026-05-27-spaces-page-design.md)
**Tags:** [code-app]
**Phase:** Phase-66

## Code
- [x] [SPEC-1] [code-app] Create sessionService with getSessions(), startSession(id), stopSession(id) using apiFetch — `apps/code/src/services/sessionService.ts`
- [x] [SPEC-2] [code-app] Create workspaceService with getWorkspaces() using apiFetch — `apps/code/src/services/workspaceService.ts`
- [x] [SPEC-3] [code-app] Create useSessions hook with 5s polling, loading/error state, start/stop actions — `apps/code/src/hooks/useSessions.ts`
- [x] [SPEC-4] [code-app] Create useWorkspaces hook with one-shot fetch, loading/error state — `apps/code/src/hooks/useWorkspaces.ts`
- [x] [SPEC-5] [code-app] Create SpacesPage with Sessions/Workspaces sub-tabs, SessionRow, WorkspaceRow, empty states — `apps/code/src/pages/SpacesPage.tsx`
- [x] [SPEC-6] [code-app] Add currentPage state to App.tsx + route Console/Spaces, make Header tabs clickable with onNavigate callback — `apps/code/src/App.tsx` + `apps/code/src/components/Header.tsx`

## Tests
- [x] [TEST-1] sessionService.getSessions calls apiFetch('/api/sessions'), startSession calls POST /api/sessions/{id}/start, stopSession calls POST /api/sessions/{id}/stop — `apps/code/src/services/__tests__/sessionService.test.ts`
- [x] [TEST-2] workspaceService.getWorkspaces calls apiFetch('/api/workspaces') — `apps/code/src/services/__tests__/workspaceService.test.ts`
- [x] [TEST-3] useSessions returns sessions from API, polls every 5s, exposes startSession/stopSession, cleans up interval on unmount — `apps/code/src/hooks/__tests__/useSessions.test.ts`
- [x] [TEST-4] useWorkspaces returns workspaces from API, handles loading/error states — `apps/code/src/hooks/__tests__/useWorkspaces.test.ts`
- [x] [TEST-5] SpacesPage renders session list when data available, shows empty state when no sessions, toggles between Sessions/Workspaces tabs — `apps/code/src/pages/__tests__/SpacesPage.test.tsx`
- [x] [TEST-6] App renders SpacesPage when currentPage is 'spaces', Header onNavigate changes page — `apps/code/src/pages/__tests__/Navigation.test.tsx`

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None

## Verification gates (6 layers TESTING-PROTOCOL)
- [x] [GATE-1] Layer 1 Type Check: `cd apps/code && npx tsc --noEmit`
- [x] [GATE-2] Layer 2 Unit Tests: `cd apps/code && npx vitest run`
