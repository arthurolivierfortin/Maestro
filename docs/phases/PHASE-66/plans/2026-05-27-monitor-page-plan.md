# Implementation Plan — Monitor Page (Cost Dashboard)

**Issue:** #68
**Spec:** `docs/phases/PHASE-66/specs/2026-05-27-monitor-page-design.md`
**Checklist:** `docs/phases/PHASE-66/specs/2026-05-27-monitor-page-checklist.md`

## SPEC-1 — costsService.ts

**Tag:** [code-app]
**File:** `apps/code/src/services/costsService.ts`
**Existing pattern:** `apps/code/src/services/providerService.ts` — same `apiFetch` + typed return
**Pitfalls:** API shape mismatch — types MUST match CostDtos.cs exactly (verified)

### Step 1.1 — RED (test first)
File: `apps/code/src/services/__tests__/costsService.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getCostSummary, getCostLimits } from '../costsService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('costsService', () => {
  it('getCostSummary() calls GET /api/costs/summary and returns parsed JSON', async () => {
    const mockSummary = { today: { totalCost: 1.5, totalTokens: 1000, requestCount: 5 }, thisWeek: { totalCost: 0, totalTokens: 0, requestCount: 0 }, thisMonth: { totalCost: 0, totalTokens: 0, requestCount: 0 }, allTime: { totalCost: 0, totalTokens: 0, requestCount: 0 }, byProvider: {}, byModel: {}, limits: null };
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockSummary) } as unknown as Response);
    const result = await getCostSummary();
    expect(apiFetch).toHaveBeenCalledWith('/api/costs/summary');
    expect(result).toEqual(mockSummary);
  });

  it('getCostLimits() calls GET /api/costs/limits and returns parsed JSON', async () => {
    const mockLimits = { maxPerSession: null, maxPerDay: { value: 5.0, enforcement: 'block', autoResume: false }, maxPerWeek: null, maxPerMonth: null };
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockLimits) } as unknown as Response);
    const result = await getCostLimits();
    expect(apiFetch).toHaveBeenCalledWith('/api/costs/limits');
    expect(result).toEqual(mockLimits);
  });
});
```

### Step 1.2 — GREEN (implementation)
File: `apps/code/src/services/costsService.ts`
```typescript
import { apiFetch } from './apiClient';

// Types matching CostDtos.cs (camelCase serialization)

export interface CostPeriod {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
}

export interface CostBreakdown {
  totalCost: number;
  totalTokens: number;
}

export interface CostLimitConfig {
  value: number | null;
  enforcement: string;
  autoResume: boolean;
}

export interface CostLimits {
  maxPerSession: CostLimitConfig | null;
  maxPerDay: CostLimitConfig | null;
  maxPerWeek: CostLimitConfig | null;
  maxPerMonth: CostLimitConfig | null;
}

export interface CostSummary {
  today: CostPeriod;
  thisWeek: CostPeriod;
  thisMonth: CostPeriod;
  allTime: CostPeriod;
  byProvider: Record<string, CostBreakdown>;
  byModel: Record<string, CostBreakdown>;
  limits: CostLimits | null;
}

export async function getCostSummary(): Promise<CostSummary> {
  const res = await apiFetch('/api/costs/summary');
  return res.json();
}

export async function getCostLimits(): Promise<CostLimits> {
  const res = await apiFetch('/api/costs/limits');
  return res.json();
}
```

### Step 1.3 — Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/services/__tests__/costsService.test.ts
```

---

## SPEC-2 — useCostData hook

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useCostData.ts`
**Existing pattern:** `apps/code/src/hooks/useProviderData.ts` — same structure (useState, useEffect, useCallback, useRef, setInterval)
**Pitfalls:** Polling interval must be constant `30_000`, never computed (Phase 63 incident)

### Step 2.1 — RED
File: `apps/code/src/hooks/__tests__/useCostData.test.ts`
```typescript
// Same pattern as useProviderData.test.ts — mock service, renderHook, waitFor
// Tests: fetches on mount, exposes data, handles error, cleans up interval, starts in loading state
```

### Step 2.2 — GREEN
```typescript
// Same structure as useProviderData.ts with POLL_INTERVAL = 30_000
// fetchAll calls getCostSummary() + getCostLimits() via Promise.all
// Returns { summary, limits, isLoading, error }
```

---

## SPEC-3 — CostCard component

**Tag:** [code-app]
**File:** `apps/code/src/components/CostCard.tsx`
**Existing pattern:** Inline styled components like ModelRow, ProviderHealthBadge
**Pitfalls:** None specific

Props: `{ label: string; value: string; subLabel?: string }`

---

## SPEC-4 — SpendingBar component

**Tag:** [code-app]
**File:** `apps/code/src/components/SpendingBar.tsx`
**Existing pattern:** Same as CostCard

Props: `{ label: string; current: number; max: number; enforcement?: string }`
- Progress bar visual: colored div inside container div
- Percentage = current/max clamped to 100%
- If max <= 0, show "No limit"
- Color: green (<60%), accent/yellow (60-90%), error/red (>90%)

---

## SPEC-5 — MonitorPage

**Tag:** [code-app]
**File:** `apps/code/src/pages/MonitorPage.tsx`
**Existing pattern:** `ModelsPage.tsx` — same layout (status bar + content area, loading/error/data states)

---

## SPEC-6 — Navigation wiring

**Tag:** [code-app]
**Files:**
- `apps/code/src/App.tsx` — add `'monitor'` to PageId union, import MonitorPage, add render condition
- `apps/code/src/components/Header.tsx` — change tab 5 `pageId: null` to `pageId: 'monitor'`

**Existing pattern:** Same as how ModelsPage was added (tab 4)

---

## Cross-cutting concerns

- **Navigation.test.tsx**: Must be updated to mock MonitorPage and test tab 5 click (part of TEST-6)
- **No DI changes**: No backend code touched
- **No new dependencies**: All uses existing React + theme tokens

## Plan verdict

- Files to create: costsService.ts, useCostData.ts, CostCard.tsx, SpendingBar.tsx, MonitorPage.tsx + 5 test files
- Files to modify: App.tsx, Header.tsx, Navigation.test.tsx
- Cardinal Rule: OK
- No Legacy Support: OK (tab 5 null -> 'monitor', clean replacement)
- Common pitfalls checked: API shape mismatch (verified against CostDtos.cs), polling interval (constant 30_000), @ts-nocheck (never)
