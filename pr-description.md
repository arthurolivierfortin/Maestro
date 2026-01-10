🔧 Fix : MAESTRO-XXX – Keep Properties panel toggle visible when collapsed and fix collapse behavior

# 🎯 Purpose
This PR fixes the Properties panel collapse behavior in the frontend IDE: previously the panel could collapse to zero/hidden width making the toggle chevron unreachable. The change ensures the panel physically collapses to a small visible sliver (so the toggle remains accessible), keeps the header/chevron visible, and uses the Panel API correctly to collapse/expand.

# 📋 Changes Summary
- **Fix**: Ensure the properties panel leaves the toggle reachable when collapsed (does not fully disappear).
- **Refactor (small)**: Move collapse control to use the `react-resizable-panels` imperative API and ensure collapsed width flows from layout props.
- **Files changed**:
  - **Properties UI**: [frontend/src/components/panels/PropertiesPanel.tsx](frontend/src/components/panels/PropertiesPanel.tsx)
  - **Properties styles**: [frontend/src/components/panels/PropertiesPanel.scss](frontend/src/components/panels/PropertiesPanel.scss)
  - **Panel wrapper**: [frontend/src/components/panels/PanelLayout.tsx](frontend/src/components/panels/PanelLayout.tsx)
  - **IDE layout**: [frontend/src/layouts/IDELayout.tsx](frontend/src/layouts/IDELayout.tsx)

# 🏗️ Technical Details
- Problem: The panel width is controlled by `PanelItem` (react-resizable-panels). Earlier attempts to hide content purely with CSS or by removing DOM nodes caused the header/toggle to disappear when the parent panel collapsed to 0 width.
- Solution summary:
  - Use the panel's imperative handle (`ImperativePanelHandle`) to call `collapse()` / `expand()` so the panel shrinks/expands properly.
  - Add and pass a `collapsedSize` prop through `PanelLayout` → `PanelItem` → underlying `Panel` so collapsed panels have a small non-zero width by default (`collapsedSize={5}` in IDE layout for Properties panel).
  - Keep the header and toggle rendered inside the panel; hide only the content region via `data-state` + CSS. This ensures the header stays visible even when content is hidden.
  - Removed the ad-hoc floating toggle overlay approach in favor of the `collapsedSize` solution to avoid clipping and z-index edge cases.

# 🧪 Testing
- Type-check and run frontend locally:
```bash
cd frontend
npm run type-check   # tsc --noEmit
npm run dev          # start Vite dev server
```
- Manual test steps in browser:
  1. Open IDE layout and focus the workspace.
 2. Click the Properties panel chevron to collapse it — the panel should shrink to a narrow sliver (about 5% width) and the chevron remains visible.
 3. Click the chevron again to expand; the panel should fully expand to its previous width.
 4. Verify content is hidden/shown correctly and no layout flicker occurs.

# 📖 Documentation
- No user-facing docs required beyond this PR note. Internally, the `PanelLayout` now supports `collapsedSize` (preferred collapsed width) — mention in relevant layout docs if present.

# 🚀 Deployment Notes
- Frontend-only change; no backend or migration required.

# 🔗 Related Files (for reviewers)
- Properties panel component: [frontend/src/components/panels/PropertiesPanel.tsx](frontend/src/components/panels/PropertiesPanel.tsx)
- Panel layout wrapper and pass-through props: [frontend/src/components/panels/PanelLayout.tsx](frontend/src/components/panels/PanelLayout.tsx)
- IDE wiring (where `collapsedSize` is set): [frontend/src/layouts/IDELayout.tsx](frontend/src/layouts/IDELayout.tsx)
- Styles: [frontend/src/components/panels/PropertiesPanel.scss](frontend/src/components/panels/PropertiesPanel.scss)

# 👥 Review Notes
- Focus on the following during review:
  - **Correctness**: Clicking the chevron collapses/expands via panel API; the chevron remains visible when collapsed.
  - **Behavior**: No overlapping overlays or off-by-one layout flicker on collapse/expand.
  - **Accessibility**: `aria-expanded` is set on the toggle button and updates when panel state changes.
  - **API**: `PanelLayout`/`PanelItem` pass `collapsedSize` through to the underlying `Panel` without breaking existing props.

# ✅ Checklist
- [ ] Type-check passes (`npm run type-check`).
- [ ] Manual collapse/expand tested in browser.
- [ ] Review `PanelLayout` changes for regressions.

---

If you want, I can also open a draft PR with this description, or update an existing PR body with this content. Which would you prefer?
🧱 Feature : MAESTRO-4B – Implement Block Architecture & Recursive Type System

# 🎯 Purpose
This PR implements Phase 4b: the Block Architecture and recursive type system that form the foundation of the visual workflow editor. It defines typed block interfaces, the BlockType registry, the hierarchical block store (Zustand), navigation/drill-down primitives, and the Block Explorer + Breadcrumb UI that lets users inspect and navigate nested workflows.

This change is architectural (core frontend data model and navigation) and is required before the Canvas (Phase 4d) and IDE panel work (Phase 4c) can safely render and edit block graphs.

# 📋 Changes Summary
Major additions and modifications grouped by area:

- Types & Registry
  - Add `Block` model interfaces and related types (ports, position, metadata) in `frontend/src/types/block.types.ts` and `block-config.types.ts`.
  - Implement `BlockTypeRegistry` singleton with metadata, default configs, allowed-children rules, and schema for form generation in `frontend/src/registry/BlockTypeRegistry.ts` and `blockTypeDefinitions.ts`.

- Store & Navigation
  - New `useBlockStore` (Zustand) providing Map-backed storage, efficient lookups, undo/redo history, persistence to `localStorage`, and operations: `addBlock`, `removeBlock`, `updateBlock`, `moveBlock`, `duplicateBlock`, and connection helpers. (file: `frontend/src/store/blockStore.ts`)
  - New `useNavigationStore` / `useNavigation` hook to track drill-down `currentPath`, `selectedBlockId`, and expose `navigateInto`, `navigateUp`, `navigateTo`, and `navigateToRoot`. (file: `frontend/src/store/navigationStore.ts`, `frontend/src/hooks/useNavigation.ts`)

- Explorer & Breadcrumb UI
  - `BlockExplorer` sidebar component: recursive tree, expand/collapse, drag-and-drop placeholders, context menu for rename/duplicate/delete; highlights current path. (`frontend/src/components/BlockExplorer/BlockExplorer.tsx`)
  - `Breadcrumb` component: clickable segments with block icons and keyboard accessibility. (`frontend/src/components/Breadcrumb/Breadcrumb.tsx`)

- Hooks & Actions
  - `useBlockActions` helper for common CRUD flows used by UI components. (`frontend/src/hooks/useBlockActions.ts`)

- Minor fixes & polishing
  - Update `IDELayout` to show breadcrumb and outlet correctly; improve TopBar navigation integration
  - Remove unused imports and fix TypeScript linting issues in demo pages

# 🏗️ Technical Details

Key design choices
- Block model: `Map<string, Block>` for O(1) access and efficient tree operations. Blocks keep `parentId` and `children` references for traversal.
- BlockTypeRegistry: central metadata source for icons, colors, allowed nesting and default config. This keeps type rules in one place and simplifies validation and form generation.
- Navigation decoupled from router: navigation state tracks the current block path (drill-down) while React Router continues to manage top-level routes. Breadcrumb and explorer drive `useNavigationStore` actions.
- Undo/Redo: action history (capped at 50) implemented at store-level to roll back block state changes.

Representative interfaces (excerpt):

```ts
interface Block {
  id: string;
  name: string;
  blockType: BlockType;
  isAtomic: boolean;
  parentId?: string | null;
  children?: string[]; // store child ids for Map-based store
  config: BlockConfig;
  inputs?: Port[];
  outputs?: Port[];
  position?: { x: number; y: number };
  metadata: { createdAt: string; updatedAt: string; createdBy?: string };
}

interface BlockTypeInfo { /* label, icon, color, isAtomic, allowedChildren, configSchema, defaultConfig */ }
```

Performance considerations
- Memoized selectors for `getBlockPath`, `getBlockChildren` to avoid expensive recomputation.
- Debounced persistence to `localStorage` to avoid blocking UI on rapid changes.

Backward compatibility
- Existing flat `Node`/`Workflow` types are preserved during migration and marked for deprecation later; the block store exposes migration utilities to import simple workflows into the new recursive format.

# 🧪 Testing

Unit & integration focus
- Unit tests for `BlockTypeRegistry` (allowedChildren rules, defaultConfig), block store actions (add/remove/move/duplicate), navigation store operations, and UI components (`BlockExplorer`, `Breadcrumb`).

How to run frontend checks locally:

```bash
cd frontend
npm install
npm run lint        # ESLint
npm run test        # Vitest unit tests
npm run build       # type-check + build
npm run dev         # run dev server and verify UI
```

Suggested test cases
- Add a `workflow` root, add nested `task` → `agent` → `prompt`, verify `getBlockPath` returns correct ancestors.
- Move a block from one task to another, ensure `parentId` updates and positions persist.
- Duplicate a composite block: confirm deep clone with new IDs for all descendants.
- Breadcrumb click should set navigation path to that level and update `selectedBlockId`.

# 📖 Documentation

- Add/update docs:
  - `docs/issues/phase-4b-block-architecture.md` (this PR) — architecture, acceptance criteria and design tokens
  - `frontend/src/types/README.md` — brief on new block types
  - Update `docs/frontend-guide.md` to reflect block store API and registry guidelines

# 🚀 Deployment Notes

- No backend migrations required for this PR. All changes are frontend-only and persisted to `localStorage` for now.
- If a backend import/export is added later, the Block JSON schema path will be `schemas/workflow-schema.json` (update planned in later phases).

# 🔄 Migration Guide

If your workspace uses previous flat `workflow`/`node` structures, run the migration helper (provided in `frontend/src/store/blockStore.ts`) to convert existing workflows to the new recursive `Block` format. The helper:

- Preserves IDs where possible
- Generates parent-child relations
- Emits a summary report for missing/invalid fields

Usage (dev console):

```js
import { migrateLegacyWorkflow } from '@/store/blockStore';
const result = migrateLegacyWorkflow(legacyWorkflowJson);
console.log(result); // warnings / summary
```

# 📸 Screenshots / Examples

Example block JSON (root excerpt included in docs/issue):

```json
{
  "id": "workflow-1",
  "name": "Feature Development Pipeline",
  "blockType": "workflow",
  "isAtomic": false,
  "children": ["trigger-1","task-1"],
  "position": {"x":0,"y":0}
}
```

# 🔗 Related Issues
- `docs/issues/phase-4b-block-architecture.md` (this change)
- `docs/issues/phase-4c-ide-layout-panel-system.md` (IDE layout follows)
- `docs/issues/phase-4d-canvas-foundation.md` (Canvas will consume block store)

# 👥 Review Notes

Focus review on these areas:
- `frontend/src/registry/BlockTypeRegistry.ts` — confirm nesting rules and default configs
- `frontend/src/store/blockStore.ts` — ensure mutations are immutable-safe and undo/redo logic is correct
- `frontend/src/store/navigationStore.ts` and `frontend/src/hooks/useNavigation.ts` — UX for drill-down (edge cases: deep nesting, non-existent ids)
- `BlockExplorer` & `Breadcrumb` accessibility and keyboard interaction

Potential risks
- Large trees could impact performance — memoization and virtualization planned but verify on >100 nodes.
- Migration edge cases from legacy formats — validate with sample workflows before wide adoption.

# ✅ Checklist (PR merge)
- [ ] `Block` types and registry implemented and documented
- [ ] `useBlockStore` with core actions and persistence added
- [ ] Navigation hook implemented and wired to `Breadcrumb` and `BlockExplorer`
- [ ] Unit tests for registry and store pass locally (`npm run test`)
- [ ] Demo: create a sample workflow via `BlockDemoPage` and verify drill-down navigation
- [ ] Docs updated: `docs/issues/phase-4b-block-architecture.md` and `docs/frontend-guide.md`

---

If you want, I can now:

- Generate a PR body file in the repo (already replaced `pr-description.md`) ready to paste into GitHub
- Create a short checklist PR template comment to paste in the PR description
- Generate example unit tests stubs for key store operations

Tell me which of the above you prefer as next steps.



