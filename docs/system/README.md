# Maestro System Documentation

This directory contains the permanent, authoritative documentation of how Maestro works. It is organized as a **hierarchical tree** — start from this overview and drill down into specifics.

## Reading Order

An AI agent or developer should read in this order:

1. **This document** — System overview and cardinal rules
2. **philosophy/** — Why Maestro exists and its core principles
3. **architecture/** — How the system is built (blocks, sessions, execution)
4. **design-decisions/** — Key architectural choices (ADRs)
5. **conventions/** — Naming, patterns, and rules to follow

For task-specific work, go from here to:
- Working on sessions? → `architecture/sessions.md` → `../../phases/PHASE-28/`
- Working on blocks? → `architecture/blocks.md`
- Working on the CLI? → `../../tools/cli/`
- Working on the TUI? → `../../tools/tui-monitor/`

---

## Maestro in One Paragraph

Maestro replaces a single expensive generalist LLM with an orchestrated network of specialized blocks using smaller, cheaper LLMs. Everything is a block. Blocks compose fractally (a tool can contain workflows, an agent can contain agents). The system is fitness-driven: it measures, compares, and evolves blocks through iterative training.

## The Three Cardinal Rules

### 1. Generic Infrastructure, Specific Content

> *"L'infrastructure est generique, le contenu est specifique. C'est la force de Maestro."*

**Infrastructure** (C# backend, CLI, TUI monitor) works with ANY session type. It knows nothing about phases, fitness scores, commit tools, or any particular workflow.

**Content** (phases, prompts, evaluation criteria, monitor layout) lives in JSON templates and session variables. Each session carries its own behavior as data.

**Litmus test**: Can a new session type be created with ONLY JSON changes?

| Layer | Examples | Changes when adding new session type |
|-------|----------|--------------------------------------|
| Infrastructure (C#, CLI, TUI) | EntryPointExecutor, SessionMonitor, CLI commands | **NEVER** |
| Templates (JSON) | `foundry-default.session.json` | New template file |
| Blocks (JSON) | `agent-improvement-loop.workflow.block.json` | New block files |
| Session Variables | `_phases`, `_workflowConfig`, `_monitorDescriptor` | Defined in template |

### 2. CLI-First

> *"An agent has ONE tool: the maestro-cli block. Through this block, it can do EVERYTHING."*

All operations go through the CLI — for humans AND agents. The CLI provides **generic operations** on sessions, blocks, variables, and entry points. The CLI never contains session-specific logic.

If an operation cannot be done via CLI, the correct response is to add a generic CLI command — never to write a custom script.

### 3. Everything is a Block

> *"Le type d'un block definit son interface, pas son implementation."*

Blocks form a hierarchy: **Workflows** (orchestration) → **Agents** (specialization) → **Tools** (atomic capabilities). But a tool can internally contain workflows — its complexity is invisible to callers. This is **fractal composition**.

Conditions, loops, and parallelism are blocks, not arrows. Workflows are trees, not graphs.

---

## Directory Map

```
system/
├── philosophy/           ← WHY: Vision, principles, fitness model
│   ├── MAESTRO-PHILOSOPHY.md
│   └── MAESTRO-PHILOSOPHY-V2.md
│
├── architecture/         ← HOW: System design (general → specific)
│   ├── README.md         ← Architecture overview
│   ├── blocks.md         ← Block hierarchy, types, composition, control flow
│   ├── sessions.md       ← Session system, container hierarchy, permissions
│   ├── execution.md      ← Workflow engine, entry points, executor
│   └── llm-gateway.md    ← Model-agnostic design, LLM abstraction
│
├── design-decisions/     ← DECISIONS: Architecture Decision Records
│   ├── 0001-model-agnostic-design.md
│   ├── 0002-workflow-persistence-git.md
│   ├── 0003-clean-architecture-dotnet.md
│   └── 0004-agent-cli-separation.md
│
└── conventions/          ← RULES: Naming, patterns, error handling
    ├── session-variables.md
    ├── block-schema.md
    └── error-handling.md
```

## Key Principles (Quick Reference)

| Principle | Rule | Reference |
|-----------|------|-----------|
| Specialization | Small focused LLMs > large generalist | `philosophy/MAESTRO-PHILOSOPHY.md` |
| Template-Driven | Session behavior = JSON data, not code | `architecture/sessions.md` |
| Self-Describing Sessions | Sessions carry their own phases, layout, config | `architecture/sessions.md` |
| No Silent Failures | Errors propagate, no fallback content | `conventions/error-handling.md` |
| CLI = Universal Interface | Humans and agents use the same CLI | `../../tools/cli/README.md` |
| Fitness-Driven | Measure, compare, evolve blocks | `philosophy/MAESTRO-PHILOSOPHY-V2.md` |
| Fractal Composition | Block type = interface, not implementation | `architecture/blocks.md` |
| Tree, Not Graph | Workflows read top-to-bottom like code | `architecture/blocks.md` |
