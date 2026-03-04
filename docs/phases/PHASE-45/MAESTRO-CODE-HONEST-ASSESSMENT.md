# Maestro Code — Honest Assessment

**Date**: 2026-03-03
**Context**: The user reports that the agent conversation doesn't work ("Entry point 'message' not found"), the app isn't user-friendly, and dogfooding hasn't caught obvious problems. This document is a critical, honest analysis.

---

## 1. The Immediate Bug: "Entry point 'message' not found"

### Root Cause: CONFIRMED

**File**: `packages/maestro-code/App.ts`, line 230

When the provider setup flow completes, a new SessionManager is created:

```typescript
setLiveSessionManager(new SessionManager({ apiClient: newClient, repoPath }));
```

This is missing `importSessionTemplate`. Compare with the initial creation at line 808:

```typescript
const sessionManager = options.apiClient ? new SessionManager(options) : null;
```

Line 808 passes the full `options` object (which includes `importSessionTemplate` from the CLI). Line 230 passes only `{ apiClient, repoPath }`.

In `SessionManager.ts` line 76:

```typescript
this.importTemplate = options.importSessionTemplate || (async () => {});
```

So when `importSessionTemplate` is missing, it defaults to a **no-op**. The template is never imported. Entry points are never registered. The invoke call fails.

### Why This Matters

This is the **primary user flow** for first-time users:
1. Install maestro → `maestro code`
2. No providers configured → ProviderSetupScreen
3. Configure a provider → backend starts
4. Type "hello" → **crash**

Every single new user hits this bug on their first message. It's not an edge case — it's the happy path.

### The Fix

```typescript
// App.ts line 230 — pass importSessionTemplate from outer options
setLiveSessionManager(new SessionManager({
  apiClient: newClient,
  repoPath,
  importSessionTemplate: (options as any).importSessionTemplate,
}));
```

This is a **one-line fix** for the most critical bug in the app.

---

## 2. The Deeper Problem: Why Wasn't This Caught?

### 2.1 @ts-nocheck Everywhere

Every file in maestro-code has `// @ts-nocheck` at line 1:

- `App.ts` (843 lines)
- `SessionManager.ts` (673 lines)
- `AgentScreen.ts` (315 lines)
- `launcher.ts` (27 lines)
- Every component

With TypeScript disabled, the compiler cannot warn that `importSessionTemplate` is missing from the `SessionManager` constructor call. In a typed codebase, this would be a compile error. Here, it's a runtime crash that only happens in a specific flow.

**@ts-nocheck is technical debt that directly caused this bug.**

### 2.2 Tests Don't Test the Real Flow

The 69 tests in maestro-code verify:
- Components render correctly (ConversationLog, TaskInputBar, AgentPanel)
- Demo mode works
- Headless mode works

They do NOT verify:
- Session creation → template import → entry point invocation
- The provider setup → backend start → session creation flow
- Any integration between SessionManager and the backend

The `SessionManager` class — the most critical piece of the app — has **zero tests**.

### 2.3 Dogfooding Missed It

The dogfooding protocol assumes the app is already working. But the entry point of dogfooding — launching the app and talking to it — is broken. This suggests either:

1. Dogfooding was done with providers already configured (bypassing the setup flow)
2. Dogfooding was done in demo mode
3. The error was seen but reported as "works" because the session *was created* (just the invoke failed)

This is a pattern: **testing the success path, not the user's path**.

---

## 3. Code Quality Assessment

### 3.1 What's Actually Good

- **Architecture is sound**: SessionManager → API Client → Backend is a clean separation
- **Session persistence**: Saving session ID to `.maestro/session.json` and reusing it is smart
- **Polling with multiple extraction strategies**: The 6-source output extraction in SessionManager is robust
- **Slash command system**: Clean dispatch, good set of commands
- **Keyboard model**: Slash-to-focus is intuitive and works
- **Provider setup screen**: The multi-step flow is well-designed conceptually

### 3.2 What's Not Good

#### No Type Safety

`@ts-nocheck` on 15+ files means:
- No compile-time prop validation
- No interface contract enforcement
- Refactoring is guesswork
- Every function call is a trust exercise

**This is the single biggest code quality problem.** Every other issue flows from this. When you can't trust the compiler to catch mistakes, you need 3x more tests — and the test coverage is also thin.

#### Error Messages Are Developer-Oriented

```
Error: Entry point 'message' not found
Error: Agent did not respond — execution tree is empty.
Error: Session creation failed
```

A user seeing these has no idea what went wrong or what to do. These should be:

```
Could not start conversation. The assistant workflow is not configured.
Try: maestro init --reset
---
The assistant didn't respond. This usually means the LLM provider is down or misconfigured.
Check: maestro models
---
Could not create a session. Is the Maestro backend running?
Try: maestro code --restart
```

#### State Machine Is Implicit

The app's state is spread across:
- `agentState` ('idle' | 'working' | 'completed' | 'error')
- `busy` (boolean)
- `inputFocused` (boolean)
- `currentPage` (string)
- `showQuitConfirm` (boolean)
- `showHelp` (boolean)
- `providersReady` (boolean)
- `setupInProgress` (boolean)
- `pendingInteractive` (Widget | null)
- `currentWidget` (Widget | null)
- SessionManager's internal state (`sessionReady`, `pollTimer`, etc.)

There is no formal state machine. States are tracked by independent booleans and strings that can get out of sync. This is manageable for the current feature set but will become painful as features are added.

#### Rendering Fragility

- Nested `h(Text, null, h(Text, ...))` in AgentScreen — anti-pattern in Ink
- `overflow: 'hidden'` doesn't reliably hide content in all terminal emulators
- No terminal width guards — narrow terminals get garbled output
- Panel borders break on Windows with certain fonts

---

## 4. UX Problems

### 4.1 The App Doesn't Feel "User-Friendly"

Here's why, specifically:

1. **No loading state for conversation**: User types a message, sees "Processing...", but no progress indicator. No idea if the agent is thinking, calling tools, or stuck. Claude Code shows a spinner with the current action. We show nothing.

2. **Error states vanish in 3 seconds**: After a task completes (or fails), the state resets to 'idle' after 3 seconds. If the user blinked, they missed it. Errors should persist until acknowledged.

3. **The input bar placeholder contradicts the disabled state**: When the agent is working, the bar is disabled but still says "Send a message to the agent..." — confusing. Should say "Agent is working..." or similar.

4. **No retry on failure**: When the agent fails, the user has to type a new message. There's no "retry" command or button. `/stop` exists but not `/retry`.

5. **Session ID is opaque**: `Session: 04079e75` means nothing to a user. Should say "Session started" and keep the ID in the status bar, not the conversation log.

6. **System messages clutter the conversation**: "Creating session...", "Importing template: maestro-assistant", "Session started", "Invoking: message" — these are implementation details. Users want: "Starting..." → [agent response]. Keep technical details in a debug log.

### 4.2 Comparison with Claude Code

| Feature | Claude Code | Maestro Code |
|---------|-------------|--------------|
| First message latency | ~2s | ~5s (session + template + invoke) |
| Progress feedback | Spinner + action description | "Processing..." |
| Error handling | Clear explanation + suggestion | Technical error dump |
| Input when busy | Queued for next turn | Silently sent via `sendMessage` |
| History | Persistent, searchable | Saved in session variables |
| Type safety | Full TypeScript | @ts-nocheck |

We're competing with Claude Code for the "AI in terminal" space. The UX bar is high.

---

## 5. Why We're "Not Advancing"

### 5.1 The Cycle

1. Feature is implemented
2. Tests pass (vitest, headless)
3. "Phase complete" is declared
4. User tries the feature → it's broken
5. Debug → fix → repeat

This cycle happens because:

- **Tests don't test real flows**: vitest tests mock everything. The real flow (CLI → TUI → SessionManager → API) is never tested end-to-end.
- **@ts-nocheck hides interface mismatches**: The exact bug above (missing `importSessionTemplate`) would be a compile error with TypeScript enabled.
- **Dogfooding is too high-level**: Dogfooding checks "can I do X?" but doesn't check "what happens when Y goes wrong?". The happy path works; every other path fails.
- **"Done" is declared too early**: Phase completion is declared after tests pass. But tests pass on mocked data. Real integration is never verified.

### 5.2 The TUI is Simple — But the Integration is Not

The TUI itself is straightforward — it's React/Ink with panels and text input. The complexity is in:

1. **CLI → TUI handoff**: Options are passed through 3 layers (CLI → launcher → App), each with its own type definitions, none enforced
2. **SessionManager → Backend**: HTTP calls to create sessions, import templates, invoke entry points, poll for results — any of which can fail
3. **Provider detection → Backend startup**: Sidecar spawning, port allocation, health checks, client creation
4. **State synchronization**: Between React state, SessionManager state, and backend state

Each of these integration points is untested and untyped. The TUI components work fine in isolation. They break when connected.

### 5.3 What Would Actually Help

In priority order:

1. **Remove @ts-nocheck and fix type errors** (4-8 hours)
   - This would have prevented the current bug
   - Prevents future interface mismatches
   - Makes refactoring safe
   - Single highest-ROI change

2. **Add integration tests for SessionManager** (2-3 hours)
   - Mock the API client, not the SessionManager
   - Test: create session → import template → invoke → poll → complete
   - Test: provider setup → backend start → session creation (the broken flow)
   - Test: error scenarios (backend down, invoke fails, timeout)

3. **Clean up conversation log messages** (1 hour)
   - Move "Creating session...", "Importing template..." to a debug log
   - Show only: "[timestamp] Starting..." → "[timestamp] Agent: [response]"
   - Keep errors visible but add context and suggestions

4. **Add progress feedback during agent execution** (2 hours)
   - Poll execution tree and show current node name
   - "Thinking..." → "Running agent..." → "Agent responded"
   - Animated spinner or progress indicator

5. **Test the first-run flow end-to-end** (1 hour)
   - Fresh install → no config → maestro code → provider setup → first message → agent responds
   - This should be a mandatory test before any release

---

## 6. Honest Summary

**The app's architecture is fine. The code quality is not.**

The main problems are:

1. **TypeScript is disabled** — This is the root cause of most bugs. It makes every code change a liability.
2. **Integration tests don't exist** — Unit tests pass but the actual user flow is untested.
3. **Dogfooding doesn't catch real problems** — Because it tests from the developer's perspective (providers already configured, backend already running), not the user's perspective (fresh install, first run).
4. **Error UX is poor** — Technical errors exposed to users with no context or recovery path.
5. **The app is functional but not polished** — Components work individually but break when connected. State management is ad-hoc. Edge cases are unhandled.

The TUI framework (React/Ink, panels, keyboard model) is solid. The problem is in the **glue code** — the integration between components, the option passing, the state management, the error handling. This glue code is where `@ts-nocheck` hurts the most, because it's where interface contracts matter the most.

**The path forward is not more features. It's fixing the foundation: enable TypeScript, add integration tests, test the first-run flow, and polish the UX.** Every feature added on top of `@ts-nocheck` and zero integration tests is a coin flip on whether it actually works.

---

## 7. Immediate Action Items

### Must Fix (blocks V1)

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 1 | Entry point 'message' not found | Pass `importSessionTemplate` in provider setup flow (App.ts line 230) | 15 min |
| 2 | @ts-nocheck on all files | Remove @ts-nocheck, fix type errors | 4-8 hours |
| 3 | SessionManager has zero tests | Add integration tests with mocked API client | 2-3 hours |
| 4 | First-run flow never tested | Add end-to-end test for fresh install → first message | 1 hour |

### Should Fix (V1 quality bar)

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 5 | System messages clutter conversation | Move to debug log, show only user-facing messages | 1 hour |
| 6 | Error messages are technical | Add context and suggestions to each error path | 1 hour |
| 7 | No progress during agent execution | Show current execution node name | 2 hours |
| 8 | Disabled input placeholder contradicts state | Change to "Agent is working..." when disabled | 5 min |
| 9 | Error state vanishes in 3 seconds | Persist error state until next user action | 30 min |

### Can Wait (post-V1)

- Formal state machine for app state
- Page state preservation on navigation
- Accessibility improvements (color-only cues)
- Terminal width guards
