🎨 Fix : MAESTRO-4G – UI/UX Fixes and Style Consistency for Foundry & Panels


# 🎯 Purpose
This PR applies a set of UI/UX fixes and style consistency improvements focused on the Foundry, Block Explorer, Breadcrumb, Properties Panel and Base block/node components. The changes address multiple frontend issues (search icon spacing, favorite icon position, panel collapse behavior, breadcrumb navigation, node action buttons, styling inconsistencies) and add small interaction improvements such as back/forward breadcrumb controls and a collapse/expand toggle for the Block Explorer.

# 📋 Changes Summary
- Frontend fixes (multiple components) – see `frontend/src/components/*` and `frontend/src/layouts/*` files
  - Fix breadcrumb navigation UI and add Back/Forward buttons (Breadcrumb component and styles)
  - Add collapse/expand toggle and independent collapsed state handling to Block Explorer (BlockExplorer component + styles)
  - Restore and standardize Block Card actions (favorite positioning, actions menu, status badges)
  - Make Base block node menu buttons clickable and restore proper event handling for node actions
  - Update Foundry search bar spacing and select/dropdown styles
  - Complete styling fixes for mode buttons, radio labels, and select dropdowns in Properties and Editor components
- Documentation
  - Add Phase 4G UI/UX fixes plan under `docs/issues/phase-4g-ui-ux-fixes-plan.md` describing 11 prioritized issues and a reversion checklist

# 🏗️ Technical Details
- Components touched (frontend):
  - Breadcrumb: `frontend/src/components/Breadcrumb/Breadcrumb.tsx`, `Breadcrumb.scss` — adds back/forward buttons, keyboard accessibility handlers, and more robust home/root behavior.
  - BlockExplorer: `frontend/src/components/BlockExplorer/BlockExplorer.tsx`, `BlockExplorer.scss` — adds a collapse/expand toggle, syncs collapsed state with an optional `panelRef`, and uses a fixed minimal width when collapsed to prevent layout shifts.
  - BlockCard: `frontend/src/components/Foundry/BlockCard.tsx`, `BlockCard.scss` — fixes actions bar, favorite button behavior and uses Lucide icons (no emojis), ensures action menu positioning and hover/focus states are consistent.
  - BaseBlockNode: `frontend/src/components/BlockNodes/BaseBlockNode.tsx` — restores menu click handlers with proper event stopping and double-click drill-down behavior; preserves handles and status indicators.
  - Foundry Search & Editor styles: `FoundrySearchBar.scss`, `BaseBlockEditor.scss` adjustments for consistent spacing and theme colors.

- Behaviour & Accessibility:
  - Breadcrumb segments are keyboard-accessible (`Enter`/`Space`) and include `aria-current` where appropriate.
  - Nav controls include tooltips/labels and disabled states for back/forward actions.
  - Collapse state for `BlockExplorer` uses CSS minimal widths (`min-width: 40px`) so closing a panel no longer forces other panels to resize.

- No backend, API, or domain/application layer changes were made. All changes are isolated to the frontend.

# 🧪 Testing
- Automated tests: No new unit tests were added in this PR. Recommended follow-ups:
  - Add component tests for `Breadcrumb` (keyboard navigation, back/forward enabled states)
  - Add interaction tests for `BlockExplorer` collapse/expand behavior

- Manual testing checklist (run locally):
  1. Start dev server:
     ```powershell
     cd frontend
     npm run dev
     ```
  2. Verify Breadcrumb:
     - Back/Forward buttons enabled/disabled correctly
     - Clicking segments navigates to the expected block/home
     - Keyboard activation with `Enter`/`Space` works
  3. Verify Block Explorer:
     - Click collapse toggle, explorer collapses to fixed small width and does not hide other panels
     - Expand back and ensure content returns
     - Right-click block items to show context menu (rename/duplicate/delete)
  4. Verify Foundry Block Cards:
     - Favorite star is positioned to the right and toggles without navigating
     - More actions menu opens and actions (Edit, Duplicate, Delete) function
  5. Verify Node Actions on Canvas:
     - The three node action buttons log/trigger expected behavior; no unresponsive buttons
  6. UI polish checks:
     - Search icon spacing, select dropdown colors, mode button icons look consistent with theme

# 📖 Documentation
- Added: `docs/issues/phase-4g-ui-ux-fixes-plan.md` — detailed checklist and reversion guidance for Phase 4G fixes.

# 🚀 Deployment Notes
- Frontend-only changes. No environment, build or deployment configuration changes required.
- Recommend running `npm run build` in `frontend` and verifying CI static checks (linting, type checking) succeed before merge.

# 🔄 Migration Guide
- Not applicable — no data or API changes.

# 📸 Screenshots/Examples
- Visual diffs are available in the branch for reviewers to inspect; run the dev server to review changes locally.

# 🔗 Related Issues
- See `docs/issues/phase-4g-ui-ux-fixes-plan.md` for the set of tickets/issues tracked under Phase 4G. Commits include multiple `fix(ui):` messages addressing listed issues.

# 👥 Review Notes
- Focus review on these high-risk areas:
  - Panel collapse behavior (Issue 7) — ensure closing Block Explorer does NOT affect Properties Panel layout
  - Node action buttons (Issue 8) — ensure click handlers are not swallowed by parent canvas handlers
  - Style regressions — verify no unintended global style changes were introduced (follow the Style Reversion Checklist in docs)

- Suggested review steps:
  1. Run the frontend dev server locally and exercise the manual testing checklist
  2. Compare CSS changes against `main` for unintended modifications (see reversion checklist)
  3. Run lint/type checks: `cd frontend && npm ci && npm run lint && npm run type-check` (if available)

- Merge checklist:
  - [ ] Manual UI verification complete
  - [ ] Linting and type checks pass
  - [ ] No unintended style regressions found in Foundry components


