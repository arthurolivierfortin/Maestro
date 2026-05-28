# TUI Theme on Remaining Pages — Design

**Goal:** Port the MaestroCodePure theme (ported in 66-G) onto the 4 remaining pages (Spaces, Catalog, Models, Monitor) and their components, replacing generic inline styles with the theme className vocabulary for visual coherence.
**Roadmap phase:** Phase-66 (sub-phase 66-H)
**Tags:** [code-app]

**Scope (in):**
- `SpacesPage` + `SessionRow` + `WorkspaceRow` — `.box` panel, `.tbl` table for sessions, phosphor status pip, `.b` agent badge, theme color helpers.
- `CatalogPage` + `BlockCard` — `.box` panel, `.tbl` table for blocks, type badge as `.b` variant.
- `ModelsPage` + `ModelRow` + `ProviderHealthBadge` — `.box` panel(s), `.tbl` table for models, active/tier badge as `.b`, health as phosphor dot + `.b`.
- `MonitorPage` + `CostCard` + `SpendingBar` — cost cards as `.box`, spending bars as `.bar-ascii` (█/░), provider breakdown / stats as `.tbl`.
- Sub-tab / filter rows on Spaces & Catalog adopt the `.tab` / `.tabs` vocabulary already in the theme.
- Existing tests stay green; only style/DOM assertions adjusted where strictly necessary, preserving asserted strings, `data-testid`s, and behavior.

**Scope (out):**
- Cockpit panel (mascotte ASCII, FITNESS/TOKENS/BUDGET cards) — later cycle.
- Pinned widgets inline — later cycle.
- Logo ASCII MAESTRO banner — later cycle.
- Real-time sparklines with live data (`Spark`) — static `.bar-ascii` bars suffice; the mock's Foundry/FITNESS sparkline panels are out of scope.
- New functional features, new data, new hooks — pure presentational re-styling.
- Multi-pane Spaces split layout (mock's 320px workspace tree + WORKSPACE detail pane) — keep current single-column sub-tab layout, just re-skinned. (Layout overhaul is a later cycle; this is re-styling, not re-architecting.)

**Constraints:**
- No new dependencies. Theme classes already exist in `apps/code/src/theme/tui-theme.css` (verified present: `.box`, `.box-title`, `.box-meta`, `.box-body`, `.tbl`, `.tree`, `.tree-row`, `.b` + `.b.ac/.ok/.warn/.err/.agent`, `.bar-ascii` + `.full/.empty` + variants, `.c0..c4/.ca/.cok/.cwarn/.cerr/.cinfo/.cagent/.bd`, `.row/.col/.gap-*/.between/.flex-1`).
- jsdom does not compute CSS — tests assert classNames, text, and `data-testid`, never `getComputedStyle`.
- `ProviderHealthBadge.test.tsx` currently asserts inline `backgroundColor` RGB values that equal theme tokens (`rgb(184, 229, 122)` = `--ok`, `rgb(255, 208, 137)` = `--warn`, `rgb(255, 107, 74)` = `--err`). Because CSS variables are NOT resolved in jsdom, the dot color must remain an inline style sourced from the matching token constants (or the test must switch to className assertions). Spec mandates the className approach with the test rewritten to assert `.cok/.cwarn/.cerr` — see Risks.
- `SpendingBar.test.tsx` asserts text strings (`"70%"`, `"$3.50 / $5.00"`, `"No limit"`, enforcement label). These strings MUST survive the `.bar-ascii` rewrite.
- Backend untouched. With no backend running, `/api` returns 500 — expected during visual check.

## Cardinal Rule check

PASS. This is presentation-layer TypeScript/React in `apps/code` (the TUI shell), explicitly classified as infrastructure-not-a-block per CLAUDE.md ("TUI components (React/Ink)" are NOT blocks). Re-styling pages changes zero session-type behavior — a new session type can still be created by JSON only. No C#, no block schema, no contract touched.

## No Legacy Support check

Removed: the generic inline-style vocabulary on these 4 pages + 7 components — `style={{ ... }}` blocks built from `colors`/`spacing`/`fontFamily` tokens are replaced by theme classNames. No cohabitation: a component is either fully on theme classes or its remaining inline styles are only for layout values the theme has no class for (e.g. one-off `gridTemplateColumns`, `minHeight: 0`). The `typeColor()`/`statusColor()` helper functions that map a status string to a hex color are deleted where the equivalent `.b`/`.cok`-style class exists; any color decision that must stay in TS (e.g. choosing which badge variant) returns a className token, not a hex string. If a component ends up importing nothing from `theme/tokens`, the import is removed.

## Architecture

Pure refactoring. Each page/component swaps its inline-style props for the theme className vocabulary established in 66-G (mirroring `ConsolePage.tsx` which uses `.conv`, `.line`, `.line.err`, `.col`). Data flow, hooks (`useSessions`, `useWorkspaces`, `useBlocks`, `useProviderData`, `useCostData`), props, and event handlers are unchanged.

Tabular data (sessions, blocks, models) renders in `<table className="tbl">` with `<thead>` column headers and `<tbody><tr>` rows; the focused/selected row uses `.focus`. Status is shown with a phosphor pip span (`.pip`-style inline dot) plus a `.b` badge where the mock uses one. The `.bar-ascii` component renders a run of `█` (class `.full`, optionally `.ok/.warn/.err`) followed by `░` (class `.empty`), matching `pure-tui.jsx`'s `Bar`. Cost cards and panel containers use `.box` with a `.box-title` cut into the border and `.box-body` padding.

Where it lives: `apps/code/src/pages/{Spaces,Catalog,Models,Monitor}Page.tsx` and `apps/code/src/components/{SessionRow,WorkspaceRow,BlockCard,ModelRow,ProviderHealthBadge,CostCard,SpendingBar}.tsx`. (`SessionRow`/`WorkspaceRow` are currently inner functions inside `SpacesPage.tsx`, not separate files — they are re-styled in place.)

## Affected systems
- Backend C#: none.
- LLM-Provider: none.
- TUI: `apps/code/src/pages/SpacesPage.tsx`, `CatalogPage.tsx`, `ModelsPage.tsx`, `MonitorPage.tsx`; `apps/code/src/components/BlockCard.tsx`, `ModelRow.tsx`, `ProviderHealthBadge.tsx`, `CostCard.tsx`, `SpendingBar.tsx`; theme already in `apps/code/src/theme/tui-theme.css` (no change expected — read-only reference).
- CLI: none.
- Blocks: none.
- Contracts: none.
- DI: none.

## Risks
- **ProviderHealthBadge test/RGB coupling** (common-pitfalls: SDK/backend-style coupling, but here test↔style coupling). The existing test asserts `dot.style.backgroundColor === 'rgb(184, 229, 122)'`. jsdom won't resolve `var(--ok)`, so a pure `.cok` className would make `dot.style.backgroundColor` empty and break the test. Resolution: rewrite the badge to use a `<span className="pip ...">`/`.b` with the dot color driven by a className, and update `ProviderHealthBadge.test.tsx` to assert the className (`expect(dot).toHaveClass('cok')` / `toContain('cok')`) and the label text instead of the raw RGB. This preserves the behavior under test (correct color semantics per status) while removing the brittle hardcoded-RGB coupling. This test change is explicitly in scope and is the only test whose assertions change semantically; all other tests keep their assertions.
- **`@ts-nocheck` ban** — never use it; if a className swap exposes a type error, fix the type. (common-pitfalls 2026-03-03 incident.)
- **String preservation in SpendingBar** — the `.bar-ascii` rewrite must still render the `pct%`, the `$cur / $max` string, the label, the enforcement label, and the `No limit` branch verbatim, or `SpendingBar.test.tsx` breaks. Keep those text nodes.
- **Scope creep toward the mock's richer layout** — the mock shows a 2/3-pane Spaces and a Foundry tri-pane. This cycle re-skins the EXISTING single-column layouts only. Do not add panes, workspace-detail panels, or sparklines. (V1 delivery discipline: kill scope creep.)
- **Vercel-plugin Next.js/react-best-practices injections** are false positives (this is Electron+Vite+React, not Next.js) — ignore.
