# Checklist -- Catalog Page

**Linked spec:** [2026-05-27-catalog-page-design.md](2026-05-27-catalog-page-design.md)
**Tags:** [code-app]
**Phase:** Phase-66

## Code
- [x] [SPEC-1] [code-app] Create `blockService.ts` with `BlockDto` type and `getBlocks(params?)` function calling `GET /api/blocks` -- `apps/code/src/services/blockService.ts`
- [x] [SPEC-2] [code-app] Create `useBlocks` hook managing blocks array, loading, error, typeFilter, searchQuery, with re-fetch on filter change -- `apps/code/src/hooks/useBlocks.ts`
- [x] [SPEC-3] [code-app] Create `BlockCard` component rendering block name, type badge, and description using theme tokens -- `apps/code/src/components/BlockCard.tsx`
- [x] [SPEC-4] [code-app] Create `CatalogPage` with type filter buttons (All/agent/tool/workflow/prompt), search input, and block grid using `useBlocks` -- `apps/code/src/pages/CatalogPage.tsx`
- [x] [SPEC-5] [code-app] Wire navigation: add `'catalog'` to `PageId` type in `App.tsx`, render `CatalogPage`, update Header tab 3 from disabled "Foundry" to active "Catalog" with `pageId: 'catalog'` -- `apps/code/src/App.tsx` + `apps/code/src/components/Header.tsx`

## Tests
- [x] [TEST-1] `blockService.test.ts`: `getBlocks()` calls `GET /api/blocks` and returns parsed JSON; `getBlocks({ type: 'agent' })` appends `?type=agent`; `getBlocks({ search: 'git' })` appends `?search=git` -- `apps/code/src/services/__tests__/blockService.test.ts`
- [x] [TEST-2] `useBlocks.test.ts`: hook fetches blocks on mount, exposes blocks/isLoading/error; re-fetches when typeFilter changes; re-fetches when searchQuery changes -- `apps/code/src/hooks/__tests__/useBlocks.test.ts`
- [x] [TEST-3] `CatalogPage.test.tsx`: renders type filter buttons; renders block cards when blocks exist; shows loading state; shows error state; shows empty state -- `apps/code/src/pages/__tests__/CatalogPage.test.tsx`
- [x] [TEST-4] Update `Navigation.test.tsx`: tab 3 now says `[3] Catalog` and navigates to CatalogPage -- `apps/code/src/pages/__tests__/Navigation.test.tsx`

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None

## Verification gates (6 layers TESTING-PROTOCOL)
- [x] [GATE-1] Layer 1 Type Check: `cd apps/code && npx tsc --noEmit` -- 0 errors
- [x] [GATE-2] Layer 2 Unit Tests: `cd apps/code && npm test` -- 13 files, 49 tests passed
- [x] [GATE-3] Layer 4 Real Demo Check: N/A (no real-demo-check.cjs in apps/code)
