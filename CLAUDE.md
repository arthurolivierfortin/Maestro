# Claude Code Guidelines for Maestro

This document establishes the philosophy, architecture principles, and development practices for the Maestro project.

## Communication Style

**Be critical and honest.** When something in the codebase is poorly designed, badly documented, inconsistent, or missing — say so directly. Don't sugarcoat problems or avoid pointing out gaps. If a guide exists but isn't referenced, say it. If the architecture says one thing but the code does another, flag it. The user values honest assessment over diplomatic silence.

When asked for an opinion, give a real one with reasoning. Don't hedge with "it depends" unless it genuinely does. If there are tradeoffs, name them concretely.

## Agent Execution Protocol (MANDATORY)

**When executing a phase**, read and follow `docs/system/AGENT-PROTOCOL.md`. This protocol defines:
- How to start (load context, read checkpoint)
- How to checkpoint progress
- Anti-hallucination rules (verify before claiming done)
- Memory management and handoff between sessions

**When creating a new phase plan**, use the template in `docs/system/PHASE-TEMPLATE.md`.

## No Legacy Support (MANDATORY)

**No legacy support.** When a system is replaced, remove the old code entirely. Never maintain deprecated code alongside new implementations. Clean break, no backward compatibility shims. Dead code = confusion + maintenance burden. Delete it.

## Block Development Workflow (MANDATORY)

> **Read the full pipeline guide:** `docs/guides/users/full-pipeline.md`

**The Flow**: WORKSPACE → FOUNDRY → TEST → PUBLISH → PROJECT

**Rules**:
- Always work inside a workspace — never create blocks "loose" in `content/system/blocks/`
- One foundry session per block
- Test multiple models before concluding a block doesn't work
- Never stop at the first obstacle — iterate models, prompts, approaches
- Publish before using in production

**Reference guides**: `docs/guides/users/full-pipeline.md`, `docs/guides/users/foundry-sessions.md`, `docs/guides/ai-agents/creating-blocks.md`

## Developing Maestro vs Using Maestro (CRITICAL DISTINCTION)

> **Maestro is the app we are building. Sessions are for using Maestro on target projects.**

- **Developing Maestro** = modifying C# backend, CLI code, TUI components, block definitions. Normal software development — edit files, build, test. NO session needed.
- **Using Maestro** = running agents/workflows on a target project (e.g., Cantante) via sessions. REQUIRES a workspace, a session with a meaningful name, and the monitor.

**NEVER create a session to "test" Maestro infrastructure.** To verify backend fixes, use `curl` or API calls directly.

## Session & Workspace Rules (MANDATORY)

### Session Creation Checklist

```powershell
# 1. Identify or create the workspace
node index.js workspace info <workspace-id>
# 2. Create session WITH meaningful name (not "test" or "fix")
node index.js session create --type project --name "<Project> - <Feature>" --repo "<path>" --template <template> --start
# 3. Add to workspace
node index.js workspace add-session <workspace-id> <session-id>
# 4. Launch monitor BEFORE any invoke
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\packages\maestro-cli; node index.js monitor <session-id>'"
# 5. THEN invoke entry points
node index.js session invoke <session-id> <entry-point> --input key=value
```

**Naming**: Session names MUST describe the work: `"Cantante - File Tree Module"`. NEVER `"Monitor Fix Test"`.

## Core Philosophy

> **Full philosophy docs**: `docs/system/philosophy/MAESTRO-PHILOSOPHY.md`, `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md`

### Everything is a Block — The Universal Unit

There is no Agent entity. There is no Tool entity. There are only Blocks with different types. Every block has metrics. One discovery system (`FileSystemBlockDiscoveryService`), one file format (`*.block.json`), one API (`/api/blocks`).

**Agent = same interface as inference, composite implementation.** From outside: prompt → response (identical to inference). From inside: composite (`isAtomic: false`), a black box of child blocks. The caller doesn't know the internals.

**Tool availability comes from the prompt**, not from code. System prompt lists available tools as JSON schemas. No hardcoded tool lists in C#, no `tools.json`, no default system prompts built in C#.

**Known debt**: `AgentBlockExecutor` still calls LLM directly instead of orchestrating child blocks. Tracked for Phase 35-PRE.

**ADRs**: `docs/phases/PHASE-18/ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT.md`, `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md`

### The Cardinal Rule: Generic Infrastructure, Specific Content

**Infrastructure** (C# backend, CLI, TUI) is GENERIC — works with ANY session type.
**Content** (phases, prompts, workflows, criteria) is SPECIFIC — lives in JSON templates/blocks.

**Litmus test**: Can a new session type be created with ONLY JSON changes? If no, architecture violated.

**Details**: `docs/phases/PHASE-8/README.md`

### LLM-Provider Owns All Provider Logic

Maestro has ONE LLM gateway (`LLMProviderGateway`) → talks to LLM-Provider .NET API (port 5010). **All provider-specific logic lives in LLM-Provider, never in Maestro.**

LLM-Provider is a **.NET Clean Architecture solution** (`C:\Meastro\llm-provider\dotnet\`) with providers: Azure, AzureInference, Local (Python FastAPI for GPU). Adding a new provider = new project in LLM-Provider .NET, zero Maestro changes.

**Litmus test**: Can a new LLM provider be added without changing ANY Maestro C#? If no, architecture violated.

### CLI-First: Everything Through the CLI

ALL operations go through the CLI — for humans AND agents. The CLI provides generic operations on sessions, blocks, variables, entry points. NEVER write custom scripts for operations the CLI should handle. If the CLI doesn't support an operation, add it as a generic command.

### Self-Describing Sessions

Sessions carry their own behavior through variables and template data: `_phases`, `_monitorDescriptor`, `_workflowConfig`, `entryPoints`, `monitorWidgets`. Infrastructure reads these — never creates them.

### No Silent Failures

Errors must be visible. No fallback content, no fake data, no silent degradation. The monitor shows errors in red. The user decides.

## Documentation Structure

```
docs/
├── system/              ← Architecture & philosophy (start here)
│   ├── philosophy/      ← WHY Maestro exists
│   ├── architecture/    ← HOW it's built (blocks, sessions, execution)
│   ├── design-decisions/← ADRs
│   └── conventions/     ← Rules (variables, errors, schema)
├── tools/               ← CLI, TUI monitor, frontend reference
├── guides/              ← For AI agents and users
├── phases/              ← Per-phase docs (current = PHASE-44)
├── operations/          ← Deployment, Docker, security
└── archive/             ← Completed/outdated
```

### Key Reference Documents

| Document | When to read |
|----------|-------------|
| `docs/system/AGENT-PROTOCOL.md` | **Before executing ANY phase** |
| `docs/system/PHASE-TEMPLATE.md` | **Before writing ANY phase plan** |
| `docs/ROADMAP.md` | Current roadmap overview |
| `docs/guides/users/full-pipeline.md` | **Before creating ANY block** |
| `docs/guides/ai-agents/dogfooding-methodology.md` | **Before ANY dogfooding session** |
| `docs/guides/ai-agents/common-pitfalls.md` | **Before infrastructure changes** — 20+ detailed pitfalls |
| `docs/guides/ai-agents/testing-strategy.md` | **Before/after making changes** — testing checklist |
| `docs/guides/developers/dev-environment.md` | Service startup, ports, CLI commands |
| `docs/system/architecture/backend-guide.md` | Architecture guidelines, session system, API contract, TUI monitor |
| `docs/system/architecture/sessions.md` | Before ANY session/infrastructure work |
| `docs/system/architecture/blocks.md` | Before block/workflow work |
| `docs/system/architecture/execution.md` | Before execution engine work |
| `docs/system/conventions/error-handling.md` | Before adding error handling |
| `docs/tools/cli/README.md` | Before proposing CLI commands |
| `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` | Core philosophy and fitness model |

## Development Environment

> **Full guide**: `docs/guides/developers/dev-environment.md`

```powershell
# Start all services
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1
# Stop
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -Stop
```

| Service | Port | Health |
|---------|------|--------|
| LLM-Provider | 5010 | http://localhost:5010/api/v1/health/ |
| Backend | 5000 | http://localhost:5000/ |
| Frontend | 5173 | http://localhost:5173/ |

## Testing Requirements

> **Full guide**: `docs/guides/ai-agents/testing-strategy.md`

1. Run tests **before** and **after** every significant change
2. Verify builds: `dotnet build` (backend), `npm run build` (frontend)
3. Verify API behavior with `curl` — **never claim "fixed" based on build success alone**
4. For TUI changes: run `real-demo-check.cjs` and `test:visual`
5. For maestro-code changes: run `npx tsc --noEmit` in `packages/maestro-code/` — type errors are bugs
6. For any setup/onboarding flow change: test the first-run flow (no `.maestro/`, no provider config)
7. For dogfooding: follow `docs/guides/ai-agents/dogfooding-methodology.md` — **MUST include first-run flow test**

## Common Pitfalls

> **Full reference**: `docs/guides/ai-agents/common-pitfalls.md` (20+ detailed pitfalls with cause/fix/verification)

**Critical ones to always remember**:
- **NEVER use `@ts-nocheck`**: Directly caused the 2026-03-03 incident — missing props invisible to compiler, shipped broken first-run flow
- **Forward ALL options after setup flows**: When creating services after onboarding/config, forward every option from the original launch context. Missing options default to no-ops silently
- **Dogfood the first-run flow**: Delete `.maestro/` + provider config, launch fresh, complete setup, send first message. Pre-configured state skips the most critical code path
- **JsonElement corruption**: `NormalizeObjectValue()` in `SessionsController.cs` — variables become nested arrays without it
- **DI circular dependency**: `AgentBlockExecutor` ↔ `BlockExecutorRegistry` — use lazy `??=` resolution
- **SDK/backend type mismatch**: ALWAYS `curl` the API to verify response shape before writing SDK types
- **Session-specific logic in infra**: If adding a session type requires C# changes, architecture is violated
- **Agents are not special**: One entity (`BlockDefinition`), one metrics system. Content in block config, not C#

## V1 Delivery Discipline (MANDATORY — decided 2026-03-02)

> **Reference**: `docs/phases/PHASE-45/STRATEGIC-ANALYSIS.md` — full analysis of why these rules exist.

### The Goal

Phase 45 = first distributable version. `npm install -g @maestro/cli && maestro init && maestro code` that works. **Everything else is post-V1.**

### Refactoring Rules

- **NEVER refactor unless a bug or a blocked feature requires it.** "I don't like how it's structured" is not a valid reason.
- **Max 20% of a phase's time can be refactoring.** If exceeded, stop and deliver current state.
- **Cosmetic refactoring is the #1 velocity killer.** Track it. Name it. Refuse it.

### Phase Discipline

- **Every phase must deliver something a user can see or use.** No "infrastructure only" phases.
- **Max 3 days per phase.** If it takes longer, split it.
- **Write "Definition of Done" and "NOT in scope" BEFORE coding.** See `docs/phases/PHASE-45-PREP/README.md` as template.
- **Kill scope creep immediately.** If a task wasn't in the original plan, it goes to next phase.

### "Everything is a Block" — Scope Clarification

The principle applies to the **execution engine only**, not to all code:

| IS a block (execution layer) | Is NOT a block (infrastructure) |
|------------------------------|--------------------------------|
| Workflows, agents, tools, validators | TUI components (React/Ink) |
| Inference blocks, conditions, loops | CLI commands |
| Anything in `content/system/blocks/` | SessionManager, ConversationManager |
| Anything executed by `EntryPointExecutor` | SDK client, Sidecar |

**Stop asking "should this be a block?"** If it's not executed by the block engine, it's code. Period.

### maestro-code V1 Architecture

- **The agent is a conversational assistant that orchestrates Maestro.** It talks to the user, answers questions, explains concepts, and when asked to do something — confirms the plan before executing. It creates workspaces, sessions, launches specialized agents (foundry, project), monitors fitness, publishes blocks. It can also discuss topics unrelated to Maestro (general questions, explanations, brainstorming).
- **Confirm before acting.** The agent NEVER silently executes commands. It says "I'll create a workspace for Cantante and launch a dev session with template X. Sound good?" and waits for confirmation.
- **Specialized agents do the actual work.** Coding, testing, reviewing, committing — that's done by specialized agents running in project/foundry sessions. The maestro-code agent sets them up and monitors them.
- **All pages stay and are central.** Spaces (workspaces/sessions), Foundry (training), Catalog (blocks), Models (LLM status) — these show the state of the system and are essential, not secondary.
- **Slash commands for actions**: `/help`, `/new`, `/clear`, `/stop`, `/quit`
- **NO navigation paradigm changes.** The current model (slash-to-focus + hotkeys for pages) is final for V1.
- **The differentiator vs Claude Code**: Claude Code writes code. Maestro orchestrates agents that write code, train themselves, and improve over time. The maestro-code agent is the friendly interface to that system — conversational, knowledgeable, and action-oriented.

### Dogfooding Rules

- **Read `docs/guides/ai-agents/dogfooding-methodology.md` — especially Section 8 (Agent Quality).**
- **Minimum 2 hours continuous use** per dogfooding session. Not 15 minutes.
- **Test conversation + orchestration**: "Explain what a foundry session is, then create one for training a commit agent", "What's the best template for a dev session on Cantante? Set it up.", "The last session failed — what happened?"
- **Test confirmation behavior**: The agent must explain its plan and wait for confirmation before executing commands. If it silently runs operations, that's a bug.
- **Compare with doing it manually.** After each task, ask: "Was this faster/easier than running the CLI commands myself?" If no, the agent needs improvement.
- **Judge the full experience.** Does it feel like talking to a knowledgeable colleague? Does it explain, confirm, execute, and report back?

### Self-Hosting Timeline

Maestro building itself = Phase 49-50. NOT a V1 concern. Build maestro-code in normal code (React/Ink/TypeScript). The agent block running INSIDE maestro-code is a block. The TUI is not.

## Commit Guidelines

1. Run all tests before committing
2. Note any intentional test changes in commit message
3. Do not commit if new tests are failing (unless pre-existing failures)
4. **NEVER add `Co-Authored-By` lines or any AI attribution in commit messages** — commits are authored by the user, not the AI
