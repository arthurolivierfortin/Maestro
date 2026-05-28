# Design — Align Session Status Vocabulary (Phase 66-K)

**Date:** 2026-05-28
**Phase:** Phase-66 (sub-phase 66-K)
**Tags:** [code-app]
**Linked brainstorm:** `.maestro/cycle/brainstorm.md`

## Problem

Bug found during live dogfooding (backend on :5000, real data). The frontend
`SpacesPage` / `SessionDetail` status logic only understands 5 strings
(`running`, `failed`, `created`, `active`, `stopped`) but the API returns 11
distinct statuses in production. As a result:

- The majority of real sessions render the generic grey pip (`default` case).
- `canStart` / `canStop` are wrong: an `idle` session (140 of them live) cannot
  be started or stopped from the UI even though it is a perfectly valid action.
- `active` is used as the "live" status in the frontend, but **the backend never
  emits `active`** — its canonical live status is `running`. The existing tests
  encode this mistake.

### Live evidence (curl http://localhost:5000/api/sessions)

```
 83 completed
 11 created
768 done
 32 error
140 idle
  4 new
  1 paused
559 pending
 48 running
 22 stopped
  3 updated
```

11 distinct statuses observed. The canonical enum `SessionStatus`
(`apps/backend/src/Maestro.Domain/Enums/SessionEnums.cs`) defines 8:
`Created, Running, Idle, Paused, Completed, Failed, Cancelled, Stopped`
(serialised lowercase). `cancelled` is not present in the current snapshot but is
part of the contract, so it must be covered. The remaining 5 (`done`, `error`,
`new`, `pending`, `updated`) are legacy statuses still present in historical
backend data.

## Decision

Create a dedicated pure-function module `apps/code/src/services/sessionStatus.ts`
that maps **every** status (canonical + legacy + the frontend-legacy `active`) to
a semantic group, and derives `canStart` / `canStop` / a phosphor colour class
from that group. Refactor `SpacesPage` and `SessionDetail` to consume these
functions instead of their inline switches. No status mapping logic remains
inline (No Legacy Support).

The frontend is a **consumer** of the backend: it adapts to the API. No backend
change. The legacy data statuses are not cleaned up (out of scope) — the frontend
simply handles them gracefully.

## Status → group mapping (exhaustive)

`sessionStatusGroup(status)` lowercases the input and returns one of:
`'active' | 'idle' | 'pending' | 'paused' | 'done' | 'error' | 'neutral'`.

| Status      | Origin            | Group     | canStart | canStop | Colour class | Rationale |
|-------------|-------------------|-----------|----------|---------|--------------|-----------|
| `running`   | canonical         | `active`  | no       | yes     | `cok`        | Workflow actively running — can stop it. |
| `idle`      | canonical         | `idle`    | yes      | yes     | `cok`        | Started, no workflow running — can re-run or stop. |
| `paused`    | canonical         | `paused`  | no       | yes     | `cwarn`      | Paused — resume/stop, not a fresh start. |
| `created`   | canonical         | `pending` | yes      | no      | `ca`         | Created, never started — can start, nothing to stop. |
| `pending`   | legacy            | `pending` | no       | yes     | `cwarn`      | Queued / in-flight work — stoppable, not re-startable. |
| `new`       | legacy            | `pending` | yes      | no      | `ca`         | Equivalent to `created`. |
| `completed` | canonical         | `done`    | yes      | no      | `c3`         | Finished OK — can re-run, nothing to stop. |
| `done`      | legacy            | `done`    | yes      | no      | `c3`         | Legacy equivalent of `completed`. |
| `stopped`   | canonical         | `done`    | yes      | no      | `c3`         | Manually stopped — can restart. |
| `cancelled` | canonical         | `done`    | yes      | no      | `c3`         | Cancelled — terminal, can restart. |
| `failed`    | canonical         | `error`   | yes      | no      | `cerr`       | Failed — can retry (start), nothing to stop. |
| `error`     | legacy            | `error`   | yes      | no      | `cerr`       | Legacy equivalent of `failed`. |
| `updated`   | legacy            | `neutral` | no       | no      | `c2`         | Ambiguous backend artefact (record touched) — neither start nor stop, fail safe. |
| `active`    | frontend-legacy   | `active`  | no       | yes     | `cok`        | The string the old UI/tests used for "live". Kept mapped to the active group for back-compat with existing component tests; backend never emits it. |
| *(unknown)* | —                 | `neutral` | no       | no      | `c2`         | Unknown future status — fail safe, no dangerous action offered. |

### canStart / canStop summary

- `canStart(status)` true for: `created`, `new`, `idle`, `completed`, `done`,
  `stopped`, `cancelled`, `failed`, `error`. (Sessions that are not currently
  alive and can be (re)started.)
- `canStop(status)` true for: `running`, `active`, `idle`, `paused`, `pending`.
  (Sessions that are alive / in-flight.)
- `idle` is the only status where **both** are true (it is started but not
  running a workflow — you may stop the session or kick off a new run).
- `updated` and unknown statuses: both false (safe default).

`canPause(status)`: true only for `running` / `active` (a live workflow you can
suspend). `canResume(status)`: true only for `paused`.

## Colour mapping (`statusColorClass`) and pip class

`statusColorClass(status)` returns the phosphor text-colour helper class for the
group, reusing the existing theme classes (`tui-theme.css`):

- `active` → `cok`
- `idle` → `cok`
- `pending` → `ca`
- `paused` → `cwarn`
- `done` → `c3`
- `error` → `cerr`
- `neutral` → `c2`

Note: `pending` group maps to `ca` (accent) for `created`/`new`, but the legacy
`pending`/`paused` statuses that belong to warn-coloured groups map via their own
group. The pip in `SpacesPage` and the status badge in `SessionDetail` both use
`statusColorClass`.

## Architecture

```
apps/code/src/services/sessionStatus.ts   (NEW — pure functions, no React)
  export type SessionStatusGroup
  export function sessionStatusGroup(status: string): SessionStatusGroup
  export function canStart(status: string): boolean
  export function canStop(status: string): boolean
  export function canPause(status: string): boolean
  export function canResume(status: string): boolean
  export function statusColorClass(status: string): string

apps/code/src/pages/SpacesPage.tsx        (refactor: drop inline statusClass +
                                            inline canStart/canStop; import module)
apps/code/src/components/SessionDetail.tsx (refactor: drop inline statusClass +
                                            inline canStart/canPause/canResume/
                                            canStop; import module)
```

No backend files touched.

## Cardinal Rule check

PASS — pure frontend logic that adapts to the API response. A new status added
backend-side falls into `neutral` (safe) until the frontend table is extended.
No session-type-specific code; works for any session.

## No Legacy Support check

The inline `statusClass` switches in `SpacesPage` and `SessionDetail`, plus the
inline `canStart`/`canStop`/`canPause`/`canResume` booleans, are **deleted** and
replaced by the single module. No old/new mapping coexists.

## TESTING-PROTOCOL layers applicable ([code-app] TUI)

- Layer 1: Type Check — `cd apps/code && npx tsc --noEmit`
- Layer 2: Unit Tests — `cd apps/code && npx vitest run` (table-driven over the
  11 real statuses + `active` + `cancelled` + unknown; existing suite stays green)
- Layer 3: Visual Gate — N/A if Playwright MCP disconnected; logic is pure and
  verifiable via vitest + curl against the live backend on :5000.

## Out of scope

- Changing the backend enum or cleaning legacy data.
- New statuses.
- Any navigation / layout change.
