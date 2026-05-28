# Implementation Plan — Spaces Page (Phase 66-B)

**Issue:** #62
**Spec:** `docs/phases/PHASE-66/specs/2026-05-27-spaces-page-design.md`
**Checklist:** `docs/phases/PHASE-66/specs/2026-05-27-spaces-page-checklist.md`

## API Verification Results

### GET /api/sessions
- Controller: `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs:36`
- Returns `List<ProjectSessionDto>` with fields: id, name, type, status (lowercase), authority, createdAt, startedAt, completedAt, durationMs, commandCount, errorMessage, repositoryPath, parentSessionId
- Status values (lowercase): created, active, completed, failed, stopped, paused

### POST /api/sessions/{id}/start
- Controller: `SessionsController.cs:137`
- Returns `ProjectSessionDto`

### POST /api/sessions/{id}/stop
- Controller: `SessionsController.cs:199`
- Returns `ProjectSessionDto`

### GET /api/workspaces
- Controller: `apps/backend/src/Maestro.Api/Controllers/WorkspacesController.cs:34`
- Returns `List<WorkspaceDto>` with fields: id, name, description, type (PascalCase), status (PascalCase: Active/Paused/Archived), sessionIds[], projectIds[], createdAt, updatedAt

## Existing Patterns to Follow

- **apiFetch** (`services/apiClient.ts`): wraps fetch, throws on non-ok. Services should call `apiFetch(path)` then `.json()` on the returned Response.
- **Hook pattern** (`hooks/useChat.ts`): useState + useCallback, return object with state + actions
- **Test pattern** (`services/__tests__/apiClient.test.ts`): vi.spyOn(globalThis, 'fetch'), mock Response
- **Theme** (`theme/tokens.ts`): colors.bg, colors.fg, colors.accent, colors.success, colors.error, colors.muted, colors.border, spacing.xs/sm/md/lg/xl, fontFamily
- **Component style**: inline CSS objects (no CSS modules, no SCSS in apps/code)
- **Page structure** (`pages/ConsolePage.tsx`): functional component, div with flex column, 100% height

## SPEC-1 — sessionService

**Tag:** [code-app]
**File:** `apps/code/src/services/sessionService.ts`
**Existing pattern:** `services/chatService.ts` — uses `apiFetch` from `apiClient.ts`
**Pitfalls:** None specific. Follow apiFetch pattern.

### Step 1.1 — RED
```typescript
// Test: sessionService calls apiFetch correctly
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessions, startSession, stopSession } from '../sessionService';

// Mock apiFetch
vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('sessionService', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('getSessions calls GET /api/sessions', async () => {
    const { apiFetch } = await import('../apiClient');
    const mockSessions = [{ id: 's1', name: 'Test', status: 'active' }];
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockSessions) } as Response);
    const result = await getSessions();
    expect(apiFetch).toHaveBeenCalledWith('/api/sessions');
    expect(result).toEqual(mockSessions);
  });

  it('startSession calls POST /api/sessions/{id}/start', async () => {
    const { apiFetch } = await import('../apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve({ id: 's1', status: 'active' }) } as Response);
    await startSession('s1');
    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/start', { method: 'POST' });
  });

  it('stopSession calls POST /api/sessions/{id}/stop', async () => {
    const { apiFetch } = await import('../apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve({ id: 's1', status: 'stopped' }) } as Response);
    await stopSession('s1');
    expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/stop', { method: 'POST' });
  });
});
```
File: `apps/code/src/services/__tests__/sessionService.test.ts`

### Step 1.2 — GREEN
```typescript
import { apiFetch } from './apiClient';

export interface SessionDto {
  id: string;
  name: string;
  type: string;
  status: string;
  authority: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  commandCount: number;
  repositoryPath?: string;
  parentSessionId?: string;
  errorMessage?: string;
}

export async function getSessions(): Promise<SessionDto[]> {
  const res = await apiFetch('/api/sessions');
  return res.json();
}

export async function startSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/start`, { method: 'POST' });
  return res.json();
}

export async function stopSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/stop`, { method: 'POST' });
  return res.json();
}
```

### Step 1.3 — Verification
```bash
cd apps/code && npx vitest run src/services/__tests__/sessionService.test.ts
```

## SPEC-2 — workspaceService

**Tag:** [code-app]
**File:** `apps/code/src/services/workspaceService.ts`
**Existing pattern:** Same as SPEC-1

### Step 2.1 — RED
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWorkspaces } from '../workspaceService';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('workspaceService', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('getWorkspaces calls GET /api/workspaces', async () => {
    const { apiFetch } = await import('../apiClient');
    const mockWorkspaces = [{ id: 'w1', name: 'Dev', status: 'Active' }];
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockWorkspaces) } as Response);
    const result = await getWorkspaces();
    expect(apiFetch).toHaveBeenCalledWith('/api/workspaces');
    expect(result).toEqual(mockWorkspaces);
  });
});
```
File: `apps/code/src/services/__tests__/workspaceService.test.ts`

### Step 2.2 — GREEN
```typescript
import { apiFetch } from './apiClient';

export interface WorkspaceDto {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  sessionIds: string[];
  projectIds: string[];
  createdAt: string;
  updatedAt?: string;
}

export async function getWorkspaces(): Promise<WorkspaceDto[]> {
  const res = await apiFetch('/api/workspaces');
  return res.json();
}
```

## SPEC-3 — useSessions hook

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useSessions.ts`
**Existing pattern:** `hooks/useBackendStatus.ts` — useEffect with setInterval, cleanup on unmount
**Pitfalls:** Must cleanup interval on unmount. Must use vi.useFakeTimers in tests.

### Step 3.1 — RED
Test: useSessions fetches sessions, polls, and exposes start/stop actions
File: `apps/code/src/hooks/__tests__/useSessions.test.ts`

### Step 3.2 — GREEN
Hook using useState, useEffect with setInterval(5000), useCallback for start/stop.

## SPEC-4 — useWorkspaces hook

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useWorkspaces.ts`
**Existing pattern:** Same as SPEC-3 but without polling (one-shot fetch)

### Step 4.1 — RED
File: `apps/code/src/hooks/__tests__/useWorkspaces.test.ts`

### Step 4.2 — GREEN
Simple useEffect on mount, useState for workspaces/isLoading/error.

## SPEC-5 — SpacesPage component

**Tag:** [code-app]
**File:** `apps/code/src/pages/SpacesPage.tsx`
**Existing pattern:** `pages/ConsolePage.tsx` — inline styles, theme tokens, flex layout
**Pitfalls:** None. Pure presentational component.

### Step 5.1 — RED
File: `apps/code/src/pages/__tests__/SpacesPage.test.tsx`
Test: renders sessions tab by default, shows session rows, toggles to workspaces tab, shows empty state.

### Step 5.2 — GREEN
Component with useState for activeTab, renders SessionRow/WorkspaceRow sub-components.

## SPEC-6 — Navigation (App.tsx + Header.tsx)

**Tag:** [code-app]
**Files:** `apps/code/src/App.tsx` + `apps/code/src/components/Header.tsx`
**Existing pattern:** Current Header has static tabs, App renders only ConsolePage
**Pitfalls:** Header currently has hardcoded `active: true` on Console. Must make dynamic.

### Step 6.1 — RED
File: `apps/code/src/pages/__tests__/Navigation.test.tsx`
Test: clicking tab 2 renders SpacesPage, clicking tab 1 renders ConsolePage.

### Step 6.2 — GREEN
- App.tsx: add `useState<'console' | 'spaces'>('console')`, pass to Header, conditionally render
- Header.tsx: accept `currentPage` and `onNavigate` props, make tabs clickable

## Cross-cutting concerns

- **No DI changes** — pure frontend
- **No backend changes** — consume existing APIs
- **Import paths** — use relative imports (apps/code uses `@/*` alias via tsconfig paths but existing code uses relative)
