# Dogfooding Notes — maestro-code v1 Feature Gap Analysis

**Date**: 2026-03-01
**Investigator**: Claude (System Validator)
**Goal**: Discover missing features for the first deployable version of maestro-code
**Method**: 10 iterations of systematic exploration via TuiDriver (PTY capture + visual inspection)
**Modes tested**: Demo mode (iterations 1-3, 10) + Real mode with backend (iterations 4-9)
**Terminal sizes**: 120x40 (standard), 60x20 (small)

---

## Executive Summary

maestro-code has a **solid structural foundation** — 6 pages, session management, agent task lifecycle, keyboard navigation. However, it is **not ready for external deployment** without significant work in three areas:

1. **Data hygiene** — 125 orphaned sessions with identical names, duplicate models, empty fitness data, no cleanup tools
2. **Missing core interactions** — no help overlay, no model selection, non-functional catalog filters, no session management actions
3. **First-run experience** — no onboarding, no setup wizard, silent failures, confusing empty states

**Estimated gap**: ~25-30 features/fixes across 4 severity levels.

---

## Iteration Log

### Iteration 1 — Demo Mode: All Pages (visual inventory)

**Observations:**
- **Agent page** (default landing): Clean layout. AGENT STATUS header, CONVERSATION panel (80% width), ACTIONS sidebar (20%). Input bar at bottom with `/ Press / to type...`. Status bar shows connection, latency, clock, keyboard hints.
- **Home page**: SYSTEM STATUS header (shows Backend/LLM health in demo), ACTIVE SESSIONS list with status icons (check/spinner/X), QUICK ACTIONS sidebar. Session count in navbar: `5 sessions (1 running)`.
- **Spaces page**: 3 tabs ([1] Repos, [2] Workspaces, [3] Sessions). Default goes to Sessions. Filter: `[a] All [r] Running`. Expandable rows show session ID and entry point.
- **Foundry page**: "MY BLOCKS" with type-count summary. Lists blocks with `[type]` tags. No fitness display.
- **Catalog page**: "BLOCK CATALOG" with type filter text `All | Workflows | Agents | Tools`. Shows fitness % per block. Block descriptions truncated.
- **Models page**: Split layout — MODEL STATUS (left 40%) and AVAILABLE MODELS (right 60%). Shows provider, device, max tokens, temperature.

**Gap findings:**
- Home SYSTEM STATUS is just a header bar in demo — actual health indicators are inside but not visible without data
- NavBar shows `Ctrl+←→` for page navigation which is misleading — actually use `h/a/s/f/c/m` letter keys
- No page header highlighting to indicate which page is active

---

### Iteration 2 — Demo Mode: Keyboard Navigation

**Observations:**
- `/` correctly focuses input: prompt changes to `> Send a message to the agent...`
- Typing shows input: `> hello test` visible in input bar
- `Escape` correctly unfocuses: back to `/ Press / to type...`
- Tab cycling on home page: first Tab shows same content (no visual change indicating focused panel)
- **BUG: Second Tab → blank screen (0 lines captured)**
- Down arrow navigation on Spaces page works (selection moves)
- **BUG: Some frames captured as empty (0 non-empty lines)** — possible timing issue with terminal buffer

**Gap findings:**
- **No visual panel focus indicator** — Tab cycles focus but there's no border color change or highlight to show which panel has focus
- **Tab cycle may cause blank frames** — render glitch when cycling between panels
- **Keyboard shortcut conflict**: letter hotkeys (h/s/f/c/m/q) are always active even when not expected, creating accidental navigation

---

### Iteration 3 — Demo Mode: Agent Task Submission

**Observations:**
- Full task lifecycle works: type → submit → see execution nodes → see output → return to idle
- Execution nodes show as timestamped checkmarks: `✓ Analyze Codebase`, `✓ Design Solution`, `✓ Write Code`, `✓ Run Tests`, `✓ Prepare`, `✓ Review`, `✓ Commit`
- Agent output displays inline: `Agent: Changes look correct. No security issues.`
- Second task submission works (conversation accumulates)
- Status transitions: idle → working (with spinner) → completed → idle
- Scroll indicator `▲` appears when conversation overflows

**Gap findings:**
- **Agent output is a single line** — for real tasks, output will be multiline (code blocks, explanations, diffs). No markdown rendering.
- **No execution progress indicator** — nodes appear all at once as ✓. In real mode, they should show running → completed transitions individually.
- **No elapsed time for task** — "Task completed" but no `Duration: 2.3s`
- **No cost indicator** — no token/cost info after task completion
- **After completion, status goes to `idle` not `completed`** — confusing, should stay `completed` until next input

---

### Iteration 4 — Real Mode: Home Page

**Observations:**
- Initial render: `○ Agent: idle C:\Cantante No active session` — correct cold start
- SYSTEM STATUS header visible but **empty** (no Backend/LLM status shown initially)
- After data load (~5s): 125 sessions appear. ALL named `Cantante — Assistant` with 8-char UUID suffixes.
- Session list paginated: `Page 1/13 [PgUp/PgDn] navigate`
- All sessions show `fit: -` (no fitness data)
- Sessions are all `idle` — none running

**Gap findings (CRITICAL):**
- **125 orphaned sessions** — no way to delete, archive, or bulk-manage sessions from the TUI. This is the #1 user experience issue.
- **All sessions identically named** — `Cantante — Assistant` appears 125 times. SessionManager generates this name from `path.basename(repoPath)` + template name. Useless for identification.
- **No session search** — 13 pages of identically-named sessions with no text search
- **SYSTEM STATUS empty on first load** — takes 3-5s for health data to appear. No loading indicator.
- **`fit: -` everywhere** — fitness metric pipeline doesn't feed into TUI display

---

### Iteration 5 — (Skipped: would submit real task to avoid noise)

---

### Iteration 6 — Real Mode: Spaces Page

**Observations:**
- **Repos tab**: First frame empty (0 lines) — render timing. Not retested.
- **Workspaces tab**: Shows 8 workspaces with names, short IDs, and types (Custom/Research). Clean layout.
- **Sessions tab**: 125 sessions. Expandable row shows full UUID and entry point name.
- Scrolling works correctly (selection indicator `→` moves, counter updates `4/125 ▼`).
- **Enter on session → opens SessionMonitor detail view** with PHASES/WORKFLOW, LLM ACTIVITY, and execution log.
- Session detail shows real execution log data with timestamps and agent info.

**Gap findings:**
- **Repos tab may be empty** — default tab showed 0 lines on first capture
- **Session expansion shows ONLY id + entry** — should show: created date, last task description, model used, duration, outcome
- **SessionMonitor detail: "project: N/A"** — project association not populated
- **SessionMonitor: text overflow in execution log** — long lines overlap the status bar border characters
- **"(no phases defined)"** — maestro-assistant sessions don't use phases, so the PHASES/WORKFLOW panel is permanently empty. Wastes screen real estate.
- **LLM ACTIVITY shows stale data**: `unknown (--:--:--)`, `(no prompt)`, `(no response)` for idle sessions. Should be hidden or say "No recent activity"

---

### Iteration 7 — Real Mode: Catalog + Foundry

**Observations:**
- **Catalog**: 142 blocks listed, sorted alphabetically. Shows `[type]` tag, block name (truncated), short ID (truncated), fitness `%` or `-`, description (truncated).
- **Scrolling works** with position counter `6/142 ▼`
- **Type filter text visible**: `All | Workflows | Agents | Tools`
- **BUG: Type filters DON'T WORK** — pressing `2` or `3` does not change the displayed list. Same 142 blocks shown.
- **Foundry page**: empty frame (0 lines captured) — render timing issue

**Gap findings:**
- **Catalog type filters are broken** — the text `All | Workflows | Agents | Tools` is displayed but pressing number keys doesn't filter. This is a core feature of the catalog.
- **Block IDs severely truncated** — `accessibilit`, `decide-actio`, `commit-helpe`. Impossible to distinguish blocks. Need either tooltips on selection or longer display.
- **Block names also truncated** — `Autonomous Development Workflo` cut off
- **Descriptions cut at ~30 chars** — `Audits web pages for WCAG 2...`
- **Duplicate blocks visible** — Two "Checkpoint Manager" entries (one `system:check`, one `checkpoint-m`). No visual distinction.
- **No block search** — 142 blocks with no text filter. Only broken type filter.
- **Many block types beyond the 4 filter categories** — `[ui]`, `[context]`, `[conversation]`, `[inference]`, `[validator]` — these don't fit the `All | Workflows | Agents | Tools` taxonomy. Filter categories are incomplete.
- **No fitness data for most blocks** — just `-`. Only demo mode shows fake percentages.

---

### Iteration 8 — Real Mode: Models

**Observations:**
- **Initial load**: `✗ Status: Offline`, `0 model(s) available` for ~3-4 seconds.
- **After data loads**: `◉ Status: Online`, `17 model(s) available`
- **Active Model: `-`** — no active model detected
- **MODEL STATUS left panel**: Backend `-`, Device `managed`, Max Tokens `-`, Temperature `-` — nearly empty even after data loads
- **Model list**: Shows display name and provider. Duplicates visible: "Claude haiku" 4x, "Claude sonnet" 3x, "Claude opus" 3x.
- **Scrolling works** (selection indicator `→` moves)

**Gap findings:**
- **No model selection action** — can browse models but can't switch/activate a model. The core action for a Models page is missing.
- **Massive model duplication** — 17 models but only ~7 unique (haiku, sonnet, opus, gpt-4o, gpt-4, deepseek, phi-3, llama-3, cohere, mistral). Multiple entries with identical display names per provider.
- **Model names are generic** — "Claude haiku" not "claude-haiku-4-5-20251001". Can't distinguish between different versions.
- **MODEL STATUS panel nearly empty** — Active Model, Backend, Device, Max Tokens, Temperature all show `-`. Only Status works.
- **Initial "Offline" state is misleading** — LLM-Provider is actually running (port 5010 confirmed). The first API call is just slow. Should show "Loading..." not "Offline".
- **No model capability info** — no pricing, context window, speed rating, or use case hints

---

### Iteration 9 — Real Mode: Detail Views

**Observations:**
- **Session list**: 125 sessions visible with good layout. Expansion shows full UUID + entry point.
- **SessionMonitor** (Enter on session): Rich view with SESSION info, METRICS (Fitness 0%, Iter 0), PHASES/WORKFLOW, LLM ACTIVITY, execution log.
- **Execution log shows real data**: Agent config, block dispatch, completion, conversation stats — useful debugging info.
- **Block detail** (Enter on catalog block): Shows block header, INFO panel (ID, Type, Atomic, Version, Author), FITNESS panel, SESSIONS panel, ACTIONS panel.

**Gap findings:**
- **Block type shows `[unknown]`** — even though the catalog shows `[inference]` for the same block. Type resolution fails in detail view.
- **Block fitness panel says "(no fitness data)"** — expected but shows "Run a training session to generate fitness metrics." This is good guidance but fitness never works anyway.
- **"0 session(s) use this block"** — block-to-session linkage not computed or returned by API
- **METRICS panel in session detail always 0%/0 iter** — metrics pipeline not feeding data
- **Session detail: "project: N/A"** — no project metadata associated with sessions
- **Status bar text overlap** — In session monitor view, bottom status bar has garbled text where multiple labels overlap: `connect • 7ms • 02:03:3` overlapping with `[Ctrl+←→]panel [j/k]nav` etc.
- **[v] View source JSON** in block detail — nice action but not tested if it actually works

---

### Iteration 10 — UX Polish: Error States, Edge Cases

**Observations:**
- **Small terminal (60x20)**: Layout breaks significantly.
  - NavBar wraps: `[M]odels` pushed to next line without box border
  - Status bar truncated: `connec • 12m 02:03[Ctrl+←→]page [↑↓]select`
  - Agent status line wraps badly: `○ Agent:       C:\Meast   Session:           ●` on one line, `working        ro         demo-000         Processing...` on next
  - Data columns compress: `✓Cantante - File   sess-  completfit:-` — unreadable
- **Home on small terminal**: Barely functional. Content visible but compressed.
- **`?` key for help**: **DOES NOTHING** — no help overlay, no response at all
- **Rapid page switching**: Typing `h s c m f a h s` fast triggers quit dialog because `q` key in the sequence activates quit confirmation
- **Quit dialog**: `Quit Maestro Code? [Enter/q] Yes [Esc/n] No` — modal that blocks all other UI
- **Quit dialog blocks everything**: After quit dialog appears, `/help` command typed in input bar is visible but blocked by the modal
- **`/help` command**: Works correctly when not blocked — shows help text in conversation log
- **`/new` command**: Not testable due to quit dialog blocking

**Gap findings:**
- **No minimum terminal size enforcement** — app renders broken UI at 60x20 instead of showing "Terminal too small" message
- **No responsive layout** — fixed proportions (80/20 split) don't adapt to narrow terminals
- **`?` help overlay doesn't exist** — status bar shows `[?]` as a hint but key does nothing on main pages
- **Quit confirmation too aggressive** — `q` always triggers quit, even during rapid navigation. Should maybe require Ctrl+Q or double-Q.
- **Quit dialog steals focus** — once active, can't dismiss easily if already typing in input bar

---

## Comprehensive Feature Gap Analysis

### CRITICAL — Must fix before any external deployment

| # | Feature | Impact | Details |
|---|---------|--------|---------|
| C1 | **Session cleanup / delete** | Users accumulate hundreds of orphaned sessions with no way to remove them | Need: delete session action (from list), bulk delete, auto-archive after N days |
| C2 | **Meaningful session names** | 125 sessions named "Cantante — Assistant" are indistinguishable | Need: use first task text as session name (e.g., "Add login page"), or prompt user |
| C3 | **Help system** | `?` key does nothing. New users are completely lost | Need: help overlay showing all keybindings per page, or at minimum `?` → `/help` output |
| C4 | **Catalog type filters** | Broken — number keys don't filter. Core catalog feature | Fix the filter key handler in CatalogScreen.ts |
| C5 | **Model selection** | Can see models but can't switch active model — makes Models page read-only | Need: Enter on model → switch active model (via API call) |
| C6 | **Block type in detail view** | Shows `[unknown]` even for typed blocks | Fix type resolution in BlockDetail.ts (likely using wrong field from API) |
| C7 | **Error state: "Offline" on loading** | Models page shows "Offline" for 3-4s while data loads. Users think LLM is down | Show "Loading..." instead of "Offline" during initial fetch |

### HIGH — Important for a good v1 experience

| # | Feature | Impact | Details |
|---|---------|--------|---------|
| H1 | **First-launch onboarding** | New user sees empty Agent page with no explanation | Need: welcome message, guided first task, explanation of what Maestro does |
| H2 | **Session search/filter** | 125 sessions with only All/Running filter | Need: text search on session name, date filter, status filter |
| H3 | **SYSTEM STATUS content** | Home page header is empty for 3-5s, then still minimal | Need: Backend/LLM health indicators visible immediately (with loading state) |
| H4 | **Task completion feedback** | No elapsed time, no cost, no token count after task | Need: `Task completed in 2.3s (1200 tokens, $0.002)` summary line |
| H5 | **Model deduplication** | "Claude haiku" shown 4x, "Claude opus" 3x | Deduplicate by model ID or show model ID not display name |
| H6 | **Model name specificity** | "Claude haiku" vs "claude-haiku-4-5" — can't tell version | Show model ID or version alongside display name |
| H7 | **Agent output formatting** | Single-line plain text output. Real tasks produce code, diffs, explanations | Need: markdown rendering (code blocks, bold, lists at minimum) |
| H8 | **Quit dialog sensitivity** | `q` during rapid nav triggers quit. Modal blocks all input | Consider Ctrl+Q, or debounce, or don't trigger from non-navigation context |
| H9 | **Small terminal handling** | Layout breaks at 60x20 — garbled text, overlapping elements | Minimum: show "Terminal too small (need 80x24)" message. Better: responsive layout |
| H10 | **Panel focus indicator** | Tab cycling has no visual feedback. Can't tell which panel is focused | Need: highlighted border or header color change for focused panel |
| H11 | **Block search in catalog** | 142 blocks with no text search capability | Need: `/` or search input to filter by name/ID |
| H12 | **Status bar text overflow** | In SessionMonitor, status bar labels overlap at certain widths | Fix text layout — use conditional rendering based on available width |

### MEDIUM — Nice to have for v1, can ship without

| # | Feature | Impact | Details |
|---|---------|--------|---------|
| M1 | **Session expansion details** | Shows only UUID + entry. Need: created date, last task, model used | Enrich session row expansion with more metadata |
| M2 | **Block ID/name truncation** | IDs like `accessibilit` are useless | Show full ID on selection, or use 20+ chars |
| M3 | **Block description expansion** | Descriptions cut at ~30 chars | Show full description on selection/expansion |
| M4 | **Fitness data pipeline** | `fit: -` everywhere — fitness never populated | Wire fitness metrics from backend to TUI display |
| M5 | **Empty panel messaging** | "PHASES/WORKFLOW (no phases defined)" wastes space | Hide empty panels or show contextual guidance |
| M6 | **LLM Activity stale state** | Shows `unknown (--:--:--)` for idle sessions | Hide when no data, or show "No recent LLM activity" |
| M7 | **Active page indicator in navbar** | Can't tell which page is current from navbar alone | Bold or underline or color the active page letter |
| M8 | **Block type filter categories** | Only All/Workflows/Agents/Tools but blocks have many types | Add: inference, validator, tool, script, ui, context, conversation |
| M9 | **Duplicate blocks in catalog** | Two "Checkpoint Manager" entries | Deduplicate or show namespace to distinguish |
| M10 | **Scroll position indicator** | Lists show `Page X/Y` or `N/total` but no scrollbar | Add visual scroll percentage or bar |
| M11 | **Repos tab in Spaces** | Tab exists but first render was empty — may be broken | Verify repos tab loads data correctly |
| M12 | **MODEL STATUS panel mostly empty** | Backend, Max Tokens, Temperature all show `-` | Wire active model metadata into this panel |
| M13 | **Clipboard support** | Can't copy session IDs, block IDs, or agent output | Would be very useful for power users |

### LOW — Post-v1 / Future enhancements

| # | Feature | Impact | Details |
|---|---------|--------|---------|
| L1 | **Conversation persistence** | History lost on restart | Save conversation log to `.maestro/history.json` |
| L2 | **Tab completion for slash commands** | No autocomplete for `/help`, `/new`, etc. | Show dropdown/suggestions on `/` |
| L3 | **Multi-line input** | Can't write multi-line task descriptions | Support Shift+Enter for newlines |
| L4 | **Block execution from catalog** | Can view blocks but can't execute them | Add "Execute" action in block detail |
| L5 | **Metrics dashboard on Home** | No aggregate stats (total tasks, success rate, avg time, cost) | Add metrics summary widget |
| L6 | **Session comparison** | Can't compare two sessions side-by-side | Advanced feature for training/evaluation |
| L7 | **Desktop notifications** | No notification when long task completes | Useful for tasks > 30s |
| L8 | **Theme customization** | No light theme, no color options | Low priority, dark terminal is standard |
| L9 | **Voice mode** | Ctrl+V toggle exists but NoopAudioAdapter | Platform-specific, complex |
| L10 | **Export/share results** | Can't export conversation or results to file | `/export` command or action |

---

## Blocking Issues for V1 (Prioritized Action List)

### Wave 1 — Critical path (must have before any demo)
1. **C1** Session delete/archive from TUI
2. **C2** Auto-name sessions from first task
3. **C3** Help overlay on `?` key
4. **C4** Fix catalog type filters
5. **C7** Loading state instead of "Offline" on Models

### Wave 2 — Core quality (must have before distribution)
6. **H1** First-launch onboarding/welcome
7. **H4** Task completion metrics (time, tokens, cost)
8. **H7** Basic markdown rendering in agent output
9. **H8** Fix quit dialog sensitivity
10. **H9** Minimum terminal size check
11. **C5** Model selection from Models page
12. **C6** Fix block type in detail view

### Wave 3 — Polish (should have for v1)
13. **H2** Session text search
14. **H3** SYSTEM STATUS loading state
15. **H5/H6** Model deduplication and versioned names
16. **H10** Panel focus visual indicator
17. **H11** Block search in catalog
18. **H12** Status bar text overflow fix

---

## Architectural Notes

### What works well
- **Page navigation model** — h/a/s/f/c/m is fast and intuitive once learned
- **SessionManager architecture** — persistent session per repo, lazy creation, polling-based updates
- **Detail view system** — navigation stack with Esc-to-back is clean
- **Execution tree display** — timestamped checkmarks in conversation log are clear
- **Widget system** — infrastructure exists for interactive blocks (progress, input, confirm)
- **Headless mode** — CI-friendly, structured output

### What needs rethinking
- **Session naming strategy** — auto-generated names are useless. Either prompt user or derive from task content.
- **Session lifecycle** — no concept of "completed" sessions being archived. Active clutter grows unbounded.
- **Data loading UX** — multiple pages show misleading states during 3-5s data fetch. Need unified loading pattern.
- **Layout system** — fixed proportions don't adapt to terminal size. Need responsive breakpoints or minimum size enforcement.
- **Type taxonomy** — block types exceed the 4-category filter. Need either a complete taxonomy in the UI or a free-text type filter.

---

## Test Infrastructure Notes
- TuiDriver PTY capture occasionally returns empty frames (0 lines) — timing-sensitive. Added extra `sleep()` between navigation and capture to mitigate.
- node-pty throws `AttachConsole failed` on process cleanup — non-critical error, happens after test completes.
- Demo mode is useful for structural testing but masks data issues (fake fitness, fake sessions).
- Real mode revealed the most important issues (125 orphaned sessions, duplicate models, empty fitness).
