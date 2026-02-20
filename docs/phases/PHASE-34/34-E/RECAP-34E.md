# Phase 34-E : Recap complet

**Date** : 2026-02-20
**Duree** : 4 sessions Claude Code
**Branche** : main

---

## Objectif initial

Phase 34-E devait :
1. Creer des repos de test pour les taches E2E
2. Calculer les QualityScores par bloc (P = precision, W = taux utilisation)
3. Executer 5 taches E2E avec le workflow v4 `autonomous-development`
4. Comparer Maestro v4 vs Claude Code natif
5. Publier un manifeste Tier 1

## Ce qui s'est passe

Le workflow v4 ne fonctionnait pas. Les 4 sessions ont ete principalement consacrees a corriger l'infrastructure pour que le workflow puisse s'executer correctement.

---

## Session 1 : Repos de test + Structured Messages (Fixes 1-5)

### Repos de test (34-E-1)
- 5 repos crees : crud, auth, dashboard, explorer, notifications
- Stack : React 18 + TypeScript + Vite + Tailwind + Express mock API
- 5 copies `-claude` pour les tests destructifs
- Tous buildent et ont un commit initial

### Architecture Conversation & Contexte (34-E-PRE)
- `IConversationManager` + `InMemoryConversationManager` — gestion conversations multi-turn
- `IContextAssembler` + `ContextAssembler` — assemblage contexte avec strategies (sliding-window)
- `AgentBlockExecutor` refactorise pour utiliser ces interfaces

### Fixes infrastructure (1-5)
| # | Fix |
|---|-----|
| 1 | Structured Messages — `LLMProviderGateway` envoie `Messages[]` avec roles |
| 2 | for-each propage le statut d'erreur des items |
| 3 | Agent done guard — 0 tool calls = echec |
| 4 | `ResolveTemplate` retourne `""` au lieu de `"0"` pour null |
| 5 | Nested phase updates pour items avec `phaseId` explicite |

### Multi-turn via `--resume`
- `ConversationId` ajoute a `LLMRequest` (Maestro → LLM-Provider)
- `ClaudeCodeLLMProvider` : session tracking + `--resume` pour tours suivants
- `MemoryStrategy="None"` pour bypass lookup conversation LLM-Provider

### Test Run 1 : FAILED
- 0 implementation apres 3 iterations, ~40 min, ~$15+
- Post-mortem : 6 causes racines identifiees

### Test Run 2 : FAILED
- JSON validator rejette le plan car `_conversationState` contamine la sortie

---

## Session 2 : Error Propagation (Fixes 6-16)

### Fixes error propagation & timeout
| # | Fix |
|---|-----|
| 6 | `stopOnError` — `ExecuteConfigNodesAsync` break par defaut |
| 7 | Block failure propagation — throw quand `result.Success == false` |
| 8 | Soft failures throw — block not found, no executor → exception |
| 9 | `ExecuteRegularNodeAsync` re-throws au lieu de retourner previousOutput |
| 10 | Output contamination — filtre cles `_`-prefixees |
| 11 | store-plan source — `{{_nodeResult_plan}}` au lieu de `{{previousOutput}}` |
| 12 | for-each empty source → throw |
| 13 | for-each missing source → throw |
| 14 | CLI timeout — 120s → 300s |
| 15 | Gateway no retry on 500 — throw immediatement |
| 16 | Gateway throws on exhausted retries |

### Test Run 3 : PARTIAL SUCCESS
- Plan creation : 10 steps, 10336 chars ✓
- JSON validation : PASSED ✓
- for-each : 10 items trouves ✓
- Error propagation fonctionne ✓
- **Mais** : items 2-10 SKIPPED (bug checkpoint resume)

---

## Session 3 : Checkpoint Resume Fix (Fix 17)

| # | Fix |
|---|-----|
| 17 | for-each checkpoint resume — clear child node IDs avant chaque item |

**Root cause** : Apres item 1 complete `implement-step` + `validate-step`, ces IDs sont sauves dans `_workflowCheckpoint`. Item 2 voit ces IDs et SKIP les noeuds comme "deja completes".

---

## Session 4 : Metriques + Tests Isoles (Fixes 18-21)

### Pipeline de metriques
- `BlockExecutionResult` : +4 champs (PromptTokens, CompletionTokens, TotalTokens, EstimatedCostUsd)
- `LLMBlockExecutorBase.EstimateCost()` : pricing par modele (opus $15/$75M, sonnet $3/$15M, haiku $0.80/$4M, local $0)
- `InferenceBlockExecutor` : capture tokens depuis `LLMResponse`
- `AgentBlockExecutor` : accumulateurs sur la boucle agentique, ecriture sur TOUS les chemins de retour
- `BlocksController` : DTO metriques dans la reponse API
- CLI : affichage `✓ Executed in 12345ms | tokens: 3456, cost: $0.0234`

### Tests isoles des blocs (cout total ~$0.20)

| Bloc | Type | Resultat | Tokens | Cout |
|------|------|----------|--------|------|
| json-validator | tool | **PASS** | 0 | $0 |
| step-validator | inference | **PASS** | 544 | $0.0007 |
| implement-single-step | agent | **PARTIAL** | 2508 | $0.037 |
| test-executor | agent | **PASS** | 1224 | $0.018 |
| code-reviewer | inference | **PASS** | 1541 | $0.115 |
| git-committer | agent | **PASS** | 2027 | $0.030 |

### Fixes supplementaires

| # | Fix |
|---|-----|
| 18 | AgentBlockExecutor early-return token loss — tokens ecrits avant tous les `return` |
| 19 | CliParser repeated `--input` overwrite — `RepeatedArguments` list sur ParsedCommand |
| 20 | RunCommandHandler positional-args fallback — `key=value` positionnels traites comme inputs |
| 21 | implement-single-step system prompt — `--input-json` en premier, `--input` deconseille |

---

## Bilan quantitatif

### Fixes appliques : 21

| Categorie | Nombre |
|-----------|--------|
| Structured messages / multi-turn | 5 (fixes 1-5 + --resume) |
| Error propagation | 11 (fixes 6-16) |
| Checkpoint resume | 1 (fix 17) |
| Metriques + CLI parsing | 4 (fixes 18-21) |

### Fichiers modifies : ~20

**Maestro backend (10) :**
- `Maestro.Application/Interfaces/ILLMGateway.cs`
- `Maestro.Application/Interfaces/ICommandHandler.cs`
- `Maestro.Application/DTOs/BlockExecutionResult.cs`
- `Maestro.Infrastructure/LLMGateway/LLMProviderGateway.cs`
- `Maestro.Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs`
- `Maestro.Infrastructure/BlockExecutors/InferenceBlockExecutor.cs`
- `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs`
- `Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
- `Maestro.Infrastructure/Cli/CliParser.cs`
- `Maestro.Infrastructure/Cli/CommandHandlers/RunCommandHandler.cs`
- `Maestro.Api/Controllers/BlocksController.cs`
- `Maestro.Api/Program.cs`

**Fichiers crees (3) :**
- `Maestro.Domain/Entities/Conversation.cs`
- `Maestro.Application/Interfaces/IConversationManager.cs` + `IContextAssembler.cs`
- `Maestro.Infrastructure/Context/InMemoryConversationManager.cs` + `ContextAssembler.cs`

**LLM-Provider (2) :**
- `LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs`
- `LLMProvider.ClaudeCodeProvider/ClaudeCodeProviderOptions.cs`

**Content (2) :**
- `content/system/blocks/workflows/autonomous-development.workflow.block.json`
- `content/system/blocks/agents/implement-single-step/system-prompt.md`

**CLI (1) :**
- `packages/maestro-cli/cli.ts`

### Tests E2E : 3 runs

| Run | Resultat | Cout estime |
|-----|----------|-------------|
| 1 | FAILED (0 implementation) | ~$15+ |
| 2 | FAILED (output contamination) | ~$5 |
| 3 | PARTIAL (plan OK, for-each OK, checkpoint bug) | ~$10 |

### Tests isoles : 6 blocs testes

Cout total : ~$0.20 — **75x moins cher** qu'un run E2E

---

## Etat actuel et prochaines etapes

### Ce qui fonctionne
- Plan creation (task-planner agent) ✓
- JSON validation (json-validator tool) ✓
- for-each decomposition (10 items) ✓
- Error propagation dans le workflow ✓
- step-validator (inference) ✓
- code-reviewer (inference, opus) ✓
- git-committer (agent, commit cree) ✓
- Metriques tokens/cout visibles dans API + CLI ✓
- Multi-turn conversations via --resume ✓

### Ce qui ne fonctionne pas encore
1. **implement-single-step** ne sait pas ecrire des fichiers de maniere fiable via `file-write`
   - Cause : le LLM ignore `--input-json` et utilise `--input content=...` qui casse sur les espaces
   - Fix partiel : positional-args fallback aide, mais le contenu a des `\n` litteraux
2. **Agents ne savent pas appeler `done`** — essaient des blocs inexistants
3. **InternalServerError sporadiques** sur les iterations tardives
4. **promptTokens** toujours bas (~10-45) car Claude CLI ne rapporte pas le vrai compte

### Prochaine session (34-E-3 Run 4)
1. Ameliorer le system prompt implement-single-step pour forcer `--input-json`
2. Fixer le `done` calling dans les prompts agents
3. Run 4 du workflow E2E avec toutes les fixes
4. Si Run 4 passe → 34-E-4 (taches Claude Code) → 34-E-5 (comparaison) → 34-E-6 (manifeste)
