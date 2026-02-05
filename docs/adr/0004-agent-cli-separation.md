# ADR 0004: Separation of Agent Block and Maestro CLI Block

**Status**: Accepted
**Date**: 2026-02-04
**Decision Makers**: Architecture Team
**Supersedes**: None
**Related**: [ADR-0001](0001-model-agnostic-design.md), [DESIGN-MAESTRO-CLI-BLOCK](../architecture/DESIGN-MAESTRO-CLI-BLOCK.md)

---

## Context

### The Problem

Maestro needs agents capable of executing tools through the CLI interface. The initial design considered two approaches:

1. **Single Block Approach**: A monolithic "Maestro Agent" block that generates tool calls and directly formats/executes them against the Maestro CLI.

2. **Two Block Approach**: Separate "Agent" block (generates structured commands) and "Maestro CLI" block (formats and executes commands).

### Requirements

1. Agents must be able to call Maestro tools
2. The system should support integration with external IDEs (VS Code, Cursor, etc.)
3. Each component should have a single, clear responsibility
4. The architecture should be testable and maintainable
5. The solution should align with the "Tout est un Block" philosophy

### Constraints

- Maintain compatibility with existing `maestro-cli` block design
- Support the permission model defined in `DESIGN-MAESTRO-CLI-BLOCK.md`
- Enable reuse across different execution contexts

---

## Decision

**We will implement a two-block architecture: a generic Agent block and a Maestro CLI block.**

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TWO-BLOCK ARCHITECTURE                                                      │
│                                                                              │
│  ┌─────────────────────┐         ┌─────────────────────┐                    │
│  │     AGENT BLOCK     │         │   MAESTRO-CLI BLOCK │                    │
│  │                     │         │                     │                    │
│  │  Responsibilities:  │         │  Responsibilities:  │                    │
│  │  • Reason about task│  ───►   │  • Parse command    │                    │
│  │  • Decide actions   │ output  │  • Format for CLI   │                    │
│  │  • Generate commands│         │  • Execute request  │                    │
│  │  • Handle responses │  ◄───   │  • Return result    │                    │
│  │                     │ result  │                     │                    │
│  └─────────────────────┘         └─────────────────────┘                    │
│           │                                  │                               │
│           │                                  │                               │
│           ▼                                  ▼                               │
│  ┌─────────────────────┐         ┌─────────────────────┐                    │
│  │  REUSABLE IN:       │         │  CONNECTS TO:       │                    │
│  │  • Maestro          │         │  • Maestro Backend  │                    │
│  │  • VS Code          │         │  • CLI API          │                    │
│  │  • Cursor           │         │  • Permission Layer │                    │
│  │  • Claude Desktop   │         │                     │                    │
│  │  • Any MCP client   │         │                     │                    │
│  └─────────────────────┘         └─────────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comparison with Rejected Alternative

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REJECTED: SINGLE-BLOCK ARCHITECTURE                                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      MAESTRO-AGENT BLOCK                            │    │
│  │                                                                     │    │
│  │  • Reason about task                                                │    │
│  │  • Decide actions                                                   │    │
│  │  • Generate commands                                                │    │
│  │  • Format for Maestro CLI  ◄── Tightly coupled                     │    │
│  │  • Execute against CLI     ◄── Cannot be reused elsewhere          │    │
│  │  • Handle responses                                                 │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Problems:                                                                   │
│  • Agent logic locked to Maestro                                            │
│  • Cannot use same agent in VS Code extension                               │
│  • Violates Single Responsibility Principle                                 │
│  • Harder to test (must mock entire CLI)                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Block Definitions

### Agent Block

```json
{
  "id": "agent",
  "name": "Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Generic agent that reasons about tasks and generates structured tool calls. Output is a standardized command format that can be consumed by any tool executor.",

  "config": {
    "model": "configurable",
    "systemPrompt": "configurable",
    "maxIterations": 10,
    "outputFormat": "structured"
  },

  "inputs": {
    "task": {
      "type": "string",
      "required": true,
      "description": "The task for the agent to accomplish"
    },
    "context": {
      "type": "object",
      "required": false,
      "description": "Additional context (available tools, history, etc.)"
    },
    "tools": {
      "type": "array",
      "required": false,
      "description": "List of available tool definitions"
    }
  },

  "outputs": {
    "action": {
      "type": "object",
      "description": "Structured action to execute",
      "schema": {
        "type": { "type": "string", "enum": ["tool_call", "response", "delegate"] },
        "tool": { "type": "string" },
        "arguments": { "type": "object" },
        "reasoning": { "type": "string" }
      }
    },
    "status": {
      "type": "string",
      "enum": ["pending", "completed", "needs_input", "error"]
    }
  }
}
```

### Maestro CLI Block (Enhanced)

```json
{
  "id": "system:maestro-cli",
  "name": "Maestro CLI",
  "blockType": "tool",
  "version": "1.1.0",
  "isSystem": true,
  "isAtomic": true,
  "description": "Executes commands against Maestro CLI. Accepts structured input from Agent blocks or raw command strings.",

  "config": {
    "contextAware": true,
    "permissionCheck": "backend",
    "timeout": 60000,
    "inputMode": "auto"
  },

  "inputs": {
    "command": {
      "type": "string",
      "required": false,
      "description": "Raw command string (e.g., 'run fitness-calculator --input modelId=x')"
    },
    "action": {
      "type": "object",
      "required": false,
      "description": "Structured action from Agent block",
      "schema": {
        "tool": { "type": "string" },
        "arguments": { "type": "object" }
      }
    }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "output": { "type": "any" },
    "error": { "type": "string" },
    "exitCode": { "type": "number" }
  }
}
```

---

## Execution Flow

### Flow 1: Agent + Maestro CLI (Internal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WITHIN MAESTRO                                                              │
│                                                                              │
│  Task: "Calculate fitness for model smollm2:1.7b"                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. AGENT BLOCK processes task                                       │    │
│  │                                                                      │    │
│  │  Input: {                                                            │    │
│  │    task: "Calculate fitness for model smollm2:1.7b",                │    │
│  │    tools: [{ name: "fitness-calculator", ... }]                     │    │
│  │  }                                                                   │    │
│  │                                                                      │    │
│  │  Agent reasons → decides to call fitness-calculator                  │    │
│  │                                                                      │    │
│  │  Output: {                                                           │    │
│  │    action: {                                                         │    │
│  │      type: "tool_call",                                              │    │
│  │      tool: "fitness-calculator",                                     │    │
│  │      arguments: { modelId: "smollm2:1.7b" },                        │    │
│  │      reasoning: "Need to calculate fitness metrics"                  │    │
│  │    },                                                                │    │
│  │    status: "pending"                                                 │    │
│  │  }                                                                   │    │
│  └──────────────────────────────────┬──────────────────────────────────┘    │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  2. MAESTRO-CLI BLOCK executes                                       │    │
│  │                                                                      │    │
│  │  Input: {                                                            │    │
│  │    action: {                                                         │    │
│  │      tool: "fitness-calculator",                                     │    │
│  │      arguments: { modelId: "smollm2:1.7b" }                         │    │
│  │    }                                                                 │    │
│  │  }                                                                   │    │
│  │                                                                      │    │
│  │  CLI Block:                                                          │    │
│  │  • Formats: "run fitness-calculator --input modelId=smollm2:1.7b"   │    │
│  │  • Sends to backend: POST /api/cli/execute                          │    │
│  │  • Receives result                                                   │    │
│  │                                                                      │    │
│  │  Output: {                                                           │    │
│  │    success: true,                                                    │    │
│  │    output: { totalFitness: 0.756, breakdown: {...} },               │    │
│  │    exitCode: 0                                                       │    │
│  │  }                                                                   │    │
│  └──────────────────────────────────┬──────────────────────────────────┘    │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  3. AGENT BLOCK receives result, continues reasoning                 │    │
│  │                                                                      │    │
│  │  Agent processes result → task complete                              │    │
│  │                                                                      │    │
│  │  Output: {                                                           │    │
│  │    action: {                                                         │    │
│  │      type: "response",                                               │    │
│  │      content: "Fitness calculated: 0.756"                           │    │
│  │    },                                                                │    │
│  │    status: "completed"                                               │    │
│  │  }                                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Agent in VS Code (External)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VS CODE EXTENSION                                                           │
│                                                                              │
│  Task: "Create a new workflow block"                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. SAME AGENT BLOCK (reused!)                                       │    │
│  │                                                                      │    │
│  │  Input: {                                                            │    │
│  │    task: "Create a new workflow block",                              │    │
│  │    tools: [{ name: "create-file", ... }, { name: "maestro", ... }]  │    │
│  │  }                                                                   │    │
│  │                                                                      │    │
│  │  Output: {                                                           │    │
│  │    action: {                                                         │    │
│  │      type: "tool_call",                                              │    │
│  │      tool: "create-file",                                            │    │
│  │      arguments: { path: "blocks/my-workflow.json", content: "..." } │    │
│  │    }                                                                 │    │
│  │  }                                                                   │    │
│  └──────────────────────────────────┬──────────────────────────────────┘    │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  2. VS CODE FILE TOOL (different executor!)                          │    │
│  │                                                                      │    │
│  │  VS Code extension handles the action using its own file API         │    │
│  │                                                                      │    │
│  │  Output: { success: true, path: "blocks/my-workflow.json" }         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Key insight: Same Agent block, different tool executor                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Consequences

### Positive

| Benefit | Description |
|---------|-------------|
| **Separation of Concerns** | Agent handles reasoning, CLI handles execution |
| **Reusability** | Agent block works in Maestro, VS Code, Cursor, any MCP client |
| **Testability** | Agent can be tested with mock tool executors |
| **Flexibility** | Can swap CLI executor without changing agent logic |
| **Philosophy Aligned** | Both components are blocks, composable and replaceable |
| **Future-Proof** | Easy to add new tool executors for new platforms |

### Negative

| Drawback | Mitigation |
|----------|------------|
| **Additional complexity** | Well-defined interface minimizes integration overhead |
| **Two blocks to maintain** | Clear separation makes each block simpler |
| **Orchestration needed** | Workflow block handles the loop naturally |

### Trade-offs

| Aspect | Single Block | Two Blocks (Chosen) |
|--------|--------------|---------------------|
| Simplicity | Higher | Lower |
| Reusability | None | High |
| Testability | Harder | Easier |
| IDE Integration | Impossible | Native |
| Maintenance | Coupled | Decoupled |
| Philosophy Alignment | Partial | Full |

---

## Alternatives Considered

### Alternative 1: Single "Maestro Agent" Block

A monolithic block that combines reasoning and CLI execution.

**Rejected because**:
- Locks agent logic to Maestro platform
- Cannot reuse agent in VS Code, Cursor, or other IDEs
- Violates Single Responsibility Principle
- Harder to test in isolation
- Not composable with other tool executors

### Alternative 2: Agent with Pluggable Executors

Agent block with internal plugin system for different executors.

**Rejected because**:
- Over-engineered for the use case
- Plugins still create coupling within the agent
- Blocks are already the composition mechanism in Maestro
- Why have plugins when you have blocks?

### Alternative 3: Generic Tool Executor Block

A single generic executor that handles all tool types.

**Rejected because**:
- Loses the specificity of the Maestro CLI permissions
- Would need special-casing internally anyway
- Better to have explicit, purpose-built blocks

---

## Implementation Plan

### Phase 1: Agent Block Definition

1. Create `agent.block.json` schema
2. Define structured output format for tool calls
3. Implement basic Agent block executor in backend

### Phase 2: Enhance Maestro CLI Block

1. Add support for structured `action` input (in addition to raw `command`)
2. Implement action-to-command formatting
3. Update block definition to v1.1.0

### Phase 3: Orchestration

1. Create workflow template for Agent + CLI loop
2. Implement iteration control (max iterations, stop conditions)
3. Add result feedback mechanism

### Phase 4: External Integration

1. Document Agent block output format for external consumers
2. Create VS Code extension adapter example
3. Create MCP tool wrapper for Agent block

---

## Interface Contract

### Agent Output Schema

```typescript
interface AgentOutput {
  action: {
    type: 'tool_call' | 'response' | 'delegate' | 'clarify';

    // For tool_call
    tool?: string;
    arguments?: Record<string, unknown>;

    // For response
    content?: string;

    // For delegate
    delegateTo?: string;
    delegateTask?: string;

    // For clarify
    question?: string;
    options?: string[];

    // Always present
    reasoning: string;
  };

  status: 'pending' | 'completed' | 'needs_input' | 'error';

  metadata?: {
    iterationCount: number;
    tokensUsed: number;
    model: string;
  };
}
```

### Maestro CLI Input Schema

```typescript
interface MaestroCLIInput {
  // Option 1: Raw command
  command?: string;

  // Option 2: Structured action (from Agent)
  action?: {
    tool: string;
    arguments: Record<string, unknown>;
  };

  // Context (injected by runtime)
  context?: {
    sessionId?: string;
    workspaceId?: string;
    agentId?: string;
  };
}
```

---

## References

- [DESIGN-MAESTRO-CLI-BLOCK.md](../architecture/DESIGN-MAESTRO-CLI-BLOCK.md) - Original CLI block design
- [ADR-0001](0001-model-agnostic-design.md) - Model-agnostic architecture
- [Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)
- [Separation of Concerns](https://en.wikipedia.org/wiki/Separation_of_concerns)

---

## Status History

- 2026-02-04: Accepted

---

*"L'agent pense. Le CLI exécute. Chacun son bloc."*
