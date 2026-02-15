# Blocks Architecture

> "Le type d'un block définit son interface, pas son implémentation."

Blocks are the fundamental unit of composition in Maestro. This document describes the block hierarchy, types, composition principles, and control flow model.

---

## Block Hierarchy

Blocks form a three-level hierarchy based on abstraction and complexity:

```
LEVEL 3 - WORKFLOWS (Orchestration)
    │
    ├── autonomous-development-workflow
    │   ├── task-decomposer (agent)
    │   ├── code-developer (agent)
    │   ├── result-validator (agent)
    │   └── commit-generator (inference)
    │
LEVEL 2 - AGENTS (Specialization)
    │
    ├── code-developer
    │   ├── file-read (tool)
    │   ├── file-write (tool)
    │   ├── code-search (tool)
    │   └── shell-execute (tool)
    │
LEVEL 1 - TOOLS (Atomic Capabilities)
    │
    ├── file-read
    ├── file-write
    ├── shell-execute
    └── git-status
```

### Hierarchy Principle

Higher levels orchestrate lower levels, but **a block's type defines its interface, not its contents**. A tool can internally contain workflows; an agent can use other agents. Complexity is hidden from callers.

---

## Fractal Composition

The power of Maestro comes from **fractal composition**: blocks can contain other blocks recursively, regardless of type.

### Interface vs Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    BLOCK = BLACK BOX                         │
│                                                              │
│   ┌─────────────┐                                           │
│   │   INPUT     │ ──────────────► │   OUTPUT   │            │
│   └─────────────┘         ???      └────────────┘            │
│                    (implementation hidden)                   │
│                                                              │
│   The user of a block doesn't know (and doesn't need to     │
│   know) what happens inside.                                │
└─────────────────────────────────────────────────────────────┘
```

**Example**: A "smart-commit-message" tool

| What you see | What it contains |
|--------------|------------------|
| Tool: `commit-message` | Workflow with 3 agents + validators |
| Tool: `code-review` | Agent with 10 sub-tools |
| Tool: `file-read` | Simple shell command |

From the outside, they're all tools with simple interfaces. Internal complexity is invisible.

---

## Block Types

### Tool: Action Interface

A **tool** says: "Give me X, return Y"

- Interface: Input → Output
- Can contain: Anything (agents, workflows, tools, atomic operations)
- Use case: Expose a capability as an API

### Agent: Enriched Inference Interface

An **agent** says: "Give me a task, I reason and accomplish it"

- Interface: **Same as inference** — prompt/context in, response/score out
- Can contain: Tools, other agents, workflows, atomic blocks
- Use case: Delegate reasoning and decision-making

**Key insight**: An agent is an inference block with more internal capability. From the outside, the interface is identical. A workflow node can point to an inference block OR an agent block interchangeably — it only sees input/output.

```
inference block:  prompt → [1 LLM call] → response
agent block:      prompt → [workflow: reasoning → tool discovery → execution → validation] → response
                           ↑ hidden from caller ↑
```

Tools are **discovered dynamically** by the agent's internal inference block, not declared statically. The discovery scope comes from the session/workspace, not from the agent definition.

#### How agents work (CRITICAL)

Agent and inference blocks share a base executor class (`LLMBlockExecutorBase`) that provides common LLM plumbing: mock loading, model resolution, template resolution, output parsing, and JSON extraction.

- `InferenceBlockExecutor` handles single LLM calls (template → call → response)
- `AgentBlockExecutor` handles the agentic loop (systemPrompt → multi-turn → tool calls → response)

Both are **thin and mechanical**. All content (system prompts, tool descriptions, context strategy) comes from block config — never from C#.

How the agentic loop works:

1. The block's **system prompt describes available tools** in text (like any prompt template)
2. The executor sends the prompt to the LLM
3. If the LLM response contains a tool call JSON, the executor runs it via `maestro-cli` (CLI-First)
4. The tool result is fed back as a new message, and the executor loops
5. When the LLM signals "done", the executor returns the final output

**The executor is mechanical plumbing. All intelligence lives in the block's prompt.**

**There is no `tools.json` file.** Tool descriptions live in the system prompt text. The agent uses `maestro_cli` as its single tool — through which it can run any block, read files, execute commands, etc.

**There is no hardcoded tool list or default system prompt in C#.** If `config.systemPrompt` or `system-prompt.md` is missing, the agent errors — no fallback content is invented.

**Litmus test**: Can you create a new agent by writing ONLY a `.block.json` with a `system-prompt.md`? If yes, the architecture is correct. If you need to modify executor code — it's violated.

### Workflow: Orchestration Interface

A **workflow** orchestrates execution of multiple blocks in defined order.

- Interface: Sequence of steps
- Can contain: Tools, agents, other workflows
- Use case: Coordinate a process

### Atomic Types

| Type | Purpose |
|------|---------|
| `inference` | Direct LLM call (prompt → response) |
| `validator` | Verification (input → boolean + feedback) |
| `script` | Custom code execution |
| `decision` | Conditional branching |
| `retry` | Retry logic with backoff |
| `while` | Conditional loop |
| `foreach` | Iteration over collection |
| `parallel` | Concurrent execution |

---

## The isAtomic Property

Blocks have an `isAtomic` property that determines whether they can contain children:

**Atomic blocks** (`isAtomic: true`):
- `prompt`, `instruction`, `tool`, `decision`, `validator`, `trigger`, `inference`, `script`
- Execute as single, indivisible operations
- Cannot contain other blocks

**Composite blocks** (`isAtomic: false`):
- `workflow`, `agent`, `task`
- Can contain child blocks
- Orchestrate execution of children

This property is defined in:
- Frontend: `frontend/src/registry/blockTypeDefinitions.ts`
- Backend: `backend/src/Maestro.Domain/Entities/BlockDefinition.cs`
- Must be included in API responses via `BlockDto`

---

## Control Flow as Blocks

### The Golden Rule

> **A workflow reads top-to-bottom like code.**
> **Depth = structure. Vertical order = time.**

This rule ensures:
- Readability at any scale
- Clean Git diffs
- CLI-friendly representation
- LLM-friendly reasoning
- Simple execution model

### Why Not Graphs?

| Aspect | Free-Form Graphs | Hierarchical Tree |
|--------|------------------|-------------------|
| Readability | Spaghetti at scale | Always linear |
| Versioning | Impossible to diff | Clean JSON/YAML diffs |
| CLI editing | Not possible | Natural |
| LLM reasoning | Confusing | Perfect |
| Execution | Complex state machine | Simple recursion |
| Debugging | Hard to trace | Clear path |

### Control Flow Block Types

**Decision** (If/Else):
```
▶ If: build.ok
   ├─ Then
   │    └─ ▶ Workflow: Test
   └─ Else
        └─ ▶ Command: notify failure
```

**Retry**:
```
▶ Retry (max: 3, delay: 5s)
   └─ ▶ Workflow: Flaky Test
```

**While**:
```
▶ While: coverage < 90%
   └─ ▶ Workflow: Improve Tests
```

**ForEach**:
```
▶ ForEach: package in packages
   └─ ▶ Workflow: Build Package
```

**Parallel**:
```
▶ Parallel
   ├─ ▶ Workflow: Lint
   ├─ ▶ Workflow: Unit Tests
   └─ ▶ Workflow: Integration Tests
```

### Validator Loop Pattern

A fundamental pattern for iterative improvement:

```
▶ While: quality < threshold
   │
   └─ ▶ Workflow: Improve Solution
        ├─ Agent: code-writer
        └─ Validator: quality-check
```

Each iteration:
1. Agent generates/improves output
2. Validator scores quality and provides feedback
3. Loop continues until threshold reached or max iterations

This pattern enables:
- Agent self-improvement
- Automated code review cycles
- Quality-driven content generation
- Training data generation

---

## Block Schema Reference

Common fields for all blocks:

- `id` (string): Block identifier (defaults to folder name)
- `name` (string): Human-readable name
- `version` (string): Semver version
- `blockType` (string): One of the defined types
- `isAtomic` (bool): Whether block contains children
- `description` (string): Purpose description
- `metadata` (object): Author, tags, timestamps
- `config` (object): Type-specific configuration

Files per type:

| Type | Key Files |
|------|-----------|
| Prompt | `template.md` or `config.templateFile` |
| Tool | `script.sh`, `schema.json` |
| Agent | `system-prompt.md` (tools described IN the prompt, no separate tools file) |
| Workflow | `nodes.json`, `connections.json` |
| Inference | `prompts/`, `output-schema.json` |
| Decision | `condition.txt` |
| Validator | `schema.json` |

**Note**: Agents do NOT have a `tools.json` file. Available tools are described in the system prompt text. The agent uses `maestro_cli` as its single tool to access all Maestro capabilities. See "How agents work" section above.

See `docs/schemas/block.schema.json` for the authoritative JSON Schema.

---

## Universal Block Properties

Every block, regardless of type, has:

| Property | Description |
|----------|-------------|
| **Metrics** | Execution counters, success rate, avg time, avg cost |
| **Score** | Composite performance score (fitness) |
| **Version** | Semver versioning |
| **Category** | Functional classification (git, code, analysis...) |
| **Relations** | Which blocks it uses, which blocks use it |

Metrics are a property of **execution**, not of type. A simple inference block that runs 100 times has a success rate, average time, and cost — just like an agent does. There is no reason to track metrics only on "promoted" blocks.

---

## Key Takeaways

1. **Type = Interface**: Block types define how to use them, not what they contain
2. **Agent = Inference Block**: Same base class (`LLMBlockExecutorBase`), same interface. `AgentBlockExecutor` adds the mechanical agentic loop; `InferenceBlockExecutor` does a single call. Both are thin — all content comes from block config. No separate entity.
3. **Tools in the Prompt**: Agent tools are described in the system prompt text, not in separate files or hardcoded lists. The agent uses `maestro_cli` as its single tool.
4. **Every Block is Measurable**: Metrics, score, version, fitness apply to ALL blocks
5. **Fractal Composition**: Any block can contain any other blocks
6. **Control Flow as Blocks**: Conditions and loops are blocks, not arrows
7. **Tree Structure**: Workflows are trees that read top-to-bottom
8. **Abstraction Enables Reuse**: Complex blocks can be used as simple building blocks
9. **One Entity**: `BlockDefinition` is the only entity. No `AgentDefinition`, no `ToolDefinition`. Designation (`agent`/`tool`) is metadata, not a separate class.

---

*See also: [execution.md](execution.md) for how blocks are executed*
