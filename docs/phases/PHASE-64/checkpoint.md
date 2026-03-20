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

## ARCHITECTURE PIVOT — Workflow-first (2026-03-19 soir)

Pivot majeur : les "agents" block-forge sont maintenant des WORKFLOWS multi-nodes.
Le LLM ne controle pas le flux — le workflow le fait.
7 blocks specialises crees (read-contract, write-contract, validate-contract, read-test-suite, write-test-suite, validate-test-suite, write-block).
Tous les models passes a Opus.
Agent-creator renomme block-creator.

## 64-D + 64-G : CONVERGE en workflows

### 3 workflows crees
- `content/system/blocks/workflows/contract-definer/` — description → inference → write-contract → validate → done
- `content/system/blocks/workflows/test-designer/` — read-contract → inference → write-test-suite → validate → done
- `content/system/blocks/workflows/block-creator/` — read-contract → read-test-suite → inference → write-block → contract-test → loop

### Runs des workflows (multiple iterations)

**block-creator** : **8/11 (73%)** — fonctionne bien. Utilise le pattern agent classique (copie de l'ancien agent-creator).

**test-designer** : 2/9 — le workflow s'execute mais l'inference node ne produit pas de contenu exploitable. La reponse retournee contient les inputs (messages JSON) au lieu du resultat genere.

**contract-definer** : 1/12 — meme probleme. Les reponses sont `[{"role":"user","content":"..."}]` (les messages input) au lieu du contrat genere.

### Fixes appliques (session courante)
1. **ExtractResponseText** : ordre de priorite change — `contractJson`/`testSuiteJson`/`blockJson` EN PREMIER, avant `content`/`result`/`response`
2. **workingDir** : resolution du project root (remonte les dossiers jusqu'a trouver `content/system/`)
3. **outputDir** : utilise workingDir au lieu de GetCurrentDirectory()
4. **Copie variables** : context.Variables → execResult.Outputs pour les cles de workflow
5. **set-initial nodes** : `set-initial-suite` et `set-initial-contract` ajoutees AVANT le conditionnel pour garantir que la variable est toujours set
6. **Contrats enrichis** : 12 + 9 + 11 = 32 tests (avant: 5 + 4 + 3 = 12)

### Probleme BLOQUANT identifie
**Les workflows contract-definer et test-designer retournent les messages input au lieu du resultat de l'inference.**

La reponse du contract-definer pour le prompt "A greeting agent..." est :
```
[{"role":"user","content":"A greeting agent that says hello..."}]
```
C'est le `messages` input du node inference, pas son output. Le `blockRef: inference` node dans un workflow simple (pas un agent avec boucle) ne produit pas `_nodeResult_generate-contract.content` correctement.

**Hypothese** : L'inference block (LLMBlockExecutorBase) attend peut-etre des inputs specifiques (`messages` comme JSON array, `systemPrompt`, etc.) et le workflow ne les passe pas dans le bon format. Le messages input est un string literal `"[{\"role\":\"user\",...}]"` qui peut ne pas etre parse correctement.

## 64-F: PAS COMMENCE (depend de 64-D/G)
## 64-T: PAS COMMENCE

---

## Handoff

**Derniere action** : Multiples iterations de debug. Block-creator fonctionne (8/11). Contract-definer et test-designer bloquent sur l'inference node.
**Prochaine action** :
1. **DEBUG PRIORITAIRE** : Comprendre pourquoi `blockRef: inference` dans un workflow retourne les inputs au lieu du resultat LLM
   - Lire `NodeExecutionEngine` et `BlockRefHandler` pour comprendre comment les inputs sont passes au block inference
   - Lire `LLMBlockExecutorBase` / `InferenceBlockExecutor` pour comprendre comment `messages` est parse
   - Tester un appel inference direct via l'API pour confirmer que le provider fonctionne
   - Possible probleme : le `messages` input est un string JSON literal au lieu d'un array parse
2. Fixer l'inference dans les workflows
3. Re-runner les 3 workflows
4. Block-forge E2E
**Etat du build** : compile, 0 erreurs
**Branche** : `phase-64-workflow-pipeline`

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
