# Tool Calling Strategy — Prompt-Based, Provider-Agnostic

## The Problem

LLM agents need to call tools (read files, write code, execute commands). Modern LLM providers offer native tool calling APIs (Anthropic `tool_use`, OpenAI `function_calling`), but using them creates provider lock-in and removes control from the orchestration layer.

## Maestro's Approach: Tool Calling as a Workflow

In Maestro, tool calling is NOT delegated to the provider. It is a **workflow of blocks**:

```
LLM generates text (may contain a tool call)
    → response-parser (block: extracts {toolId, args} from text)
    → conditional (routes based on parsed type: tool-call, step-complete, text, retry)
    → tool-dispatcher (block: resolves toolId to a real block, executes it)
    → conversation-append (block: adds tool result to conversation)
    → while loop continues
```

Each step is a block — testable, replaceable, improvable. The LLM only needs to generate text. No native API support required.

## Why Not Native Tool Use

| Concern | Native tool_use | Maestro-native |
|---------|----------------|----------------|
| **Provider lock-in** | Tied to one provider's format | Works with any text-generating LLM |
| **Improvability** | Black box inside the API | Each step is a block you can iterate |
| **Testability** | Can't unit-test the tool dispatch | Each block has its own tests |
| **Local models** | Many don't support it | Any model that generates text works |
| **Customization** | Provider decides the format | You define the format in the system prompt |
| **Debugging** | Opaque — tool calls happen inside the API | THINK step is visible in logs |

## The THINK/ACTION Format (ReAct-Style)

### The Discovery

When agents were instructed "Your ENTIRE response must be a single JSON object", they looped — calling the same tool repeatedly. The LLM had no opportunity to **reason** between receiving a result and choosing the next action.

### The Format

All Maestro agents use:

```
THINK: I received the contract. It requires conversation and tool-calling capabilities.
       I'll now create the block.json with these capabilities declared.
ACTION: {"tool": "file-write", "args": {"path": "...", "content": "..."}}
```

**THINK** is mandatory. It forces the LLM to:
1. Acknowledge what the previous tool result contained
2. Reason about what to do next
3. Explain why it's choosing this action

**ACTION** contains the JSON tool call. The `response-parser` block extracts JSON after the `ACTION:` marker.

### Why THINK Prevents Loops

Without THINK: the LLM sees "produce JSON" → produces the same JSON (pattern matching).
With THINK: the LLM must explain its reasoning. If it tries to repeat a call, the THINK step forces it to acknowledge "I already read this file, the result was X" → which naturally leads to a different action.

### Compatibility

- **Pure JSON** still works (backward compatible via `ExtractJson` fallback)
- **Any LLM** can produce "THINK: ... ACTION: {...}" — it's just text
- **Debugging**: the THINK output appears in execution logs, making agent decisions traceable

## Tool Mapping (`_toolMapping`)

### The Mechanism

`ToolDispatcherBlockExecutor` checks for a `_toolMapping` variable before dispatching:

```
Agent calls "file-write"
    → tool-dispatcher reads _toolMapping = {"file-write": "capture-file-write"}
    → dispatches to capture-file-write instead of real file-write
    → agent thinks the file was written (receives success message)
    → evaluator reads _capturedToolCalls to verify what was written
```

### Use Cases

| Use Case | Mapping | Effect |
|----------|---------|--------|
| Contract testing | `file-write → capture-file-write` | Capture content without disk writes |
| Sandboxing | `shell-execute → sandbox-shell-execute` | Execute in isolated container |
| Dry run | `file-write → dry-run-file-write` | Validate content without writing |
| Logging | `file-write → log-file-write` | Write AND capture for audit |

### Why Blocks, Not a Generic Capture

Each mock/capture tool is a **real block** with its own executor and block.json. This is deliberate:

- `capture-file-write` returns realistic output: `"File written to {path} (247 bytes)"`
- `capture-file-read` handles read-after-write: checks captures before falling back to real disk read
- `capture-file-edit` applies replacements on captured content
- Users can create their own mock blocks for any tool

A generic "capture all" type would return generic messages that could confuse the agent. Dedicated blocks can simulate realistic behavior per tool.

## Key Lessons

### 1. temperature=0 + tool results = deterministic loops
With `temperature=0`, if the context doesn't change enough between iterations, the LLM produces the exact same response. Tool results added as user messages may not shift the probability distribution enough to produce a different response.

**Rule**: Use `temperature >= 0.1` for agentic blocks.

### 2. JSON-only responses prevent reasoning
Forcing the LLM to output only JSON removes its ability to think. Agents need to reason, not just act.

**Rule**: Always require a reasoning step (THINK) before the action (ACTION).

### 3. Tool results need clear framing
Appending a tool result as `role: user` doesn't convey "this is the response to your action." The LLM sees it as a new user message.

**Rule**: Frame tool results explicitly — include the iteration number, the tool name, and a directive to take a different action.

### 4. Loop detection must compare full calls
Five calls to `file-read` with different paths is exploration. Five calls with the same path is a loop. Detection uses composite keys: `toolId:argsHash`.

## Relationship to Maestro Philosophy

This approach embodies Maestro's core principle: **generic infrastructure, specific content**.

- The infrastructure (response-parser, tool-dispatcher, conversation-append) is generic — works with any agent
- The content (system prompt with THINK/ACTION format, tool descriptions, iteration budget) is specific — tailored per agent
- The tool mapping (`_toolMapping`) is a session variable — set by the caller (ContractTestRunner, sandbox, user), not hardcoded

The result: tool calling that any LLM can do, that anyone can improve, and that Maestro controls end-to-end.
