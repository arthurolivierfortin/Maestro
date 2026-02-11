# Phase 15 — Summary of Changes

**Date**: 2026-02-11
**Branch**: `feat/MAESTRO-8-create-first-real-session`
**Status**: In Progress

---

## 1. Overview

Phase 15 transforms the Maestro TUI monitor from a basic 2-screen blessed terminal app into a modern 5-page React/Ink terminal application with tree navigation, multi-page routing, and visual testing infrastructure.

---

## 2. ADRs & Design Documents

| Document | Purpose |
|----------|---------|
| `ADR-TUI-MIGRATION-BLESSED-TO-INK.md` | Decision to migrate from blessed to Ink 6.7.0 (ESM-only) + React 19 |
| `ADR-TUI-NAVIGATION-AND-TREE-NAV.md` | Generic `useTreeNav` hook, FlatNode pattern, keyboard mapping, Global/Session navigation |
| `ANALYSIS-TUI-PAGE-ARCHITECTURE.md` | Full analysis: 5-page architecture (Home/Spaces/Foundry/Catalog/Models), frontend alignment, Wizard creation pattern |
| `IMPLEMENTATION-TUI-MULTI-PAGE.md` | Implementation plan for multi-page routing |

---

## 3. Architecture Decisions

### 3.1 Ink Migration (blessed -> Ink)
- **Ink 6.7.0** (ESM-only) with **React 19.2.4**
- Convention: `createElement as h`, NO JSX, functional components
- CJS->ESM bridge: `tui-monitor.js` uses `await import('./ink/App.js')`
- `--legacy` flag preserves blessed fallback
- Own `package.json` in `maestro-cli/monitor/ink/` with `"type": "module"`

### 3.2 Tree Navigation (useTreeNav)
- Generic hook: `useTreeNav()` returns cursor, expanded Set, toggle/expand/collapse
- FlatNode shape: `{ id, depth, hasChildren, isExpanded, parentId, label, data }`
- Flatten-then-render pattern: domain data -> FlatNode[] -> cursor-aware rendering
- File-system-style Left/Right expand/collapse
- Hooks always called unconditionally (React rules of hooks)
- Stable `useCallback([])` references to prevent re-render cascades

### 3.3 Multi-Page Architecture
- 5 pages: Home, Spaces, Foundry, Catalog, Models
- `App.js` routes via `currentPage` state
- When `currentSessionId` is set -> renders SessionMonitor (unchanged)
- Navigation keys: `h`=Home, `s`=Spaces, `f`=Foundry, `c`=Catalog, `m`=Models
- NavBar at top, StatusBar at bottom for all pages

### 3.4 Spaces = Repos + Workspaces + Sessions
- Single page with 3 tabs (numbered 1-3)
- No session-type-specific tabs (Training/Testing/Monitoring are just sessions)
- Follows cardinal rule: infrastructure is generic, content is specific

---

## 4. Files Created (Ink Monitor)

### Components (17 files)
| File | Purpose | Lines |
|------|---------|-------|
| `components/HomeScreen.js` | Dashboard: system status, active sessions, quick actions | ~200 |
| `components/SpacesScreen.js` | Repos/Workspaces/Sessions browser (replaces GlobalMonitor) | ~350 |
| `components/FoundryScreen.js` | User blocks browser with inline expansion | ~250 |
| `components/CatalogScreen.js` | System+user block catalog with type filters | ~250 |
| `components/ModelsScreen.js` | LLM model management (two-pane layout) | ~200 |
| `components/NavBar.js` | Top navigation bar with 5 page tabs | ~50 |
| `components/SessionMonitor.js` | Session detail orchestrator (3 modes: descriptor/execution/idle) | ~730 |
| `components/GlobalMonitor.js` | Legacy session list (preserved for compatibility) | ~150 |
| `components/SessionList.js` | Reusable session card list with fitness bars | ~150 |
| `components/WorkflowTree.js` | Execution tree with flatten-then-render | ~200 |
| `components/PhaseWorkflow.js` | Phase + execution tree children, done/running/pending styling | ~460 |
| `components/LLMActivity.js` | LLM call history display | ~100 |
| `components/ExecutionLog.js` | Timestamped execution log entries | ~60 |
| `components/Panel.js` | Reusable bordered container with scroll | ~80 |
| `components/Header.js` | Session header info | ~50 |
| `components/StatusBar.js` | Page-aware connection status footer | ~80 |
| `components/Filesystem.js` | Directory tree with access colors | ~150 |

### Hooks (4 files)
| File | Purpose |
|------|---------|
| `hooks/useTreeNav.js` | Generic tree cursor + expanded Set management |
| `hooks/useKeyboard.js` | Key dispatch (arrows, letters, special keys) |
| `hooks/useScroll.js` | Per-panel scroll offset with max limits |
| `hooks/useApiData.js` | Generic API polling hook |

### Other (3 files)
| File | Purpose |
|------|---------|
| `App.js` | Root router: multi-page + SessionMonitor |
| `theme.js` | Colors, icons, Badge, TypeBadge, helpers |
| `mock-api-client.js` | Deterministic fake data for visual testing |

---

## 5. Recent Session-Specific Changes

### 5.1 PhaseWorkflow Enhancements

**Phase status propagation to exec children (`_phaseStatus`)**:
- `flattenExecNode` now receives `phaseStatus` parameter from parent phase
- Each exec node's data includes `_phaseStatus` field
- Rendering: exec nodes under done/pending phases are grayed out (icon + name)
- Badges/tags keep their real status color (NOT grayed)

**Auto-expand fix**:
- Bug: auto-expand effect had `tnExpanded` in deps, causing running phases to immediately re-expand after user collapse
- Fix: replaced with `useRef(new Set())` tracking auto-expanded phase IDs
- Running phases are auto-expanded exactly once, user can collapse freely

**Visual styling**:
- Selected/hovered items: cursor `>` and name in blue
- Done phases: icon and name in gray, badge keeps green `[done]`
- Running phases: status-colored icon, bold name
- Pending exec children: grayed out like done children

### 5.2 Auto-Scroll Improvements
- Tracks expanded set size changes to adjust scroll
- Conservative scroll: only scrolls when cursor goes out of visible area
- No longer jumps aggressively into sub-trees on expand/collapse

### 5.3 Mock Monitor Mode
- `--mock` flag: `node index.js monitor --mock`
- `MockApiClient` class with 4 mock sessions (descriptor/execution/idle/completed)
- Realistic phases (done/running/pending), exec tree with nesting, LLM activity, execution log
- 10 mock blocks, 3 projects, 2 workspaces, 4 LLM models
- Enables visual testing without backend

### 5.4 Tests
- `tests/phase-workflow-tree.test.js`: 88 tests covering flatten logic, _phaseStatus propagation, ID collision prevention, toggle simulation

---

## 6. Current Icon & Badge System

### 6.1 TUI Monitor (Current)

**Left-side icons** = **Status**:
| Icon | Status | Color |
|------|--------|-------|
| `✓` | done/completed | green |
| `●` | running/active | cyan |
| `○` | pending/waiting | gray |
| `✗` | failed/error | red |
| `‖` | paused | yellow |

**Right-side badges** = **Status** (redundant with left icon):
| Badge | Status |
|-------|--------|
| `[done]` | done/completed |
| `[running]` | running/active |
| `[...]` | pending/waiting |
| `[FAIL]` | failed/error |

**Expand/collapse icons**:
| Icon | Meaning |
|------|---------|
| `▼` | Expanded |
| `▶` | Collapsed |

### 6.2 Catalog Screen (Current)
Uses **TypeBadge** instead of status Badge:
| Badge | Block Type | Color |
|-------|-----------|-------|
| `[workflow]` | workflow | cyan |
| `[agent]` | agent | magenta |
| `[tool]` | tool | green |
| `[inference]` | inference | cyan |
| `[validator]` | validator | red |

### 6.3 Session Tree (.md output from Phase 12)

**Left-side icons** = **Node Type** (NOT status):
| Icon | Node Type | Unicode |
|------|-----------|---------|
| `▼` | workflow (expanded) | U+25BC |
| `∀` | for-each loop | U+2200 |
| `↻` | while loop | U+21BB |
| `▶` | phase (one-shot) | U+25B6 |
| `○` | regular block/tool | U+25CB |
| `◇` | conditional (if/else) | U+25C7 |

**Right-side badges** = **Block Type**:
`[workflow]`, `[tool]`, `[inference]`, `[validator]`, `[phase]`, `[while]`, `[for-each]`, `[conditional]`

---

## 7. Uniformization Proposals: Tree Icon System

### The Problem

Three different rendering contexts use inconsistent conventions:

| Context | Left Icon | Right Badge |
|---------|-----------|-------------|
| **TUI Tree** (WorkflowTree/PhaseWorkflow) | Status (✓/●/○) | Status `[done]`/`[running]` |
| **Catalog** | — | Type `[workflow]`/`[tool]` |
| **Session-tree.md** | Node type (▼/∀/↻/○) | Block type `[tool]`/`[inference]` |

The TUI tree currently shows status TWICE (left icon AND right badge) but never shows what TYPE of node it is. The session-tree.md shows the type but not the runtime status.

### Proposal A: Left = Status, Right = Type (Recommended)

Keep the left icon for **runtime status** (what's happening) and change the right badge to **node/block type** (what it IS). This aligns with the Catalog convention.

```
  ▼ creation                                    (Phase row)
    ✓ Load Configuration              [tool]     (done tool)
    ✓ Improvement Loop                [while]    (done while loop)
    │ ✓ Read Artifact                 [tool]
    │ ✓ Run Training                  [inference]
    │ ✓ Evaluate Results              [validator]
    ✓ Finalize & Report               [tool]
  ▼ optimization
    ● Load Configuration              [tool]     (running tool)
    ● Improvement Loop                [while]    (running while)
    │ ● Read Artifact                 [tool]
    │ ● Run Training                  [inference]  ←
    │ ○ Evaluate Results              [validator]
    ○ Finalize & Report               [tool]     (pending tool)
  ▶ validation                                   (collapsed)
  ▶ publish                                      (collapsed)
```

**Advantages**:
- Status is unambiguous from the left icon (✓/●/○/✗)
- Type is immediately visible from the badge
- Consistent with Catalog (type badges) and session-tree.md (type info)
- No redundant information — each piece of data shown exactly once

**Left icon mapping**:
| Icon | Meaning | Color |
|------|---------|-------|
| `✓` | done | green |
| `●` | running | cyan |
| `○` | pending | gray |
| `✗` | failed | red |
| `‖` | paused | yellow |

**Right badge mapping** (same as Catalog `TypeBadge`):
| Badge | Color |
|-------|-------|
| `[workflow]` | cyan |
| `[agent]` | magenta |
| `[tool]` | green |
| `[inference]` | cyan |
| `[validator]` | red |
| `[while]` | yellow |
| `[for-each]` | yellow |
| `[phase]` | blue |
| `[conditional]` | yellow |

### Proposal B: Left = Type Symbol, Right = Status Badge

Use the session-tree.md convention for the left icon (node type symbol) and keep the current status badge on the right.

```
  ▼ creation                                     (Phase row)
    ○ Load Configuration              [done]      (regular tool, done)
    ↻ Improvement Loop                [done]      (while loop, done)
    │ ○ Read Artifact                 [done]
    │ ○ Run Training                  [done]      (inference, shown as ○)
    │ ○ Evaluate Results              [done]      (validator, shown as ○)
    ○ Finalize & Report               [done]
  ▼ optimization
    ○ Load Configuration              [running]   (regular tool, running)
    ↻ Improvement Loop                [running]   (while loop, running)
    │ ○ Read Artifact                 [done]
    │ ○ Run Training                  [running]  ←
    │ ○ Evaluate Results              [...]       (pending)
    ○ Finalize & Report               [...]
  ▶ validation                                    (collapsed)
  ▶ publish                                       (collapsed)
```

**Advantages**:
- Node type visible at a glance from the symbol
- Matches the session-tree.md documentation output
- Status is clear from the colored badge

**Disadvantages**:
- Most nodes are `○` (regular blocks) — the type symbol only differentiates control flow nodes (while/for-each/conditional/phase)
- The `○` symbol is also used for "pending" status in the current system — potential confusion
- Status must be read from the right badge, which is less scannable than a colored icon
- Need different symbols for ○ (regular tool) vs ○ (pending) — ambiguous

### Proposal C: Left = Type Symbol + Status Color, Right = Type Badge

Combine both: the left icon shows the NODE TYPE SYMBOL from session-tree.md but COLORED by runtime status. The right badge shows the block type (like Catalog).

```
  ▼ creation                                     (Phase row)
    ○ Load Configuration              [tool]      (○ in GREEN = done tool)
    ↻ Improvement Loop                [while]     (↻ in GREEN = done while)
    │ ○ Read Artifact                 [tool]      (○ in GREEN = done)
    │ ○ Run Training                  [inference] (○ in GREEN = done)
    │ ○ Evaluate Results              [validator] (○ in GREEN = done)
    ○ Finalize & Report               [tool]      (○ in GREEN = done)
  ▼ optimization
    ○ Load Configuration              [tool]      (○ in CYAN = running)
    ↻ Improvement Loop                [while]     (↻ in CYAN = running)
    │ ○ Read Artifact                 [tool]      (○ in GREEN = done)
    │ ○ Run Training                  [inference] (○ in CYAN = running) ←
    │ ○ Evaluate Results              [validator] (○ in GRAY = pending)
    ○ Finalize & Report               [tool]      (○ in GRAY = pending)
  ▶ validation                                    (collapsed)
  ▶ publish                                       (collapsed)
```

**Advantages**:
- Maximum information density: type symbol + status color + type badge
- Consistent with session-tree.md for node type symbols
- Consistent with Catalog for type badges
- No ambiguity: symbol = structure, color = status, badge = block type

**Disadvantages**:
- Information overload: three data dimensions on one line
- Most nodes still show `○` (regular blocks), so the type symbol adds less value
- More complex to implement

### Recommendation

**Proposal A** (Left = Status icon, Right = Type badge) is recommended:
1. **Simplest** — one icon per dimension (status left, type right)
2. **Consistent with Catalog** — type badges already exist and are color-coded
3. **Scannable** — status icons (✓/●/○) are instantly recognizable at the left edge
4. **No redundancy** — eliminates the current double-status display
5. **Minimal change** — only the Badge component needs to be swapped for TypeBadge in trees

The only element missing vs session-tree.md is the control flow symbols (∀/↻/◇). These could be added later as a prefix to the node name or as an additional badge, but they require the execution tree data to include `nodeType` (which it currently doesn't for runtime nodes).

---

## 8. Pending Work

### 8.1 Implemented (this session)
- [x] Phase status propagation (_phaseStatus) to exec children
- [x] Gray styling for done/pending exec children (badges keep color)
- [x] Blue cursor for selected items
- [x] Auto-expand fix (useRef prevents re-expand after user collapse)
- [x] Conservative auto-scroll (only when cursor out of view)
- [x] Mock monitor mode (--mock flag)
- [x] 88 unit tests for flatten/tree logic

### 8.2 Next Steps
- [ ] Workspace detail page (reuse session components)
- [ ] Repo detail page (reuse session components)
- [ ] Models detail page
- [ ] Uniformize tree icon/badge system (Proposal A)
- [ ] Verify LLM Activity panel with mock data
- [ ] Panel-scoped scrolling verification
- [ ] Wizard components for creation workflows
