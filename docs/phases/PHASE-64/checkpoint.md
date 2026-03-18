# Phase 63 Checkpoint (anciennement Phase 62)

**Last update**: 2026-03-18
**Agent**: Claude Opus 4.6
**Note**: Cette phase etait la Phase 62 jusqu'au 2026-03-18. Renumerotee pour inserer la Phase 62 (Container Isolation).

---

## Changements effectues dans la nouvelle Phase 62

Durant le travail sur cette phase, un probleme de securite fondamental a ete decouvert dans `ToolDispatcherBlockExecutor` : les tool calls des agents n'etaient pas filtrees par les permissions de la session. Ceci violait le modele container (session = Docker container isole) qui est LA logique fondamentale de Maestro.

**Fichiers modifies pour la Phase 62 (container isolation)** :
1. `ToolDispatcherBlockExecutor.cs` — ajout de `CheckToolPermission()` (2 couches : BlockPermission rules + AllowedBlocks whitelist). Fail-closed : si permissions absentes du context, le tool est refuse.
2. `BlockRefHandler.cs` — `BuildExecutionContext` propage maintenant `_permissions_allowedBlocks` et `_permissions_blockRules` dans le context d'execution.
3. `ToolDispatcherPermissionTests.cs` — 36 tests couvrant les permissions (created in Phase 62).

**Impact sur la reprise de Phase 63** :
- Le bug `capabilities-declared` (agent loop sur `json-validator`) est potentiellement corrige — le tool sera refuse par les permissions au lieu d'etre execute.
- Lors de la reprise, configurer le `ContractTestRunner` pour definir `AllowedBlocks` dans les sessions de test (seuls les tools mappes + step-complete).
- Les tests existants de 63-A et 63-B ne sont pas affectes (ils ne testent pas les permissions).

---

## 63-A (ex 62-A): DONE
- `_toolMapping` in ToolDispatcherBlockExecutor — redirects tools to mock/capture blocks
- 4 capture blocks created: capture-file-write, capture-file-read, capture-file-edit, capture-shell-execute
- Each capture block has its own executor + block.json (everything is a block)
- CaptureHelper shared utility for reading/writing `_capturedToolCalls`
- ContractTestRunner injects `_toolMapping` for agent blocks
- `tool-call` check type updated to read `_capturedToolCalls`
- 15 new tests, all pass
- Build: 0 errors

## 63-B (ex 62-B): DONE
- ProviderPriorityOptions + persistence to `provider-priority.json`
- `GET /api/v1/providers/conflicts` — detects model conflicts across providers
- `PUT /api/v1/providers/priority` — user sets preferred provider per model
- `GetProviderForModelAsync` checks configured priority first, falls back to first available
- 11 new tests, all pass

## 63-C (ex 62-C): IN PROGRESS — 6/9 tests passing

### What was done
1. **System prompt condensed**: 994 → 317 lines (68% reduction)
2. **THINK/ACTION ReAct-style format**: All 19 agent system prompts updated
3. **Fresh session per test**: ContractTestRunner creates new ProjectSession per agent test
4. **`_toolMapping` propagation fixed**: context → session → BlockRefHandler.BuildExecutionContext
5. **Loop detection refined**: Composite key `toolId:argsHash`
6. **Temperature**: 0 → 0.2
7. **Context window**: `maxTokens` 4096 → 16384, `keepLastN` 8 → 10
8. **Cost limit fix**: Cost limit propagation was blocking tool execution

### Contract test results (latest — 2026-03-17 evening)
- **Fitness**: 0.0360 (performance 0.68)
- **Passed**: 6/9
- **Duration**: ~5min
- **Cost**: ~$0.50

| Test | Status | Notes |
|------|--------|-------|
| diagnose-failure | **PASS** | Conversational |
| adapt-for-smaller-model | **PASS** | Conversational |
| preserve-contract-compliance | **PASS** | Conversational |
| iterative-improvement (x2) | **PASS** | 100% |
| model-adaptation (x2) | **PASS** | 100% |
| prompt-writing (1/2) | **PASS** | |
| valid-block-json | FAIL | Check verifies summary instead of `_capturedToolCalls` |
| capabilities-declared | FAIL | Agent loops on `json-validator` — should be fixed by Phase 62 permission enforcement |
| system-prompt-structure | FAIL | Check verifies summary instead of `_capturedToolCalls` |

### Comment reprendre 63-C
1. Finir les tests de permissions de Phase 62 (en cours, voir Phase 62 checkpoint)
2. Configurer ContractTestRunner pour definir `AllowedBlocks` dans les sessions de test
3. Mettre a jour les check types `json-parseable` et `contains-all` pour lire `_capturedToolCalls`
4. Re-runner les contract tests → target 9/9 pass

## 63-D (ex 62-D): NOT STARTED (Live execution view)
## 63-T (ex 62-T): NOT STARTED (Tests + validation)
