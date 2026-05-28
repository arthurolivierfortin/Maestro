# Session Management — Implementation Plan

**Issue:** #76
**Spec:** docs/phases/PHASE-66/specs/2026-05-28-session-management-design.md
**Checklist:** docs/phases/PHASE-66/specs/2026-05-28-session-management-checklist.md
**Tags:** [code-app]

## Context verified
- Backend API shapes confirmed in `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` (2026-05-28): POST /api/sessions (201 DTO, needs ProjectId|RepositoryPath), GET /{id} (200|404), POST /{id}/pause, /{id}/resume (200 DTO), DELETE /{id} (204 no body).
- `apiFetch` throws on non-2xx and returns the `Response` on success — callers do `res.json()`. For DELETE 204, do NOT call `res.json()` (empty body → throws).
- Theme classes available in `apps/code/src/theme/tui-theme.css`: `.box`, `.box-title`, `.box-meta`, `.box-body`, `.b`/`.b.ok`/`.b.err`/`.b.ac`, `.tbl`, `.row`/`.col`, `.gap-*`, `.c0`-`.c4`, `.ca`/`.cok`/`.cerr`, `.bd`, `.flex-1`. Inputs: `.cmdline textarea` styles exist; plain `<input>` inherits `font/color`. Use `.box` border styling for inputs.
- Only `apps/code/src/pages/__tests__/SpacesPage.test.tsx` and `apps/code/src/hooks/__tests__/useSessions.test.ts` mock `useSessions` — both must add the new fields to every mock return object or tsc/vitest fails.
- Test conventions: vitest + @testing-library/react; service tests `vi.mock('../apiClient')`; hook tests `vi.useFakeTimers()` + `vi.mock('../../services/sessionService')`; component tests render + fireEvent.

## Cross-cutting concerns
1. **`useSessions` return type widening** — adding required functions to the return changes the inferred type. Every mock of `useSessions` (2 files) must supply ALL new functions or type-check breaks. Builder must update `SpacesPage.test.tsx` mocks in the SAME commit as SPEC-5 to keep the suite green.
2. **204 no-body** — `deleteSession` is the only function that must not parse a body. Easy to copy-paste `return res.json()` by mistake; TEST-4 guards it by asserting `res.json` is never called.
3. **Detail derives from polled array** — `SpacesPage` should look up the selected session from `sessions` (single source of truth) each render so pause/resume status changes propagate; clear `selectedId` if the session vanishes (deleted).
4. No DI, no Program.cs, no blocks, no contracts. Pure [code-app] frontend.

## Cardinal Rule / No Legacy
- Cardinal Rule: PASS. All additions are TUI-layer, consuming generic APIs. No session-type-specific code.
- No Legacy: PASS. Pure addition; existing functions untouched.

---

## SPEC-1 — `CreateSessionRequest` + `createSession`

**Tag:** [code-app]
**File:** `apps/code/src/services/sessionService.ts`
**Existing pattern:** `startSession` (sessionService.ts:24) for POST shape; body via `JSON.stringify` + `headers: { 'Content-Type': 'application/json' }`.
**Pitfalls:** none new. Keep `SessionDto` as-is.

### Step 1.1 — RED
Add to `sessionService.test.ts`:
```ts
it('createSession calls POST /api/sessions with body and returns parsed DTO', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    json: () => Promise.resolve({ id: 's9', name: 'New', status: 'created' }),
  } as unknown as Response);
  const result = await createSession({ name: 'New', repositoryPath: 'C:/Proj', task: 'do x' });
  expect(apiFetch).toHaveBeenCalledWith('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New', repositoryPath: 'C:/Proj', task: 'do x' }),
  });
  expect(result).toEqual({ id: 's9', name: 'New', status: 'created' });
});
```
Import `createSession` and the `CreateSessionRequest` type.

### Step 1.2 — GREEN
```ts
export interface CreateSessionRequest {
  name?: string;
  repositoryPath?: string;
  task?: string;
}

export async function createSession(request: CreateSessionRequest): Promise<SessionDto> {
  const res = await apiFetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return res.json();
}
```

### Step 1.3 — Verification
`cd apps/code && npx vitest run src/services/__tests__/sessionService.test.ts` → green.

---

## SPEC-2 — `getSession`

**Tag:** [code-app]
**File:** `apps/code/src/services/sessionService.ts`
**Existing pattern:** `getSessions` (sessionService.ts:19).

### Step 2.1 — RED
```ts
it('getSession calls GET /api/sessions/{id}', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    json: () => Promise.resolve({ id: 's1', name: 'X', status: 'active' }),
  } as unknown as Response);
  const result = await getSession('s1');
  expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1');
  expect(result).toEqual({ id: 's1', name: 'X', status: 'active' });
});
```

### Step 2.2 — GREEN
```ts
export async function getSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}`);
  return res.json();
}
```

### Step 2.3 — Verification
Same vitest file → green.

---

## SPEC-3 — `pauseSession` + `resumeSession`

**Tag:** [code-app]
**File:** `apps/code/src/services/sessionService.ts`
**Existing pattern:** `stopSession` (sessionService.ts:29).

### Step 3.1 — RED
```ts
it('pauseSession calls POST /api/sessions/{id}/pause', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve({ id: 's1', status: 'paused' }) } as unknown as Response);
  await pauseSession('s1');
  expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/pause', { method: 'POST' });
});
it('resumeSession calls POST /api/sessions/{id}/resume', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve({ id: 's1', status: 'active' }) } as unknown as Response);
  await resumeSession('s1');
  expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1/resume', { method: 'POST' });
});
```

### Step 3.2 — GREEN
```ts
export async function pauseSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/pause`, { method: 'POST' });
  return res.json();
}
export async function resumeSession(id: string): Promise<SessionDto> {
  const res = await apiFetch(`/api/sessions/${id}/resume`, { method: 'POST' });
  return res.json();
}
```

### Step 3.3 — Verification
Same vitest file → green.

---

## SPEC-4 — `deleteSession` (204, no body)

**Tag:** [code-app]
**File:** `apps/code/src/services/sessionService.ts`
**Pitfalls:** MUST NOT call `res.json()` — DELETE returns 204 No Content.

### Step 4.1 — RED
```ts
it('deleteSession calls DELETE /api/sessions/{id} and does not parse body', async () => {
  const json = vi.fn();
  vi.mocked(apiFetch).mockResolvedValue({ json } as unknown as Response);
  await deleteSession('s1');
  expect(apiFetch).toHaveBeenCalledWith('/api/sessions/s1', { method: 'DELETE' });
  expect(json).not.toHaveBeenCalled();
});
```

### Step 4.2 — GREEN
```ts
export async function deleteSession(id: string): Promise<void> {
  await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
}
```

### Step 4.3 — Verification
Same vitest file → green.

---

## SPEC-5 — `useSessions` actions

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useSessions.ts`
**Existing pattern:** `startSession`/`stopSession` (useSessions.ts:40-48) — call service then `await loadSessions()`.
**Pitfalls:** must update mocks in `SpacesPage.test.tsx` AND `useSessions.test.ts` imports in same commit.

### Step 5.1 — RED
Add to `useSessions.test.ts`. Extend the `vi.mock('../../services/sessionService')` factory to include `createSession, pauseSession, resumeSession, deleteSession`. Then:
```ts
it('createSession action calls service and refreshes', async () => {
  vi.mocked(getSessions).mockResolvedValue([]);
  vi.mocked(createSession).mockResolvedValue({ id: 's9', name: 'N', status: 'created', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 });
  const { result } = renderHook(() => useSessions());
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await result.current.createSession({ repositoryPath: 'C:/P' }); });
  expect(createSession).toHaveBeenCalledWith({ repositoryPath: 'C:/P' });
  expect(getSessions).toHaveBeenCalledTimes(2);
});
```
Mirror for pause/resume/delete (each asserts service called with id + refetch count 2).

### Step 5.2 — GREEN
Import the four service fns; add four `useCallback` actions following the start/stop pattern; add them to the returned object.
```ts
const createSession = useCallback(async (request: CreateSessionRequest) => {
  await apiCreateSession(request);
  await loadSessions();
}, [loadSessions]);
// pause/resume/delete: (id) => { await apiX(id); await loadSessions(); }
```

### Step 5.3 — Verification
`cd apps/code && npx vitest run src/hooks/__tests__/useSessions.test.ts` → green.

---

## SPEC-6 — `NewSessionForm` component

**Tag:** [code-app]
**File:** `apps/code/src/components/NewSessionForm.tsx` (new)
**Existing pattern:** SpacesPage `.box` + `.box-title` usage; buttons use `.b ok` / `.b` classes.
**Pitfalls:** controlled inputs with local `useState`; do not submit when repoPath empty (disable button + guard handler).

Props: `{ onSubmit: (req: CreateSessionRequest) => void; onCancel: () => void }`.
Local state: `name`, `repoPath`, `task`. Submit builds `{ name: name||undefined, repositoryPath: repoPath, task: task||undefined }`.

### Step 6.1 — RED
`apps/code/src/components/__tests__/NewSessionForm.test.tsx`:
```tsx
it('renders inputs and a disabled submit when repoPath empty', () => {
  render(<NewSessionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByPlaceholderText(/repository path/i)).toBeDefined();
  expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(true);
});
it('calls onSubmit with entered values', () => {
  const onSubmit = vi.fn();
  render(<NewSessionForm onSubmit={onSubmit} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText(/repository path/i), { target: { value: 'C:/P' } });
  fireEvent.change(screen.getByPlaceholderText(/name/i), { target: { value: 'My Sess' } });
  fireEvent.click(screen.getByText('Create'));
  expect(onSubmit).toHaveBeenCalledWith({ name: 'My Sess', repositoryPath: 'C:/P', task: undefined });
});
it('calls onCancel on cancel', () => {
  const onCancel = vi.fn();
  render(<NewSessionForm onSubmit={vi.fn()} onCancel={onCancel} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onCancel).toHaveBeenCalled();
});
```

### Step 6.2 — GREEN
Minimal `.box` with three labeled inputs (placeholders: "Name (optional)", "Repository path", "Task (optional)"), Create button `disabled={!repoPath.trim()}`, Cancel button. No extra options.

### Step 6.3 — Verification
`npx vitest run src/components/__tests__/NewSessionForm.test.tsx` → green.

---

## SPEC-7 — `SessionDetail` component

**Tag:** [code-app]
**File:** `apps/code/src/components/SessionDetail.tsx` (new)
**Existing pattern:** SpacesPage `SessionRow` for status normalization + `.b` action buttons; `.box`/`.box-title`/`.box-body`.
**Pitfalls:** derive button enablement from status; render-safe if fields missing (optional DTO fields).

Props: `{ session: SessionDto; onStart; onPause; onResume; onStop; onDelete; onClose }` (all `(id:string)=>void` except onClose `()=>void`).
Button rules (lowercased status):
- start: status in [created, stopped]
- pause: status === active
- resume: status === paused
- stop: status in [active, paused]
- delete: always
Render: name (title), status badge, type, authority, repositoryPath ?? '-', commandCount, createdAt.

### Step 7.1 — RED
`apps/code/src/components/__tests__/SessionDetail.test.tsx`:
```tsx
const base = { id: 's1', name: 'Sess', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01T00:00:00Z', commandCount: 3, repositoryPath: 'C:/P' };
it('renders session fields', () => {
  render(<SessionDetail session={base} onStart={vi.fn()} onPause={vi.fn()} onResume={vi.fn()} onStop={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText('Sess')).toBeDefined();
  expect(screen.getByText('C:/P')).toBeDefined();
});
it('shows Pause+Stop for active, not Resume', () => {
  render(<SessionDetail session={base} .../>);
  expect(screen.queryByText('Pause')).not.toBeNull();
  expect(screen.queryByText('Stop')).not.toBeNull();
  expect(screen.queryByText('Resume')).toBeNull();
});
it('shows Resume+Stop for paused', () => {
  render(<SessionDetail session={{ ...base, status: 'paused' }} .../>);
  expect(screen.queryByText('Resume')).not.toBeNull();
});
it('calls onDelete and onClose', () => {
  const onDelete = vi.fn(); const onClose = vi.fn();
  render(<SessionDetail session={base} ... onDelete={onDelete} onClose={onClose} />);
  fireEvent.click(screen.getByText('Delete')); expect(onDelete).toHaveBeenCalledWith('s1');
  fireEvent.click(screen.getByText('Close')); expect(onClose).toHaveBeenCalled();
});
```

### Step 7.2 — GREEN
`.box` panel, conditional buttons per rules above, each `onClick={() => onX(session.id)}`. Status badge via existing `.b` + color class.

### Step 7.3 — Verification
`npx vitest run src/components/__tests__/SessionDetail.test.tsx` → green.

---

## SPEC-8 — `SpacesPage` wiring

**Tag:** [code-app]
**File:** `apps/code/src/pages/SpacesPage.tsx`
**Existing pattern:** current Sessions box (SpacesPage.tsx:131-150).
**Pitfalls:** existing 6 SpacesPage tests must stay green; `useSessions` mock in that test file must gain the 4 new fns (cross-cutting #1). Derive selected session from `sessions` array.

### Step 8.1 — RED
Add to `SpacesPage.test.tsx` (and FIRST update all `useSessions` mock returns to include `createSession, pauseSession, resumeSession, deleteSession: vi.fn()`):
```tsx
it('shows New Session form when New Session button clicked', () => {
  render(<SpacesPage />);
  fireEvent.click(screen.getByText(/New Session/i));
  expect(screen.getByPlaceholderText(/repository path/i)).toBeDefined();
});
it('shows session detail when a row is clicked', () => {
  vi.mocked(useSessions).mockReturnValue({ sessions: [{ id: 's1', name: 'Dev Session', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01T00:00:00Z', commandCount: 5 }], isLoading: false, error: null, startSession: vi.fn(), stopSession: vi.fn(), createSession: vi.fn(), pauseSession: vi.fn(), resumeSession: vi.fn(), deleteSession: vi.fn() });
  render(<SpacesPage />);
  fireEvent.click(screen.getByText('Dev Session'));
  expect(screen.getByText('Close')).toBeDefined();
});
```
NOTE: `SessionRow` currently has Start/Stop buttons inside the row; the row click handler must be on the row container, and the Start/Stop buttons must `stopPropagation` so clicking them doesn't also open detail. Verify existing "renders session rows" test still passes (it only checks text presence).

### Step 8.2 — GREEN
- Add `showForm` + `selectedId` state.
- Pull `createSession, pauseSession, resumeSession, deleteSession` from `useSessions()`.
- Render `[+] New Session` button in the Sessions box header (near `.box-meta`); toggles `showForm`.
- When `showForm`, render `<NewSessionForm onSubmit={async (req) => { await createSession(req); setShowForm(false); }} onCancel={() => setShowForm(false)} />` above the list.
- Make `SessionRow` clickable: add `onSelect` prop → `setSelectedId(session.id)`. Wrap existing Start/Stop `onClick` with `e.stopPropagation()`.
- Compute `const selected = sessions.find(s => s.id === selectedId)`. If `selectedId && selected`, render `<SessionDetail session={selected} ... onDelete={async (id)=>{ await deleteSession(id); setSelectedId(null); }} onClose={() => setSelectedId(null)} />` below the list. If `selectedId && !selected` (deleted), clear via effect or inline guard.

### Step 8.3 — Verification
`npx vitest run src/pages/__tests__/SpacesPage.test.tsx` → all (old 6 + new 2) green.

---

## Final gates (run after all SPECs)
```bash
cd apps/code && npx tsc --noEmit          # GATE-1
cd apps/code && npx vitest run            # GATE-2  (158 existing + new, all green)
```
GATE-3 (visual): N/A — Playwright MCP disconnected this cycle.

## Files
- create: `apps/code/src/components/NewSessionForm.tsx`, `apps/code/src/components/SessionDetail.tsx`, their two `__tests__` files
- modify: `apps/code/src/services/sessionService.ts`, `apps/code/src/hooks/useSessions.ts`, `apps/code/src/pages/SpacesPage.tsx`, `apps/code/src/services/__tests__/sessionService.test.ts`, `apps/code/src/hooks/__tests__/useSessions.test.ts`, `apps/code/src/pages/__tests__/SpacesPage.test.tsx`
