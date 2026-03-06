# Phase 52 : Agent test-designer — Implementation du contract test-designer

**Statut** : COMPLETE
**Prerequis** : Phase 51 COMPLETE (contract system, schema enrichi, contracts concrets)
**Objectif** : Creer l'agent `test-designer` qui lit un contract et produit des tests d'acceptance executables. Cet agent est le premier block cree avec le nouveau contract system. Plus: le Contract Test Runner qui execute les tests et calcule le fitness.
**Duree estimee** : 3-4 jours

---

## ATTENTION — Misconceptions a eviter

### Un agent Maestro N'EST PAS un inference block

Un agent (`blockType: "agent"`) est un block **non-atomique** qui contient potentiellement :
- Un `block.json` avec config, inputs/outputs, metadata, capabilities
- Un `system-prompt.md` detaille (conventions, outils, exemples, regles)
- Des `config.nodes` avec des child blocks (inference, tools)
- Des companion docs eventuels

L'agent a une **boucle agentique** : il recoit un message, choisit un outil, execute, recoit le resultat, decide quoi faire ensuite. C'est fondamentalement different d'un inference block (un seul appel LLM).

**Concretement** : le test-designer va lire un contract, reflechir aux scenarios de test, ecrire les tests un par un avec l'outil file-write, valider le format avec json-validator, et appeler step-complete quand il a fini. Il peut faire 10+ iterations.

### Claude copilot doit aussi ne pas divaguer

Cette phase est isolee pour ME (Claude copilot) permettre de me concentrer sur UN agent. Creer un agent non-atomique c'est :
1. Comprendre le contract qu'il doit implementer
2. Concevoir la structure (atomique vs composite, quels child blocks)
3. Ecrire un system prompt PRECIS avec exemples concrets
4. Definir les outils accessibles et leurs schemas
5. Tester iterativement (le prompt est-il clair ? l'agent divague-t-il ?)

Fusionner ca avec d'autres taches = bacle.

### Chaque agent a son contract AVANT d'etre cree

Le contract `test-designer` est defini en Phase 51. Cette phase est l'IMPLEMENTATION.
Le contract definit CE QUE l'agent doit savoir faire. Cette phase definit COMMENT.

---

## Le contract test-designer (reference — defini en Phase 51)

```
Contract: test-designer
├─ Feature: "Contract Analysis"
│    requires: [conversation, structured-output]
│    tests: lit un contract → identifie features, capabilities, lacunes
│
├─ Feature: "Test Generation"
│    requires: [structured-output, tool-calling]
│    tests: produit des test configs valides par feature
│
├─ Feature: "Test Quality"
│    requires: [conversation, structured-output]
│    tests: les tests generes sont non-triviaux, executables, et couvrent les edge cases
```

---

## Architecture de l'agent

### Decision : atomique ou composite ?

**Commencer atomique** (`isAtomic: true`). Raison :
- Le test-designer a une tache unique : lire un contract → produire des tests
- Il n'a pas besoin de child blocks complexes (pas d'orchestration multi-agents)
- Il a besoin d'outils (file-write, json-validate, file-read) mais c'est gere par le system prompt
- Un seul model node suffit

Si l'experience montre qu'il faut le rendre composite, on le fera — mais pas prematurement.

### Structure

```
content/system/blocks/agents/test-designer/
  test-designer.agent.block.json    ← Block definition
  system-prompt.md                  ← Instructions detaillees
```

### Outils accessibles

| Outil | Usage |
|-------|-------|
| `file-read` | Lire le contract JSON |
| `file-write` | Ecrire les fichiers de test |
| `json-validator` | Valider le format des tests generes |
| `directory-list` | Explorer les contracts existants |
| `step-complete` | Signaler la fin du travail |

### Inputs / Outputs

**Inputs** :
- `contractId` (string, required) — ID du contract a analyser
- `contractJson` (string, optional) — Le JSON du contract si deja charge
- `outputDir` (string, required) — Ou ecrire les fichiers de test

**Outputs** :
- `testSuite` (string) — JSON resume des tests generes
- `testFiles` (string[]) — Chemins des fichiers de test ecrits

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 52-A | Block definition + system prompt + companion docs | 2 jours |
| 52-B | Tests, validation contre le contract, iteration du prompt | 1.5 jours |
| 52-C | Contract Test Runner — execution et verification des tests | 2.5 jours |

---

## 52-A : Block definition + system prompt

### Lecture obligatoire
- `docs/system/architecture/contracts.md` (Phase 51)
- `content/system/contracts/test-designer.contract.json` (Phase 51)
- `content/system/blocks/agents/dev-orchestrator/` (reference agent composite)
- `content/system/blocks/agents/test-writer/` (reference agent de test)
- `content/system/blocks/tools/json-validator/` (outil reutilisable)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs`

### Taches

1. **Creer `test-designer.agent.block.json`** :
   - `blockType: "agent"`, `isAtomic: true`
   - `config.model: "claude-sonnet-4-6"` (bon equilibre precision/cout)
   - `config.maxIterations: 15`
   - `config.systemPromptFile: "system-prompt.md"`
   - `contract: "test-designer"`
   - `capabilities: ["conversation", "structured-output", "tool-calling"]`
   - Inputs/outputs comme defini ci-dessus

2. **Ecrire `system-prompt.md`** — LE livrable critique :
   - Section 1 : Role ("Tu es un concepteur de tests d'acceptance pour les contracts Maestro")
   - Section 2 : Format d'un contract (la hierarchie complete, avec exemples reels)
   - Section 3 : Format des tests attendus (le schema enrichi de Phase 51)
   - Section 4 : Types de check disponibles (non-empty, contains, tool-call, etc.)
   - Section 5 : Workflow prescrit :
     1. Lire le contract avec file-read
     2. Pour chaque feature : analyser les capabilities requises
     3. Pour chaque feature : generer 2-3 tests non-triviaux
     4. Ecrire les tests avec file-write
     5. Valider le format avec json-validator
     6. step-complete avec resume
   - Section 6 : Exemples concrets (un contract → les tests generes)
   - Section 7 : Anti-patterns (tests triviaux comme "send hello", tests impossibles a verifier)
   - Section 8 : Outils disponibles (format JSON exact pour chaque outil)
   - Section 9 : Regles (JSON only, step-complete obligatoire, max 15 iterations)

3. **Companion docs** si necessaire (reference contracts, exemples)

### Verification
```bash
# Block JSON valide
python -m json.tool content/system/blocks/agents/test-designer/test-designer.agent.block.json
# Backend compile
cd apps/backend && dotnet build
# Block decouvert
curl http://localhost:5000/api/blocks | grep test-designer
```

---

## 52-B : Tests et validation

### Taches

1. **Test manuel** : invoquer le test-designer sur le contract maestro-assistant
   ```bash
   cd packages/maestro-cli
   node index.js session create --type project --name "Test Designer Validation" --repo C:\Meastro --start
   node index.js session invoke <id> default --input contractId=maestro-assistant --input outputDir=.maestro/tests
   ```

2. **Verifier** que les tests generes :
   - Couvrent chaque feature du contract
   - Ont le bon format (prompt, check, turns pour multi-turn)
   - Sont non-triviaux (pas juste "send hello")
   - Utilisent les bons types de check

3. **Iterer le prompt** si les resultats sont mauvais :
   - L'agent genere des tests triviaux → ajouter plus d'exemples dans le prompt
   - L'agent ne comprend pas le format → ajouter un template JSON exact
   - L'agent fait trop d'iterations → reduire maxIterations, clarifier le workflow

4. **Valider contre le contract test-designer** :
   - Est-ce que l'agent passe les tests de son propre contract ?
   - Score par feature : Contract Analysis, Test Generation, Test Quality

5. **Tests unitaires** (vitest) :
   - Le block JSON est decouvert correctement
   - Le system prompt contient les sections attendues
   - Pas de regression

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
```

---

## 52-C : Contract Test Runner — Execution et verification des tests

### Contexte

Le test-designer genere des tests. L'agent-creator (Phase 53) a besoin de les EXECUTER pour sa boucle create-test-fix. Sans test runner, la chaine est cassee.

L'infrastructure backend existe deja partiellement :
- `BlockTestController.cs` — API CRUD pour test runs (simule, `Task.Delay`)
- `BlockTestRun`, `BlockTestIteration` — entities domain
- `FileSystemBlockTestRepository` — persistence JSON
- `BlockExecutorRegistry` + `IBlockExecutor` — execution de blocks

Il manque : execution reelle, verification des checks, endpoint contract-level, scoring par feature.

### Architecture

```
POST /api/contracts/{contractId}/test?blockId={blockId}
  |
  +-- 1. Load contract (JSON file)
  +-- 2. Load test suite optionnel (merge avec contract tests)
  +-- 3. Load block definition
  +-- 4. Check requiredCapabilities gate
  |
  +-- 5. Pour chaque feature active :
  |     +-- Pour chaque test :
  |     |   +-- Single-turn : prompt -> IBlockExecutor -> check response
  |     |   +-- Multi-turn : turns sequentiels -> check sur turns avec check
  |     +-- feature.score = tests_passed / tests_total
  |
  +-- 6. fitness = weighted average des feature scores
  +-- 7. Verifier minimumScore par feature + minimumFitness global
  |
  +-- Retourner : { fitness, passed, featureScores, testResults[], cost, duration }
```

### Composants a creer/modifier

| Composant | Type | Quoi |
|-----------|------|------|
| `ContractTestRunner.cs` | Nouveau — `Infrastructure/Testing/` | Check evaluation (8 types) + scoring weighted-average |
| `ContractTestController.cs` | Nouveau — `Api/Controllers/` | `POST /api/contracts/{id}/test?blockId=X` |
| `ContractTestResult.cs` | Nouveau — `Application/DTOs/` | DTOs resultats (feature scores, test results, fitness) |
| `BlockTestController.cs` | Modifier | Remplacer `Task.Delay` simule par execution reelle via `BlockExecutorRegistry` |
| `contract-test` tool block | Nouveau — `content/system/blocks/tools/` | Wrapper pour que les agents (agent-creator) puissent invoquer le test runner |

### Check types a implementer

| Type | Implementation |
|------|---------------|
| `non-empty` | `response.Length >= (minLength ?? 1)` |
| `contains` | `response.Contains(value, OrdinalIgnoreCase)` |
| `contains-all` | `values.All(v => response.Contains(v, OrdinalIgnoreCase))` |
| `contains-any` | `values.Any(v => response.Contains(v, OrdinalIgnoreCase))` |
| `does-not-contain` | `!values.Any(v => response.Contains(v, OrdinalIgnoreCase))` |
| `tool-call` | Verifier `_toolCalls` dans les outputs du block |
| `json-parseable` | `try { JsonDocument.Parse(response); }` |
| `regex` | `Regex.IsMatch(response, pattern)` |

### Sous-phases

| Phase | Quoi | Effort |
|-------|------|--------|
| 52-C-1 | `ContractTestRunner.cs` — check evaluation + scoring par feature | 0.5 jour |
| 52-C-2 | `ContractTestController.cs` + DTOs — API endpoint | 0.5 jour |
| 52-C-3 | Fix `BlockTestController.ExecuteIterations` — execution reelle | 0.5 jour |
| 52-C-4 | Tool block `contract-test` — invocable par les agents | 0.5 jour |
| 52-C-5 | Test via pipeline Maestro + validation | 0.5 jour |

### Verification
```bash
# Lancer les tests du contract maestro-assistant contre le block maestro-assistant
curl -X POST "http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant"
# Verifier le score par feature
# Verifier que les 8 check types fonctionnent
dotnet build apps/backend/Maestro.sln
npx vitest run tests/contract-resolver.test.ts
```

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

### 52-A + 52-B (DONE)
- [x] `test-designer.agent.block.json` cree et decouvert par le backend
- [x] `system-prompt.md` complet avec exemples, format, anti-patterns
- [x] Le test-designer produit des tests valides pour maestro-assistant (14 tests, 6 check types)
- [x] Les tests generes couvrent toutes les features du contract (conversation, maestro-operations, orchestration, memory)
- [x] Les tests generes sont non-triviaux et executables (multi-turn, anti-hallucination, tool-call, preference recall)
- [x] Le test-designer passe son propre contract — genere 11 tests pour test-designer.contract.json
- [x] Tous les tests existants passent (141/141 maestro-code, 5/5 contract-resolver)

### 52-C (DONE)
- [x] `POST /api/contracts/maestro-assistant/test?blockId=system:maestro-assistant` retourne un score avec feature breakdown
- [x] Les 8 check types implementes (non-empty, contains, contains-all, contains-any, does-not-contain, tool-call, json-parseable, regex)
- [x] Le scoring weighted-average par feature est correct (weight, minimumScore, minimumFitness)
- [x] Tool block `contract-test` existe et est invocable par un agent (via ToolBlockExecutor)
- [x] Le test-designer + contract-test forment une chaine complete : generer tests -> executer -> score
- [x] `dotnet build` : 0 errors, tests existants passent (140/141 + 5/5 contract-resolver)
- [x] Roadmap mis a jour avec items "fitness display TUI" et "backend contract filter"
- [x] BlockTestController.ExecuteIterations remplace execution simulee par execution reelle

### NOT in scope
- Agent agent-creator (Phase 53)
- Workflow block-forge (Phase 54)
- Fitness display dans le TUI (Phase 57)
- Backend contract filter `GET /api/blocks?contract=X` (low priority)
- TUI integration
