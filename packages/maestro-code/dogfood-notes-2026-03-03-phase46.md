# Dogfood Notes — Phase 46 Real Validation (2026-03-03)

## Context
- Phase 46: Solidification (bug fix 46-A, TypeScript 46-C/D, UX polish 46-E, first-run test 46-F)
- Method: direct PTY interaction via node-pty + @xterm/headless, manual observation
- Not scripted — each capture is a deliberate interaction step

---

## BUG FOUND: Conversation ID empty on first message

**Severity: HIGH — blocks the core use case**

When sending "Hello, what can you help me with?" to the agent:
```
✓ Ensure Conversation
✗ Save User Message
    Error: (error: Block 'conversation' failed: Conversation '' not found.)
```

The workflow `maestro-assistant` runs `ensure-conversation` which succeeds, but then `save-user-message` calls the conversation block with an empty ID (`''`). The conversation was created but its ID wasn't propagated to the next step.

**Execution log from session detail confirms:**
```
22:58:26 [success]  ensure-conversation: Completed (49 chars)
22:58:26 [info]  Executing blockRef 'conversation' with 5 inputs
22:58:26 [error]  blockRef 'conversation' failed: Conversation '' not found.
```

**Impact**: The agent cannot respond to ANY user message. This is the primary use case. Phase 46-A fixed `importSessionTemplate` being passed through, but the workflow itself has a conversation variable wiring bug.

**Root cause hypothesis**: The `ensure-conversation` step outputs a conversation ID, but the `save-user-message` step reads it from a variable that wasn't set (or was set to empty string). Need to check `maestro-assistant-workflow.block.json` variable wiring.

---

## Page-by-Page Observations

### Agent Page
- **PASS**: NavBar renders correctly with all 6 pages + Ctrl+←→ hint
- **PASS**: AGENT STATUS panel shows idle/working/error states correctly
- **PASS**: CONVERSATION panel shows welcome message, user input, execution steps, errors
- **PASS**: ACTIONS panel shows contextual shortcuts ([G] Go to session appears only when session exists)
- **PASS**: TaskInputBar shows "Press / to type..." when idle, "Agent is working..." when busy
- **PASS**: Status bar shows connection status + response time
- **PASS**: Welcome message: "Welcome to Maestro Code. Press / to type a task." (46-E confirmed)
- **PASS**: Session messages consolidated: "Starting session..." → "Session ready (941b1027)" (46-E confirmed)
- **PASS**: Error display: "Task completed with errors" with error details visible
- **OBSERVATION**: "C:Cantante" in status bar — missing backslash in path display (cosmetic, minor)
- **OBSERVATION**: After error, agent goes back to idle after 10s (46-E timer confirmed)
- **OBSERVATION**: Session history NOT restored on re-launch — "No active session" even though session 941b1027 exists

### Home Page
- **PASS**: SYSTEM STATUS panel visible
- **PASS**: ACTIVE SESSIONS list shows real sessions with names, IDs, status, fitness
- **PASS**: 141 sessions total, pagination "Page 1/15 [PgUp/PgDn]"
- **PASS**: Session names properly truncated
- **PASS**: Quick actions panel: [S] Spaces, [F] Foundry, [C] Catalog, [M] Models, [Enter] Open session
- **PASS**: First session is our just-created one: "Cantante — Hello, what c 941b1027 idle"
- **OBSERVATION**: "fit: -" for all sessions — no fitness scores computed (expected, no fitness blocks configured)

### Spaces Page
- **PASS**: Tab navigation: [1] Repos [2] Workspaces [3] Sessions
- **PASS**: Sessions list with 141 entries, filter [r] All
- **PASS**: Selected session shows expanded detail: full UUID, entry points
- **PASS**: Entry points listed: "message, new-conversation, clear-conversation"
- **PASS**: Scroll works — arrow down moves selection, list scrolls
- **PASS**: "9/141 ▼" counter updates correctly
- **BUG (cosmetic)**: Some timestamps show negative: "-h 38m", "-5h 0m" — time calculation issue for sessions that haven't been started
- **OBSERVATION**: Many duplicate "Cantante — Assistant" sessions from previous testing — no cleanup mechanism visible

### Session Detail (from Spaces → Enter)
- **PASS**: SESSION header with name, ID, status, duration
- **PASS**: PHASES/WORKFLOW panel with execution tree
- **PASS**: LLM ACTIVITY panel (empty — no LLM calls for this failed session)
- **PASS**: EXECUTION LOG shows workflow steps with timestamps and status
- **PASS**: Error visible in execution log: "blockRef 'conversation' failed: Conversation '' not found."
- **PASS**: Panel navigation hints in status bar: [Tab]panel [z]oom [1-3]jump
- **OBSERVATION**: Session with no prior execution (54204fb1) shows VARIABLES and FILESYSTEM panels instead of PHASES — different layout based on session type. Shows "(no variables set)" and "(no working directory bound)"
- **OBSERVATION**: Command hints visible: "set with: maestro session vars <id> set <key> <value>"

### Foundry Page
- **PASS**: MY BLOCKS header
- **PASS**: 142 blocks listed with type counts: "34 workflow, 36 agent, 46 tool, 17 inference, 5 ui, 2 context, 1 conversation, 1 memory"
- **PASS**: Each block shows type tag, name, and ID
- **PASS**: Alphabetical sorting within type groups
- **PASS**: Scroll indicator: "1/142 ▼"
- **PASS**: All block types have colored [tags]
- **OBSERVATION**: The list is ALL blocks, not "my" blocks — might be confusing. "MY BLOCKS" implies user-created only.

### Catalog Page
- **PASS**: BLOCK CATALOG header
- **PASS**: Type filter tabs: [1] All [2] Workflows [3] Agents [4] Tools
- **PASS**: 142 blocks with descriptions visible
- **PASS**: Each entry: [type] Name, truncated ID, description preview
- **PASS**: Clean layout, readable
- **OBSERVATION**: Catalog and Foundry show the same blocks in different views — Foundry = editing context, Catalog = browsing context. Distinction is clear from the layout.

### Models Page
- **PASS**: Three-panel layout: MODEL STATUS | PROVIDERS | AVAILABLE MODELS
- **PASS**: MODEL STATUS shows "Loading..." with dashes for values (LLM-Provider health endpoint slow?)
- **PASS**: PROVIDERS panel shows configured providers:
  - ✓ Claude Code (CLI) with path
  - ✓ Local (FastAPI) with URL
- **PASS**: [R] Reconfigure action visible
- **PASS**: AVAILABLE MODELS: "0 models available — No models found — Is the LLM provider running?"
- **OBSERVATION**: LLM-Provider is running on 5010 but models list is empty. The health endpoint may not return models. The "Is the LLM provider running?" message is appropriate.
- **OBSERVATION**: Claude Code path truncated: "...thu\.local\bin\claude.exe" — panel too narrow for full path

### Navigation
- **PASS**: All hotkeys work: h, a, s, f, c, m
- **PASS**: Escape returns from detail view to list
- **PASS**: Arrow keys scroll lists
- **PASS**: Enter opens detail views
- **PASS**: Status bar updates contextually per page

---

## Demo Mode
- **PASS**: Full agent lifecycle: working → steps (Analyze, Design, Write, Tests, Prepare, Review, Commit) → completed → output
- **PASS**: "Session restored (6f576083)" — demo session appears instantly
- **PASS**: Agent output: "Changes look correct. No security issues."
- **PASS**: After completion, TaskInputBar returns to "Press / to type..."

## First-Run Flow (no providers)
- **PASS**: Provider Setup screen appears when config has no providers
- **PASS**: 4 providers listed with toggle keys
- **PASS**: Selection works: '1' toggles [x], shows "Selected: Claude Code (CLI)"
- **PASS**: Enter → Claude Code Setup with auto-detection
- **PASS**: CLI path found automatically
- **PASS**: Enter → agent page loads, backend connected

---

## Bugs Found

| # | Severity | Description |
|---|----------|-------------|
| 1 | **HIGH** | Conversation ID empty on first message — `save-user-message` gets `''` instead of conversation UUID. Agent cannot respond to any message. |
| 2 | Low | Negative timestamps in Spaces: "-h 38m", "-5h 0m" for sessions with status "created" |
| 3 | Cosmetic | Path display missing backslash: "C:Cantante" instead of "C:\Cantante" |
| 4 | Cosmetic | Claude Code path truncated in Models page |

## UX Observations (non-bugs)

| Observation | Suggestion |
|-------------|------------|
| 141 old sessions visible, many duplicates | Add session cleanup/archive feature (post-V1) |
| "MY BLOCKS" in Foundry shows all blocks | Consider renaming or filtering |
| No session restore on re-launch | Agent page shows "No active session" — should it offer to restore last? |
| Fitness always "-" | Expected — no fitness blocks configured |

---

## Summary

**Navigation and rendering: PASS** — all 6 pages render correctly, navigation works, data loads
**First-run flow: PASS** — provider setup → agent page works end-to-end
**Demo mode: PASS** — full lifecycle demonstrated
**Agent conversation: FAIL** — conversation ID empty, agent cannot respond

The critical blocker for V1 is Bug #1: the agent can't actually respond to messages. This is in the workflow JSON (maestro-assistant-workflow.block.json), not in the TUI code. Phase 46's TUI work is solid, but the end-to-end experience is broken by the workflow.

Validated at: 2026-03-03T18:00
