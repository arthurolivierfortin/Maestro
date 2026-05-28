# Implementation Plan — Models Page (Phase 66-D)

**Issue:** #66
**Spec:** `docs/phases/PHASE-66/specs/2026-05-27-models-page-design.md`
**Checklist:** `docs/phases/PHASE-66/specs/2026-05-27-models-page-checklist.md`
**Tags:** [code-app]

## SPEC-1 — providerService.ts with TS interfaces + 4 fetch functions

**Tag:** [code-app]
**File:** `apps/code/src/services/providerService.ts` (new)
**Existing pattern:** `apps/code/src/services/blockService.ts` — same `apiFetch` usage, same export pattern.
**Pitfalls:**
- SDK/backend type mismatch: types MUST match `LLMDtos.cs` camelCase fields exactly
- `/api/provider/active` returns anonymous `{ provider: string, gatewayType: string }` — not a named DTO

### Step 1.1 — RED (test first)
```typescript
// apps/code/src/services/__tests__/providerService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { getHealth, getModels, getActiveProvider, getStats } from '../providerService';
import { apiFetch } from '../apiClient';

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe('providerService', () => {
  it('getHealth() calls GET /api/provider/health', async () => {
    const mockHealth = { status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false };
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockHealth) } as unknown as Response);

    const result = await getHealth();
    expect(apiFetch).toHaveBeenCalledWith('/api/provider/health');
    expect(result).toEqual(mockHealth);
  });

  it('getModels() calls GET /api/provider/models', async () => {
    const mockModels = { count: 0, models: [] };
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockModels) } as unknown as Response);

    const result = await getModels();
    expect(apiFetch).toHaveBeenCalledWith('/api/provider/models');
    expect(result).toEqual(mockModels);
  });

  it('getActiveProvider() calls GET /api/provider/active', async () => {
    const mockActive = { provider: 'llm-provider', gatewayType: 'LLMProviderGateway' };
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockActive) } as unknown as Response);

    const result = await getActiveProvider();
    expect(apiFetch).toHaveBeenCalledWith('/api/provider/active');
    expect(result).toEqual(mockActive);
  });

  it('getStats() calls GET /api/provider/stats', async () => {
    const mockStats = { totalRequests: 100, totalErrors: 2, errorRate: 0.02, promptTokens: 500, completionTokens: 300, totalTokens: 800 };
    vi.mocked(apiFetch).mockResolvedValue({ json: () => Promise.resolve(mockStats) } as unknown as Response);

    const result = await getStats();
    expect(apiFetch).toHaveBeenCalledWith('/api/provider/stats');
    expect(result).toEqual(mockStats);
  });
});
```

### Step 1.2 — GREEN (minimal implementation)
```typescript
// apps/code/src/services/providerService.ts
import { apiFetch } from './apiClient';

// Types matching LLMDtos.cs (camelCase)
export interface ProviderHealth {
  status: string;
  activeModel: string | null;
  modelsLoaded: number;
  device: string;
  cudaAvailable: boolean;
  cudaDeviceName: string | null;
}

export interface CompatibleModel {
  modelId: string;
  name: string;
  description: string | null;
  category: string | null;
  size: string | null;
  parametersB: number;
  contextLength: number;
  vramFp16Gb: number;
  vramInt8Gb: number;
  vramInt4Gb: number;
  capabilities: string[];
  license: string | null;
  recommended: boolean;
  canRunFp16: boolean;
  canRunInt8: boolean;
  canRunInt4: boolean;
  recommendedPrecision: string | null;
  quantizationRequired: string | null;
  vramRequired: number;
  isLocal: boolean;
  isAvailable: boolean;
  inputTokenPricePerMillion: number | null;
  outputTokenPricePerMillion: number | null;
}

export interface CompatibleModelsResponse {
  hardware: { gpuAvailable: boolean; gpuName: string | null; vramTotalGb: number; vramFreeGb: number } | null;
  summary: { totalCompatible: number; fullPrecisionCount: number; int8RequiredCount: number; int4RequiredCount: number; note: string | null } | null;
  count: number;
  models: CompatibleModel[];
}

export interface ActiveProviderInfo {
  provider: string;
  gatewayType: string;
}

export interface PerModelStats {
  model: string;
  requests: number;
  avgLatencyMs: number;
  totalTokens: number;
  rpm: number;
}

export interface ProviderStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  avgLatencyMs: number;
  perModel: PerModelStats[];
}

export async function getHealth(): Promise<ProviderHealth> {
  const res = await apiFetch('/api/provider/health');
  return res.json();
}

export async function getModels(): Promise<CompatibleModelsResponse> {
  const res = await apiFetch('/api/provider/models');
  return res.json();
}

export async function getActiveProvider(): Promise<ActiveProviderInfo> {
  const res = await apiFetch('/api/provider/active');
  return res.json();
}

export async function getStats(): Promise<ProviderStats> {
  const res = await apiFetch('/api/provider/stats');
  return res.json();
}
```

### Step 1.3 — Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/services/__tests__/providerService.test.ts
```

---

## SPEC-2 — useProviderData hook with polling

**Tag:** [code-app]
**File:** `apps/code/src/hooks/useProviderData.ts` (new)
**Existing pattern:** `apps/code/src/hooks/useBlocks.ts` — same useState/useEffect/useCallback pattern
**Pitfalls:**
- Polling memory leak: must clearInterval in useEffect cleanup
- useEffect dependency array must include the fetch callback

### Step 2.1 — RED
```typescript
// apps/code/src/hooks/__tests__/useProviderData.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/providerService', () => ({
  getHealth: vi.fn(),
  getModels: vi.fn(),
  getActiveProvider: vi.fn(),
  getStats: vi.fn(),
}));

import { useProviderData } from '../useProviderData';
import { getHealth, getModels, getActiveProvider, getStats } from '../../services/providerService';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getHealth).mockResolvedValue({ status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false, cudaDeviceName: null });
  vi.mocked(getModels).mockResolvedValue({ hardware: null, summary: null, count: 0, models: [] });
  vi.mocked(getActiveProvider).mockResolvedValue({ provider: 'llm-provider', gatewayType: 'LLMProviderGateway' });
  vi.mocked(getStats).mockResolvedValue({ totalRequests: 10, totalErrors: 0, errorRate: 0, promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0, avgLatencyMs: 0, perModel: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useProviderData', () => {
  it('fetches all endpoints on mount', async () => {
    const { result } = renderHook(() => useProviderData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getHealth).toHaveBeenCalledTimes(1);
    expect(getModels).toHaveBeenCalledTimes(1);
    expect(getActiveProvider).toHaveBeenCalledTimes(1);
    expect(getStats).toHaveBeenCalledTimes(1);
    expect(result.current.health?.status).toBe('healthy');
    expect(result.current.error).toBeNull();
  });

  it('sets error when a fetch fails', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('Connection refused'));
    const { result } = renderHook(() => useProviderData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Connection refused');
  });

  it('polls every 10 seconds', async () => {
    const { result } = renderHook(() => useProviderData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getHealth).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10000);
    await waitFor(() => expect(getHealth).toHaveBeenCalledTimes(2));
  });

  it('cleans up interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useProviderData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    unmount();
    vi.advanceTimersByTime(20000);
    // Should not have been called again after unmount
    expect(getHealth).toHaveBeenCalledTimes(1);
  });
});
```

### Step 2.2 — GREEN
```typescript
// apps/code/src/hooks/useProviderData.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getHealth, getModels, getActiveProvider, getStats } from '../services/providerService';
import type { ProviderHealth, CompatibleModelsResponse, ActiveProviderInfo, ProviderStats } from '../services/providerService';

const POLL_INTERVAL = 10_000;

export function useProviderData() {
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [models, setModels] = useState<CompatibleModelsResponse | null>(null);
  const [activeProvider, setActiveProvider] = useState<ActiveProviderInfo | null>(null);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [h, m, a, s] = await Promise.all([getHealth(), getModels(), getActiveProvider(), getStats()]);
      if (!mountedRef.current) return;
      setHealth(h);
      setModels(m);
      setActiveProvider(a);
      setStats(s);
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to fetch provider data');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const id = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchAll]);

  return { health, models, activeProvider, stats, isLoading, error };
}
```

### Step 2.3 — Verification
```bash
cd C:/Meastro/apps/code && npx vitest run src/hooks/__tests__/useProviderData.test.ts
```

---

## SPEC-3 — ProviderHealthBadge component

**Tag:** [code-app]
**File:** `apps/code/src/components/ProviderHealthBadge.tsx` (new)
**Existing pattern:** `BlockCard.tsx` — same styling with theme tokens
**Pitfalls:** None specific

### Step 3.1 — RED
```tsx
// apps/code/src/components/__tests__/ProviderHealthBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderHealthBadge } from '../ProviderHealthBadge';

describe('ProviderHealthBadge', () => {
  it('renders green dot for "healthy" status', () => {
    render(<ProviderHealthBadge status="healthy" />);
    expect(screen.getByText('healthy')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(76, 175, 80)'); // colors.success
  });

  it('renders yellow dot for "degraded" status', () => {
    render(<ProviderHealthBadge status="degraded" />);
    expect(screen.getByText('degraded')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(255, 179, 0)'); // colors.accent
  });

  it('renders red dot for "unhealthy" status', () => {
    render(<ProviderHealthBadge status="unhealthy" />);
    expect(screen.getByText('unhealthy')).toBeDefined();
    const dot = screen.getByTestId('health-dot');
    expect(dot.style.backgroundColor).toBe('rgb(255, 82, 82)'); // colors.error
  });

  it('renders red dot for unknown/null status', () => {
    render(<ProviderHealthBadge status="unknown" />);
    expect(screen.getByText('unknown')).toBeDefined();
  });
});
```

### Step 3.2 — GREEN
```tsx
// apps/code/src/components/ProviderHealthBadge.tsx
import { colors, fontFamily } from '../theme/tokens';

const statusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy': return colors.success;
    case 'degraded': return colors.accent;
    default: return colors.error;
  }
};

interface ProviderHealthBadgeProps {
  status: string;
}

export function ProviderHealthBadge({ status }: ProviderHealthBadgeProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily, fontSize: '13px' }}>
      <span data-testid="health-dot" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor(status), display: 'inline-block' }} />
      <span style={{ color: statusColor(status), textTransform: 'uppercase', fontWeight: 600, fontSize: '11px' }}>{status}</span>
    </span>
  );
}
```

---

## SPEC-4 — ModelRow component

**Tag:** [code-app]
**File:** `apps/code/src/components/ModelRow.tsx` (new)
**Existing pattern:** `BlockCard.tsx` — row layout with border-bottom

### Step 4.1 — RED
```tsx
// apps/code/src/components/__tests__/ModelRow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelRow } from '../ModelRow';

const baseModel = {
  modelId: 'gpt-4',
  name: 'GPT-4',
  description: 'Large model',
  category: 'chat',
  size: '175B',
  parametersB: 175,
  contextLength: 128000,
  vramFp16Gb: 0, vramInt8Gb: 0, vramInt4Gb: 0,
  capabilities: ['chat', 'code'],
  license: 'proprietary',
  recommended: true,
  canRunFp16: true, canRunInt8: true, canRunInt4: true,
  recommendedPrecision: 'fp16',
  quantizationRequired: null,
  vramRequired: 0,
  isLocal: false,
  isAvailable: true,
  inputTokenPricePerMillion: null,
  outputTokenPricePerMillion: null,
};

describe('ModelRow', () => {
  it('renders model name and category', () => {
    render(<ModelRow model={baseModel} />);
    expect(screen.getByText('GPT-4')).toBeDefined();
    expect(screen.getByText('chat')).toBeDefined();
  });

  it('shows recommended badge when recommended', () => {
    render(<ModelRow model={baseModel} />);
    expect(screen.getByText('RECOMMENDED')).toBeDefined();
  });

  it('hides recommended badge when not recommended', () => {
    render(<ModelRow model={{ ...baseModel, recommended: false }} />);
    expect(screen.queryByText('RECOMMENDED')).toBeNull();
  });
});
```

### Step 4.2 — GREEN
```tsx
// apps/code/src/components/ModelRow.tsx
import { colors, spacing, fontFamily } from '../theme/tokens';
import type { CompatibleModel } from '../services/providerService';

interface ModelRowProps {
  model: CompatibleModel;
}

export function ModelRow({ model }: ModelRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${colors.border}`, fontFamily }}>
      <span style={{ color: colors.fg, fontSize: '13px', fontWeight: 600, flex: 1, minWidth: 0 }}>
        {model.name}
      </span>
      {model.category && (
        <span style={{ color: colors.muted, fontSize: '11px', minWidth: '60px' }}>{model.category}</span>
      )}
      {model.recommended && (
        <span style={{ color: colors.accent, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>RECOMMENDED</span>
      )}
    </div>
  );
}
```

---

## SPEC-5 — ModelsPage with all states

**Tag:** [code-app]
**File:** `apps/code/src/pages/ModelsPage.tsx` (new)
**Existing pattern:** `CatalogPage.tsx` — same loading/error/empty/populated pattern

### Step 5.1 — RED
```tsx
// apps/code/src/pages/__tests__/ModelsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelsPage } from '../ModelsPage';

vi.mock('../../hooks/useProviderData', () => ({
  useProviderData: vi.fn(),
}));

import { useProviderData } from '../../hooks/useProviderData';

const defaultReturn = {
  health: null,
  models: null,
  activeProvider: null,
  stats: null,
  isLoading: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useProviderData).mockReturnValue(defaultReturn);
});

describe('ModelsPage', () => {
  it('shows loading state', () => {
    vi.mocked(useProviderData).mockReturnValue({ ...defaultReturn, isLoading: true });
    render(<ModelsPage />);
    expect(screen.getByText('Loading provider data...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useProviderData).mockReturnValue({ ...defaultReturn, error: 'Connection refused' });
    render(<ModelsPage />);
    expect(screen.getByText('Error: Connection refused')).toBeDefined();
  });

  it('shows health badge when data loaded', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      health: { status: 'healthy', activeModel: 'gpt-4', modelsLoaded: 1, device: 'cpu', cudaAvailable: false, cudaDeviceName: null },
    });
    render(<ModelsPage />);
    expect(screen.getByText('healthy')).toBeDefined();
  });

  it('shows models list when available', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      models: {
        hardware: null,
        summary: null,
        count: 1,
        models: [{
          modelId: 'gpt-4', name: 'GPT-4', description: null, category: 'chat', size: '175B',
          parametersB: 175, contextLength: 128000,
          vramFp16Gb: 0, vramInt8Gb: 0, vramInt4Gb: 0,
          capabilities: [], license: null, recommended: true,
          canRunFp16: true, canRunInt8: true, canRunInt4: true,
          recommendedPrecision: null, quantizationRequired: null,
          vramRequired: 0, isLocal: false, isAvailable: true,
          inputTokenPricePerMillion: null, outputTokenPricePerMillion: null,
        }],
      },
    });
    render(<ModelsPage />);
    expect(screen.getByText('GPT-4')).toBeDefined();
  });

  it('shows empty state when no models', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      models: { hardware: null, summary: null, count: 0, models: [] },
    });
    render(<ModelsPage />);
    expect(screen.getByText('No models available.')).toBeDefined();
  });

  it('shows stats when available', () => {
    vi.mocked(useProviderData).mockReturnValue({
      ...defaultReturn,
      stats: { totalRequests: 42, totalErrors: 1, errorRate: 0.02, promptTokens: 500, completionTokens: 300, totalTokens: 800, latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0, avgLatencyMs: 100, perModel: [] },
    });
    render(<ModelsPage />);
    expect(screen.getByText('42')).toBeDefined();
  });
});
```

### Step 5.2 — GREEN: ModelsPage.tsx that renders all states

---

## SPEC-6 — Navigation wiring

**Tag:** [code-app]
**Files:** `apps/code/src/App.tsx` (modify) + `apps/code/src/components/Header.tsx` (modify)
**Existing pattern:** Current App.tsx has `PageId = 'console' | 'spaces' | 'catalog'` and Header.tsx has `{ key: 4, label: 'Models', pageId: null }`

### Step 6.1 — RED
Update `Navigation.test.tsx` to add a test for Models tab:
```tsx
// Add mock for ModelsPage
vi.mock('../ModelsPage', () => ({
  ModelsPage: () => <div>ModelsPage</div>,
}));

it('navigates to ModelsPage when clicking Models tab', () => {
  render(<App />);
  fireEvent.click(screen.getByText('[4] Models'));
  expect(screen.getByText('ModelsPage')).toBeDefined();
});
```

### Step 6.2 — GREEN
In `App.tsx`: add `'models'` to PageId, import ModelsPage, add render branch.
In `Header.tsx`: change tab 4 pageId from `null` to `'models'`.

---

## Cross-cutting concerns

1. **No DI changes** — all frontend-only
2. **No backend changes** — endpoints already exist in ProviderController
3. **Navigation test update** — existing `Navigation.test.tsx` must mock ModelsPage and add test for tab 4
