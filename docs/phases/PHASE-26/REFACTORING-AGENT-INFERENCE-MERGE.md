# ADR: LLMBlockExecutorBase + Clean Agent/Inference Executors

> Date: 2026-02-14
> Status: Accepted
> Phase: 26

---

## Context

The Maestro architecture principle "Everything is a Block" (ADR Phase 18) establishes that agents and inference blocks share the same `BlockDefinition` entity, the same metrics, the same discovery system. The code violated this in several ways:

1. **`AgentBlockExecutor`** (652 lines) with hardcoded tool lists, a default system prompt built in C#, legacy tool mapping, and separate context logic
2. **`InferenceBlockExecutor`** (213 lines) with duplicated mock loading, model resolution, and output parsing
3. **`AgentDefinition`** (253 lines) and **`ToolDefinition`** (143 lines) — separate domain entities that should not exist per ADR Phase 18
4. **`AgentBlockHandler`** loading `tools.json` — tools should be in the system prompt, not in separate files

## Decision

**Architecture: Base class + 2 thin subclasses.**

```
LLMBlockExecutorBase (abstract)
├── Shared: mock loading, model resolution, output parsing, template resolution, JSON extraction
├── InferenceBlockExecutor — template → single LLM call → response
└── AgentBlockExecutor — systemPrompt → multi-turn → tool calls → response
```

### What was extracted into the base class

| Method | Purpose | Source |
|--------|---------|--------|
| `TryLoadMockResponse()` | Checks for mock-response.json in block path | Both executors |
| `ResolveModelId()` | Input override > config > null | Both executors |
| `ResolveGenerationParams()` | maxTokens + temperature from config | AgentBlockExecutor |
| `ResolveTemplate()` | `{{key}}` placeholder resolution | InferenceBlockExecutor |
| `ParseOutputs()` | Structured output extraction from LLM response | Both executors |
| `ExtractJson()` | JSON extraction from markdown/prose | AgentBlockExecutor |
| `ErrorResult()` | Creates error BlockExecutionResult | New utility |

### What was removed

| Removed | Reason |
|---------|--------|
| Default system prompt in C# (18 lines) | Content must live in block config, not infrastructure |
| `availableTools` default list | Tools described in system prompt, not in C# |
| `tools.json` loading in AgentBlockHandler | Same reason — tools in the prompt |
| `AgentDefinition.cs` (253 lines) | ADR Phase 18: one entity = `BlockDefinition` |
| `ToolDefinition.cs` (143 lines) | ADR Phase 18: one entity = `BlockDefinition` |

### What was kept (marked `[Obsolete]`)

| Kept | Reason |
|------|--------|
| `LegacyToolMapping` dictionary | Existing agent blocks still use legacy tool names. Marked `[Obsolete]`, will be removed when all agents use `maestro_cli` directly. |

## Result

| Metric | Before | After |
|--------|--------|-------|
| InferenceBlockExecutor | 213 lines | ~120 lines |
| AgentBlockExecutor | 652 lines | ~310 lines |
| Duplicated code | ~80 lines across both | 0 (in base class) |
| Hardcoded content in C# | Default system prompt, tool list | None |
| Domain entity violation | AgentDefinition + ToolDefinition | Deleted |
| Tests | All passing | All passing (113 total) |

## Principles Enforced

1. **Executor = mechanical plumbing** — loads prompt, calls LLM, parses tool calls, loops
2. **Content = in blocks/prompts** — system prompt, tool descriptions, context strategy all come from block config
3. **Everything optimizable** — since everything passes through the prompt, the fitness system can optimize it
4. **No silent fallbacks** — if systemPrompt is missing, error. No invented default content.
5. **One entity** — `BlockDefinition` only. No `AgentDefinition`, no `ToolDefinition`.
6. **Clean OOP** — shared logic in base class, specialized behavior in subclasses

## Files Changed

| File | Action |
|------|--------|
| `LLMBlockExecutorBase.cs` | Created — abstract base class |
| `InferenceBlockExecutor.cs` | Rewritten — inherits base, thin |
| `AgentBlockExecutor.cs` | Rewritten — inherits base, no hardcoded content |
| `Program.cs` | Updated — simplified DI registration |
| `AgentBlockHandler.cs` | Updated — removed tools.json loading |
| `HandlerTests.cs` | Updated — removed tools.json assertion |
| `ToolBlockExecutorTests.cs` | Updated — constructor signature |
| `AgentDefinition.cs` | Deleted |
| `ToolDefinition.cs` | Deleted |
| `FileSystemBlockDiscoveryService.cs` | Updated comment |

## Litmus Test

**Can you create a new agent by writing ONLY a `.block.json` with a `system-prompt.md`?**

Yes. The `AgentBlockExecutor` reads `systemPrompt` from config or file. It loops mechanically. All tool descriptions are in the prompt text. No C# changes needed.

---

## Addendum (2026-02-20) — Architectural Debt Identified

This refactoring correctly removed hardcoded content (tool lists, default prompts, separate entities). However, it introduced a deeper architectural issue: **the `AgentBlockExecutor` calls `_llmGateway.SendAsync()` directly and hardcodes the agentic loop in C#.**

An agent block is composite (`isAtomic: false`), like a workflow. Its internal behavior should be defined by child blocks in `config.nodes`, not by C# code. The current implementation means:

- The agentic loop structure (while, tool parse, dispatch) is hardcoded in infrastructure
- The agent cannot have a different internal structure without modifying C#
- The agent's implementation is prescribed by executor code, not by block composition

**What should have been done**: The `AgentBlockExecutor` should orchestrate child blocks defined in `config.nodes`, the same way a workflow executor walks its nodes. The LLM call should go through a child inference block, not through a direct `_llmGateway.SendAsync()` call.

**The principle**: "Le type d'un block definit son interface, pas son implementation." An agent's interface (prompt → response) is the same as inference. But its implementation is a black box — it could contain any combination of child blocks.

**Status**: Tracked for correction in Phase 35-PRE. The shared `LLMBlockExecutorBase` remains valid for `InferenceBlockExecutor` (which IS atomic and directly calls the LLM). But `AgentBlockExecutor` should not inherit from it — it should orchestrate children instead.
