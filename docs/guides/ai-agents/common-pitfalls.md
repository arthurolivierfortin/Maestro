# Common Pitfalls — AI Agent Reference

> **This document is extracted from CLAUDE.md.** It contains detailed cause/fix/verification for every known pitfall. CLAUDE.md references this file — keep them in sync.

---

## JsonElement Corruption in Session Variables (CRITICAL)

**Cause**: When the API receives session variables via `PUT /api/sessions/{id}/variables/{key}`, the `SetVariableRequest.Value` (type `object`) is deserialized by `System.Text.Json` as a `JsonElement`, not as native types. When the session is later serialized to disk, `JsonElement` values inside `Dictionary<string, object>` get corrupted — objects become nested empty arrays.

**Symptoms**: `_phases` shows as `[[[[]],[[]],...]...]` instead of `[{id:"plan",name:"Planning",...},...]`. Monitor shows phases without names. `_monitorDescriptor` layout is broken.

**Fix**: The `SetVariable` action in `SessionsController.cs` must normalize `JsonElement` to native types using `NormalizeObjectValue()` before storing. This converts `JsonElement.Object` → `Dictionary<string, object>`, `JsonElement.Array` → `List<object>`, `JsonElement.String` → `string`, etc.

**Verification**: After setting a variable, `curl` the API to verify the response contains proper JSON objects, not nested arrays.

**Location**: `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` → `SetVariable()`, `apps/backend/src/Maestro.Infrastructure/Sessions/FileSystemProjectSessionRepository.cs` → `SerializeSession()`, `apps/backend/src/Maestro.Infrastructure/Sessions/FileSystemFoundrySessionRepository.cs` → `SerializeSession()`

---

## Session Status "created" After Start (Idle Deserialization Bug)

**Cause**: `Session.GetSessionStatus()` returns `SessionStatus.Idle` for active sessions with no running workflow. The file repository serializes this as `"status": "idle"`. On deserialization, `MapSessionStatusToContainerStatus()` has no mapping for `SessionStatus.Idle`, so it defaults to `ContainerSessionStatus.Created`.

**Fix**: Add `SessionStatus.Idle => ContainerSessionStatus.Active` in both `FileSystemProjectSessionRepository.cs` and `FileSystemFoundrySessionRepository.cs`.

---

## All Blocks Showing as "composite"

**Cause**: `isAtomic` property missing from `BlockDto`.

**Fix**: Ensure `BlockDto.FromDomain` includes `IsAtomic = block.IsAtomic`.

---

## Tests Expecting Wrong Type Count

**Cause**: New block types added without updating tests.

**Fix**: Check `blockTypeDefinitions.ts` for current count and update test expectations.

---

## Test Mocks Not Matching Import Paths

**Cause**: `vi.mock()` path doesn't match the import path.

**Example**: Import is `../store/blockStore` but mock is `../../store/blockStore`.

**Fix**: Mock path must exactly match the relative import path.

---

## Backend Build Fails with "file is locked"

**Cause**: Maestro.Api process is running.

**Fix**: `taskkill /F /IM Maestro.Api.exe` before building.

---

## Block API Requests Hang or Timeout

**Cause**: Async deadlock from `.Result` calls or circular dependencies.

**Fix**:
- Never use `.Result` inside async methods — use `await` instead
- Check for circular DI dependencies (e.g., AgentBlockExecutor ↔ BlockExecutorRegistry)

---

## Session-Specific Logic Hardcoded in Infrastructure

**Cause**: Putting phase names, LLM prompts, workflow steps, or output paths directly in C# code (e.g., `EntryPointExecutor`).

**Fix**: Put data in session template variables (`_workflowConfig`, `_phases`) and workflow block JSON (`config.nodes`).

**Test**: If adding a new session type requires C# changes, the architecture is wrong.

---

## Writing Custom Scripts Instead of Using the CLI

**Cause**: Writing PowerShell/bash scripts to create sessions, set variables, invoke entry points.

**Fix**: Use existing CLI commands (`session create`, `session start`, `session invoke`, `session set-var`). If a generic command is missing, add it to the CLI — don't write a one-off script.

**Rule**: The CLI is the universal interface. Scripts hide operations from metrics, logging, and audit.

---

## Using Fallback Content When a Service is Down

**Cause**: Catching LLM/service errors and returning fake data to keep the workflow running.

**Fix**: Let the error propagate. The node gets status `error` in the execution tree. The monitor shows it. The user decides. No silent degradation.

---

## Proposing Session-Specific CLI Commands

**Cause**: Suggesting commands like `session reset-phases` or `session restart-workflow` that only make sense for one session type.

**Fix**: Use generic operations: `session set-var <id> <key> <value>` to reset any variable. The CLI operates on generic abstractions (sessions, variables, blocks, entry points), never on session-specific concepts (phases, fitness, iterations).

---

## Treating Agents as Special Entities

**Cause**: Creating separate entities, metrics classes, or hardcoding content/behavior in executor code for agents.

**Examples of violations to watch for**:
- Hardcoded tool lists (`var availableTools = new List<string> { ... }`) in C#
- Default system prompt built in C# instead of block config
- `tools.json` file loaded by handler
- Separate `AgentDefinition` / `ToolDefinition` entities alongside `BlockDefinition`
- Agent executor calling `_llmGateway.SendAsync()` directly instead of orchestrating child blocks
- Hardcoding the agentic loop structure (while loop, tool dispatch) in C# instead of in `config.nodes`
- Prescribing what an agent must contain internally (it's a black box)

**Fix**: One entity (`BlockDefinition`), one metrics system. All content (system prompts, tools) lives in block config/files. The agent is composite (`isAtomic: false`) — its internal behavior should be defined by its child blocks in `config.nodes`, not by hardcoded C# logic.

**ADRs**: `docs/phases/PHASE-18/ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT.md`, `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md`, `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md`

---

## God Class Pattern in Executors (CRITICAL — happened twice)

**Cause**: Adding new functionality as `if (type == "xxx")` branches inside a single executor class. This happened with:
- `ToolBlockExecutor` — grew an if-chain for every tool type (filesystem, shell, contract-test, response-parser, etc.)
- `EntryPointExecutor` — 4272 lines mixing node execution, native handlers, and session state management

**Symptoms**: One file grows past 1000+ lines. Adding a new type requires modifying an existing class. Multiple unrelated responsibilities in one class.

**Fix**: Each type gets its own class, dispatched via a registry. For block types: `BlockExecutorRegistry`. There is ONE registry. No `NativeHandlerRegistry`, no `ToolHandlerRegistry` — those are just god classes in disguise.

**Litmus test**: Can a new tool/block type be added with ONLY a new class + DI registration? If you must modify an existing executor, architecture is violated.

**ADR**: `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md`

---

## Adding Tool Dispatch in AgentBlockExecutor (CRITICAL — happened 3+ times)

**Cause**: The agent "owns" its loop, so it feels natural to add tool dispatch code there. This has been done and reverted at least 3 times (Phase 35-PRE, corrections, Phase 52).

**Fix**: Agent behavior is defined by `config.nodes` in its block.json. `AgentBlockExecutor` only does: (a) conversation setup in `PrepareExecutionAsync`, (b) extract `_agentResult` in `ExtractResultAsync`. Tool dispatch, response parsing, and the agentic loop are nodes executed by the base class (`MultiNodeBlockExecutor`).

**Rule**: If you are writing code inside `AgentBlockExecutor`, STOP and re-read the ADR. The only code that belongs there is conversation I/O contract.

**ADR**: `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md`

**Current state (Phase 53-E)**: `AgentBlockExecutor` is now a thin class (~100 lines) that only handles conversation setup and I/O contract. All legacy code (agentic loop, tool dispatch, response parsing, ~1150 lines) has been removed. The agentic loop is defined in config.nodes templates.

---

## Hardcoding Format Validation or Retry Messages in Executor Code

**Cause**: Adding content-specific logic in executor C# code, such as checking if an agent's output is a "JSON array" or embedding retry messages like "your response must be a JSON array of steps". This violates "executor = mechanical plumbing".

**Example**: `if (summary.Length > 50 && !summary.StartsWith("[")) { /* hardcoded retry */ }` in `AgentBlockExecutor.cs`.

**Fix**: Use a **while loop + json-validator block + conditional gate** in the workflow JSON. The executor never inspects output content — all validation and retry is expressed declaratively:

```json
{
  "type": "while",
  "condition": "{{_planFormatValid}} != true",
  "maxIterations": 3,
  "nodes": [
    { "blockRef": "task-planner", "inputs": { "validationError": "{{_planValidationError}}" } },
    { "blockRef": "json-validator", "inputs": { "data": "{{_nodeResult_plan}}" } },
    {
      "type": "conditional",
      "condition": "{{_nodeResult_validate-plan.isValid}} == false",
      "then": { "nodes": [{ "type": "set-variable", "variable": "_planValidationError", "value": "..." }] },
      "else": { "nodes": [{ "type": "set-variable", "variable": "_planFormatValid", "value": "true" }] }
    }
  ]
}
```

The json-validator returns `{isValid: false, errors: [...]}` on failure or the parsed JSON on success. The conditional gate stores the error for retry or marks the plan valid to exit the loop.

**Litmus test**: Can you change the expected output format of a block without modifying C#? If yes, correct.

**Incident**: Phase 35-E Fix 38 initially used `config.outputValidation` in executor code. Refactored to while+validator blocks — executor is now pure plumbing with zero format awareness.

---

## Creating Blocks Outside the Workspace/Foundry Workflow

**Cause**: Writing block JSON files directly into `content/system/blocks/` without a workspace or foundry session, because it's faster.

**Fix**: Always follow the canonical workflow: create a workspace → create a foundry session → develop/test the block → publish when fitness is good → use in project session. See `docs/guides/users/full-pipeline.md`.

**Why**: Without the workflow, there's no traceability. The user can't see what was done, what was tested, or what fitness was achieved. Blocks created "loose" are invisible to the session/workspace system.

---

## Stopping at the First Obstacle Instead of Iterating

**Cause**: A model doesn't follow instructions, a prompt doesn't work, or infrastructure has a bug — and the response is to note "next steps" instead of fixing it.

**Fix**: Iterate. If SmolLM2 fails, try Qwen2.5-Coder. If the prompt is bad, rewrite it. If infrastructure is broken, fix the code. Only stop for fundamental technical impossibilities. "Prochaine etape" is not a deliverable.

---

## Putting LLM Provider Logic in Maestro Instead of LLM-Provider

**Cause**: Creating gateway classes in Maestro C# for specific providers (ClaudeCodeGateway, AnthropicApiGateway, MultiProviderGateway) instead of adding them to LLM-Provider .NET.

**Fix**: Maestro has ONE gateway (`LLMProviderGateway`) that talks to LLM-Provider .NET API (`C:\Meastro\llm-provider\dotnet\`). All provider-specific logic lives in LLM-Provider .NET as `ILLMProvider` implementations (e.g., `AzureLLMProvider`, `LocalLLMProvider`, `ClaudeCodeLLMProvider`). Adding a new provider = create a new project in LLM-Provider .NET, zero Maestro changes.

**Concrete violation that happened**: Phase 26-B initially created `MultiProviderGateway`, `CliAgentGateway`, `ClaudeCodeGateway`, `AnthropicApiGateway` in `Maestro.Infrastructure/LLMGateway/`. This was discarded. The correct approach is to add providers in `C:\Meastro\llm-provider\dotnet\src\LLMProvider.XxxProvider\`.

---

## Assuming LLM-Provider is Python-Only

**Cause**: Only looking at `C:\Meastro\llm-provider\api\` (Python FastAPI) and missing `C:\Meastro\llm-provider\dotnet\` (full .NET Clean Architecture with ILLMProvider, ILLMProviderFactory, orchestration service, 3 concrete providers).

**Fix**: LLM-Provider is a .NET solution that CONTAINS a Python service for local GPU inference only. The multi-provider gateway, routing, factory, conversations, token tracking, and API are all in .NET. Always check `C:\Meastro\llm-provider\dotnet\` first.

---

## Hardcoding Domain-Specific Features in Infrastructure

**Cause**: Creating CLI commands like `maestro agent` that hardcode code-development logic (commit, test, review), or adding optimization logic that only works for code.

**Fix**: Infrastructure MUST be domain-agnostic. Use `maestro run-interactive <workflow>` (generic) + aliases system (`aliases.json`) for shortcuts. `maestro agent` = alias → `autonomous-dev-v3`, defined in content, not code. A user creating a translation workflow should get `maestro translator` the same way.

**Rule**: If grep-ing the infrastructure code for "commit\|implement\|code-review" finds matches → architecture violated.

**Reference**: `docs/phases/PHASE-28/SUGGESTIONS-OPTIMIZE-AND-PHILOSOPHY.md`

---

## Publishing Workflows Without Manifestes

**Cause**: Publishing a workflow tier without metadata about which models it needs, what fitness was measured, what substitutes were tested.

**Fix**: Every published workflow MUST embed a `metadata.manifest` with: required models per block, fitness scores, tested substitutes with their fitness, evaluation criteria. This enables `maestro check` (static compatibility) and `maestro adapt` (dynamic adaptation).

**Reference**: `docs/phases/PHASE-28/SUGGESTIONS-V2-COMPATIBILITY-AND-EVALUATION.md`

---

## SDK Types Don't Match Backend API Response Shape (CRITICAL)

**Cause**: The SDK (`packages/maestro-client/src/`) declares TypeScript types and return types for API calls, but nobody verifies they match the actual JSON the backend returns. Example: SDK declares `http.get<LLMModel[]>('/api/provider/models')` but backend returns `{ count: 17, models: [...] }` — an object wrapper, not an array. The SDK silently returns the wrong type, and `Array.isArray()` checks in the UI return false → 0 items displayed.

**Fix**: When writing or modifying SDK domain methods, ALWAYS `curl` the actual backend endpoint first and verify the response shape matches the declared TypeScript type. If the backend wraps results in `{ count, models }`, the SDK must unwrap it or the type must reflect the wrapper.

**Verification**: `curl -s http://localhost:5000/api/<endpoint> | python -m json.tool | head -5` — check if root is array `[` or object `{`.

**Rule**: NEVER declare a return type without verifying the actual API response. NEVER use fallback chains like `model.id || model.name || model.model_id` to guess field names — this hides contract mismatches.

---

## SDK Field Names Don't Match Backend DTO Field Names

**Cause**: The SDK type declares `id: string` but the backend DTO serializes as `modelId`. The frontend uses `model.id` which is `undefined`, falls back to `model.name` — it "works" but is wrong. These silent mismatches accumulate and create fragile code full of `||` fallback chains.

**Fix**: SDK types MUST use the exact field names from the backend DTOs. Check the C# DTO (`apps/backend/src/Maestro.Application/DTOs/`) and verify the JSON property names match the TypeScript interface fields. C# uses PascalCase → JSON camelCase (via serializer settings), so `ModelId` in C# = `modelId` in JSON = `modelId` in TypeScript.

**Rule**: One source of truth for field names: the backend DTO. The SDK mirrors it exactly. The UI uses the SDK types. No guessing, no fallback chains.

---

## Using @ts-nocheck Instead of Fixing Type Errors (CRITICAL)

**Cause**: Adding `// @ts-nocheck` at the top of a file to suppress all TypeScript errors, because fixing them takes time or requires interface changes.

**Why it's dangerous**: `@ts-nocheck` disables ALL compile-time checking — missing properties, wrong types, interface mismatches. These become runtime crashes that only appear in specific flows and are invisible to tests.

**Incident (2026-03-03)**: All 35 files in `packages/maestro-code/` had `@ts-nocheck`. `App.ts` line 230 created a `SessionManager` after provider setup without passing `importSessionTemplate`. With TypeScript enabled, this would have been a compile error (missing required property). Instead, it defaulted to a no-op, the template was never imported, and every new user got "Entry point 'message' not found" on their first message.

**Fix**: Never add `@ts-nocheck`. If type errors exist, fix them. If a dependency has bad types, add a `.d.ts` declaration file or use targeted `// @ts-expect-error` on the specific line.

**Verification**: `grep -rl "@ts-nocheck" packages/maestro-code/` should return 0 files.

---

## Creating Components After Setup Without Forwarding All Options (CRITICAL)

**Cause**: When a setup flow (provider setup, onboarding, config wizard) completes, the app creates new instances of services (SessionManager, API client). If the creation doesn't forward ALL required options from the original launch context, the new instance is silently broken.

**Incident (2026-03-03)**: After provider setup, `App.ts` created a new `SessionManager`:
```typescript
// BROKEN — missing importSessionTemplate, template, entryPoint
setLiveSessionManager(new SessionManager({ apiClient: newClient, repoPath }));
```
The original creation at startup had all options because it used the full `options` object. The post-setup creation only passed 2 of 5 required fields. The `importSessionTemplate` callback defaulted to a no-op.

**Fix**: When creating service instances after a setup/config flow, always forward ALL options from the original launch context. Use typed interfaces to make missing properties a compile error.

**Pattern**: Store the original options object and destructure from it:
```typescript
// CORRECT — use the same options source
setLiveSessionManager(new SessionManager({
  apiClient: newClient,
  repoPath: originalOptions.repoPath,
  importSessionTemplate: originalOptions.importSessionTemplate,
  template: originalOptions.template,
  entryPoint: originalOptions.entryPoint,
}));
```

**Verification**: After any setup/onboarding flow, immediately test the first user action (send a message, create a session, etc.). If it fails with "not found" or similar, options were not forwarded.

---

## Dogfooding With Pre-Configured State (CRITICAL)

**Cause**: Running dogfooding sessions with providers already configured, `.maestro/` directory already existing, backend already running. This skips the first-run flow — the most critical path for new users.

**Incident (2026-03-03)**: All dogfooding sessions were run with providers pre-configured. The provider setup → backend start → session creation flow was never exercised. The primary user path was broken.

**Fix**: Every dogfooding session MUST include at least one test of the first-run flow:
1. Delete `.maestro/` in the test repo
2. Clear provider config
3. Launch the app fresh
4. Complete setup
5. Send first message
6. Verify it works

**Rule**: If dogfooding only tests with pre-existing state, it is not testing the user's experience. The first-run flow is where most integration bugs hide because it exercises component creation, option forwarding, and service initialization that the normal flow skips.

---

## Shell Commands Fail on Windows

**Cause**: Unix commands like `mkdir -p` don't work on Windows cmd.

**Fix**: Use PowerShell commands: `powershell -Command "New-Item -ItemType Directory -Force -Path path1, path2"`
