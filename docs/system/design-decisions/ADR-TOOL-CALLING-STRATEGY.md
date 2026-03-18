# ADR: Tool Calling Strategy — Maestro-Native, Not Provider-Native

**Date**: 2026-03-17
**Status**: Accepted
**Context**: Phase 62-C — Agentic loop debugging and resolution

---

## Decision

Maestro's tool calling logic stays entirely in Maestro — in blocks, prompts, and workflows. Provider-native tool calling APIs (Anthropic `tool_use`, OpenAI `function_calling`, etc.) are **strictly forbidden** in the agentic loop.

---

## Context

During Phase 62-C, the agentic loop failed: agents called the same tool repeatedly without processing the result. The temptation was to switch to Anthropic's native `tool_use`/`tool_result` message format, which handles tool semantics natively.

We rejected this for fundamental architectural reasons.

---

## Why Not Provider-Native Tool Use

1. **Provider lock-in**: Each provider has its own tool calling format (Anthropic `tool_use`, OpenAI `function_calling`, Google `function_declarations`). Using any of them ties Maestro to that provider's implementation.

2. **Not improvable**: Provider tool calling is a black box. If it doesn't work well for a use case, you can't fix it — you're stuck waiting for the provider to improve it. With Maestro-native tool calling, you iterate the prompt, the parser, the workflow.

3. **Not testable**: Provider tool calling happens inside the API call. You can't unit-test it, mock it, or measure it independently. Maestro's tool calling is a chain of blocks, each testable.

4. **Not universal**: Not all LLMs support tool calling natively. Local models (Llama, Mistral, Phi) rely on prompt-based tool calling. Maestro must work with ANY text-generating LLM.

5. **Maestro's value proposition**: If tool calling is just delegated to the provider, Maestro adds no value over using the provider directly. Maestro's value is that tool calling is a *workflow* that can be improved, specialized, and tested.

---

## Maestro's Tool Calling Architecture

### The Chain (all blocks)

```
LLM response (text)
    → response-parser (block: extracts {toolId, args} from text)
    → conditional (config.nodes: routes based on type)
    → tool-dispatcher (block: resolves toolId to a block, executes it)
    → conversation-append (block: adds result to conversation)
    → next iteration of while loop
```

Each step is a block registered in `BlockExecutorRegistry`. Each can be replaced, tested, or improved independently.

### The System Prompt Defines Available Tools

Tools are described as JSON schemas in the agent's system prompt. The LLM learns tool calling from the prompt, not from API-level tool definitions. This means:
- Tool descriptions can be customized per agent
- Tools can be added/removed by editing the prompt
- The format is agent-controlled, not provider-controlled

### Tool Mapping (`_toolMapping`)

The `ToolDispatcherBlockExecutor` supports `_toolMapping` — a session variable that redirects tool IDs to different block implementations. Use cases:
- **Contract testing**: Redirect `file-write` → `capture-file-write` (captures content without writing to disk)
- **Sandboxing**: Redirect `shell-execute` → `sandbox-shell-execute` (runs in container)
- **Mocking**: Redirect any tool to a mock block for testing

The agent doesn't know it's talking to a mock. Same interface, different implementation. This is only possible because tools are blocks.

---

## The THINK/ACTION Format (ReAct-Style)

### Problem discovered (Phase 62-C)

When the system prompt said "Your ENTIRE response must be a single JSON object", the LLM couldn't reason between receiving a tool result and choosing the next action. It pattern-matched "respond with JSON" and produced the same JSON repeatedly.

With `temperature=0`, this created a deterministic loop. Even with `temperature=0.2`, the LLM didn't break out because it never had the opportunity to *think* about what to do differently.

### Solution

All agent system prompts now require the THINK/ACTION format:

```
THINK: [1-2 sentences: what did the previous result tell me? what should I do next?]
ACTION: {"tool": "tool-name", "args": {...}}
```

The mandatory THINK step forces the LLM to:
1. Process the previous tool result
2. Reason about the next step
3. Only then produce the tool call

The `ResponseParserBlockExecutor` extracts JSON from after the `ACTION:` marker (falls back to generic `ExtractJson` for backward compatibility).

### Why this works

- **Reasoning prevents loops**: The LLM must explain *why* it's making each call. If it tries to repeat a call, the THINK step forces it to acknowledge "I already read this file" → different action.
- **Provider-agnostic**: Any text-generating LLM can produce THINK + JSON. No native tool_use needed.
- **Debuggable**: The THINK output is visible in logs. When an agent makes a bad decision, you can read *why*.
- **Improvable**: The THINK/ACTION format is defined in the system prompt. It can be iterated, tested, and improved without changing any C# code.

### Results

Before THINK/ACTION: 1/9 contract tests passed (the one that matched by accident).
After THINK/ACTION: 3/9 contract tests pass (all conversational tests). File-creation tests improved (agent now reaches file-write instead of looping on file-read).

---

## Lessons Learned

### 1. temperature=0 causes deterministic loops
With `temperature=0`, if the context doesn't change enough between iterations (tool result added but weighted low by the model), the LLM produces the exact same response. This is not a model bug — it's deterministic behavior by design.

**Fix**: Use `temperature >= 0.1` for agentic blocks. Exact values can be tuned per agent.

### 2. User/assistant roles overload doesn't convey tool semantics
Appending tool results as `role: user` messages doesn't convey "this is the result of your previous action." The LLM sees it as a new user message, not a tool response.

**Fix**: The THINK/ACTION format makes the conversation self-documenting. Each THINK references the previous result explicitly.

### 3. JSON-only responses prevent reasoning
Forcing "Your ENTIRE response must be a single JSON object" removes the LLM's ability to reason. This is the opposite of what you want in an agent — you want the LLM to think, then act.

**Fix**: Always allow (require) a reasoning step before the action.

### 4. Loop detection must compare full calls, not just tool IDs
Five `file-read` calls with different paths is legitimate exploration. Five `file-read` calls with the same path is a loop. The loop detection compares `toolId:argsHash` (composite key).

### 5. Session state poisons sequential tests
The ContractTestRunner must create a FRESH session per agent test. Otherwise, `_agentDone=true` from the first test blocks all subsequent tests. This was a silent bug that made ALL agent contract tests appear broken.

### 6. Context propagation has gaps
`_toolMapping` set on `ExecutionContext` was lost when `BlockRefHandler.BuildExecutionContext` created a new context for child block execution. Session variables must be the bridge: write to session, read from session when building new contexts.

---

## Related Documents

- `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md` — Agent = multi-node block
- `docs/system/architecture/blocks.md` — Tool availability comes from the prompt
- `docs/system/architecture/execution.md` — NodeExecutionEngine, DispatchNodeAsync
- `docs/phases/PHASE-62/prompt-condensation.md` — System prompt condensation analysis
- `docs/phases/PHASE-62/checkpoint.md` — Current test results
