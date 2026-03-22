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

### Probleme BLOQUANT — RESOLU (2026-03-20)

**Symptome** : Les workflows contract-definer et test-designer retournaient `[{"role":"user","content":"..."}]` (le conversationHistory input) au lieu du resultat de l'inference.

**Root cause — 2 bugs identifies et fixes** :

**BUG 1 (InferenceBlockExecutor)** : Quand `inputs["messages"]` etait fourni, le `systemPrompt` du config etait IGNORE. Le LLM recevait seulement le user message sans contexte (pas de system prompt expliquant ce qu'est un contrat Maestro, quel format utiliser, etc.). Resultat : reponse garbage ou vide.
- **Fix** : Prepend `ChatMessage.System(systemPrompt)` aux messages si aucun system message n'existe deja.

**BUG 2 (WorkflowBlockExecutor)** : `ExtractResultAsync` retournait TOUTES les variables de session comme outputs (y compris `conversationHistory`, `prompt`, `message`). Quand le vrai output (`contractJson`) n'etait pas set (parce que le workflow s'arretait a write-contract apres l'inference garbage), `ExtractResponseText` tombait sur Priority 3 (longest non-underscore output) = `conversationHistory`.
- **Fix** : Filtrer les outputs — exclure les cles d'input bruit (`prompt`, `message`, `conversationHistory`, `sessionId`, etc.) et les variables systeme internes.

**Build** : 0 erreurs, 34 tests unitaires passent.

**CONTRACT-DEFINER** : 12/12, performance 1.0, fitness 0.135, cost $2.57/run.

### Bugs supplementaires trouves et fixes pendant les tests

**BUG 3 (Write*BlockExecutors)** : `JsonDocument.Parse` echouait sur le output LLM qui contient des code fences markdown (` ```json...``` `). Fix : strip fences via `LLMBlockExecutorBase.ExtractJson()` avant parsing dans WriteContractBlockExecutor, WriteTestSuiteBlockExecutor, WriteBlockBlockExecutor.

**BUG 4 (SetVariableNodeHandler)** : Auto-parse JSON destructif. Quand la valeur est un JSON object (ex: contract), le handler parsait en JObject et `TryUnwrapJObjectToList` extrayait le premier array (ex: `requiredCapabilities`) au lieu de garder l'objet complet. `.ToString()` sur `List<object>` retournait le nom du type C#. Fix : stocker toujours les valeurs comme strings (le JSON parsing est destructif pour le contenu workflow).

**BUG 5 (ContractTestRunner.ExtractResponseText)** : `.ToString()` sur `List<object>` et `JObject` retournait les noms de types C# au lieu du JSON. Fix : `SerializeOutputValue()` qui serialise proprement les types non-string.

**BUG 6 (WorkflowBlockExecutor.ExtractResultAsync)** : Retournait TOUTES les variables de session comme outputs. Fix : filtrer les cles d'input bruit et les variables systeme internes.

**BUG 7 (MaestroClient timeout)** : Default 30s trop court pour les workflows. Fix : augmente a 600s (10 min).

## 64-F: PAS COMMENCE (depend de 64-D/G)
## 64-T: PAS COMMENCE

---

## Handoff

**Derniere action** : Debug et fix des 2 bugs bloquants. Build OK, unit tests OK.
**Prochaine action** :
1. Relancer les services (backend + LLM provider)
2. Tester l'inference directement via l'API pour confirmer que le systemPrompt est bien inclus
3. Re-runner les 3 contract tests (contract-definer, test-designer, block-creator)
4. Viser >= 70% sur chacun
5. Block-forge E2E (64-F)
**Etat du build** : compile, 0 erreurs
**Branche** : `phase-64-workflow-pipeline`

## Fichiers modifies (cumul toutes sessions)
- `apps/backend/src/Maestro.Infrastructure/Testing/ContractTestRunner.cs` (check types + helpers + Maestro tools mapping)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ResponseParserBlockExecutor.cs` (short JSON array fix)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/InferenceBlockExecutor.cs` (systemPrompt + messages fix)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/WorkflowBlockExecutor.cs` (output filtering fix)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/CaptureGenericBlockExecutor.cs` (NEW)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/SummaryValidatorBlockExecutor.cs` (NEW)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolDispatcherBlockExecutor.cs` (_toolMapping + _lastDispatchedToolId)
- `apps/backend/src/Maestro.Api/Program.cs` (DI registrations)
- `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/CaptureBlockTests.cs` (20+ tests)
- `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` (totalArgLength fix)
- `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` (ClaudeCode priority)
- `content/system/blocks/tools/capture-generic/` (NEW)
- `content/system/blocks/tools/summary-validator/` (NEW)
- `content/system/blocks/workflows/contract-definer/` (workflow block.json)
- `content/system/blocks/workflows/test-designer/` (workflow block.json)
- `content/system/blocks/workflows/block-creator/` (workflow block.json)
- `content/system/blocks/system/maestro-assistant/` (block.json + system-prompt.md modified)
- `content/system/contracts/test-designer.contract.json` (v2.0 rewrite)
- `content/system/contracts/maestro-assistant.contract.json` (multi-turn fixes)
- `content/system/contracts/block-forge.contract.json` (2 tests added)
- `content/system/contracts/contract-definer.contract.json` (NEW)
- `docs/phases/PHASE-64/README.md` (major rewrite)
