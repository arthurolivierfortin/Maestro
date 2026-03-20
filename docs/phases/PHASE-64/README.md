# Phase 64 : Agents Fonctionnels

**Statut** : EN COURS
**Prerequis** : Phase 61 COMPLETE, Phase 62 COMPLETE (Container Isolation)
**Objectif** : TOUS les agents de base passent leurs contrats. Le maestro-assistant integre les widgets dans la conversation. Le block-forge fonctionne end-to-end.
**Duree estimee** : 5-6 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire `memory/contract-testing.md`** — `_toolMapping`, capture blocks, tout est un block
3. **Lire `memory/feedback_no-native-tool-use.md`** — pas de tool_use natif, THINK/ACTION
4. **Ecrire dans `PHASE-64/checkpoint.md`** apres chaque sous-phase
5. **Ne PAS modifier AgentBlockExecutor** — tout passe par les blocks
6. **Ne PAS augmenter maxIterations** — si l'agent echoue en 12/30, le system prompt est le probleme
7. **Documenter chaque iteration** — model, fitness, cout, diagnostic

---

## Contexte

### Infrastructure validee
- `_toolMapping` + 4 capture blocks fonctionnels (Phase 64-A)
- Provider ClaudeCode par defaut, priority configurable (Phase 64-B)
- Container isolation : fail-closed, AllowedBlocks, permissions (Phase 62)
- ContractTestRunner : 8 check types, tous lisent `_capturedToolCalls`
- agent-creator : 9/9 tests, performance 1.0 (Phase 64-C)

### Ce qui manque
Les contract tests ne valident qu'un seul agent (agent-creator). Pour que "Agents Fonctionnels" soit honnete, les 4 agents/workflows de base doivent passer leurs contrats :
1. **agent-creator** — 9 tests — DONE
2. **test-designer** — 19 tests — PAS TESTE
3. **maestro-assistant** — 25 tests — PAS TESTE (+ doit savoir injecter des widgets)
4. **block-forge** — 8 tests — PAS TESTE (workflow E2E)

---

## Sous-phases

| Phase | Titre | Effort | Status |
|-------|-------|--------|--------|
| 64-A | `_toolMapping` + mock blocks | 1 jour | **DONE** |
| 64-B | Resolution conflits providers + priority | 0.5 jour | **DONE** |
| 64-C | agent-creator : contrat valide (9/9) | 1 jour | **DONE** |
| 64-D0 | Infra : capture-generic + fix contrats | 0.5 jour | **DONE** |
| 64-D | test-designer : recentre generation (contrat refait) | 0.5 jour | A FAIRE |
| 64-E | maestro-assistant : contrat + widgets (24/24) | — | **DONE** |
| 64-G | contract-definer : nouvel agent conversationnel | 1.5 jour | A FAIRE |
| 64-F | block-forge : pipeline 3 agents + contrat valide | 1.5 jour | A FAIRE |
| 64-T | Tests + validation + regression | 0.5 jour | A FAIRE |

**Ordre d'execution** : A → B → C → D0 → E → **D + G (parallele)** → F → T

```
64-D0 (infra) : DONE — capture-generic, summary-validator, response-parser fix
64-E (maestro-assistant) : DONE — 24/24, performance 1.0
    |
    +---> 64-D (test-designer refocus)     } parallele
    +---> 64-G (contract-definer creation) }
              |
              v
         64-F (block-forge 3-agent pipeline)
              |
              v
         64-T (validation)
```

---

## 64-A : `_toolMapping` + Mock Blocks — DONE

Voir checkpoint.md pour les details. Resume :
- `_toolMapping` dans ToolDispatcherBlockExecutor
- 4 capture blocks : capture-file-write, capture-file-read, capture-file-edit, capture-shell-execute
- ContractTestRunner injecte `_toolMapping` + `AllowedBlocks`
- 8 check types lisent `_capturedToolCalls`
- 20 tests, tous passent

---

## 64-B : Resolution Conflits Providers — DONE

Voir checkpoint.md pour les details. Resume :
- `GET /api/v1/providers/conflicts` + `PUT /api/v1/providers/priority`
- ClaudeCode configure comme provider par defaut (priority 1)
- 11 tests, tous passent

---

## 64-C : agent-creator Contract — DONE

- **9/9 tests passent** (performance 1.0, fitness 0.119)
- Provider ClaudeCode, cout $0.25
- Fix check types pour lire `_capturedToolCalls`
- Fix Windows command-line limit (stdin pour system prompt + prompt)

---

## 64-D0 : Infrastructure — capture-generic + fix contrats

### Lecture obligatoire
- `content/system/contracts/maestro-assistant.contract.json`
- `content/system/contracts/block-forge.contract.json`
- `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json`

### Tache 1 : Creer `capture-generic` block

Block executor generique qui capture tout tool call non couvert par les capture blocks specifiques.
Necessaire pour les tools Maestro (session-create, workspace-list, etc.) dans les tests maestro-assistant.

- **Fichier** : `content/system/blocks/tools/capture-generic/capture-generic.tool.block.json`
- **Executor** : `CaptureGenericBlockExecutor.cs`
- **Comportement** : Enregistre `{toolId, args, timestamp}` dans `_capturedToolCalls`, retourne `"Tool {toolId} executed successfully with args: {summary}"`
- **ContractTestRunner** : Ajouter les tools Maestro au `_toolMapping` ET aux `AllowedBlocks` pour les sessions de test maestro-assistant/block-forge

### Tache 2 : Fix contrat maestro-assistant

**Probleme 1 — Tool names** : Verifier que `session-create`, `workspace-list`, `block-list`, `workspace-create` correspondent aux vrais tool IDs dans le system prompt. Si non, aligner le contrat OU le system prompt.

**Probleme 2 — Feature "memory" skippee** : Le block declare `[conversation, tool-calling, structured-output, long-context, orchestration]` mais pas `memory`. La feature "memory" (5 tests, poids 0.15) requiert `["memory", "long-context"]`.
- **Fix** : Ajouter `"memory"` aux capabilities du block (le block PEUT retenir du contexte via conversation history, c'est une capability reelle)

**Probleme 3 — `navigate-pages` obsolete** : Le test verifie "Show me the Catalog" → `contains-any ["catalog", "Catalog", "/catalog"]`. Avec le paradigme widgets, c'est correct (la reponse contiendrait "[WIDGET:catalog]" qui contient "catalog"). Pas de changement necessaire.

### Tache 3 : Renforcer contrat block-forge

Les 8 tests actuels sont conversationnels — ils testent la connaissance, pas l'execution.

**Fix minimal** : Ajouter 1-2 tests avec `tool-call` check pour verifier que le workflow tente les bonnes operations :
- Un test qui verifie l'appel a `contract-test` ou `step-complete`
- Un test qui verifie l'appel a `file-write` pour persister le block

**NE PAS ajouter de tests E2E complets** — le vrai E2E sera un test d'integration en 64-F, pas un check du contrat.

### Verification 64-D0
- [ ] `capture-generic` block cree et fonctionnel
- [ ] Test unitaire pour `CaptureGenericBlockExecutor`
- [ ] ContractTestRunner : _toolMapping etendu pour les tools Maestro
- [ ] maestro-assistant capabilities incluent "memory"
- [ ] Tool names dans le contrat alignes avec les vrais tool IDs
- [ ] block-forge contrat a au moins 1 test `tool-call`
- [ ] `dotnet build` : 0 erreurs

---

## 64-D : test-designer — Recentrer sur la generation

### Constat

Le test-designer obtient 10/18 sur son contrat actuel. Mais 7 des 8 echecs sont des tests **conversationnels** (recommander des check types, critiquer des tests, etc.) qui ne font pas partie de son vrai role.

Son role reel dans block-forge : lire un contrat → generer un test-suite.json → configurer les captures blocks. C'est un agent **purement generatif**, pas conversationnel. Les questions conversationnelles sur le design de tests sont le role du **contract-definer** (64-G).

### Taches

#### 1. Reecrire le contrat test-designer

Retirer les tests conversationnels. Garder et renforcer les tests de generation.

**Features du nouveau contrat** :

| Feature | Poids | Tests | Ce qu'on teste |
|---------|-------|-------|----------------|
| contract-reading | 0.25 | 3-4 | Lit un contrat, identifie features et capabilities |
| test-generation | 0.35 | 4-5 | Genere single-turn, multi-turn, tool-call, constraint tests |
| output-quality | 0.20 | 3-4 | Check types varies, pas que non-empty, tests non-triviaux |
| output-format | 0.20 | 2-3 | JSON valide, file-write, champs requis |

**Tests a garder** (passent deja) : identify-features, identify-capabilities, contract-reading-*, generate-single-turn, generate-multi-turn, output-format-required-top-level-fields

**Tests a retirer** : check-type-selects-tool-call, check-type-selects-regex, check-type-warns-non-empty-overuse, test-generation-rejects-trivial-tests (tous conversationnels → deplacés vers contract-definer)

**Tests a ajouter** :
- `generates-constraint-test-with-does-not-contain` : Verifie via `tool-call` que l'agent appelle `file-write` avec un contenu contenant "does-not-contain"
- `generates-varied-check-types` : Le test-suite ecrit contient au moins 3 check types differents
- `test-suite-covers-all-features` : Le test-suite couvre chaque feature du contrat source

#### 2. Simplifier le system prompt du test-designer

Retirer Mode 2 (conversation). Le test-designer est **toujours** en mode generation :
- Lit le contrat
- Genere les tests
- Ecrit via file-write
- Appelle step-complete

Pas de questions, pas de conversation. Un seul mode. Le prompt redevient clair et sans ambiguite.

#### 3. Revert les hacks

- Retirer la validation summary-validator des branches text et step-complete du config.nodes (plus necessaire si l'agent n'a qu'un mode)
- Le response-parser fix (JSON arrays → retry) reste car c'est une amelioration generique valable pour tous les agents

### Verification 64-D
- [ ] Nouveau contrat test-designer ecrit
- [ ] System prompt simplifie (un seul mode)
- [ ] Contract test : >= 12/15 tests (80%+)
- [ ] `dotnet build` : 0 erreurs

### Lecture obligatoire
- `content/system/contracts/test-designer.contract.json` (ancien, pour reference)
- `content/system/blocks/agents/test-designer/test-designer.agent.block.json`
- `content/system/blocks/agents/test-designer/system-prompt.md`

### Le contrat (19 tests, 4 features)

| Feature | Poids | Tests | Requires |
|---------|-------|-------|----------|
| contract-analysis | 0.25 | 5 | conversation |
| test-generation | 0.30 | 6 | structured-output |
| test-quality | 0.25 | 5 | conversation, structured-output |
| output-format | 0.20 | 2 | structured-output, tool-calling |

### Taches

1. **Lancer le contract test baseline** :
   ```
   curl -X POST "http://localhost:5000/api/contracts/test-designer/test?blockId=test-designer"
   ```
2. **Analyser les echecs** — identifier les tests qui echouent et pourquoi
3. **Iterer le system prompt** (max 5 iterations) — condenser, clarifier les instructions
4. **Verifier les tools** — `output-format-uses-file-write-tool` requiert que l'agent appelle `file-write` (capture par _toolMapping)
5. **Re-runner** jusqu'a 19/19 ou performance >= 0.8

### Criteres de succes
- 19/19 tests passent (ou >= 16/19, performance >= 0.85)
- System prompt coherent avec le format THINK/ACTION
- Cout documente

### Verification
- [ ] `curl -X POST` retourne passedTests >= 16
- [ ] Chaque feature atteint son minimumScore
- [ ] `dotnet build` : 0 erreurs

---

## 64-E : maestro-assistant — DONE

- **24/24 tests**, performance 1.0, fitness 0.119
- Toutes les features passent leur seuil (conversation 7/7, operations 5/7→7/7 apres fix multi-turn, orchestration 5/5, memory 5/5)
- Widgets inline fonctionnels ([WIDGET:sessions], [WIDGET:catalog], etc.)
- Cout : $0.13 par run
- Fix applique : 2 tests single-turn convertis en multi-turn (coherence avec confirm-before-act)

---

## 64-G : contract-definer — Nouvel agent conversationnel

### Pourquoi cet agent

Dans le pipeline block-forge actuel (2 agents), il manque une etape cruciale : **comprendre et formaliser ce que l'utilisateur veut** avant de generer des tests et du code.

Le contract-definer est l'agent **conversationnel** qui :
1. Comprend l'intent de l'utilisateur ("Je veux un agent qui review du TypeScript")
2. Pose des questions de clarification ("Quels outils ? Quel modele ? Quelles contraintes ?")
3. Produit un **contract.json** formel (features, capabilities, weights, minimumFitness)

C'est lui qui a les competences conversationnelles qu'on avait mis (a tort) dans test-designer.

### Lecture obligatoire
- `content/system/contracts/agent-creator.contract.json` (exemple de contrat bien fait)
- `content/system/contracts/maestro-assistant.contract.json` (exemple de contrat complexe)
- `content/system/contracts/code-reviewer.contract.json` (exemple avec test-suite)

### Taches

#### 1. Creer le contrat contract-definer

**Fichier** : `content/system/contracts/contract-definer.contract.json`

| Feature | Poids | Tests | Ce qu'on teste |
|---------|-------|-------|----------------|
| requirement-gathering | 0.30 | 5-6 | Pose des questions, clarifie l'intent, identifie les capabilities |
| contract-generation | 0.35 | 4-5 | Produit un JSON valide avec features, weights, minimumFitness |
| test-advice | 0.20 | 3-4 | Recommande des check types, explique pourquoi, critique des tests faibles |
| quality-judgment | 0.15 | 3 | Evalue la qualite d'un contrat, identifie les lacunes |

**Tests conversationnels a inclure** (deplacés du test-designer) :
- "What check type should I use for tool verification?" → doit repondre "tool-call"
- "Is this test good? `{prompt: 'Hello', check: {type: 'non-empty'}}`" → doit critiquer
- "A suite has 8 tests all with non-empty. What's wrong?" → doit identifier la faiblesse
- "How would you design a constraint test for system prompt leaking?" → doit mentionner "does-not-contain"

**Tests de generation** :
- "Define a contract for a code-reviewer agent" → doit produire JSON parseable avec features
- "This contract is missing edge case tests. What would you add?" → doit proposer des tests concrets
- Multi-turn : description → clarification → contract generation

#### 2. Creer le block agent contract-definer

**Fichier** : `content/system/blocks/agents/contract-definer/contract-definer.agent.block.json`

- Meme structure que maestro-assistant (config.nodes standard)
- Model : claude-sonnet-4-6
- maxIterations : 15 (conversationnel, potentiellement multi-turn)
- Capabilities : `[conversation, structured-output, tool-calling]`
- Tools : file-read (lire contrats existants), file-write (ecrire le contrat genere), directory-list, step-complete

**Fichier** : `content/system/blocks/agents/contract-definer/system-prompt.md`

Le system prompt doit couvrir :
- Role : "Tu es un architecte de contrats Maestro. Tu comprends les besoins de l'utilisateur et les traduis en contrats formels."
- Format de contract.json (schema complet avec exemples)
- Guidelines pour les weights, minimumFitness, check types
- Mode conversationnel par defaut : poser des questions, expliquer, conseiller
- Mode generation quand demande : produire le JSON via file-write
- Connaissance des check types et quand les utiliser

#### 3. Valider le contrat

- Lancer les contract tests
- Cible : >= 12/15 tests (80%+)
- L'agent doit etre **conversationnel** (son role premier)

### Verification 64-G
- [ ] Contrat contract-definer ecrit et valide
- [ ] Block agent cree (block.json + system-prompt.md)
- [ ] Contract test : >= 12/15 (80%+)
- [ ] `dotnet build` : 0 erreurs

---

## 64-F : block-forge — Pipeline 3 agents

### Architecture cible

```
block-forge pipeline V2 :

1. contract-definer (NOUVEAU)
   Input:  description (string), existingContractId? (string)
   Output: contractJson, contractId, contractPath
   Si existingContractId fourni → lit le contrat existant, l'enrichit si besoin
   Si absent → genere un nouveau contrat depuis la description

2. test-designer (EXISTANT, recentre)
   Input:  contractId, outputDir
   Output: testSuite, testFiles
   Lit le contrat → genere le test-suite.json

3. agent-creator (EXISTANT)
   Input:  description, contractId, targetModel?, baseBlockId?
   Output: blockId, blockPath, fitness, testResults
   Cree le block, teste, itere

4. check-fitness + publish
   Si fitness >= targetFitness → publish = true
```

### Prerequis
- 64-C DONE (agent-creator 9/9)
- 64-D DONE (test-designer recentre)
- 64-G DONE (contract-definer fonctionnel)

### Taches

#### 1. Mettre a jour le workflow block-forge

**Fichier** : `content/system/blocks/workflows/block-forge/block-forge.workflow.block.json`

Modifier le workflow de 2 agents (test-designer → agent-creator) a 3 agents :

```
Nouvelle sequence de nodes :
1. set-default-fitness (existant)
2. conditional: si contractId fourni → skip contract-definer
3. construct-cd-message → call-contract-definer (NOUVEAU)
4. construct-td-message → call-test-designer (existant, ajuster inputs)
5. construct-ac-message → call-agent-creator (existant)
6. check-fitness → set-result-* (existant)
```

Ajouter les inputs optionnels :
- `existingContractId` (string, optional) — si fourni, skip contract-definer
- `generateContract` (boolean, optional, default true) — force la generation de contrat

#### 2. Mettre a jour le contrat block-forge

**Fichier** : `content/system/contracts/block-forge.contract.json`

Ajouter des tests pour le pipeline 3 agents :
- "Create a greeting agent from scratch (no existing contract)" → doit orchestrer les 3 agents
- "Create a code-reviewer using the existing code-reviewer contract" → doit skip contract-definer

#### 3. Lancer les contract tests

```bash
curl -X POST "http://localhost:5000/api/contracts/block-forge/test?blockId=block-forge"
```

#### 4. Test E2E reel (optionnel)

Invoquer le workflow complet via CLI :
```bash
node cli.ts session invoke <session> block-forge --input description="A greeting agent" generateContract=true
```

### Criteres de succes
- Block-forge contract : >= 8/10 tests (80%+)
- Le pipeline 3 agents s'execute sans erreur
- Le block produit a un fitness > 0
- Cout et duree documentes

### Verification 64-F
- [ ] Workflow block-forge mis a jour (3 agents)
- [ ] Contract block-forge enrichi
- [ ] Contract test : >= 8/10
- [ ] `dotnet build` : 0 erreurs

---

## 64-T : Tests + Validation

### Tests unitaires (verifier 0 regression)
- CaptureBlockTests : 28+ tests (captures + summary-validator + response-parser)
- ToolDispatcherPermissionTests : 37 tests
- ContainerIsolationE2ETests : 21 tests
- ToolSchemaGeneratorTests : 12 tests
- Maestro.Execution.Tests : 269+ tests total

### Contract tests (4 agents + 1 workflow)
- [x] agent-creator : 9/9, performance 1.0
- [x] maestro-assistant : 24/24, performance 1.0
- [ ] test-designer (recentre) : >= 12/15 (80%+)
- [ ] contract-definer : >= 12/15 (80%+)
- [ ] block-forge : >= 8/10 (80%+)

### Regression check
- [ ] Re-runner agent-creator et maestro-assistant pour confirmer 0 regression
- [ ] `dotnet build` : 0 erreurs
- [ ] `npx tsc --noEmit` : 0 erreurs

---

## Definition of Done

- [x] `_toolMapping` + 4 capture blocks + capture-generic fonctionnels
- [x] Provider priority configurable (ClaudeCode par defaut)
- [x] agent-creator : 9/9 tests, performance 1.0
- [x] maestro-assistant : 24/24 tests, performance 1.0, widgets inline
- [ ] test-designer (recentre generation) : >= 12/15 tests
- [ ] contract-definer (nouveau, conversationnel) : >= 12/15 tests
- [ ] block-forge (pipeline 3 agents) : >= 8/10 tests
- [ ] Tous les tests unitaires passent, 0 regression
- [ ] `dotnet build` : 0 erreurs
- [ ] `npx tsc --noEmit` : 0 erreurs

### NOT in scope

- /adapt workflow (Phase 65)
- Production de ~30 variantes (Phase 66)
- Choix d'assistant au setup (Phase 67)
- SSE streaming / live execution view (reporte)
- Nouveaux contracts pour les 18 agents specialises
- Modification de AgentBlockExecutor (tout passe par les blocks)
