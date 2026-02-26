# Phase 42 — Restructuration maestro-code : Checkpoint

## Status: DONE
**Date**: 2026-02-26

---

## Summary

Phase 42 replaced the over-engineered spatial navigation architecture in maestro-code with a clean monitor-based architecture + AgentPanel + TaskInputBar. The visual gate (Phase 43) was used to verify the restructuration and a keyboard conflict bug was discovered and fixed.

---

## What Was Done

### Restructuration (Steps 1-7)
- Copied 25+ components from maestro-monitor into maestro-code (independent copies)
- Created AgentPanel (conversation log + state badge)
- Created TaskInputBar (text input with cursor, history, submit)
- Rewrote App.ts (~530 lines, down from ~854) with monitor-style navigation
- Added SessionMonitor integration with AgentPanel in execution layout
- Deleted ~40 files / ~4000 lines of spatial nav code (registry/, pages/, screens/, mascotte, spatial status bar, command palette, etc.)
- Updated package.json: removed @maestro/monitor dependency

### Keyboard Fix (Phase 42 Verification Sub-phase A)
- **Bug**: Ink's `useInput` fires for ALL mounted hooks simultaneously. Navigation keys (h/s/f/c/m) were captured by both page useKeyboard AND TaskInputBar's useInput, typing garbage into the input bar.
- **Fix**: Slash-to-focus model using Ink's `useInput({ isActive })` option:
  - Default: `captureInput=false` — keys go to page navigation
  - Press `/` → `captureInput=true` — keys go to TaskInputBar
  - Press `Escape` → back to navigation mode
  - Submit (Enter) → auto-unfocus back to navigation
- **Visual indicator**: Unfocused shows `/ Press / to type...` with gray border; focused shows `> Describe your task...` with cyan border

### Visual Gate Enrichment (Phase 42 Verification Sub-phase B)
- Added positional constraints: NavBar maxLine:3, TaskInputBar minLine:33, StatusBar minLine:37
- Added page-specific content assertions:
  - HOME: QUICK ACTIONS, session data (Cantante/sess-)
  - SPACES: tab selector, SESSIONS panel, filter controls, session count (5)
  - FOUNDRY: MY BLOCKS, block count (12), type summary
  - CATALOG: BLOCK CATALOG, type filter tabs, fitness percentages
  - MODELS: MODEL STATUS, AVAILABLE MODELS, claude model, model count (6)
- Added keyboard regression test (detects the old `> hs`, `> hsfc` pattern)

---

## Files Modified (Phase 42 Verification)

| File | Change |
|------|--------|
| `hooks/useKeyboard.ts` | Added `options?: { isActive?: boolean }` parameter |
| `components/TaskInputBar.ts` | Added `captureInput?: boolean` prop, `isActive` on useInput, focus visual indicator |
| `App.ts` | Added `inputFocused` state, `/`→focus `Escape`→unfocus useInput, wired `keyboardActive` to pages and `captureInput` to TaskInputBar |
| `components/AgentScreen.ts` | Added `keyboardActive` prop, passed to useKeyboard |
| `components/HomeScreen.ts` | Added `keyboardActive` prop, passed to useKeyboard |
| `components/SpacesScreen.ts` | Added `keyboardActive` prop, passed to useKeyboard |
| `components/FoundryScreen.ts` | Added `keyboardActive` prop, passed to useKeyboard |
| `components/CatalogScreen.ts` | Added `keyboardActive` prop, passed to useKeyboard |
| `components/ModelsScreen.ts` | Added `keyboardActive` prop, passed to useKeyboard |
| `tests/TaskInputBar.test.ts` | Updated for captureInput: 14 tests (was 11) |
| `tests/App.test.ts` | Updated for unfocused prompt: 21 tests (was 20) |
| `tests/real-demo-check.cjs` | Updated TaskInputBar visibility check for `Press / to type` |
| `tests/visual-gate.test.ts` | Enriched assertions: positional, page content, keyboard regression |
| `testdata/*.golden` | Regenerated: 7 files, all clean (no keyboard garbage) |

---

## Test Results

### Baseline Tests (`npm run test:fast`)
```
Test Files: 4 passed (4)
Tests: 58 passed (58)
  - App.test.ts: 21 tests
  - DemoApiClient.test.ts: 16 tests
  - TaskInputBar.test.ts: 14 tests
  - AgentPanel.test.ts: 7 tests
```

### Visual Gate Tests (`npm run test:visual`)
```
Test Files: 2 passed (2)
Tests: 4 passed (4)
  - smoke-capture.test.ts: 1 test (captures 40 non-empty lines)
  - visual-gate.test.ts: 3 tests
    - Agent page structure + conversation content
    - Page navigation (h/s/f/c/m) with enriched assertions
    - Golden file comparison (soft gate)
Duration: ~39s
```

### real-demo-check.cjs
```
PASS TaskInputBar visible
PASS Demo mode active
PASS No uncaught Error
PASS Module resolution works
```

### Phase 42 Completion Criteria
- [x] Monitor copied into maestro-code (independent files)
- [x] AgentPanel displays conversation in layout
- [x] TaskInputBar allows task submission
- [x] Task submit creates session and navigates to SessionMonitor
- [x] Navigation works (h/s/f/c/m, Tab, scroll)
- [x] Demo mode works (--demo)
- [x] No references to @maestro/monitor in maestro-code
- [x] No references to spatial nav (useSpatialNav, PageRegistry, Mascotte)
- [x] All tests pass (58 baseline + 4 visual gate = 62)
- [x] real-demo-check.cjs passes (4/4)
- [x] Keyboard conflict fixed (slash-to-focus model)
- [x] Golden files clean (no keyboard garbage)

---

## Architecture After Phase 42

```
App.ts (~530 lines)
├── State: currentPage, detailView, navStack, inputFocused
├── State: lines[], busy, agentState, currentSessionId
├── Focus: useInput for / → focus, Escape → unfocus
│
├── Page mode (no detailView):
│   ├── NavBar (MAESTRO, page tabs)
│   ├── PageComponent (Agent/Home/Spaces/Foundry/Catalog/Models)
│   │   └── useKeyboard({ isActive: keyboardActive })
│   ├── TaskInputBar({ captureInput: inputFocused })
│   └── StatusBar
│
└── Detail mode:
    ├── SessionMonitor (with agentLines, agentState)
    ├── TaskInputBar({ captureInput: inputFocused })
    └── StatusBar
```
