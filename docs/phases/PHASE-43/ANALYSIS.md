# Phase 43 — TUI Solidification: Seeing, Testing, Bulletproofing

## Executive Summary

**The core problem**: We build TUI components that we cannot see. Tests pass, but the UI is broken. The scroll doesn't work because keyboard events are captured by the text input. Content overflows panel boundaries. Navigation glitches. And the agent (Claude) reports "all good" because vitest says so.

This phase addresses the root cause: **there is no way for an AI agent (or automated system) to actually see what the TUI renders in a real terminal**. Without this, every TUI change is a gamble.

---

## 1. Root Cause Analysis

### 1.1 The Scroll Bug — A Case Study

The conversation scroll in AgentScreen was implemented with `j`/`k` keys bound via `useKeyboard`. The code is correct. The Panel supports `scrollOffset`. The ConversationLog renders all lines.

**Why it doesn't work**: TaskInputBar has its own `useInput` hook that captures ALL character input (line 59 of TaskInputBar.ts):

```typescript
} else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
  v = v.slice(0, c) + input + v.slice(c);  // Types 'j' or 'k' into the input
}
```

When the user presses `k`:
1. TaskInputBar's `useInput` fires → types 'k' into the text field
2. AgentScreen's `useKeyboard` fires → calls `scrollUp()`
3. **Both execute** — the user sees 'k' appear in the input AND the scroll shifts

Ink has no `event.stopPropagation()`. ALL active `useInput` hooks fire on every keystroke. The scroll "works" in code but is invisible because the input field steals the character.

### 1.2 The Systemic Problem: No Focus Management

A full audit of `useInput`/`useKeyboard` hooks reveals:

| Component | Hook | Guard | Conflict? |
|-----------|------|-------|-----------|
| TaskInputBar | `useInput` | `disabled` prop | YES — captures all text chars |
| AgentScreen | `useKeyboard` | `showQuitConfirm` | YES — j/k/g/q all conflict |
| HomeScreen | `useKeyboard` | `showQuitConfirm` | YES — up/down/j/k/enter |
| SpacesScreen | `useKeyboard` | NONE | YES |
| FoundryScreen | `useKeyboard` | NONE | YES |
| CatalogScreen | `useKeyboard` | NONE | YES |
| ModelsScreen | `useKeyboard` | NONE | YES |
| SessionMonitor | `useActionKeyboard` | NONE | YES |
| All Detail views | `useActionKeyboard` | NONE | YES |

**Zero `useFocus` or `useFocusManager`** in the entire codebase. Every keyboard hook always fires. The architecture assumes only one component handles keys at a time, but App.ts renders TaskInputBar alongside every page — creating permanent conflicts.

### 1.3 The Verification Gap

| What we test | What actually matters |
|-------------|---------------------|
| `lastFrame()` text content | Visual layout, overflow, clipping |
| Component renders without crash | Keyboard events reach the right handler |
| Mock data flows correctly | Real ANSI rendering, colors, borders |
| vitest module resolution | tsx/CJS ESM reparsing in production |

The `real-demo-check.cjs` script bridges ONE gap (module resolution). But it captures frames as text strings — it cannot validate layout, overflow, or keyboard behavior.

---

## 2. Three Pillars of the Solution

### Pillar 1: Component Architecture — Make Bugs Impossible

### Pillar 2: Visual Capture — Let Agents See

### Pillar 3: Automated Validation — Agent-Driven QA

---

## 3. Pillar 1: Component Architecture

### 3.1 Focus Management System

**Problem**: Ink's `useInput` broadcasts to all hooks. We need explicit focus gating.

**Solution**: A `FocusContext` that every keyboard hook respects.

```typescript
// hooks/useFocusLayer.ts
type FocusLayer = 'input' | 'page' | 'panel' | 'modal';

const FocusContext = createContext<{
  activeLayer: FocusLayer;
  setLayer: (layer: FocusLayer) => void;
}>();

// In useKeyboard:
const useKeyboard = (handlers, layer: FocusLayer = 'page') => {
  const { activeLayer } = useContext(FocusContext);
  useInput((input, key) => {
    if (activeLayer !== layer) return;  // <-- GATED
    // ... process keys
  });
};
```

**Layer priority** (highest wins):
1. `modal` — quit confirmation, help overlay
2. `input` — TaskInputBar when focused (typing text)
3. `panel` — focused panel in SessionMonitor (scroll, tree nav)
4. `page` — page-level hotkeys (h/a/s/f/c/m, Ctrl+arrows)

**When TaskInputBar has focus** (layer = 'input'):
- j/k/g/q are typed into the input, NOT processed as page hotkeys
- Ctrl+Up/Down could still scroll (Ctrl combos bypass input layer)
- Esc switches focus back to `page` layer

**When user is on Agent page without typing** (layer = 'page'):
- j/k scroll the conversation
- g goes to session
- q triggers quit confirm

This solves the scroll bug AND prevents all future keyboard conflicts.

### 3.2 Atomic Component Contract

Every shared component MUST implement a `ComponentContract` interface:

```typescript
interface ComponentContract {
  // Identity
  readonly displayName: string;

  // Introspection — what does this component render?
  describe(): ComponentDescription;
}

interface ComponentDescription {
  type: 'panel' | 'list' | 'input' | 'status' | 'layout';
  contentLines: number;        // How many lines of content
  visibleLines: number;        // How many lines actually visible
  overflow: boolean;           // Does content exceed visible area?
  scrollable: boolean;         // Can user scroll?
  scrollPosition?: {           // Current scroll state
    offset: number;
    total: number;
    visible: number;
  };
  focusable: boolean;          // Can receive focus?
  focused: boolean;            // Currently focused?
  children?: ComponentDescription[];
}
```

This isn't a React class hierarchy — it's a **diagnostic interface** exposed via a ref or context. Each component can report its state, which enables:
- Automated validation: "Is the CONVERSATION panel overflowing? Yes? Bug."
- Agent introspection: "What's the scroll position? 0/50 lines visible out of 200."
- Test assertions: `expect(panel.describe().overflow).toBe(false)`

### 3.3 Panel as the Universal Container

The Panel component already has `scrollOffset`, `showScroll`, `canScrollUp`, `canScrollDown`. But these are passed as DUMB props — the Panel doesn't manage its own scroll state.

**Upgraded Panel**:
```typescript
const Panel = ({ title, scrollable, focusLayer, children, ...props }) => {
  const { activeLayer } = useFocusContext();
  const isFocused = activeLayer === focusLayer;
  const [scrollOffset, setScrollOffset] = useState(0);
  const contentRef = useRef<{ lineCount: number }>({ lineCount: 0 });

  // Self-managed scroll when focused
  useInput((input, key) => {
    if (!scrollable || !isFocused) return;
    if (key.upArrow || input === 'k') setScrollOffset(s => Math.min(s + 3, maxScroll));
    if (key.downArrow || input === 'j') setScrollOffset(s => Math.max(0, s - 3));
  }, { isActive: isFocused && scrollable });

  // Report state
  const description = {
    type: 'panel',
    contentLines: contentRef.current.lineCount,
    visibleLines: computedHeight,
    overflow: contentRef.current.lineCount > computedHeight,
    scrollable,
    scrollPosition: { offset: scrollOffset, total: contentRef.current.lineCount, visible: computedHeight },
    focusable: !!focusLayer,
    focused: isFocused,
  };

  return h(Box, { ... }, children);
};
```

**Key change**: Panel manages its OWN scroll. No more external `scrollOffset` state in page components. The parent just says `scrollable={true}` and the Panel handles everything — including keyboard, indicators, and bounds clamping.

### 3.4 ConversationLog Fix

ConversationLog should NOT slice lines — the Panel handles visibility via overflow:hidden. ConversationLog renders ALL lines, Panel clips.

```typescript
// BEFORE (broken with scroll):
const visible = lines.slice(-maxVisible);

// AFTER (Panel handles scroll):
// Render ALL lines. Panel's overflow:hidden + scrollOffset handles visibility.
return h(Box, { flexDirection: 'column', paddingX: 1 },
  ...lines.map((line, i) => renderLine(line, i)),
  lines.length === 0 ? placeholder : null,
);
```

### 3.5 Component Isolation Tests

Each component gets a standalone test that verifies:
1. **Renders without crash** (existing)
2. **Reports correct description** (new)
3. **Respects focus layer** (new)
4. **Scroll bounds are correct** (new for scrollable panels)
5. **No overflow when content fits** (new)

```typescript
describe('Panel scroll', () => {
  it('does not scroll when content fits', () => {
    const { lastFrame } = render(h(Panel, { scrollable: true, height: 10 },
      h(Text, null, 'Line 1'),
      h(Text, null, 'Line 2'),
    ));
    // No scroll indicators should appear
    expect(stripAnsi(lastFrame())).not.toContain('▲');
    expect(stripAnsi(lastFrame())).not.toContain('▼');
  });

  it('shows scroll indicators when content overflows', () => {
    const lines = Array.from({ length: 50 }, (_, i) => h(Text, { key: i }, `Line ${i}`));
    const { lastFrame } = render(h(Panel, { scrollable: true, height: 10 }, ...lines));
    expect(stripAnsi(lastFrame())).toContain('▼');
  });
});
```

---

## 4. Pillar 2: Visual Capture — Let Agents See

### 4.1 The Capture Pipeline

```
node-pty (spawns TUI in real PTY)
    ↓ raw ANSI output
@xterm/headless (interprets ANSI → positioned text buffer)
    ↓ text lines[0..rows-1]
Frame capture (text snapshot per timestamp)
    ↓
Golden file comparison OR LLM analysis
```

**Dependencies**:
- `node-pty` — native PTY fork (Windows ConPTY, Linux/Mac pty)
- `@xterm/headless` — headless xterm.js, no DOM
- `@xterm/addon-serialize` — serialize terminal buffer to text

### 4.2 Frame Capture Tool

```typescript
// packages/maestro-code/tests/frame-capture.ts

import * as pty from 'node-pty';
import { Terminal } from '@xterm/headless';
import { SerializeAddon } from '@xterm/addon-serialize';

interface CaptureOptions {
  cols?: number;
  rows?: number;
  waitMs?: number;
  cwd?: string;
}

interface Frame {
  lines: string[];          // Each row as plain text
  text: string;             // All rows joined with \n
  timestamp: number;        // ms since start
}

async function captureFrame(
  command: string,
  args: string[],
  options: CaptureOptions = {}
): Promise<Frame> {
  const { cols = 120, rows = 40, waitMs = 3000, cwd } = options;

  const proc = pty.spawn(command, args, {
    name: 'xterm-256color',
    cols, rows,
    cwd: cwd || process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const term = new Terminal({ cols, rows });
  const serializer = new SerializeAddon();
  term.loadAddon(serializer);

  proc.onData(data => term.write(data));

  await new Promise(r => setTimeout(r, waitMs));

  const lines: string[] = [];
  const buffer = term.buffer.active;
  for (let i = 0; i < rows; i++) {
    const line = buffer.getLine(i);
    lines.push(line?.translateToString(true) || '');
  }

  proc.kill();
  term.dispose();

  return { lines, text: lines.join('\n'), timestamp: waitMs };
}

async function captureSequence(
  command: string,
  args: string[],
  keystrokes: Array<{ key: string; waitMs: number }>,
  options: CaptureOptions = {}
): Promise<Frame[]> {
  const { cols = 120, rows = 40, cwd } = options;
  const frames: Frame[] = [];
  let elapsed = 0;

  const proc = pty.spawn(command, args, {
    name: 'xterm-256color',
    cols, rows,
    cwd: cwd || process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const term = new Terminal({ cols, rows });
  const serializer = new SerializeAddon();
  term.loadAddon(serializer);

  proc.onData(data => term.write(data));

  // Initial frame
  await new Promise(r => setTimeout(r, 2000));
  elapsed += 2000;
  frames.push(captureCurrentFrame(term, rows, elapsed));

  // Execute keystrokes and capture after each
  for (const { key, waitMs } of keystrokes) {
    proc.write(key);
    await new Promise(r => setTimeout(r, waitMs));
    elapsed += waitMs;
    frames.push(captureCurrentFrame(term, rows, elapsed));
  }

  proc.kill();
  term.dispose();
  return frames;
}

function captureCurrentFrame(term: Terminal, rows: number, timestamp: number): Frame {
  const lines: string[] = [];
  const buffer = term.buffer.active;
  for (let i = 0; i < rows; i++) {
    const line = buffer.getLine(i);
    lines.push(line?.translateToString(true) || '');
  }
  return { lines, text: lines.join('\n'), timestamp };
}

export { captureFrame, captureSequence };
export type { Frame, CaptureOptions };
```

### 4.3 Golden File Testing

Store expected terminal output as `.golden` files:

```
testdata/
  agent-page-idle.golden        # Agent page with no session
  agent-page-working.golden     # Agent page during task execution
  agent-page-scroll-up.golden   # After pressing K 3 times
  home-page.golden              # Home page
  session-detail.golden         # SessionMonitor detail view
```

Compare with tolerance for timestamps and animation frames:

```typescript
function compareFrames(actual: string, golden: string): { match: boolean; diffs: string[] } {
  const actualLines = actual.split('\n');
  const goldenLines = golden.split('\n');
  const diffs: string[] = [];

  for (let i = 0; i < Math.max(actualLines.length, goldenLines.length); i++) {
    const a = normalizeTimestamps(actualLines[i] || '');
    const g = normalizeTimestamps(goldenLines[i] || '');
    if (a !== g) {
      diffs.push(`Line ${i}: expected "${g}" got "${a}"`);
    }
  }

  return { match: diffs.length === 0, diffs };
}

function normalizeTimestamps(line: string): string {
  return line.replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS');
}
```

### 4.4 Visual Regression Test Suite

```typescript
// tests/visual-regression.test.ts

describe('Visual Regression', () => {
  it('Agent page renders correctly at 120x40', async () => {
    const frame = await captureFrame('node', ['../../packages/maestro-cli/index.js', 'code', '--demo'], {
      cols: 120, rows: 40, waitMs: 3000,
    });

    // Structural assertions (not pixel-perfect)
    expect(frame.text).toContain('AGENT STATUS');
    expect(frame.text).toContain('CONVERSATION');
    expect(frame.text).toContain('ACTIONS');

    // Layout assertions: ACTIONS panel should be on the right
    const actionsLine = frame.lines.find(l => l.includes('ACTIONS'));
    expect(actionsLine?.indexOf('ACTIONS')).toBeGreaterThan(80);

    // No content overflow: check that panel borders are intact
    const borderLines = frame.lines.filter(l => l.includes('┌') || l.includes('└'));
    expect(borderLines.length).toBeGreaterThanOrEqual(4);

    // Golden file comparison (optional, regenerate with --update)
    await expectMatchGolden('agent-page-idle', frame.text);
  });

  it('Scroll works: pressing K shifts content', async () => {
    const frames = await captureSequence(
      'node', ['../../packages/maestro-cli/index.js', 'code', '--demo'],
      [
        { key: 'k', waitMs: 500 },  // Scroll up
        { key: 'k', waitMs: 500 },  // Scroll up again
        { key: 'j', waitMs: 500 },  // Scroll back down
      ],
      { cols: 120, rows: 40 }
    );

    // After K press, content should have shifted
    // The first visible line in frame[1] should be different from frame[0]
    const conv0 = extractConversationLines(frames[0]);
    const conv1 = extractConversationLines(frames[1]);

    // If scroll worked, the visible content changed
    expect(conv0).not.toEqual(conv1);
  });

  it('TaskInputBar does not steal page hotkeys when unfocused', async () => {
    const frames = await captureSequence(
      'node', ['../../packages/maestro-cli/index.js', 'code', '--demo'],
      [
        { key: 'h', waitMs: 1000 },  // Should navigate to Home
      ],
      { cols: 120, rows: 40 }
    );

    // After pressing 'h', should be on Home page (not typing 'h' in input)
    expect(frames[1].text).toContain('SYSTEM STATUS');
    expect(frames[1].text).toContain('ACTIVE SESSIONS');
  });
});
```

### 4.5 `maestro-code inspect` Command

A diagnostic CLI command that dumps the component tree with scroll/focus state:

```bash
$ node index.js code --demo --inspect

Component Tree:
  FullscreenBox (120x40)
  ├─ AgentScreen (120x36)
  │  ├─ NavBar (120x1) [Home] [*Agent*] [Spaces] [Foundry] [Catalog] [Models]
  │  ├─ Panel "AGENT STATUS" (120x3) overflow:false
  │  │  └─ AgentStatus: idle, session:null
  │  ├─ Panel "CONVERSATION" (95x28) overflow:true scroll:0/47 focused:false
  │  │  └─ ConversationLog: 47 lines
  │  └─ Panel "ACTIONS" (25x28) overflow:false
  │     └─ AgentActions: 5 shortcuts
  ├─ TaskInputBar (120x3) focused:true layer:input
  └─ StatusBar (120x3) connected
```

This would let an agent read the component state programmatically and validate it.

---

## 5. Pillar 3: Automated Validation — The TUI QA Agent

### 5.1 Agent Architecture

A Maestro block (agent) that validates TUI components:

```json
{
  "id": "tui-qa-agent",
  "type": "agent",
  "metadata": {
    "designation": "agent",
    "description": "Validates TUI component rendering, keyboard behavior, and layout correctness"
  },
  "config": {
    "nodes": [
      { "blockRef": "tui-capture",     "id": "capture" },
      { "blockRef": "tui-analyze",     "id": "analyze" },
      { "blockRef": "tui-validate",    "id": "validate" },
      { "blockRef": "tui-report",      "id": "report" }
    ]
  }
}
```

### 5.2 Validation Steps

1. **Capture**: Launch the TUI in a PTY, capture frames at key moments
2. **Analyze**: Parse frames to extract:
   - Panel boundaries (border chars: ┌┐└┘│─)
   - Content within each panel
   - Overflow detection (text beyond panel borders)
   - Focus indicators (double borders, highlighted titles)
3. **Validate**: Compare against rules:
   - No content outside panel boundaries
   - Scroll indicators present when content overflows
   - Keyboard shortcuts produce expected state changes
   - All panels have proper titles
   - No blank/empty panels when data is available
4. **Report**: Generate pass/fail with screenshots of failures

### 5.3 Validation Rules (Machine-Checkable)

```typescript
interface ValidationRule {
  id: string;
  description: string;
  check: (frame: Frame) => { pass: boolean; detail: string };
}

const RULES: ValidationRule[] = [
  {
    id: 'no-overflow',
    description: 'No text content extends beyond panel borders',
    check: (frame) => {
      const panels = extractPanels(frame);
      for (const panel of panels) {
        for (const line of panel.contentLines) {
          if (line.length > panel.innerWidth) {
            return { pass: false, detail: `Panel "${panel.title}": line overflows by ${line.length - panel.innerWidth} chars` };
          }
        }
      }
      return { pass: true, detail: 'OK' };
    }
  },
  {
    id: 'scroll-indicators',
    description: 'Scrollable panels with overflow show scroll indicators',
    check: (frame) => {
      const panels = extractPanels(frame);
      for (const panel of panels) {
        if (panel.contentLineCount > panel.visibleLineCount) {
          if (!panel.hasScrollUp && !panel.hasScrollDown) {
            return { pass: false, detail: `Panel "${panel.title}": ${panel.contentLineCount} lines but no scroll indicators` };
          }
        }
      }
      return { pass: true, detail: 'OK' };
    }
  },
  {
    id: 'borders-intact',
    description: 'All panel borders are complete (no gaps)',
    check: (frame) => {
      // Check that ┌ has matching ┐ on same line, └ has matching ┘
      // Check vertical │ continuity between top and bottom borders
      // ...
    }
  },
  {
    id: 'keyboard-isolation',
    description: 'Pressing a key only triggers handlers in the active focus layer',
    check: (frames) => {
      // Compare frames before and after keystroke
      // Verify only expected regions changed
      // ...
    }
  },
];
```

### 5.4 Integration with CI

```yaml
# .github/workflows/tui-visual.yml
jobs:
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run tests/visual-regression.test.ts
      - run: node tests/validate-frames.js
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: tui-failure-frames
          path: testdata/failures/
```

---

## 6. Implementation Plan

### Phase 43-PRE: IToolDispatcher + Permission Enforcement (backend C#, ~3 jours)

**NOTE**: Ce pre-requis est documente en detail dans `docs/phases/PHASE-44/ISOLATION-ANALYSIS.md`.

Le `AgentBlockExecutor` contient un "direct block dispatch" qui contourne le CLI et ses
verifications de permissions. C'est une violation de CLI-First, de "l'agent est une boite
noire", et ca rend les permissions de session inutiles.

La correction:
1. Creer `IToolDispatcher` — interface typee (JSON natif) pour le dispatch de tools
2. `ToolDispatcher` — normalise, verifie permissions, resout block, execute
3. Migrer `AgentBlockExecutor` → utilise `IToolDispatcher` au lieu du dispatch interne
4. Supprimer `ExecuteViaBlockDispatchAsync()` et `ExecuteViaCliAsync()` (un seul chemin)
5. N'importe quel block type peut utiliser `IToolDispatcher` (pas juste l'agent)

### Phase 43-A: Focus Management (fixes scroll bug + all keyboard conflicts)

1. Create `FocusContext` with layer system (`input`/`page`/`panel`/`modal`)
2. Update `useKeyboard` to respect focus layer
3. Update `useActionKeyboard` to add `isActive` parameter
4. Update TaskInputBar: sets layer to `input` when focused, `page` on Esc
5. Update all page screens: bind to `page` layer
6. Update SessionMonitor: bind panel actions to `panel` layer
7. **Fix the scroll bug**: `k`/`j` only scroll when layer is `page`
8. Tests: verify keyboard isolation

### Phase 43-B: Component Diagnostic Interface

1. Create `ComponentDescription` type
2. Add `describe()` to Panel (report overflow, scroll, focus)
3. Add `describe()` to ConversationLog (report line count, visible count)
4. Add `describe()` to NavBar (report current page)
5. Add `--inspect` flag to `maestro code` that dumps component tree
6. Tests: verify descriptions match actual state

### Phase 43-C: Frame Capture Pipeline

1. Install `node-pty`, `@xterm/headless`, `@xterm/addon-serialize`
2. Create `tests/frame-capture.ts` utility
3. Create `captureFrame()` and `captureSequence()` functions
4. Create initial golden files for all pages
5. Create `tests/visual-regression.test.ts`
6. Validate: captured frames match real terminal output

### Phase 43-D: Validation Rules Engine

1. Create `ValidationRule` interface and rule library
2. Implement panel extraction from text frames
3. Implement overflow detection
4. Implement border integrity check
5. Implement keyboard isolation test
6. Create `tests/validate-frames.js` runner
7. Integrate with existing test suite

### Phase 43-E: TUI QA Agent Block (Future)

1. Define `tui-qa-agent.block.json`
2. Implement capture block
3. Implement analyze block (frame → structured data)
4. Implement validate block (structured data → pass/fail)
5. Implement report block (generate failure report with frames)
6. Foundry session: train agent on known good/bad frames
7. Publish when fitness meets threshold

---

## 7. Immediate Fixes (Before Full Phase)

These can be done RIGHT NOW to unblock the user:

### Fix 1: Scroll with Ctrl+Up/Ctrl+Down instead of j/k

Since TaskInputBar captures regular chars, use Ctrl combos for scroll:

```typescript
// AgentScreen.ts
useKeyboard(showQuitConfirm ? {} : {
  ctrlUp: scrollUp,      // Ctrl+Up = scroll conversation up
  ctrlDown: scrollDown,   // Ctrl+Down = scroll conversation down
  // ... page hotkeys
});
```

Ctrl combos are NOT captured by TaskInputBar (it checks `!key.ctrl`).

### Fix 2: Focus Toggle with Esc

- Esc when in TaskInputBar → switch to `page` layer (j/k scroll, q quits)
- Enter/any char when TaskInputBar is empty → switch back to `input` layer
- Visual indicator: TaskInputBar border changes color based on focus

### Fix 3: Page Hotkeys Only When Input is Empty

```typescript
// In AgentScreen useKeyboard:
const inputEmpty = /* shared state from TaskInputBar */;
useKeyboard(showQuitConfirm || !inputEmpty ? {} : {
  // Only bind page hotkeys when input is empty
  h: () => onNavigate('home'),
  // ...
});
```

---

## 8. Dependencies and Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| `node-pty` | Native addon, build complexity | Already works on Windows (ConPTY) |
| `@xterm/headless` | Large dependency | Dev-only, not shipped |
| Focus refactor | Breaks existing keyboard behavior | Incremental: fix Ctrl combos first |
| Golden files | Brittle (any layout change = regenerate) | Use structural assertions, not pixel-exact |
| Windows ConPTY | ANSI quirks on Windows | Test on both Windows and CI (Linux) |

---

## 9. Success Criteria

- [ ] **Scroll works in CONVERSATION panel** — user can press keys to scroll up/down
- [ ] **No keyboard conflicts** — typing in TaskInputBar does NOT trigger page navigation
- [ ] **No content overflow** — all text stays within panel borders
- [ ] **Frame capture works** — `captureFrame()` produces readable terminal snapshot
- [ ] **Golden file tests pass** — at least 5 golden files for key screens
- [ ] **Agent can validate** — `validate-frames.js` catches overflow/border/scroll bugs
- [ ] **All existing 62 tests still pass**
- [ ] **`real-demo-check.cjs` still passes**

---

## 10. Conclusion

The fundamental issue is not bad code — it's blind code. We write components we cannot see, test behaviors we cannot observe, and declare victory based on string matching. Phase 43 installs eyes: a capture pipeline that shows what the terminal actually renders, a focus system that prevents keyboard chaos, and validation rules that catch visual bugs automatically.

The TUI QA agent (Phase 43-E) is the long-term vision: a Maestro block that monitors its own UI, catches regressions, and reports them before a human ever sees a broken screen. But even without the agent, the capture pipeline and focus management will eliminate 90% of the bugs we've been fighting.
