# Models Page — Design

**Goal:** Allow users to view LLM provider health, available models, active model, and basic stats directly in the code app.
**Roadmap phase:** Phase-66 (sub-phase 66-D)
**Tags:** [code-app]
**Scope (in):**
- `providerService.ts` — 4 functions: `getHealth`, `getModels`, `getActiveProvider`, `getStats`
- `useProviderData` hook — fetch all 4 endpoints on mount + polling every 10s
- `ModelsPage.tsx` — health indicator, models list, active provider info, basic stats
- `ProviderHealthBadge` component — green/yellow/red status dot + label
- `ModelRow` component — model name, category, recommended badge, availability
- Navigation: add `'models'` to `PageId` union, wire tab 4 in Header + App.tsx

**Scope (out):**
- Model switching — YAGNI, separate cycle
- Local model detection (Ollama) — YAGNI
- Model download/setup UI — YAGNI
- Zustand store — YAGNI for V1
- Provider configuration UI — separate cycle
- Capabilities/SystemCapabilities page — YAGNI

**Constraints:**
- Follow existing pattern: `blockService.ts` / `useBlocks.ts` / `CatalogPage.tsx`
- Use `apiFetch` from `apiClient.ts` — no direct `fetch` calls
- TypeScript types must match backend DTOs in `LLMDtos.cs` exactly (camelCase)
- Polling interval 10s via `setInterval` + cleanup
- All states visible: loading, error, empty, populated

## Cardinal Rule check
This adds a UI page (`ModelsPage.tsx`) and data-fetching service (`providerService.ts`) in the code-app layer. No backend changes. No session-type assumptions. A new session type can still be created with JSON only. **OK.**

## No Legacy Support check
Header.tsx tab 4 (Models) currently has `pageId: null` (disabled). This changes to `pageId: 'models'`. No legacy code to remove — just enabling an existing placeholder. **Nothing to remove.**

## Architecture

The `providerService.ts` fetches 4 endpoints from the existing `ProviderController.cs`:
- `GET /api/provider/health` → `LLMProviderHealth`
- `GET /api/provider/models` → `CompatibleModelsResponse` (with `models: CompatibleModel[]`)
- `GET /api/provider/active` → `{ provider: string, gatewayType: string }`
- `GET /api/provider/stats` → `LLMProviderStats`

The `useProviderData` hook calls all 4 on mount and re-fetches every 10 seconds. It exposes `{ health, models, activeProvider, stats, isLoading, error }`.

`ModelsPage.tsx` displays:
1. Top bar: `ProviderHealthBadge` (health status) + active provider info + basic stats (total requests, tokens)
2. Models list: `ModelRow` per model showing name, category, size, recommended badge, availability status

All TypeScript interfaces match the C# DTOs in `LLMDtos.cs` field-for-field (camelCase serialization).

## Affected systems
- Backend C#: **none** — all endpoints already exist
- LLM-Provider: **none**
- TUI: **none** — this is apps/code (React desktop), not packages/maestro-code (Ink TUI)
- CLI: **none**
- Blocks: **none**
- Contracts: **none**
- DI: **none**

Only `apps/code/src/` is touched:
- `services/providerService.ts` (new)
- `hooks/useProviderData.ts` (new)
- `pages/ModelsPage.tsx` (new)
- `components/ProviderHealthBadge.tsx` (new)
- `components/ModelRow.tsx` (new)
- `App.tsx` (modify — add 'models' to PageId, import + render ModelsPage)
- `components/Header.tsx` (modify — change tab 4 pageId from null to 'models')

## Risks
- **SDK/backend type mismatch** (common-pitfalls.md): Must verify response shapes match DTOs. Researcher must curl actual endpoints or read C# DTOs carefully. ProviderController returns anonymous object for `/active` endpoint — type it explicitly.
- **Polling memory leak**: `setInterval` without cleanup causes leaks. Must `clearInterval` in useEffect cleanup.
- **No `@ts-nocheck`**: Forbidden per incident 2026-03-03.
