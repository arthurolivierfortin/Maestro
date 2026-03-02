# Dogfooding Methodology — System Validator Agent

> **This document is MANDATORY reading before any dogfooding session.**
> It defines the philosophy, protocol, and standards for how an AI agent
> validates an interactive system through direct observation and interaction.

---

## Table of Contents

1. [Philosophy: The Agent is a System Validator](#1-philosophy-the-agent-is-a-system-validator)
2. [Pre-Flight: Verify Observation Tools](#2-pre-flight-verify-observation-tools)
3. [Discovery: "What Do I See?"](#3-discovery-what-do-i-see)
4. [Systematic Testing: "What Should It Do?"](#4-systematic-testing-what-should-it-do)
   - 4.1–4.5: Visual, Interaction, Flow, State, UX
   - [4.6: Content and Output Evaluation](#46--content-and-output-evaluation-does-this-make-sense)
5. [Memory Management: Notes and Context](#5-memory-management-notes-and-context)
6. [Critical Evaluation: Beyond Functional](#6-critical-evaluation-beyond-functional)
7. [Anti-Patterns: What the Agent Must NEVER Do](#7-anti-patterns-what-the-agent-must-never-do)
8. [Appendix: Maestro-Specific Reference](#appendix-maestro-specific-reference)

---

## 1. Philosophy: The Agent is a System Validator

### You Are Not a Test Runner

You are not executing a test script. You are not running a CI pipeline. You are not delegating verification to a program that outputs PASS/FAIL.

**You are a System Validator.** You arrive in front of an interface — possibly one you have never seen before — and your job is to:

1. **See** what the user sees
2. **Understand** what every element does
3. **Interact** like a real user would
4. **Judge** whether the experience is correct, clear, and good
5. **Document** everything you observe

### The Fundamental Rule

> **"If I cannot see what the user sees, I cannot dogfood."**

Before testing anything, you must prove to yourself that you can observe the application's output directly. If you cannot capture a frame, read a screen, or see the result of your actions — **stop and tell the user what's missing.**

### What Dogfooding IS

- You spawn the application
- You look at the screen (capture frames, read the text)
- You press keys, type text, navigate
- After each action, you look again: "What changed?"
- You compare what you see to what you expect
- You write down your observations in real-time
- You evaluate the experience critically — not just "does it work?" but "is it good?"

### What Dogfooding is NOT

- Writing a `.ts` or `.js` file that automates everything
- Running `npx tsx tests/dogfood-real.ts` and reading "8/8 checks passed"
- Trusting a script's verdict without reading the actual output
- Running `vitest` and concluding the feature works
- Checking only one layer (only the UI, or only the API)

### The Validator's Mindset

Approach every interface as if you are a new user who has never seen it before:

- **No assumptions** — don't assume a button works because the code looks correct
- **No trust** — don't trust previous test results; verify now
- **No shortcuts** — test the full path, not just the happy case
- **Critical eye** — if something feels off, it IS off. Document it.
- **User empathy** — would a real person understand this? Be frustrated by this? Be confused by this?

---

## 2. Pre-Flight: Verify Observation Tools

### The Three Levels of Observability

Before any dogfooding session, verify you have tools at three levels:

#### Level 1 — Direct Observation (REQUIRED)

Can you SEE the application's output?

| Application Type | Required Tool | How to Verify |
|---|---|---|
| **Terminal UI (TUI)** | PTY driver (e.g., `TuiDriver`) | File exists: `tests/tui-driver.ts` + `node-pty` installed |
| **Web Application** | Headless browser or screenshot tool | Playwright/Puppeteer available, or MCP screenshot tool |
| **CLI output** | Bash command capture | Can run the command and read stdout/stderr |
| **Desktop App** | Screenshot/accessibility tool | Platform-specific screen reader or capture |

**If Level 1 is not satisfied** → STOP. Tell the user:
> "I cannot see the application's interface. I need [specific tool] to dogfood this.
> Without direct observation, any testing I do would be blind guessing."

#### Level 2 — Interaction (REQUIRED for interactive apps)

Can you INTERACT with the application?

| Capability | How to Verify |
|---|---|
| Send keystrokes | PTY driver has `press()`, `typeText()`, `sendKey()` |
| Click/select | Browser driver has click/focus methods |
| Capture state after action | Can call `captureFrame()` or take screenshot after each action |
| Wait for async results | Has `waitForContent()` or polling mechanism |

**If Level 2 is not satisfied** → Tell the user:
> "I can see the interface but cannot interact with it. I need [input method] to test behavior."

#### Level 3 — State Verification (RECOMMENDED)

Can you verify the application's internal state independently?

| Source | How to Verify |
|---|---|
| REST API | `curl http://localhost:PORT/api/health` returns 200 |
| Database / filesystem | Can read files or query data created by the application |
| Logs | Can access stderr, log files, or structured logs |
| Process state | Can check if processes are running, ports are bound |

**If Level 3 is not satisfied** → Proceed with Level 1+2, but note in your report that internal state was not independently verified.

### Pre-Flight Checklist Template

Copy and execute this checklist before every session:

```
=== PRE-FLIGHT CHECKLIST ===

Level 1 — Observation:
□ Observation tool exists?        [verify file/tool presence]
□ Can spawn application?          [try spawn, check for errors]
□ Can capture initial frame?      [capture and read first screen]

Level 2 — Interaction:
□ Can send input?                 [send a keystroke, verify effect]
□ Can capture after action?       [press key → capture → check change]
□ Can wait for async?             [verify timeout/polling works]

Level 3 — State Verification:
□ Backend/API reachable?          [health check endpoint]
□ Filesystem accessible?          [ls target directory]
□ Logs accessible?                [check log location]

=== PRE-FLIGHT RESULT ===
Level 1: [PASS/FAIL]
Level 2: [PASS/FAIL]
Level 3: [PASS/FAIL/SKIP]
Proceed: [YES/NO — requires Level 1 PASS minimum]
```

### If Something is Missing

Do NOT work around missing tools. Do NOT invent a substitute. Ask the user:

> "Pre-flight failed at Level [N]. Missing: [specific tool/capability].
> Options:
> 1. Install/create [tool] (estimated effort: [time])
> 2. Dogfood at a reduced scope (what I can verify: [list])
> 3. Skip dogfooding until tools are available"

---

## 3. Discovery: "What Do I See?"

### You Are an Explorer, Not a Script

When you arrive at an interface, you do NOT know what it contains. Even if you've read the source code, the rendered output may differ from what the code suggests. Your job is to **observe and document what actually appears**.

### The Discovery Protocol

#### Step 1: First Contact

Spawn the application and capture the initial state.

```
Action: Launch the application
Observation: [capture frame, print every non-empty line]
```

Read the entire captured frame. Do not scan for keywords. Read it like a user would — top to bottom, left to right.

#### Step 2: Visual Inventory

For the initial screen, enumerate EVERYTHING visible:

```
=== INTERFACE INVENTORY — [Page Name] ===

Layout:
├─ [Zone 1] (lines X-Y): [what it contains]
│   ├─ [Sub-element]: [description]
│   └─ [Sub-element]: [description]
├─ [Zone 2] (lines X-Y): [what it contains]
│   └─ ...
├─ [Input Area] (lines X-Y): [description, placeholder text]
└─ [Footer] (lines X-Y): [description, shortcuts listed]

Interactive Elements Found:
- Keyboard hints: [list all visible shortcuts like [H]ome, [S]paces, etc.]
- Input fields: [describe each]
- Selection indicators: [arrows, highlights, focus rings]
- Status indicators: [connection dots, spinners, icons]

Visual Properties:
- Borders: [box-drawing characters present? aligned?]
- Colors mentioned: [any color indicators visible in text]
- Animations: [breathing dots? spinners? blinking?]
- Empty space: [any unexplained blank areas?]
```

#### Step 3: Navigation Map

Discover all navigable areas by trying every visible shortcut:

```
Navigation Map:
- [Key] → [Page/Action] → [What appears]
- [Key] → [Page/Action] → [What appears]
- ...

Page Count: [N total pages/views discovered]
Transition: [How pages connect — tabs? stack? modal?]
Back mechanism: [Esc? Backspace? Breadcrumb?]
```

For EACH page discovered, repeat Step 2 (Visual Inventory).

#### Step 3b: Depth Navigation — Detail Views and Sub-Views

> **This step exists because of a real incident (2026-02-27): a dogfooding session
> tested all 6 top-level pages but NEVER entered a detail view. Three major bugs
> in detail views (double footer, scroll overflow, dead keyboard) shipped undetected.**

Pages are not the only views. Many pages contain **lists** where pressing Enter/Space
opens a **detail view** (block detail, session detail, workspace detail, model detail).
These detail views are **composed differently** from pages — the application wrapper
may add footers, input bars, or status bars that the detail component doesn't know about.

**You MUST test detail views separately from list pages.**

Protocol:
```
For EACH page that contains a selectable list:
  1. Select an item
  2. Press Enter (or the documented activation key)
  3. Capture the detail view frame
  4. Inventory: What is shown? What is the layout?
  5. CHECK FOR DUPLICATED ELEMENTS:
     - Are there two status bars? Two footers? Two input areas?
     - Are global elements (TaskInputBar, StatusBar) still present?
     - Do they make sense in this context?
  6. CHECK THAT CONTENT FITS:
     - Count the actual usable rows (terminal height minus ALL chrome)
     - Does the content overflow below the visible area?
  7. Navigate back (Esc or documented back key)
  8. Verify: Is the list restored? Is the selection preserved?
```

Detail view inventory template:
```
=== DETAIL VIEW — [name] (reached from [parent page]) ===

Entry: Pressed [key] on [item description] from [page]
Back: [key to return]

Layout:
├─ [Zone 1] (lines X-Y): [description]
├─ ...
├─ [Global wrapper: TaskInputBar?] (lines X-Y): [should it be here?]
└─ [Global wrapper: StatusBar?] (lines X-Y): [duplicated from inner component?]

Duplicated Elements: [YES/NO — list any]
Overflow Issues: [YES/NO — does content extend beyond terminal]
Keyboard Working: [test all documented shortcuts in this context]
```

**Completeness rule**: If a page has N selectable items of different types,
test at least one detail view per type (e.g., one workflow block, one agent block, one tool block).

#### Step 4: State Discovery

Identify all possible states the application can be in:

```
States Discovered:
- [State 1]: [when it occurs, what it looks like]
- [State 2]: [when it occurs, what it looks like]
- ...

Transitions:
- [State A] → [trigger] → [State B]
- [State B] → [trigger] → [State C]
- ...
```

#### Step 5: Document Everything

Write the complete inventory to your session notes file (see Chapter 5).
This inventory is the **foundation for all subsequent testing** — every element
in the inventory must be tested.

### Discovery Completeness Check

After discovery, verify:

```
□ Every visible zone is documented
□ Every keyboard shortcut has been tried
□ Every TOP-LEVEL page has been visited and inventoried
□ Every DETAIL VIEW has been entered and inventoried (Step 3b)
□ All input fields have been identified
□ All status indicators have been noted
□ All states have been observed (or at least identified)
□ The navigation graph is complete (every page AND detail view reachable)
□ COMPOSITION CHECK: global elements (input bars, status bars, footers)
  documented — are they present on all views? Should they be?
□ SCROLL CHECK: every scrollable list tested with more items than visible rows
□ KEYBOARD CHECK: every shortcut tested in the FULL app context, not in isolation
```

If any of these are incomplete, continue discovering before moving to testing.

---

## 4. Systematic Testing: "What Should It Do?"

### The Two-Question Protocol

For EVERY element in your inventory, ask:

1. **"What do I see?"** — Describe the current state factually
2. **"What should it do?"** — Describe the expected behavior

Then perform the test and record the result.

### Test Categories

#### 4.1 — Visual Tests (every page)

Test what the user sees without any interaction:

| What to Test | How | Expected |
|---|---|---|
| Title/header visible | Read line 1-3 | Application name + navigation present |
| All tabs/sections present | Count elements | All expected tabs visible, not truncated |
| Content area populated | Read content lines | Not empty, meaningful content |
| Borders aligned | Check box-drawing chars | ┌┐└┘ form closed rectangles |
| No text overflow | Check each line length | No text beyond terminal width |
| Status indicators correct | Read status zone | Shows current state accurately |
| Footer/shortcuts visible | Read bottom lines | Key hints present and readable |

**For each page**, run all visual tests. Log results individually.

#### 4.2 — Interaction Tests

Test every interactive element:

| What to Test | How | Expected |
|---|---|---|
| Each keyboard shortcut | Press key, capture frame | Correct action occurs |
| Input field activation | Press activation key | Field becomes focused/editable |
| Text input | Type characters | Characters appear in field |
| Submission | Press Enter/Submit | Action triggered, input cleared |
| Cancel/back | Press Esc/back key | Returns to previous state |
| Navigation keys | Press each nav key | Correct page/view appears |
| Scroll | Press scroll keys | Content scrolls, indicators update |
| Selection | Press up/down | Selection indicator moves |
| Expand/collapse | Press expand key | Detail appears/disappears |

**Protocol for each interaction test**:
```
Test: [name]
Action: Press [key]
Before: [describe what's on screen]
After:  [capture frame, describe what changed]
Expected: [what should have changed]
Verdict: PASS / FAIL / PARTIAL
Notes: [anything unexpected, even if it passed]
```

##### Keyboard Conflict Testing (MANDATORY)

> **This test exists because of a real incident (2026-02-27): J/K scroll was tested
> via PTY in isolation but didn't work in the real app because a global `useInput`
> handler in the wrapper component intercepted keystrokes before the page handler.**

When an application has **multiple layers of keyboard handlers** (e.g., a global
input manager in the app wrapper AND page-specific handlers), you MUST test keyboard
behavior **in the full application context**, not in isolation.

For EACH page that has keyboard shortcuts:
```
1. Launch the FULL application (not a component in isolation)
2. Navigate to the page
3. Press each documented shortcut key
4. Verify the expected action occurs
5. If the key does NOTHING: this is a FAIL, not "works fine"
```

Pay special attention to:
- **Keys shared between layers**: If the app wrapper uses J/K/Enter and the page
  also uses J/K/Enter, which one wins? Test both states (focused/unfocused).
- **Input focus stealing**: If there is a text input field (TaskInputBar, search box),
  does it steal keyboard events even when not focused?
- **Modal/overlay conflicts**: If a confirmation dialog is showing, do page shortcuts
  still fire underneath it?

##### Scroll Boundary Testing (MANDATORY)

> **This test exists because of a real incident (2026-02-27): Foundry page scroll
> worked in isolation but content was pushed off-screen in the real app because
> the scroll calculation didn't account for footer elements added by the app wrapper.**

When a page has a scrollable list:
```
1. Count visible rows in the FULL application (not calculated, OBSERVED)
2. Ensure the list has MORE items than visible rows
3. Scroll to the LAST item
4. Verify the last item is FULLY visible (not cut off or hidden behind footers)
5. Scroll back to the first item
6. Verify the first item is fully visible
7. If items at boundaries are cut off or hidden: FAIL
```

The key question: **Does the scroll calculation account for ALL elements on screen?**
This includes NavBars, status bars, input bars, and any chrome added by wrapper components
that the scrolling component doesn't know about.

#### 4.3 — User Journey Tests (flows)

Test complete workflows, not just individual interactions:

**Primary Flow** (most important path):
```
1. Open application → initial state
2. Activate input → type task → submit
3. Observe progress → wait for completion
4. Read result → verify correctness
```

**Secondary Flows**:
- Navigate to different page during execution → return → context preserved?
- Submit multiple tasks in sequence → session reused? history maintained?
- Open detail view from list → back to list → selection preserved?

**Error Flows**:
- Submit with backend down → error visible? recovery possible?
- Submit empty input → no-op or clear error?
- Interrupt during execution (Ctrl+C, Esc) → graceful handling?

**Composition Flows** (wrapper + inner component interactions):
- Open a detail view from a list → are global elements (input bar, status bar) duplicated?
- Scroll a list on a page that has global footers → do items disappear behind the footers?
- Press keyboard shortcuts on a page while a global input bar exists → do shortcuts work?
- Navigate from page → detail view → back to page → is the layout intact?

**Edge Cases**:
- Very long input text (100+ characters)
- Special characters (unicode, emoji, quotes, newlines)
- Rapid repeated key presses
- Terminal resize during operation
- Session after extended idle time

#### 4.4 — State Verification Tests (via API/filesystem)

After each major action, verify the backend state independently:

```bash
# After session creation
curl -s http://localhost:5000/api/sessions/{id} | python -m json.tool

# After task submission
curl -s http://localhost:5000/api/sessions/{id}/variables/_executionTree | python -m json.tool

# After completion
curl -s http://localhost:5000/api/sessions/{id}/variables/_blockOutputs | python -m json.tool
curl -s http://localhost:5000/api/sessions/{id}/variables/_nodeResult_execute | python -m json.tool

# Check for data corruption
# Expected: proper JSON objects. NOT nested empty arrays [[[],[],...]]
```

**Cross-reference**: The UI shows X → the API confirms X → the filesystem confirms X.
If any layer disagrees, there's a bug.

#### 4.5 — UX Quality Tests

These are NOT functional tests. These test whether the experience is GOOD:

| Test | Question | How to Evaluate |
|---|---|---|
| **First impression** | Does the initial screen make sense immediately? | Read it cold. Can you tell what the app does? |
| **Action clarity** | Do you know what to do next? | Are calls-to-action visible? Hints present? |
| **Progress feedback** | During a long operation, do you know it's working? | Check for spinners, status text, progress indicators |
| **Completion clarity** | When something finishes, is it obvious? | Clear "done" message? Visual change? |
| **Error communication** | When something fails, do you understand why? | Error message in plain language? Actionable? |
| **Information hierarchy** | Is the most important info most prominent? | Check visual weight, positioning, size |
| **Consistency** | Do similar things look and behave the same? | Compare equivalent elements across pages |
| **Discoverability** | Can you find features without documentation? | Try to accomplish tasks using only visible hints |
| **Response time** | Is the wait acceptable? | < 1s for feedback, < 5s for results, progress for longer |
| **Recovery** | After an error, can you get back to a good state? | Try to recover without restarting |

#### 4.6 — Content and Output Evaluation: "Does This Make Sense?"

Section 4.1–4.5 test whether the interface **works**. This section tests whether
what the interface **produces** is actually correct, useful, and appropriate.

This applies to ANY output the system generates — not just one type. You must
evaluate output quality **based on what you discovered the interface does** during
the Discovery phase (Chapter 3).

##### The Core Principle: Think Like a First-Time User

You don't know in advance what this interface is supposed to do. You DISCOVERED
it in Chapter 3. Now, based on your understanding of what this system is, evaluate
whether its outputs match what a reasonable user would expect.

The question is always: **"Given what this interface claims to be, does this output
make sense?"**

##### Step 1: Identify What the Interface Claims to Be

During Discovery, you built an inventory. From that inventory, form a hypothesis:

```
"Based on what I see, this interface is: [description]"

Examples:
- "...a chatbot that helps developers work on code projects"
- "...a dashboard showing real-time session metrics"
- "...a block catalog with fitness scores"
- "...a file explorer with editing capabilities"
- "...a model comparison tool with availability status"
```

This hypothesis drives ALL your output expectations. You don't need to be told
"this is a chatbot" or "this is a dashboard" — you observe and conclude.

##### Step 2: Test Outputs Against Your Understanding

For every output the system produces, apply the **Coherence Test**:

```
I did: [action]
System produced: [output]
My understanding says: [what I expected based on my hypothesis]
Coherence: [MATCHES / PARTIALLY MATCHES / CONTRADICTS]
```

**Examples across different interface types:**

| Interface Type | Action | Output | Coherence |
|---|---|---|---|
| Chat interface | Typed "Hello" | "I've analyzed your codebase" | CONTRADICTS — I said hello, not "analyze my code" |
| Chat interface | Typed "What is this?" | "Read files to understand project." | CONTRADICTS — describes internal process, not an answer |
| Dashboard | Opened sessions page | 5 sessions listed, all "completed" | Check: are there really 5? Are they really completed? (verify via API) |
| Chart/graph | Opened metrics page | Graph shows 98% fitness | Check: does the underlying data support 98%? Or is it hardcoded? |
| File browser | Clicked a file | Content shown | Check: does the displayed content match `cat` on the actual file? |
| Form | Submitted data | "Success" message | Check: did it actually save? (verify via API/filesystem) |
| Model list | Opened models page | Shows "claude-sonnet: available" | Check: is it really available? (curl the health endpoint) |

##### Step 3: Judge Output Quality

For every significant output, score on these dimensions:

| Dimension | Question |
|---|---|
| **Accuracy** | Is the information factually correct? Does it match reality? |
| **Relevance** | Does the output relate to what triggered it? |
| **Completeness** | Is anything important missing from the output? |
| **Clarity** | Would a user understand this immediately, without context? |
| **Format** | Is the output presented appropriately? (not raw JSON, not truncated, not garbled) |

A user doesn't care about HTTP status codes. They care: "I asked a question —
did I get a useful answer? I clicked a button — did the right thing happen?
I opened a page — does the data look correct?"

##### Step 4: When Something Feels Wrong

If an output doesn't match your understanding of what the interface should do:

1. **Name the problem precisely.**
   Don't write: "The output seems off."
   Write: "I asked 'What is this project?' and got 'Read project files to
   understand Cantante.' This describes internal behavior, not an answer.
   The interface presents itself as a conversational assistant, so it should
   respond to the question, not narrate its process."

2. **Investigate before escalating.**
   - Is the output consistently wrong, or only sometimes?
   - Does the same input produce different results?
   - Is the problem in the output generation, or in how the output is displayed?
   - Check the backend/API — is the real data correct but the presentation broken?

3. **Form a hypothesis about the root cause.**
   - Presentation issue: correct data, wrong display (raw JSON, truncation, wrong field)
   - Logic issue: the system did the wrong thing entirely
   - Configuration issue: the system could do the right thing but isn't set up correctly
   - Design issue: the system does what it was told, but what it was told is wrong

4. **Escalate with a specific, structured observation.**
   When something is unclear or seems intentionally broken, ask the user:

   > "Observation: [what you did and what happened]
   >
   > The interface presents itself as [your hypothesis from Step 1].
   > Given that, I expected [what you expected].
   > Instead, I got [what actually happened].
   >
   > My hypothesis: [presentation/logic/configuration/design issue].
   > Question: Is this the intended behavior, or should I investigate further?"

##### Step 5: Record Everything

For every output you evaluate, add to your notes:

```
Output Evaluation:
  Trigger: [what action produced this output]
  Output: [verbatim what was shown]
  Expected: [what you thought should appear, based on your understanding]
  Accuracy: [1-5]
  Relevance: [1-5]
  Clarity: [1-5]
  Format: [1-5]
  Verdict: CORRECT / ACCEPTABLE / QUESTIONABLE / WRONG
  Notes: [specific observations, hypotheses, or escalation needed]
```

##### Red Flags That Require Escalation

If you observe ANY of these patterns, **stop and ask the user** — don't assume
it's a bug or a feature. It could be either:

- Output has no visible relationship to the input/action that triggered it
- The same action produces wildly different outputs each time
- Raw internal data is shown where human-readable content is expected
  (JSON objects, stack traces, internal IDs, debug logs)
- Output is empty or placeholder text where real content should be
- The system claims to have done something but verification shows it didn't
- Numbers/data shown in the UI don't match what the API returns
- The system takes disproportionately long for what should be simple
  (30+ seconds for displaying static data, minutes for a simple interaction)
- Output contradicts other parts of the same interface
  (status says "completed" but content says "processing")

When escalating, always provide:
1. What you did (the trigger)
2. What the system produced (verbatim)
3. What you expected (based on your understanding of the interface)
4. Your hypothesis about why it's wrong
5. A clear question: "Is this expected? Should I investigate?"

---

## 5. Memory Management: Notes and Context

### You MUST Take Notes

Dogfooding without notes is not dogfooding. It's just clicking around. Notes are the **proof** that testing happened, the **record** of what was found, and the **context** for anyone who reads your results later.

### Session Notes File

At the START of every dogfooding session, create:

**File**: `docs/phases/PHASE-XX/dogfood-notes-YYYY-MM-DD.md`

(If no phase context, use a temporary location and move later.)

### Notes Template

```markdown
# Dogfooding Session Notes — [YYYY-MM-DD HH:MM]

## Session Context
- **Branch**: [git branch name]
- **Commit**: [short hash]
- **Application**: [what is being tested]
- **Mode**: [demo / real / headless]
- **Services**: Backend [running/down], LLM-Provider [running/down]
- **Target repo**: [path if applicable]
- **Terminal size**: [cols x rows]
- **Previous issues**: [known bugs being re-verified]

## Pre-Flight Results
- Level 1 (Observation): [PASS/FAIL]
- Level 2 (Interaction): [PASS/FAIL]
- Level 3 (State): [PASS/FAIL/SKIP]

## Interface Inventory
[Complete inventory from Chapter 3]

## Test Log

### Visual Tests
| # | Page | Element | Observation | Expected | Verdict |
|---|------|---------|-------------|----------|---------|
| V1 | Agent | NavBar | "MAESTRO [H]ome..." visible line 1 | All tabs present | PASS |
| V2 | Agent | Borders | ┌┐└┘ aligned | No glitches | PASS |
| ... | | | | | |

### Interaction Tests
| # | Action | Before | After | Expected | Verdict | Notes |
|---|--------|--------|-------|----------|---------|-------|
| I1 | Press / | Inactive input | ">" prompt, cursor | Input focused | PASS | 100ms |
| I2 | Type "hello" | Empty input | "hello" visible | Text appears | PASS | |
| I3 | Press Enter | "hello" in input | Input cleared, task submitted | Submit + clear | PASS | |
| ... | | | | | | |

### Flow Tests
| # | Flow | Steps | Result | Notes |
|---|------|-------|--------|-------|
| F1 | Primary task flow | type → submit → wait → result | PASS | 28s total |
| F2 | Navigate during execution | submit → press H → press A | PASS | Context preserved |
| ... | | | | |

### State Verification
| # | After Action | API Check | Expected | Verdict |
|---|-------------|-----------|----------|---------|
| S1 | Session creation | GET /sessions/{id} | Status: active | PASS |
| S2 | Task completion | GET /variables/_blockOutputs | Output present | PASS |
| ... | | | | |

### Output Evaluation (Section 4.6 — Coherence Test)
| # | Action/Input | Output (verbatim) | Accuracy | Relevance | Completeness | Clarity | Format | Overall |
|---|-------------|-------------------|----------|-----------|-------------|---------|--------|---------|
| O1 | [what I did] | "[what appeared]" | 4 | 3 | 4 | 4 | 5 | ACCEPTABLE |
| O2 | [what I did] | "[what appeared]" | ? | ? | ? | ? | ? | ? |
| ... | | | | | | | | |

**Red Flags Observed**: [list any from section 4.6]
**Escalated to User**: [yes/no — what was asked, why]

## Bugs Found
| ID | Description | Severity | Steps to Reproduce | Frame Captured |
|----|-------------|----------|-------------------|----------------|
| BUG-1 | [description] | critical/major/minor | [steps] | [yes/no] |

## UX Evaluation

| Criterion | Score (1-5) | Justification |
|-----------|-------------|---------------|
| Feedback | | |
| Clarity | | |
| Progression | | |
| Response quality | | |
| Stability | | |
| Navigation | | |
| Error handling | | |
| Intuitiveness | | |
| Performance | | |
| Consistency | | |

**Overall UX Score**: [average] / 5

## Qualitative Observations
- [What surprised you (good or bad)]
- [What frustrated you]
- [What was delightful]
- [What a new user would struggle with]
- [Suggestions for improvement]

## Summary
- **Tests executed**: [count]
- **PASS**: [count]
- **FAIL**: [count]
- **PARTIAL**: [count]
- **Bugs found**: [count] ([count] critical, [count] major, [count] minor)
- **Total session time**: [duration]
- **Verdict**: [SHIP / FIX AND RE-TEST / BLOCKED]
```

### Memory Rules

1. **Write notes in real-time** — not after the session. If you test something, record it immediately.
2. **Capture frames for every FAIL** — print the frame output so the bug is reproducible.
3. **Don't skip qualitative observations** — "it works but feels slow" is valuable.
4. **Update as you go** — add tests as you discover new features during testing.
5. **The notes file IS the deliverable** — without it, the dogfooding didn't happen.

### Context Preservation

If the dogfooding session spans multiple conversation turns or agent invocations:
- Keep the notes file as the single source of truth
- Reference test numbers (`V1`, `I3`, `F2`) when discussing specific issues
- When resuming, read the notes file first to recover context
- Add a `## Resumed at [time]` section if the session is interrupted

---

## 6. Critical Evaluation: Beyond Functional

### The Agent is a Critic, Not a Cheerleader

Your job is not to confirm the feature works. Your job is to find what's wrong, what's confusing, what could be better. A dogfooding session that finds zero issues is either incomplete or dishonest.

### UX Evaluation Framework

Score each criterion on a 1-5 scale:

| Score | Meaning |
|-------|---------|
| 1 | Broken — doesn't work or is incomprehensible |
| 2 | Poor — technically works but confusing or frustrating |
| 3 | Adequate — works, understandable, but rough edges |
| 4 | Good — clear, functional, minor improvements possible |
| 5 | Excellent — delightful, intuitive, nothing to improve |

#### Criteria Definitions

**Feedback** — Does the user know what's happening at every moment?
- 5: Every action has immediate visual response. Long operations show progress. State changes are obvious.
- 1: Actions have no visible effect. No indication that something is processing. User doesn't know if their input was received.

**Clarity** — Are messages and labels understandable without documentation?
- 5: Plain language everywhere. Technical terms explained. Error messages tell you what to do.
- 1: Cryptic labels. Raw JSON in user-facing text. Error codes without explanation.

**Progression** — Is the workflow advancement visible?
- 5: Clear steps (idle → processing → done). Progress indicators. Step-by-step feedback.
- 1: No indication of progress. Suddenly jumps from "nothing" to "done" (or stays on "processing" forever).

**Response Quality** — Is the application's output visible and useful?
- 5: Output is prominent, well-formatted, and directly answers the user's request.
- 1: Output is hidden, truncated, in wrong format, or doesn't address the request.

**Stability** — Does the layout remain stable during the session?
- 5: No visual glitches. Layout doesn't jump around. Consistent rendering.
- 1: Elements disappear, shift positions, overlap, or flash during state changes.

**Navigation** — Can you move around without losing context?
- 5: All pages reachable. Back button works. Context preserved across navigation.
- 1: Dead ends. Lost state after navigation. Can't find your way back.

**Error Handling** — Are errors clear and actionable?
- 5: Errors in plain language. Clear instructions for recovery. No crashes.
- 1: Stack traces shown to user. Silent failures. Application crashes on error.

**Intuitiveness** — Could a new user figure it out?
- 5: Obvious what to do. Visual hierarchy guides the eye. Help text where needed.
- 1: Requires documentation to use. Hidden features. Confusing metaphors.

**Performance** — Are response times acceptable?
- 5: Instant feedback (< 100ms). Results in < 5s. Progress shown for longer operations.
- 1: UI freezes. No feedback for > 5s. Operations take unreasonably long.

**Consistency** — Does the same pattern mean the same thing everywhere?
- 5: Icons, colors, layouts, shortcuts all consistent across the application.
- 1: Different pages use different patterns for the same concept. Shortcuts change meaning.

### The Frustration Test

After completing all tests, ask yourself:

> "If I were a real user paying for this product, would I be satisfied?"

If the answer is anything less than "yes", document WHY. Every frustration is a potential improvement, even if the feature technically works.

### Comparison Benchmarks

When possible, compare against:
- **Previous version** — Is this better or worse than before?
- **Competitors** — How does this compare to similar tools?
- **Expectations** — Does this match what was promised in the feature description?

---

## 7. Anti-Patterns: What the Agent Must NEVER Do

### Absolute Prohibitions

These are not suggestions. They are rules. Breaking them invalidates the entire dogfooding session.

#### NEVER: Write a Test Script

```
BAD:  "Let me create a dogfood script that tests everything..."
      → Writes tests/_my-dogfood-test.ts
      → Runs it
      → Reads "12/12 PASS"
      → Reports "All tests pass"

GOOD: "Let me spawn the TUI and test each feature..."
      → Spawns via Bash inline
      → Captures frame, reads it
      → Types input, captures frame
      → Compares what they see to what they expect
      → Records in notes file
```

A script cannot judge UX quality. A script cannot notice that the text is slightly misaligned. A script cannot feel that the workflow is confusing. **You** can.

#### NEVER: Trust a Script's Verdict

```
BAD:  Run dogfood-real.ts → "8/8 checks passed" → "The feature works!"

GOOD: Run dogfood-real.ts → READ the printed frames → Check the API yourself
      → Verify the filesystem → THEN decide if it works
```

Scripts check what they were programmed to check. They miss everything else.

#### NEVER: Skip Pre-Flight

```
BAD:  "Let me just start testing..." (without checking services)
      → 30s timeout → "Something seems wrong"
      → Wastes 5 minutes debugging a down backend

GOOD: curl health → confirm services → THEN start testing
```

#### NEVER: Test Only the Happy Path

```
BAD:  Submit one task → it works → "Feature verified!"

GOOD: Submit a task → it works → ALSO test:
      - Empty input
      - Very long input
      - Backend goes down mid-task
      - Multiple rapid submissions
      - Navigate away and back
```

#### NEVER: Dogfood Without Notes

```
BAD:  Test everything mentally → "It all looks good"
      → No record of what was tested
      → No proof of verification
      → No context for debugging later

GOOD: Create notes file → Record every test → Capture frames for failures
      → Document UX observations → Produce a complete report
```

#### NEVER: Declare "It Works" Without Evidence

```
BAD:  "The build succeeds and tests pass, so the feature works."

GOOD: "I tested the following 15 scenarios. Here are the frames showing
       the correct behavior. The API returns the expected data. Two minor
       UX issues documented. Verdict: SHIP with known issues."
```

#### NEVER: Ignore UX Problems

```
BAD:  "The agent response shows as raw JSON, but it technically contains
       the right information, so PASS."

GOOD: "PARTIAL — The agent response is correct but displayed as raw JSON:
       {"summary":"Read files..."}. A user would expect readable text.
       Filed as BUG-3 (minor, UX). Recommended fix: unwrap JSON summary."
```

#### NEVER: Claim You Tested What You Didn't

```
BAD:  "I verified all 6 pages." (but only captured 3 frames)

GOOD: Show the captured frame for EACH page. If you didn't capture it,
      you didn't test it.
```

#### NEVER: Test Only Top-Level Pages and Ignore Detail Views

```
BAD:  "All 6 pages render correctly. 0 bugs found."
      → Never pressed Enter on any list item
      → Never saw a block detail, session detail, or model detail
      → 3 major bugs shipped in detail views (double footer, scroll overflow,
        dead keyboard)

GOOD: "6 pages + 4 detail views tested. Found: double StatusBar on
       BlockDetail, scroll overflow on Foundry, J/K dead on Agent."
```

Detail views are **where composition bugs live**. The top-level page may render
perfectly because it owns its entire layout. The detail view is rendered INSIDE
a wrapper (App.ts) that adds global elements the component doesn't know about.
If you only test pages, you only test the simple case.

#### NEVER: Test Keyboard Shortcuts via PTY Isolation If the App Has a Wrapper

```
BAD:  PTY test sends J/K to AgentScreen → ConversationLog scrolls →
      "40 non-empty lines" → "PASS: scroll works"
      → In the real app, App.ts useInput() intercepts J/K first
      → User presses J/K → nothing happens

GOOD: Launch the FULL app via PTY → navigate to Agent page →
      press J/K → capture frame → verify scroll actually occurred
      → The full input handler chain is exercised
```

Component isolation testing catches rendering bugs. Only full-app testing
catches keyboard handler conflicts, focus stealing, and composition issues.

#### NEVER: Trust Scroll Calculations Without Visual Verification

```
BAD:  "Foundry renders 12 blocks. visibleItems = termRows - 9 = 31.
       12 < 31, so all items fit. PASS."
      → Didn't account for TaskInputBar (3 lines) and StatusBar (1 line)
        added by App.ts wrapper
      → With a smaller terminal or more blocks, items are pushed off-screen

GOOD: "Foundry renders 12 blocks. I scrolled to item 12. Captured frame.
       Item 12 is visible above the TaskInputBar and StatusBar. PASS."
      → Visual proof that the last item is actually visible
```

---

## Appendix: Maestro-Specific Reference

### Observation Tools Available

| Tool | File | Purpose |
|---|---|---|
| **TuiDriver** | `packages/maestro-code/tests/tui-driver.ts` | Spawn TUI via PTY, send keys, capture frames |
| **frame-capture** | `packages/maestro-code/tests/frame-capture.ts` | Low-level PTY capture infrastructure |
| **golden-utils** | `packages/maestro-code/tests/golden-utils.ts` | Structural assertions + golden file comparison |
| **real-demo-check** | `packages/maestro-code/tests/real-demo-check.cjs` | Real module resolution verification |

### TuiDriver Quick Reference

```typescript
import { TuiDriver } from './tui-driver.ts';

const driver = new TuiDriver(120, 40);           // cols, rows

// Spawn
await driver.spawn('demo');                        // No backend needed
await driver.spawn('real', { repo: 'C:/path' });  // Requires backend

// Wait
const frame = await driver.waitForRender(15000);   // Wait for first render
const frame = await driver.waitForContent(/pattern/, 30000); // Wait for text
const frame = await driver.waitForStable(2000);    // Wait for screen stability

// Interact
driver.press('/');                                 // Single key
driver.pressEnter();                               // Enter
driver.pressEscape();                              // Escape
await driver.typeText('hello', 20);                // Type with delay

// Observe
const frame = driver.captureFrame();               // Current screen
TuiDriver.printFrame(frame, 'Label');              // Print to console
const lines = driver.getLines(0, 5);               // Specific lines

// Cleanup
driver.kill();
```

### API Endpoints for State Verification

```bash
# Health
curl -s http://localhost:5000/api/health
curl -s http://localhost:5010/api/v1/health/

# Sessions
curl -s http://localhost:5000/api/sessions                          # List all
curl -s http://localhost:5000/api/sessions/{id}                     # Get one
curl -s http://localhost:5000/api/sessions/{id}/variables/{key}     # Get variable

# Key variables to check
curl -s http://localhost:5000/api/sessions/{id}/variables/_executionTree
curl -s http://localhost:5000/api/sessions/{id}/variables/_blockOutputs
curl -s http://localhost:5000/api/sessions/{id}/variables/_nodeResult_execute
curl -s http://localhost:5000/api/sessions/{id}/variables/_llmActivity
curl -s http://localhost:5000/api/sessions/{id}/variables/_conversationState_*

# Blocks
curl -s http://localhost:5000/api/blocks                           # List all
curl -s "http://localhost:5000/api/blocks?type=agent"              # Filter
```

### Maestro TUI Architecture: Wrapper + Components

> **Understanding this is critical for dogfooding.** The most common bugs come
> from the interaction between App.ts (the wrapper) and page/detail components.

```
App.ts (wrapper)
├─ FullscreenBox
│   ├─ [PageComponent OR DetailComponent]  ← rendered by routing logic
│   ├─ TaskInputBar                        ← ALWAYS present (global)
│   └─ StatusBar                           ← ALWAYS present (global)
└─ useInput() for slash-to-focus           ← ALWAYS active (global)
```

**Key implications for dogfooding:**
1. TaskInputBar appears on ALL views (pages AND detail views)
2. StatusBar appears on ALL views — if a detail component renders its own StatusBar,
   there will be TWO
3. The global `useInput()` for slash-to-focus is always active — it can intercept
   keystrokes before page-specific handlers
4. Page components calculate scroll height based on their own overhead, but they
   don't know about TaskInputBar (3 lines) and StatusBar (1 line) added by App.ts.
   **Scroll calculations must account for +4 lines of global chrome.**
5. `keyboardActive: !inputFocused` is passed to page components — when the input
   bar is focused, page keyboard handlers are disabled

**Detail views (reached by pressing Enter on list items):**

| Source Page | Enter On | Detail Component | Known Issue |
|-------------|----------|------------------|-------------|
| Home | Session | SessionMonitor | — |
| Spaces | Session | SessionMonitor | — |
| Foundry | Block | BlockDetail | Has its own StatusBar → double footer |
| Catalog | Block | BlockDetail | Has its own StatusBar → double footer |
| Models | Model | ModelDetail | — |

### Maestro TUI Pages (6)

| Page | Key | What It Shows |
|------|-----|---------------|
| **Home** | H | System status, active sessions list |
| **Agent** | A | Task input, conversation log, agent state |
| **Spaces** | S | Repos/Workspaces/Sessions (3 tabs) |
| **Foundry** | F | User's blocks (expandable list) |
| **Catalog** | C | All blocks with fitness scores |
| **Models** | M | LLM models, availability, metrics |

### Pre-Flight Checklist (Maestro-specific)

```bash
# Level 1: Observation
ls packages/maestro-code/tests/tui-driver.ts      # TuiDriver exists
npm ls node-pty 2>/dev/null | head -3              # node-pty installed

# Level 2: Interaction — verified by TuiDriver.spawn() succeeding

# Level 3: State
curl -s http://localhost:5000/api/health           # Backend
curl -s http://localhost:5010/api/v1/health/       # LLM-Provider
ls -la C:/Cantante 2>/dev/null | head -3           # Target repo
```

### Known Pitfalls

- **`AttachConsole failed`** error from node-pty on Windows — non-fatal, happens during PTY cleanup. Ignore.
- **vitest passing ≠ feature works** — always verify via TuiDriver or real-demo-check.cjs too.
- **JsonElement corruption** — API variables can contain nested empty arrays `[[[],...]]` instead of objects. Always check with curl after setting variables.
- **Session IDs** — API requires full UUIDs. CLI resolves short prefixes. When using curl, use full ID.
- **Demo mode vs real mode** — demo mode uses mock data (DemoApiClient). Only real mode connects to the backend. Always specify which mode you're testing.

---

## Quick Start: Minimal Dogfooding Session

If time is limited, this is the absolute minimum for a valid dogfooding session:

```
1. Pre-flight (30s)
   - curl health endpoints
   - Verify TuiDriver exists

2. Discovery (2 min)
   - Spawn app, capture initial frame
   - List what you see
   - Try every visible shortcut

3. Core flow test (3 min)
   - Type a task, submit, watch execution
   - Verify output visible and correct
   - Check API for session data

4. Detail view test (2 min)
   - Navigate to Foundry or Catalog
   - Press Enter on an item → capture detail view
   - Check: duplicated footers? Input bar present?
   - Press Esc → back to list

5. Scroll & keyboard test (2 min)
   - On a page with a list (Foundry, Home), scroll to the last item
   - Verify it's visible above global footers (TaskInputBar, StatusBar)
   - On Agent page (not in input mode), press J/K
   - Verify conversation actually scrolls

6. Notes (1 min)
   - Record results in session file
   - Score top 3 UX criteria

Total: ~10 minutes for a valid (minimal) dogfooding session.
```

For a comprehensive session, plan 30-60 minutes to test all pages, detail views,
flows, and edge cases.

---

## 8. Agent Quality Dogfooding (CRITICAL — added 2026-03-02)

> **This section is MANDATORY for any dogfooding session on maestro-code.**
> Previous sections focus on UI validation. This section focuses on the ONLY question that matters:
> **"Would I use this instead of Claude Code for real work?"**

### 8.1 The Problem This Section Solves

All previous dogfooding sessions (Phase 35: 34 sessions, Phase 44: 8 sessions) tested surface behavior:
- "Can I submit a task?" YES
- "Does the execution tree update?" YES
- "Does the agent produce output?" YES

But none tested depth:
- "Did the agent correctly create a workspace and session?" NEVER MEASURED
- "Did it chain Maestro operations in the right order?" NEVER MEASURED
- "Did it recover when a session failed?" NEVER MEASURED
- "Was it faster than running CLI commands manually?" NEVER ASKED

**Result**: 100% "success rate" on superficial tasks while the agent may be fundamentally inadequate for real use.

### 8.1.1 Understanding What the Agent IS

**The maestro-code agent is a conversational assistant that orchestrates Maestro.** It does not write code itself.

Its job is to:
- **Converse naturally** — answer questions, explain concepts, discuss anything (including non-Maestro topics)
- **Confirm before acting** — explain the plan, wait for user approval, then execute
- **Orchestrate Maestro** — create workspaces, sessions, launch training, monitor fitness, publish blocks
- **Report back** — explain what happened, show results, suggest next steps

**The specialized agents inside sessions do the actual work** (coding, testing, reviewing). The maestro-code agent sets them up and monitors them — like a knowledgeable colleague who knows all the CLI commands and explains everything.

**The comparison baseline is NOT Claude Code.** It's doing the operations manually via CLI.

### 8.2 Agent Quality Protocol

Every dogfooding session MUST include agent quality testing. This is not optional.

#### Step 1: Choose REAL orchestration tasks (not demos)

**BANNED tasks** (too simple, prove nothing):
- "Create a README"
- "Add ESLint configuration"
- "Write a function that does X"
- Any task that a coding assistant would do

**REQUIRED task complexity** (minimum for valid dogfooding):
- Multi-step Maestro operations (workspace + session + invoke)
- Requires knowledge of Maestro CLI commands and workflow
- Has at least one decision point (which template? which model? which entry point?)
- Takes a human 10-30 minutes to do manually via CLI

**Example GOOD tasks**:
- "Set up a workspace for Cantante and create a dev session to add a login page"
- "Create a foundry session to train a better commit message agent using Qwen2.5"
- "Check what models are available and adapt the autonomous-dev workflow for my setup"
- "The dev session on Cantante failed — diagnose the error and retry"
- "Show me the fitness of the task-planner block and optimize it if below 0.8"
- "Create a new tool block for file-search and test it in a foundry session"

#### Step 2: Time yourself (2 hours minimum)

```
Session structure:
├── Task 1 (30-45 min) — Full workspace setup
│   ├── Ask the agent to set up a workspace + session for a real project
│   ├── Watch: does it run the right CLI commands in the right order?
│   ├── Verify: workspace exists, session started, template imported
│   ├── Note: time taken, mistakes, unnecessary steps
│   └── Compare: "How long would this take me manually via CLI?"
│
├── Task 2 (30-45 min) — Foundry/training workflow
│   ├── Ask the agent to train or evaluate a block
│   ├── Watch: does it create foundry session, invoke correctly, check fitness?
│   └── Compare: "Did it know the foundry workflow without me explaining it?"
│
├── Task 3 (20-30 min) — Error recovery + monitoring
│   ├── Give a task where something will fail (wrong model, missing block)
│   ├── Watch: does it detect the failure? Read the error? Retry differently?
│   └── Note: recovery quality, did it check the monitor/execution tree?
│
└── Assessment (15 min)
    ├── Score each dimension (see 8.3)
    ├── Write honest verdict
    └── List top 3 improvements needed
```

#### Step 3: Score every dimension

| Dimension | Question | Score 1-5 |
|-----------|----------|-----------|
| **Conversation** | Can I have a natural conversation? Does it answer questions, explain concepts, discuss non-Maestro topics? | |
| **Confirmation** | Does it explain its plan and wait for my OK before executing commands? (NEVER silently executes) | |
| **Understanding** | Did it understand what I asked on the first try? | |
| **Maestro knowledge** | Did it know the right CLI commands, templates, and workflows? | |
| **Operation sequencing** | Did it chain operations in the correct order (workspace → session → template → start → invoke)? | |
| **Completeness** | Did it finish the full setup, or leave things half-configured? | |
| **Error handling** | When something went wrong, did it diagnose and recover? | |
| **Speed** | Was it faster than doing it manually via CLI? | |
| **Communication** | Did it explain what it was doing clearly? Report results after execution? | |
| **Daily use** | Would I use this every day to manage my Maestro workflows? | |

**Scoring guide**:
- 1 = Broken/useless
- 2 = Works but frustrating, would not use
- 3 = Acceptable, but Claude Code is better
- 4 = Good, competitive with Claude Code
- 5 = Excellent, better than Claude Code for this task

**V1 SHIPPING THRESHOLD**: Average score >= 3.5 across all dimensions. No dimension below 2.

#### Step 4: The Manual CLI Comparison Test

For at least ONE task per dogfooding session, do the same task both ways:

```
1. Do the task via maestro-code agent → note time, quality, frustrations
2. Do the SAME task manually via CLI commands → note time, quality, frustrations
3. Compare honestly:
   - Which was faster?
   - Which required less knowledge of Maestro internals?
   - Which had fewer errors?
   - Which felt more productive?
   - Would a NEW user prefer the agent or the CLI?
```

**If manual CLI wins on every dimension**: the agent needs fundamental improvement before shipping.
**If maestro-code agent wins** (faster, fewer errors, less Maestro knowledge required): that's the value proposition working.

### 8.3 Notes Template for Agent Quality

Add this to your dogfooding notes file:

```markdown
## Agent Quality Assessment — [DATE]

### Task 1: [description]
- **Time**: X minutes
- **Files touched**: N
- **Outcome**: [completed/partial/failed]
- **Agent mistakes**: [list]
- **Recovery quality**: [good/ok/poor]
- **vs Manual CLI**: [faster/slower/same], [easier/harder/same]
- **Verdict**: [would use / would not use / needs improvement]

### Task 2: [description]
(same structure)

### Task 3: Error Recovery Test
- **Setup**: [what should fail]
- **Agent detected error**: [yes/no]
- **Recovery approach**: [description]
- **Result**: [recovered/stuck/gave up]

### Dimension Scores
| Dimension | Score | Notes |
|-----------|-------|-------|
| Understanding | X/5 | |
| Context awareness | X/5 | |
| Architecture | X/5 | |
| Completeness | X/5 | |
| Error handling | X/5 | |
| Speed | X/5 | |
| Tool usage | X/5 | |
| Communication | X/5 | |
| Conversation | X/5 | |
| Confirmation | X/5 | |
| vs Manual CLI | X/5 | |
| Daily use | X/5 | |
| **AVERAGE** | **X/5** | |

### Top 3 Improvements Needed
1.
2.
3.

### Ship Decision
[ ] Ready to ship (avg >= 3.5, no dimension < 2)
[ ] NOT ready — needs: [list what]
```

### 8.4 Anti-Patterns for Agent Quality Dogfooding

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|-------------|----------------|-------------------|
| Testing only simple tasks | Proves nothing about real-world usefulness | Use multi-step Maestro orchestration tasks |
| "It produced output, so it works" | Output ≠ correct operations | Verify: was the workspace created? Session started? Template imported? |
| Counting sessions instead of depth | 34 shallow sessions < 3 deep sessions | One 2-hour session > ten 10-minute sessions |
| Not comparing with manual CLI | Can't judge value without a baseline | Always do at least one task both ways (agent vs manual) |
| Blaming the model, not the prompt | "Claude Sonnet can't do this" is often wrong | Check: does the system prompt include CLI reference? Are Maestro tools available? |
| Declaring "100% success" | Success on easy tasks = meaningless metric | Report success rate on HARD orchestration tasks only |
| Testing coding instead of orchestration | The agent is a conversational orchestrator, not a coder | Test workspace/session/foundry operations, not "write a function" |
| Agent executes without confirming | Silent execution = script, not assistant | If the agent runs commands without explaining and confirming first, that's a bug |
| Stopping at first success | One good result doesn't prove reliability | Run the same type of task 3+ times for consistency |

---

### Post-Incident Mandatory Checks (added 2026-02-27)

These checks were added after a dogfooding session shipped 3 major bugs because
it only tested top-level pages. They are now MANDATORY for every session:

```
□ DETAIL VIEWS: Entered at least one detail view from every page that has lists
□ COMPOSITION: Verified no duplicated StatusBars or TaskInputBars on detail views
□ SCROLL BOUNDARIES: Scrolled to last item on every scrollable list, verified
  item is visible above ALL global chrome (not just page chrome)
□ KEYBOARD IN CONTEXT: Tested page shortcuts in the FULL app (not in isolation)
  with input bar unfocused — verified shortcuts actually work
□ WRAPPER AWARENESS: Documented which global elements App.ts adds to each view
```
