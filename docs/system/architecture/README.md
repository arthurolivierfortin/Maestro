# Maestro Architecture Overview

This directory contains the core architecture documentation for Maestro. Start here to understand how the system is built.

---

## Clean Architecture Layers

Maestro follows Clean Architecture principles with strict layer separation:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│              (Maestro.Api, Controllers, Hubs)                │
│              - REST API endpoints                            │
│              - SignalR hubs for real-time updates            │
│              - Request/response mapping                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│         (Maestro.Application, Use Cases, DTOs)               │
│         - Commands (write operations)                        │
│         - Queries (read operations)                          │
│         - DTOs for data transfer                             │
│         - Interfaces (ILLMGateway, ISessionRepository)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│      (Maestro.Domain, Entities, Value Objects)               │
│      - Pure business logic                                   │
│      - No external dependencies                              │
│      - Domain events                                         │
│      - Business rules and validation                         │
└─────────────────────────────────────────────────────────────┘
                           ↑ implements interfaces from
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│     (Maestro.Infrastructure, LLM Gateway, Persistence)       │
│     - ILLMGateway implementation (model adapters)            │
│     - Repository implementations                             │
│     - External service integrations                          │
└─────────────────────────────────────────────────────────────┘
```

**Key Rules:**
- Domain layer has ZERO external dependencies (only .NET BCL)
- Application layer defines interfaces, Infrastructure implements them
- NEVER import LLM SDKs outside Infrastructure layer
- API layer is thin - delegates all logic to Application

---

## Core Components

### 1. Blocks ([blocks.md](blocks.md))

The fundamental unit of composition. Everything is a block.

- **Block hierarchy**: Workflow → Agent → Tool (fractal composition)
- **Block types define interfaces**, not implementations
- **Control flow blocks**: Conditions, loops, parallelism as blocks, not arrows
- **isAtomic property**: Determines if a block can contain children

### 2. Sessions ([sessions.md](sessions.md))

Runtime execution contexts with self-describing behavior.

- **Container hierarchy**: ContainerSession → Session → ProjectSession/FoundrySession
- **Session types**: Foundry (development) vs Project (production)
- **Self-describing**: Sessions carry behavior as data in variables
- **Template-driven**: Configuration comes from JSON templates
- **Permission model**: Context-based, not identity-based

### 3. Execution ([execution.md](execution.md))

The workflow execution engine and entry point system.

- **Workflow executor**: Executes blocks in DAG order
- **Entry points**: Generic mechanism mapping names to workflow IDs
- **Execution tree**: Built from block config.nodes
- **Template-driven**: LLM prompts, output paths from session variables
- **No fallbacks**: Errors propagate, no silent failures

### 4. LLM Gateway ([llm-gateway.md](llm-gateway.md))

Model-agnostic abstraction for LLM communication.

- **ILLMGateway**: Universal interface in Application layer
- **Adapters**: OpenAI, Anthropic, Ollama in Infrastructure layer
- **LLM SDKs**: ONLY allowed in Infrastructure layer
- **Model preferences**: Configurable per request

---

## Key Principles

### 1. Generic Infrastructure, Specific Content

> "L'infrastructure est générique, le contenu est spécifique."

Infrastructure (C#, CLI, TUI) works with ANY session type. Session-specific content (prompts, phases, layout) lives in JSON templates and session variables.

**Litmus test**: Can a new session type be created with ONLY JSON changes?

### 2. CLI-First

All operations go through the CLI - for humans AND agents. An agent has ONE tool: the maestro-cli block. Through this, it can do everything.

### 3. Specialization Over Generalization

Small, focused LLMs with specialized tasks outperform large generalist models. Maestro orchestrates specialized blocks using smaller, cheaper LLMs instead of relying on a single expensive model.

### 4. Template-Driven Sessions

Sessions are self-describing. Variables carry behavior:
- `_phases`: Session-specific phase definitions
- `_workflowConfig`: LLM prompts, output paths, evaluation criteria
- `_monitorDescriptor`: TUI layout and widgets
- `_entryPoints`: Named workflow invocation points

### 5. No Silent Failures

Errors propagate. No fallback content. If something fails, the system reports it clearly rather than generating placeholder data.

---

## Sub-Documents

| Document | Description |
|----------|-------------|
| [blocks.md](blocks.md) | Block hierarchy, types, composition, control flow |
| [sessions.md](sessions.md) | Session system, container hierarchy, permissions |
| [execution.md](execution.md) | Workflow engine, entry points, executor |
| [llm-gateway.md](llm-gateway.md) | Model-agnostic design, LLM abstraction |

---

## Related Documentation

- [Philosophy](../philosophy/) - Why Maestro exists and its core principles
- [Design Decisions](../design-decisions/) - Architecture Decision Records (ADRs)
- [Conventions](../conventions/) - Naming, patterns, error handling
- [Backend Guide](backend-guide.md) - Detailed backend development guide
- [Workflow Engine Guide](workflow-engine-guide.md) - In-depth execution details

---

*Last updated: February 2026*
