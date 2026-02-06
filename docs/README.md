# Maestro Documentation

## Navigation

### For AI Agents
Start here: [`CLAUDE.md`](../CLAUDE.md) → [`system/`](system/README.md) → topic-specific docs

### For Developers
Start here: [`system/architecture/`](system/architecture/README.md) → then the area you're working on

### For Users
Start here: [`guides/users/quickstart.md`](guides/users/quickstart.md)

---

## Directory Structure

```
docs/
├── system/                  Architecture & philosophy (permanent, evolves slowly)
│   ├── philosophy/          WHY: Vision, principles, fitness model
│   ├── architecture/        HOW: Blocks, sessions, execution, LLM gateway
│   ├── design-decisions/    DECISIONS: Architecture Decision Records (ADRs)
│   └── conventions/         RULES: Variable naming, error handling, block schema
│
├── tools/                   Tool reference (practical, how-to-use)
│   ├── cli/                 CLI commands and usage
│   ├── tui-monitor/         TUI monitor modes, widgets, descriptors
│   ├── frontend/            Frontend/UI, workspace canvas
│   └── mcp/                 MCP server setup and tools
│
├── guides/                  Audience-specific guides
│   ├── ai-agents/           For AI assistants working on the codebase
│   └── users/               For humans using Maestro
│
├── phases/                  Development phases (matching MAESTRO-N branches)
│   ├── PHASE-4/ .. PHASE-7/ Completed phases
│   ├── PHASE-8/             Current phase (sessions, TUI, execution)
│   ├── PHASE-9/             Next phase (training, research)
│   └── PHASE-10/            Future (autonomous agents)
│
├── operations/              Deployment, Docker, security
│
└── archive/                 Completed/outdated documents
    ├── implementation-plans/ Old implementation plan docs (numbered 1-9)
    ├── changelogs/
    ├── issues/
    └── proposals/
```

## How to Find What You Need

| Working on... | Start reading |
|---------------|--------------|
| Sessions / Entry Points | `system/architecture/sessions.md` |
| Blocks / Workflows | `system/architecture/blocks.md` |
| Execution Engine | `system/architecture/execution.md` |
| CLI Commands | `tools/cli/README.md` |
| TUI Monitor | `tools/tui-monitor/README.md` |
| Frontend / Canvas | `tools/frontend/` |
| Phase 8 (current) | `phases/PHASE-8/README.md` |
| Core Philosophy | `system/philosophy/MAESTRO-PHILOSOPHY.md` |
| Design Decisions | `system/design-decisions/` |
