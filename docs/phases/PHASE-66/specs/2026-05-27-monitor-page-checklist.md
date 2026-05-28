# Checklist — Monitor Page (Cost Dashboard)

**Linked spec:** [2026-05-27-monitor-page-design.md](2026-05-27-monitor-page-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (sub-phase 66-E)

## Code
- [x] [SPEC-1] [code-app] Create `costsService.ts` with TS types matching CostDtos.cs and functions `getCostSummary()`, `getCostLimits()` — `apps/code/src/services/costsService.ts`
- [x] [SPEC-2] [code-app] Create `useCostData` hook that fetches summary+limits on mount, polls 30s, exposes `{ summary, limits, isLoading, error }` — `apps/code/src/hooks/useCostData.ts`
- [x] [SPEC-3] [code-app] Create `CostCard` component (label, value, subLabel) — `apps/code/src/components/CostCard.tsx`
- [x] [SPEC-4] [code-app] Create `SpendingBar` component (label, current, max, enforcement, visual progress) — `apps/code/src/components/SpendingBar.tsx`
- [x] [SPEC-5] [code-app] Create `MonitorPage` that renders cost cards, spending bars, provider breakdown — `apps/code/src/pages/MonitorPage.tsx`
- [x] [SPEC-6] [code-app] Wire navigation: add `'monitor'` to `PageId` union in App.tsx, enable tab 5 in Header.tsx (`pageId: 'monitor'`), render `<MonitorPage />` — `apps/code/src/App.tsx` + `apps/code/src/components/Header.tsx`

## Tests
- [x] [TEST-1] costsService unit tests: `getCostSummary` calls `/api/costs/summary`, `getCostLimits` calls `/api/costs/limits` — `apps/code/src/services/__tests__/costsService.test.ts`
- [x] [TEST-2] useCostData hook tests: fetches on mount, exposes data, handles error, cleans up interval — `apps/code/src/hooks/__tests__/useCostData.test.ts`
- [x] [TEST-3] CostCard renders label, value, subLabel — `apps/code/src/components/__tests__/CostCard.test.tsx`
- [x] [TEST-4] SpendingBar renders label, progress bar, handles zero max — `apps/code/src/components/__tests__/SpendingBar.test.tsx`
- [x] [TEST-5] MonitorPage shows loading, error, cost cards, spending bars, empty limits state — `apps/code/src/pages/__tests__/MonitorPage.test.tsx`
- [x] [TEST-6] Navigation test: tab 5 click navigates to MonitorPage — update `apps/code/src/pages/__tests__/Navigation.test.tsx`

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None

## Verification gates (6 layers TESTING-PROTOCOL)
- [x] [GATE-1] Layer 1 Type Check: `cd apps/code && npx tsc --noEmit` — PASS (0 errors)
- [x] [GATE-2] Layer 2 Unit Tests: `cd apps/code && npm test` — PASS (94 tests, 23 files)
- [x] [GATE-3] Layer 4 Real Demo Check: N/A (no real-demo-check.cjs in apps/code)
- [x] [GATE-4] Layer 5 Integration: N/A (no backend changes)
- [x] [GATE-5] Provider verification: N/A (no workflow/agent changes)
