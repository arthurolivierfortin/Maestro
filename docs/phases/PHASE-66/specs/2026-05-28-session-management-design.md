# Session Management — Design

**Goal:** Make the Spaces page able to CREATE sessions and view a single session's detail with lifecycle actions (pause/resume/stop/delete), turning Spaces from read-only into a usable orchestration surface.
**Roadmap phase:** Phase-66 (sub-phase 66-I)
**Tags:** [code-app]
**Scope (in):**
- `sessionService`: add `createSession(request)`, `getSession(id)`, `pauseSession(id)`, `resumeSession(id)`, `deleteSession(id)` (start/stop already exist)
- `CreateSessionRequest` TS type (minimal subset of backend `CreateInteractiveSessionRequest`: `name?`, `repositoryPath?`, `task?`)
- `useSessions` hook: add `createSession`, `pauseSession`, `resumeSession`, `deleteSession`; each refreshes the list after mutating
- `NewSessionForm` component (inline `.box` with name/repoPath/task inputs + submit + cancel)
- `SessionDetail` component (`.box` panel: status, type, authority, repo, commandCount, createdAt + action buttons start/pause/resume/stop/delete)
- `SpacesPage`: a `[+] New Session` button toggling the form; clicking a session row selects it and shows `SessionDetail`
- Tests: new service functions, form, detail, hook actions

**Scope (out):**
- Variables editor in the detail — future cycle
- Events stream (GET `/{id}/events`) in the detail — future cycle
- Entry points management — future cycle
- Session invoke from the UI — Console chat already handles interaction
- Workspace creation — future cycle (sessions focus this cycle)
- Modal/overlay form — inline `.box` only (simpler, theme-consistent, no focus-trap)
- Repository picker / autocomplete — free-text path input for V1, backend validates

**Constraints:**
- Must reuse existing `apiFetch` from `services/apiClient.ts` — no new HTTP client
- Must reuse the ported TUI theme classes (`.box`, `.box-title`, `.b` badges, `.tbl`, `.c0`-`.c4`, `.row`/`.col`) — visual consistency with pages 66-G/H
- Must pass `npx tsc --noEmit` and `npx vitest run` in `apps/code`
- The existing 158 tests must remain green
- Backend NOT touched — consume existing `/api/sessions` endpoints
- `deleteSession` consumes `DELETE /api/sessions/{id}` which returns `204 No Content` (no body) — service must NOT call `res.json()` on it

## Cardinal Rule check

PASS — consumes existing generic backend APIs. Zero session-type-specific or workspace-specific code added to the backend. All new code is `[code-app]` (TUI layer). A new session type can still be created with JSON-only changes. The form sends only generic fields (`name`, `repositoryPath`, `task`) that map to the generic `CreateInteractiveSessionRequest`.

## No Legacy Support check

Pure addition. `getSessions`, `startSession`, `stopSession` stay unchanged. The current `SpacesPage` read-only behavior is extended, not replaced. Nothing is removed. The new actions are added to the existing `useSessions` return object without breaking the existing `{ startSession, stopSession }` consumers.

## Architecture

`sessionService.ts` gains five functions. `createSession(request: CreateSessionRequest)` does `POST /api/sessions` with a JSON body and returns the created `SessionDto` (backend responds 201 with the DTO). `getSession(id)` does `GET /api/sessions/{id}`. `pauseSession(id)` / `resumeSession(id)` do `POST /api/sessions/{id}/pause` and `/resume` returning the updated `SessionDto`. `deleteSession(id)` does `DELETE /api/sessions/{id}` and returns `void` (backend returns 204 No Content — the service does not parse a body).

`useSessions.ts` exposes the new mutating actions. Each action calls the corresponding service function then `await loadSessions()` to refresh the list (same pattern as existing `startSession`/`stopSession`). Polling at 5s is untouched.

`SpacesPage.tsx` adds two pieces of UI to the Sessions tab. (1) A `[+] New Session` button in the Sessions box header that toggles a `showForm` state; when true, an inline `NewSessionForm` renders above the session list. On submit it calls `createSession` from the hook and hides the form. (2) A `selectedId` state — clicking a `SessionRow` sets it; when set, a `SessionDetail` panel (`.box`) renders below the list showing the full session and wiring its action buttons to the hook actions. The detail re-derives its session object from the polled `sessions` array (so it stays fresh), with a Close button to clear `selectedId`. `NewSessionForm` and `SessionDetail` are extracted as standalone components in `apps/code/src/components/` for isolated testing.

## Affected systems

- Backend C#: NOT TOUCHED (consume existing `/api/sessions` create/get/pause/resume/delete)
- LLM-Provider: NOT TOUCHED
- TUI: `apps/code/src/` — `services/sessionService.ts`, `hooks/useSessions.ts`, `pages/SpacesPage.tsx` modified; new `components/NewSessionForm.tsx`, `components/SessionDetail.tsx`
- CLI: NOT TOUCHED
- Blocks: NOT TOUCHED
- Contracts: NOT TOUCHED
- DI: NOT TOUCHED

## API Response Shapes (verified from SessionsController.cs 2026-05-28)

### POST /api/sessions → 201 ProjectSessionDto
Body `CreateInteractiveSessionRequest` — requires `ProjectId` OR `RepositoryPath`; we send:
```typescript
interface CreateSessionRequest {
  name?: string;
  repositoryPath?: string;
  task?: string;
}
```
Backend returns the created `SessionDto` (same shape as list items). 400 if neither `ProjectId` nor `RepositoryPath` provided.

### GET /api/sessions/{id} → 200 ProjectSessionDto | 404
Same `SessionDto` shape used by the list.

### POST /api/sessions/{id}/pause → 200 SessionDto | 400
### POST /api/sessions/{id}/resume → 200 SessionDto | 400
### DELETE /api/sessions/{id} → 204 No Content (NO body) | 400
Cascade-removes the session from any workspaces server-side.

## Risks

- `deleteSession` returning 204: calling `res.json()` would throw on an empty body. The service must return `void` after `apiFetch`, not parse JSON. (`apiFetch` already throws on non-2xx, so a 204 passes through fine.)
- `createSession` with empty `repositoryPath` AND empty `name`: backend rejects with 400 "Either ProjectId or RepositoryPath is required". The form should require a non-empty `repositoryPath` client-side to avoid a guaranteed-fail request (server-side validation remains the source of truth).
- `SessionDetail` derived from the polled array: if the session is deleted, it disappears from `sessions` — the detail must clear `selectedId` / render nothing rather than crash on `undefined`.
- Existing `SpacesPage.test.tsx` mocks `useSessions` with only `{ startSession, stopSession }`. Adding required fields to the hook return type will break those mocks at type-check time. The new fields must be added to ALL `useSessions` mock return objects in the test file (and any other test mocking the hook).
- Action button enablement: derive `canPause`/`canResume`/`canStop`/`canStart` from status to avoid sending requests the backend will reject (paused→resume, active→pause/stop, created/stopped→start).
