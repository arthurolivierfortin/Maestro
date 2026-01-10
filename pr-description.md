🏛️ Architecture : MAESTRO-4B – Add Block Architecture & update ROADMAP for Frontend Phase 4b

# 🎯 Purpose
This PR introduces the Phase 4b design and roadmap updates required to move the frontend from a flat `Node`/`Workflow` model to a recursive, composable `Block` architecture. The change is documentation and design-first: it defines the data model, registry, store expectations, navigation patterns, and UI contract so implementation can proceed in a well-scoped, parallelizable way.

These updates align the frontend with the product vision (n8n-style visual canvas, Claude-like integrated terminal, and VS Code-like IDE layout). They remove ambiguity about nesting rules, operation semantics (drill-in, duplicate, undo/redo), and type extension mechanisms.

# 📋 Changes Summary
- Modified: `ROADMAP.md` — split Phase 4 into 4a–4d, added UI/UX and Block Architecture vision, updated parallelization plan and dependencies.
- Added: `docs/issues/phase-4b-block-architecture.md` — comprehensive Phase 4b issue/spec including:
  - TypeScript-first block model (`Block`, `Port`, `Position`, `BlockMetadata`)
  - Type-specific configs (Agent, Task, Tool, Prompt, Decision, Validator, Trigger)
  - `BlockTypeRegistry` API and nesting rules
  - `useBlockStore` and `useNavigationContext` requirements (Zustand-based), undo/redo and persistence
  - Block Explorer, Breadcrumb, and Sidebar UX notes (fixing chevrons, SVG icons, drag/drop, context menu)
  - Acceptance criteria, files to create/modify, color/icon tokens, testing guidance and example JSON

No runtime code changes are included in this PR. This is spec/documentation work to enable implementation PRs.

# 🏗️ Technical Details
Motivation
- Current `Node` and `Workflow` types are insufficient for composing nested agents/tasks and for drill-down UX. Implementing these types later risks rework across canvas, store, and API contracts.

Design highlights
- Recursive `Block` model: each block may be atomic or composite and holds `children` and `parentId` to support drill-in navigation and reuse.
- Core block types (hardcoded for MVP): `workflow`, `agent`, `task`, `prompt`, `instruction`, `tool`, `decision`, `validator`, `trigger`. Extension via `BlockTypeRegistry`.
- `BlockTypeRegistry` provides metadata (`label`, `icon`, `color`, `allowedChildren`, `configSchema`, `defaultConfig`) and runtime helpers (`canContain`, `getDefaultBlock`, `validateConfig`).
- Store: recommend `Map<string, Block>` for O(1) lookups, Zustand for state management, undo/redo history (50 steps), and localStorage persistence for offline workflows.
- Navigation: `useNavigationContext` exposes `navigateInto`, `navigateUp`, `navigateTo`, URL sync and `getBlockPath` for breadcrumb generation.

Backward compatibility and migration
- Keep existing `node.types.ts` and `workflow.types.ts` during Phase 4b as compatibility shims. Migration plan to canonical `Block` shape will be executed during Phase 4c/4d when canvas and API contracts are finalized.

# 🧪 Testing
Unit tests (suggested):
- Type utilities & guards for `Block` and `BlockConfig` types
- `BlockTypeRegistry` (registration, `canContain`, `getDefaultBlock`, config validation)
- `useBlockStore` actions: add, remove, update, move, duplicate, undo/redo
- `useNavigationContext` actions and URL sync
- `BlockExplorer` rendering, keyboard navigation, and context menu

Integration tests (suggested):
- End-to-end: create workflow → add nested task → add agents/prompts → drill into agent → assert breadcrumb and store state
- Undo/redo flow verification
- LocalStorage persistence & hydration

Run frontend tests:
```bash
cd frontend
npm run test
```

# 📖 Documentation
- New file: `docs/issues/phase-4b-block-architecture.md` — implementation checklist and spec (use as source of truth for issue creation).
- Modified file: `ROADMAP.md` — updated phase breakdown and timeline.

# 🚀 Deployment Notes
- No deployments, configuration changes, or DB migrations are required. This PR only updates documentation and planning artifacts.

# 🔗 Related Items
- `docs/issues/phase-4b-block-architecture.md` (spec introduced in this PR)
- `ROADMAP.md` (updated in this PR)

# 👥 Review Notes
Please review with attention to:
- Completeness of the acceptance criteria in `docs/issues/phase-4b-block-architecture.md` — do the stores/hooks/UX items cover the needed developer surface?
- Nesting rules: are the allowed children per parent matching expected UX and security (e.g., preventing unsafe nesting)?
- File list and locations: suggest any reorganizations to match existing conventions.
- Colors/icons and accessibility notes — these can be iterated but check for obvious collisions.

# ✅ Checklist (for PR merge)
- [ ] Confirm documentation contents and acceptance criteria
- [ ] Create GitHub issues or tasks from the file list to kick off implementation
- [ ] Assign implementers for core artifacts: `block.types.ts`, `BlockTypeRegistry.ts`, `blockStore.ts`
- [ ] (Optional) Start PR(s) to implement initial type stubs and registry with unit tests

---

Would you like me to:
1. Convert the file list into discrete GitHub issues (I can create issue templates and TODOs), or
2. Start implementing the first code artifacts (`frontend/src/types/block.types.ts` and `frontend/src/registry/BlockTypeRegistry.ts`) with tests?

Pick one and I will proceed.
