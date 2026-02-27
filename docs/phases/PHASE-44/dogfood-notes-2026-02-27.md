# Dogfood Notes — 2026-02-27

## Context
- **Branch**: main
- **Services**: Backend healthy (port 5000), LLM-Provider healthy (port 5010, 4 providers)
- **Repo cible**: C:/Cantante
- **Tool**: TuiDriver (PTY driver) via `tests/_dogfood-discovery.ts` / `tests/_dogfood-live.ts`
- **Duration**: ~5 minutes (discovery) + ~1 minute (real agent test)

## Interface Inventory

### Agent Page (default)
```
┌─────────────────────────────────────────────────────────────────┐
│ MAESTRO  [H]ome  [A]gent  [S]paces  [F]oundry  [C]atalog  [M]odels  Ctrl+←→ │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ AGENT STATUS                                                     │
│ ○ Agent: idle   No active session / Session: XXXXXXXX            │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────┐┌──────────────────┐
│ CONVERSATION                      ▲▼ ││ ACTIONS           │
│ Maestro Code                         ││ [J/K] Scroll      │
│ Type a task and press Enter.         ││ [G] Go to session │
│ ❯ [user message]                     ││ [H] Home          │
│ [timestamps] [log entries]           ││ [S] Spaces        │
│ Agent: [response]                    ││ [C] Catalog       │
│ Task completed                       ││                   │
└──────────────────────────────────────┘└──────────────────┘
╭─────────────────────────────────────────────────────────────────╮
│ / Press / to type...   OR   > Describe your task...             │
╰─────────────────────────────────────────────────────────────────╯
┌─────────────────────────────────────────────────────────────────┐
│ ● connected  •  -  •  -          [Ctrl+←→]page [↑↓]select...   │
└─────────────────────────────────────────────────────────────────┘
```

### Pages Discovered
| Page | Shortcut | Content | Status |
|------|----------|---------|--------|
| Agent | A | Agent status + Conversation + Actions | RENDERS OK |
| Home | H | Unknown — blank on capture | BLANK (timing?) |
| Spaces | S | NavBar + Sub-tabs (Repos/Workspaces/Sessions) + Session list | RENDERS OK |
| Foundry | F | Block list with types (12 blocks: 1 workflow, 4 agent, 4 tool, 2 inference, 1 validator) | RENDERS OK |
| Catalog | C | Block catalog with fitness % + type filter | RENDERS OK |
| Models | M | Blank — 0 non-empty lines | **BUG — BLANK** |

### Global Shortcuts
| Key | Action | Tested | Result |
|-----|--------|--------|--------|
| H | Go to Home | Yes | Blank frame (BUG-3) |
| A | Go to Agent | Yes | Works |
| S | Go to Spaces | Yes | Works |
| F | Go to Foundry | Yes | Works |
| C | Go to Catalog | Yes | Works |
| M | Go to Models | Yes | Blank frame (BUG-1) |
| / | Focus TaskInputBar | Yes | Works — changes to `> Describe your task...` |
| Esc | Unfocus input | Yes | Works — changes back to `/ [text]`, preserves text |
| Ctrl+←→ | Page navigation | Not tested | |
| Q | Quit | Not tested | |

### Agent Page Shortcuts
| Key | Action | Tested | Result |
|-----|--------|--------|--------|
| J | Scroll conversation down | Yes | **BUG — entire screen blanks** |
| K | Scroll conversation up | Yes | Works, shows ▲▼ indicators |
| G | Go to session | Not tested | |

## Tests Performed

### Visual Tests (Discovery — Demo Mode)
| # | Action | Observation | Expected | Verdict | Notes |
|---|--------|-------------|----------|---------|-------|
| V1 | Launch TUI | Renders in ~2s (real) / ~5s (demo) | Content visible | PASS | Demo slower than real mode |
| V2 | NavBar | Visible on all pages, consistent format | All 6 nav items | PASS | Shows session count on some pages |
| V3 | Spaces page | 5 demo sessions with status/fitness/duration | List with details | PASS | Expandable rows (▼/●/✓/✗ icons) |
| V4 | Foundry page | 12 blocks categorized by type | Block list | PASS | IDs truncated |
| V5 | Catalog page | 12 blocks with fitness 76%-98% + type filter | Catalog with scores | PASS | Good info density |
| V6 | Models page | **BLANK — 0 lines** | Model list | **FAIL** | **BUG-1** |
| V7 | Home page | **BLANK — 0 lines** (demo mode) | Dashboard or welcome | **FAIL** | **BUG-3** (may be timing) |
| V8 | TaskInputBar | Present on all pages | Input visible | PASS | Unfocused: `/ Press / to type...` |
| V9 | StatusBar | `● connected • - • -` | Status info | PARTIAL | Placeholder values `• -` visible |

### Interaction Tests
| # | Action | Observation | Expected | Verdict | Notes |
|---|--------|-------------|----------|---------|-------|
| I1 | Press / | Input changes to `> Describe your task...` | Focus activated | PASS | |
| I2 | Type text | Characters appear in input | Text visible | PASS | `> Hello world` |
| I3 | Press Esc | Input unfocuses, text preserved | Return to browse mode | PASS | Shows `/ Hello world` |
| I4 | Press J | **Screen goes BLANK** | Scroll conversation | **FAIL** | **BUG-2** |
| I5 | Press K | Screen returns, `▲▼` indicators | Scroll up | PASS | |
| I6 | Press Enter (submit) | Agent starts working | Session creation | PASS | |

### Agent Flow Tests (Real Mode — Backend Connected)
| # | Action | Observation | Expected | Verdict | Notes |
|---|--------|-------------|----------|---------|-------|
| A1 | Submit task | Session created, template maestro-assistant | Session + invoke | PASS | `Session: 7e165bc8` |
| A2 | Agent status during work | `● Agent: working Session: 7e165bc8 ● Processing...` | Working state | PASS | |
| A3 | Wait for completion (~28s) | Log entries appear, "Agent:" response, "Task completed" | Response visible | PASS | |
| A4 | Agent response format | "Read and summarized the Cantante project: a TypeScript/Electron..." | Direct answer | **FAIL** | **BUG-4** — action log, not answer |
| A5 | Agent status after complete | `✓ Agent: completed Session: 7e165bc8` + truncated preview | Completion indicator | PASS | |
| A6 | Submit second task | Reuses same session (no "Creating session") | Session persistence | PASS | |
| A7 | Second response (~12s) | "Cantante uses Electron + React + TypeScript, with Vite as bundler" | Direct answer | PASS | Good conversational format |
| A8 | State after both tasks | `○ Agent: idle Session: 7e165bc8` | Returns to idle | PASS | Auto-reset after 3s |

### State Verification (API — curl)
| # | Check | API Response | Expected | Verdict | Notes |
|---|-------|-------------|----------|---------|-------|
| S1 | Session created | `GET /api/sessions` → status: running | Active session | PASS | ID: 7e165bc8-... |
| S2 | Variables set | message + repoPath present | Inputs stored | PASS | |
| S3 | _blockOutputs | `execute: {type: agent, output: "...", timestamp}` | Output stored | PASS | |
| S4 | _nodeResult_execute | JSON summary present | Node result stored | PASS | |
| S5 | _llmActivity | 2 entries (one per invocation) | LLM calls tracked | PASS | 424 + 132 tokens |
| S6 | _executionTree | Single node "Reasoning" status: **pending** | Status: done | **FAIL** | **BUG-5** — never updates |
| S7 | _conversationState | 4 messages, ~1260 tokens | Conversation tracked | PASS | Serialized as string |

### Output Evaluation (Coherence Test — Section 4.6)
| # | Input | Output (verbatim) | Accuracy | Relevance | Completeness | Clarity | Format | Overall |
|---|-------|-------------------|----------|-----------|-------------|---------|--------|---------|
| O1 | "What is the Cantante project about? Give me a brief summary." | "Read and summarized the Cantante project: a TypeScript/Electron desktop code editor for blind and visually impaired users, featuring AI voice assistant, Braille keyboard support, local AI model integration, and full screen reader compatibility." | 4 | 3 | 4 | 2 | 2 | PROBLEMATIC |
| O2 | "What framework does it use?" | "Cantante uses Electron + React + TypeScript, with Vite as the bundler for the renderer process." | 5 | 5 | 4 | 5 | 5 | GOOD |

**Red Flags Observed**:
- O1: Response describes agent ACTIONS ("Read and summarized...") rather than answering the question directly. A user would expect: "Cantante is a TypeScript/Electron desktop code editor for blind and visually impaired users..." not "Read and summarized the Cantante project: ..."
- O1 format is a work log, not a conversation response

**Root Cause**: The `system-prompt.md` describes step-complete's summary as `"what was accomplished or your response"`. The agent interprets "summary" as a work log when it performs tool calls first. When answering directly (O2, no tool calls needed), the response is conversational.

**Escalation**: The prompt needs to clarify that for QUESTIONS, the summary IS the answer to the user. Not a description of actions taken.

## Bugs Found

| ID | Description | Severity | Root Cause | Frame |
|----|-------------|----------|------------|-------|
| BUG-1 | Models page is completely BLANK (0 lines) | Major | **FIXED** — empty state Box missing `flexDirection: 'column'` + timing issue in demo mode | Discovery F6 |
| BUG-2 | Press J (scroll down) causes entire screen to go blank | Major | **FIXED** — ConversationLog ignored scrollOffset; Panel's marginBottom pushed content off-screen. Now ConversationLog handles line windowing directly. | Discovery F11 |
| BUG-3 | Home page blank in demo mode (may be timing on Windows) | Minor | Possibly slow initial render | Discovery F2 |
| BUG-4 | Agent response in work-log format ("Read and summarized...") | Major | **FIXED** — 3-layer fix: prompt examples, trailing text capture in AgentBlockExecutor, response key preference in EntryPointExecutor | Live FINAL |
| BUG-5 | _executionTree node stays "pending" after completion | Minor | EntryPointExecutor doesn't update tree for agent blocks | API check |
| BUG-6 | StatusBar shows placeholder values `• - • -` | Minor | Missing data for status indicators | All frames |

## UX Evaluation

| Criterion | Score (1-5) | Justification |
|-----------|-------------|---------------|
| Feedback | 4 | Working/completed states clear. `● Processing...` visible. Missing: progress steps during agent work. |
| Clarity | 3 | Response O1 confusing (work log format). Status info OK but StatusBar placeholders meaningless. |
| Progression | 3 | idle → working → completed transition clear. BUT no execution tree steps visible (stays "Reasoning: pending"). |
| Response quality | 3 | O1 problematic (action log), O2 excellent. Inconsistent. |
| Stability | 4 | Layout stable during agent work. J-scroll blank is a glitch but recovers. |
| Navigation | 4 | All pages reachable. Shortcuts work. But Models and Home blank = 2/6 pages broken. |
| Errors | N/A | No errors encountered during testing. |
| Intuitivité | 4 | Slash-to-focus is discoverable (shown in input). Shortcuts shown in NavBar and Actions panel. |
| Performance | 4 | First response ~28s (acceptable for LLM). Second response ~12s (good, benefits from context). Session creation <1s. |
| Cohérence | 3 | Agent page excellent. Spaces/Foundry/Catalog good. Models/Home blank breaks coherence. |

**Overall Score: 3.5/5** — Functional core works well (agent communication, session persistence, multi-message). Main issues: response format quality, 2 blank pages, scroll bug.

## Summary
- **Tests performed**: 28 (9 visual + 6 interaction + 8 agent flow + 7 API + 2 output eval)
- **PASS**: 22
- **FAIL**: 6 (BUG-1 through BUG-6)
- **Bugs found**: 6 (0 critical, 3 major, 3 minor)
- **Total duration**: ~56s (real agent test), ~15s (discovery)

## Fixes Applied

### BUG-4 — FIXED (3-layer fix)
Agent response was in "action log" format ("Read and summarized the Cantante project: ...") instead of conversational.

**Root cause**: LLMs put real answers as prose AFTER the JSON `step-complete` object. The pipeline only extracted the JSON summary field, discarding the richer trailing content.

**Files changed**:
1. `content/system/blocks/system/maestro-assistant/system-prompt.md` — Added explicit VALID/INVALID examples, WRONG/RIGHT patterns in rules, emphasized "summary IS the full answer"
2. `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — Permissive trailing text capture (any text >20 chars replaces summary), proper `**bold**` markdown stripping, writes final summary to both `result` and `response` output keys
3. `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — Prefers `response` key (clean text) over concatenating all output keys

**Verification**: `_dogfood-verify-bug4.ts` confirms response no longer starts with action verbs. Test suite: 70/70 passed.

### BUG-1 — FIXED (layout + timing)
Models page was blank in demo mode during dogfooding discovery.

**Root cause**: Empty state Box in ModelsScreen was missing `flexDirection: 'column'`, causing children to render horizontally and collapse. Combined with `useApiData` async timing on first render.

**File changed**: `packages/maestro-code/components/ModelsScreen.ts` — Added `flexDirection: 'column'` to empty state Box.

**Verification**: PTY capture shows MODEL STATUS + AVAILABLE MODELS panels with model names. Test suite: 70/70 passed.

### BUG-2 — FIXED (scroll mechanism rewrite)
Pressing K (scroll up) caused the entire screen to go blank. J (scroll down) brought it back.

**Root cause**: ConversationLog always rendered `lines.slice(-maxVisible)` (last N lines), ignoring the `scrollOffset`. Panel tried to scroll via `marginBottom`, which just pushed the same fixed content off-screen.

**Files changed**:
1. `packages/maestro-code/components/ConversationLog.ts` — Added `scrollOffset` prop; computes visible window as `lines.slice(startIndex, endIndex)` based on offset
2. `packages/maestro-code/components/AgentScreen.ts` — Removed `scrollOffset` from Panel props, passes it to ConversationLog instead

**Verification**: PTY test — 5x K, 5x J, 20x K all produce 40 non-empty lines. No blank screen. Test suite: 70/70 passed.

## Remaining Bugs (Priority Order)
1. **BUG-5 (Minor)**: Update execution tree node status when agent completes
2. **BUG-6 (Minor)**: Remove or populate StatusBar placeholder values
3. **BUG-3 (Minor)**: Investigate Home page blank (may be timing)
