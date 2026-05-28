# Monitor Page (Cost Dashboard) — Design

**Goal:** Add a Monitor page (tab 5) showing cost summary, spending limits, and per-session cost breakdown.
**Roadmap phase:** Phase-66 (sub-phase 66-E)
**Tags:** [code-app]
**Scope (in):**
- `costsService.ts` — typed fetch wrappers for GET `/api/costs/summary` and GET `/api/costs/limits`
- `useCostData` hook — fetches summary + limits on mount, polls every 30s, exposes loading/error states
- `MonitorPage.tsx` — page component with cost cards, spending bars, per-session breakdown
- `CostCard.tsx` — reusable metric card (label, value, sub-label)
- `SpendingBar.tsx` — visual progress bar (current vs limit)
- Navigation wiring — `PageId` union includes `'monitor'`, Header tab 5 enabled, App.tsx renders MonitorPage

**Scope (out):**
- Spending limit edit/config UI — future cycle
- Cost alerts/notifications — future cycle
- Historical cost graphs (chart.js) — future cycle
- Fitness scores display — needs contracts API, future cycle
- Per-block cost breakdown — future cycle
- GET `/api/sessions/{id}/costs` integration (per-session detail view) — future cycle

**Constraints:**
- Backend API shape is FIXED (CostSummaryDto, CostLimitsDto from CostDtos.cs) — TS types must match exactly
- Follow existing pattern: service (apiFetch) -> hook (useState+useEffect+polling) -> page (conditional rendering)
- Same visual tokens (colors, spacing, fontFamily) from `theme/tokens.ts`
- No new dependencies

## Cardinal Rule check

This change adds only [code-app] TypeScript/React components. No backend C# changes. No session-type-specific logic. A new session type can still be created by JSON only. **OK.**

## No Legacy Support check

Header.tsx tab 5 currently has `pageId: null` (disabled). We replace it with `pageId: 'monitor'`. No old code to maintain — clean replacement.

## Architecture

**Data flow:** `costsService.ts` calls `apiFetch('/api/costs/summary')` and `apiFetch('/api/costs/limits')`. Types (`CostSummary`, `CostLimits`, `CostPeriod`, `CostBreakdown`, `CostLimitConfig`) mirror backend DTOs exactly (camelCase).

`useCostData` hook calls both service functions on mount and polls every 30s (same pattern as `useProviderData` with 10s). Returns `{ summary, limits, isLoading, error }`.

`MonitorPage` renders:
1. **Summary cards row** — 4x CostCard for today/thisWeek/thisMonth/allTime (totalCost + requestCount)
2. **Spending bars section** — SpendingBar for each configured limit (maxPerDay, maxPerSession, etc.). If no limits configured, shows "No spending limits configured."
3. **Provider breakdown** — simple table from `summary.byProvider`

`CostCard` is a stateless component: `{ label, value, subLabel }`.
`SpendingBar` is a stateless component: `{ label, current, max, enforcement }`.

## Affected systems

- Backend C#: NONE (API already exists)
- LLM-Provider: NONE
- TUI: `apps/code/src/` — new service, hook, page, 2 components, App.tsx + Header.tsx wiring
- CLI: NONE
- Blocks: NONE
- Contracts: NONE
- DI: NONE

## Risks

- **API shape mismatch** (common pitfall): TS types must match CostDtos.cs exactly. Verified by reading CostsController.cs + CostDtos.cs: `CostSummaryDto` has `today/thisWeek/thisMonth/allTime` (CostPeriodDto with totalCost/totalTokens/requestCount), `byProvider/byModel` (Dict<string, CostBreakdownDto>), `limits` (CostLimitsDto). CostLimitsDto has `maxPerSession/maxPerDay/maxPerWeek/maxPerMonth` as nullable `CostLimitConfigDto` (value/enforcement/autoResume).
- **Polling interval 0 bug** (Phase 63 incident): Use `30_000` constant, never compute dynamically.
- **Navigation test regression**: Must update Navigation.test.tsx to mock MonitorPage and test tab 5 click.
