# Contract System

> "A contract is the recipe. Capabilities are the ingredients."

Contracts are verifiable role definitions that blocks can implement. This document defines the contract system: what it is, how it works, and how it integrates with blocks, features, capabilities, and tests.

---

## The Hierarchy: Contract > Features > Capabilities > Tests

```
CONTRACT = a verifiable role that a block can fulfill
  Example: "maestro-assistant", "code-reviewer", "test-designer"
  Multiple blocks can implement the same contract.
  The user chooses which implementation to use.

FEATURE = a functional grouping visible to the user
  Example: "Conversation", "Maestro Operations", "Orchestration"
  Displayed as +/- in the AssistantSelector.
  A feature is active if the block has ALL the required capabilities.
  A feature has a score (% of tests passed) and a minimum threshold.

CAPABILITY = an atomic competence of a block
  Example: "conversation", "tool-calling", "structured-output", "memory"
  Declared in the block's `capabilities[]` field.
  A capability is a boolean: the block either has it or doesn't.

TEST = a concrete verification of a feature
  Example: "basic-response", "create-session", "remember-preference"
  A test has a prompt, a check (verification), and produces a pass/fail.
  Tests are defined in the contract, executed against a block.
```

### Relationships

```
Contract: maestro-assistant
|
+-- Feature: "Conversation"
|     requires: [conversation]
|     weight: 0.25
|     minimumScore: 0.8
|     tests:
|       - basic-response: "Hello" -> non-empty response, >= 20 chars
|       - context-retention: multi-turn, remembers name
|
+-- Feature: "Maestro Operations"
|     requires: [structured-output, tool-calling, stability]
|     weight: 0.30
|     minimumScore: 0.7
|     tests:
|       - create-session: calls session-create tool
|       - list-workspaces: calls workspace-list tool
|       - navigate-pages: mentions catalog/Catalog
|
+-- Feature: "Orchestration"
|     requires: [orchestration, tool-calling, long-context]
|     weight: 0.30
|     minimumScore: 0.7
|     tests:
|       - multi-step-plan: presents plan with workspace + session
|       - confirm-before-act: does NOT delete without confirmation
|
+-- Feature: "Memory"
      requires: [memory, long-context]
      weight: 0.15
      minimumScore: 0.6
      tests:
        - remember-preference: stores and recalls "verbose output"
```

A small model (mistral-7b) passes 1/4 features. A sonnet passes 3/4. An opus passes 4/4. The contract makes this measurable.

---

## What a Contract IS NOT

- **Not a list of capabilities.** Capabilities are atomic booleans on a block. A contract defines how those capabilities combine into features, weighted and scored.
- **Not a boolean.** A block doesn't simply "pass" or "fail" a contract. Each feature has a score (% of tests passed) and a minimum threshold. The overall fitness is a weighted average.
- **Not a unit test.** Contract tests are runtime invocations of the block (prompt in, response out), not vitest/jest assertions. They test the block's actual behavior with an LLM.
- **Not a block.** Contracts live in `content/system/contracts/*.contract.json`. They are separate from blocks. A block *implements* a contract via its `contract` field.

---

## Contract Schema

File format: `content/system/contracts/{id}.contract.json`

```json
{
  "id": "maestro-assistant",
  "name": "Maestro Assistant",
  "version": "2.0.0",
  "description": "The primary conversational assistant in maestro-code",

  "requiredCapabilities": ["conversation"],
  "minimumFitness": 0.3,

  "features": {
    "conversation": {
      "description": "Basic conversational interaction",
      "requires": ["conversation"],
      "weight": 0.25,
      "minimumScore": 0.8,
      "tests": [
        {
          "id": "basic-response",
          "description": "Agent responds coherently to a greeting",
          "prompt": "Hello, what can you do?",
          "check": { "type": "non-empty", "minLength": 20 }
        },
        {
          "id": "context-retention",
          "description": "Agent remembers context from previous turn",
          "turns": [
            { "prompt": "My name is Alice" },
            { "prompt": "What is my name?", "check": { "type": "contains", "value": "Alice" } }
          ]
        }
      ]
    }
  },

  "scoring": {
    "method": "weighted-average",
    "description": "Score = sum(feature.weight * feature.score). A block is valid if score >= minimumFitness AND each active feature has score >= feature.minimumScore."
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique contract identifier |
| `name` | string | Human-readable name |
| `version` | string | Semver version |
| `features` | object | Map of feature-id to feature definition |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | "" | What this contract represents |
| `requiredCapabilities` | string[] | [] | Minimum capabilities to even attempt |
| `minimumFitness` | number | 0.0 | Global threshold (0.0-1.0) |
| `scoring.method` | string | "weighted-average" | Scoring algorithm |

### Feature Definition

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | "" | What this feature does |
| `requires` | string[] | [] | Capabilities needed to activate |
| `weight` | number | equal | Weight in global score (all weights should sum to 1.0) |
| `minimumScore` | number | 0.0 | Minimum test pass rate for this feature |
| `tests` | array | [] | Test definitions |

### Test Definition

A test is either **single-turn** or **multi-turn**.

**Single-turn test:**
```json
{
  "id": "basic-response",
  "description": "Agent responds coherently",
  "prompt": "Hello, what can you do?",
  "check": { "type": "non-empty", "minLength": 20 }
}
```

**Multi-turn test:**
```json
{
  "id": "context-retention",
  "description": "Agent remembers context",
  "turns": [
    { "prompt": "My name is Alice" },
    { "prompt": "What is my name?", "check": { "type": "contains", "value": "Alice" } }
  ]
}
```

### Check Types

| Type | Parameters | What it verifies |
|------|-----------|------------------|
| `non-empty` | `minLength?` | Response is non-empty, optionally >= minLength chars |
| `contains` | `value` | Response contains a specific substring |
| `contains-all` | `values` | Response contains ALL listed substrings |
| `contains-any` | `values` | Response contains at least ONE listed substring |
| `does-not-contain` | `values` | Response does NOT contain any listed substring |
| `tool-call` | `toolName`, `requiredArgs?` | A specific tool call was made |
| `json-parseable` | - | Response contains valid JSON |
| `regex` | `pattern`, `flags?` | Response matches a regex pattern |

---

## How a Block "Passes" a Contract

1. **Capability gate**: The block must have all `requiredCapabilities` to even be considered.
2. **Feature activation**: For each feature, check if the block has all `requires` capabilities. If not, the feature is inactive (skipped).
3. **Test execution**: For each active feature, run all its tests against the block (with mock tools). Each test produces pass/fail.
4. **Feature scoring**: `feature.score = tests_passed / tests_total`
5. **Validation**: Each active feature must have `score >= feature.minimumScore`.
6. **Performance score**: `P = weighted_average(feature_scores)` for active features.
7. **Fitness calculation**: Feed P into `FitnessScore.Calculate()` with model profile, task entropy, and cost data. The final fitness factors in economic cost, compute cost, and hardware cost.

A block is **valid** for a contract if:
- It has all `requiredCapabilities`
- Every active feature meets its `minimumScore`
- The global fitness meets `minimumFitness`

---

## How the User Chooses (AssistantSelector)

The AssistantSelector in maestro-code lists all blocks that implement a contract. For each block, it shows:
- Active features (the block has the required capabilities) marked with `+`
- Inactive features (missing capabilities) marked with `-`
- Whether it meets the `requiredCapabilities`

The user picks the block that best fits their needs. A powerful model supports all features. A smaller model supports fewer but runs faster/cheaper.

---

## How `/adapt` Uses Contracts

The adapt system (Phase 55+) uses contracts as the quality standard:
1. Start with a block that passes a contract on a powerful model (e.g., opus)
2. Create a variant targeting a smaller model (e.g., sonnet, haiku)
3. Run the contract's tests against the variant
4. If the variant passes the minimum thresholds, publish it
5. Users can then choose the variant for cost/speed tradeoffs

---

## Tests Are Part of the Contract

Tests live **inside** the contract JSON, in each feature's `tests[]` array. There is no separate test-suite file.

- A human writes the initial contract with baseline tests.
- The **test-designer** agent can modify, add, improve, or remove tests inside the contract.
- The contract is the **single source of truth** — versioned and publishable like a block.
- When the contract is improved, it gets a new version and can be republished.

This is intentional: the contract defines both WHAT a block must do (features, capabilities) and HOW to verify it (tests). Splitting tests into a separate file creates sync issues and ambiguity about which source of truth to trust.

---

## Design Decisions — Contract Test Runner

### 1. Agents Use Real Tools in Tests

**Decision**: The contract test runner uses the same tools as production. No mock tools needed.

**Why**: Maestro's architecture already makes tools interchangeable. An agent calls `file-write` — it doesn't know if it's a script, a workflow, or anything else. The runner executes the agent through `BlockExecutorRegistry` with its real tools.

The `BlockExecutionResult` from the agent contains `_toolCalls` in its outputs. The `tool-call` check type can inspect these. If a test needs to verify that an agent wrote valid JSON, the test should use `tool-call: file-write` (verifies the agent called the tool), not `json-parseable` on the response text (the JSON is in the file, not the conversation).

**Rule**: Write tests that match how the agent actually works. If an agent produces output via tools, test the tool calls, not the conversational summary.

### 2. Fitness Uses the Existing FitnessScore System

**Decision**: The contract test runner MUST use the existing `FitnessScore` system (`Domain/ValueObjects/FitnessScore.cs`), not a custom pass-rate formula.

**Existing formula**:
```
              P × S × W
Fitness = ─────────────────────
          (C_norm × C_compute × C_hw)^λ
```

Where:
- **P** = Performance (quality score, 0-1) ← this is where test pass rate feeds in
- **S** = Specialization (P / task entropy)
- **W** = Composability (success rate × retry penalty)
- **C_norm** = Normalized economic cost (log scale of actual cost)
- **C_compute** = Computational cost (log10(params) × FLOPs)
- **C_hw** = Hardware cost (α×VRAM + β×RAM + γ×GPU)
- **λ** = Cost sensitivity exponent (default 0.3)

A score of 1.0 is impossible because costs always reduce the score. A cloud model with perfect quality still gets penalized by economic cost. A local model with decent quality but zero cost can compete.

**Status**: ContractTestRunner currently uses a simplistic `weighted_average(pass_rate)`. Must be refactored to feed into `FitnessScore.Calculate()`.

### 3. Never Weaken Tests to Improve Fitness

**Decision**: If an agent fails a test, the fix is NEVER to make the test easier. The fix is either:
- Fix the agent (better prompt, better tools)
- Fix the runner (capture more data, better check evaluation)
- Fix the test environment (mock tools, proper isolation)

A test that any LLM would pass (e.g., checking if the response contains words that were in the prompt) is a **trivial test** and violates the contract testing philosophy.

---

## File Locations

| What | Where |
|------|-------|
| Contract definitions | `content/system/contracts/*.contract.json` |
| Contract resolver (client) | `packages/maestro-code/services/contract-resolver.ts` |
| Contract API (backend) | `GET /api/contracts`, `GET /api/contracts/{id}` |
| Contract test API | `POST /api/contracts/{id}/test?blockId=X` |
| Fitness formula | `Domain/ValueObjects/FitnessScore.cs` |
| Fitness config | `Domain/ValueObjects/FitnessConfig.cs` |
| Fitness service | `Infrastructure/Fitness/FitnessService.cs` |
| Contract test runner | `Infrastructure/Testing/ContractTestRunner.cs` |
| Block's contract reference | `contract` field in `*.block.json` |
| Block's capabilities | `capabilities[]` field in `*.block.json` |
| Test-designer agent | `content/system/blocks/agents/test-designer/` |

---

*See also: [blocks.md](blocks.md) for block architecture, [execution.md](execution.md) for how blocks are executed*
