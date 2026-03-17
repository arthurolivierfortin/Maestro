# Contract Validation Results -- Phase 61-C

**Date**: 2026-03-17
**Method**: Manual static analysis (no LLM execution -- only Claude Code CLI available at ~8s/call)
**Contracts analyzed**: 6
**Total tests analyzed**: 57

---

## Table of Contents

1. [agent-creator contract](#1-agent-creator-contract)
2. [test-designer contract](#2-test-designer-contract)
3. [block-forge contract](#3-block-forge-contract)
4. [maestro-assistant contract](#4-maestro-assistant-contract)
5. [code-reviewer contract](#5-code-reviewer-contract)
6. [test-generator contract](#6-test-generator-contract)
7. [Cross-cutting findings](#7-cross-cutting-findings)
8. [Recommendations for Phase 62](#8-recommendations-for-phase-62)
9. [Estimated cost if tests were actually run](#9-estimated-cost-if-tests-were-actually-run)

---

## 1. agent-creator contract

**File**: `content/system/contracts/agent-creator.contract.json`
**Features**: 4 | **Total tests**: 9 | **Minimum fitness**: 0.5
**Required capabilities**: conversation, structured-output, tool-calling

### The fundamental problem

The agent-creator block is an **agentic block** with a while-loop of tool calls. When ContractTestRunner executes it:

1. The runner sends a prompt via `SendPromptToBlockAsync`
2. `AgentBlockExecutor.PrepareExecutionAsync` creates a conversation, seeds it with the prompt
3. The agent runs its full while-loop (read-conversation -> llm-call -> parse-response -> tool-call/step-complete)
4. `ExtractResultAsync` returns `outputs["content"] = _agentResult` (from the step-complete summary)

The response text that checks run against is the **step-complete summary** -- whatever the LLM puts in `{"tool":"step-complete","args":{"summary":"..."}}`. This is typically a 1-2 sentence human-readable summary like "Created code-reviewer agent with fitness 0.85. 3/4 features pass."

This means: the checks must match against a SHORT SUMMARY, not against the actual block.json or system-prompt.md content that the agent wrote to disk.

### Test-by-test analysis

| # | Test ID | Feature | Check type | Classification | Notes |
|---|---------|---------|------------|----------------|-------|
| 1 | valid-block-json | block-generation (0.30) | json-parseable | **runner-limitation** | The prompt asks "Create a block.json". The agent will make tool calls to write files, then call step-complete with a summary. The summary is NOT JSON-parseable as a block.json -- it's a sentence. The json-parseable check will search for `{...}` in the summary and try to parse it, which will fail. The JSON was written to disk, not returned in the response. |
| 2 | required-fields | block-generation | contains-all: blockType, name, config | **runner-limitation** | Same problem. The agent writes a block.json to disk via file-write. The step-complete summary might mention "blockType" or "config" in passing, but almost certainly won't contain all three as substrings. |
| 3 | capabilities-declared | block-generation | contains-all: capabilities, conversation, tool-calling | **runner-limitation** | Same fundamental issue. The summary might mention "capabilities" but won't reliably contain all three values as substrings. |
| 4 | system-prompt-structure | prompt-writing (0.25) | contains-all: #, bug, style | **check-too-strict** | The agent writes the system-prompt.md to disk. The summary might mention bugs and style but the `#` (markdown heading) is almost certainly not in the step-complete summary. |
| 5 | tool-descriptions | prompt-writing | contains-all: file-read, file-write, shell-execute | **runner-limitation** | Same issue. These tool names appear in the written file, not in the summary. |
| 6 | diagnose-failure | iterative-improvement (0.25) | contains-any: short, longer, detailed, verbose, elaborate, minLength, minimum | **feasible** | This is a conversational prompt that asks for diagnosis. The agent might produce a text response or a step-complete summary. Either way, it should contain one of these words. However, the agent's system prompt says "Your ENTIRE response must be a single JSON object" -- so it won't produce free text. It will make a tool call. The _agentResult from step-complete COULD contain these words if the summary is descriptive enough. **Borderline feasible.** |
| 7 | iterate-on-results | iterative-improvement | multi-turn, contains: suggestion | **runner-limitation** | Multi-turn test. The ContractTestRunner `BuildMultiTurnPrompt` concatenates previous turns into a flat string. Each "turn" runs the FULL agent loop. The agent will make multiple tool calls per turn, then step-complete. The check on the second turn expects "suggestion" in the summary. **The real problem**: each turn runs the entire agent (including potentially writing files), using maxIterations=12. Two turns = potentially 24 LLM calls. The runner treats this as a conversation but it's actually spawning two complete agent executions. |
| 8 | adapt-for-smaller-model | model-adaptation (0.20) | contains-any: simpl, shorter, concise, fewer, explicit, structured, haiku | **feasible** | The step-complete summary for a model adaptation task could plausibly mention "haiku" or "simpler" or "concise". Depends on how descriptive the agent makes its summary. |
| 9 | preserve-contract-compliance | model-adaptation | contains-any: no, same, contract, unchanged, keep | **feasible** | This is a conversational question. But again, the agent's system prompt mandates JSON-only responses. The agent will try to call a tool. The step-complete summary could contain "contract" or "same". **Borderline feasible.** |

### Assessment

- **Tests that will almost certainly FAIL due to runner-limitation**: 1, 2, 3, 5, 7 (5/9 = 56%)
- **Tests that will probably FAIL due to check-too-strict**: 4 (1/9 = 11%)
- **Tests that are borderline feasible**: 6, 8, 9 (3/9 = 33%)
- **Expected pass rate**: 1-3 out of 9 (11-33%)
- **Expected fitness**: very low, well below 0.5 minimum

### Root cause

The contract tests were written for a **conversational** block (prompt in, text out). But agent-creator is an **agentic** block (prompt in, tool-call loop, step-complete summary out). The checks test for content that appears in the agent's WORK PRODUCTS (files written to disk), not in its SUMMARY of that work.

---

## 2. test-designer contract

**File**: `content/system/contracts/test-designer.contract.json`
**Features**: 4 | **Total tests**: 16 | **Minimum fitness**: 0.5
**Required capabilities**: conversation, structured-output

### Test-by-test analysis

| # | Test ID | Feature | Check type | Classification | Notes |
|---|---------|---------|------------|----------------|-------|
| 1 | identify-features | contract-analysis (0.25) | contains-all: greeting, math | **runner-limitation** | The agent will read the contract via file-read, analyze it, then write a test suite to disk. The step-complete summary might mention features but won't reliably contain both "greeting" and "math". |
| 2 | identify-capabilities | contract-analysis | contains-all: reasoning, structured-output | **runner-limitation** | Same issue. The summary is about what the agent produced, not the contract content it analyzed. |
| 3 | contract-reading-parses-required-capabilities | contract-analysis | contains-any: cannot, no, missing, fail, disqualified, not eligible, must have | **feasible** | This is a knowledge question. The agent might produce a step-complete with a summary explaining the answer. The broad `contains-any` makes this achievable. But the agent's system prompt mandates tool-call-only responses, so it will try to call a tool first rather than answer directly. |
| 4 | contract-reading-understands-minimum-fitness | contract-analysis | contains-any: no, does not pass, fails, below, 0.72 < 0.75, not pass | **feasible** | Same as above -- broad `contains-any`. The word "no" appears in many possible summaries, making this easy to pass. **But this is also a trivial check** -- the word "no" alone passing this means the check doesn't really verify understanding. |
| 5 | contract-reading-multi-turn-feature-identification | contract-analysis | multi-turn, contains-all: auth, logging, retry | **runner-limitation** | Multi-turn with an agent means two full agent executions. The second turn asks "What are the feature IDs?" but the agent will try to make tool calls, not answer conversationally. Even if it produces a summary, it would need to contain all three IDs. |
| 6 | generate-single-turn | test-generation (0.30) | json-parseable | **runner-limitation** | Agent writes JSON to disk. Step-complete summary is a sentence, not parseable JSON. |
| 7 | generate-multi-turn | test-generation | json-parseable | **runner-limitation** | Same as above. |
| 8 | generate-tool-call-test | test-generation | contains-all: session-create, name | **runner-limitation** | These values appear in the generated test config (written to disk), not in the summary. |
| 9 | test-generation-happy-path-design | test-generation | contains-all: prompt, check | **feasible** | A step-complete summary about designing tests might mention "prompt" and "check". Borderline. |
| 10 | test-generation-constraint-test-design | test-generation | contains-any: does-not-contain, must not, should not contain, constraint | **check-too-strict** | These are very specific technical terms. The summary might mention "constraint" but the check type names are unlikely to appear in a summary. |
| 11 | test-generation-rejects-trivial-tests | test-generation | contains-any: trivial, not good, bad, weak, poor, any LLM, not specific, too simple | **feasible** | If the agent produces a summary evaluating the test, it could contain "trivial" or "weak". But the agent will try to do file I/O, not evaluate inline. |
| 12 | non-trivial-checks | test-quality (0.25) | contains-any: contains, regex, does-not-contain, tool-call | **runner-limitation** | These check type names appear in generated test configs, not in summaries. |
| 13 | edge-case-coverage | test-quality | non-empty, minLength: 100 | **feasible** | A 100-character summary is achievable. This is a weak test though -- it doesn't verify actual edge case coverage, just response length. |
| 14 | check-type-selects-tool-call | test-quality | contains: tool-call | **feasible** | The summary might mention "tool-call" check type. Borderline. |
| 15 | check-type-selects-regex-for-format | test-quality | contains-any: regex, pattern | **feasible** | Similar. |
| 16 | check-type-warns-non-empty-overuse | test-quality | contains-any: trivial, any response, no discrimination, poor coverage, not specific, passes everything, weak | **feasible** | Broad contains-any, might match. |
| 17 | output-format-required-top-level-fields | output-format (0.20) | contains-all: contractId, features, totalTests | **runner-limitation** | These are JSON field names in the output file, not in the summary. |
| 18 | output-format-uses-file-write-tool | output-format | tool-call: file-write, requiredArgs: path, content | **runner-limitation** | The tool-call check looks in response text AND `_toolCalls` output. The agent WILL call file-write during execution. But: `_toolCalls` is not set by the current AgentBlockExecutor. It only sets `content` and `_agentResult`. The tool calls happen inside NodeExecutionEngine and are not propagated to the block's outputs. |

### Assessment

- **Tests that will almost certainly FAIL due to runner-limitation**: 1, 2, 5, 6, 7, 8, 12, 17, 18 (9/18 = 50%)
- **Tests that will probably FAIL due to check-too-strict**: 10 (1/18 = 6%)
- **Tests that are feasible/borderline**: 3, 4, 9, 11, 13, 14, 15, 16 (8/18 = 44%)
- **Expected pass rate**: 3-6 out of 18 (17-33%)
- **Expected fitness**: well below 0.5 minimum

### Root cause

Same as agent-creator: tests verify content that appears in work products, not in the step-complete summary. Additionally, the `tool-call` check type doesn't work with the agent architecture because tool calls happen inside the agent's node execution loop and aren't surfaced in `BlockExecutionResult.Outputs`.

---

## 3. block-forge contract

**File**: `content/system/contracts/block-forge.contract.json`
**Features**: 3 | **Total tests**: 7 | **Minimum fitness**: 0.5
**Required capabilities**: orchestration, tool-calling

### Test-by-test analysis

| # | Test ID | Feature | Check type | Classification | Notes |
|---|---------|---------|------------|----------------|-------|
| 1 | create-from-description | end-to-end-creation (0.40) | contains-all: block, code-reviewer | **feasible** | A step-complete summary about creating a code-reviewer block would plausibly contain both "block" and "code-reviewer". |
| 2 | workspace-usage | end-to-end-creation | contains-any: workspace, foundry | **feasible** | The summary might mention workspace or foundry. Depends on the workflow's behavior. |
| 3 | publish-result | end-to-end-creation | contains-any: publish, catalog, available | **feasible** | If the workflow publishes, the summary should mention it. |
| 4 | runs-contract-tests | contract-compliance (0.35) | contains-any: test, pass, score, contract, verify | **feasible** | Very broad check. "test" or "contract" will appear in almost any summary about this workflow. Almost trivially passable. |
| 5 | iterates-on-failure | contract-compliance | contains-any: improv, updat, modif, fix, retry, iterate, prompt | **feasible** | This is a conversational question about what the forge should do. If block-forge is a workflow block (not agent), the response handling might be different. Broad check -- feasible. |
| 6 | create-variant | adaptation (0.25) | contains-any: variant, haiku, adapt | **feasible** | Summary should mention "variant" or "haiku". |
| 7 | variant-tested | adaptation | contains-any: test, contract, score, verify, pass | **feasible** | Trivially broad -- "test" will appear in any relevant summary. |

### Assessment

- **Tests that are feasible**: 7/7 (100%)
- **BUT many are trivially broad**: Tests 4 and 7 would pass with ANY response mentioning "test". Tests 2, 3, 5, 6 are similarly loose.
- **Expected pass rate**: 4-7 out of 7 (57-100%)
- **Expected fitness**: could meet 0.5 minimum

### Problems

1. **No block-forge block exists yet** -- this contract has no implementing block to test against.
2. **Tests are too easy** -- most use `contains-any` with common words. A response saying "I can't do that, please test again" would pass test 4 and 7.
3. **Missing tests**: No test verifies the forge actually PRODUCES working files. No test checks error handling.

---

## 4. maestro-assistant contract

**File**: `content/system/contracts/maestro-assistant.contract.json`
**Features**: 4 | **Total tests**: 22 | **Minimum fitness**: 0.3
**Required capabilities**: conversation

### Test-by-test analysis

| # | Test ID | Feature | Check | Classification | Notes |
|---|---------|---------|-------|----------------|-------|
| 1 | basic-response | conversation (0.25, min 0.8) | non-empty, minLen 20 | **feasible** | Any LLM produces 20+ chars. Trivial. |
| 2 | context-retention | conversation | multi-turn, contains: Alice | **feasible** | Standard context test. Works if the runner's multi-turn prompt concatenation is effective for conversational blocks. |
| 3 | clarification | conversation | contains-any: what, which, could you, clarify, specify, more details, ? | **feasible** | Broad check. Most LLMs ask clarifying questions for "Do the thing". |
| 4 | conv-maestro-knowledge | conversation | contains-all: workspace, session | **feasible** | Requires Maestro domain knowledge in the system prompt. Should pass if the block's prompt covers these concepts. |
| 5 | conv-multi-turn-topic | conversation | 3-turn, contains: Resonance | **feasible** | Standard topic coherence test. |
| 6 | conv-general-question | conversation | contains-any: monorepo, repository, packages, single repo, codebase | **feasible** | General knowledge question. Any decent LLM handles this. |
| 7 | conv-no-hallucinated-action | conversation | does-not-contain: email sent, I sent, successfully sent, email has been sent | **feasible** | Good constraint test. Most LLMs correctly say they can't send email. Well-designed. |
| 8 | create-session | maestro-operations (0.30, min 0.7) | tool-call: session-create, requiredArgs: name | **runner-limitation** | `tool-call` check looks in response text and `_toolCalls`. For agents, tool calls are inside the node loop and not in outputs. For conversational blocks, this might work if the block returns tool call info in its response. **Depends on block type**. |
| 9 | list-workspaces | maestro-operations | tool-call: workspace-list | **runner-limitation** | Same issue as above. |
| 10 | navigate-pages | maestro-operations | contains-any: catalog, Catalog, /catalog | **feasible** | Conversational response should mention "Catalog". |
| 11 | ops-list-blocks | maestro-operations | tool-call: block-list | **runner-limitation** | Same tool-call issue. |
| 12 | ops-explain-foundry | maestro-operations | contains-any: train, test, fitness, block, foundry | **feasible** | Broad check for a knowledge question. |
| 13 | ops-create-workspace | maestro-operations | tool-call: workspace-create | **runner-limitation** | Same tool-call issue. |
| 14 | ops-confirm-before-session | maestro-operations | multi-turn, tool-call: session-create | **runner-limitation** | Multi-turn + tool-call check. |
| 15 | multi-step-plan | orchestration (0.30, min 0.7) | contains-all: workspace, session | **feasible** | A plan for dev environment setup should mention both. |
| 16 | confirm-before-act | orchestration | does-not-contain: session-delete | **feasible** | Good constraint test. Agent should ask before deleting. |
| 17 | orch-plan-before-execute | orchestration | contains-any: 1., first, step, plan, then, foundry, publish | **feasible** | Very broad. Most planning responses include "step" or "first". |
| 18 | orch-no-silent-execution | orchestration | does-not-contain: session-stop, workspace-delete, I have stopped, All sessions stopped | **feasible** | Good constraint test. |
| 19 | orch-recover-from-failure | orchestration | multi-turn, contains-any: template, check, try, available, list, verify, ? | **feasible** | Very broad. A recovery suggestion will contain at least one of these. |
| 20 | remember-preference | memory (0.15, min 0.6) | multi-turn, contains: verbose | **feasible** | Standard memory test. Works if multi-turn conversation is maintained. |
| 21 | recall-context | memory | multi-turn, contains: music-app | **feasible** | Same. |
| 22 | mem-multi-preference | memory | multi-turn, contains-all: sonnet, JSON | **feasible** | Requires remembering two things. |
| 23 | mem-preference-applied | memory | multi-turn, contains-any: haiku, mini, small, cheapest, smallest, fast | **feasible** | Application of preference in recommendation. |
| 24 | mem-distinguish-projects | memory | multi-turn, contains: Cantante | **feasible** | Distinguishing two projects. |

### Assessment

- **Tests with runner-limitation (tool-call check)**: 8, 9, 11, 13, 14 (5/24 = 21%)
- **Tests that are feasible**: 19/24 (79%)
- **Trivially easy tests**: 1 (basic-response with non-empty only)
- **Well-designed tests**: 7, 16, 18 (constraint tests using does-not-contain)
- **Expected pass rate for conversational block**: 14-19 out of 24 (58-79%)
- **Expected pass rate for agentic block**: Lower due to tool-call checks failing

### Problems

1. **tool-call check type is broken for agents** -- 5 tests use it. The check looks for toolName in response text or `_toolCalls` output, but agents don't surface `_toolCalls`.
2. **Multi-turn tests spawn multiple agent executions** -- each turn runs the full while-loop. Expensive and slow.
3. **Memory tests depend on multi-turn working correctly** -- if the runner's prompt concatenation doesn't give the agent enough context, memory tests fail for the wrong reason.

### Bright spots

This contract has the best-calibrated tests overall. The `does-not-contain` constraint tests (7, 16, 18) are genuinely useful. The conversation tests are reasonable. The biggest gap is the tool-call check limitation.

---

## 5. code-reviewer contract

**File**: `content/system/contracts/code-reviewer.contract.json`
**Features**: 4 | **Total tests**: 10 | **Minimum fitness**: 0.5
**Required capabilities**: conversation, tool-calling

### Test-by-test analysis

| # | Test ID | Feature | Check | Classification | Notes |
|---|---------|---------|-------|----------------|-------|
| 1 | read-single-file | code-reading (0.30, min 0.7) | contains-any: function, export, TypeScript, utility, module | **runner-limitation** | Prompt says "Read the file at /tmp/test-review/utils.ts". This file doesn't exist on disk. The agent will try file-read, get an error, and report the error. Even if the file existed, the step-complete summary would describe what it found, not the file content directly. **Also a test-environment issue.** |
| 2 | identify-bug | code-reading | contains-any: empty, zero, division, length, 0, undefined, NaN | **feasible** | Code is inline in the prompt. An LLM can identify the division-by-zero bug and mention it in a response. If the block is conversational (inference), this works well. If agentic, depends on summary. |
| 3 | identify-language | code-reading | contains-any: Elixir, elixir | **feasible** | Straightforward language identification. Works for conversational blocks. |
| 4 | actionable-suggestion | review-feedback (0.30, min 0.6) | contains-any: type, typing, ===, filter, map, rename, descriptive, any | **feasible** | Code is inline. An LLM will suggest using types, filter/map, etc. Broad check. |
| 5 | severity-levels | review-feedback | contains-all: SQL injection, password | **feasible** | Both issues are obvious. Any decent LLM flags SQL injection and hardcoded passwords. |
| 6 | positive-feedback | review-feedback | contains-any: good, well, clean, immutab, readonly, freeze, solid, nice, correct | **feasible** | Prompt explicitly asks for positive feedback. Very broad check. |
| 7 | report-format | structured-report (0.20, min 0.5) | contains-any: Summary, Issue, Suggestion, ##, ###, 1., - | **feasible** | Prompt asks for specific sections. Very broad check. |
| 8 | non-empty-report | structured-report | non-empty, minLen 100 | **feasible** | Trivially easy for any LLM given code input. |
| 9 | cross-file-issue | multi-file-review (0.20, min 0.5) | contains-any: mail, email, mismatch, property, field, typo | **feasible** | Code is inline. The `email` vs `mail` mismatch is obvious. |
| 10 | consistency-check | multi-file-review | contains-any: inconsisten, convention, style, mixed, camelCase, snake_case, async | **feasible** | Broad check for consistency issues that are stated explicitly in the prompt. |

### Assessment

- **Tests with runner-limitation**: 1 (file doesn't exist -- test environment issue)
- **Tests that are feasible**: 9/10 (90%)
- **Trivially easy tests**: 8 (non-empty only)
- **Well-designed tests**: 2, 5, 9 (test real code analysis skills)
- **Expected pass rate (conversational block)**: 7-9 out of 10 (70-90%)
- **Expected fitness**: should meet 0.5 minimum for a competent LLM

### This is the best-designed contract

Most tests use inline code (no file I/O needed), have reasonable checks, and test real capabilities. Test 1 is the only problem -- it references a non-existent file. This contract could work well as a target for agent-creator to build against, IF the implementing block is conversational/inference rather than agentic.

---

## 6. test-generator contract

**File**: `content/system/contracts/test-generator.contract.json`
**Features**: 3 | **Total tests**: 9 | **Minimum fitness**: 0.5
**Required capabilities**: conversation, tool-calling, structured-output

### Test-by-test analysis

| # | Test ID | Feature | Check | Classification | Notes |
|---|---------|---------|-------|----------------|-------|
| 1 | unit-test-basic | test-writing (0.40, min 0.7) | contains-all: test, expect, add | **feasible** | Code is inline. An LLM generates tests with these keywords. |
| 2 | edge-cases | test-writing | contains-all: 0, null, expect | **feasible** | Prompt explicitly asks for division by zero and null cases. |
| 3 | async-test | test-writing | contains-any: async, await, mock, Mock, spy, jest.fn, vi.fn | **feasible** | Standard async testing. Any decent LLM produces this. |
| 4 | test-structure | test-writing | contains-any: describe, it(, test( | **feasible** | Standard test framework structure. |
| 5 | identify-gaps | coverage-analysis (0.30, min 0.6) | contains-any: empty, null, JSON, SyntaxError, version, invalid, throw, error, missing | **feasible** | Very broad check. Almost any analysis of the code mentions at least one. |
| 6 | coverage-report | coverage-analysis | contains-all: validateAge, cover | **feasible** | The prompt explicitly identifies validateAge as uncovered. Any LLM will mention it. |
| 7 | json-test-plan | structured-results (0.30, min 0.5) | contains-all: createUser, getUser, deleteUser, description | **feasible** | The prompt lists these methods. The response should repeat them in the test plan. |
| 8 | non-empty-output | structured-results | non-empty, minLen 150 | **feasible** | Trivially easy -- any test file is longer than 150 chars. |
| 9 | assertion-variety | structured-results | contains-any: toEqual, toContain, toHaveLength, toBe, toMatch, toThrow, toBeDefined, expect | **feasible** | Very broad. Any test code contains `expect` at minimum. |

### Assessment

- **Tests that are feasible**: 9/9 (100%)
- **Trivially easy tests**: 8 (non-empty only), 9 (any test code passes)
- **Well-designed tests**: 2, 6 (require specific understanding)
- **Expected pass rate (conversational block)**: 8-9 out of 9 (89-100%)
- **Expected fitness**: should comfortably meet 0.5

### This contract works well for inference blocks

All prompts include inline code, all checks are reasonable, no file I/O dependencies. The one weakness: some checks are trivially broad (test 5, 9). But overall, this is a solid target contract.

---

## 7. Cross-cutting findings

### Finding 1: The `tool-call` check type is fundamentally broken for agent blocks

The `tool-call` check in ContractTestRunner (line 517-528) does two things:
1. Searches for the tool name in the response text (case-insensitive)
2. If not found, checks `blockOutputs["_toolCalls"]`

Problem: `AgentBlockExecutor.ExtractResultAsync` never sets `_toolCalls` in its outputs. It only sets `content` and `_agentResult` (plus `_agent*` forwarded vars). Tool calls happen INSIDE the NodeExecutionEngine loop and are never surfaced.

**Impact**: ALL `tool-call` checks fail for agent blocks. This affects:
- maestro-assistant: 5 tests (8, 9, 11, 13, 14)
- test-designer: 1 test (18)
- Total: 6 tests across contracts

**Fix needed**: Either (a) AgentBlockExecutor collects tool calls during execution and surfaces them in outputs, or (b) the `tool-call` check is redesigned for agents.

### Finding 2: Agent blocks return step-complete summaries, not work products

The most pervasive issue. When the runner checks the "response" from an agent block, it gets the `_agentResult` value -- which is `{{_nodeResult_parse-response.summary}}` from the step-complete call. This is a human-readable sentence, not the structured content the agent produced.

**Impact**: Tests that use `json-parseable`, `contains-all` with specific field names, or `contains` with content that appears in generated files will all fail.

**Affected contracts**:
- agent-creator: 5/9 tests fundamentally broken
- test-designer: 9/18 tests fundamentally broken
- block-forge: 0 (tests are loose enough to match summaries)

### Finding 3: Multi-turn tests with agents are extremely expensive

Each "turn" in a multi-turn test runs the FULL agent while-loop. With maxIterations=12 and ~8s per LLM call, one turn could take 12 * 8 = 96 seconds and cost ~$0.50-1.00 in tokens. A 3-turn test could cost $1.50-3.00 and take 5 minutes.

**Impact**: Makes testing impractical without a fast/cheap provider.

### Finding 4: Tests that reference files on disk fail in the test environment

- code-reviewer test 1 references `/tmp/test-review/utils.ts` which doesn't exist
- test-designer/agent-creator tests that trigger file-read tool calls will read from the actual filesystem

**Fix needed**: Either create test fixtures or use only inline-code prompts.

### Finding 5: Some checks are trivially weak

Tests using `non-empty` alone (basic-response, non-empty-report, non-empty-output, edge-case-coverage) pass with ANY response. As the contracts architecture doc says: "A test that any LLM would pass is a trivial test and violates the contract testing philosophy."

However, these serve as baseline sanity checks. The issue is when they're the ONLY tests for a feature.

### Finding 6: `contains-any` with common words is barely better than `non-empty`

Several checks use `contains-any` with words like "test", "no", "-", "?". These pass with almost any response. Examples:
- block-forge test 4: contains-any `[test, pass, score, contract, verify]`
- maestro-assistant test 17: contains-any `[1., first, step, plan, then, foundry, publish]`

---

## 8. Recommendations for Phase 62

### 8.1. Fix the agent-runner impedance mismatch (CRITICAL)

Two approaches, not mutually exclusive:

**Approach A -- Surface agent work products in outputs**:
- Modify `AgentBlockExecutor.ExtractResultAsync` to collect tool calls and their results from the execution context
- Add `_toolCalls`, `_filesWritten`, `_fileContents` to the block's outputs
- Pro: Fixes tool-call checks, enables json-parseable checks on written files
- Con: Requires backend changes, increases output size

**Approach B -- Redesign checks for agent blocks**:
- Accept that agent responses are summaries
- Rewrite checks to match summary content (e.g., `contains-any: ["created", "generated", "wrote"]`)
- Add a new check type `output-contains` that checks block outputs directly
- Pro: No backend changes needed for existing checks
- Con: Weaker verification -- summaries are lossy

**Recommendation**: Do both. Approach A for precise verification, Approach B for immediate usability.

### 8.2. Rewrite agent-creator contract tests

Current tests assume conversational responses. Replace with tests that match step-complete summaries:

- `valid-block-json` -> check for `contains-any: ["created", "block.json", "valid", "wrote"]`
- `required-fields` -> check for `contains-any: ["block", "config", "agent"]` (in the summary)
- `capabilities-declared` -> check for `contains: "capabilities"` or `contains: "contract"`
- OR: add a new `output-field` check type that reads from `BlockExecutionResult.Outputs` directly

### 8.3. Fix multi-turn tests for agents

Multi-turn tests with agents are impractical. Options:
1. Convert to single-turn with context baked into the prompt
2. Add a `skipForAgents` flag and use inference blocks for conversational testing
3. Accept the cost and reduce the number of multi-turn tests

### 8.4. Add the `_toolCalls` output to AgentBlockExecutor

This is needed regardless. The `tool-call` check type exists in the contract schema and the runner supports it, but agent blocks don't surface the data it needs.

### 8.5. Fix code-reviewer test 1 (test fixture)

Either:
- Remove the file reference and put code inline
- Create the test fixture as part of test setup
- Add a `testFixtures` section to contracts

### 8.6. Strengthen trivially weak tests

Replace `non-empty` with more specific checks where possible. At minimum, increase `minLength` to force substantive responses.

### 8.7. System prompt adjustments for agent-creator

The agent-creator system prompt says "Your ENTIRE response must be a single JSON object" -- this is correct for the tool-call loop but means the agent NEVER produces conversational text. All contract tests that expect conversational responses will fail.

For the contract tests, what matters is the step-complete summary. The system prompt should instruct the agent to produce DETAILED summaries in step-complete that include key information about what was created (block ID, fitness score, features passed, model used). This would help checks pass without weakening them.

---

## 9. Estimated cost if tests were actually run

### Per-contract cost estimate (using Claude Sonnet 4 at ~$3/M input, ~$15/M output)

| Contract | Tests | Turns | Est. LLM calls/test | Est. total calls | Est. cost |
|----------|-------|-------|---------------------|------------------|-----------|
| agent-creator | 9 | 10 | 5-12 (agent loop) | 50-108 | $2-5 |
| test-designer | 18 | 20 | 5-12 (agent loop) | 90-240 | $4-10 |
| block-forge | 7 | 7 | unknown (no block) | - | - |
| maestro-assistant | 24 | 33 | 1-12 (depends on block type) | 24-396 | $1-15 |
| code-reviewer | 10 | 10 | 1-12 | 10-120 | $0.50-5 |
| test-generator | 9 | 9 | 1-12 | 9-108 | $0.50-5 |

**Total estimated cost**: $8-40 depending on block types and iteration counts
**Total estimated time**: 30-120 minutes at ~8s/call

### With Claude Code CLI (current setup)

Using Claude Code CLI at ~8s/call via the LLM-Provider proxy, each agent test would cost the full round-trip. With agent blocks doing 5-12 iterations per test:
- agent-creator 9 tests: ~50-100 calls * 8s = 400-800s = 7-13 minutes
- test-designer 18 tests: ~90-200 calls * 8s = 720-1600s = 12-27 minutes
- Full suite: 30-60 minutes, no direct cost (uses Claude Code subscription)

---

## Summary classification table

| Contract | Tests | Feasible | Check-too-strict | Runner-limitation | Prompt-unclear | Test-irrelevant |
|----------|-------|----------|-----------------|-------------------|----------------|-----------------|
| agent-creator | 9 | 3 (33%) | 1 (11%) | 5 (56%) | 0 | 0 |
| test-designer | 18 | 8 (44%) | 1 (6%) | 9 (50%) | 0 | 0 |
| block-forge | 7 | 7 (100%) | 0 | 0 | 0 | 0 |
| maestro-assistant | 24 | 19 (79%) | 0 | 5 (21%) | 0 | 0 |
| code-reviewer | 10 | 9 (90%) | 0 | 1 (10%) | 0 | 0 |
| test-generator | 9 | 9 (100%) | 0 | 0 | 0 | 0 |
| **TOTAL** | **77** | **55 (71%)** | **2 (3%)** | **20 (26%)** | **0** | **0** |

### Overall verdict

- **code-reviewer and test-generator contracts are well-calibrated** for inference/conversational blocks. Ready for use as target contracts.
- **maestro-assistant contract is mostly good** but needs 5 tool-call checks fixed for agent blocks.
- **block-forge contract tests are too easy** -- they pass with vague responses. Needs strengthening.
- **agent-creator and test-designer contracts are fundamentally broken** for their implementing blocks. 50-56% of tests fail due to the runner-limitation (agent summary vs. work product mismatch). These contracts need either: (a) backend changes to surface agent work products, or (b) complete test redesign for summary-based verification.

The blocking issue for block-forge's success is the agent-creator and test-designer contracts. Until these are fixed, the forge cannot measure whether its sub-agents (agent-creator, test-designer) are actually performing well. Phase 62 must address this before any system prompt iteration.
