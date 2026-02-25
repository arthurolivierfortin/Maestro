# Phase 41-PRE Checkpoint

## Sub-Phase A: Foundation — COMPLETE

### What was done

1. **Extracted 10 data panel components from `@maestro/monitor` to `@maestro/tui`**
   - WorkflowTree, ExecutionLog, LLMActivity, MetricsPanel, Variables, Filesystem, Artifacts, CommandLog, WidgetsPanel, PhaseWorkflow
   - All components updated to use direct relative imports (`../theme/index.ts`, `../utils/index.ts`) instead of the monitor's `../theme.ts`
   - Updated `packages/tui/components/index.ts` barrel export to include all 10 components

2. **Updated monitor to re-export from `@maestro/tui`**
   - All 10 component files in `packages/maestro-monitor/components/` replaced with thin re-exports
   - SessionMonitor.ts (the sole consumer) unchanged — imports still work via the same relative paths
   - Backward-compatible: `flattenExecutionTree`, `autoExpandRunningPath`, `flattenPhaseWorkflow`, `buildDirectoryTree`, `flattenFilesystem` still exported

3. **Fixed demo mode (no silent failures)**
   - Added `--demo` CLI flag (`maestro code --demo`)
   - Without `--demo` and without backend: shows `NoBackendScreen` (red error with instructions)
   - With `--demo`: shows `[DEMO]` in NavBar title and log output
   - Updated `launcher.ts` to forward `demo` flag
   - Updated `cli.ts` help text and flag passing

4. **Applied terminal background color**
   - `setTerminalBg(palette.bg)` called at startup in `startInteractive()`
   - `resetTerminalBg()` called after `instance.waitUntilExit()`
   - Imported from `@maestro/tui/theme`

### Test results
- TUI: 67/67 pass
- Monitor: 4/4 pass
- Maestro-code: 63/63 pass
- Client: 19/19 pass
- Sidecar: 5/5 pass
- **Total: 158/158 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/tui/components/WorkflowTree.ts` | NEW — extracted from monitor |
| `packages/tui/components/ExecutionLog.ts` | NEW — extracted from monitor |
| `packages/tui/components/LLMActivity.ts` | NEW — extracted from monitor |
| `packages/tui/components/MetricsPanel.ts` | NEW — extracted from monitor |
| `packages/tui/components/Variables.ts` | NEW — extracted from monitor |
| `packages/tui/components/Filesystem.ts` | NEW — extracted from monitor |
| `packages/tui/components/Artifacts.ts` | NEW — extracted from monitor |
| `packages/tui/components/CommandLog.ts` | NEW — extracted from monitor |
| `packages/tui/components/WidgetsPanel.ts` | NEW — extracted from monitor |
| `packages/tui/components/PhaseWorkflow.ts` | NEW — extracted from monitor |
| `packages/tui/components/index.ts` | Added 10 component exports |
| `packages/maestro-monitor/components/*.ts` | 10 files → thin re-exports |
| `packages/maestro-code/App.ts` | Demo mode, terminal bg, NoBackendScreen |
| `packages/maestro-code/launcher.ts` | Forward `demo` flag |
| `packages/maestro-cli/cli.ts` | `--demo` flag |
| `packages/maestro-code/tests/App.test.ts` | Updated demo mode test |

---

## Sub-Phase B: Detail Screens & Routing — COMPLETE

### What was done

1. **Extended Screen types** (`types.ts`)
   - Added `model-detail`, `workspace-detail`, `repo-detail` screen types
   - Updated `screenEquals()` for new id-bearing screen types
   - Updated `screenToPageKey()` — workspace/repo-detail → sessions tab, model-detail → models tab

2. **Created 3 new detail screens** in `packages/maestro-code/screens/`
   - **BlockDetailScreen.ts** — 4 panels: INFO (id, type, atomic, version, children tree), FITNESS (block + task fitness with progress bars and dimensions), SESSIONS (selectable list of linked sessions → navigate to session-detail), ACTIONS (view source JSON). Adapted from monitor's BlockDetail but without StatusBar or monitor page navigation.
   - **SessionDetailScreen.ts** — Full session monitoring cockpit using shared @maestro/tui data panels: EXECUTION tree (with auto-expand running nodes, cursor navigation), METRICS (fitness, nodes completed/total, score history), LOG (execution log tail), LLM (LLM activity). Uses `usePanelFocus` for Tab cycling between 4 panels.
   - **ModelDetailScreen.ts** — 3 panels: HEALTH (status, backend, device, GPU, uptime, load), USAGE (requests, latency, errors, tokens, throughput), PERFORMANCE (fitness bar, task breakdown, sparkline history). Adapted from monitor's ModelDetail.

3. **Updated App.ts routing**
   - Replaced nested ternary chain with clean `renderScreen()` switch/case function
   - Added routes for `block-detail`, `session-detail`, `model-detail`
   - Added `workspace-detail` and `repo-detail` to Screen type (routing ready for future)

4. **Added navigation to ModelsBrowser**
   - Added `onNavigate` prop and `tree.toggle` keyboard handler
   - Enter on a model → navigates to `model-detail` screen
   - Passed `onNavigate: nav.navigate` from App.ts

5. **Updated barrel export** (`screens/index.ts`)
   - Added BlockDetailScreen, SessionDetailScreen, ModelDetailScreen

### Architecture decisions

- **Detail screens live in maestro-code, NOT in @maestro/tui.** They're app-level screens with API fetching, navigation, and layout. The shared data panel components (WorkflowTree, ExecutionLog, etc.) are in @maestro/tui — the detail screens compose them.
- **No StatusBar in detail screens.** App.ts provides the global StatusBar at the bottom. Detail screens render only their content area.
- **No monitor page navigation.** Monitor's `page.home/spaces/foundry/catalog/models` keyboard actions not included. Maestro-code handles A/C/S/M navigation at the top level.
- **SessionDetailScreen uses the full set of @maestro/tui data panels** (WorkflowTree, ExecutionLog, LLMActivity, MetricsPanel) — the same components the monitor uses, imported from the shared package.

### Test results
- TUI: 67/67 pass
- Monitor: 4/4 pass
- Maestro-code: 63/63 pass
- Client: 19/19 pass
- Sidecar: 5/5 pass
- **Total: 158/158 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/maestro-code/types.ts` | Added model-detail, workspace-detail, repo-detail screen types + helpers |
| `packages/maestro-code/screens/BlockDetailScreen.ts` | NEW — block detail with 4 panels |
| `packages/maestro-code/screens/SessionDetailScreen.ts` | NEW — session cockpit with shared data panels |
| `packages/maestro-code/screens/ModelDetailScreen.ts` | NEW — model detail with 3 panels |
| `packages/maestro-code/screens/ModelsBrowser.ts` | Added onNavigate + Enter → model-detail |
| `packages/maestro-code/screens/index.ts` | Added 3 detail screen exports |
| `packages/maestro-code/App.ts` | Refactored routing to switch/case, added detail screen routes |

---

## Sub-Phase C: FlipperLayout (Cockpit) — COMPLETE

### What was done

1. **Created FlipperLayout component** (`layouts/FlipperLayout.ts`, ~370 lines)
   The main visual change of Phase 41-PRE. Transforms the agent screen from a flat log into a multi-panel cockpit.

   **Idle mode** (no session):
   - Full-screen hero panel with conversation output and input
   - Compact agent activity bar (1 line) when agent is active (working/navigating)
   - Identical behavior to the old flat layout but with cleaner structure

   **Active mode** (session running):
   ```
   ┌────────────────────────────┬──────────────────────────┐
   │  HERO (65%)                │  EXECUTION TREE (35%)    │
   │  [compact activity bar]   │  ✓ Prepare               │
   │  > Add login page         │  ▶ Plan ←                │
   │    ✓ Plan done            │──────────────────────────│
   │  > [input prompt]         │  METRICS                  │
   ├────────────────────────────┴──────────────────────────┤
   │  LOG (50%)                 │  LLM ACTIVITY (50%)      │
   └────────────────────────────┴──────────────────────────┘
   ```
   - Hero (65%): conversation + compact AgentActivity + InputPrompt
   - Right column (35%): WorkflowTree (top, with auto-expand) + MetricsPanel (bottom)
   - Bottom bar: ExecutionLog (left) + LLMActivity (right)
   - Session data polled independently via `useApiData` every 2s

2. **Keyboard context switching**
   - Tab: cycles focus between panels (hero → tree → log → llm → hero)
   - When hero focused: InputPrompt active, full typing mode
   - When panel focused: InputPrompt disabled (shows `[Tab] to type`), arrow keys navigate tree
   - Esc: returns focus to hero (from panel) or exits zoom
   - z: zooms focused context panel to full screen
   - Tree panel: up/down/left/right for tree navigation, Enter/Space to toggle expand

3. **Zoom mode**
   - z key on any context panel → full-screen view of that panel
   - Shows `[Esc]exit zoom` hint
   - Supports zooming EXECUTION, LOG, or LLM panels

4. **AgentActivity compact mode**
   - Added `compact?: boolean` prop
   - Compact: 1-line inline bar — `◉ Agent working — Creating files...`
   - Full: 13-line mascotte + state info (used on idle agent screen)
   - Compact used in both FlipperLayout idle (active agent) and active (session running)

5. **Integrated into App.ts**
   - `renderAgentContent()` replaced with single `FlipperLayout` component call
   - Tab screen cycling disabled when on agent screen (FlipperLayout handles Tab)
   - Old `OutputPanel`, `AgentActivity` import removed from App.ts
   - `WidgetRenderer` passed as prop for widget rendering

6. **Fixed infinite render loop**
   - `useTreeNav.setFlatNodes()` called in `useEffect` caused infinite loop (flatNodes reference changed each render)
   - Fixed by using string hash of node IDs as dependency

### Architecture decisions

- **FlipperLayout is self-contained**: it manages panel focus, zoom, tree nav, and session polling internally. App.ts passes minimal props (session ID, conversation state, handlers).
- **Compact vs Full AgentActivity**: the full mascotte (13 lines) is too large for the active cockpit. Compact mode gives the agent status in 1 line, leaving maximum space for content.
- **Independent session polling**: FlipperLayout polls session data via `useApiData` when a sessionId is set. This is independent of SessionManager's polling — SessionManager handles lifecycle (create, invoke, detect completion), FlipperLayout handles monitoring display.
- **InputPrompt disabled state**: when a context panel is focused, InputPrompt shows `[Tab] to type` and ignores keystrokes. This prevents accidental typing while navigating the tree.

### Test results
- TUI: 67/67 pass
- Monitor: 4/4 pass
- Maestro-code: 63/63 pass
- Client: 19/19 pass
- Sidecar: 5/5 pass
- **Total: 158/158 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/maestro-code/layouts/FlipperLayout.ts` | NEW — cockpit layout (idle + active modes, panel focus, zoom, tree nav) |
| `packages/maestro-code/panels/AgentActivity.ts` | Added `compact` prop — 1-line mode without mascotte |
| `packages/maestro-code/App.ts` | FlipperLayout integration, Tab scope fix, removed old AgentActivity import |

---

## Sub-Phase D: Polish & Unification — COMPLETE

### What was done

1. **Rich StatusBar** (`App.ts`)
   - Replaced simple StatusBar ("No session" / "Ready") with `RichStatusBar`
   - Shows animated connection status (breathing dot connected, spinner connecting, ✗ error)
   - Shows latency (periodic health check every 15s)
   - Shows session ID when active
   - Shows voice mode indicator
   - Shows focused panel indicator (◈ TREE) and zoomed panel indicator (▣ TREE)
   - Context-aware keyboard shortcuts that change based on screen type, focus state, and zoom
   - Uses `Shortcut` component from @maestro/tui for consistent styling

2. **Panel state propagation** (`FlipperLayout.ts`)
   - Added `onPanelFocus` and `onZoom` callback props to FlipperLayout
   - Reports panel focus and zoom changes to parent (App.ts) via useEffect
   - App.ts stores `activePanelFocus` and `activeZoom` state, passes to RichStatusBar

3. **Mouse support** (`FlipperLayout.ts`)
   - Added `useMouse` hook from @maestro/tui/hooks
   - Click-to-focus: maps click coordinates to panel regions (hero/tree/log/llm)
   - Scroll wheel: navigates tree up/down when tree panel is focused
   - Uses stdout columns for accurate region mapping

4. **Extended HelpOverlay** (`HelpOverlay.ts`)
   - 5 sections (was 4): Navigation, Agent — Input, Cockpit — Panels, Lists, General
   - Added Tab screen cycling, Ctrl+D session shortcut, /session command
   - Added full Cockpit panel shortcuts: Tab focus cycling, z zoom, tree nav, mouse hints
   - Added click/scroll mouse hints

5. **Session shortcut** (`App.ts`)
   - `/session` slash command: navigates to SessionDetailScreen for current active session
   - Shows "No active session" warning if no session is running
   - `Ctrl+D` keyboard shortcut: same behavior (global handler)

### Architecture decisions

- **RichStatusBar lives in App.ts, not @maestro/tui.** It's app-specific (maestro-code shortcuts, screen types, session handling). The @maestro/tui StatusBar remains for the monitor which has different context needs.
- **Panel state lifted via callbacks.** FlipperLayout reports focus/zoom changes via `onPanelFocus`/`onZoom` callbacks. App.ts stores the state and passes it to RichStatusBar. This avoids complex state sharing or context providers.
- **Health check is periodic (15s).** Keeps connection status updated without excessive polling. The initial check runs immediately on mount.
- **Mouse regions are approximate.** Click regions are calculated from terminal columns and height proportions. This matches the CSS-like layout percentages used in FlipperLayout (65%/35% width, 60%/40% height).

### Test results
- TUI: 67/67 pass
- Monitor: 4/4 pass
- Maestro-code: 63/63 pass
- Client: 19/19 pass
- Sidecar: 5/5 pass
- **Total: 158/158 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/maestro-code/App.ts` | RichStatusBar (connection, latency, focus, shortcuts), /session command, Ctrl+D handler, health check periodic |
| `packages/maestro-code/layouts/FlipperLayout.ts` | onPanelFocus/onZoom callbacks, useMouse (click + scroll), useStdout for dimensions |
| `packages/maestro-code/screens/HelpOverlay.ts` | 5 sections with cockpit panel shortcuts, mouse hints |
| `packages/maestro-code/tests/App.test.ts` | Updated StatusBar tests for RichStatusBar interface |
| `packages/maestro-code/tests/screens.test.ts` | Updated HelpOverlay assertions for expanded content |

---

## Sub-Phase E: Cleanup — COMPLETE

### What was done

1. **Simplified SessionManager polling** (`App.ts`)
   - Removed execution log entry rendering from `startPolling()` — ExecutionLog panel in FlipperLayout handles this
   - Removed execution tree flat text rendering (▶/✓/✗ lines) from `startPolling()` — WorkflowTree in FlipperLayout handles this
   - `startPolling()` now only detects session completion (checks tree all-done + session status)
   - Removed unused `lastLogCount` and `lastTreeHash` fields
   - Reduced polling callback from ~50 lines to ~20 lines

2. **Removed focus hint from FlipperLayout** (`FlipperLayout.ts`)
   - The inline `[Tab]panels [?]help` / `[Tab]next [Esc]input [z]zoom` hint at the bottom of FlipperLayout was redundant with the RichStatusBar which shows the same information context-aware
   - Freed up 1 line of vertical space for content

3. **Cleaned up unused imports**
   - Removed `inkTheme` from App.ts (was imported but unused after Sub-Phase D)
   - Removed `inkTheme as theme` from FlipperLayout.ts (was only used by the removed focus hint)

4. **Documented dual OutputPanel/InputPrompt**
   - App.ts has `OutputPanel` and `InputPrompt` (exported, tested) — these are the public API for tests
   - FlipperLayout.ts has its own internal copies adapted for the cockpit layout
   - Added comments clarifying both exist: App.ts versions are "exported for tests", FlipperLayout uses its own

### Architecture decisions

- **SessionManager is now lifecycle-only.** It creates sessions, imports templates, starts sessions, invokes entry points, polls for completion, and manages widgets. It does NOT render execution data — FlipperLayout's context panels (WorkflowTree, ExecutionLog, LLMActivity) handle all visual monitoring via their own independent `useApiData` polling.
- **Double polling accepted.** SessionManager and FlipperLayout both poll `getSession()` every 2s. This is intentional: SessionManager needs completion detection (to set `busy=false`), FlipperLayout needs live data for rendering. Merging them would require complex state sharing. Two lightweight polls is the simpler design.
- **OutputPanel/InputPrompt kept in both files.** The App.ts versions serve as the tested public API. The FlipperLayout versions are slightly different (borderless, different upArrow behavior). Extracting to a shared module would be over-engineering for two small components with minor differences.

### Test results
- TUI: 67/67 pass
- Monitor: 4/4 pass
- Maestro-code: 63/63 pass
- Client: 19/19 pass
- Sidecar: 5/5 pass
- **Total: 158/158 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/maestro-code/App.ts` | SessionManager simplified (completion-only polling), removed unused inkTheme import, documented dual components |
| `packages/maestro-code/layouts/FlipperLayout.ts` | Removed focus hint (RichStatusBar handles it), removed unused theme import |
| `packages/maestro-code/tests/App.test.ts` | Updated SessionManager completion test (no longer expects tree/log text) |

---

## Phase 41-PRE Summary — COMPLETE

### Overview

Phase 41-PRE transformed `maestro-code` from a minimal chat app into a full-featured **Flipper Zero-inspired cockpit**. The agent screen now features a multi-panel layout with live monitoring panels, while maintaining the clean, focused design of the original chat interface.

### Key deliverables

1. **10 data panel components** extracted from `@maestro/monitor` to `@maestro/tui` (shared design system)
2. **3 detail screens** (BlockDetail, SessionDetail, ModelDetail) with full monitoring panels
3. **FlipperLayout** — hero panel (65%) + execution tree + metrics + log + LLM activity
4. **Panel focus cycling** (Tab), **zoom** (z), **tree navigation** (arrows), **mouse support** (click/scroll)
5. **Rich StatusBar** with connection status, latency, focus indicator, context-aware shortcuts
6. **Extended HelpOverlay** with 5 sections covering all cockpit interactions
7. **Session shortcut** (`/session`, `Ctrl+D`) for quick access to session detail
8. **Simplified SessionManager** — lifecycle-only (no duplicate rendering)
9. **Demo mode** with `--demo` flag and backend error screen without silent failures
10. **Terminal background** applied at startup and reset on exit

### Architecture

```
@maestro/tui (shared design system)
├── Panel, WorkflowTree, ExecutionLog, LLMActivity, MetricsPanel
├── Variables, Filesystem, Artifacts, CommandLog, PhaseWorkflow
├── Shortcut, StatusBar, NavBar, PixelArt
├── hooks: useApiData, useTreeNav, useMouse, usePanelFocus, ...
└── theme, utils, sprites

@maestro/code (app — imports from @maestro/tui)
├── FlipperLayout (cockpit: hero + context panels)
├── 3 detail screens (compose @maestro/tui panels)
├── 3 browser screens (catalog, sessions, models)
├── RichStatusBar, AgentActivity, AgentBadge
├── SessionManager (lifecycle-only)
└── App.ts (routing, navigation, global keyboard)

@maestro/monitor (standalone monitor — also imports from @maestro/tui)
└── Components now thin re-exports from @maestro/tui
```

### Test coverage
- **134/134 tests pass** across TUI (67) + Monitor (4) + Maestro-code (63)
- All sub-phases verified independently

---

## Sub-Phase F: Demo Mode Fix (Critical) — COMPLETE

### Problem

After completing Sub-Phases A–E, the demo mode (`maestro code --demo`) showed the same flat idle layout as before the refactor. The cockpit (WorkflowTree, ExecutionLog, LLMActivity, MetricsPanel panels) was never visible because:

1. **`currentSessionId` was never set.** The old demo branch used a `setTimeout` mock that never created a session. FlipperLayout checks `hasSession = sessionId != null` — always false in demo.
2. **Pre-existing bug in `handleSubmit`.** The `setBusy(true)` callback was called at the top of `submitTask()` before the session was created, so `sessionManager.getSessionId()` returned null.
3. **No auto-start.** Demo mode required the user to type and submit a task before anything happened. A user opening `--demo` for the first time saw the identical flat layout and concluded nothing had changed.

### What was done

1. **`createDemoClient()`** — mock API client (already existed) returns staged data:
   - Execution tree with 5 nodes (Prepare → Plan → Implement → Review → Commit) that evolve over ~6s
   - Execution log entries at staged intervals
   - LLM activity entries with prompt/response previews
   - Health endpoint that always returns OK
   - Session create/start that resolve immediately

2. **Internal demo setup in `InteractiveApp`** (`App.ts`)
   - When `demoMode=true` and no real `SessionManager` is provided, creates an internal demo client + SessionManager via `useState` initializer
   - Uses effective `sessionManager` and `apiClient` (shadowing props) so all existing code paths work without changes
   - The demo client is used for health checks (→ "connected" status), session polling (→ cockpit data), and entry point invocation

3. **Fixed `setCurrentSessionId` timing** (`App.ts`)
   - Moved `setCurrentSessionId(sessionManager.getSessionId())` from the `setBusy(true)` callback to a `.then()` after `submitTask()` resolves
   - This ensures the session ID is set AFTER the async session creation completes (not before)
   - This was a pre-existing bug that became visible with FlipperLayout

4. **Auto-start demo session** (`App.ts`)
   - Added `useEffect` that calls `handleSubmit('Add login page')` on mount when `demoMode=true`
   - Uses `autoStarted` ref to fire only once
   - Demo launches and immediately shows the cockpit building up — no user interaction needed

5. **Removed old fake demo branch** (`App.ts`)
   - Deleted the `else if (demoMode) { setTimeout(...) }` branch from `handleSubmit`
   - Demo mode now goes through the real SessionManager flow with the mock client

6. **Keep cockpit visible after completion** (`App.ts`)
   - When `demoMode=true` and task completes (`setBusy(false)`), `currentSessionId` is NOT cleared
   - The cockpit stays visible with the final state (all nodes completed, logs filled)

7. **NavBar overflow fix** (`packages/tui/components/NavBar.ts`)
   - Added `overflow: 'hidden'` to prevent text cutoff at narrow terminal widths
   - Left side (title + tabs) uses `flexShrink: 1`, right side (badge + hint) uses `flexShrink: 0`

### Test results
- TUI: 67/67 pass
- Monitor: 4/4 pass
- Maestro-code: 63/63 pass (demo test verifies cockpit panels render)
- **Total: 134/134 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/maestro-code/App.ts` | Internal demo setup (demoSetup useState), fixed setCurrentSessionId timing (.then), auto-start effect, removed old demo branch, keep session visible |
| `packages/tui/components/NavBar.ts` | overflow: hidden, flexShrink for responsive layout |
| `packages/maestro-code/tests/App.test.ts` | Updated demo test to verify cockpit panels render (EXECUTION, LOG, LLM) |

---

# Spatial TUI Sub-Phases (41-A through 41-H)

These sub-phases implement the spatial full-screen page navigation system designed in `DESIGN-SPATIAL-TUI.md`.

---

## Sub-Phase 41-A: Foundation — Page Registry + Monitor Exports — COMPLETE

### What was done

1. **Monitor granular exports** (`packages/maestro-monitor/package.json`)
   - Added `"./components/*"`, `"./hooks/*"`, `"./theme"` wildcard exports
   - Main entry point unchanged — standalone monitor still works

2. **maestro-code dependency + tsconfig** (`packages/maestro-code/`)
   - Added `"@maestro/monitor": "*"` to package.json dependencies
   - Added `@maestro/monitor` and `@maestro/monitor/*` path aliases in tsconfig.json

3. **Page Registry types** (`registry/types.ts`)
   - `Direction`, `Position`, `PageDefinition`, `PageProps`, `DetailScreenDef`, `DirectionHint`
   - `PageProps` includes: apiClient, sessionId, onNavigate, onBack, height, width

4. **PageRegistry class** (`registry/PageRegistry.ts`)
   - Two internal Maps: `pages` (by id) and `grid` (by "x,y" key)
   - Methods: `register()`, `getById()`, `getAt()`, `getAll()`, `getRing()`, `getDirectionHints()`
   - `createDefaultRegistry()` factory function
   - Throws on duplicate id or position

5. **Built-in pages** (`registry/built-in-pages.ts`)
   - 5 placeholder pages: agent(0,0), execution(0,-1), catalog(-1,0), spaces(1,0), models(0,1)
   - `registerBuiltInPages(registry)` helper function

6. **Barrel export** (`registry/index.ts`)
   - Exports: PageRegistry, createDefaultRegistry, types, BUILT_IN_PAGES, registerBuiltInPages

7. **Tests**
   - `tests/page-registry.test.ts` — 13 tests: register, getById, getAt, getAll, getRing angle sort, getDirectionHints (3 cases), duplicate id/position throws, BUILT_IN_PAGES structure, agent center position
   - `tests/monitor-imports.test.ts` — 6 tests: SessionMonitor, CatalogScreen, SpacesScreen, ModelsScreen, WorkflowTree importable as functions + theme importable

### Test results
- maestro-code: 83/83 pass (was 63 — +20 new tests)
- maestro-monitor: 4/4 pass (no regression)
- TUI: 67/67 pass (no regression)
- **Total: 154/154 pass**

### Files modified

| File | Change |
|------|--------|
| `packages/maestro-monitor/package.json` | Added granular exports (components/*, hooks/*, theme) |
| `packages/maestro-code/package.json` | Added @maestro/monitor dependency |
| `packages/maestro-code/tsconfig.json` | Added @maestro/monitor path aliases |
| `packages/maestro-code/registry/types.ts` | NEW — PageDefinition, PageProps, Direction, Position, etc. |
| `packages/maestro-code/registry/PageRegistry.ts` | NEW — PageRegistry class + createDefaultRegistry |
| `packages/maestro-code/registry/built-in-pages.ts` | NEW — 5 built-in page defs + registerBuiltInPages |
| `packages/maestro-code/registry/index.ts` | NEW — barrel export |
| `packages/maestro-code/tests/page-registry.test.ts` | NEW — 13 tests |
| `packages/maestro-code/tests/monitor-imports.test.ts` | NEW — 6 tests |
