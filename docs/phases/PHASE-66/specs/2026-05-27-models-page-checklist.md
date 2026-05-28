# Checklist — Models Page

**Linked spec:** [2026-05-27-models-page-design.md](2026-05-27-models-page-design.md)
**Tags:** [code-app]
**Phase:** Phase-66

## Code
- [x] [SPEC-1] [code-app] Create `providerService.ts` with TypeScript interfaces matching `LLMDtos.cs` and 4 fetch functions (`getHealth`, `getModels`, `getActiveProvider`, `getStats`) — `apps/code/src/services/providerService.ts`
- [x] [SPEC-2] [code-app] Create `useProviderData` hook that fetches all 4 endpoints on mount, polls every 10s, exposes `{ health, models, activeProvider, stats, isLoading, error }`, cleans up interval on unmount — `apps/code/src/hooks/useProviderData.ts`
- [x] [SPEC-3] [code-app] Create `ProviderHealthBadge` component displaying colored dot (green=healthy, yellow=degraded, red=unhealthy/unknown) + status label — `apps/code/src/components/ProviderHealthBadge.tsx`
- [x] [SPEC-4] [code-app] Create `ModelRow` component displaying model name, category, size, recommended badge, availability — `apps/code/src/components/ModelRow.tsx`
- [x] [SPEC-5] [code-app] Create `ModelsPage` using `useProviderData`, rendering health badge, active provider, stats summary, and models list with loading/error/empty states — `apps/code/src/pages/ModelsPage.tsx`
- [x] [SPEC-6] [code-app] Wire navigation: add `'models'` to `PageId` union in `App.tsx`, import + render `ModelsPage`, update Header tab 4 `pageId` from `null` to `'models'` — `apps/code/src/App.tsx` + `apps/code/src/components/Header.tsx`

## Tests
- [x] [TEST-1] `providerService` unit tests: each function calls correct API path and returns parsed JSON — `apps/code/src/services/__tests__/providerService.test.ts`
- [x] [TEST-2] `useProviderData` hook tests: fetches on mount, exposes data, handles error, cleans up interval — `apps/code/src/hooks/__tests__/useProviderData.test.ts`
- [x] [TEST-3] `ProviderHealthBadge` renders correct color and label for each status — `apps/code/src/components/__tests__/ProviderHealthBadge.test.tsx`
- [x] [TEST-4] `ModelRow` renders model name, category, recommended badge — `apps/code/src/components/__tests__/ModelRow.test.tsx`
- [x] [TEST-5] `ModelsPage` renders loading/error/empty/populated states using mocked hook — `apps/code/src/pages/__tests__/ModelsPage.test.tsx`
- [x] [TEST-6] Navigation test updated: clicking `[4] Models` tab navigates to ModelsPage — `apps/code/src/pages/__tests__/Navigation.test.tsx`

## Database / Migrations
- [ ] [DB-0] None

## Block / Contract changes
- [ ] [BLOCK-0] None

## Verification gates (6 layers TESTING-PROTOCOL)
- [ ] [GATE-1] Layer 1 Type Check : `cd apps/code && npx tsc --noEmit`
- [ ] [GATE-2] Layer 2 Unit Tests : `cd apps/code && npm test`
