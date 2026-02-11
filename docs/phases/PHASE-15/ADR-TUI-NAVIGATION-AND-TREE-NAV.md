# ADR: TUI Monitor Navigation & Tree Navigation

**Status**: Accepted
**Date**: 2026-02-10
**Phase**: 15 (TUI Migration blessed → Ink)

## Context

The Ink TUI monitor initially rendered all views as static read-only panels. Users needed:
1. Expand/collapse tree navigation within panels (WorkflowTree, Filesystem, PhaseWorkflow)
2. Seamless in-app navigation between the global session list and individual session monitors
3. Clear separation between "quit app" and "go back"

## Decisions

### 1. Tree Navigation: Generic Hook + FlatNode Pattern

**Decision**: A single reusable `useTreeNav` hook manages cursor + expanded state. Each tree component flattens its domain data into a standard `FlatNode[]` shape.

**FlatNode shape**:
```js
{ id, depth, hasChildren, isExpanded, parentId, label, data }
```

**Rationale**:
- One hook, many trees — WorkflowTree, Filesystem, PhaseWorkflow all use the same mechanism
- Flatten-then-render is simpler than recursive rendering with cursor tracking
- File-system-style Left/Right expand/collapse is intuitive

**Keyboard mapping**:
| Key | Tree panel | Non-tree panel |
|-----|-----------|----------------|
| Up/Down | Move cursor | Scroll |
| Left | Collapse / go to parent | — |
| Right | Expand / go to first child | — |
| Enter/Space | Toggle expand/collapse | Zoom panel |
| Ctrl+Arrows | Switch panels | Switch panels |
| Tab/Shift-Tab | Cycle panel focus | Cycle panel focus |

### 2. React Hooks: Always Unconditional

**Decision**: All hooks (`useMemo`, `useEffect`) are called unconditionally at the top of each component. Null guards go *inside* the hook callbacks, never around the hook call itself.

**Wrong (causes double-press bug)**:
```js
if (treeNav) {
  const flatNodes = useMemo(() => { ... }, [deps]);  // HOOK INSIDE CONDITIONAL
  useEffect(() => { ... }, [deps]);                   // HOOK INSIDE CONDITIONAL
}
```

**Correct**:
```js
const flatNodes = useMemo(() => {
  if (!tnExpanded) return [];  // guard inside
  return flatten(data, tnExpanded);
}, [data, tnExpanded]);

useEffect(() => {
  if (!tnSetFlatNodes) return;  // guard inside
  tnSetFlatNodes(flatNodes);
}, [flatNodes, tnSetFlatNodes]);

if (treeNav) { /* render interactive */ }
// else { /* render legacy */ }
```

**Rationale**: React requires hooks to be called in the same order on every render. Conditional hooks cause unpredictable state scheduling, manifesting as double-press cursor bugs.

### 3. Stable useCallback References

**Decision**: Functions returned by `useTreeNav` (`expand`, `collapse`, `setFlatNodes`) use `useCallback([])` and return the same state reference when the operation is a no-op.

```js
const expand = useCallback((id) => {
  setExpanded(prev => {
    if (prev.has(id)) return prev;  // same ref → no re-render
    return new Set(prev).add(id);
  });
}, []);
```

**Rationale**: Prevents re-render cascades. Components destructure stable function refs (`tnExpand = treeNav?.expand`) for useEffect deps, so effects only fire when data actually changes.

### 4. Terminal Artifact Clearing

**Decision**: Each flat row component appends 5 trailing space characters after its last visible element.

```js
parts.push(h(Text, { key: 'clr' }, '     '));
```

**Rejected alternative**: Padding badge text with `.padEnd(7)` — this made all badges wide (`[done   ]`) which looked ugly. Row-level trailing spaces are invisible and handle all cases where content shrinks.

**Rationale**: Ink's diff-based terminal renderer sometimes doesn't clear trailing characters when a line gets shorter (e.g., status changes from `[running]` to `[done]`). Explicit trailing spaces overwrite leftover characters.

### 5. App Navigation: Global ↔ Session

**Decision**: The Ink `App` component manages a `currentSessionId` state. Setting it to null renders GlobalMonitor; setting it to an ID renders SessionMonitor.

**Navigation flow**:
```
┌─────────────────┐  select session  ┌──────────────────┐
│  GlobalMonitor   │ ──────────────→ │  SessionMonitor   │
│  (session list)  │ ←────────────── │  (single session) │
└─────────────────┘   Escape (back)  └──────────────────┘
        │                                      │
        │ q (quit)                             │ q (quit)
        ▼                                      ▼
      Exit                                   Exit
```

**Key separation**:
- `q` → quit the app entirely (`onQuit` callback → `useApp().exit()`)
- `Escape` → navigate back (`onExit` callback → set `currentSessionId = null`)

**Props**:
- `SessionMonitor` receives both `onExit` (Escape → go back) and `onQuit` (q → exit)
- `GlobalMonitor` receives `onQuit` (q → exit) and `onSessionSelect` (Enter → open session)

### 6. Content-Aware Scroll Limits

**Decision**: `useScroll` hook accepts `setMaxScroll(panel, maxOffset)` via a ref. `scrollDown` clamps to the max. Default fallback is 50 lines (was 500).

**Rationale**: Prevents infinite scrolling past content boundaries. Tree panels use cursor nav (naturally bounded by flatNodes), but non-tree panels (logs, widgets, LLM activity) need explicit limits based on their content size.

### 7. Execution Log Fixed Height

**Decision**: In descriptor mode, the execution log panel uses `height: 8` (fixed) instead of `flexGrow`. The middle panels (phases + LLM) use `flexGrow: 1` to fill remaining space.

**Rationale**: The execution log is a secondary panel. Giving it flexible height stole too much space from the primary content (phase progress, LLM calls). 8 rows = 6 visible lines + borders, enough for the 3-5 most recent log entries.

## Files

| File | Role |
|------|------|
| `hooks/useTreeNav.js` | Generic tree cursor + expand state |
| `hooks/useKeyboard.js` | Key dispatch with returns after handlers |
| `hooks/useScroll.js` | Per-panel scroll with max limits |
| `components/WorkflowTree.js` | Execution tree with flatten-then-render |
| `components/PhaseWorkflow.js` | Phases + execution tree children |
| `components/Filesystem.js` | Directory tree with access colors |
| `components/SessionMonitor.js` | Orchestrator: wires treeNav, keyboard, layouts |
| `components/GlobalMonitor.js` | Session list with cursor selection |
| `components/Panel.js` | Reusable panel with cursorInfo prop |
| `App.js` | Root: routes between Global and Session views |
| `theme.js` | Badge, icons, colors, layout constants |

## Consequences

- New session types automatically get tree navigation (generic infrastructure)
- Users navigate freely between session list and individual sessions
- Keyboard mapping is consistent and discoverable (? help overlay)
- Legacy blessed mode remains available via `--legacy` flag
