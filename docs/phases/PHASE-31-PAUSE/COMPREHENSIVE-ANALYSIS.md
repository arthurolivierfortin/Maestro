# Maestro — Comprehensive Project Analysis & Strategic Recommendations

**Date**: 2026-02-18
**Author**: Claude (system architect)
**Context**: Deep pause after Phase 31 Pre-Solidification, before deciding next direction
**Branch**: `feat/MAESTRO-8-create-first-real-session` (250 commits ahead of main)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Was Planned vs What Was Done (Phase 15-31)](#2-what-was-planned-vs-what-was-done)
3. [Honest State of the Codebase](#3-honest-state-of-the-codebase)
4. [OpenClaw Comparison](#4-openclaw-comparison)
5. [Autonomous Dev Pipeline Assessment](#5-autonomous-dev-pipeline-assessment)
6. [Optimization Tiers — Where We Are](#6-optimization-tiers)
7. [CLI Assessment — What's Missing](#7-cli-assessment)
8. [Project Structure Assessment](#8-project-structure-assessment)
9. [Strategic Questions Answered](#9-strategic-questions-answered)
10. [Honest Direction Assessment](#10-honest-direction-assessment)
11. [Recommended Next Steps](#11-recommended-next-steps)
12. [Appendix: Block Inventory](#appendix-block-inventory)

---

## 1. Executive Summary

**Maestro is architecturally excellent but operationally incomplete.**

The generic infrastructure is solid: session system, execution engine, block discovery, approval pipeline, CLI (100+ commands), TUI monitor, LLM-Provider multi-provider gateway. The cardinal rule (generic infrastructure / specific content) is well-respected in the codebase.

The autonomous-development workflow (Phase 30-C) **works** — 3/3 tests passing on real repos with real git commits. This is a genuine achievement that validates the block orchestration model.

**But three critical gaps define where we actually are:**

1. **No blocks have ever been published through the approval flow.** The foundry/publish/catalog pipeline exists as infrastructure but has zero real usage. The autonomous-dev blocks were hand-crafted and tested ad-hoc, not through the system.

2. **250 commits sit on a feature branch that has never been merged to main.** This means the project has no stable release baseline. `main` is essentially empty.

3. **The gap between documentation/vision and reality is large.** The docs describe a full foundry system, fitness tracking, training iterations, multi-tier optimization — but most of this is conceptual. What exists is: create block JSON -> test manually -> iterate.

**Bottom line**: Maestro has proven its architecture works. Now it needs to stop building new features and solidify what exists into a usable product.

---

## 2. What Was Planned vs What Was Done

### Phase 15: TUI UX Improvements
| Planned | Done |
|---------|------|
| CLI shell more user-friendly (loading, ID completion) | Partially — CLI has colors and formatting |
| Monitor with full terminal background | Done — `setTerminalBg(palette.bg)` |
| Resizable/draggable panels with mouse | Done — `useMouse` hook, panel focus |
| TUI as mini-frontend (pages for models, global view) | Done — Multi-page TUI with sessions, models, workspaces, blocks, repos |
| Monitor shared components for shell previews | Partially — shared/tui/ components exist but shell integration limited |

**Verdict**: Mostly delivered. The TUI migration from blessed to Ink was a significant rewrite (37 files). Navigation works but has UX rough edges.

### Phase 16: TypeScript Migration
| Planned | Done |
|---------|------|
| CLI fully typed in TypeScript | Done — `cli.ts` with @ts-nocheck (pragmatic) |
| Shared types layer | Done — `shared/types/` with full coverage |
| Shared utils layer | Done — `shared/utils/` |
| Tests migrated | Done — 88 tree tests pass via tsx |

**Verdict**: Fully delivered. Clean architecture with `@shared/*` path aliases.

### Phase 17: Shared Theme & Navigation
| Planned | Done |
|---------|------|
| Unified visual identity | Done — `shared/theme/` |
| Contextual navigation (Schema A) | Done — Ctrl+arrows context-sensitive |
| Configurable keybindings | Done — `~/.maestro/keybindings.json` |
| Action-based keyboard system | Done — `useActionKeyboard` |

**Verdict**: Fully delivered. Good foundation for future TUI work.

### Phase 19: First Downloadable Version
| Planned | Done |
|---------|------|
| Chat with models feature | NOT DONE |
| Subscriptions & GitHub auth | NOT DONE |
| Downloadable app package | NOT DONE |
| `maestro` CLI available system-wide | NOT DONE |
| User onboarding flow | NOT DONE |

**Verdict**: This was an ambitious vision document. Zero of it was implemented. Phase 19 was premature — the infrastructure wasn't ready. The requests here are still valid but for a much later phase.

### Phase 25: Shared App Logic
| Planned | Done |
|---------|------|
| Eliminate TUI/Frontend duplication | Done — `shared/app/` layer |
| Shared transforms and hooks | Done — 86 transform tests + 32 import chain tests |
| usePolling as canonical hook | Done — replaces duplicated useApiData |

**Verdict**: Fully delivered. Clean separation (transforms = pure, hooks = React-only).

### Phase 26: V3 Autonomous Dev Agent
| Planned | Done |
|---------|------|
| Create blocks using workspace/foundry flow | NOT DONE — blocks created directly |
| Train blocks with fitness measurement | NOT DONE — ad-hoc iteration |
| Publish through approval flow | NOT DONE — blocks remain unpublished |
| Test on Cantante project | Done — 3/3 tests passing |
| Take notes on CLI UX gaps | Partially — some noted but not systematically |
| Use ONLY maestro CLI (no direct code edits) | NOT DONE — developer created blocks manually |

**Verdict**: The core deliverable (working autonomous agent) was achieved. But the process prescribed (workspace -> foundry -> publish) was completely bypassed. The GOAL-GUIDE.md was not followed.

### Phase 26-B: Claude Code LLM Provider
| Planned | Done |
|---------|------|
| ClaudeCodeLLMProvider in LLM-Provider .NET | Done |
| Multi-provider active simultaneously | Done — factory routes by model_id |
| `claude -p` mode for stateless requests | Done — spawns per request |

**Verdict**: Fully delivered. Clean architecture, zero Maestro changes needed.

### Phase 28: Review & V3 Roadmap
| Planned | Done |
|---------|------|
| Roadmap document for V3 phases | Done — ROADMAP-V3.md |
| Detailed suggestions for optimization | Done — two suggestion documents |
| Phase 29 PURPOSE.md | Done |
| Aliases system design | Designed, NOT implemented |
| `maestro run-interactive` | NOT implemented |
| Manifeste de publication design | Designed, NOT implemented |

**Verdict**: Phase 28 was primarily planning/documentation. Good analysis but no code.

### Phase 30-C: Autonomous Dev v3 Implementation
| Planned | Done |
|---------|------|
| 8-node workflow pipeline | Done — prepare -> plan -> validate -> store -> implement(for-each) -> test -> review -> commit |
| Anti-hallucination guards | Done — json-validator, step-validator, done-guard |
| 7 sub-blocks with system prompts | Done — all exist with .md prompts |
| 3 test scenarios on Cantante | Done — 3/3 passing |

**Verdict**: The actual agent development work. Fully delivered within scope.

### Phase 31 Pre-Solidification
| Planned | Done |
|---------|------|
| P1-A: Fix TUI phase display | DONE — phaseId mapping in EntryPointExecutor |
| P1-B: Fix Ink memory leaks (6) | DONE — refs, cleanup, bounded collections |
| P1-C: Fix LLM-Provider monitor (6) | DONE — already fixed in code |
| P2-A: Make json-validator generic | DONE — schema as input |
| P3-A: Version conflict protection | DONE — 409 Conflict + --force |
| P3-B: Quality gate enforcement | DONE — name/version/content gates |
| P3-C: Block provenance tracking | DONE — ProvenanceInfo class |
| P4-A: Publish Phase 30 blocks | READY — requires running backend |
| P5-A: Foundry gap + docs update | DONE — current-pipeline.md created |

**Verdict**: Solid work. 9/10 issues resolved. P4-A is the most important remaining step.

---

## 3. Honest State of the Codebase

### What Actually Works (Verified)

| Component | Status | Confidence |
|-----------|--------|------------|
| C# Backend (API, sessions, blocks, execution) | Working | HIGH |
| CLI (100+ commands) | Infrastructure complete | HIGH |
| TUI Monitor (Ink, multi-page, polling) | Working with recent fixes | HIGH |
| LLM-Provider .NET (4 providers) | Working | HIGH |
| Block Discovery Service | Working | HIGH |
| Session Templates (3 types) | Working | HIGH |
| Execution Engine (workflow, for-each, conditional, phase) | Working | HIGH |
| Autonomous-dev workflow (8 nodes, 7 sub-blocks) | Working (3/3 tests) | HIGH |
| Approval System (submit, approve, reject, quality gates) | Code complete | MEDIUM (untested E2E) |
| Publishing Pipeline (catalog, manifest, provenance) | Code complete | MEDIUM (untested E2E) |

### What Exists as Infrastructure Only (No Real Data)

| Component | Infrastructure | Usage |
|-----------|---------------|-------|
| Catalog system | FileSystemBlockPublisher writes to catalog | ZERO published blocks |
| Fitness tracking | FitnessConfig, CLI commands | ZERO measured fitness scores |
| Training system | CLI commands, session template | ZERO training sessions run |
| Experiment system | CLI commands, models | ZERO experiments created |
| Documentation pipeline | Workflow blocks, CLI commands | ZERO generated docs |
| Foundry system | 2 CLI commands (overview, leaderboard) | ZERO foundry sessions |

### What Doesn't Exist Yet

| Component | Status |
|-----------|--------|
| aliases.json system | Designed, not implemented |
| `maestro run-interactive` | Designed, not implemented |
| `maestro code` mode (interactive agent TUI) | Conceptual |
| Multi-tier optimization | Conceptual |
| Manifeste auto-generation at publish | Conceptual |
| `maestro adapt` / `maestro optimize` | Phase 29, conceptual |
| Downloadable app / installer | Phase 19 vision, not started |
| Auth / subscriptions | Phase 19 vision, not started |
| Block marketplace / community catalog | Phase 31+ vision |

### Block Inventory Summary

| Category | Count | Notes |
|----------|-------|-------|
| Agent blocks | 8 | project-preparer, task-planner, implement-single-step, test-executor, git-committer, context-analyzer, interaction-handler, autonomous-dev |
| Inference blocks | 5 | code-reviewer, code-generator, test-generator, commit-writer, pr-writer |
| Tool blocks | 25+ | git-*, file-*, shell, json-validator, step-validator, code-*, npm, typescript, etc. |
| Workflow blocks | 15+ | autonomous-development, generate-commit-message, develop-feature, foundry/*, documentation/* |
| System blocks | 20+ | agents (orchestrator, trainer, tester, etc.), strategies (10 types), UI blocks (5), tools (5) |
| **Total** | **~85** | Many system blocks are "shell" definitions (JSON exists but no tested content) |

**Critical distinction**: Of the 85+ blocks, only the autonomous-dev workflow's 8 blocks (7 sub-blocks + workflow) have been **actually tested end-to-end**. The rest exist as JSON files but have never been invoked.

---

## 4. OpenClaw Comparison

### What is OpenClaw?

OpenClaw (formerly Clawdbot/Moltbot) is a **personal AI assistant** by Peter Steinberger (PSPDFKit founder). 145K+ GitHub stars. It is a messaging-first autonomous agent that bridges WhatsApp, Telegram, Slack, Discord and 50+ platforms to LLMs. It runs as a persistent daemon with cron jobs, webhooks, and long-running sessions.

**OpenClaw is NOT a coding agent.** It is a general-purpose assistant that happens to be capable of coding among many other tasks. Claude Code is vastly better for actual development work.

### Key Differences

| Aspect | Maestro | OpenClaw |
|--------|---------|----------|
| **Core identity** | Specialized workflow orchestration for LLMs | Personal AI assistant across messaging platforms |
| **Primary interface** | CLI + TUI Monitor | WhatsApp, Telegram, Slack, web |
| **Agent philosophy** | Many specialized small models orchestrated | One powerful model with 4 basic tools |
| **Block/Skill system** | Hierarchical (workflow > agent > tool), fitness-tracked, typed | Flat SKILL.md files, no metrics |
| **Optimization strategy** | Train specialized blocks, measure fitness, publish tiers | Route queries to cheaper models by complexity |
| **Session model** | Template-driven, self-describing, variables-based | Global config, channel-based routing |
| **Model support** | Via LLM-Provider .NET (multi-provider gateway) | Direct SDK/OpenRouter with fallback chains |
| **Community** | Solo project (you + Claude) | 145K stars, open-source foundation |

### What We Can Learn from OpenClaw

1. **Three-tier model routing** — OpenClaw's Tier 1/2/3 (complex/daily/simple) with 50-80% cost savings is a clean concept. Maestro's approach of training blocks for local models is more sophisticated but OpenClaw's routing is immediately useful while our tiers are still conceptual.

2. **Fallback chains with exponential backoff** — `primary -> fallback1 -> fallback2` with automatic recovery. Our LLM-Provider has multi-provider support but no automatic fallback chain.

3. **SOUL.md / AGENTS.md identity separation** — Interesting for agent personas. Our system-prompt.md files serve a similar purpose but without the philosophical separation.

4. **Self-extending agents (Pi philosophy)** — Agent writes its own tools at runtime. This is the opposite of Maestro's "specialization over generality" but worth noting for edge cases where an agent needs a one-off tool.

5. **Daily memory logs + curated MEMORY.md** — We should consider a similar pattern for long-running sessions.

### Where Maestro is Architecturally Stronger

1. **Fitness model** — No equivalent in OpenClaw. We can measure and compare block performance.
2. **Workflow orchestration** — Our for-each, while, conditional, phase nodes vs OpenClaw's linear agent loop.
3. **Foundry pipeline** — Traceability from creation to publish. OpenClaw is "drop a file in place."
4. **Self-describing sessions** — Sessions carry their own behavior. OpenClaw uses global config.
5. **Generic infrastructure** — Our cardinal rule is well-enforced. OpenClaw mixes concerns.

### Are We Different from Them?

**Yes, fundamentally.** OpenClaw is a messaging router + personal assistant. Maestro is a specialized orchestration system for LLM workflows. The only overlap is "both use LLMs." Our value proposition (orchestrate many small specialized models) is completely different from theirs (route one big model to many chat platforms).

**OpenClaw is not a competitor.** A more relevant comparison would be with projects like:
- **Aider** — Coding assistant with multi-model support
- **SWE-agent** — Autonomous SWE benchmark agent
- **OpenHands (formerly OpenDevin)** — Autonomous coding agent
- **Devon** — Autonomous coding agent with planning

None of these have Maestro's block/fitness/orchestration model. They're all single-agent systems. Maestro's differentiator is the specialization-through-orchestration approach.

---

## 5. Autonomous Dev Pipeline Assessment

### Is the Pipeline Well-Made?

**The v3 workflow architecture is good.** The 8-node pipeline (prepare -> plan -> validate -> store -> implement(for-each) -> test -> review -> commit) follows sound principles:

- Each node has a single responsibility
- Validators between stages prevent hallucination propagation
- for-each over plan steps gives per-step visibility in the monitor
- The workflow is data-driven (JSON config, not C# code)

### Is It Solid for a New User?

**No.** A new user would face these problems:

1. **No published blocks in catalog.** Running `maestro catalog` returns empty. There's nothing to discover.

2. **No "quick start" flow.** To use autonomous-dev, a user would need to:
   - Know the template name (`project-autonomous`)
   - Create a session manually
   - Add it to a workspace
   - Start the monitor
   - Know the entry point name (`dev`)
   - Know the input format (`--input task="..." repoPath="..."`)

   That's 6 steps with no guidance. Compare to Claude Code: `claude "add a login page"`.

3. **No error recovery.** If a step fails, the user has no "retry from step 3" mechanism. They restart the whole workflow.

4. **No interactive mode.** The agent runs autonomously with zero user interaction. If it makes a wrong plan, the user can't correct it mid-flight.

5. **Documentation gap.** `current-pipeline.md` exists but describes block development, not "how to use the autonomous agent on your project."

### What Would Make It Solid?

1. **Publish the blocks** (P4-A) — so `maestro catalog` shows something real.
2. **A "getting started" guide** for using the autonomous agent on a real repo.
3. **`maestro code`** — an interactive mode like Claude Code where the user can chat, the system orchestrates, and the user sees real-time progress.
4. **Resume/retry** — ability to restart from a specific step on failure.
5. **User approval gates** — "Here's my plan, approve before I implement?" step in the workflow.

---

## 6. Optimization Tiers

### Where Are the Plans?

The tier optimization system is defined in three documents:

- **ROADMAP-V3.md (Phase 28-C)**: Manual creation of Tier 1 (all-Claude) through Tier 5 (all-local)
- **SUGGESTIONS-OPTIMIZE.md**: Detailed design for `maestro optimize` as a meta-workflow
- **Phase 29 PURPOSE.md**: `maestro adapt` (test local substitutes) and `maestro optimize` (automated tier creation)

### What Exists?

**Nothing operational.** The concept is solid:

```
Tier 1: All Claude (max quality, max cost)
Tier 2: Claude for planning/review, local for implementation
Tier 3: Smaller cloud models + local
Tier 4: Mostly local with cloud fallback
Tier 5: All local (max accessibility, lowest cost)
```

Each tier would be a published workflow with a manifeste documenting:
- Which models per block
- Fitness scores per block
- Tested substitutes with their scores
- Evaluation criteria

### What's Missing Before Tiers Can Happen?

1. **The Tier 1 workflow must be published first** (P4-A — ready to execute)
2. **Fitness measurement per block** — we have composite workflow fitness (3/3 pass) but no per-block metrics
3. **Manifeste structure** — designed but not implemented in the publish flow
4. **Model switching per block** — the infrastructure supports it (`config.nodes[].inputs.model`) but it hasn't been tested
5. **Evaluation criteria per block** — needed for `maestro adapt` to know what "good enough" means

### Realistic Timeline

- **Tier 1 publish**: 1 session (just run P4-A)
- **Per-block fitness measurement**: 1-2 days of systematic testing
- **Tier 2 creation (manual)**: 2-3 days (swap models per block, measure fitness, publish)
- **Automated tier creation (Phase 29)**: 1-2 weeks
- **Tier 3-5**: Only possible after `maestro adapt` works

**My honest assessment**: Tier optimization is Phase 29+ work. Don't attempt it until Tier 1 is published and the autonomous-dev agent has been used on real projects for feedback.

---

## 7. CLI Assessment

### What the CLI Has (100+ Commands)

The CLI is remarkably comprehensive for a project at this stage:

**Fully functional**: health, sessions (create/list/info/invoke/vars), blocks (list/info/metrics/search/create/update/delete), approvals (list/approve/reject), workspaces (create/list/add-session/permissions/topology), projects (create/bind/discover), run, monitor, validate

**Infrastructure exists, no data**: training (create/start/pause), fitness (calculate/leaderboard/profiles), experiments (create/start/compare), foundry (overview/leaderboard), orchestrator (status/promote/rollback), docs (list/show/generate)

### What's Missing?

| Feature | Impact | Phase |
|---------|--------|-------|
| `maestro code` (interactive agent mode) | CRITICAL — the killer feature | Should be Phase 32 |
| `aliases.json` system | HIGH — enables `maestro agent` as shortcut | Phase 28-B |
| `maestro run-interactive <workflow>` | HIGH — generic interactive execution | Phase 28-B |
| `maestro adapt <workflow>` | MEDIUM — test local model substitutes | Phase 29-A |
| `maestro optimize <block>` | MEDIUM — automated tier creation | Phase 29-B |
| `maestro check <workflow>` | LOW — static compatibility check | Phase 28-C |
| Quick-start / onboarding flow | HIGH — first-run experience | New phase needed |
| `maestro init` (initialize .maestro in a repo) | HIGH — entry point for new users | New phase needed |
| Auto-completion for IDs (session, block) | MEDIUM — UX quality of life | CLI improvement phase |
| `--input` flag usability (quoting is painful) | MEDIUM — developer experience | CLI improvement phase |

### Where Is the Phase to Improve the CLI?

**There is no dedicated CLI improvement phase in the roadmap.** The CLI evolved incrementally across phases (12, 13, 16) but was never given a focused phase for UX polish. Phase 15 mentions CLI improvements but focused on the TUI monitor instead.

### Is It in the Right Place in the Roadmap?

**No.** CLI improvement should come BEFORE `maestro code` mode. Here's why:

The `maestro code` mode will be built ON TOP of the CLI infrastructure. If the CLI has poor UX (hard to discover commands, painful input quoting, no auto-completion, no helpful error messages), then `maestro code` inherits those problems.

**Recommended**: Insert a CLI polish phase before Phase 32 (maestro code). Focus on:
- `maestro init` as the entry point
- Auto-completion / fuzzy matching for IDs
- Better `--input` handling
- Helpful error messages with suggestions
- A `maestro quickstart` command that guides through first use

---

## 8. Project Structure Assessment

### Is the Project Separated Correctly?

**Yes, the separation is clean:**

```
C:\Meastro\                      (Maestro orchestration system)
├── backend/                     (C# .NET Clean Architecture)
├── frontend/                    (React + TypeScript + Vite)
├── maestro-cli/                 (Node.js CLI)
├── shared/                      (shared types, utils, hooks, theme, TUI)
├── content/system/              (blocks, templates — shipped with app)
├── content/user/                (user data — runtime)
├── docs/                        (documentation hierarchy)
└── dev-scripts/                 (development utilities)

C:\LLM-Provider\                 (Separate project — LLM gateway)
├── dotnet/                      (C# Clean Architecture, multi-provider)
└── api/                         (Python FastAPI, local GPU only)
```

**What's correct:**
- Backend, frontend, CLI, and shared are properly separated
- Content is split into system (shipped) and user (runtime)
- LLM-Provider is a separate project (zero coupling with Maestro)
- Block logic is in JSON/markdown, not in C#

**What could be better:**
- `shared/` does too much — it contains types, utils, theme, TUI components, and app hooks. Consider splitting into `shared-types/`, `shared-tui/`, `shared-app/` at the npm level.
- The 250-commit feature branch means there's no release structure. Need branches per release.
- No monorepo tooling (nx, turbo, lerna) — each package manages its own deps.

### Should Autonomous-Dev Be Improved Before Building CLI Mode?

**Yes, but with a specific scope.** Here's the logical order:

```
CURRENT STATE
     │
     ▼
[A] Publish Tier 1 (P4-A) — 1 session
     │
     ▼
[B] Use autonomous-dev on 2-3 REAL tasks — 2-3 days
     │  (Not tests. Real features on a real project.)
     │  Document everything that breaks or is painful.
     │
     ▼
[C] Fix what [B] reveals — 3-5 days
     │  (Missing blocks, bad prompts, UX issues, error handling)
     │
     ▼
[D] CLI Polish Phase — 3-5 days
     │  (maestro init, auto-completion, better errors, quickstart)
     │
     ▼
[E] maestro code mode — 1-2 weeks
     │  (Interactive TUI, built on polished CLI)
     │
     ▼
[F] Tier optimization — 1-2 weeks
     │  (After maestro code validates the experience)
```

**Steps A through C improve the autonomous-dev agent based on real usage.**
**Steps D and E build the user-facing CLI mode on a solid foundation.**
**Step F optimizes for accessibility (local models).**

---

## 9. Strategic Questions Answered

### Should We First Improve Autonomous-Dev, Then Build CLI Mode on Top?

**Yes.** The `maestro code` mode will expose the autonomous-dev workflow to users interactively. If the underlying workflow has issues (bad plans, hallucination, missing error recovery), those issues will surface in `maestro code` and be harder to fix there.

Improve the workflow first (steps A-C above), then build the interactive shell (step E).

### Should We Rush Autonomous-Dev to Stop Using Claude Code?

**No.** Here's the honest math:

- **Claude Code today**: Works reliably, has IDE integration, handles complex tasks, costs subscription money
- **Maestro autonomous-dev today**: Works on simple-moderate tasks (3/3 tests), no interactive mode, no error recovery, no user approval gates

Rushing to replace Claude Code with Maestro would mean:
1. Slower development velocity (Maestro is less capable than Claude Code)
2. More time debugging Maestro instead of building features
3. Risk of losing confidence in the project when Maestro fails on complex tasks

**The right approach**: Use Claude Code for Maestro development. Use Maestro's autonomous-dev for target projects (Cantante and others) to validate the pipeline. When Maestro's `maestro code` mode reaches parity with Claude Code for standard tasks, switch.

**Estimated timeline to parity**: 2-3 months of focused work.

### What Could Make Claude Code Dev More Optimal?

1. **CLAUDE.md is already excellent** — comprehensive, well-structured, enforces principles
2. **Add a `.claude/commands/` directory** with custom slash commands for common Maestro operations
3. **Use Claude Code hooks** to auto-run tests after edits
4. **Keep context focused** — the 230-line MEMORY.md is hitting limits. Move detailed content to topic files.
5. **Use Claude Code for code, Maestro for testing** — run autonomous-dev on test repos as part of the dev loop

### Are We in the Right Direction?

**Long-term: YES.** The vision of orchestrating specialized small models to replace one expensive generalist is sound, differentiated, and increasingly relevant as local LLM quality improves.

**Short-term: PARTIALLY.** The project has spent too much time on infrastructure breadth and not enough on depth. There are 85+ block files but only 8 have been tested. There are 100+ CLI commands but many return empty data. The feature branch has never been merged.

**The correction needed**: Stop adding new infrastructure. Start using what exists. Publish blocks, run real workflows, measure fitness, fix what breaks. Depth over breadth.

---

## 10. Honest Direction Assessment

### What We're Doing Right

1. **Architecture discipline** — The cardinal rule is well-enforced. Session templates are data-driven. Executors are mechanical. Adding new session types requires zero C# changes.

2. **Block-based everything** — Validators, agents, tools, workflows all share the same interface. The autonomous-dev v3 proves this works for real tasks.

3. **Multi-provider LLM gateway** — Clean separation. Adding a provider requires zero Maestro changes. Four providers working.

4. **Honest self-assessment** — The Phase 31 Pre-Solidification analysis was ruthlessly honest about gaps. That's rare and valuable.

5. **TUI quality** — The Ink-based monitor is genuinely useful with real-time execution tree, phases, log, LLM activity.

### What We're Doing Wrong

1. **Feature breadth over usage depth** — 100+ CLI commands, 85+ blocks, but the system has never been used end-to-end as intended (workspace -> foundry -> publish -> catalog -> use). We build features instead of using them.

2. **250 commits on one branch** — This is unsustainable. There's no release baseline, no ability to rollback, no way to give someone a "stable version." Main is empty.

3. **Documentation promises exceed reality** — `full-pipeline.md` describes a system that doesn't exist. Training, fitness, foundry, experiments — these have CLI commands but no real data. A new user reading the docs would expect far more than what works.

4. **No real users** — The system has never been used by anyone other than its creator. Significant UX issues are invisible without external feedback.

5. **Phase numbering inflation** — We're at "Phase 31" but much of what was "planned" in early phases was never built. Phase numbers suggest maturity that doesn't exist.

### Things That Concern Me

1. **The system blocks (20+)** in `content/system/blocks/system/` — orchestrator-agent, trainer-agent, researcher-agent, etc. — are these functional or aspirational JSON shells? If aspirational, they should be moved or clearly marked.

2. **Training strategies (10 types)** — SFT, RL-fitness, preference, distillation, curriculum, etc. These are incredibly ambitious. Are they real implementations or conceptual placeholders?

3. **The fitness formula** — `ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ` — is defined in philosophy docs but is there actual code that computes this? If not, the entire optimization story rests on a concept.

4. **UI blocks (5 types)** — progress-indicator, metrics-dashboard, workspace-status, activity-log, fitness-chart. Are these functional components or JSON definitions?

---

## 11. Recommended Next Steps

### Phase 32: Foundation Solidification (1-2 weeks)

**Goal**: Make what exists work end-to-end, for real, with real data.

#### Step 1: Merge to Main (1 day)
- Create a release baseline from the current branch
- Tag as `v0.1.0-alpha`
- Establish branch-per-feature workflow going forward
- Clean up the 9 unused local branches

#### Step 2: Execute P4-A — Publish Blocks (half day)
- Run the backend
- Publish all 8 autonomous-dev blocks through approval flow
- Verify they appear in `maestro catalog`
- This is the MINIMUM to claim the pipeline works

#### Step 3: Audit and Clean System Blocks (1-2 days)
- Go through ALL 85+ blocks
- Mark as `status: "active"` or `status: "placeholder"` in their metadata
- Move aspirational blocks to a `content/system/blocks/_drafts/` directory
- The catalog should only show blocks that actually work

#### Step 4: Write the Getting Started Guide (half day)
- "How to use Maestro's autonomous-dev agent on your project"
- 5-minute quickstart: install, create session, invoke, see results
- Target audience: a developer who has never seen Maestro

#### Step 5: Use Autonomous-Dev on 3 Real Tasks (2-3 days)
- Pick 3 features for Cantante (or another repo)
- Run the full pipeline: session create -> invoke dev -> monitor -> verify commit
- Document EVERY issue encountered
- This is the most valuable step — real usage reveals real problems

#### Step 6: Fix What Step 5 Reveals (3-5 days)
- Fix broken prompts, missing error handling, UX issues
- This will probably reveal 5-10 issues we can't predict now

### Phase 33: CLI Mode (1-2 weeks)

**Goal**: `maestro code` — an interactive development mode.

#### Design
```
$ cd my-project
$ maestro code

Maestro v0.1.0 | Model: claude-sonnet | Blocks: 8 loaded
Project: my-project (no .maestro dir — run maestro init first)

> maestro init
Created .maestro/ directory with default config.
Found: package.json (Node.js), tsconfig.json (TypeScript)
Created: .maestro/CONVENTIONS.md (review and edit)

> Add a login page with email/password authentication
[Planning] Analyzing project structure... ████████░░ 80%
[Planning] Created 5-step plan:
  1. Create LoginPage component
  2. Add authentication service
  3. Add login route
  4. Add form validation
  5. Add tests

Proceed? [Y/n/edit]
> y

[Step 1/5] Creating LoginPage component...
  ✓ Created src/components/LoginPage.tsx
  ✓ Created src/components/LoginPage.test.tsx
[Step 2/5] Adding authentication service...
  ...
```

#### Key Features
- Interactive REPL with real-time progress (reuse TUI widgets)
- User approval before implementation
- Step-by-step visibility
- Retry/skip individual steps
- Built on top of the existing autonomous-dev workflow
- `maestro init` as the entry point for new repos

### Phase 34: Tier Optimization (1-2 weeks)

**Goal**: Create Tier 2 (mixed cloud/local) from Tier 1.

- Measure per-block fitness for Tier 1
- For each block, test local model substitutes (Qwen, SmolLM2)
- Publish Tier 2 with manifeste showing substitution results
- This validates the optimization concept manually before automating in Phase 35

### Phase 35: maestro adapt (1 week)

**Goal**: Automate what Phase 34 did manually.

- `maestro adapt <workflow>` reads manifeste, tests user's local models
- Produces personalized workflow for user's hardware
- Uses heuristic evaluator (Level 1) — no LLM needed for evaluation

### Beyond Phase 35

- Phase 36: `maestro optimize` (automated multi-tier creation)
- Phase 37: First downloadable release (installer, onboarding)
- Phase 38: Block marketplace / community catalog
- Phase 39: Auth, subscriptions, cloud evaluator

---

## Appendix: Block Inventory

### Autonomous-Dev Blocks (TESTED, Phase 30-C)

| Block | Type | Status |
|-------|------|--------|
| autonomous-development | workflow | Working (3/3 tests) |
| project-preparer | agent | Working |
| task-planner | agent | Working |
| implement-single-step | agent | Working |
| test-executor | agent | Working |
| code-reviewer | inference | Working |
| git-committer | agent | Working |
| json-validator | tool | Working (generic post-P2-A) |
| step-validator | tool | Working |

### Original Tool Blocks (Phase 8-10 era)

| Block | Type | Status |
|-------|------|--------|
| file-read | tool | Likely working (basic) |
| file-write | tool | Likely working (basic) |
| shell-execute | tool | Likely working (basic) |
| git-diff / git-status / git-log | tool | Likely working (basic) |
| git-describe-commit | tool | Unknown |
| code-extractor / code-search | tool | Unknown |
| test-runner / npm-run / typescript-check | tool | Unknown |
| project-structure | tool | Unknown |
| directory-list | tool | Unknown |
| llm-generate | tool | Unknown |
| model-detector | tool | Unknown |
| convention-reader | tool | Unknown |
| file-scaffolder | tool | Unknown |
| code-analyzer | tool | Unknown |
| dependency-manager | tool | Unknown |
| context-builder | tool | Unknown |
| workflow-state-manager | tool | Unknown |
| manifest-generator | tool | Unknown |

### Phase 28 Agent Blocks (Status Unknown)

| Block | Type | Status |
|-------|------|--------|
| context-analyzer | agent | Unknown |
| interaction-handler | agent | Unknown |
| autonomous-dev | agent | Unknown (different from autonomous-development workflow) |

### System Blocks (Likely Aspirational)

| Block | Type | Status |
|-------|------|--------|
| documenter-agent | agent | Likely placeholder |
| experiment-manager | agent | Likely placeholder |
| fitness-evaluator | agent | Likely placeholder |
| orchestrator-agent | agent | Likely placeholder |
| publisher-agent | agent | Likely placeholder |
| researcher-agent | agent | Likely placeholder |
| tester-agent | agent | Likely placeholder |
| trainer-agent | agent | Likely placeholder |
| maestro-cli | tool | Working (the CLI tool block) |

### Strategy Blocks (10 types, Likely Aspirational)

sft-strategy, rl-fitness-strategy, preference-strategy, execution-based-strategy, evolutionary-strategy, distillation-strategy, curriculum-strategy, self-play-strategy, neuro-symbolic-strategy, moe-strategy

### Workflow Blocks (Various Phases)

| Block | Status |
|-------|--------|
| generate-commit-message | Tested (Phase 8-10 era) |
| autonomous-task | Unknown |
| cantante-add-feature | Specific to Cantante, unknown |
| develop-feature | Unknown |
| foundry/* (7 workflows) | Infrastructure, likely partially working |
| documentation/* (2 workflows) | Placeholder |
| research-team-workflow | Placeholder |
| iteration-runner | Unknown |
