# Spaces Page — Design

**Goal:** Add a Spaces page to apps/code that displays sessions and workspaces from the backend API, with status indicators and start/stop actions.
**Roadmap phase:** Phase-66 (sub-phase 66-B)
**Tags:** [code-app]
**Scope (in):**
- SpacesPage component with two sub-tabs: Sessions and Workspaces
- sessionService module (list sessions, start, stop via `/api/sessions` backend API)
- workspaceService module (list workspaces via `/api/workspaces` backend API)
- useSessionsData hook (fetch + 5s polling for sessions list)
- useWorkspacesData hook (fetch workspaces list, no polling needed)
- SessionRow component (status dot, name, type, elapsed time, start/stop buttons)
- WorkspaceRow component (name, type, status, session count)
- Navigation wiring: tab 2 in Header navigates to Spaces, tab 1 back to Console
- Router state in App.tsx (`currentPage` state)

**Scope (out):**
- Session detail page (click on session for detail view) — future cycle
- Workspace creation/deletion UI — future cycle
- Variables editor — future cycle
- Session invoke/exec from Spaces — already in Console via chat
- Real-time SSE/WebSocket updates — polling 5s is sufficient for V1
- Search/filter UI — future cycle (keep it simple for V1)

**Constraints:**
- Must use existing `apiFetch` from `services/apiClient.ts` — no new HTTP client
- Must follow existing theme tokens from `theme/tokens.ts`
- Must pass `npx tsc --noEmit` and `npx vitest run` in apps/code
- Backend not touched — consume existing `/api/sessions` and `/api/workspaces` endpoints

## Cardinal Rule check

PASS — This change consumes existing generic backend APIs. Zero session-specific or workspace-specific code is added to the backend. The frontend is [code-app] layer only. A new session type can still be created with JSON-only changes.

## No Legacy Support check

Nothing to remove (pure addition of a new page).

## Architecture

SpacesPage lives at `apps/code/src/pages/SpacesPage.tsx`. It renders two sub-views toggled by an internal tab state: Sessions (default) and Workspaces.

Data fetching is split into two modules:
- `services/sessionService.ts` — wraps `apiFetch` for `GET /api/sessions`, `POST /api/sessions/{id}/start`, `POST /api/sessions/{id}/stop`
- `services/workspaceService.ts` — wraps `apiFetch` for `GET /api/workspaces`

Hooks:
- `hooks/useSessions.ts` — calls sessionService.getSessions(), polls every 5s via setInterval, returns `{ sessions, isLoading, error, startSession, stopSession }`
- `hooks/useWorkspaces.ts` — calls workspaceService.getWorkspaces() once on mount, returns `{ workspaces, isLoading, error }`

Navigation is handled via a `currentPage` state in App.tsx. Header tabs become clickable and toggle this state. The main area renders the corresponding page component.

## Affected systems

- Backend C#: NOT TOUCHED (consume existing APIs)
- LLM-Provider: NOT TOUCHED
- TUI: `apps/code/src/` — new files + modified App.tsx and Header.tsx
- CLI: NOT TOUCHED
- Blocks: NOT TOUCHED
- Contracts: NOT TOUCHED
- DI: NOT TOUCHED

## API Response Shapes (verified from backend DTOs)

### GET /api/sessions → ProjectSessionDto[]
```typescript
interface SessionDto {
  id: string;
  name: string;
  type: string;         // "project" etc
  status: string;       // "created" | "active" | "completed" | "failed" | "stopped"
  authority: string;
  createdAt: string;    // ISO date
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  commandCount: number;
  repositoryPath?: string;
  parentSessionId?: string;
  errorMessage?: string;
}
```

### GET /api/workspaces → WorkspaceDto[]
```typescript
interface WorkspaceDto {
  id: string;
  name: string;
  description?: string;
  type: string;         // "Custom", "Research", etc
  status: string;       // "Active", "Paused", "Archived"
  sessionIds: string[];
  projectIds: string[];
  createdAt: string;
  updatedAt?: string;
}
```

## Risks

- Polling interval: must cleanup setInterval on unmount to avoid memory leaks
- API may return empty arrays if no sessions/workspaces exist — need empty state handling
- Status strings from backend are lowercase for sessions (`"active"`, `"created"`) but PascalCase for workspaces (`"Active"`, `"Paused"`) — normalize in the view layer
