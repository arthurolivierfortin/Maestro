# Dogfood Notes — 2026-02-27 — V1 Feature Gaps & Issues

> **PURPOSE: DISCOVERY ONLY.** This session identifies all bugs and missing features.
> No fixes are made here. Results feed into phase planning.

## Context
- **Date**: 2026-02-27
- **Observer**: User (manual dogfooding, not scripted)
- **Target**: `maestro-code` TUI interactive mode
- **Repo**: C:\Cantante
- **Goal**: Deep audit of bugs, UX issues, and missing features required for V1. **Not a fix session.**

## Architectural Decisions Made During This Session
- **ADR: Conversation Management** → `docs/system/design-decisions/ADR-CONVERSATION-MANAGEMENT.md`
  - Option B selected: Workflow-driven persistent conversations
  - One session per repo (persisted in `.maestro/session.json`)
  - Conversation block as workflow node, not executor-internal
  - `/new`, `/switch`, `/clear` as entry point invocations

---

## LIVE DOGFOODING SESSION (TuiDriver/PTY)

> Executed via `tests/_dogfood-features.ts` — TuiDriver spawns the TUI in demo mode,
> captures frames, sends keystrokes, observes what the user actually sees.

### Render Timing Issues (CRITICAL for first impression)

| Page | First Render | Notes |
|------|-------------|-------|
| Agent (default) | **BLANK** (0 lines at 2.5s) | User sees nothing on launch. Renders later after interaction. |
| Home | **BLANK** (0 lines) | Never rendered in allocated time window |
| Spaces | **OK** (45 lines) | Full render: NavBar, tabs, sessions, status bar |
| Foundry | **BLANK** (0 lines) | DemoApiClient may not return blocks, or render too slow |
| Catalog | **BLANK** (0 lines) | Same issue |
| Models | **OK** (45 lines, on second visit) | Shows 6 models, status, but `Active Model: -` (always blank) |

**Root cause hypothesis**: The Agent and Home pages rely on `useApiData` hooks that need async data fetching. In demo mode, the DemoApiClient has data but the render cycle may need a second tick. The `waitForRender` checks for box-drawing characters — if the initial React render cycle hasn't produced them yet, the frame is captured as empty.

### Confirmed Bugs (observed in live frames)

| ID | What I Saw | Severity |
|----|-----------|----------|
| LIVE-1 | Agent page blank on first render — user sees nothing for 2.5s | HIGH |
| LIVE-2 | Home page never rendered — always blank | HIGH |
| LIVE-3 | Foundry page blank — no blocks visible | HIGH |
| LIVE-4 | Catalog page blank — no blocks visible | HIGH |
| LIVE-5 | `A` key on Spaces → navigated to Agent page (key conflict confirmed) | HIGH |
| LIVE-6 | `?` key on Home → triggered Quit dialog instead of help | HIGH |
| LIVE-7 | `Active Model: -` on Models page — activeModel field mismatch | MEDIUM |
| LIVE-8 | Session detail via `G` key → blank (0 lines) — SessionMonitor empty | HIGH |
| LIVE-9 | `/help` sent as agent task, not parsed as command | CRITICAL |
| LIVE-10 | `/clear` sent as agent task — conversation NOT cleared | HIGH |
| LIVE-11 | All slash commands (`/new`,`/stop`,`/model`,`/status`) treated as agent messages | CRITICAL |
| LIVE-12 | No `?` help overlay on Agent page | HIGH |
| LIVE-13 | Backspace left residual text (`hello worl` instead of empty) — off-by-one? | MEDIUM |
| LIVE-14 | Quit dialog text on Home says "Quit Maestro Code?" (correct) but appears via `?` not `q` | MEDIUM |

### What Works Well (positive observations)

- Spaces page renders correctly with all elements (NavBar, tabs, session list with statuses, expandable detail)
- Agent workflow in demo: task submitted → ✓ Analyze → ✓ Design → ✓ Write → ✓ Test → ✓ Review → ✓ Commit → Agent response
- Input bar: `/` focus, text input visible, Enter submits, conversation log updates
- Letter navigation (H/A/S/F/C/M) works across pages
- StatusBar shows connection status, latency, timestamp, shortcut hints
- Scroll indicators (▲▼) appear when conversation has more content than visible area
- Agent state transitions visible: idle → working (with breathing dot) → completed → idle
- Session ID shown in Agent Status panel

### Missing Features Confirmed by Live Observation

1. **No slash command system** — everything is sent as a task to the agent
2. **No help overlay on most pages** — `?` doesn't show help anywhere except SessionMonitor
3. **No working directory indicator** — user cannot see which repo is being used
4. **No token/context/cost display** — zero resource visibility
5. **No git info** — no branch, no status
6. **Foundry is read-only** — no create/edit/delete/publish actions
7. **Models page is display-only** — cannot switch model
8. **No cancel/stop** — no way to interrupt a running agent task
9. **No error recovery** — if something fails, no retry action

---

## BUG-1: Sessions Created by Agent Have No Blocks/Phases

**Observed**: When the agent creates a session and the user navigates to it (via `G` or from Spaces), the session detail view (SessionMonitor) shows no phases, no execution blocks, no meaningful internal structure.

**Root cause**: The `maestro-assistant` session template (`content/system/templates/sessions/maestro-assistant.session.json`) defines:
- No `_phases` variable (the template has none)
- A minimal `_monitorDescriptor` with only `exec-tree` and `exec-log` components
- `_executionTree` starts as `[]`

The session is functional (the agent executes entry points and results appear in the conversation log), but when the user drills into the session detail, it looks empty because:
1. There are no phases to display
2. The execution tree only gets populated during active execution and may clear after
3. The `_monitorDescriptor` doesn't include phases, metrics, or context panels

**Expected**: When entering a session, the user should see useful information:
- What the agent is doing (execution tree with named nodes)
- What it has done (history of executed tasks)
- Current context (files read, tools used)
- Session metrics (tokens used, time, cost)

**Severity**: Medium-High. The session detail exists but is practically useless for the user.

**Fix direction**:
1. Add a `_phases` definition to the assistant template (e.g., `receive → plan → execute → summarize`)
2. Add richer `_monitorDescriptor` components (conversation panel, context panel, artifacts)
3. Persist execution history across invocations (currently `_executionTree` resets per invoke)

---

## BUG-2: New Session Created on Every TUI Launch (Session Pollution)

**Observed**: Every time the user launches `maestro code`, a new session is created on the first message. Previous sessions accumulate in Spaces but are never reused. After several uses, the Spaces > Sessions tab is polluted with abandoned sessions like `Cantante — Assistant`, `Cantante — Assistant`, `Cantante — Assistant`...

**Root cause**: `SessionManager.ts` line 59: `sessionReady: boolean = false`. This flag resets on every TUI instantiation. There is no persistence of the session ID across TUI restarts.

**Current behavior**:
- TUI launch → user types message → new session created → used for all messages in this TUI instance
- TUI quit + relaunch → new session created again
- Old sessions remain in backend, visible in Spaces, never cleaned up

**Discussion — Session vs Conversation**:

In Maestro's architecture, a **session** is a stateful container with variables, execution history, and configuration. A **conversation** is conceptually a series of messages within a session. The distinction matters:

| Approach | Pros | Cons |
|----------|------|------|
| **Reuse same session** (per repo) | No pollution, persistent context, conversation history preserved | Session state can grow unbounded, harder to "start fresh", old errors carry over |
| **New session per launch** (current) | Clean slate each time, no state corruption | Pollution, no context preservation, wasteful |
| **Explicit conversation management** | User controls when to reuse/create | More UX complexity, needs UI for conversation switching |

**Recommendation**: Hybrid approach:
1. **Default**: Reuse the last active session for the same repo (persist session ID in `.maestro/` local config)
2. **`/new` slash command**: Explicitly create a new conversation/session
3. **`/switch` or conversation picker**: Let the user choose from recent sessions
4. **Auto-archive**: Sessions idle for >24h get archived automatically

This gives the best of both worlds: persistence by default, clean start on demand.

---

## BUG-3: Keyboard Shortcut Conflicts Between Pages

**Observed**: Some page-specific shortcuts conflict with global navigation or don't work as expected.

### Confirmed Conflicts

1. **SpacesScreen: `A` key conflict** (`SpacesScreen.ts` line 321 vs 325)
   - `A` is bound to both `setStatusFilter('all')` (sessions filter) AND `onNavigate('agent')` (page navigation)
   - The chrome navigation binding overwrites the filter binding (spread operator order)
   - **Result**: Pressing `A` on Spaces navigates away instead of filtering — broken UX
   - **Fix**: Use a different key for the "All" filter (e.g., `0` for "all", or only filter when sessions tab is active)

2. **SessionMonitor: `F` key conflict** (`SessionMonitor.ts`)
   - `F` is bound to `toggle.files` (toggle files panel) AND `page.foundry` (navigate to Foundry)
   - The resolver puts toggle actions first, so `F` toggles files — cannot navigate to Foundry from SessionMonitor
   - **Fix**: Use different keys for panel toggles (e.g., `Ctrl+F` for files, `Ctrl+T` for tree)

3. **SessionMonitor: `H` key conflict**
   - `H` is bound to both `page.home` (navigation) AND could conflict with help
   - Less severe since `?` is the help key, but `H` = Home means you can accidentally leave SessionMonitor

### Missing/Non-functional Shortcuts

4. **No `?` help overlay on most pages**: Only SessionMonitor has a help overlay. Agent, Home, Spaces, Foundry, Catalog, Models pages have NO way to see available shortcuts in-context.

5. **`V` (View source JSON) in BlockDetail**: Listed in the Actions panel but actually triggers `toggle.vars` from the action keyboard instead of showing block JSON source.

6. **No `Ctrl+C` task cancellation**: `Ctrl+C` kills the entire TUI. There's no way to cancel just the running agent task.

### General Shortcut UX Issues

7. **No visual feedback on shortcut press**: Pressing a key that does nothing gives no feedback. The user doesn't know if the key was consumed, ignored, or invalid.

8. **No shortcut cheat sheet**: No global `?` or `/help` that shows ALL shortcuts across all pages.

---

## MISSING-V1: Deep Analysis of Missing Features for V1

### Tier 1 — CRITICAL (Cannot ship without these)

| # | Feature | Current State | Why Critical |
|---|---------|--------------|--------------|
| 1 | **Conversation management** (`/clear`, `/new`) | No way to clear context or start fresh without restarting TUI | Users need to manage conversations — this is table stakes for any chat interface |
| 2 | **Task cancellation** (`Ctrl+C` or `/stop`) | No way to abort a running task | Agent can be stuck or doing wrong work — user must be able to stop it |
| 3 | **Session reuse across TUI restarts** | New session every launch | See BUG-2. Session pollution, no context persistence |
| 4 | **Working directory indicator** | Repo path passed via CLI but not shown | User must know WHAT repo the agent is operating on |
| 5 | **Error detail + retry** | Single-line error in conversation, no retry | Errors should be expandable, with a "retry" action |
| 6 | **Slash command system** | Only `/quit` and `/q` exist | Need at minimum: `/help`, `/clear`, `/new`, `/stop`, `/model`, `/status` |
| 7 | **Help overlay on ALL pages** | Only SessionMonitor has `?` | User must be able to discover shortcuts from any page |
| 8 | **Context/token usage display** | Zero visibility into context window | User needs to know when context is full, what's in it |

### Tier 2 — IMPORTANT (Expected in a V1, bad UX without them)

| # | Feature | Current State | Why Important |
|---|---------|--------------|---------------|
| 9 | **Block creation/editing from TUI** | Foundry + Catalog are read-only browsers | The user says "I can't even build blocks from maestro code manually" — this is a core feature |
| 10 | **Block approval/publication panel** | No UI for pending blocks, review, approve/reject, publish | Foundry workflow is CLI-only — TUI should surface pending blocks for review |
| 11 | **Multi-line input** | Single-line only in TaskInputBar | Pasting code blocks, writing detailed prompts requires multi-line |
| 12 | **Conversation switching** | Cannot switch between sessions/conversations | Need a quick-switch panel or `/switch` command |
| 13 | **Diff view for file changes** | Agent changes logged as text lines | User should see actual diffs before/after, ideally with approve/reject |
| 14 | **Model switching from Models page** | Models page is display-only | User should be able to select a model for the current session |
| 15 | **Git status integration** | No git info anywhere | Branch, uncommitted changes, last commit — essential for a code assistant |
| 16 | **Cost/token tracking** | No display of usage | Users need to know the cost of their sessions |
| 17 | **Clipboard (copy from conversation)** | No copy support | User needs to copy agent output |

### Tier 3 — NICE TO HAVE (Good for V1, not blocking)

| # | Feature | Current State | Why Nice |
|---|---------|--------------|----------|
| 18 | **Onboarding / first-run experience** | Just "Type a task and press Enter" | New users need guidance |
| 19 | **File tree browser** | Only in SessionMonitor detail view | Quick file reference from Agent page |
| 20 | **Input autocomplete** (commands, files, blocks) | None | Discoverability and speed |
| 21 | **Notification/toast system** | Terminal bell only | Visual confirmation of actions |
| 22 | **Theme switching** | Hardcoded | Personalization |
| 23 | **Session deletion/archiving** | Cannot delete from TUI | Cleanup |
| 24 | **Voice mode UI** | Audio types exist, Ctrl+V bound, no UI | Nice for accessibility |
| 25 | **Conversation export/save** | No export | Useful for documentation |
| 26 | **Agent interruption (human-in-the-loop)** | Widget system exists but one-directional | User should be able to guide mid-task |

---

## Analysis: Why Didn't Dogfooding Catch These?

### Problem 1: Dogfooding methodology is agent-centric, not user-centric

The current `dogfooding-methodology.md` is excellent for an AI agent systematically testing an interface. But it focuses on **"does it work?"** (functional validation) rather than **"is it useful?"** (feature completeness).

An agent testing the TUI will:
- Verify each screen renders correctly
- Test keyboard shortcuts
- Run an agent task and verify completion
- Check API responses match UI display

An agent will NOT naturally ask:
- "Can I start a new conversation without restarting?"
- "Can I build a block from this interface?"
- "What happens when I've been using this for 2 hours and have 15 dead sessions?"
- "Can I see what the agent is doing with my files before it commits?"

### Problem 2: No feature completeness checklist

The dogfooding methodology doesn't include a **"features a V1 needs"** reference checklist. The agent validates what EXISTS but doesn't flag what's MISSING.

### Recommendation: Create a V1 Feature Checklist Document

Create `docs/guides/ai-agents/v1-feature-checklist.md` that defines:
1. **Must-have features** for a V1 code assistant TUI (the Tier 1 list above)
2. **Expected features** (Tier 2)
3. **Nice-to-haves** (Tier 3)
4. **Feature comparison** with competing tools (Claude Code, Cursor, Aider) to establish baseline expectations
5. **Dogfooding scenarios** that specifically test for missing features:
   - "Use the TUI for 30 minutes on a real project. Note every time you want to do something but can't."
   - "Try to manage your conversation context. Can you clear it? Switch to a new topic?"
   - "Try to create and publish a block entirely from the TUI."
   - "Use the TUI, quit, relaunch. Is your context preserved?"

Additionally, add a **Section 8** to `dogfooding-methodology.md`:

> ### 8. Feature Completeness Audit
> After functional testing, step back and ask:
> 1. What did I want to do but couldn't?
> 2. What features would a power user expect that don't exist?
> 3. Compare against the V1 feature checklist — what's missing?
> 4. What workflow bottlenecks did I hit? (had to restart, couldn't undo, etc.)

---

## Items to Plan (NOT to fix now — feeds into phase planning)

> These items are the RAW OUTPUT of dogfooding discovery.
> They should be organized into phases during planning, not executed ad-hoc.

### Bugs (broken behavior)
- [ ] `A` key conflict on SpacesScreen (navigates away instead of filtering)
- [ ] `F` key conflict in SessionMonitor (toggles files instead of navigating to Foundry)
- [ ] `V` (View source JSON) in BlockDetail triggers wrong action
- [ ] Sessions have no phases/blocks when drilled into (empty `_monitorDescriptor`)
- [ ] No conversation continuity between messages (agent has amnesia)
- [ ] Session pollution on every TUI restart

### Missing infrastructure (architectural gaps)
- [ ] Conversation persistence (ADR written: `docs/system/design-decisions/ADR-CONVERSATION-MANAGEMENT.md`)
- [ ] Session reuse across TUI restarts (`.maestro/session.json`)
- [ ] Workflow-driven conversation management (Option B)
- [ ] `conversationHistory` input never wired in TUI → agent
- [ ] `FileSystemConversationManager` (Phase 2 of ADR)

### Missing slash commands
- [ ] `/help` — show all shortcuts + available commands
- [ ] `/clear` — clear/reset conversation
- [ ] `/new` — new conversation (within same session)
- [ ] `/switch` — switch between conversations
- [ ] `/stop` — cancel running task
- [ ] `/model` — switch model
- [ ] `/status` — show system status

### Missing UX features (Tier 1 — V1 critical)
- [ ] Task cancellation (`Ctrl+C` for task, not app)
- [ ] Working directory indicator in Agent status
- [ ] Error detail expansion + retry action
- [ ] `?` help overlay on ALL pages (not just SessionMonitor)
- [ ] Context/token usage display

### Missing features (Tier 2 — V1 expected)
- [ ] Block creation/editing from Foundry page
- [ ] Block approval/publication panel
- [ ] Multi-line input in TaskInputBar
- [ ] Conversation switching UI
- [ ] Diff view for file changes
- [ ] Model switching from Models page
- [ ] Git status integration
- [ ] Cost/token tracking display
- [ ] Clipboard support (copy from conversation)

### Missing features (Tier 3 — post-V1)
- [ ] Onboarding / first-run experience
- [ ] File tree browser from Agent page
- [ ] Input autocomplete (commands, files, blocks)
- [ ] Notification/toast system
- [ ] Theme switching
- [ ] Session deletion/archiving from TUI
- [ ] Voice mode UI
- [ ] Conversation export/save
- [ ] Agent interruption (human-in-the-loop mid-task)

### Methodology improvements
- [ ] Create `docs/guides/ai-agents/v1-feature-checklist.md`
- [ ] Add "Feature Completeness Audit" section to `dogfooding-methodology.md`
- [ ] Define dogfooding scenarios that test for MISSING features, not just broken ones

---

## Conclusion

Maestro Code TUI has solid foundations: 6 pages, 5 detail views, a working agent loop, and a widget system. But it's currently a **monitoring tool**, not a **productivity tool**. The user can watch the agent work, but cannot meaningfully manage conversations, control context, create blocks, or recover from errors.

The most critical architectural gap is **conversation management** — the agent literally has amnesia between messages. The ADR for this has been written and Option B (workflow-driven) accepted.

The gap between "functional prototype" and "V1 release":
- **6 bugs** to fix
- **5 infrastructure gaps** (including conversation ADR)
- **7 slash commands** to implement
- **5 critical UX features**
- **9 expected features**
- **9 nice-to-haves**
- **3 methodology improvements**

These findings should be organized into phases during the next planning session.
