🎯 Feature : MAESTRO-4I – Breadcrumb Navigation & Route Synchronization

# 🎯 Purpose
This branch implements Phase 4I: a robust breadcrumb/navigation experience and synchronized routing for the Foundry/Canvas/Block edit flows. The changes introduce a stack-based navigation model, two-way route↔store synchronization with re-entrancy protection, and consistent navigation semantics between atomic and composite blocks (atomic blocks open in dedicated editors, non-atomic open in the canvas). Additionally, this PR fixes several UX/layout issues (notably Block Explorer collapse edge cases), integrates multiple editors, and improves test coverage for navigation and canvas shortcuts.

# 📋 Changes Summary
- Navigation & routing
  - Implemented a stack-based navigation store and APIs (`pushPage`, `pushBlock`, `popOne`, `popToIndex`, `initFromUrl`, `getBreadcrumbSegments`) to replace brittle path-based orchestration.
  - Added `useRouteSync` to keep the URL and navigation store in sync with a re-entrancy guard to prevent route/store loops.
  - Updated editors and pages (`BaseBlockEditor`, `ScriptEditor`, `BlockEditPage`, `BlockEditPage.test.tsx`) to prefer `popOne()` when cancelling instead of unconditional `navigate('/foundry')`, preserving breadcrumb state.

- Breadcrumb and block navigation
  - Reworked `Breadcrumb` to use the navigation stack and render consistent breadcrumbs.
  - Unified navigation semantics: atomic blocks open in dedicated editors; non-atomic blocks redirect to canvas routes.

- UI / Layout / Panels
  - Hardened `BlockExplorer` collapse detection using a ResizeObserver fallback and CSS changes to prevent child-enforced `min-width` from blocking panel collapse.
  - Adjusted `PropertiesPanel` and panel CSS so panels can collapse reliably without being forced open by child elements.
  - Multiple UI polish and style updates: ExecutionBar, BlockPalette, BlockCard, and general style tokens.

- Editors and block types
  - Added/updated editors and block types: ScriptEditor, InferenceEditor, Integration for Agent/Tool/Prompt/Decision/etc editors and styles.
  - Introduced `EditorWrapper` component to host editors in the Block edit page.

- Services, mocks, and utils
  - Improved mock services including a `mockExecutionService` for local execution simulation and debugging drag/drop behaviors.
  - Resolved duplicate exports and reorganized `services/index.ts` to avoid barrel collisions.

- Tests and examples
  - Added tests for navigation store, `useCanvasShortcuts`, `NodeContextMenu`, and improved BlockPalette/ Breadcrumb tests.
  - Added example workflows and Phase 4 documentation (Phase-4H/Phase-4I implementation notes).

# 🏗️ Technical Details
- Navigation model
  - The navigation store now maintains a `navStack` which is the single source of truth for breadcrumb and back/forward flows. Components call `pushBlock` or `pushPage` to navigate; cancellation and editor exit prefer `popOne()` to preserve history.
  - `useRouteSync` serializes the active `navStack` into URL paths and also initializes store state from initial URL on load. A re-entrancy `isSyncing` guard prevents infinite toggling between the router and the store.

- Route semantics
  - Routes remain compatible with existing routes (`/foundry`, `/canvas/:blockId`, `/foundry/:blockId/edit`) but navigation now relies on the store for preferred back semantics. Components avoid unconditional redirects that previously reset the stack.

- Panel collapse fix
  - `BlockExplorer` now sets `data-state` reliably by observing the element size and the panel's collapsed state. CSS changes (`width: 100%`, `min-width` only when expanded) prevent child components from blocking panel collapse.

- Editor integration
  - `EditorWrapper` abstracts mounting of specialized editors and handles save/cancel via the navigation store; dedicated atomic editors now return control to the nav stack on cancel.

- Tests & CI
  - Added/updated tests for navigation logic and canvas shortcuts. TypeScript checks pass in the frontend workspace (`npx tsc --noEmit`).

# 🧪 Testing
How to run locally:

```bash
cd frontend
npx tsc --noEmit          # TypeScript check
npm install               # if dependencies missing
npm run dev               # Run dev server and manually validate UX
npm test                  # Run unit tests (vitest)
```

Manual test scenarios to validate
- Open multiple blocks and navigate using breadcrumbs — ensure back/forward navigates the stack rather than resetting to Foundry.
- Open atomic block editor and press Cancel — app should `popOne()` back to previous breadcrumb instead of navigating to `/foundry`.
- Toggle Block Explorer repeatedly and drag the divider — panel should fully collapse/expand reliably and not be stuck in a semi-collapsed state.
- Open/close the Properties panel and ensure it does not force the Block Explorer to re-open.

# 📖 Documentation
- Added Phase 4H/4I implementation notes: `PHASE-4H-IMPLEMENTATION-SUMMARY.md`, `docs/issues/phase-4i-breadcrumb-navigation.md` and related docs.
- Updated `ROADMAP.md` with progress notes.

# 🚀 Deployment Notes
- No API or backend changes — frontend-only changes. No DB migrations.
- Ensure frontend build passes in CI; `npx tsc --noEmit` should be included in CI steps for this branch.

# 🔄 Migration Guide
- Not applicable. Changes are backwards-compatible at route level; navigation semantics are internal to the frontend store.

# 📸 Screenshots/Examples
- None included; visual changes are in the Foundry UI (breadcrumbs, panel collapse behavior, editors). Reviewer should run the dev server to inspect UX.

# 🔗 Related Issues
- MAESTRO-4I (breadcrumb navigation & route synchronization)
- MAESTRO-4H (related editor and palette work)

# 👥 Review Notes
- Key areas to review:
  - `frontend/src/store/navigationStore.ts` — new stack-based navigation API and edge cases around init/pop.
  - `frontend/src/hooks/useRouteSync.ts` — re-entrancy guard and URL↔store initialization.
  - `frontend/src/components/BlockExplorer/*` — Collapse logic and CSS changes.
  - `frontend/src/components/BlockEditors/*` and `EditorWrapper.tsx` — ensure editors preserve navigation semantics and correctly call `popOne()` on cancel.
  - Test files under `frontend/src/hooks` and `frontend/src/store` — navigation tests and canvas shortcuts.

- Risks and mitigations:
  - Risk: Some components may still call `navigate('/foundry')` directly and inadvertently reset stack. Mitigation: search/replace calls and prefer nav-store APIs.
  - Risk: Edge cases where URL initialization could produce unexpected stack shapes. Mitigation: `useRouteSync` guards and unit tests validate common flows.

# Checklist for merge
- [ ] CI TypeScript check passes (`npx tsc --noEmit`)
- [ ] Unit tests pass (`npm test`)
- [ ] Manual UX verification steps completed by reviewer
- [ ] Optional: run cross-browser smoke tests for panel resizing
