# Phase 62-C: System Prompt Condensation

**Date**: 2026-03-17
**Block**: agent-creator

---

## Line Count Comparison

| Version | Lines | Words | Bytes | Est. Tokens |
|---------|-------|-------|-------|-------------|
| Original (pre-Phase 57) | 994 | 6310 | 57,688 | ~8,400 |
| Intermediate (Phase 57 commit `8d986bd`) | 397 | 1,409 | 13,759 | ~1,900 |
| **Phase 62-C (current)** | **317** | **1,321** | **12,917** | **~1,750** |

**Reduction**: 994 -> 317 lines (68% reduction from original, 20% from intermediate)

---

## What Was Changed (62-C vs intermediate)

### Removed
- Complete block.json example (133 lines -> replaced with annotated schema + separate config.nodes section)
- Duplicate Config Object section (config was shown both in field table and in example)
- Redundant "Required Fields" table (replaced with inline comments in schema)
- "System blocks" path in common paths (rarely used, agent shouldn't explore system blocks)

### Added
- **First-action rules** (Section 1): Critical behavioral directives to prevent loop detection triggers
  - "If task mentions a contract, FIRST call = file-read on contract path"
  - "If task is a question, answer via step-complete directly"
  - "NEVER call same tool with same arguments twice"
  - "Avoid directory-list unless you genuinely need to discover an unknown path"
  - "After reading a contract, immediately proceed to writing block.json"
- **Detailed step-complete format** (Section 6): Explicit instruction to include key details in summaries (capabilities, model, contract, tool names, feature pass/fail) so contract test checks can match
- **Tool result interpretation**: "After each tool call, the result appears as the next message. Read it and proceed."

### Condensed
- Section 2 (Block.json): from field table + separate config section + complete example -> annotated JSON schema (40 lines)
- Section 3 (Config.nodes): extracted as its own section with just the while-loop pattern
- Section 4 (System Prompt Writing): from 6 guidelines -> 3 essential rules
- Section 5 (Workflow): merged create/test/fix steps into compact numbered list

### Restructured
- 7 sections instead of 6 (added step-complete format as dedicated section)
- Block.json schema uses inline comments instead of a separate field table
- Config.nodes is a standalone JSON array (easier to copy-paste)

---

## Block Config Changes

### agent-creator.agent.block.json
- `context.maxTokens`: 4096 -> 16384 (agents need to hold contract JSON + conversation in context)
- `context.keepLastN`: 8 -> 10 (more message history for create-test-fix loop)
- `llm-call.config.maxTokens`: 4096 -> 8192 (agents generate full block.json + system-prompt.md in responses)
- `conversation-read.keepLastN`: 8 -> 10

### test-designer.agent.block.json
- Same context window changes as agent-creator

---

## Contract Test Results

### Run 1 (before 62-C changes, baseline)
- **Fitness**: 0.0 (0/9 tests passed)
- **Failure**: All tests returned "Stopped: agent stuck in loop calling 'directory-list' repeatedly"
- **Root cause**: Agent called directory-list 5 times consecutively, triggering Phase 61-B loop detection
- **Duration**: 39.5s, **Cost**: $0.49

### Run 2 (after first-action rules added)
- **Fitness**: 0.0 (0/9 tests passed)
- **Failure**: All tests returned "Stopped: agent stuck in loop calling 'file-read' repeatedly"
- **Root cause**: First-action rules worked (agent now calls file-read instead of directory-list), but agent re-reads the same file. Context window too small (4096) to hold system prompt + contract content + conversation history.
- **Duration**: 44.7s, **Cost**: $0.59

### Run 3 (after context window increase to 16384)
- **Fitness**: 0.0 (0/9 tests passed)
- **Failure**: Same loop on file-read
- **Root cause**: Not a context issue. The Anthropic API receives proper alternating user/assistant messages, but the LLM keeps choosing to re-read the same file. This is a model behavior issue with the tool-result-as-user-message pattern: the LLM doesn't recognize the tool result and retries.
- **Duration**: 46.9s, **Cost**: $0.59

### Root Cause Analysis

The fundamental issue is architectural, not prompt-related:

1. **Tool results as user messages**: The agentic loop appends tool results as `role: user` messages. The LLM sees: `user: "Create block"`, `assistant: {"tool":"file-read",...}`, `user: [7KB contract JSON]`. The LLM doesn't connect the user message (tool result) to its previous tool call.

2. **Loop detection too aggressive for file-read**: Phase 61-B detects 5 consecutive identical tool IDs (regardless of arguments) and force-stops. Even if the agent were reading 5 different files legitimately, it would be stopped.

3. **These are NOT system prompt issues**: The prompt correctly instructs the agent. The LLM correctly chooses file-read as the first action. The loop happens because the tool result isn't recognized as a response to the tool call.

### Recommendations for Fix (beyond 62-C scope)

1. **Prefix tool results**: In `append-tool-result`, prefix the content with `[Tool result for {toolId}]: `. This gives the LLM context about what the user message represents.
2. **Adjust loop detection**: Track `(toolId, args)` pairs instead of just `toolId`. Five `file-read` calls with different paths is not a loop.
3. **Consider Anthropic tool_use format**: The Anthropic API supports native `tool_use`/`tool_result` message types which would properly convey tool semantics instead of using user/assistant role overloading.

---

## Structural Validation

- block.json: Valid JSON (verified with Node.js)
- System prompt: References all 7 tools correctly (file-read, file-write, directory-list, json-validator, contract-test, shell-execute, step-complete)
- step-complete format: Preserved with detailed summary instructions
- config.nodes: Complete while-loop pattern with all 5 branches (tool-call, step-complete, text, retry)
- Backend build: 0 errors, 0 warnings
