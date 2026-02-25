# Maestro Code TUI — Complete Design Document

> **Phase 41-PRE** | Design Document v2 | 2026-02-25
>
> Style: **Nintendo Gameboy + Flipper Zero + Claude Code**
> Principle: **One full-screen page at a time. Navigate spatially. The agent lives here.**
>
> This document defines the COMPLETE feature set for the first deployable version.
> Every feature from the monitor is preserved. New features are added.
> Nothing is lost, everything is gained.

---

## Table of Contents

1. [Core Concept: The Compass](#1-core-concept-the-compass)
2. [The Agent Page (CENTER)](#2-the-agent-page-center--home)
3. [The Execution Page (UP)](#3-the-execution-page-up)
4. [The Spaces Page (RIGHT)](#4-the-spaces-page-right)
5. [The Catalog Page (LEFT)](#5-the-catalog-page-left)
6. [The Models Page (DOWN)](#6-the-models-page-down)
7. [Agent-in-the-Cockpit System](#7-agent-in-the-cockpit-system)
8. [Detail Screens](#8-detail-screens)
9. [Navigation & Keyboard Reference](#9-navigation--keyboard-reference)
10. [The Mascotte](#10-the-mascotte)
11. [StatusBar & Notifications](#11-statusbar--notifications)
12. [Command Palette](#12-command-palette)
13. [Help Overlay](#13-help-overlay)
14. [Demo Mode](#14-demo-mode)
15. [Headless & Pipe Mode](#15-headless--pipe-mode)
16. [Responsive Design](#16-responsive-design)
17. [Mouse Support](#17-mouse-support)
18. [Sound & Terminal Effects](#18-sound--terminal-effects)
19. [Component Reuse Map](#19-component-reuse-map)
20. [Architecture](#20-architecture)
21. [Full Feature Checklist](#21-full-feature-checklist)

---

## 1. Core Concept: The Spatial Grid & Page Registry

The app is an **infinite spatial grid of full-screen pages**. You're always on ONE page. You navigate to adjacent pages with **Ctrl+Arrow**. Each page occupies 100% of the terminal. Like turning a cube — you see one face at a time.

The **Page Registry** makes the grid extensible: adding a new page = one registration call + one component. No hardcoded navigation tables, no hardcoded direction hints. Everything is computed from the registry.

### 1a. The Grid

Pages live on a 2D coordinate grid. Agent is always at `(0, 0)`. Other pages occupy positions around it.

**Default grid (shipped with v1):**

```
         (-1,-1)          (0,-1)           (1,-1)
        ┌─────────┐    ┌──────────┐    ┌──────────┐
        │         │    │EXECUTION │    │          │
        │  (free) │    │(cockpit) │    │  (free)  │
        │         │    │          │    │          │
        └─────────┘    └────▲─────┘    └──────────┘
                            │
                      Ctrl+Up
                            │
(-1,0)              (0,0)              (1,0)
┌──────────┐    ┌───┴──────┐    ┌──────────┐
│ CATALOG  │◄───│          │───►│  SPACES  │
│(blocks,  │    │  AGENT   │    │  (repos, │
│ foundry) │    │  (home)  │    │  wkspcs, │
└──────────┘    └───┬──────┘    │  sessions│
                    │           └──────────┘
              Ctrl+Down
                    │
         (-1,1)  (0,1)            (1,1)
        ┌─────────┐┌──────────┐ ┌──────────┐
        │         ││  MODELS  │ │          │
        │  (free) ││(providers│ │  (free)  │
        │         ││ health)  │ │          │
        └─────────┘└──────────┘ └──────────┘
```

`(free)` slots are empty — ready for future pages. The grid extends infinitely. Ctrl+Arrow into an empty slot = no-op.

### 1b. The Page Registry

```typescript
interface PageDefinition {
  id: string;                              // Unique identifier
  label: string;                           // Display name ("Execution")
  shortLabel: string;                      // For StatusBar ("Exec")
  icon: string;                            // Status indicator ("↑")
  position: { x: number; y: number };      // Grid coordinates (Agent = 0,0)
  component: ComponentType<PageProps>;      // React component to render
  hotkey?: string;                         // Direct jump (for command palette)
  detailScreens?: DetailScreenDef[];       // Drill-downs this page supports
}

interface PageProps {
  apiClient: any;
  sessionId: string | null;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  height: number;
  width: number;
}
```

**Built-in pages (v1):**

```typescript
const builtInPages: PageDefinition[] = [
  {
    id: 'agent',
    label: 'Agent',
    shortLabel: 'Agent',
    icon: '●',
    position: { x: 0, y: 0 },    // CENTER — always home
    component: AgentPage,
  },
  {
    id: 'execution',
    label: 'Execution',
    shortLabel: 'Exec',
    icon: '↑',
    position: { x: 0, y: -1 },   // UP
    component: ExecutionPage,
  },
  {
    id: 'catalog',
    label: 'Catalog',
    shortLabel: 'Cat',
    icon: '←',
    position: { x: -1, y: 0 },   // LEFT
    component: CatalogPage,
  },
  {
    id: 'spaces',
    label: 'Spaces',
    shortLabel: 'Spc',
    icon: '→',
    position: { x: 1, y: 0 },    // RIGHT
    component: SpacesPage,
  },
  {
    id: 'models',
    label: 'Models',
    shortLabel: 'Mod',
    icon: '↓',
    position: { x: 0, y: 1 },    // DOWN
    component: ModelsPage,
  },
];
```

**Adding a new page later — ONE call:**

```typescript
// Example: adding a Terminal page at position (1, 1) — southeast of Agent
pageRegistry.register({
  id: 'terminal',
  label: 'Terminal',
  shortLabel: 'Term',
  icon: '>_',
  position: { x: 1, y: 1 },
  component: TerminalPage,
});

// Example: adding a Settings page at (-1, -1) — northwest
pageRegistry.register({
  id: 'settings',
  label: 'Settings',
  shortLabel: 'Set',
  icon: '⚙',
  position: { x: -1, y: -1 },
  component: SettingsPage,
});
```

That's it. The StatusBar, Help overlay, Command Palette, and navigation all update automatically.

### 1c. How Navigation is Computed (not hardcoded)

The navigation hook reads the registry and computes adjacency dynamically:

```typescript
function getNeighbor(from: Position, direction: Direction): PageDefinition | null {
  const delta = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
  const target = { x: from.x + delta[direction].x, y: from.y + delta[direction].y };
  return pageRegistry.getAt(target) || null;  // null = empty slot, no-op
}
```

**No navigation table.** No hardcoded "from Catalog, Ctrl+Right = Agent". The grid positions ARE the navigation. If a page exists at the target coordinate, you go there. If not, nothing happens.

**Direction hints in StatusBar** are auto-generated:

```typescript
function getDirectionHints(currentPos: Position): DirectionHint[] {
  return ['up', 'down', 'left', 'right']
    .map(dir => ({ direction: dir, page: getNeighbor(currentPos, dir) }))
    .filter(h => h.page !== null);
}
// Agent (0,0) → [↑Exec, ↓Models, ←Catalog, →Spaces]
// Catalog (-1,0) → [↑(empty), ↓(empty), ←(empty), →Agent]  → shows only [→Agent]
// If Terminal added at (1,1): Models (0,1) → [↑Agent, →Terminal]
```

### 1d. Ring Rotation (Ctrl+Left/Right from non-center pages)

From any page that's not Agent, **Ctrl+Left/Right rotates clockwise/counterclockwise** through pages at the same distance from center (same ring). This is also computed from the registry:

```typescript
// Ring = all pages sorted by angle around (0,0)
function getRing(pages: PageDefinition[]): PageDefinition[] {
  return pages
    .filter(p => p.id !== 'agent')
    .sort((a, b) => Math.atan2(a.position.y, a.position.x) - Math.atan2(b.position.y, b.position.x));
}
```

**Default ring order**: Execution → Spaces → Models → Catalog → (loop)

If more pages are added, they're inserted into the ring by their angle. A page at (1,1) would slot between Spaces and Models.

### 1e. Special Navigation Rules

- **Agent (0,0) is always home** — Esc from anywhere returns here
- **Ctrl+Arrow** moves to the adjacent cell in that direction
- **Empty cell = no-op** (no wrapping, no error — the StatusBar simply doesn't show that direction)
- **Esc** on Agent = no-op (already home)
- **Esc** on detail screen = back to parent page (not to Agent)
- **Ctrl+Tab** = quick-switch between last 2 pages (regardless of position)

### 1f. Why 5 pages in v1 (not 6)?

The monitor had 5 pages: Home, Spaces, Foundry, Catalog, Models. We merge:

| Monitor Page | Maestro Code | Rationale |
|-------------|-------------|-----------|
| **Home** | **Agent (idle state)** | When idle, the Agent page IS the home: system status, mascotte, quick actions. No separate dashboard needed. |
| **Spaces** | **Spaces (RIGHT)** | Repos + Workspaces + Sessions — unchanged, all 3 tabs |
| **Foundry** | **Catalog (LEFT, Foundry tab)** | Foundry is a filter/tab within the unified block browser. "My blocks" vs "All blocks" vs "By type" |
| **Catalog** | **Catalog (LEFT)** | All blocks with type/fitness filtering |
| **Models** | **Models (DOWN)** | LLM providers, health, usage — unchanged |
| *(new)* | **Execution (UP)** | The full SessionMonitor cockpit from the monitor, promoted to a top-level page |

But the grid has room to grow. Future pages (Terminal, Settings, Dashboard, Filesystem, etc.) just register at free coordinates.

### 1g. Transition Effect

When navigating, a 1-frame directional wipe:
```
  ▲ EXECUTION        (sliding up)
  ◄ CATALOG          (sliding left)
  ► SPACES           (sliding right)
  ▼ MODELS           (sliding down)
```

---

## 2. The Agent Page (CENTER / Home)

The heart of the app. A **Claude Code-style conversational interface** with a pixel art mascotte. This is where you talk to the agent, give tasks, and watch work happen.

### 2a. Idle State (no active session) — "The Home Screen"

When idle, the Agent page doubles as the Home screen. System status is visible, the mascotte is centered and large, quick actions are available.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                       System: ● Backend  ● LLM Provider                     │
│                                                                              │
│                           ╔══════════════════════╗                           │
│                           ║   ┌──────────────┐   ║                           │
│                           ║   │  ◉  ┃┃┃  ◉   │   ║                           │
│                           ║   │  ╰──┸┸┸──╯   │   ║                           │
│                           ║   │   ╱     ╲    │   ║                           │
│                           ║   │  ┤  [◆]  ├   │   ║                           │
│                           ║   │   ╲     ╱    │   ║                           │
│                           ║   │    ╿   ╿     │   ║                           │
│                           ║   └──────────────┘   ║                           │
│                           ║                      ║                           │
│                           ║    ● Agent ready     ║                           │
│                           ║    Waiting for task   ║                           │
│                           ╚══════════════════════╝                           │
│                                                                              │
│    Active sessions:  2 running, 1 idle                                       │
│    ● Cantante - Login Page     2m ago    ● Cantante - File Tree   15m ago   │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────── │
│  > Describe your task...                                                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ● AGENT          ←Catalog  ↑Execution  →Spaces  ↓Models  [Ctrl+K]command  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **System status line** — Backend + LLM-Provider health with breathing dots
- **Mascotte centered and large** (24x13) — personality of the app, breathing animation
- **Active sessions summary** — quick glance at what's running (click/Enter to resume)
- **Input prompt** — always at bottom, always ready
- **Quick actions** via slash commands: `/catalog`, `/spaces`, `/models`, etc.

### 2b. Active State (session running, agent working)

When the user submits a task, the mascotte shrinks to a compact header and the page becomes a conversation log — exactly like Claude Code.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────┐                                                          │
│  │ ◉ ┃┃ ◉  [◆]   │  ⠹ Agent working — Implementing auth module...          │
│  └────────────────┘     session:abc123  Fitness: 52%  Node: Implement        │
│                                                                              │
│  ❯ Add a login page with email/password authentication                       │
│                                                                              │
│    Creating session...                                                       │
│    ✓ Session started (project-autonomous)                                    │
│    ✓ Template imported                                                       │
│                                                                              │
│    ◆ Planning                                                                │
│    │ Analyzing repository structure...                                       │
│    │ Found 12 source files, 3 test files                                     │
│    │ Design: 3 steps identified                                              │
│    │   1. Create auth module (src/auth.ts)                                   │
│    │   2. Add routes (src/routes/login.ts)                                   │
│    │   3. Update app.ts with middleware                                       │
│    └ ✓ Plan complete                                                         │
│                                                                              │
│    ◆ Implementing                                                            │
│    │ Creating src/auth.ts ··············· ✓                                  │
│    │ Creating src/routes/login.ts ······· ✓                                  │
│    │ Updating src/app.ts ················ ⠹                                  │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────── │
│  > Send a message to the agent...                                            │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⠹ AGENT (working)  ←Catalog  ↑Execution  →Spaces  ↓Models  [Ctrl+K]cmd   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Compact mascotte header** (1 line) — mini face + core + spinner + status text
- **Session info line** — session ID, fitness %, current node
- **Scrollable conversation log** — user messages (`❯`), agent phases (`◆`), step details
- **File creation indicators** — dot leaders + status (✓/⠹/✗)
- **Interactive widgets** — agent can send confirmation dialogs, option selectors, plan views, test results, progress bars
- **Message input** — send additional instructions/corrections while agent works

### 2c. Agent Returned a Widget (interactive)

When the agent needs user input, it sends a widget:

```
│    ◆ Planning                                                                │
│    │ I've identified 3 possible approaches:                                  │
│    │                                                                         │
│    │  ┌─────────────────────────────────────────────────────┐                │
│    │  │  How should authentication be implemented?          │                │
│    │  │                                                     │                │
│    │  │  → [1] JWT tokens (stateless, scalable)            │                │
│    │  │    [2] Session cookies (traditional, simple)        │                │
│    │  │    [3] OAuth2 (third-party, complex)               │                │
│    │  │                                                     │                │
│    │  │  ↑↓ select  [Enter] confirm                        │                │
│    │  └─────────────────────────────────────────────────────┘                │
```

Widget types (all from current implementation):
- **message** — Simple text message
- **progress** — Multi-phase progress tracker
- **confirmation** — Yes/no decision
- **option-select** — Multiple choice selector
- **plan-view** — Implementation plan with steps
- **test-results** — Test suite results

### 2d. Completed State

```
│  ┌────────────────┐                                                          │
│  │ ◉ ┃┃ ◉  [★]   │  ✓ Task completed — 1m 23s  Fitness: 85%               │
│  └────────────────┘                                                          │
│                                                                              │
│    ... (scrollable conversation history) ...                                 │
│                                                                              │
│    ◆ Review                                                                  │
│    └ ✓ No issues found                                                       │
│                                                                              │
│    ◆ Commit                                                                  │
│    └ ✓ feat: add login page with email/password auth                         │
│                                                                              │
│    ┌─────────────────────────────────────────────────┐                       │
│    │  ★ Task completed successfully                  │                       │
│    │  Files: 3 created, 1 modified                   │                       │
│    │  Tests: 8/8 passed                              │                       │
│    │  Duration: 1m 23s                               │                       │
│    │  [↑Execution] View full monitor                 │                       │
│    └─────────────────────────────────────────────────┘                       │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────── │
│  > Describe your next task...                                                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ★ AGENT (done)      ←Catalog  ↑Execution  →Spaces  ↓Models  [Ctrl+K]cmd   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Mascotte **celebrating** (★ star core, arms up)
- **Summary card** — files changed, tests passed, duration
- **Quick link** to Execution page for full monitor view
- Ready for next task

---

## 3. The Execution Page (UP)

The **full SessionMonitor** from the monitor, promoted to a top-level page. This is the detailed technical cockpit. Navigate here with **Ctrl+Up** from Agent.

### 3a. Three Modes (same as monitor)

The Execution page auto-detects its mode from the session state:

#### Mode 1: Descriptor (sessions with `_monitorDescriptor` — compliance/foundry sessions)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ● Cantante - Login Page            session:abc12345  ● running  1m 23s     │
│    workflow: project-autonomous      Fitness: 52% █████░░░░░  Iter: 0       │
│  ═══════════════════════════════════════════════════════════════════════════  │
│                                                                              │
│  PHASES + WORKFLOW (55%)               │  LLM ACTIVITY (45%)                 │
│  ─────────────────                     │  ────────────                       │
│  ▼ ✓ Planning (85%)                   │  ── analyze (12:35:01) ────────     │
│      Summary: 3 steps identified      │  → Analyze this repository...       │
│  ▼ ● Implementation (52%)             │  ← Contains a TypeScript project... │
│    ▼ ✓ Prepare                         │  ── design (12:35:05) ────────      │
│      ▼ ● Implement  ←                 │  → Design a solution for...         │
│          ✓ Write Code                  │  ← Step 1: Create auth module...   │
│          ● Run Tests  ←               │  ── implement (12:35:12) ──────     │
│        ○ Review                        │  → Implement the following plan...  │
│        ○ Commit                        │  ← Created src/auth.ts with...     │
│    ○ Deployment                        │                                     │
│  ═══════════════════════════════════════════════════════════════════════════  │
│  LOG (8 rows, fixed)                                                         │
│  12:35:01 [info]  Session initialized                                        │
│  12:35:05 [info]  3 steps identified                                         │
│  12:35:12 [info]  Creating auth module...                                    │
│  12:35:15 [info]  Writing src/auth.ts                                        │
│  12:35:18 [info]  Running tests...                                           │
│  12:35:22 [info]  8/8 tests passed                                           │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ↑ EXECUTION  ↓Agent  ←Catalog  →Spaces  [Tab]panels [z]zoom [t/f/w/v/l]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Mode 2: Execution (active workflow running)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ● Cantante - Login Page            session:abc12345  ● running  1m 23s     │
│    workflow: project-autonomous      Fitness: 52% █████░░░░░  Iter: 0       │
│  ═══════════════════════════════════════════════════════════════════════════  │
│                                                                              │
│  WORKFLOW TREE (50%)                   │  FILESYSTEM (50%)                    │
│  ──────────────                        │  ──────────                          │
│    ✓ Prepare                           │  C:\Cantante\                       │
│  ▼ ● Implement  ←                     │  ├── src\                            │
│      ✓ Write Code                      │  │   ├── auth.ts        [rw] ✓     │
│      ● Run Tests  ←                   │  │   ├── routes\                    │
│    ○ Review                            │  │   │   └── login.ts   [rw] ✓     │
│    ○ Commit                            │  │   └── app.ts         [rw] ~     │
│                                        │  ├── tests\                         │
│                                        │  │   └── auth.test.ts   [rw] ✓     │
│                                        │  └── package.json       [r-]       │
│  ═══════════════════════════════════════════════════════════════════════════  │
│  WIDGETS (50%)                         │  METRICS (50%)                      │
│  ────────                              │  ────────                           │
│  Fitness   ████████░░ 85%             │  Fitness  ████████░░ 85%            │
│  Progress  █████████░ 95% (7/8)       │  Quality  92%                       │
│  Iteration 0 of 3                      │  Tokens   ~12.4k                    │
│  Phase: Implementation                 │  Iter     0  Plateau: 0            │
│                                        │  Trend    ▁▃▅▇█                    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ↑ EXECUTION  ↓Agent  ←Catalog  →Spaces  [Tab]panels [z]zoom [t/f/w/v/l]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Mode 3: Idle (session paused or no session)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ● Cantante - Login Page            session:abc12345  ● idle                │
│    No active workflow                                                        │
│  ═══════════════════════════════════════════════════════════════════════════  │
│                                                                              │
│  VARIABLES (50%, 60% height)           │  FILESYSTEM (50%, 60% height)       │
│  ──────────                            │  ──────────                         │
│  Config                                │  C:\Cantante\                       │
│    template     "project-autonomous"   │  ├── src\                           │
│    repoPath     "C:\Cantante"          │  │   ├── auth.ts        [rw]       │
│  State                                 │  │   ├── app.ts          [rw]       │
│    currentFitness  85% ████████░░      │  │   └── routes\                   │
│    iteration       0                   │  │       └── login.ts   [rw]       │
│    targetFitness   90%                 │  ├── tests\                         │
│  Other                                 │  │   └── auth.test.ts   [rw]       │
│    taskDescription "Add login page..." │  └── package.json       [r-]       │
│  ═══════════════════════════════════════════════════════════════════════════  │
│  COMMAND LOG (100%, 40% height)                                              │
│  ───────────                                                                 │
│  ✓ 12:35:22  invoke dev --input task="Add login page"                       │
│  ✓ 12:34:56  start                                                          │
│  ✓ 12:34:50  import-template project-autonomous                             │
│  ✓ 12:34:45  create --type project --name "Cantante - Login Page"           │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ↑ EXECUTION  ↓Agent  ←Catalog  →Spaces  [Tab]panels [z]zoom [t/f/w/v/l]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3b. No Active Session

When no session exists, the Execution page shows:

```
│                                                                              │
│                                                                              │
│                  No active session                                            │
│                                                                              │
│                  Start a task on the Agent page (Esc)                        │
│                  or open a session from Spaces (Ctrl+Right)                  │
│                                                                              │
│                                                                              │
```

### 3c. Panel Features (all from monitor)

- **Tab / Shift+Tab** — Cycle panel focus
- **1/2/3** — Jump to panel by number
- **z** — Zoom focused panel to full screen, **Esc** to unzoom
- **t/f/w/v/l** — Toggle panels: tree/files/widgets/vars/logs
- **Arrow keys** — Navigate tree cursor OR scroll log (context-dependent)
- **Ctrl+Up/Down** — Scroll 5 lines in focused panel
- **Enter/Space** — Toggle expand/collapse in tree panels
- **r** — Force refresh data
- **?** — Help overlay
- **Mouse** — Click to focus panel, scroll wheel to scroll

### 3d. Components Used

| Panel | Component | Source |
|-------|-----------|--------|
| Header | `Header` | @maestro/tui |
| Phases + Workflow | `PhaseWorkflow` | @maestro/tui |
| Workflow Tree | `WorkflowTree` | @maestro/tui |
| Execution Log | `ExecutionLog` | @maestro/tui |
| LLM Activity | `LLMActivity` | @maestro/tui |
| Metrics | `MetricsPanel` | @maestro/tui |
| Variables | `Variables` | @maestro/tui |
| Filesystem | `Filesystem` | @maestro/tui |
| Artifacts | `Artifacts` | @maestro/tui |
| Command Log | `CommandLog` | @maestro/tui |
| Widgets | `WidgetsPanel` | @maestro/tui |

All 11 panels from the monitor are available. Mode auto-selects which ones to show.

---

## 4. The Spaces Page (RIGHT)

Browse repos, workspaces, and sessions — the **SpacesScreen** from the monitor. Navigate here with **Ctrl+Right** from Agent.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  SPACES                                                                      │
│  ═══════════════════════════════════════════════════════════════════════════  │
│                                                                              │
│  [1:Repos]  [2:Workspaces]  [3:Sessions]                 Filter: [a]ll      │
│  ─────────────────────────────────────                                       │
│                                                                              │
│  ┌─────────────────────────────────────┬─────────────────────────────────┐   │
│  │                                     │                                 │   │
│  │  ● Cantante - Login Page      2m   │  Cantante - Login Page          │   │
│  │  → Cantante - File Tree      15m   │  ═══════════════════            │   │
│  │    Cantante - TTS Module      1h   │  ID: abc12345                   │   │
│  │    Demo Session               3h   │  Status: ● running              │   │
│  │    Foundry: json-validator    1d   │  Template: project-autonomous   │   │
│  │                                     │  Duration: 2m 34s              │   │
│  │                                     │  Repo: C:\Cantante             │   │
│  │                                     │                                 │   │
│  │                                     │  Fitness: 52% █████░░░░░       │   │
│  │                                     │  Phases: ✓✓●○○                 │   │
│  │                                     │  Active: Implement > Write     │   │
│  │                                     │                                 │   │
│  │                                     │  [Enter] Open full monitor     │   │
│  │                                     │  [Space] Expand inline         │   │
│  │                                     │  [J] Resume in Agent           │   │
│  │                                     │                                 │   │
│  └─────────────────────────────────────┴─────────────────────────────────┘   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  → SPACES  ←Agent  ↑Execution  ↓Models  [1/2/3]tabs [a/r]filter [Enter]open │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tab 1: Repos
- List of projects with status, container status, `.maestro/` stats
- Enter → RepoDetail screen

### Tab 2: Workspaces
- List of workspaces with type, session count, status
- Enter → WorkspaceDetail screen

### Tab 3: Sessions
- List of sessions with status icon, name, duration, fitness
- **Status filter**: `a` (all), `r` (running only)
- **Inline expansion** (Space): Shows full ID, fitness bar, phases icons, active workflow, entry points
- Enter → Full SessionMonitor detail
- **J** → Resume session in Agent page (navigates back to Agent with session active)

**Features preserved from monitor:**
- Pagination (Ctrl+Up/Down for page up/down)
- Scroll position tracking
- Status filter (All / Running)
- Inline expansion
- 3-tab navigation with keyboard (1/2/3)

---

## 5. The Catalog Page (LEFT)

Browse ALL blocks — system, user, and foundry (in-development). This is the **CatalogScreen** AND **FoundryScreen** merged. Navigate here with **Ctrl+Left** from Agent.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  CATALOG                                                    12 blocks found  │
│  ═══════════════════════════════════════════════════════════════════════════  │
│                                                                              │
│  View: [Tab: All | Workflows | Agents | Tools | Foundry]   Search: ______   │
│                                                                              │
│  ┌─────────────────────────────────────┬─────────────────────────────────┐   │
│  │                                     │                                 │   │
│  │  → [agent] dev-orchestrator   85%   │  dev-orchestrator               │   │
│  │    [tool]  file-read          92%   │  ═══════════════                │   │
│  │    [tool]  file-write         88%   │  Type: agent (composite)       │   │
│  │    [wrkfl] project-autonomous 78%   │  Fitness: 85% ████████░░       │   │
│  │    [tool]  git-committer      95%   │  Version: 1.0.0                │   │
│  │    [valid] json-validator     90%   │                                 │   │
│  │    [agent] code-reviewer      82%   │  Description:                   │   │
│  │    [tool]  test-runner        91%   │  Main development orchestrator  │   │
│  │    [infr]  cache-context      77%   │  agent. Manages the full dev    │   │
│  │    [tool]  file-search        89%   │  lifecycle: plan, implement,    │   │
│  │    [wrkfl] foundry-default    80%   │  test, review, commit.          │   │
│  │    [agent] task-planner       86%   │                                 │   │
│  │                                     │  Nodes: 7 child blocks          │   │
│  │                                     │  Entry: dev, plan, review       │   │
│  │                                     │                                 │   │
│  └─────────────────────────────────────┴─────────────────────────────────┘   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ← CATALOG  →Agent  ↑Execution  ↓Models  [Tab]filter [Space]expand [Enter]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tabs/Filters

| Tab | Content |
|-----|---------|
| **All** | Every block (system + user + in-dev) |
| **Workflows** | `type: workflow` only |
| **Agents** | `type: agent` only |
| **Tools** | `type: tool` + `validator` + `inference` + `script` |
| **Foundry** | In-development blocks (user's blocks, sorted by type, with expand detail) |

### Features

- **Tab** cycles type filter
- **Space** expands inline detail (description, version, atomic, fitness bar + sparkline)
- **Enter** opens full BlockDetail screen
- **Up/Down** navigates list
- **Type badges**: `[agent]` cyan, `[tool]` green, `[wrkfl]` yellow, `[valid]` magenta, `[infr]` gray
- **Fitness bars** color-coded: green ≥80%, yellow ≥50%, red <50%
- **Scroll position** tracking
- **Master-detail** layout: list left (55%), detail right (45%)

---

## 6. The Models Page (DOWN)

LLM models and providers. Navigate here with **Ctrl+Down** from Agent.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  MODELS                                                                      │
│  ═══════════════════════════════════════════════════════════════════════════  │
│                                                                              │
│  ┌──────────────────────────────────────┬────────────────────────────────┐   │
│  │                                      │                                │   │
│  │  MODEL STATUS                        │  claude-sonnet-4-6             │   │
│  │  ────────────                        │  ═════════════════             │   │
│  │  Health: ● Online                    │  Provider: Claude Code CLI     │   │
│  │  Backend: .NET                       │  Status: ● available           │   │
│  │  Device: GPU (RTX 4090)              │  Context: 200k tokens          │   │
│  │  GPU Memory: 8.2 / 24 GB            │                                │   │
│  │  Max Tokens: 16384                   │  Usage (today):                │   │
│  │  Temperature: 0.7                    │  Requests: 142                 │   │
│  │                                      │  Tokens in: 45.2k             │   │
│  │  AVAILABLE MODELS                    │  Tokens out: 12.8k            │   │
│  │  ────────────────                    │  Avg latency: 1.2s            │   │
│  │  ✓ claude-sonnet-4-6    ● online    │                                │   │
│  │  → claude-opus-4-6      ● online    │  Fitness (across blocks):      │   │
│  │    claude-haiku-4-5     ● online    │  dev-orchestrator  85%         │   │
│  │    qwen2.5-coder-7b    ● local     │  task-planner      78%         │   │
│  │    smollm2-1.7b        ● local     │  code-reviewer     82%         │   │
│  │    gpt-4o               ○ offline   │  Sparkline: ▁▃▅▇█▇▅           │   │
│  │                                      │                                │   │
│  └──────────────────────────────────────┴────────────────────────────────┘   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ↓ MODELS   ↑Agent  ←Catalog  →Spaces  ↑↓navigate  [Enter]details           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Layout**: 40% Model Status + 60% Model List/Detail (same as monitor)

**Features from monitor:**
- Health indicator (Online/Offline)
- Backend, device, GPU memory info
- Active model checkmark
- Model list with selection
- Enter → ModelDetail screen (3 panels: Health, Usage, Performance)

---

## 7. Agent-in-the-Cockpit System

This is the **critical missing piece** from the first design. The agent and user have **independent positions**. The agent can be "here" (same page) or "elsewhere" (different page).

### 7a. The Two Positions

```typescript
userScreen: Screen      // Where the user is looking
agentScreen: Screen     // Where the agent is working
followingAgent: boolean // Is the user auto-following?
agentState: 'idle' | 'working' | 'navigating' | 'waiting-input'
```

### 7b. Three Interactions

#### JOIN — User teleports to agent

User is browsing Catalog. Agent is working on the Execution page. User presses **J** (or clicks "Join"):

```
BEFORE:                              AFTER:
┌──────────────┐                     ┌──────────────┐
│   CATALOG    │  Agent badge:       │  EXECUTION   │  Agent overlay:
│              │  "⠹ working"  ──→   │              │  shown (same page)
│  User is     │                     │  User AND    │
│  here        │                     │  agent here  │
└──────────────┘                     └──────────────┘
```

- `followingAgent = true`
- `userScreen = agentScreen`
- User sees agent's work directly

#### CALL — Agent arrives at user's location

User is on Catalog. Starts a task from there (slash command, or agent navigates to Catalog to browse blocks):

```
┌──────────────────────────────────────────────────────────┐
│  CATALOG                                   12 blocks     │
│                                                          │
│  → [agent] dev-orchestrator   85%                        │
│    [tool]  file-read          92%                        │
│    [tool]  file-write         88%                        │
│                                                          │
│              ┌──────────────────────────────┐             │
│              │  ◉┃◉ [◆] Agent here         │             │
│              │  Working on: Analyze blocks  │             │
│              │  Node: Prepare               │             │
│              │                              │             │
│              │  [Esc] detach  [Enter] focus │             │
│              └──────────────────────────────┘             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ← CATALOG  ⠹ Agent here  [Esc]detach  [Enter]focus     │
└──────────────────────────────────────────────────────────┘
```

The **mini-panel overlay** appears when agent and user are on the same page. It shows:
- Compact mascotte
- Current task summary
- Current node
- Controls: Esc to detach, Enter to focus (go to Agent page)

#### DETACH — User navigates freely, agent continues

User presses **Esc** while agent is working, or navigates to a different page:

```
BEFORE (same page):                  AFTER (different pages):
┌──────────────┐                     ┌──────────────┐
│  EXECUTION   │                     │   CATALOG    │
│              │  Agent overlay       │              │
│  User AND    │  visible    ──→     │  User here   │
│  agent here  │                     │              │
└──────────────┘                     └──────────────┘
                                     StatusBar: "⠹ Agent working in Execution — [J]oin"
```

- `followingAgent = false`
- Agent continues working wherever it was
- **StatusBar shows agent location** with Join hint
- **AgentBadge** in StatusBar pulses to indicate activity

### 7c. Visual Indicators

**When agent is on the SAME page as user:**
- Mini-panel overlay appears (floating box with compact mascotte + status)
- StatusBar: `⠹ Agent here  [Esc]detach  [Enter]focus`

**When agent is on a DIFFERENT page:**
- No overlay (agent is elsewhere)
- StatusBar: `⠹ Agent working in [PageName] — [J]oin to follow`
- The direction arrow for that page **pulses/blinks** to indicate activity
  - e.g., if agent is on Execution: `↑★Execution` (star replaces normal arrow)

**When agent is idle:**
- StatusBar: `● Agent ready`
- No overlay, no blinking

### 7d. Agent Navigation Events

The agent can navigate during execution (e.g., to browse the filesystem, inspect blocks):

| Agent Action | If Following | If Detached |
|-------------|-------------|------------|
| Agent navigates to Catalog | User follows to Catalog | StatusBar updates: "Agent in Catalog" |
| Agent returns to Agent page | User follows to Agent | StatusBar updates: "Agent at home" |
| Agent starts working | Overlay appears on current page | StatusBar shows spinner |
| Agent finishes | Overlay shows celebration | **Notification toast** (see section 11) |
| Agent needs input | Overlay highlights input needed | **Bell + notification**: "Agent needs your input" |

---

## 8. Detail Screens

Detail screens are **drill-downs** from list pages. They replace the current page content. **Esc** goes back to the list.

### 8a. Block Detail (from Catalog)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◄ Back to Catalog                                                           │
│                                                                              │
│  dev-orchestrator                                                            │
│  ═══════════════                                                             │
│                                                                              │
│  ┌─────────────────────┬──────────────────────┬──────────────────────────┐   │
│  │  INFO               │  FITNESS             │  SESSIONS                │   │
│  │  ────               │  ───────             │  ────────                │   │
│  │  ID: dev-orch...    │  Block: 85%          │  ● Cantante - Login  2m │   │
│  │  Type: agent        │  ████████░░          │    Cantante - Tree  15m │   │
│  │  Atomic: no         │                      │    Demo Session     3h  │   │
│  │  Version: 1.0.0     │  Dimensions:         │                         │   │
│  │  Author: system     │  Prompt: 90%         │                         │   │
│  │                      │  Structure: 82%      │                         │   │
│  │  Children:           │  Workflow: 78%       │                         │   │
│  │  ├ task-planner     │                      │                         │   │
│  │  ├ code-writer      │  Task fitness:       │                         │   │
│  │  ├ test-runner      │  code-gen   88%      │  [v] View source JSON   │   │
│  │  ├ code-reviewer    │  testing    91%      │  [Enter] Open session   │   │
│  │  └ git-committer    │  review     82%      │                         │   │
│  └─────────────────────┴──────────────────────┴──────────────────────────┘   │
│                                                                              │
│  Entry Points: dev, plan, review, test                                       │
│  System Prompt: 1,245 chars  [v] to view                                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ← CATALOG > dev-orchestrator    [Esc]back  [Tab]panels  ↑↓scroll           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8b. Session Detail (from Spaces or /session command)

Opens the **full SessionMonitor** — same 3 modes as the Execution page, but for ANY session (not just the current one). Esc returns to Spaces.

### 8c. Workspace Detail (from Spaces > Workspaces tab)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◄ Back to Spaces                                                            │
│                                                                              │
│  cantante-dev                                                                │
│  ═══════════                                                                 │
│  Type: development  Status: active  Path: C:\Cantante                       │
│                                                                              │
│  ┌──────────────────────────────────────┬────────────────────────────────┐   │
│  │  SESSIONS (60%)                      │  SETTINGS (40%)                │   │
│  │  ────────                            │  ────────                      │   │
│  │  ● Cantante - Login Page      2m    │  Max concurrent: 3             │   │
│  │  ● Cantante - File Tree      15m    │  Auto-promote: on              │   │
│  │    Cantante - TTS Module      1h    │  Min fitness: 70%              │   │
│  │                                      │                                │   │
│  │  [Enter] Open session               │                                │   │
│  └──────────────────────────────────────┴────────────────────────────────┘   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  → SPACES > cantante-dev    [Esc]back  [Tab]panels  ↑↓navigate              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8d. Repo Detail (from Spaces > Repos tab)

```
│  C:\Cantante                                                                 │
│  ═══════════                                                                 │
│  Status: ● active  Container: running                                        │
│                                                                              │
│  ┌──────────────────────────────────────┬────────────────────────────────┐   │
│  │  SESSIONS (60%)                      │  .MAESTRO/ INFO (40%)          │   │
│  │                                      │                                │   │
│  │  ● Cantante - Login Page      2m    │  Blocks: 3                     │   │
│  │  ● Cantante - File Tree      15m    │  Artifacts: 12                 │   │
│  │    Cantante - TTS Module      1h    │  Metrics: 847 entries          │   │
│  │                                      │  Logs: 2.4 MB                  │   │
│  └──────────────────────────────────────┴────────────────────────────────┘   │
```

### 8e. Model Detail (from Models page)

3-panel view (same as monitor):
- **Health**: Status, backend, device, GPU memory, uptime, load
- **Usage**: Requests, latency, peak, errors, tokens in/out, throughput
- **Performance**: Fitness bar, sessions, task fitness breakdown, sparkline history

---

## 9. Navigation & Keyboard Reference

### 9a. Global (available from ANY page)

| Key | Action |
|-----|--------|
| **Ctrl+Arrow** | Navigate to adjacent page in that direction (computed from Page Registry — if a page exists at the target coordinate, go there; otherwise no-op) |
| **Esc** | Return to Agent (home) / Unzoom / Back from detail |
| **Ctrl+K** | Open Command Palette |
| **Ctrl+Tab** | Quick-switch: toggle between last 2 pages |
| **J** | Join agent (teleport to agent's current page) |
| **Ctrl+C** | Quit (with confirmation if session active) |
| **?** | Toggle Help overlay |

> **Note**: The specific pages reachable from each position are NOT hardcoded — they are computed dynamically from the Page Registry grid. The StatusBar shows available directions automatically. See Section 1 for details.

### 9b. Agent Page

| Key | Action |
|-----|--------|
| *(typing)* | Character input to prompt |
| **Enter** | Submit task / message |
| **Up/Down** | Scroll conversation (when input empty) / Input history |
| **Ctrl+A / Ctrl+E** | Cursor to start/end of input |
| **/command** | Slash command (catalog, spaces, models, help, session, back, join, quit) |
| **Ctrl+V** | Toggle voice mode |
| **Ctrl+D** | Jump to current session detail |

### 9c. Execution Page

| Key | Action |
|-----|--------|
| **Tab / Shift+Tab** | Cycle panel focus |
| **1 / 2 / 3** | Jump to panel by number |
| **Up / Down** | Tree cursor move or scroll (in focused panel) |
| **Left / Right** | Tree collapse/expand (in focused panel) |
| **j / k** | Vim-style cursor up/down |
| **Ctrl+Up / Ctrl+Down** | Scroll 5 lines in focused panel |
| **Enter / Space** | Toggle tree node expand/collapse |
| **z** | Zoom focused panel to full screen |
| **t** | Toggle tree panel |
| **f** | Toggle filesystem panel |
| **w** | Toggle widgets panel |
| **v** | Toggle variables panel |
| **l** | Toggle log panel |
| **r** | Force refresh data |

### 9d. List Pages (Catalog, Spaces, Models)

| Key | Action |
|-----|--------|
| **Up / Down** | Navigate list |
| **j / k** | Vim-style navigate |
| **Ctrl+Up / Ctrl+Down** | Page up/down |
| **Enter** | Open detail screen |
| **Space** | Expand/collapse inline detail |
| **Tab** | Cycle filter/tab |
| **1 / 2 / 3** | Switch tab directly (Spaces) |
| **a / r** | Status filter: all / running (Spaces > Sessions) |

### 9e. Detail Screens

| Key | Action |
|-----|--------|
| **Esc** | Back to list |
| **Tab** | Cycle panels |
| **Up / Down** | Scroll / navigate |
| **Enter** | Open linked item (session from block, etc.) |
| **v** | View source JSON (BlockDetail) |

---

## 10. The Mascotte

### 10a. Design Philosophy

The mascotte is the **soul** of Maestro Code. Like Flipper Zero's dolphin or a Tamagotchi pet, it gives the TUI personality. It reacts to events, breathes when idle, celebrates successes, shows distress on errors.

### 10b. States

| State | Appearance | Core | Eyes | Animation |
|-------|-----------|------|------|-----------|
| **idle** | Relaxed, arms down, breathing | dim cyan ◆ | white ◉ | Slow breathing (core ◆↔◇, 600ms) |
| **working** | Energetic, arms wide | bright green ◆ | cyan ◉ | Fast pulse (core flashes, 300ms) |
| **waiting-input** | Tilted head, one arm up | yellow ◆ | white ◉ | Gentle wave (arm up/down, 400ms) |
| **navigating** | Running pose, feet moving | blue ◆ | cyan ◉ | Running (feet alternate, 200ms) |
| **error** | Distressed, arms up, X eyes | red ✗ | red ✗ | Shaking (slight x-shift, 150ms) |
| **celebrating** | Victory pose, arms up | magenta ★ | bright yellow ✦ | Confetti (sparkles around, 100ms) |
| **thinking** | Hand on chin, looking up | dim white ◆ | half-closed | Dots appearing (..., 500ms) |

### 10c. Sizes

| Context | Dimensions | When |
|---------|-----------|------|
| **Full** | 24x13 chars | Agent page idle (centered, dominant) |
| **Compact** | 16x1 chars | Agent page working (top-left header) |
| **Mini** | 3x1 chars | StatusBar when agent is elsewhere |
| **Overlay** | 16x5 chars | Mini-panel when agent arrives on user's page |

### 10d. Personality Events

The mascotte reacts to specific events:

| Event | Reaction |
|-------|---------|
| Session created | Eyes brighten, arms gesture forward |
| Step completed | Quick nod animation |
| All tests passed | Celebrating state for 3 seconds |
| Test failed | Error state, shaking |
| Task completed | Celebrating with summary |
| User types a message | Looks at user (eyes shift right toward input) |
| Idle for >30 seconds | Falls asleep (eyes close, slow breathing, Z's float up) |
| User returns after being away | Wake-up animation (stretch, eyes open) |

---

## 11. StatusBar & Notifications

### 11a. StatusBar Layout

The StatusBar is the consistent anchor, always at the bottom (1-3 lines):

```
[page position] [page name] [agent status] [directions] [context shortcuts]
```

### 11b. StatusBar Variants

All direction hints are **auto-generated from the Page Registry** (see Section 1c). The examples below show the default v1 layout — if pages are added or removed, the hints update automatically.

**Agent page (idle):**
```
● AGENT          ←Catalog  ↑Execution  →Spaces  ↓Models       [Ctrl+K]command
```

**Agent page (working):**
```
⠹ AGENT (working)  session:abc123  52%  ←Catalog ↑★Execution →Spaces ↓Models
```

Note: `↑★Execution` — star indicates execution data is available to view.

**Execution page:**
```
↑ EXECUTION  ↓Agent  ←Catalog  →Spaces  ◈ TREE  [Tab]panels [z]zoom [t/f/w/v/l]
```

Note: `◈ TREE` shows which panel is focused. Changes to `▣ TREE` when zoomed.

**Catalog page (agent working elsewhere):**
```
← CATALOG  →Agent  ⠹ Agent in Execution — [J]oin  [Tab]filter [Space]expand
```

**Future page at (1,1) — only shows occupied neighbors:**
```
→ TERMINAL  ←Models  ↑Spaces        [Ctrl+K]command
```

### 11c. Notification Toasts

When an important event happens and the user is on a different page, a **toast notification** appears briefly at the top of the screen:

```
┌──────────────────────────────────────────────────┐
│  ★ Task completed — "Add login page"  (1m 23s)  │
│    Press [J] to join agent or [Esc] to dismiss    │
└──────────────────────────────────────────────────┘
```

Events that trigger notifications:
- Task completed (success or error)
- Agent needs user input (waiting-input state)
- Session ended unexpectedly (error)
- Connection lost / recovered

Toasts auto-dismiss after 5 seconds. Press any key to dismiss immediately.

---

## 12. Command Palette

**Ctrl+K** opens a fuzzy-search command palette (like VS Code's Ctrl+P):

```
┌──────────────────────────────────────────────────────────────┐
│  > ___________________________                               │
│                                                              │
│  RECENT                                                      │
│    ◆ Cantante - Login Page (resume session)                  │
│    ◆ dev-orchestrator (view block)                           │
│                                                              │
│  NAVIGATION (auto-populated from Page Registry)              │
│    → Go to Catalog                              Ctrl+Left   │
│    → Go to Spaces                               Ctrl+Right  │
│    → Go to Execution                            Ctrl+Up     │
│    → Go to Models                               Ctrl+Down   │
│                                                              │
│  ACTIONS                                                     │
│    ▶ New session...                                          │
│    ▶ Import template...                                      │
│    ▶ Switch model...                                         │
│    ▶ Refresh data                               r            │
│    ▶ Toggle voice mode                          Ctrl+V       │
│                                                              │
│  SESSIONS                                                    │
│    ● Cantante - Login Page (running)                         │
│    ○ Cantante - File Tree (idle)                             │
│                                                              │
│  BLOCKS                                                      │
│    [agent] dev-orchestrator (85%)                            │
│    [tool] file-read (92%)                                    │
│                                                              │
│                                          [Esc] close         │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Fuzzy search across sessions, blocks, commands, pages
- Recent items at top
- Type to filter
- Enter to select
- Esc to close
- Categorized results: Recent / Navigation / Actions / Sessions / Blocks
- **Navigation section auto-populated from Page Registry** — adding a page to the registry automatically adds it to the Command Palette's navigation list with the correct shortcut hint

---

## 13. Help Overlay

**?** on any page opens a context-aware help overlay:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  MAESTRO CODE — Keyboard Reference                                           │
│  ══════════════════════════════════                                           │
│                                                                              │
│  SPATIAL NAVIGATION (from registry)    AGENT PAGE                            │
│  ───────────────────                   ──────────                            │
│  Ctrl+↑    ↑ page (from registry)      Enter      Submit task/message        │
│  Ctrl+↓    ↓ page (from registry)      ↑↓         Scroll / input history     │
│  Ctrl+←    ← page (from registry)      /command   Slash command              │
│  Ctrl+→    → page (from registry)      Ctrl+V     Voice mode                 │
│  Esc       Return to Agent             Ctrl+D     Session detail             │
│  Ctrl+Tab  Quick-switch last page                                            │
│                                        EXECUTION PAGE                        │
│  EVERYWHERE                            ──────────────                        │
│  ──────────                            Tab        Cycle panels               │
│  Ctrl+K    Command palette             1/2/3      Jump to panel              │
│  J         Join agent                  z          Zoom panel                 │
│  ?         This help                   ↑↓←→       Navigate/scroll            │
│  Ctrl+C    Quit                        t/f/w/v/l  Toggle panels              │
│                                        r          Refresh                    │
│  LIST PAGES                                                                  │
│  ──────────                            AGENT-IN-THE-COCKPIT                  │
│  ↑↓/j/k   Navigate list               ──────────────────────                │
│  Enter     Open detail                 J          Join agent (follow)        │
│  Space     Expand inline               Esc        Detach from agent          │
│  Tab       Cycle filter/tab            Enter      Focus agent (from overlay) │
│  a/r       Filter all/running                                                │
│                                                                              │
│                                                    Press ? or Esc to close   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Demo Mode

### 14a. Explicit `--demo` flag

```bash
maestro code --demo          # Demo mode: mock data, no backend needed
maestro code                 # Normal mode: requires backend
maestro code --headless      # Headless mode: no TUI, pipe I/O
```

### 14b. Demo Behavior

- `[DEMO]` badge in StatusBar
- Auto-creates mock session on startup
- Execution tree evolves over ~8 seconds (Prepare → Plan → Implement → Test → Review → Commit)
- Log entries appear progressively
- LLM activity shows mock prompts/responses
- Metrics progress from 30% to 85%
- Agent state transitions: idle → working → celebrating
- Mascotte animations visible throughout
- All navigation works (Ctrl+Arrows between pages)
- Catalog, Spaces, Models show mock data

### 14c. No Backend, No Demo

Without `--demo` and no backend reachable:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                                                                              │
│                       ╔══════════════════════════════╗                       │
│                       ║                              ║                       │
│                       ║   Backend not available      ║                       │
│                       ║                              ║                       │
│                       ║   To start:                  ║                       │
│                       ║   dev-scripts/dev-start.ps1  ║                       │
│                       ║                              ║                       │
│                       ║   Or use demo mode:          ║                       │
│                       ║   maestro code --demo        ║                       │
│                       ║                              ║                       │
│                       ╚══════════════════════════════╝                       │
│                                                                              │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ✗ DISCONNECTED                                           [Ctrl+C] quit     │
└──────────────────────────────────────────────────────────────────────────────┘
```

No silent failures. Red error. Clear instructions.

---

## 15. Headless & Pipe Mode

### 15a. Headless Mode (CI/Pipes)

```bash
maestro code --headless --task "Add login page" --repo C:\Cantante
```

- No TUI, no Ink rendering
- Structured output: `[HH:MM:SS] [level] message`
- Exit code 0 on success, 1 on failure
- Machine-parseable

### 15b. Pipe Mode (scripting)

```bash
echo "Add login page" | maestro code --pipe --repo C:\Cantante
```

- JSON output per line
- Streamable events: `{"type":"status","node":"implement","status":"running"}`

---

## 16. Responsive Design

### 16a. Width Breakpoints

| Width | Behavior |
|-------|----------|
| **≥ 120 cols** | Full layout: master (55%) + detail (45%) side by side |
| **100-119 cols** | Standard: master (50%) + detail (50%) |
| **80-99 cols** | Narrow: master list only, detail on Enter (replaces list) |
| **60-79 cols** | Compact: single column, truncated text, no fitness bars |
| **< 60 cols** | Warning: "Terminal too narrow. Resize to ≥60 columns." |

### 16b. Height Breakpoints

| Height | Behavior |
|--------|----------|
| **≥ 35 rows** | Full: large mascotte + conversation + status |
| **25-34 rows** | Standard: large mascotte idle, compact when working |
| **20-24 rows** | Compact: always compact mascotte |
| **< 20 rows** | Minimal: no mascotte, text-only, 1-line status |

### 16c. Execution Page Responsive

| Width | Layout |
|-------|--------|
| **≥ 100** | 4-quadrant: 2x2 grid |
| **80-99** | 2-column: tree+log stacked left, metrics+llm stacked right |
| **60-79** | 1-column: panels stacked vertically, Tab to switch |
| **< 60** | Warning |

---

## 17. Mouse Support

| Action | Behavior |
|--------|----------|
| **Click on panel** | Focus that panel (Execution page) |
| **Click on list item** | Select that item |
| **Click on tab** | Switch to that tab |
| **Click on StatusBar direction** | Navigate to that page |
| **Scroll wheel** | Scroll focused panel / list |
| **Scroll in unfocused panel** | Focus + scroll that panel |

---

## 18. Sound & Terminal Effects

### 18a. Terminal Background

On startup: `setTerminalBg(palette.bg)` — sets terminal background to Maestro's dark theme (#1e1e1e).
On exit: `resetTerminalBg()` — restores original background.

### 18b. Terminal Bell

| Event | Bell |
|-------|------|
| Task completed (success) | Single bell `\x07` |
| Task failed (error) | Double bell `\x07\x07` |
| Agent needs input | Triple bell `\x07\x07\x07` |
| Edge navigation (can't go further) | No bell (silent) |

Configurable: `maestro code --no-bell` to disable.

---

## 19. Component Reuse Map

### From @maestro/tui (design system)

| Component | Used In |
|-----------|---------|
| `Panel` | All pages (bordered containers) |
| `NavBar` | *Removed — replaced by StatusBar spatial nav* |
| `StatusBar` | All pages (bottom bar) |
| `Header` | Execution page (session info header) |
| `WorkflowTree` | Execution page, Session detail |
| `PhaseWorkflow` | Execution page (descriptor mode) |
| `ExecutionLog` | Execution page |
| `LLMActivity` | Execution page |
| `MetricsPanel` | Execution page, inline summaries |
| `Variables` | Execution page (idle mode) |
| `Filesystem` | Execution page |
| `Artifacts` | Execution page, Session detail |
| `CommandLog` | Execution page (idle mode) |
| `WidgetsPanel` | Execution page, Agent page (inline widgets) |
| `Shortcut` | StatusBar, Help overlay |

### From @maestro/tui (hooks)

| Hook | Used In |
|------|---------|
| `useTreeNav` | Execution page (tree panels) |
| `usePanelFocus` | Execution page (4 panels) |
| `useScroll` | All pages (per-panel scroll) |
| `useActionKeyboard` | All pages (keyboard routing) |
| `useMouse` | All pages (click + scroll) |
| `useSelectableList` | List pages (Catalog, Spaces, Models) |
| `useAnimationTick` | Mascotte animation, spinners |
| `useSessionData` | Agent + Execution (session polling) |
| `useSessionList` | Spaces page |
| `useModelList` | Models page |
| `useHealthMonitor` | Agent page (system status) |

### From @maestro/monitor (wrapped screens)

| Component | Used As |
|-----------|---------|
| `CatalogScreen` | Catalog page (with Foundry tab added) |
| `SpacesScreen` | Spaces page (3 tabs: Repos/Workspaces/Sessions) |
| `ModelsScreen` | Models page |
| `SessionMonitor` | Session detail screen (full 3-mode cockpit) |
| `BlockDetail` | Block detail screen |
| `WorkspaceDetail` | Workspace detail screen |
| `RepoDetail` | Repo detail screen |
| `ModelDetail` | Model detail screen |

### New Components (maestro-code specific)

| Component | Purpose |
|-----------|---------|
| `PageRegistry` | Central registry of all pages: positions, components, metadata. Navigation, StatusBar, CommandPalette, HelpOverlay all read from it. Adding a page = `pageRegistry.register({...})` |
| `AgentPage` | Full-screen chat with mascotte |
| `ExecutionPage` | Wrapper around SessionMonitor for current session |
| `MascotteFull` | 24x13 centered mascotte with state animations |
| `MascotteCompact` | 1-line mascotte header |
| `MascotteMini` | 3x1 StatusBar mascotte |
| `MascotteOverlay` | 16x5 floating overlay for Agent-in-the-Cockpit |
| `ConversationLog` | Scrollable chat history |
| `InputPrompt` | Text input with history |
| `WidgetRenderer` | Interactive widget display |
| `SpatialStatusBar` | StatusBar with compass directions |
| `NotificationToast` | Pop-up notification at top |
| `CommandPalette` | Fuzzy search command palette |
| `HelpOverlay` | Context-aware keyboard reference |
| `NoBackendScreen` | Error screen when backend unavailable |
| `WelcomeScreen` | First-run initialization |
| `SplashScreen` | Startup logo with mascotte |

---

## 20. Architecture

### 20a. Component Tree

```
App.ts
├── PageRegistry                 ← Central page registry (singleton)
│   ├── builtInPages[]           ← 5 default pages registered at init
│   └── register(def)            ← Extensible: future pages added here
│
├── useSpatialNav(registry)      ← Reads registry, computes adjacency dynamically
├── useNavigation()              ← Agent-in-the-Cockpit dual positions
├── useInputHistory()            ← Agent page input history
│
├── SplashScreen                 ← Auto-dismiss on startup (1.5s)
├── WelcomeScreen                ← First-run (.maestro/ init)
├── NoBackendScreen              ← Error when no backend
│
├── [Current Page] ──────── resolved from registry.getById(currentPageId).component
│   │
│   ├── AgentPage                ← position (0,0) — CENTER
│   │   ├── SystemStatus         (idle only: backend + LLM health)
│   │   ├── ActiveSessionsSummary (idle only: running sessions)
│   │   ├── MascotteFull         (idle only: centered, breathing)
│   │   ├── MascotteCompact      (working: 1-line header)
│   │   ├── ConversationLog      (working: scrollable chat)
│   │   ├── WidgetRenderer       (working: agent widgets)
│   │   └── InputPrompt          (always: text input)
│   │
│   ├── ExecutionPage            ← position (0,-1) — UP from center
│   │   └── SessionMonitor       (full 3-mode: descriptor/execution/idle)
│   │       ├── Header
│   │       ├── PhaseWorkflow / WorkflowTree
│   │       ├── ExecutionLog / LLMActivity
│   │       ├── MetricsPanel / Variables
│   │       ├── Filesystem / Artifacts
│   │       ├── CommandLog / WidgetsPanel
│   │       └── [Panel toggles, zoom, focus cycling]
│   │
│   ├── CatalogPage              ← position (-1,0) — LEFT from center
│   │   └── CatalogScreen        (from @maestro/monitor, + Foundry tab)
│   │       └── BlockDetail       (drill-down)
│   │
│   ├── SpacesPage               ← position (1,0) — RIGHT from center
│   │   └── SpacesScreen         (from @maestro/monitor, 3 tabs)
│   │       ├── SessionMonitor    (drill-down)
│   │       ├── WorkspaceDetail   (drill-down)
│   │       └── RepoDetail        (drill-down)
│   │
│   ├── ModelsPage               ← position (0,1) — DOWN from center
│   │   └── ModelsScreen         (from @maestro/monitor)
│   │       └── ModelDetail       (drill-down)
│   │
│   └── [Future pages]           ← position (x,y) — registered dynamically
│       └── component from registry
│
├── MascotteOverlay              ← Floating: when agent is on same page
├── NotificationToast            ← Top: events when on different page
├── CommandPalette               ← Modal: Ctrl+K — reads registry for NAVIGATION section
├── HelpOverlay                  ← Modal: ? — reads registry for SPATIAL NAVIGATION section
│
└── SpatialStatusBar             ← Always at bottom — reads registry for direction hints
    ├── PagePosition             (● AGENT / ↑ EXECUTION / etc.)
    ├── AgentStatus              (⠹ working / ● ready / ★ done)
    ├── DirectionHints           (auto-generated from registry: only shows occupied directions)
    └── ContextShortcuts         ([Tab]panels [z]zoom etc.)
```

### 20b. New Hook: useSpatialNav (Page Registry-based)

```typescript
type Direction = 'up' | 'down' | 'left' | 'right';

// The hook reads from PageRegistry — NO hardcoded compass, NO hardcoded ring.
// See Section 1b for PageDefinition interface.

class PageRegistry {
  private pages: Map<string, PageDefinition> = new Map();
  private grid: Map<string, PageDefinition> = new Map(); // key = "x,y"

  register(def: PageDefinition): void {
    this.pages.set(def.id, def);
    this.grid.set(`${def.position.x},${def.position.y}`, def);
  }

  getById(id: string): PageDefinition | undefined {
    return this.pages.get(id);
  }

  getAt(pos: { x: number; y: number }): PageDefinition | undefined {
    return this.grid.get(`${pos.x},${pos.y}`);
  }

  getAll(): PageDefinition[] {
    return Array.from(this.pages.values());
  }

  // Ring = non-center pages sorted by angle around (0,0)
  getRing(): PageDefinition[] {
    return this.getAll()
      .filter(p => !(p.position.x === 0 && p.position.y === 0))
      .sort((a, b) =>
        Math.atan2(a.position.y, a.position.x) -
        Math.atan2(b.position.y, b.position.x)
      );
  }

  // Direction hints from a given position — only shows occupied directions
  getDirectionHints(pos: { x: number; y: number }): { direction: Direction; page: PageDefinition }[] {
    const deltas: Record<Direction, { x: number; y: number }> = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };
    return (['up', 'down', 'left', 'right'] as Direction[])
      .map(dir => {
        const target = { x: pos.x + deltas[dir].x, y: pos.y + deltas[dir].y };
        const page = this.getAt(target);
        return page ? { direction: dir, page } : null;
      })
      .filter(Boolean) as { direction: Direction; page: PageDefinition }[];
  }
}

// The hook
interface UseSpatialNavReturn {
  pageId: string;                                 // Current page ID
  page: PageDefinition;                           // Current page definition
  navigate(direction: Direction): void;           // Move to adjacent cell (no-op if empty)
  rotateRing(clockwise: boolean): void;           // Ctrl+Left/Right from non-center pages
  goHome(): void;                                 // Always goes to (0,0)
  goTo(pageId: string): void;                     // Direct jump by ID
  position: { x: number; y: number };             // Current grid position
  previousPageId: string | null;                  // For Ctrl+Tab quick-switch
  directionHints: { direction: Direction; page: PageDefinition }[];  // For StatusBar
  registry: PageRegistry;                         // Exposed for CommandPalette, Help, etc.
}

function useSpatialNav(registry: PageRegistry): UseSpatialNavReturn {
  // All navigation is computed from registry — no hardcoded values.
  // See Section 1c for getNeighbor() logic.
  // See Section 1d for ring rotation logic.
}
```

### 20c. Data Flow

```
CLI (cli.ts)
  ↓ flags: --demo, --no-splash, --headless, --repo, --task
  ↓
App.ts (startInteractiveMode)
  ↓ creates SessionManager, ApiClient, PageRegistry (with 5 built-in pages)
  ↓ renders SplashScreen → WelcomeScreen → InteractiveApp
  ↓
InteractiveApp
  ├── useSpatialNav(registry) → page state, direction hints, ring rotation
  ├── useNavigation() → agent position state
  ├── useSessionData(apiClient, sessionId, 2000ms) → session polling
  ├── useHealthMonitor(apiClient) → backend/LLM health
  │
  ├── Current page resolved via: registry.getById(pageId).component
  │   ├── AgentPage receives: sessionManager, apiClient, nav, lines, busy, widgets
  │   │   └── handleSubmit() → SessionManager.submitTask() → session created → polling starts
  │   ├── ExecutionPage receives: apiClient, sessionId (current)
  │   │   └── SessionMonitor handles all internal state (3 modes, panels, zoom)
  │   ├── CatalogPage/SpacesPage/ModelsPage: wrapped @maestro/monitor screens
  │   │   └── receives: apiClient, onNavigate, onBack — detail views handled internally
  │   └── [Future pages]: same PageProps interface, same routing
  │
  ├── CommandPalette reads registry.getAll() for navigation section
  ├── HelpOverlay reads registry.getDirectionHints() for spatial nav section
  ├── SpatialStatusBar reads directionHints from useSpatialNav for direction indicators
  │
  └── Agent-in-the-Cockpit overlay:
      ├── agentIsHere? → MascotteOverlay (floating mini-panel)
      ├── agentElsewhere? → StatusBar hint + Join shortcut
      └── agentEvent? → NotificationToast (top of screen)
```

---

## 21. Full Feature Checklist

### Pages (5 + details)

- [ ] Agent page: idle state (mascotte, system status, active sessions)
- [ ] Agent page: working state (compact mascotte, conversation, widgets)
- [ ] Agent page: completed state (celebrating mascotte, summary)
- [ ] Execution page: descriptor mode (phases + LLM + log)
- [ ] Execution page: execution mode (tree + filesystem + widgets + metrics)
- [ ] Execution page: idle mode (variables + filesystem + command log)
- [ ] Execution page: no-session state (helpful message)
- [ ] Catalog page: all blocks with type filter (All/Workflows/Agents/Tools/Foundry)
- [ ] Catalog page: inline expand (Space), detail (Enter)
- [ ] Catalog page: fitness bars, type badges, search
- [ ] Spaces page: 3 tabs (Repos/Workspaces/Sessions)
- [ ] Spaces page: status filter (a/r), inline expansion, pagination
- [ ] Spaces page: Resume in Agent (J key)
- [ ] Models page: model status + model list + detail
- [ ] Block detail: 3 panels (Info/Fitness/Sessions) + view source
- [ ] Session detail: full SessionMonitor (3 modes)
- [ ] Workspace detail: sessions list + settings
- [ ] Repo detail: sessions list + .maestro/ info
- [ ] Model detail: 3 panels (Health/Usage/Performance)

### Page Registry

- [ ] PageRegistry class: register(), getById(), getAt(), getAll(), getRing(), getDirectionHints()
- [ ] 5 built-in pages registered at init (Agent, Execution, Catalog, Spaces, Models)
- [ ] Adding a page = ONE register() call + ONE component — no other file changes
- [ ] StatusBar direction hints auto-generated from registry
- [ ] CommandPalette NAVIGATION section auto-populated from registry
- [ ] HelpOverlay SPATIAL NAVIGATION section auto-generated from registry
- [ ] Ring rotation computed from registry (sorted by angle around center)
- [ ] Empty grid cells = no-op (no wrapping, no error)

### Navigation

- [ ] Ctrl+Arrow: navigate to adjacent page (computed from Page Registry grid)
- [ ] Ring rotation: Ctrl+Left/Right from non-center pages (computed from registry)
- [ ] Esc: always returns to Agent (0,0)
- [ ] Ctrl+Tab: quick-switch between last 2 pages
- [ ] J: join agent (teleport)
- [ ] Ctrl+K: command palette
- [ ] Ctrl+D: current session detail
- [ ] Ctrl+C: quit (with confirmation)
- [ ] Slash commands from Agent: /catalog, /spaces, /models, /help, /session, /back, /join, /quit
- [ ] Transition animation (1-frame directional wipe)

### Agent-in-the-Cockpit

- [ ] Dual positions: userScreen + agentScreen
- [ ] JOIN: J key, user teleports to agent
- [ ] CALL: agent arrives on user's page, overlay appears
- [ ] DETACH: Esc or manual navigation, user moves freely
- [ ] Mini-panel overlay when agent is on same page
- [ ] StatusBar shows agent location when on different page
- [ ] Direction arrow pulses when agent is on that page
- [ ] Auto-follow when following=true
- [ ] Auto-detach when user manually navigates elsewhere
- [ ] Notification toast on agent events (complete/error/needs-input)

### Mascotte

- [ ] 7 states: idle, working, waiting-input, navigating, error, celebrating, thinking
- [ ] 4 sizes: full (24x13), compact (16x1), mini (3x1), overlay (16x5)
- [ ] Per-state animations (breathing, pulse, wave, running, shaking, confetti, dots)
- [ ] Per-state colors (core, eyes, border)
- [ ] Personality events (sleep, wake, nod, celebrate)

### Panels (all from monitor)

- [ ] WorkflowTree: interactive expand/collapse, cursor, auto-expand running
- [ ] PhaseWorkflow: phases + execution merged, auto-expand running phase
- [ ] ExecutionLog: tail -f, 50 entries, colored levels
- [ ] LLMActivity: chat-like, prompt/response preview, metadata
- [ ] MetricsPanel: fitness, quality, tokens, iteration, plateau, sparkline
- [ ] Variables: grouped (Config/State/Other), formatted values
- [ ] Filesystem: directory tree, access colors, 3-level max
- [ ] Artifacts: produced files list
- [ ] CommandLog: command history, newest first
- [ ] WidgetsPanel: 7 types + auto-defaults + context panel
- [ ] Panel focus cycling (Tab/Shift+Tab/1-2-3)
- [ ] Panel zoom (z/Esc)
- [ ] Panel toggles (t/f/w/v/l)
- [ ] Per-panel scroll state
- [ ] Mouse click-to-focus + scroll wheel

### Interactive Widgets (Agent page)

- [ ] message: text display
- [ ] progress: multi-phase tracker
- [ ] confirmation: yes/no
- [ ] option-select: multiple choice
- [ ] plan-view: implementation plan
- [ ] test-results: test suite

### StatusBar

- [ ] Page position indicator (●/⠹/★/↑/←/→/↓)
- [ ] Direction hints with availability
- [ ] Agent status when elsewhere ("⠹ Agent in X — [J]oin")
- [ ] Focused panel indicator (◈ PANEL)
- [ ] Zoomed panel indicator (▣ PANEL)
- [ ] Context-sensitive shortcuts

### Notifications

- [ ] Toast at top: task complete, task error, needs input
- [ ] Auto-dismiss (5s)
- [ ] Terminal bell on key events (configurable)

### Command Palette

- [ ] Ctrl+K opens modal
- [ ] Fuzzy search across: sessions, blocks, commands, pages
- [ ] Categorized results: Recent / Navigation / Actions / Sessions / Blocks
- [ ] Enter to select, Esc to close

### Demo Mode

- [ ] `--demo` flag, explicit
- [ ] [DEMO] badge
- [ ] Auto-creates mock session
- [ ] Progressive data (tree, log, LLM, metrics)
- [ ] All navigation works
- [ ] Mock data for Catalog, Spaces, Models
- [ ] No-backend = error screen (not silent)

### Responsive

- [ ] Width: 120+ / 100-119 / 80-99 / 60-79 / <60 warning
- [ ] Height: 35+ / 25-34 / 20-24 / <20 minimal
- [ ] Execution page: 4-quad / 2-col / 1-col / warning

### Terminal Effects

- [ ] Background color on startup, reset on exit
- [ ] Bell on events (configurable)
- [ ] Splash screen (1.5s, pixel art)

### Accessibility

- [ ] All navigation keyboard-only (no mouse required)
- [ ] Vim-style alternatives (j/k for up/down)
- [ ] High-contrast status colors
- [ ] Screen reader hints (semantic terminal output)

### Headless/Pipe

- [ ] `--headless --task "..." --repo "..."` mode
- [ ] Structured timestamped output
- [ ] Exit codes
- [ ] `--pipe` mode with JSON events

### Integration

- [ ] Import all 11 panels from @maestro/tui
- [ ] Import all 8 screens from @maestro/monitor
- [ ] Import all 11 hooks from @maestro/tui
- [ ] Terminal background from @maestro/tui theme
- [ ] Consistent theme across all components

---

## Summary

This design makes **Maestro Code** the definitive TUI — combining:

1. **Claude Code's conversational simplicity** (the Agent page)
2. **The monitor's mature cockpit** (the Execution page, with all 11 panels and 3 modes)
3. **Flipper Zero's spatial personality** (compass navigation, mascotte with 7 states)
4. **Nintendo Gameboy's charm** (pixel art, simple directional controls, one screen at a time)
5. **VS Code's power** (command palette, fuzzy search, keyboard-first)
6. **Plugin-like extensibility** (Page Registry: one call to add a page, everything auto-updates)

Every feature from the monitor is preserved. The Agent-in-the-Cockpit system (JOIN/CALL/DETACH) adds a layer of interactivity unique to Maestro. The Page Registry makes the grid infinitely extensible without touching navigation code. The notification system and command palette add polish. The mascotte gives it soul.

No regressions. No hardcoded limits. Everything gained.
