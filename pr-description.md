🎯 Feature : MAESTRO-4D – Implement Visual Block Canvas with React Flow


# 🎯 Purpose

This PR implements the Phase 4d Visual Block Canvas using React Flow and delivers the foundational UI components for visual block editing in the IDE. It adds a fully-typed React Flow integration, custom node and edge renderers, a block palette, canvas-store synchronization hook, and supporting styles and tests. It also includes UX fixes (block background, panel integration) required for a solid, non-transparent block appearance and correct panel behaviors.

# 📋 Changes Summary

This branch introduces the Canvas Foundation and related frontend components, plus supporting changes to layout and styles. Key additions and modifications:

- New Canvas and Node components:
  - [frontend/src/components/BlockCanvas/BlockCanvas.tsx](frontend/src/components/BlockCanvas/BlockCanvas.tsx)
  - [frontend/src/components/BlockCanvas/BlockCanvas.scss](frontend/src/components/BlockCanvas/BlockCanvas.scss)
  - [frontend/src/components/BlockCanvas/useCanvasSync.ts](frontend/src/components/BlockCanvas/useCanvasSync.ts)
  - [frontend/src/components/BlockCanvas/BlockCanvas.test.tsx](frontend/src/components/BlockCanvas/BlockCanvas.test.tsx)

- New Block node types and styles:
  - [frontend/src/components/BlockNodes/BaseBlockNode.tsx](frontend/src/components/BlockNodes/BaseBlockNode.tsx)
  - [frontend/src/components/BlockNodes/BaseBlockNode.scss](frontend/src/components/BlockNodes/BaseBlockNode.scss)
  - [frontend/src/components/BlockNodes/index.ts](frontend/src/components/BlockNodes/index.ts)

- Block Palette:
  - [frontend/src/components/BlockPalette/BlockPalette.tsx](frontend/src/components/BlockPalette/BlockPalette.tsx)
  - [frontend/src/components/BlockPalette/BlockPalette.scss](frontend/src/components/BlockPalette/BlockPalette.scss)
  - [frontend/src/components/BlockPalette/BlockPalette.test.tsx](frontend/src/components/BlockPalette/BlockPalette.test.tsx)

- Connection Edge renderer:
  - [frontend/src/components/ConnectionEdge/ConnectionEdge.tsx](frontend/src/components/ConnectionEdge/ConnectionEdge.tsx)
  - [frontend/src/components/ConnectionEdge/ConnectionEdge.scss](frontend/src/components/ConnectionEdge/ConnectionEdge.scss)

- Panel and layout support (integrations & styles):
  - [frontend/src/components/panels/PanelLayout.tsx](frontend/src/components/panels/PanelLayout.tsx)
  - [frontend/src/components/panels/BottomPanel.tsx](frontend/src/components/panels/BottomPanel.tsx)
  - [frontend/src/components/panels/PropertiesPanel.tsx](frontend/src/components/panels/PropertiesPanel.tsx)
  - Styles updated under `frontend/src/components/panels/*.scss`

- Hooks and utilities:
  - [frontend/src/hooks/useKeyboardShortcuts.ts](frontend/src/hooks/useKeyboardShortcuts.ts)

- Pages and routing updates to include Canvas/Editor:
  - [frontend/src/pages/CanvasPage.tsx](frontend/src/pages/CanvasPage.tsx)
  - [frontend/src/pages/WorkflowEditorPage.tsx](frontend/src/pages/WorkflowEditorPage.tsx) (modified)
  - [frontend/src/pages/BlockDemoPage.tsx](frontend/src/pages/BlockDemoPage.tsx) (modified)
  - [frontend/src/router.tsx](frontend/src/router.tsx) (modified)

- Store and types updates:
  - [frontend/src/store/blockStore.ts](frontend/src/store/blockStore.ts) (modified)
  - [frontend/src/store/themeStore.ts](frontend/src/store/themeStore.ts) (modified)
  - [frontend/src/types/block.types.ts](frontend/src/types/block.types.ts) (modified)

- Dependency updates:
  - [frontend/package.json](frontend/package.json) (added `reactflow` dependency)
  - [frontend/package-lock.json](frontend/package-lock.json)

# 🏗️ Technical Details

Overview:
- Integrates `reactflow` (v11.x) to provide the canvas rendering, zoom/pan controls, minimap and node/edge lifecycle.
- Registers `nodeTypes` and `edgeTypes` for custom rendering: `BaseBlockNode` and `ConnectionEdge`.
- `useCanvasSync` hook synchronizes React Flow nodes/edges with the `blockStore` (Zustand) and handles add/remove/position updates.

Notable implementation details:
- Default edge options and custom `ConnectionEdge` support connection labels, animated states and validation styling.
- Nodes are memoized (`useMemo`) to avoid unnecessary re-renders when the store updates.
- Keyboard shortcut integration (`useKeyboardShortcuts`) provides canvas and panel quick keys.
- The `BaseBlockNode` background was adjusted to `--surface` to ensure opaque blocks that do not visually blend with canvas background (fixes the transparency issue).

Files to review for architecture concerns:
- [frontend/src/components/BlockCanvas/useCanvasSync.ts](frontend/src/components/BlockCanvas/useCanvasSync.ts) — store synchronization and event handlers.
- [frontend/src/components/BlockNodes/BaseBlockNode.tsx](frontend/src/components/BlockNodes/BaseBlockNode.tsx) — node rendering, ports/handles and selection logic.
- [frontend/src/components/panels/PanelLayout.tsx](frontend/src/components/panels/PanelLayout.tsx) — make sure `collapsedSize` propagation is retained when adding new panels.

# 🧪 Testing

Run tests and type checks locally:

```bash
cd frontend
npm ci
npm run type-check
npm run test
npm run dev
```

Manual verification checklist (recommended):
- Open the app and navigate to the Canvas/Workflow Editor pages.
- Verify blocks render with a solid background (not transparent) and correct borders.
- Add a block from the palette and confirm it appears in the canvas and `blockStore`.
- Connect two blocks; verify `ConnectionEdge` renders and validation visuals appear on invalid/valid target.
- Resize and collapse panels; ensure properties toggle remains visible and chevron rotates as expected.
- Verify keyboard shortcuts for panel toggles and canvas selection.

# 📖 Documentation

Updated docs and guides (or TODOs added):
- `docs/issues/phase-4d-canvas-foundation.md` — acceptance criteria and architecture for the Canvas
- `frontend/README.md` and `ROADMAP.md` updated references to Phase 4d tasks

# 🚀 Deployment Notes

- New runtime dependency: `reactflow` (added to `frontend/package.json`). Ensure CI installs frontend dependencies.
- No backend migrations or environment variable changes.
- Recommended to run the frontend build in CI after dependency install to catch bundler/runtime issues: `npm ci && npm run build` in `frontend` folder.

# 🔄 Migration Guide

No data migrations required. Frontend-only feature with additive changes to the UI. If your deployment pipeline caches node modules, ensure cache invalidation when `reactflow` is added.

# 📸 Screenshots / Examples

Add screenshots in the PR as attachments showing:
- Canvas with several block nodes and connections
- Block palette drag-and-drop flow
- Collapsed properties panel with visible chevron

# 🔗 Related Issues

- Phase 4b: Block Architecture & Recursive Type System (dependency)
- Phase 4c: IDE Layout with Panels (dependency and integration)

# 👥 Review Notes

Areas reviewers should focus on:
- `useCanvasSync` correctness: event handlers, debouncing position updates and store mutations.
- Accessibility: node focus management, keyboard navigation, ARIA on canvas controls.
- Performance: memoization of node types and throttling store writes for many nodes.
- CSS: ensure `BaseBlockNode` background uses `--surface` so nodes remain visually distinct from canvas.

# ✅ Pre-merge Checklist

- [ ] All new tests pass (`npm run test`)
- [ ] Type-check passes (`npm run type-check`)
- [ ] CI successfully builds the frontend (`npm run build`)
- [ ] Visual verification of canvas interactions completed by reviewer
- [ ] Confirm `collapsedSize` behavior for panels still works with new canvas integration
- [ ] Update any integration tests that rely on layout or DOM shape


