# Catalog Page -- Design

**Goal:** Add a Catalog page to maestro-code that displays all blocks from the backend with type filtering and text search, making "everything is a block" visible to the user.
**Roadmap phase:** Phase-66 (sub-phase 66-C)
**Tags:** [code-app]
**Scope (in):**
- `blockService.ts` -- service calling `GET /api/blocks` with optional `type` and `search` query params
- `useBlocks` hook -- manages blocks array, loading/error state, active type filter, search query
- `BlockCard` component -- renders one block: name, type badge, truncated description
- `CatalogPage` -- assembles type filter buttons + search input + block grid
- Navigation tab 3 wired to `catalog` page in `Header.tsx` and `App.tsx`

**Scope (out):**
- Block detail panel on click -- separate cycle
- Block creation/editing -- separate cycle
- Contract/fitness widgets -- Phase 67
- Block execution from catalog -- not applicable
- Polling/auto-refresh -- one-shot fetch is sufficient for catalog

**Constraints:**
- API shape is fixed: `GET /api/blocks?type=X&search=Y` returns `BlockDto[]`
- BlockDto fields used: `id`, `name`, `blockType`, `description`
- Follow the exact same patterns as SpacesPage/sessionService/useSessions for consistency
- Use theme tokens (colors, spacing, fontFamily) -- no hardcoded styles
- No `@ts-nocheck`, no `any` types

## Cardinal Rule check
This change adds a page to the code-app TUI. It does NOT modify backend infrastructure, session creation, or block execution. A new session type can still be created by JSON only. Cardinal Rule respected.

## No Legacy Support check
The Header.tsx currently has tab 3 as "Foundry" with `pageId: null` (disabled). This tab will be replaced with "Catalog" pointing to the new page. The old disabled entry is removed -- clean break, no backward compatibility.

## Architecture

`CatalogPage.tsx` is a React component living in `apps/code/src/pages/`. It uses `useBlocks()` hook which calls `blockService.getBlocks(params)`. The service calls `apiFetch('/api/blocks?type=X&search=Y')` and returns typed `BlockDto[]`.

Data flow: CatalogPage -> useBlocks hook -> blockService -> apiFetch -> backend `/api/blocks`

Type filter is a row of buttons (All, Agents, Tools, Workflows, Prompts) that set the `type` query param. Search input sets the `search` query param. Both trigger a re-fetch.

`BlockCard.tsx` is a presentational component that receives a single block and renders it with the monospace TUI aesthetic matching SpacesPage's row style.

## Affected systems
- Backend C#: none (API already exists)
- LLM-Provider: none
- TUI: `apps/code/src/` -- new files: `services/blockService.ts`, `hooks/useBlocks.ts`, `pages/CatalogPage.tsx`, `components/BlockCard.tsx`; modified: `App.tsx`, `components/Header.tsx`
- CLI: none
- Blocks: none
- Contracts: none
- DI: none

## Risks
- **API response shape mismatch**: BlockDto has camelCase properties in JSON serialization (ASP.NET default). Must verify with actual API or match the existing pattern from sessionService/workspaceService.
- **Theme consistency**: Must use exact same `colors`, `spacing`, `fontFamily` tokens as SpacesPage.
- **Navigation test breakage**: Navigation.test.tsx checks for `[3] Foundry` text. Changing tab 3 to Catalog will break this test -- must update.
