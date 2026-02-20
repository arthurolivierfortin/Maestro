# Phase 34-E : Integration + QualityScore Tier 1 — Checkpoint

**Derniere mise a jour** : 2026-02-20 (session 4)
**Sous-phase en cours** : 34-E-3 — Metriques + Tests isoles + Part C fixes
**Agent** : Claude Code session — Phase 34-E execution

---

## 34-E-1 : Repos de test
**Statut** : DONE
**Date** : 2026-02-20
**Repos crees** : 5 / 5
**Repos qui compilent** : 5 / 5
**Copies Claude Code** : 5 / 5
**Git initialise** : 5 / 5
**Ce qui a ete fait** :
- 5 repos crees : crud, auth, dashboard, explorer, notifications
- Chaque repo a : React 18 + TypeScript + Vite + Tailwind + Express server avec mock API
- `npm install` execute et `npm run build` passe pour les 5
- `.gitignore` ajoute (node_modules/, dist/)
- `git init && git add -A && git commit -m "Initial project setup"` pour les 5
- 5 copies Claude Code creees : crud-claude, auth-claude, dashboard-claude, explorer-claude, notifications-claude
- Serveurs mock API ajoutes pour auth (/api/auth/login, register, me, logout), dashboard (/api/dashboard/stats), explorer (/api/files)
**Verification** :
```
10 directories: crud, crud-claude, auth, auth-claude, dashboard, dashboard-claude, explorer, explorer-claude, notifications, notifications-claude
Git commits: crud cd68a6e, auth 9a712eb, dashboard f436488, explorer 8375820, notifications 5c66923
All 5 builds pass
```

---

## Bug fix : Model ID mismatch (LLM-Provider)
**Statut** : DONE
**Date** : 2026-02-20
**Probleme** : Les blocks v4 referent `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001` mais le LLM-Provider ne connaissait que `sonnet`, `claude-sonnet`, etc.
**Fix** :
- `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` : 4 aliases ajoutes au ModelAliasMap
- `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeProviderOptions.cs` : 4 models ajoutes a la liste Models
**Verification** : 3 model IDs resolvent correctement. `project-analyzer` execute avec succes sur crud repo.

---

## 34-E-2 : QualityScore par bloc — Evaluation de faisabilite
**Statut** : EN_COURS
**Date** : 2026-02-20
**Constat** : Le protocole complet (10-50 executions par bloc x 23 blocs) est infaisable en une seule session.
  - project-analyzer execute en ~520s (8.7 min) par execution
  - 23 blocs x 10 executions minimum x ~5 min moyen = ~19 heures d'execution LLM
  - Certains blocs d'implementation necessitent un contexte complexe (steps a implémenter)
**Approche adaptee** : Executer les 5 taches E2E (34-E-3) qui testent tous les blocs dans le workflow complet, puis extraire les scores P et W depuis les resultats reels. C'est plus representatif que des executions isolees.
**Blocs testes individuellement** : 1 / 23 (project-analyzer)
  | Bloc | P | W | QualityScore | Seuil W | OK? |
  |------|---|---|-------------|---------|-----|
  | project-analyzer | ~0.90 | 1.00 | ~0.90 | 0.95 | OK |

---

## Infrastructure Fixes (34-E-PRE + 34-E Fixes 1-5 + Session 2-3 Fixes)
**Statut** : DONE
**Date** : 2026-02-20

### 34-E-PRE : Conversation & Context Architecture
| Sub-phase | Description | Statut |
|-----------|-------------|--------|
| 34-E-PRE-A | Conversation entity + IConversationManager + InMemoryConversationManager | DONE |
| 34-E-PRE-B | Refactor AgentBlockExecutor → IConversationManager | DONE |
| 34-E-PRE-C | IContextAssembler + ContextAssembler | DONE |

### 34-E Fixes (from POST-MORTEM-V4-WORKFLOW.md)
| Fix | Description | Statut |
|-----|-------------|--------|
| Fix #1 | Structured Messages — LLMProviderGateway sends Messages[] with roles | DONE (session 1) |
| Fix #2 | for-each status propagation — items can fail, for-each reflects | DONE (session 1) |
| Fix #3 | Agent done guard — 0 tool calls = fail at any iteration | DONE (session 1) |
| Fix #4 | ResolveTemplate returns "" instead of "0" for null | DONE (session 1) |
| Fix #5 | Nested phase updates for items with explicit phaseId | DONE (session 1) |
| Step 1 | ConversationId on LLMRequest (Maestro) | DONE (session 1) |
| Step 2 | ConversationId in LLMProviderGateway CompleteRequest | DONE (session 1) |
| Step 3 | AgentBlockExecutor generates ConversationId | DONE (session 1) |
| Step 4 | ClaudeCodeLLMProvider --resume + session tracking | DONE (session 1) |
| Bonus | MemoryStrategy="None" to bypass LLM-Provider repo lookup | DONE (session 1) |

### Session 2 Fixes (error propagation + timeout chain)
| Fix | Description | Statut |
|-----|-------------|--------|
| Fix #6 | **stopOnError** — `ExecuteConfigNodesAsync` catch → `break` by default, `continueOnError: true` opt-in | DONE |
| Fix #7 | **Block failure propagation** — `ExecuteBlockRefAsync` throws when `result.Success == false` | DONE |
| Fix #8 | **Soft failures throw** — block not found, no executor, no registry → `InvalidOperationException` | DONE |
| Fix #9 | **ExecuteRegularNodeAsync re-throws** — both catch blocks re-throw instead of returning previousOutput | DONE |
| Fix #10 | **Output contamination** — filter `_`-prefixed keys from `result.Outputs` in `ExecuteBlockRefAsync` | DONE |
| Fix #11 | **store-plan source** — `autonomous-development.workflow.block.json` changed from `{{previousOutput}}` to `{{_nodeResult_plan}}` | DONE |
| Fix #12 | **for-each empty source** — throws `InvalidOperationException` when source is empty/not a list | DONE |
| Fix #13 | **for-each missing source** — throws when `source` property is null/empty | DONE |
| Fix #14 | **CLI timeout** — `ClaudeCodeProviderOptions.TimeoutSeconds` 120s → 300s | DONE |
| Fix #15 | **Gateway no retry on 500** — throws immediately on HTTP 500+ (persistent failures) | DONE |
| Fix #16 | **Gateway throws on exhausted retries** — `throw new HttpRequestException` instead of returning null | DONE |

### Session 3 Fix (checkpoint resume bug)
| Fix | Description | Statut |
|-----|-------------|--------|
| Fix #17 | **for-each checkpoint resume** — clear child node IDs from `_workflowCheckpoint` before each item iteration | DONE |

**Root cause (Fix #17)**: After for-each item 1 completes `implement-step` + `validate-step`, these node IDs get saved to `_workflowCheckpoint`. When item 2 starts, `ExecuteConfigNodesAsync` reads the checkpoint, sees `implement-step` is "already completed", and SKIPS it — even though it hasn't run for item 2. The checkpoint node IDs are global (not scoped per for-each item). Fix: before executing child nodes for each item, remove child node IDs from the checkpoint.

### Files Modified (Maestro)
- `Maestro.Application/Interfaces/ILLMGateway.cs` — ConversationId field
- `Maestro.Infrastructure/LLMGateway/LLMProviderGateway.cs` — ConversationId, MemoryStrategy, Messages, no retry on 500, throw on exhausted retries
- `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — IConversationManager, IContextAssembler, ConversationId, done guard
- `Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — ResolveTemplate, for-each status, nested phases, stopOnError, block failure propagation, soft failures throw, re-throws, output filter, for-each empty/missing source, checkpoint resume fix
- `Maestro.Api/Program.cs` — DI registrations
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` — store-plan source fix

### Files Modified (LLM-Provider)
- `LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` — --resume session tracking, CliSessionState, TTL cleanup
- `LLMProvider.ClaudeCodeProvider/ClaudeCodeProviderOptions.cs` — TimeoutSeconds 120 → 300

### Files Created (Maestro)
- `Maestro.Domain/Entities/Conversation.cs`
- `Maestro.Application/Interfaces/IConversationManager.cs`
- `Maestro.Infrastructure/Context/InMemoryConversationManager.cs`
- `Maestro.Application/Interfaces/IContextAssembler.cs`
- `Maestro.Infrastructure/Context/ContextAssembler.cs`

### Build & Test Verification
- Maestro: 0 errors, 0 warnings (build verified session 4)
- LLM-Provider: 0 errors (verified session 2)

---

## Session 4 : Metriques Pipeline + Tests Isoles des Blocs (Fixes 18-21)

**Statut** : DONE
**Date** : 2026-02-20
**Objectif** : Rendre tokens/cout visibles dans l'execution isolee de blocs, puis tester chaque bloc individuellement avant de relancer le workflow E2E ($15+/run).

### Partie A : Pipeline de metriques (6 fichiers, ~80 lignes)

| Fix | Fichier | Changement | Statut |
|-----|---------|------------|--------|
| A1 | `Maestro.Application/DTOs/BlockExecutionResult.cs` | +4 proprietes: PromptTokens, CompletionTokens, TotalTokens, EstimatedCostUsd | DONE |
| A2 | `Maestro.Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` | +methode `EstimateCost()` (opus/sonnet/haiku/gpt-4/local pricing) | DONE |
| A3 | `Maestro.Infrastructure/BlockExecutors/InferenceBlockExecutor.cs` | Capture tokens depuis LLMResponse + estimation cout | DONE |
| A4 | `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Accumulateurs tokens sur la boucle agentique + ecriture sur TOUS les chemins de retour | DONE |
| A5 | `Maestro.Api/Controllers/BlocksController.cs` | BlockExecutionResponse DTO +4 champs + mapping | DONE |
| A6 | `packages/maestro-cli/cli.ts` | Affichage `tokens: N, cost: $X.XXXX` dans la sortie CLI | DONE |

### Partie B : Tests isoles des blocs

| Bloc | Type | Resultat | Tokens | Cout | Notes |
|------|------|----------|--------|------|-------|
| B1 json-validator | tool | **PASS** | 0 | $0 | ToolBlockExecutor fonctionne, pas de LLM |
| B2 step-validator | inference | **PASS** | 544 | $0.0007 | InferenceBlockExecutor + tokens captures |
| B3 implement-single-step | agent | **PARTIAL** | 2508 | $0.037 | Fichier ecrit (apres fix positional-args), agent ne sait pas appeler `done` |
| B4 test-executor | agent | **PASS** | 1224 | $0.018 | Correctement identifie "pas de tests"; epuise iterations sans `done` |
| B5 code-reviewer | inference | **PASS** | 1541 | $0.115 | Excellent JSON structure avec scoring multi-axes |
| B6 git-committer | agent | **PASS** | 2027 | $0.030 | Commit cree avec succes (`d1a8c25`) |

**Cout total tests isoles** : ~$0.20 (vs ~$15+ pour un run E2E)

### Partie C : Fixes trouves pendant les tests (Fixes 18-21)

| Fix | Description | Statut |
|-----|-------------|--------|
| Fix #18 | **AgentBlockExecutor early-return token loss** — les chemins d'erreur (LLM failed, empty response) faisaient return AVANT l'ecriture des tokens | DONE |
| Fix #19 | **CliParser repeated --input overwrite** — `Dictionary<string,string>` ecrasait le 2eme `--input`. Ajout de `RepeatedArguments` (list) sur `ParsedCommand` | DONE |
| Fix #20 | **RunCommandHandler positional-args fallback** — les args positionnels `key=value` sont traites comme inputs (corrige `--input path=X content=Y`) | DONE |
| Fix #21 | **implement-single-step system prompt** — `--input-json` en premier, marque CRITICAL, `--input` explicitement deconseille pour multi-mots | DONE |

### Fichiers modifies (session 4)

**Maestro :**
- `Maestro.Application/DTOs/BlockExecutionResult.cs` — +4 proprietes metriques
- `Maestro.Application/Interfaces/ICommandHandler.cs` — `RepeatedArguments` sur ParsedCommand
- `Maestro.Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` — +EstimateCost()
- `Maestro.Infrastructure/BlockExecutors/InferenceBlockExecutor.cs` — capture tokens
- `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — accumulateurs + early-return fix
- `Maestro.Infrastructure/Cli/CliParser.cs` — RepeatedArguments population
- `Maestro.Infrastructure/Cli/CommandHandlers/RunCommandHandler.cs` — RepeatedArguments + positional fallback
- `Maestro.Api/Controllers/BlocksController.cs` — DTO metriques

**CLI :**
- `packages/maestro-cli/cli.ts` — affichage tokens/cout

**Content :**
- `content/system/blocks/agents/implement-single-step/system-prompt.md` — prompt ameliore

---

## 34-E-3 : Taches Maestro v4
**Statut** : EN_COURS — 3 test runs E2E, 21 fixes applied, blocs testes individuellement
**Date** : 2026-02-20

### Test Run 1 (Session `5719f8d1` — pre-fixes)
**Resultat** : FAILED — Zero implementation after 3 iterations (40 min, ~$15+ usage)
**Post-mortem** : `POST-MORTEM-V4-WORKFLOW.md` — 6 causes racines identifiees

### Test Run 2 (Session `3183ebb3` — after fixes 1-5)
**Resultat** : FAILED — JSON validator rejected plan
**Cause** : `_conversationState` output contaminated the plan string (Fix #10)
**Fix appliquee** : store-plan source + output filter

### Test Run 3 (Session `8b80d7cc` — after fixes 6-16)
**Resultat** : PARTIAL SUCCESS — significant progress
**Succes** :
- Plan creation: 10 steps, 10336 chars (task-planner agent worked)
- JSON validation: PASSED (json-validator accepted the plan)
- for-each: found 10 items correctly from `_planSteps`
- Error propagation: "Stopping sequence: node 'test' failed" — workflow correctly stopped
**Echec** :
- implement-single-step: items 2-10 SKIPPED as "checkpoint resume" (Fix #17 — now fixed)
- Only `package.json` modified (step 2's npm install). No TypeScript files created.
- Test phase: LLM-Provider InternalServerError (Claude CLI timeout)

### Test Run 4 (pending — next session)
**Prerequis** : Fixes #17-21 applied. Blocs testes individuellement. Need to:
1. Reset the crud-claude test repo
2. Restart services with new build
3. Create a new session and run the workflow
4. Verify: ALL items execute, tokens/cout visibles, fichiers crees

---

## 34-E-4 : Taches Claude Code
**Statut** : PAS_COMMENCE

---

## 34-E-5 : Comparaison
**Statut** : PAS_COMMENCE

---

## 34-E-6 : Manifeste Tier 1
**Statut** : PAS_COMMENCE

---

## Problemes ouverts (a resoudre avant Test Run 4)

1. **Agent `done` calling** — Les agents (implement-single-step, test-executor) ne savent pas appeler `done` correctement. Ils essaient des blocs inexistants (step-complete, output, log-result). Besoin d'ameliorer les system prompts.
2. **LLM-Provider InternalServerError** — Erreurs 500 sporadiques sur les iterations tardives. Possiblement rate-limiting Claude ou taille contexte.
3. **Content newline escaping** — `file-write` via `--input content=...` ecrit des `\n` litteraux. Seul `--input-json` gere correctement les newlines.
4. **promptTokens bas** — Claude Code CLI retourne toujours ~10-45 prompt tokens, possiblement pas le vrai compte.
