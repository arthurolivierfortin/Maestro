# Phase 64 Checkpoint (Agents Fonctionnels)

**Last update**: 2026-03-19
**Agent**: Claude Opus 4.6
**Note**: Cette phase etait la Phase 62 puis 63, renumerotee Phase 64 lors du restructuring.

---

## Contexte: Phase 62 (Container Isolation)

Durant le travail sur cette phase, un probleme de securite fondamental a ete decouvert dans `ToolDispatcherBlockExecutor` : les tool calls des agents n'etaient pas filtrees par les permissions de la session. Phase 62 (Container Isolation) a ete creee et completee pour resoudre ceci.

**Impact sur Phase 64** :
- `ContractTestRunner` configure maintenant `AllowedBlocks` dans les sessions de test (seuls les tools mappes + step-complete)
- Le bug `capabilities-declared` (agent loop sur `json-validator`) est corrige — le tool est refuse par les permissions

---

## 64-A: DONE
- `_toolMapping` in ToolDispatcherBlockExecutor — redirects tools to mock/capture blocks
- 4 capture blocks created: capture-file-write, capture-file-read, capture-file-edit, capture-shell-execute
- Each capture block has its own executor + block.json (everything is a block)
- CaptureHelper shared utility for reading/writing `_capturedToolCalls`
- ContractTestRunner injects `_toolMapping` + `AllowedBlocks` for agent blocks
- `tool-call` check type updated to read `_capturedToolCalls`
- 15 original tests + 5 check-type tests = 20 tests, all pass
- Build: 0 errors

## 64-B: DONE
- ProviderPriorityOptions + persistence to `provider-priority.json`
- `GET /api/v1/providers/conflicts` — detects model conflicts across providers
- `PUT /api/v1/providers/priority` — user sets preferred provider per model
- `GetProviderForModelAsync` checks configured priority first, falls back to first available
- ClaudeCode configure comme provider par defaut (priority 1) pour les 3 modeles
- 11 tests, all pass

## 64-C: DONE
- **agent-creator**: 9/9 tests pass, performance 1.0, fitness 0.119
- System prompt condensed: 994 -> 317 lines (68% reduction)
- THINK/ACTION ReAct-style format for all agent system prompts
- Fresh session per test in ContractTestRunner (prevents _agentDone poisoning)
- Loop detection refined: composite key `toolId:argsHash`
- Cost: $0.25 per run with ClaudeCode provider (vs $0.50 with Anthropic direct)
- Fix: check types (`json-parseable`, `contains-all`, `contains`, `contains-any`, `does-not-contain`) now read `_capturedToolCalls` in addition to `response`
- Fix: Windows command-line limit in ClaudeCode provider — `totalArgLength = prompt + systemPrompt` for stdin threshold

## 64-D0: DONE — Infrastructure + fix contrats
- `CaptureGenericBlockExecutor` created — captures any tool call not covered by specific capture blocks
- `capture-generic.tool.block.json` created in `content/system/blocks/tools/capture-generic/`
- `ToolDispatcherBlockExecutor`: added `_lastDispatchedToolId` to preserve original tool ID before mapping
- `ContractTestRunner`: AllowedBlocks + _toolMapping extended with 7 Maestro operation tools -> capture-generic
- `SummaryValidatorBlockExecutor` created — validates LLM output summaries against expected criteria
- `summary-validator.tool.block.json` created in `content/system/blocks/tools/summary-validator/`
- `ResponseParserBlockExecutor` fix: short JSON arrays were incorrectly classified as "retry"
- maestro-assistant contract fixed: multi-turn conversations, tool names aligned, memory capability, widget markers
- block-forge contract strengthened: 2 tool-call tests added
- DI: both new executors registered in Program.cs
- 4 capture-generic tests + 3 summary-validator tests + 2 response-parser tests = 9 new tests
- Build: 0 errors

## 64-E: DONE
- **maestro-assistant**: 24/24 tests pass, performance 1.0, fitness 0.119
- All features pass: conversation 7/7, operations 7/7, orchestration 5/5, memory 5/5
- Widgets inline functional: `[WIDGET:sessions]`, `[WIDGET:catalog]`, etc.
- Cost: $0.13 per run
- Provider: ClaudeCode (CLI, priority 1)

## 64-D: EN COURS — test-designer contract v2.0
- test-designer contract rewritten v2.0 (11 tests, purely generative)
- System prompt simplified: single THINK/ACTION mode, no conversation
- Block capabilities changed to `[structured-output, tool-calling]`
- config.nodes simplified (removed summary-validator branches)
- Contract test running...

## 64-G: EN COURS — contract-definer agent
- contract-definer agent CREATED (block.json + system-prompt.md + contract)
- Contract: 16 tests across 4 features (requirement-gathering, contract-generation, test-advice, quality-judgment)
- Conversational agent (temperature 0.3, maxIterations 15)
- Contract test running...

## 64-F: PAS COMMENCE
- Block-forge pipeline needs to be updated from 2 agents to 3 agents (contract-definer -> test-designer -> agent-creator)
- Depends on 64-D and 64-G completion

## 64-T: PAS COMMENCE

---

## Handoff

**Derniere action** : 64-D (test-designer v2.0) and 64-G (contract-definer) contract tests launched in parallel
**Prochaine action** : Analyze results of both contract tests, iterate if needed, then 64-F (block-forge 3-agent pipeline)
**Etat du build** : compiles, tests need regression check

## Fichiers modifies (cumul toutes sessions)
- `apps/backend/src/Maestro.Infrastructure/Testing/ContractTestRunner.cs` (check types + helpers + Maestro tools mapping)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ResponseParserBlockExecutor.cs` (short JSON array fix)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/CaptureGenericBlockExecutor.cs` (NEW)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/SummaryValidatorBlockExecutor.cs` (NEW)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolDispatcherBlockExecutor.cs` (_toolMapping + _lastDispatchedToolId)
- `apps/backend/src/Maestro.Api/Program.cs` (DI registrations)
- `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/CaptureBlockTests.cs` (20+ tests)
- `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` (totalArgLength fix)
- `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` (ClaudeCode priority)
- `content/system/blocks/tools/capture-generic/` (NEW)
- `content/system/blocks/tools/summary-validator/` (NEW)
- `content/system/blocks/agents/contract-definer/` (NEW - block.json + system-prompt.md)
- `content/system/blocks/agents/test-designer/` (block.json + system-prompt.md modified)
- `content/system/blocks/system/maestro-assistant/` (block.json + system-prompt.md modified)
- `content/system/contracts/test-designer.contract.json` (v2.0 rewrite)
- `content/system/contracts/maestro-assistant.contract.json` (multi-turn fixes)
- `content/system/contracts/block-forge.contract.json` (2 tests added)
- `content/system/contracts/contract-definer.contract.json` (NEW)
- `docs/phases/PHASE-64/README.md` (major rewrite)
