# Plan — session status vocabulary (Phase 66-K)

**Linked spec:** [../specs/2026-05-28-session-status-vocabulary-design.md](../specs/2026-05-28-session-status-vocabulary-design.md)
**Linked checklist:** [../specs/2026-05-28-session-status-vocabulary-checklist.md](../specs/2026-05-28-session-status-vocabulary-checklist.md)
**Tags:** [code-app]

## Order of work (TDD)

1. **Write `sessionStatus.test.ts` first** (RED): table-driven cases over the 11
   real statuses + `cancelled` + `active` + unknown, covering `sessionStatusGroup`,
   `canStart`, `canStop`, `canPause`, `canResume`, `statusColorClass`.
2. **Implement `sessionStatus.ts`** (GREEN): single mapping table from status →
   group; derive each predicate from the group (plus a few status-specific tweaks
   captured in the spec table — e.g. `created`/`new` are start-only `pending`,
   `pending` proper is stop-only). Lowercase input; unknown → `neutral`.
3. **Refactor `SpacesPage.tsx`**: remove inline `statusClass`, `isActive`,
   `canStart`, `canStop`. `StatusPip` → `className={statusColorClass(status)}`.
   `SessionRow` → `canStart(session.status)` / `canStop(session.status)`.
4. **Refactor `SessionDetail.tsx`**: remove inline `statusClass` + can-booleans.
   Badge `className={`b ${statusColorClass(...)}`}` — note badge uses the `b`
   button-tint class set (`ok/ac/warn/err`), so add a small `statusBadgeClass`
   OR reuse the colour helper. Decision: keep the existing `b <tint>` badge by
   mapping group → tint inline-free via a `statusBadgeClass(status)` exported from
   the module is overkill; instead the badge keeps using `statusColorClass` text
   colour on a `b` element. Verify visually-equivalent in tests (class assertion).
5. **Run gates**: `npx tsc --noEmit` then `npx vitest run` in `apps/code`.
6. **Verify against live backend**: `curl :5000/api/sessions` confirms the status
   set the table covers.

## Risk notes

- Existing tests use `status: 'active'` and expect Pause/Stop. The mapping keeps
  `active` in the `active` group so those tests stay green. Do **not** delete the
  `active` handling even though the backend never emits it — it is the
  frontend-legacy contract the current tests depend on.
- `SessionDetail` badge currently uses `b ok|ac|err` (button tint classes), not
  `cok/ca/cerr`. The refactor must keep the badge readable. Simplest: the badge
  `<span className={`b ${statusColorClass(...)}`}>` — but `b cok` is not a defined
  combo. Cleanest is to keep the badge using the text-colour helper directly
  (`statusColorClass`) on a bordered span, OR add `statusBadgeClass`. Builder to
  pick the minimal change that keeps the badge styled and tests asserting on the
  class green. Prefer reusing `statusColorClass` for both pip and badge text.
