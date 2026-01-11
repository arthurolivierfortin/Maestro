🎯 Feature : MAESTRO-4F – Frontend Foundry, Models panel, Mock Services & Phase 4G planning


# 🎯 Purpose
This pull request consolidates all work on the branch `copilot/frontend-refactor-foundry-page-again`. It contains the frontend Foundry UI, Models panel and model management UIs, mock service implementations, store enhancements and tests, and planning artifacts (Phase 4f/4g issue documents and a `ROADMAP.md` update). The branch is mock-first with the goal of enabling frontend work and a clear Phase 4G plan for the team.

This PR is primarily frontend and documentation: it adds new components, interfaces, mock backends and tests, and updates documentation to reflect the new Phase 4G workstream. No backend database migrations or production runtime changes are included.

# 📋 Summary of Changes
Files changed: 69 (8612 insertions, 74 deletions). Key additions and modifications:

- Documentation & Planning
  - Added `docs/issues/phase-4f-frontend-refactor-foundry.md` (Foundry spec)
  - Added `docs/issues/phase-4g-block-editing-crud.md` (Phase 4G spec + task breakdown)
  - Updated `ROADMAP.md` to include Phase 4G and reflect Phase 4f progress
  - Added `.github/prompts/complete-task.prompt.md` and new instruction files

- Foundry UI & Components
  - New Foundry pages & components:
    - `frontend/src/pages/FoundryPage.tsx` (+ `FoundryPage.scss`)
    - `frontend/src/components/Foundry/FoundrySidebar.tsx`, `FoundrySearchBar.tsx`, `BlockGrid.tsx`, `BlockCard.tsx` and corresponding styles
  - `BlockCard` click behavior navigates to `/foundry/:blockId/edit` for atomic blocks and `/canvas/:blockId` for composite

- Models Panel & Config
  - Added `ModelConfigForm`, `ModelSelector`, `ModelsPanel`, model presets and related styles
  - New configuration helper files: `frontend/src/config/*` and `maestro.config.json`

- Services (mock + real) & Interfaces
  - `frontend/src/services/interfaces/IModelService.ts` and `services/modelService.ts` factory
  - Mock service implementation: `frontend/src/services/mock/mockModelService.ts` and test utilities (latency, errors)
  - Real service stub: `frontend/src/services/real/realModelService.ts`

- State / Stores
  - `frontend/src/store/blockStore.ts` enhancements (query/filter/search interface)
  - New `frontend/src/store/modelStore.ts` with tests

- Tests
  - Added `frontend/src/services/mock/__tests__/mockModelService.test.ts`
  - Added `frontend/src/store/modelStore.test.ts`
  - Updated `frontend/src/store/blockStore.test.ts`

- Icons & Types
  - New `CapabilityIcons.tsx` and `ProviderIcons.tsx`
  - Minor updates to `frontend/src/types/block.types.ts`

# 🏗️ Technical Details & Rationale

- Mock-First Development
  - Mock services emulate realistic latency and error states so the UI can be developed and tested without the backend.
  - `modelService.ts` selects mock or real implementation using environment flags; this pattern is repeated for other services planned in Phase 4G.

- Foundry
  - Foundry is implemented as a page (grid + sidebar). New block UI components are built for reusability.
  - The design keeps composite blocks editable in the Canvas while atomic blocks have type-specific edit pages.

- Stores
  - `blockStore` additions support filtering and search needed by Foundry and the upcoming global command palette.

- Tests
  - The branch adds unit tests around mock services and stores to catch regressions early.

# 🧪 How To Test Locally
1. From repository root, run frontend tests:

```bash
cd frontend
pnpm install   # or npm install / yarn
pnpm test
```

2. To run the app locally (dev server):

```bash
cd frontend
pnpm install
pnpm dev
```

Notes:
- The frontend uses mock services by default (see `maestro.config.json` and `frontend/src/config`) so the UI should be functional without a backend.

# 📖 Documentation
New and updated docs:

- `docs/issues/phase-4f-frontend-refactor-foundry.md` — Foundry spec
- `docs/issues/phase-4g-block-editing-crud.md` — Phase 4G plan and task breakdown
- `ROADMAP.md` — added Phase 4G to overview and detailed section
- `.github/instructions/*` and `.github/prompts/*` — task completion prompts and instruction updates

# 🚀 Deployment Notes
- No backend migrations or environment changes are required.
- `maestro.config.json` is present to toggle mock/real services; ensure CI does not expose secrets in public configs.

# 🔗 Related Commits (most recent first)
- `e7e96fa` feat(roadmap): add Phase 4g for Block Editing, CRUD & UX improvements
- `a734c76` feat(nav): add Foundry link to TopBar navigation [4f.7]
- `7344079` docs: update ROADMAP to reflect Phase 4f progress [4f]
- `dc3ae04` feat(ui): create Foundry page with sidebar, search, and block grid [4f.2]
- `1abe32b` feat(store): enhance block store with query and filter methods [4f.3]

# 👥 Review Notes
Please focus on:

- UI/UX: Accessibility (keyboard navigation, ARIA attributes), styling consistency with existing components
- Services & Interfaces: completeness of `IModelService` and factory selection pattern (mock vs real)
- Tests: run local tests and examine failures; mock utilities should produce consistent simulated errors/latency
- Docs: accuracy of `ROADMAP.md` and Phase 4G issue; verify links

Recommended next steps after merge:

1. Create small, focused feature branches for each Phase 4G subtask (editors, wizard, service)
2. Implement `IBlockService` mock and wire editors incrementally
3. Add tests for each new editor and extend the command palette integration

---

## PR Checklist
- [ ] Run `pnpm test` (or `npm test`) and ensure tests pass
- [ ] Confirm `ROADMAP.md` links resolve in the repository
- [ ] Get at least one frontend reviewer for UI/UX and one for services/store
