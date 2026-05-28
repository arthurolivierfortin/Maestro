# Plan -- Catalog Page (Phase 66-C)

## SPEC-1 -- blockService.ts

**Tag:** [code-app]
**File:** `apps/code/src/services/blockService.ts`
**Existing pattern:** `apps/code/src/services/sessionService.ts` -- same apiFetch pattern, same DTO export style
**Pitfalls:** API response shape mismatch -- must match BlockDto from C# (`id`, `name`, `blockType`, `description`, etc.)

### Step 1.1 -- RED
```typescript
// apps/code/src/services/__tests__/blockService.test.ts
// Test: getBlocks() calls GET /api/blocks
// Test: getBlocks({ type: 'agent' }) calls GET /api/blocks?type=agent
// Test: getBlocks({ search: 'git' }) calls GET /api/blocks?search=git
// Test: getBlocks({ type: 'tool', search: 'file' }) calls GET /api/blocks?type=tool&search=file
```

### Step 1.2 -- GREEN
```typescript
// apps/code/src/services/blockService.ts
import { apiFetch } from './apiClient';

export interface BlockDto {
  id: string;
  name: string;
  blockType: string;
  description: string;
  designation?: string;
  category?: string;
  isAtomic: boolean;
  tags: string[];
}

export interface GetBlocksParams {
  type?: string;
  search?: string;
}

export async function getBlocks(params?: GetBlocksParams): Promise<BlockDto[]> {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  const path = qs ? `/api/blocks?${qs}` : '/api/blocks';
  const res = await apiFetch(path);
  return res.json();
}
```

### Step 1.3 -- Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/services/__tests__/blockService.test.ts
```

## SPEC-2 -- useBlocks hook

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useBlocks.ts`
**Existing pattern:** `apps/code/src/hooks/useSessions.ts` -- useState/useEffect/useCallback, but NO polling (one-shot + re-fetch on filter change)
**Pitfalls:** useEffect dependency array must include typeFilter and searchQuery to trigger re-fetch

### Step 2.1 -- RED
```typescript
// apps/code/src/hooks/__tests__/useBlocks.test.ts
// Test: fetches blocks on mount
// Test: re-fetches when typeFilter changes
// Test: re-fetches when searchQuery changes
// Test: sets error when fetch fails
```

### Step 2.2 -- GREEN
```typescript
// apps/code/src/hooks/useBlocks.ts
// useState for blocks, isLoading, error, typeFilter, searchQuery
// useEffect fetches on mount and when typeFilter/searchQuery change
// Expose setTypeFilter and setSearchQuery
```

### Step 2.3 -- Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/hooks/__tests__/useBlocks.test.ts
```

## SPEC-3 -- BlockCard component

**Tag:** [code-app]
**File:** `apps/code/src/components/BlockCard.tsx`
**Existing pattern:** SessionRow in `apps/code/src/pages/SpacesPage.tsx:27-108` -- same layout: left indicator, name+subtitle, right badge
**Pitfalls:** Must use theme tokens, no hardcoded colors

### Step 3.1 -- RED
```typescript
// No separate test file -- tested via CatalogPage.test.tsx (SPEC-4/TEST-3)
// Verify renders as part of CatalogPage integration
```

### Step 3.2 -- GREEN
```typescript
// apps/code/src/components/BlockCard.tsx
// Renders: type badge (colored), block name, description
// Uses colors, spacing, fontFamily from theme/tokens
```

## SPEC-4 -- CatalogPage

**Tag:** [code-app]
**File:** `apps/code/src/pages/CatalogPage.tsx`
**Existing pattern:** `apps/code/src/pages/SpacesPage.tsx` -- sub-tabs for filter, list rendering, loading/error/empty states
**Pitfalls:** none specific

### Step 4.1 -- RED
```typescript
// apps/code/src/pages/__tests__/CatalogPage.test.tsx
// Mock useBlocks hook
// Test: renders type filter buttons (All, Agents, Tools, Workflows, Prompts)
// Test: renders BlockCards when blocks exist
// Test: shows loading state
// Test: shows error state
// Test: shows empty state
// Test: clicking filter button calls setTypeFilter
```

### Step 4.2 -- GREEN
```typescript
// apps/code/src/pages/CatalogPage.tsx
// Type filter buttons row + search input
// useBlocks() provides blocks, isLoading, error, typeFilter, searchQuery, setTypeFilter, setSearchQuery
// Map blocks to BlockCard components
```

### Step 4.3 -- Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/pages/__tests__/CatalogPage.test.ts
```

## SPEC-5 -- Navigation wiring

**Tag:** [code-app]
**Files:** `apps/code/src/App.tsx`, `apps/code/src/components/Header.tsx`
**Existing pattern:** App.tsx has PageId union type, Header.tsx has tabs array with pageId
**Pitfalls:** Navigation.test.tsx checks `[3] Foundry` text -- MUST update to `[3] Catalog`

### Step 5.1 -- RED
```typescript
// Update Navigation.test.tsx
// Test: clicking [3] Catalog navigates to CatalogPage
```

### Step 5.2 -- GREEN
```typescript
// App.tsx: add 'catalog' to PageId, import CatalogPage, add render branch
// Header.tsx: change tab 3 from { key: 3, label: 'Foundry', pageId: null } to { key: 3, label: 'Catalog', pageId: 'catalog' }
```

### Step 5.3 -- Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/pages/__tests__/Navigation.test.tsx
```

## Cross-cutting concerns

- **No DI changes** -- purely frontend
- **No backend changes** -- API already exists
- **Navigation test update** -- SPEC-5 must update existing test assertions
- **Import consistency** -- all new files import from relative paths, use theme tokens
