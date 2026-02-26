# Phase 43 — Visual Gate : Checkpoint

## Status: DONE
**Date**: 2026-02-26

---

## 43-A: Frame Capture Infrastructure
**Status**: DONE

- **node-pty installed**: yes (^1.0.0, ConPTY on Windows)
- **@xterm/headless installed**: yes (^5.5.0)
- **Smoke test**: PASSES — captures 40 non-empty lines from demo mode
- **Capture time per frame**: ~5000ms (includes ConPTY startup + React mount + Ink render)
- **Frame content**: NavBar with MAESTRO, page panels with box-drawing borders, TaskInputBar

### Files Created
| File | Lines | Purpose |
|------|-------|---------|
| `packages/maestro-code/tests/frame-capture.ts` | ~215 | PTY capture utility: captureFrame, captureSequence, normalizeFrame |
| `packages/maestro-code/tests/smoke-capture.test.ts` | ~25 | Smoke test: PTY pipeline works, captures content |

### Key Design Decisions
- **Polling-based capture**: polls every 500ms until box-drawing chars detected (min 2s), then 1s settle
- **Retry-on-empty after keystrokes**: if buffer is empty after a keystroke, retry 3x at 500ms intervals
- **ConPTY warmup**: first PTY spawn is always slow; beforeAll warmup + 2s post-warmup pause

---

## 43-B: Golden Files + Structural Assertions
**Status**: DONE

- **Golden files**: 7 files in `packages/maestro-code/testdata/` (39 lines each)
- **Structural tests**: 3 tests, all pass
- **Navigation**: all 6 pages accessible via hotkeys (h/a/s/f/c/m)
- **Golden comparison**: soft gate (warns, doesn't fail)
- **Baseline tests**: 54 pass (unchanged from pre-43)
- **real-demo-check.cjs**: 4/4 checks pass
- **Total visual gate time**: ~39s (warmup 7s + 3 tests ~32s)

### Files Created
| File | Lines | Purpose |
|------|-------|---------|
| `packages/maestro-code/tests/golden-utils.ts` | ~110 | readGolden, writeGolden, compareGolden, checkStructure |
| `packages/maestro-code/tests/visual-gate.test.ts` | ~200 | 3 visual gate tests: structure, navigation, golden comparison |
| `packages/maestro-code/tests/update-golden.ts` | ~54 | Script to regenerate golden files |
| `packages/maestro-code/testdata/*.golden` | 7 files | Golden reference files for all pages |

### Files Modified
| File | Change |
|------|--------|
| `packages/maestro-code/package.json` | devDependencies (node-pty, @xterm/headless), scripts (test:visual, test:fast) |
| `packages/maestro-code/vitest.config.ts` | Updated comments |

---

## Test Results

### Visual Gate (`npm run test:visual`)
```
✓ smoke-capture.test.ts (1 test)
  ✓ captures a non-empty frame from demo mode

✓ visual-gate.test.ts (3 tests)
  ✓ has correct structure and conversation content
  ✓ navigates through all pages: h, s, f, c, m
  ✓ agent page matches golden file (warning only)

Test Files: 2 passed (2)
Tests: 4 passed (4)
Duration: ~39s
```

### Baseline Tests (`npm run test:fast`)
```
✓ App.test.ts (20 tests)
✓ DemoApiClient.test.ts (16 tests)
✓ AgentPanel.test.ts (7 tests)
✓ TaskInputBar.test.ts (11 tests)
Total: 54 passed (54) — unchanged from pre-43
```

### real-demo-check.cjs
```
PASS TaskInputBar visible
PASS Demo mode active
PASS No uncaught Error
PASS Module resolution works
```

---

## Issues Encountered & Resolved

1. **ConPTY cold start**: First PTY spawn on Windows always slow (~5s). Solved with warmup in beforeAll + 2s post-warmup pause.
2. **Empty frames after navigation**: PTY buffer sometimes empty during page transition. Solved with retry-on-empty (3 retries at 500ms intervals).
3. **Flaky page captures**: Random pages showing 0 lines with short wait times. Solved by increasing per-keystroke wait to 3000ms and initial wait to 8000ms.
4. **`AttachConsole failed` errors**: node-pty ConPTY cleanup noise on `proc.kill()`. Non-fatal, expected on Windows.
5. **TaskInputBar captures all keystrokes**: Both TaskInputBar's useInput and page useKeyboard fire on the same input. Navigation still works but characters also get typed into the input bar. Known UX bug (not blocking for visual gate).

## Known Limitations

- Visual gate tests take ~39s total (PTY startup is the bottleneck)
- Golden file comparison is soft (warns, doesn't fail) — by design
- `AttachConsole failed` stderr noise on every PTY kill (node-pty Windows issue)
- TaskInputBar + page keyboard conflict: pressing navigation keys also types into input bar
