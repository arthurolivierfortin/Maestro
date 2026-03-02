# Dogfood Notes — Phase 45-PREP-F

**Date** : 2026-03-02
**Duration** : ~55 min (tasks) + 15 min (assessment) = 1h10
**Services** : Backend (port 5000), LLM Provider (port 5010) — Azure, AzureInference, Local, Anthropic all available
**Session ID** : 6821081a-415c-43a4-bc57-4cda7019a8fe
**Method** : Direct API calls (curl) to backend, testing agent via workflow invocation — equivalent to TUI behavior

---

## Pre-flight Checklist

- [x] Backend running: `curl http://localhost:5000/api/health` → `{"status":"healthy"}`
- [x] LLM Provider running: `curl http://localhost:5010/api/v1/health/` → `{"status":"healthy"}`
- [x] Agent responds: Send "Salut" → response in ~20s: "Salut ! Je suis l'assistant Maestro. Je peux t'aider a gerer tes workspaces..."

**Pre-flight issues found:**
- Template import fails on `_activeConversation: null` — API rejects null values in PUT variable endpoint (HTTP 400)
- Must manually invoke `new-conversation` entry point before first message to create initial conversation
- Conditional `{{_activeConversation}} != null` evaluates `'' != null` → True when variable doesn't exist, skipping conversation creation

---

## Task 1: Workspace Setup (~9 min agent, <5s manual)

**Request**: "Set up un workspace pour Cantante et cree une session de dev pour ajouter un dark mode"

### Observations
- Agent confirmed plan before executing? **YES** — Presented 4-step plan with correct template (project-autonomous), asked "Ca te va ?"
- Commands in correct order? **YES** — workspace → session → associate → invoke (correct sequence described)
- Workspace created? **YES** — ID ca9078f7-07a6-44ab-be21-23d785abaa43 verified via API
- Session started? **NO** — Agent was blocked by security (path validation rejects C:\Meastro CLI from C:\Cantante session)
- Result reported clearly? **PARTIALLY** — Workspace creation reported well; security error explained with fallback CLI commands

### Critical Bug: Conversation Context Loss
After the agent presented its plan, confirming with "Oui, go" resulted in a **re-greeting** — the agent lost all conversation context. This happened 3 times total. Root cause: each workflow invocation creates a new internal conversation for the agent via IConversationManager. The `conversationHistory` input from the workflow's conversation block is not properly injected into the agent's context.

### Workaround
Sending self-contained requests (all info in one message) works. Multi-turn interactions (plan → confirm → execute) are broken.

### Timing
- Agent time: ~9 min (multiple invocations needed due to context loss and security blocks)
- Manual CLI time: <5 seconds (session create --template project-autonomous --start, then workspace add-session)

### Manual CLI equivalent
```bash
cd C:\Meastro\packages\maestro-cli
# Workspace: instant
node index.js workspace create Cantante --repo "C:/Cantante"
# Session + template + start: <1s
node index.js session create --repo "C:/Cantante" --template project-autonomous --name "Cantante - Dark Mode" --start
# Associate: instant
node index.js workspace add-session <ws-id> <session-id>
```

### Notes
- The agent's PLAN was perfect — correct template, correct sequence, good explanation
- EXECUTION failed due to (1) context loss after confirmation, (2) security blocking CLI access
- When given self-contained requests, the workspace creation worked correctly
- The security issue is a real blocker: the agent's session is bound to C:\Cantante but ALL Maestro CLI commands must run from C:\Meastro\packages\maestro-cli

---

## Task 2: Exploration & Knowledge (~8 min)

### Q1: "Quels blocks sont disponibles pour du code generation ?"
- Quality: **3/5**
- Notes: First attempt got a re-greeting (context loss). Retry with explicit self-contained request worked. Agent found 2 workflows, 11 dev agents, 4 validators. Response was terse — a summary sentence rather than a detailed list with descriptions. For a conversational assistant, should have listed each block with its purpose.

### Q2: "Explique la difference entre une foundry session et une project session"
- Quality: **4/5**
- Notes: Excellent structured response with analogies (R&D lab vs junior dev), comparison table, correct template names, and contextual follow-up about Cantante. Responded in ~37s from prompt knowledge. No files read — all from system prompt.

### Q3: "Quel template je devrais utiliser pour entrainer un agent de commit messages ?"
- Quality: **4/5**
- Notes: Correctly recommended foundry-default with practical reasoning (more control). Provided complete 6-step workflow. Proactively offered to help create the session. Responded from prompt knowledge.

### Additional: General knowledge question (TS vs JS)
- Quality: **5/5**
- Notes: Clear, concise, technically correct. Referenced Cantante's use of TypeScript (contextual awareness). ~25s response time.

### Observations
- Did the agent read files to inform itself? **YES** (for Q1 — read block files to list them)
- Did it respond from prompt knowledge? **YES** (for Q2, Q3, general Q — the system prompt contains template/workflow info)
- Agent knowledge of Maestro concepts is **solid** for single-turn questions
- Multi-turn context is completely broken

---

## Task 3: Error & Recovery (~5 min)

**Request**: "Lance une session foundry pour le block 'block-inexistant-xyz'"

### Observations
- Error detected? **YES** — Agent detected the block doesn't exist BEFORE attempting to create the session
- Logs read? **PARTIALLY** — Referenced "la liste des blocks que j'ai recuperee precedemment" (from earlier invocation)
- Alternative proposed? **YES** — Two clear alternatives: use existing block or create new one
- Quality of diagnosis: **5/5**

### Additional error test: Non-existent session ID
- Agent tried to check but was blocked by security
- Correctly identified the null UUID as likely invalid
- Provided CLI commands as fallback
- Quality: **3/5** (blocked from execution, fallback is manual)

### Notes
- Error prevention is excellent — the agent anticipated the failure rather than trying and failing
- Error recovery on blocked commands is decent — provides manual CLI fallback
- The security blocking is the main impediment to error handling quality

---

## Scoring (10 dimensions)

| # | Dimension | Question | Score | Observation |
|---|-----------|----------|-------|-------------|
| 1 | Conversation | Natural conversation? Responds to general questions? | 4/5 | Natural, warm, contextual. Handles FR and EN. References Cantante. Emoji use appropriate. General questions answered well. |
| 2 | Confirmation | Explains plan and waits for OK before executing? | 4/5 | YES — presents clear plan with numbered steps, asks "Ca te va ?" BUT confirmation flow is broken (context loss means "Oui" causes re-greeting). |
| 3 | Understanding | Understands request on first attempt? | 4/5 | Correctly interprets complex requests. Identifies right templates, right sequence. Breaks down into steps well. |
| 4 | Maestro Knowledge | Knows correct CLI commands, templates, workflows? | 4/5 | Strong knowledge of templates, foundry vs project, workflow sequences. Correct CLI syntax. Some from system prompt, some from reading blocks. |
| 5 | Operation Sequencing | Correct order? (workspace -> session -> template -> start -> invoke) | 4/5 | Plan described correct sequence. Self-contained workspace creation worked. But can't complete full sequence due to security + context loss. |
| 6 | Completeness | Completes full setup, or leaves things half-configured? | 1/5 | **Critical failure.** Only workspace created. Session not created (security). Context loss prevents multi-step completion. Half-configured state. |
| 7 | Error Handling | When something fails, diagnoses and recovers? | 4/5 | Excellent error PREVENTION (block-inexistant). Good fallback to manual CLI commands. Correctly explains security blocking. |
| 8 | Speed | Faster than manual CLI? | 1/5 | **Manual CLI: <5 seconds. Agent: 9+ minutes.** Orders of magnitude slower. Context loss requires repeating requests. Security blocks require manual fallback. |
| 9 | Communication | Explains what it does clearly? Reports results? | 4/5 | Clear explanations, good structure (tables, lists, analogies). Reports workspace creation with ID. Some responses terse (Q1 block listing). |
| 10 | Daily Use | Would I use this every day for Maestro workflows? | 2/5 | For QUESTIONS about Maestro — yes. For EXECUTION — no. Context loss + security make multi-step operations impossible. |

**Average** : 3.2 / 5
**Highest** : Conversation, Confirmation, Understanding, Maestro Knowledge, Sequencing, Error Handling, Communication = 4
**Lowest** : Completeness = 1, Speed = 1

### Scoring Guide
- 1 = Broken / useless
- 2 = Works but frustrating, wouldn't use
- 3 = Acceptable, manual CLI is as good
- 4 = Good, better than CLI for some things
- 5 = Excellent, better than CLI, want to use daily

### Threshold: Average >= 3.5, no dimension < 2 — **FAILED** (3.2 average, two dimensions at 1)

---

## Comparison: Agent vs Manual CLI

| Metric | Agent | Manual CLI |
|--------|-------|-----------|
| Time (Task 1) | ~9 min (incomplete) | <5 seconds (complete) |
| Errors | 5 (3 context loss, 1 security, 1 template null) | 0 |
| Maestro knowledge required | Agent guides (good) | Must know commands |
| Subjective experience | Frustrating for execution, good for Q&A | Fast but requires CLI expertise |
| Completeness | 25% (workspace only) | 100% |
| Multi-step operations | Broken (no context between turns) | Works if you know the commands |

**Verdict**: Manual CLI wins decisively for execution. Agent wins for knowledge/explanation/discovery.

---

## Bugs Found

| # | Description | Severity | Fixed? |
|---|-------------|----------|--------|
| 1 | Template import fails on null values — `_activeConversation: null` causes HTTP 400 on PUT variable | HIGH | Yes — migrated null→"", CLI warns on null |
| 2 | Conditional `{{_activeConversation}} != null` evaluates empty string as "not null", skipping conversation creation | HIGH | Yes — changed condition to `!= ""` |
| 3 | Agent loses ALL conversation context between invocations — each workflow run creates new IConversationManager conversation | CRITICAL | Yes — deterministic conversation ID (sessionId:blockId), persistent across invocations |
| 4 | Security path validation blocks agent from reading files outside session root | CRITICAL | Yes — wired AllowedPaths from session permissions into ToolBlockExecutor for read ops |
| 5 | Agent re-greets on every turn instead of continuing conversation (symptom of Bug 3) | CRITICAL | Yes — fixed by Bug 3 |
| 6 | `step-complete` summary sometimes in third person ("Informed the user...") instead of direct address | LOW | Yes — added rule 14 to system prompt |

---

## Top 3 Improvements

1. **Fix conversation history injection** — The agent MUST receive prior messages on each invocation. Either (a) inject the `conversationHistory` input into the IConversationManager before the agent runs, or (b) use a persistent conversation ID keyed to the session so the same conversation persists across invocations. Without this, multi-turn interactions are completely broken.

2. **Fix security path validation for shell-execute** — The agent needs to run `cd C:\Meastro\packages\maestro-cli && node index.js ...` from ANY session, regardless of the session's repository path. Options: (a) whitelist Maestro CLI path, (b) don't restrict shell-execute workingDir to session root, (c) add a `maestro-cli` tool type that always runs from the CLI directory.

3. **Fix null variable handling in template import** — Either (a) skip null values during import, (b) support null in the PUT variable endpoint, or (c) use a sentinel value like `"__null__"` that the conditional can check.

---

## Verdict

**Decision** : ~~BLOCKED~~ → FIXES APPLIED — all 6 bugs fixed, pending re-dogfooding

**Reasoning** :
The agent's **knowledge and conversational quality are strong** (4/5 on 7 dimensions). It correctly identifies templates, explains concepts, prevents errors, and communicates naturally. The system prompt rewrite in 45-PREP-E was effective.

Two **critical infrastructure bugs** made execution impossible — now fixed:
1. ~~Conversation context loss~~ → Fixed: deterministic conversation ID (sessionId:blockId), persistent across invocations
2. ~~Security path validation blocks reads~~ → Fixed: AllowedPaths from session permissions wired into ToolBlockExecutor

All 6 bugs fixed (see CHANGELOG.md for details). Also added:
- `GET/PUT /api/sessions/{id}/permissions` API endpoints
- `session permissions` CLI command (list, add-path, remove-path)
- 4 new AllowedPaths security tests

**After fixes, re-score estimate**: Average likely 3.8-4.0 (completeness jumps to 3-4, speed improves significantly, daily use goes to 3-4).
**Next step**: Re-dogfooding to confirm score >= 3.5 and pass the gate.
