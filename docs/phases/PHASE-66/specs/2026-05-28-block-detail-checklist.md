# Checklist — block detail view

**Linked spec:** [2026-05-28-block-detail-design.md](2026-05-28-block-detail-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (66-J)

## Code
- [x] [SPEC-1] [code-app] Extend `BlockDto` with optional `version?`, `capabilities?`, `author?`, `contract?`, `isSystem?` (additive, no break to `getBlocks`) — `apps/code/src/services/blockService.ts`
- [x] [SPEC-2] [code-app] Add `getBlock(id)` (GET `/api/blocks/{id}`, returns parsed `BlockDto`) — `apps/code/src/services/blockService.ts`
- [x] [SPEC-3] [code-app] Add `getBlockContent(id, filePath)` (GET `/api/blocks/{id}/content/{filePath}`); returns `await res.text()` on 2xx, returns `null` on 404, throws on other non-ok status — `apps/code/src/services/blockService.ts`
- [x] [SPEC-4] [code-app] `useBlockDetail(blockId)` hook: when `blockId` set, fetches metadata via `getBlock`; tries `getBlockContent(id, "<id>.<blockType>.block.json")` then `"<id>.block.json"` for `configContent` (first non-null wins); tries `getBlockContent(id, "system-prompt.md")` for `promptContent`; exposes `{ block, configContent, promptContent, isLoading, error }`; `error` set only if metadata fetch fails; resets state when `blockId` is null — `apps/code/src/hooks/useBlockDetail.ts`
- [x] [SPEC-5] [code-app] `BlockDetail` component: `.box` panel with metadata header (id as `.box-title`, type `.b` badge, name, designation/category/contract/isAtomic, tags) + `block.json` `<pre>` section rendered only when `configContent` non-null + `system-prompt.md` `<pre>` section rendered only when `promptContent` non-null + Close button calling `onClose`; pretty-prints JSON via parse/stringify with raw-text fallback — `apps/code/src/components/BlockDetail.tsx`
- [x] [SPEC-6] [code-app] `BlockCard` gains optional `onClick?: (id: string) => void`; root row calls it on click; existing rendering/strings unchanged — `apps/code/src/components/BlockCard.tsx`
- [x] [SPEC-7] [code-app] `CatalogPage` holds `selectedBlockId`; passes `onClick={setSelectedBlockId}` to each `BlockCard`; renders `BlockDetail` (via `useBlockDetail`) when selected; Close clears selection; existing list strings/handlers unchanged — `apps/code/src/pages/CatalogPage.tsx`

## Tests
- [x] [TEST-1] `getBlock(id)` calls GET `/api/blocks/b1` and returns parsed DTO — `apps/code/src/services/__tests__/blockService.test.ts::getBlock calls GET /api/blocks/{id}`
- [x] [TEST-2] `getBlockContent` returns text on ok, returns `null` on 404, throws on 500 — `apps/code/src/services/__tests__/blockService.test.ts::getBlockContent (ok / 404 / error)`
- [x] [TEST-3] `useBlockDetail` fetches metadata + first-resolving config candidate + system-prompt; null `blockId` keeps cleared state — `apps/code/src/hooks/__tests__/useBlockDetail.test.ts::loads metadata and content / handles null id`
- [x] [TEST-4] `useBlockDetail` falls back to `<id>.block.json` when `<id>.<type>.block.json` is 404, and leaves `promptContent` null when system-prompt is 404 — `apps/code/src/hooks/__tests__/useBlockDetail.test.ts::candidate fallback and graceful 404`
- [x] [TEST-5] `BlockDetail` renders metadata header always; shows block.json section only when configContent present; shows prompt section only when promptContent present; Close calls `onClose` — `apps/code/src/components/__tests__/BlockDetail.test.tsx`
- [x] [TEST-6] `BlockCard` calls `onClick` with block id when clicked; still renders name/type/description without `onClick` — `apps/code/src/components/__tests__/BlockCard.test.tsx::calls onClick / renders without onClick`
- [x] [TEST-7] `CatalogPage`: clicking a block row renders the detail panel; Close removes it; existing read-only assertions still pass — `apps/code/src/pages/__tests__/CatalogPage.test.tsx::shows detail on block click / closes detail`

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None

## Verification gates (TESTING-PROTOCOL layers applicable to [code-app] TUI)
- [x] [GATE-1] Layer 1 Type Check : `cd apps/code && npx tsc --noEmit`
- [x] [GATE-2] Layer 2 Unit Tests : `cd apps/code && npx vitest run` (all existing 179 + new tests green)
- [x] [GATE-3] Layer 3 Visual Gate : N/A this cycle — Playwright MCP disconnected; verification deferred to a later dogfooding session
