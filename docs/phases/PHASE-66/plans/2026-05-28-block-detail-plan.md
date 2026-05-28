# Plan — Block Detail View (Phase 66-J)

**Spec:** `docs/phases/PHASE-66/specs/2026-05-28-block-detail-design.md`
**Checklist:** `docs/phases/PHASE-66/specs/2026-05-28-block-detail-checklist.md`
**Tags:** [code-app] — `apps/code/` only, no backend changes.

## Approach (TDD strict, one commit per SPEC)

Order so each layer is testable before the next consumes it: service → hook → presentational components → page wiring.

### Commit 1 — [SPEC-1]+[SPEC-2]+[SPEC-3] service (+[TEST-1][TEST-2])
- **Decision (confirmed):** `apiClient.apiFetch` THROWS on any non-ok status and consumes the body via `res.json()` (apiClient.ts:5-8). The content endpoint returns `text/plain`, and we must distinguish 404 (→ null) from 500 (→ throw). Therefore:
  - `getBlock(id)` uses `apiFetch('/api/blocks/' + id)` then `res.json()` (200/404 mapping handled by apiFetch throw — 404 propagates as error, which is correct: metadata 404 is a real error).
  - `getBlockContent(id, filePath)` does its OWN `fetch` (import `API_URL` from apiClient) so it can branch on `res.status`: `404 → return null`, `!res.ok → throw new Error`, else `return res.text()`. Do NOT route content through `apiFetch` (it would `res.json()` a text body).
- Red: add `blockService.test.ts` cases. Mock `global.fetch` for `getBlockContent` (ok→text, 404→null, 500→throw); keep mocking `apiFetch` for `getBlock` (consistent with existing `getBlocks` tests).
- Green: extend `BlockDto` (optional `version`, `capabilities`, `author`, `contract`, `isSystem`); add `getBlock` + `getBlockContent` as above.

### Commit 2 — [SPEC-4] useBlockDetail hook (+[TEST-3][TEST-4])
- Red: `useBlockDetail.test.ts` — mock `getBlock`/`getBlockContent`; assert metadata load, first-resolving config candidate, system-prompt load, null-id cleared state, candidate fallback when first is null, graceful null prompt on 404.
- Green: implement hook with the two-candidate config strategy `[<id>.<blockType>.block.json, <id>.block.json]`. `error` set only when `getBlock` rejects.

### Commit 3 — [SPEC-5] BlockDetail component (+[TEST-5])
- Red: `BlockDetail.test.tsx` — metadata header always; block.json section only with configContent; prompt section only with promptContent; Close calls `onClose`.
- Green: `.box` panel mirroring `SessionDetail.tsx`. Pretty-print JSON with try/catch raw fallback.

### Commit 4 — [SPEC-6] BlockCard onClick (+[TEST-6])
- Red: add `onClick` cases to `BlockCard.test.tsx`.
- Green: add optional `onClick?: (id: string) => void`, wire to root row. Keep all existing strings/markup.

### Commit 5 — [SPEC-7] CatalogPage wiring (+[TEST-7])
- Red: `CatalogPage.test.tsx` — clicking a row shows detail, Close removes it; keep existing read-only assertions.
- Green: `selectedBlockId` state, pass `onClick`, render `BlockDetail` via `useBlockDetail`.

## Gates after each commit
- `cd apps/code && npx tsc --noEmit`
- `cd apps/code && npx vitest run` (179 baseline + new stay green)

## Watch-outs
- apiClient 404 behavior — confirm before writing `getBlockContent` (see Commit 1).
- No `@ts-nocheck`. No backend edits. Commit messages: `feat(#<issue>) [SPEC-N] [code-app]: ...`.
- Content 404 is expected for most blocks (backend resolves content only under ProjectBlocksPath/<id>) — never render it as an error.
