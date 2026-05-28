# Checklist — TUI theme on remaining pages

**Linked spec:** [2026-05-28-theme-remaining-pages-design.md](2026-05-28-theme-remaining-pages-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (66-H)

## Code
- [x] [SPEC-1] [code-app] `SpacesPage` sub-tabs row → theme `.tabs`/`.tab` (active = `.active`); loading/error/empty states use `.box-body`/`.c2`/`.cerr` instead of inline `colors`/`spacing` — `apps/code/src/pages/SpacesPage.tsx`
- [x] [SPEC-2] [code-app] `SessionRow` (inner fn in SpacesPage) → `.tbl` row (`<tr>`): phosphor status pip span, name + id cells, `type|status|duration` meta in `.c2`/`.c3`, agent/type as `.b`, Start/Stop buttons keep handlers but styled with `.b`/`.ca`/`.cerr` classes (drop inline hex) — `apps/code/src/pages/SpacesPage.tsx`
- [x] [SPEC-3] [code-app] `WorkspaceRow` (inner fn in SpacesPage) → `.tbl` row or `.tree-row`: status pip, name in `.bd`, `type|status|N sessions` meta in theme color classes (drop inline `colors`/`spacing`) — `apps/code/src/pages/SpacesPage.tsx`
- [x] [SPEC-4] [code-app] Sessions list & workspaces list wrapped in `.box` (`SESSIONS` / `WORKSPACES` `.box-title`, `.box-meta` count) with `<table className="tbl"><thead>` headers; remove `statusColor()` hex helper, return phosphor pip class instead — `apps/code/src/pages/SpacesPage.tsx`
- [x] [SPEC-5] [code-app] `CatalogPage` filter row → `.tabs`/`.tab`; search input → `.cmdline textarea`-style themed input (`.box`/`.line` border, drop inline hex); loading/error/empty → theme color classes — `apps/code/src/pages/CatalogPage.tsx`
- [x] [SPEC-6] [code-app] `CatalogPage` block list wrapped in `.box` (`CATALOG`/`BLOCKS` title + count meta) with `<table className="tbl">` headers; rows rendered via re-styled `BlockCard` — `apps/code/src/pages/CatalogPage.tsx`
- [x] [SPEC-7] [code-app] `BlockCard` → `.tbl` `<tr>`: type badge as `.b` variant (drop `typeColor()` hex helper, map type→badge-variant class), name in `.bd .c0`, description in `.c3` truncated — `apps/code/src/components/BlockCard.tsx`
- [x] [SPEC-8] [code-app] `ModelsPage` status/stats bar wrapped in `.box` (`PROVIDER` title): health badge, active model in `.ca .bd`, loaded/device + request/token/latency stats in `.c2`/`.c1` (drop inline hex) — `apps/code/src/pages/ModelsPage.tsx`
- [x] [SPEC-9] [code-app] `ModelsPage` models list wrapped in `.box` (`MODELS · N` title + count meta) with `<table className="tbl"><thead>` headers; rows via re-styled `ModelRow` — `apps/code/src/pages/ModelsPage.tsx`
- [x] [SPEC-10] [code-app] `ModelRow` → `.tbl` `<tr>`: name in `.c0 .bd`, category in `.c2`, `recommended` as `.b.ac` badge (preserve "RECOMMENDED" text), drop inline `colors`/`spacing` — `apps/code/src/components/ModelRow.tsx`
- [x] [SPEC-11] [code-app] `ProviderHealthBadge` → phosphor dot via className (`.cok`/`.cwarn`/`.cerr` semantics) + `.b` label; preserve `data-testid="health-dot"` and status label text; drop inline hex/`statusColor()` — `apps/code/src/components/ProviderHealthBadge.tsx`
- [x] [SPEC-12] [code-app] `MonitorPage` cost cards row → grid of `.box` (CostCard); spending-limits and provider-breakdown section headers as `.box-title`/`.c2`; remove inline `colors`/`spacing` — `apps/code/src/pages/MonitorPage.tsx`
- [x] [SPEC-13] [code-app] `MonitorPage` provider breakdown rendered as `<table className="tbl">` (provider name `.c1`, cost `.ca`); preserve `$x.xx` formatting strings — `apps/code/src/pages/MonitorPage.tsx`
- [x] [SPEC-14] [code-app] `CostCard` → `.box` (`label` as `.box-title`, value in `.c0 .bd` large, subLabel in `.c2`); drop inline border/hex/spacing — `apps/code/src/components/CostCard.tsx`
- [x] [SPEC-15] [code-app] `SpendingBar` → `.bar-ascii` row: render `█`*full (`.full` + `.ok/.warn/.err` by pct threshold) and `░`*empty (`.empty`); preserve label, `$cur / $max` string, `pct%` string, enforcement label, and `No limit` branch verbatim — `apps/code/src/components/SpendingBar.tsx`

## Tests
- [x] [TEST-1] `SpacesPage` renders sub-tabs + switches to workspaces; asserts tab text + active state (className) — `apps/code/src/pages/__tests__/SpacesPage.test.tsx` (adjust existing)
- [x] [TEST-2] `SessionRow` renders name, status, Start/Stop buttons fire handlers; status pip present — `apps/code/src/pages/__tests__/SpacesPage.test.tsx` (preserve behavior assertions)
- [x] [TEST-3] `WorkspaceRow` renders name + `N sessions` meta — `apps/code/src/pages/__tests__/SpacesPage.test.tsx` (preserve)
- [x] [TEST-4] Sessions/workspaces lists render inside `.box` with `.tbl` (assert table presence or box-title text) — `apps/code/src/pages/__tests__/SpacesPage.test.tsx`
- [x] [TEST-5] `CatalogPage` renders filters, switches type filter, search input present — `apps/code/src/pages/__tests__/CatalogPage.test.tsx` (preserve)
- [x] [TEST-6] `CatalogPage` renders block list in `.box`/`.tbl` — `apps/code/src/pages/__tests__/CatalogPage.test.tsx`
- [x] [TEST-7] `BlockCard` renders type badge (`.b`), name, description — `apps/code/src/components/__tests__/BlockCard.test.tsx` (create if missing OR assert in CatalogPage test)
- [x] [TEST-8] `ModelsPage` renders provider box, stats, models list — `apps/code/src/pages/__tests__/ModelsPage.test.tsx` (preserve)
- [x] [TEST-9] `ModelRow` renders name, category, RECOMMENDED badge — `apps/code/src/components/__tests__/ModelRow.test.tsx` (adjust to className)
- [x] [TEST-10] `ProviderHealthBadge` asserts status label text + dot className per status (`.cok/.cwarn/.cerr`); keeps `data-testid="health-dot"` — `apps/code/src/components/__tests__/ProviderHealthBadge.test.tsx` (REWRITE RGB→className per spec Risks)
- [x] [TEST-11] `MonitorPage` renders cost cards + sections — `apps/code/src/pages/__tests__/MonitorPage.test.tsx` (preserve)
- [x] [TEST-12] `CostCard` renders label/value/subLabel inside `.box` — `apps/code/src/components/__tests__/CostCard.test.tsx` (adjust to className)
- [x] [TEST-13] `SpendingBar` keeps text assertions (`70%`, `$3.50 / $5.00`, `No limit`, enforcement) AND renders `.bar-ascii` with `█`/`░` — `apps/code/src/components/__tests__/SpendingBar.test.tsx` (extend, preserve existing)

## Database / Migrations
- [x] [DB-0] None

## Block / Contract changes
- [x] [BLOCK-0] None
- [x] [CONTRACT-0] None

## Verification gates (TESTING-PROTOCOL — applicable subset)
- [x] [GATE-1] Layer 1 Type Check : `cd apps/code && npx tsc --noEmit` (no backend C# touched)
- [x] [GATE-2] Layer 2 Unit Tests : `cd apps/code && npm test -- --run` — all green (baseline 154, may grow with new assertions)
- [ ] [GATE-3] Layer 4 Visual Check : `cd apps/code && npm run dev` (Vite), Playwright navigate tabs 2/3/4/5, screenshot each, compare to `mock/claude-design/pure-pages.jsx` (Spaces/Models/Monitor) — judge step
- [x] [GATE-4] No-Legacy / Cardinal Rule litmus : grep confirms no surviving generic inline-style cohabitation on the 9 touched files; no new C#/block/contract — judge Stage 1
- [x] [GATE-5] Provider verification : N/A (no workflow/agent touched)
