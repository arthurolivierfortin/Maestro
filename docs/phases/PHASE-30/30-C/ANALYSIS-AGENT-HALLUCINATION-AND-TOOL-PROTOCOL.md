# Analysis: Agent Hallucination & Tool Use Protocol

**Date**: 2026-02-17
**Phase**: 30-C (Autonomous Development Testing)
**Status**: ANALYSIS — architectural decision needed

## Context

During Phase 30-C testing, agents using Claude models (claude-sonnet, claude-opus) were observed to **hallucinate tool results** — claiming to have written files, run commands, and verified code without actually executing any tool calls. This happened specifically on complex tasks (multi-file component creation), while simple tasks (add a function, fix 2 errors) worked correctly.

### Observed Behavior

| Task Complexity | Tool Calls Made | Files Written | Hallucinated? |
|-----------------|----------------|---------------|---------------|
| Simple (1 function) | 5-10 real | 1 (verified on disk) | No |
| Moderate (fix 2 TS errors) | 12-15 real | 2 (verified on disk) | No |
| Complex (multi-file component) | 0-1 real | 0 (nothing on disk) | **Yes** |

The complex task agent produced a single `{"tool":"done","args":{"summary":"..."}}` response claiming 10+ files created, but **zero `[DIAG-WRITE]` entries appeared in diagnostic logging**.

## Initial Hypothesis: Native Tool Use

The initial analysis suggested that Claude's **native tool use protocol** (structured `tool_use` blocks via the Anthropic API) would solve the problem because:
- Tool calls are structured objects, not text to parse
- The API returns `stop_reason: "tool_use"` — no ambiguity
- JSON schemas validate inputs before execution
- Claude is trained to use this protocol reliably

### Why This Hypothesis Is Wrong For Maestro

After deeper analysis, **native tool use is the wrong solution** for Maestro. Here's why:

#### 1. Provider Lock-In Violates Core Architecture

Maestro's cardinal rule: **"Adding a new provider = zero Maestro changes."**

Native tool use protocols are provider-specific:
- **Anthropic API**: `tools` parameter → `tool_use` content blocks
- **OpenAI API**: `functions` parameter → `function_call` response field (different schema)
- **Local models (Qwen, SmolLM2)**: No native tool use at all — text-only
- **Ollama**: Partial tool support, different format
- **Azure AI Inference**: Yet another format

If `AgentBlockExecutor` relied on native tool use, it would need provider-specific code paths:

```csharp
// WRONG — this is what native tool use would require
if (provider is AnthropicProvider)
    response = await SendWithAnthropicTools(request, toolSchemas);
else if (provider is OpenAIProvider)
    response = await SendWithOpenAIFunctions(request, toolSchemas);
else
    response = await SendWithTextBasedTools(request); // fallback
```

This **directly violates** the architecture: Maestro doesn't know providers, LLM-Provider does.

#### 2. Breaks "Everything Is a Block"

Currently, an agent's tools are described in its `system-prompt.md` — pure content, visible, editable:

```markdown
# system-prompt.md
You have ONE tool: maestro_cli. Available commands:
- Read file: {"tool":"maestro_cli","args":{"command":"run file-read ..."}}
- Write file: {"tool":"maestro_cli","args":{"command":"run file-write ..."}}
```

With native tool use, tool definitions would move to code or structured config that gets passed as API parameters. This shifts intelligence from **content** (block files) to **infrastructure** (executor code) — the opposite of Maestro's design.

**Litmus test**: Can you change an agent's available tools by editing only `.md` and `.json` files?
- Text-based: **Yes** — edit the system prompt.
- Native tool use: **No** — you need to update structured schemas in code or a separate tool definition layer.

#### 3. Reduces Transparency

Text-based tool use is fully visible in the conversation transcript:
- System prompt shows available tools
- Agent response shows the JSON tool call
- Next message shows the tool result
- Everything is human-readable, debuggable, loggable

Native tool use hides the tool definitions in API request parameters and returns structured objects that need special rendering. The conversation becomes opaque.

#### 4. Claude Code Is Not the Right Model For Maestro

Claude Code uses native tool use because it's a **single-provider product** — it only works with Anthropic's API. Maestro is a **multi-provider orchestrator** — it works with any LLM provider. Different architectural constraints, different solutions.

Claude Code's reliability comes not just from native tool use, but from its **robust agentic loop**: retries, validation, context management, error recovery. These are loop mechanics, not protocol features. Maestro can (and should) replicate these mechanics without protocol dependency.

## Root Cause Analysis

The hallucination problem has **three concrete bugs** in `AgentBlockExecutor`, not a fundamental protocol limitation:

### Bug 1: "done" accepted without verification (line 182-189)

```csharp
if (toolId == "done")
{
    var summary = args.TryGetProperty("summary", out var sumProp)
        ? sumProp.GetString() ?? "Task completed"
        : "Task completed";
    result.Outputs["result"] = summary;
    break; // ← No check: did the agent actually DO anything?
}
```

**Impact**: Claude receives a complex 10-step plan, "knows" what all the files should contain (it's a great model), and immediately responds with `{"tool":"done","args":{"summary":"{stepsCompleted:10,...}"}}`. The executor accepts this without checking if any real tool calls were made.

**Fix**: Track actual tool calls executed. Reject "done" if fewer than N tool calls were made:

```csharp
var actualToolCallCount = 0;  // Track real executions

// In the tool execution block:
actualToolCallCount++;

// In the "done" check:
if (toolId == "done")
{
    if (actualToolCallCount == 0)
    {
        // Force the agent to actually do work
        messages.Add(ChatMessage.Assistant(jsonContent));
        messages.Add(ChatMessage.User(
            "You claimed to be done but made ZERO tool calls. " +
            "You MUST use tools to read and write files. " +
            "Start by reading the first target file."));
        toolCalled = true; // Don't break the loop
        continue;
    }
    // ... accept "done" normally
}
```

### Bug 2: Loop breaks on first non-JSON response (line 227)

```csharp
if (!toolCalled || iteration >= maxIterations) break;
```

**Impact**: If Claude adds ANY thinking text before its JSON (e.g., "Let me start by reading..."), and `ExtractJson` fails to find it, `toolCalled` stays `false` → loop breaks immediately. One failed parse = entire agent abandoned.

**Fix**: Add retry with a nudge message:

```csharp
if (!toolCalled)
{
    if (nonJsonRetries < 2)
    {
        nonJsonRetries++;
        messages.Add(ChatMessage.Assistant(response.Content));
        messages.Add(ChatMessage.User(
            "Your response was not a valid JSON tool call. " +
            "Respond with ONLY a JSON object, no other text. Example:\n" +
            "{\"tool\":\"maestro_cli\",\"args\":{\"command\":\"run directory-list --input path=/some/path\"}}"));
        continue;
    }
    break; // Give up after 2 retries
}
```

### Bug 3: Silent exception handling hides real errors (line 222-225)

```csharp
catch (Exception ex)
{
    result.Logs.Add($"LLM parse error (tool detection): {ex.Message}");
    // ← No re-throw, no retry, toolCalled stays false → loop breaks
}
```

**Impact**: If JSON parsing throws (malformed JSON, encoding issue), the exception is logged but the loop breaks silently. The agent appears to have completed normally with whatever partial output was captured.

**Fix**: Treat parse errors as retriable, same as Bug 2.

## The Real Problem Is the Loop, Not the Protocol

| What Went Wrong | Root Cause | Protocol-Dependent? |
|----------------|------------|-------------------|
| Agent claims "done" without working | No verification in executor | **No** — loop logic bug |
| Loop breaks on non-JSON response | No retry mechanism | **No** — loop logic bug |
| Exceptions kill the loop silently | Poor error handling | **No** — loop logic bug |
| Output appears to show tool calls | Stored output is LLM text, not execution log | **No** — output format confusion |

**None of these require native tool use to fix.** They're all bugs in the agentic loop mechanics.

## Recommended Solution

### Phase 1: Fix the executor bugs (immediate)

Three changes to `AgentBlockExecutor.cs`:

1. **Tool call counter + "done" guard**: Reject premature "done" and force real work
2. **Non-JSON retry with nudge**: Up to 2 retries when response isn't valid JSON
3. **Better exception handling**: Parse errors trigger retry, not silent break

Estimated effort: ~50 lines of C# changes, no architectural impact.

### Phase 2: Improve agent prompts (immediate)

Add explicit anti-hallucination rules to agent system prompts:

```markdown
## CRITICAL RULES — Read Carefully

- **NEVER claim to have completed work without making tool calls.**
- **NEVER output {"tool":"done"} on your FIRST response.** Your first action must ALWAYS be a file-read or directory-list.
- **Each file you create or modify REQUIRES a file-write tool call.** If your plan has 5 files, you must make at least 5 file-write calls.
- **The system verifies your tool calls.** If you claim to be done but made fewer tool calls than expected, you will be asked to redo the work.
```

Estimated effort: Text changes to 4-6 `.md` files, zero code changes.

### Phase 3: Add execution metrics (short-term)

Track and expose in the execution tree:
- `toolCallsExpected` (from the plan step count)
- `toolCallsExecuted` (actual count from executor)
- `fileWritesExecuted` (actual count)

This makes hallucination visible in the monitor — if expected=10 and executed=0, something is wrong.

### NOT recommended: Native tool use abstraction layer

Some might suggest creating an abstraction:
```
Block defines tools as schemas → Executor reads schemas →
  If provider supports native tool use → pass schemas via API
  If not → include in system prompt text
```

This is **over-engineering**. It adds:
- A tool schema format to define and maintain
- Provider capability detection logic
- Two code paths to test and debug
- Complexity with marginal reliability gain (once bugs 1-3 are fixed)

The text-based approach, with a robust loop, is **good enough** and **universally compatible**.

## Decision

**Keep text-based tool use. Fix the executor loop. Improve the prompts.**

The strength of Maestro is provider-agnosticity and transparency. Native tool use would trade these for marginal reliability improvement that can be achieved more simply by fixing three bugs in the agentic loop.

### Validation Criteria

After implementing the fixes, re-run the 30-C-4 complex task test:
- [ ] `[DIAG-WRITE]` entries appear for each file in the plan
- [ ] `actualToolCallCount > 0` before "done" is accepted
- [ ] Files exist on disk after workflow completion
- [ ] No hallucinated tool results in stored output (check for `"bytesWritten"` vs `"size"`)

## References

- `AgentBlockExecutor.cs` — lines 95-228 (agentic loop)
- `LLMBlockExecutorBase.cs` — lines 179-210 (`ExtractJson`)
- `implement-single-step/system-prompt.md` — current agent prompt
- `IMPLEMENTATION-NOTES.md` — 30-C test results showing the hallucination
- `CLAUDE.md` — "Agent = Inference Block" and "Cardinal Rule" sections
