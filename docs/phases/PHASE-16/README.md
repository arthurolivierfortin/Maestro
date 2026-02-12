# Phase 16b: UX Audit & V1 Readiness

**Status**: In Progress
**Date**: February 11, 2026
**Branch**: `feat/MAESTRO-8-create-first-real-session`
**Dependencies**: Phase 15 (TUI Migration), Phase 16a (TypeScript Shared Layer)

---

## Overview

Phase 16b is a comprehensive UX audit of the CLI, TUI Monitor, and Interactive Shell. The goal is to run complete pipelines as a real user would, document every friction point, and produce a prioritized action plan to make Maestro's terminal experience **production-ready and distinctive**.

**Scope**: CLI + Monitor + Shell only (no frontend).
**Method**: Real end-to-end pipeline runs + systematic code audit.
**Outcome**: Prioritized issue list + feature gap analysis for V1.

---

## Audit Structure

### A. Test Scenarios (End-to-End Runs)

| # | Scenario | Template | Goal |
|---|----------|----------|------|
| 1 | **Foundry training loop** | `foundry-default` | Full lifecycle: create → import → start → invoke → monitor → stop |
| 2 | **Compliance testing** | `compliance-tester` | Multi-model testing, 6 phases, report generation |
| 3 | **Interactive shell workflow** | Any | Use `maestro shell` exclusively for an entire session |
| 4 | **Monitor deep navigation** | Any running session | All 5 pages, every keyboard shortcut, panel interactions |
| 5 | **Error & edge cases** | N/A | Service down, bad input, missing blocks, partial failures |

### B. Evaluation Grid

| Category | What We Measure |
|----------|----------------|
| **Discoverability** | Can a new user figure out the commands? Is help progressive? |
| **Navigation** | Keyboard efficiency, panel switching, page transitions |
| **Information Density** | Right info at right time? Visual clutter? Data overflow? |
| **Error Quality** | Actionable messages? Exit codes? Recovery suggestions? |
| **Pipeline Continuity** | Can you stay in one interface for everything? |
| **Integration** | CLI ↔ Monitor ↔ Shell — switching cost, data flow |
| **Resilience** | Small terminals, stale data, lost connections, edge cases |
| **Polish** | Consistency, color usage, output formatting, animations |

---

## Deep Audit Findings

### I. CLI (`maestro-cli/cli.ts` — 6,590 lines)

#### 1. Help System: Overwhelming & Non-Progressive

**Problem**: `maestro --help` dumps ~370 lines. New users see a wall of text and close the terminal.

**Missing**:
- **Subcommand help**: `maestro session --help` shows the global help, not session-specific commands
- **Examples per command**: No inline examples (e.g., `maestro session create --project myproj --name "Test"`)
- **Quick start guide**: No `maestro quickstart` or first-run guidance

**What V1 needs**:
- Tiered help: `--help` = top 10 commands, `session --help` = session subcommands
- Each command group shows 1-2 examples
- `maestro quickstart` walks user through first session

#### 2. Error Handling: Silent Failures & Inconsistent Patterns

**Critical issues**:
- **Mixed output methods**: Some commands use `formatter.error()`, others use raw `console.error()` with emoji. This breaks `--json` mode for those commands.
- **Silent catch blocks**: Logging failures are swallowed silently — violates "no silent failures" philosophy.
- **All errors = exit code 1**: No distinction between user error, not found, server error, timeout. Agents/scripts cannot determine failure reason.

**What V1 needs**:
- All output through `OutputFormatter` — zero raw `console.log/error`
- Exit code convention: 0=success, 1=user error, 2=not found, 3=server error, 4=timeout
- Every error suggests the next action (e.g., "Session not found. Run `maestro sessions` to list available sessions.")

#### 3. Output Consistency: Emoji & Format Chaos

**Problem**: Output mixes emoji icons (📄 ❌ ✅ 🔧 ⚙️) in some commands but uses the `cli-colors` semantic helpers (`c.ok()`, `c.fail()`) in others. This creates:
- Accessibility issues (screen readers read emoji names)
- Broken automated parsing (emoji aren't in `--json` output)
- Visual inconsistency across commands

**What V1 needs**:
- Single style: use `cli-colors` semantic helpers everywhere
- Remove all raw emoji from CLI output
- Consistent table formatting with column width control (not just `console.table()`)

#### 4. Command Naming: Confusing Overlaps

**Three commands that sound the same**:
| Command | Does What | When To Use |
|---------|-----------|-------------|
| `execute <workflow>` | Runs workflow via API | Standalone execution |
| `run <block-id>` | Runs single block via API | Testing a block |
| `session invoke <id> <entry-point>` | Invokes named entry point | Session-bound execution |

Users don't know which to use. Help text doesn't clarify.

**Other naming issues**:
- `projects` (plural) as command, but `--project` (singular) as flag
- `training` is overloaded: manages configs AND runs
- `block publish` AND `approval submit` — same thing? Different? Unclear.

**What V1 needs**:
- Consolidate or clearly differentiate `execute`/`run`/`invoke` with help text
- Consistent singular/plural convention
- Clear command taxonomy in help output

#### 5. Argument Validation: Inconsistent Guards

**Good**: `session create` validates `--project` or `--repo` required.
**Bad**: `run <block-id>` doesn't validate block exists before API call.
**Dangerous**: Positional argument parsing (`argv._[5]`) silently uses `undefined` if user types wrong number of args.

**What V1 needs**:
- Validate all required args before API calls
- Named args over positional where possible (less error-prone)
- Helpful validation messages: "Expected: `maestro session vars <id> set <key> <value>`"

#### 6. The `--json` Flag Conflict

**Problem**: `--json` serves two purposes:
- Boolean: `maestro --json sessions` → JSON output mode
- String: `maestro session vars set <id> key --json '{"a":1}'` → JSON value input

Users will confuse these. A single flag with dual semantics is a UX trap.

**What V1 needs**:
- `--json` = output mode only (boolean)
- `--value '{"a":1}'` or `--json-value '...'` = JSON input value
- Or: detect from context (if after `set`, it's a value)

#### 7. Destructive Operations: Missing Confirmations

| Command | Confirmation? | Risk |
|---------|--------------|------|
| `session delete <id>` | None | Data loss |
| `session stop <id>` | None | Kills running workflow |
| `projects delete <id>` | `--force` required | Good |
| `experiment delete <id>` | `--force` required | Good |

**What V1 needs**: All destructive ops require `--force` or interactive confirmation.

#### 8. Template Discovery

**Problem**: Available templates are hardcoded in the CLI. Users can't discover custom templates or see what templates exist.

**What V1 needs**:
- `maestro templates list` — shows all available session templates
- `maestro templates show <name>` — describes what a template provides
- `session import --template <name>` suggests available templates if name is wrong

#### 9. Broken Code: `promoteAgent` Call Mismatch

**File**: `cli.ts` ~line 5847
The `promoteAgent()` function is called with 4 args but defined with 2. This will crash at runtime. Must fix before V1.

---

### II. TUI Monitor (`maestro-cli/monitor/ink/` — 37 components)

#### 10. Navigation is Hidden & Undiscoverable

**5 pages exist** (Home, Spaces, Foundry, Catalog, Models) but:
- No visible tab bar or page indicator
- Hotkeys (S/F/C/M) only shown on HomeScreen
- If user opens monitor with `--session <id>`, pages are invisible
- Different screens have different shortcut sets — user doesn't know which keys work where

**What V1 needs**:
- **Always-visible navigation bar** at top: `[H]ome | [S]paces | [F]oundry | [C]atalog | [M]odels`
- Page indicator (highlight current page)
- Consistent shortcuts across all screens

#### 11. 35+ Keyboard Shortcuts, 6 Shown

**Problem**: `useKeyboard.ts` registers 35+ handlers (q, r, h, ?, t, f, w, v, l, z, k, j, s, c, m, n, a, numbers, arrows, tab, shift-tab, ctrl+arrows, enter, space, escape). Status bar shows only 6-7.

Users discover shortcuts by accident or not at all. Key features (panel toggling with t/f/w/v/l, tree vim navigation with j/k, zoom with z) remain hidden.

**What V1 needs**:
- **Dynamic status bar**: shows ALL active shortcuts for current mode + focused panel
- **Context-sensitive help**: `?` overlay adapts to current screen/mode
- **First-use hint**: brief shortcut guide on first launch

#### 12. Scroll Limits Are Hardcoded

**Critical**: `MAX_OFFSET = 50` in `useScroll.ts`. If execution log has 200 entries, user can only scroll to entry 50. Content beyond that is inaccessible.

Similarly:
- `MAX_DEPTH = 3` in Filesystem — deep directories silently clipped
- `MAX_ITEMS = 15` in Filesystem — large directories truncated without indication
- Tree size guessed as "100" instead of computed from actual content

**What V1 needs**:
- Dynamic scroll limits based on actual content size
- "... (N more)" indicators when content is truncated
- Scroll position shown (e.g., "Line 45/200")

#### 13. Error States Are Ambiguous

**Problem**: When API connection fails:
- Error banner appears ("stale data")
- But panels still show cached data
- No visual distinction between fresh and stale data (no gray-out, no timestamp)
- All errors show same generic message — no distinction between timeout, 404, server down

**What V1 needs**:
- Gray out / dim panel content when data is stale
- Show "last updated X seconds ago" in status bar
- Specific error messages: "Connection timeout (retrying...)" vs "Session not found" vs "Backend is down"

#### 14. Small Terminals Break Layout

**Problem**: Layout uses hardcoded percentages (60%/40%, 55%/45%). On terminals < 80 columns or < 24 rows:
- Panel widths become too small for content
- No min-width constraint — borders collapse
- Header (9 rows) + status bar (3 rows) = 12 rows of chrome, leaving 12 rows for 3 panels = 4 rows each

**What V1 needs**:
- Min-width check: refuse to render below 60 cols, show message
- Responsive stacking: panels go vertical below 80 cols
- Collapsible header in small terminals

#### 15. Panel Focus: No Direct Jump

**Problem**: Tab cycles through panels sequentially. No way to jump directly to a specific panel. If you're on panel 5 and want panel 1, you press Tab 5 times.

**What V1 needs**:
- Number keys (1-5) to jump directly to panel by number
- Panel labels show their number: `[1] Tree  [2] Phases  [3] Log`

#### 16. Home Screen: 8 Session Limit

**Problem**: `HomeScreen.ts` only shows first 8 sessions. No pagination, no scroll. Users with 20+ sessions can't access session 9 from Home.

**What V1 needs**:
- Scrollable session list with arrow key navigation
- Search/filter: type to filter sessions by name
- Show session count: "Showing 8 of 47 sessions"

#### 17. Metrics Only Visible in Descriptor Mode

**Problem**: Current fitness, iteration count, and trend are only shown in `descriptor` mode (via MetricsPanel). In `execution` and `idle` modes, these metrics are invisible. User watching a running session can't see fitness without switching to HomeScreen.

**What V1 needs**: Always show key metrics (fitness, iteration, phase) in the header, regardless of mode.

#### 18. Zoom Mode is Opaque

**Problem**: `z` key zooms focused panel. But:
- If no panel is focused, `z` does nothing (no feedback)
- No indication that `z` again or `Esc` will unzoom
- Help overlay doesn't change when zoomed

**What V1 needs**:
- Show `[z] zoom` only when a panel has focus
- When zoomed: show `[z/Esc] unzoom` in status bar
- Visual indicator (border highlight) on zoomable panels

#### 19. Data Staleness Not Communicated

**Problem**: 2-second polling interval. If latency approaches 2s, refreshes overlap. No warning when data might be out-of-order.

**What V1 needs**:
- Show last-refresh timestamp in status bar
- Warning icon when latency > 1.5s
- Skip overlapping polls

#### 20. Comparison to World-Class TUIs

| Feature | Maestro Current | lazygit / k9s / btop |
|---------|----------------|----------------------|
| Page tabs | Hidden hotkeys | Always-visible tab bar |
| Help | Static overlay | Context-aware, mode-specific |
| Scroll | Hardcoded max | Dynamic, content-sized |
| Panel jump | Tab cycling only | Number keys + direct access |
| Error states | Generic message | Specific + recovery hints |
| Small terminals | Breaks | Graceful reflow |
| Stale data | Not indicated | Grayed out + timestamp |
| Search | None | Type-to-filter everywhere |
| Breadcrumbs | None | Full navigation path |

---

### III. Interactive Shell (`maestro-cli/shell.ts`)

#### 21. Session Context Only Works for `exec`

**Critical**: The `use <id>` command sets a session context, but it only injects the session ID for `exec` commands. All other session subcommands (`info`, `vars`, `invoke`, `entry-points`, `widgets`) are NOT intercepted.

```bash
use abc123
exec "ls"        # → session exec abc123 "ls"     ✓
vars list         # → vars list (not session vars abc123 list)  ✗
invoke start      # → invoke start (not session invoke abc123 start)  ✗
```

**What V1 needs**: Context injection for ALL session subcommands.

#### 22. No Tab Completion

**Problem**: Zero tab completion. Users must type full command names, session IDs, block IDs. No `readline` completer function is defined.

**What V1 needs**:
- Command name completion: `ses<TAB>` → `session`
- Subcommand completion: `session <TAB>` → `create | info | start | ...`
- Session ID completion from recent/active sessions
- Block ID completion from discovery cache

#### 23. History Not Persisted

**Problem**: `historyFile` property is declared but never used. History lives only in readline memory and is lost when shell exits.

**What V1 needs**:
- Load `.maestro_history` on startup
- Append after each command
- Ctrl+R reverse search (readline supports this natively)

#### 24. No Multi-Line JSON Input

**Problem**: Pasting multi-line JSON breaks. The shell parses each line as a separate command.

```bash
maestro> session vars <id> set data '{
# ← Shell tries to execute "data '{" as a command
```

**What V1 needs**:
- Quote-aware multi-line: detect unmatched quotes and continue on next line
- Or: `@filename` syntax to read value from file
- Or: heredoc-style input

#### 25. Cannot Launch Monitor from Shell

**Problem**: `monitor` is not available in the shell. Users must open a separate terminal.

**What V1 needs**:
- `monitor` command in shell (launches in new window)
- With session context: `use <id>` then `monitor` opens monitor for that session

---

### IV. Integration (CLI ↔ Monitor ↔ Shell)

#### 26. Three Separate Terminals Required

**Current reality**:
```
Terminal 1: maestro shell (interactive commands)
Terminal 2: maestro monitor <id> (watch execution)
Terminal 3: backend logs / other tasks
```

Monitor is read-only — cannot execute commands. Shell cannot show monitor. CLI spawns monitor in a new window (fire-and-forget, no error if it fails).

**What V1 needs** (pick one approach):
- **Option A**: Split-pane shell — shell at bottom, monitor at top (like tmux)
- **Option B**: Monitor command palette — press `:` in monitor to execute CLI commands
- **Option C**: Accept multi-terminal, but make switching seamless (named sessions, quick-switch keys)

#### 27. Monitor Launch is Fire-and-Forget

**Problem**: `session start` spawns monitor in a new window with `child.unref()`. If the window fails to open (terminal not found, permission denied), user gets no error. The session is running but the user has no monitoring.

**What V1 needs**:
- Verify monitor process started successfully
- Fallback: if window spawn fails, offer to run monitor inline
- `--no-monitor` flag is documented and discoverable

#### 28. No Unified Session Workflow

**Current flow** (too many commands):
```bash
maestro session create --project myproj --name "Test"
# → returns session ID (must copy-paste)
maestro session import <id> --template foundry-default
maestro session start <id>
maestro session invoke <id> start
```

**What V1 needs**:
- `maestro session create --template foundry-default --start` — one command to create, import, and start
- Auto-copy session ID to clipboard (or assign human-readable name)
- `maestro session last` — show/act on most recently created session

---

### V. Missing Features for V1

#### 29. Cost Tracking per Session/Workspace

**User request**: Limit and visualize cost per session/workspace.

**What's needed**:
- Track token usage per session (inference calls already counted in `_llmActivity`)
- Aggregate tokens → estimated cost based on model pricing
- `session cost <id>` — show token usage and estimated cost
- `session cost --limit <amount>` — set spending cap
- Monitor widget: cost indicator in header

#### 30. Dynamic Workflow Visualization

**User request**: Visualize workflow construction dynamically.

**What's needed**:
- Show the block hierarchy as it's being built during execution
- Animated tree growth in monitor (nodes appear as discovered)
- Block-level timing (how long each node took)
- Critical path highlighting (which branch is slowest)

#### 31. Session Search & Filtering

**What's needed**:
- `maestro sessions --status running` — filter by status
- `maestro sessions --template foundry-default` — filter by template
- `maestro sessions --recent` — last N sessions
- In monitor: type-to-filter session list

#### 32. Log Export & Replay

**What's needed**:
- `session export <id>` — export full session log (execution tree + variables + events)
- `session replay <id>` — step through execution history
- `session diff <id1> <id2>` — compare two session runs

#### 33. Progress Indicators

**What's needed**:
- Spinner during API calls (connect, start, invoke)
- Phase progress: "Phase 2/4: Optimization (iteration 3/10)"
- ETA based on average iteration time

---

## Deliverables

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` (this file) | Phase guide & audit structure | Complete |
| `UX-AUDIT-FINDINGS.md` | Detailed findings from real pipeline runs | Pending |
| `V1-ISSUES.md` | Prioritized action items for V1 | Pending |

## Priority Framework

Issues are categorized by impact on user experience:

| Priority | Criteria | Examples |
|----------|----------|---------|
| **P0 — Blocker** | Broken functionality, data loss risk | `promoteAgent` crash, missing delete confirmations |
| **P1 — Critical** | Major UX friction, blocks common workflows | Exit codes, session context, scroll limits |
| **P2 — Important** | Significant quality gap vs expectations | Tab completion, history persistence, help system |
| **P3 — Polish** | Makes the app stand out | Breadcrumbs, search, cost tracking, progress indicators |
| **P4 — Nice-to-have** | Future enhancements | Replay, diff, split-pane, workflow visualization |

## Verification Plan

After implementing fixes:
1. Run all 5 test scenarios end-to-end with services running
2. Verify `--json` mode works consistently on every command
3. Test on small terminal (80x24) — no layout breaks
4. Test with `NO_COLOR=1` — no ANSI artifacts
5. Test shell: create full session lifecycle using only shell commands
6. Kill backend mid-execution → verify monitor shows clear error
7. New user test: can someone create and run a session from `--help` alone?
