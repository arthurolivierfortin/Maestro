# Phase 58 : Workflow block-forge + Integration TUI/CLI

**Statut** : A FAIRE
**Prerequis** : Phase 57 COMPLETE (agent-creator fonctionnel avec boucle create-test-fix)
**Objectif** : Assembler test-designer et agent-creator dans le workflow `block-forge`. Integrer dans le TUI (`/create-agent`) et le CLI (`maestro create-agent`). Creer 2 contracts supplementaires. Dogfooding complet.
**Duree estimee** : 3-4 jours

---

## ATTENTION — Misconceptions a eviter

### Le workflow n'est PAS un agent

Le workflow (`blockType: "workflow"`) orchestre des nodes sequentiellement/conditionnellement. Il n'a PAS de boucle agentique. Il n'a PAS de system prompt. C'est un pipeline de blocks :

```
analyze → test-designer → agent-creator → fitness → publish
```

Les agents A L'INTERIEUR du workflow (test-designer, agent-creator) sont les vrais cerveaux. Le workflow est juste le chef d'orchestre.

### Les agents existent deja — on les assemble

Phase 52 a cree test-designer. Phase 55 a cree agent-creator. Cette phase :
1. Les connecte dans un workflow
2. Ajoute l'analyse initiale (inference) et la publication finale (tool)
3. Integre dans le TUI et CLI
4. Dogfood le tout

---

## Architecture du workflow

```
block-forge (workflow)
├── 1. analyze-request (inference)
│     Input: description, contractId, targetModel, baseBlockId
│     Output: { role, contractId, capabilities, modelTier }
│
├── 2. design-tests (agent: test-designer)
│     Input: contractId (du step 1)
│     Output: test suite
│
├── 3. create-block (agent: agent-creator)
│     Input: analyse (step 1) + tests (step 2) + targetModel
│     Output: block cree + test results + fitness
│
├── 4. conditional: fitness >= seuil ?
│     ├── then: publish-block (tool: block-create API)
│     └── else: set-variable _forgeResult = "below-threshold"
│
└── Output: { blockId, contractId, testResults, fitness, published }
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 54-A | Workflow block-forge + contracts supplementaires | 1.5 jours |
| 54-B | Integration TUI /create-agent + CLI maestro create-agent | 1.5 jours |
| 54-C | Dogfooding complet | 1 jour |

---

## 54-A : Workflow block-forge

### Lecture obligatoire
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` (workflow avance)
- `content/system/blocks/workflows/generate-commit-message.workflow.block.json` (workflow simple)
- `content/system/blocks/_drafts/workflows/foundry/tool-creation.workflow.block.json` (patron similaire)
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
- Les blocks crees en Phase 52-53

### Taches

1. **Creer `block-forge.workflow.block.json`** :
   - Nodes : analyze-request → test-designer → agent-creator → conditional → publish
   - Variable passing entre nodes via `{{_nodeResult_xxx}}`
   - `contract: "block-forge"`
   - `capabilities: ["block-generation", "contract-analysis", "capability-testing"]`

2. **Creer l'inference block `request-analyzer`** :
   - `blockType: "inference"`, `isAtomic: true`
   - Prompt : analyse une description → identifie contract, capabilities, model tier
   - Si contractId fourni → l'utiliser directement
   - Si baseBlockId fourni → mode adaptation

3. **2 contracts supplementaires** :
   - `code-reviewer.contract.json` :
     - Features: code-reading (tool-calling), review-feedback (conversation), structured-report (structured-output), multi-file-review (long-context + tool-calling)
     - Tests concrets par feature
   - `test-generator.contract.json` :
     - Features: test-writing (tool-calling), coverage-analysis (conversation + tool-calling), structured-results (structured-output)
     - Tests concrets par feature

4. **Session template** pour block-forge :
   - `block-forge.session.json` dans `content/system/templates/sessions/`
   - Entry point: `default` → workflow block-forge
   - Variables: targetFitness, outputDir

### Verification
```bash
python -m json.tool content/system/blocks/workflows/block-forge/block-forge.workflow.block.json
cd apps/backend && dotnet build
# Test du workflow
cd packages/maestro-cli
node index.js session create --type project --name "Block Forge Test" --template block-forge --repo C:\Meastro --start
node index.js session invoke <id> default --input description="An agent that reviews code"
```

---

## 54-B : Integration TUI + CLI

### Taches

1. **Slash command `/create-agent`** :
   - Parse: `/create-agent An agent that reviews Python code [--contract code-reviewer] [--model mistral-7b]`
   - Cree une session avec template block-forge
   - Invoque le workflow
   - Affiche la progression dans la conversation (polling des variables)
   - Affiche le resultat : block cree, features actives, fitness score

2. **CLI** : `maestro create-agent` :
   - `maestro create-agent --description "An agent that reviews code" [--contract code-reviewer] [--model mistral-7b]`
   - Cree session + invoque workflow
   - Affiche le rapport dans le terminal
   - Exit code 0 si publie, 1 si fitness insuffisante

3. **Demo mode** :
   - Mettre a jour DemoApiClient pour simuler `/create-agent`
   - Ajouter les nouveaux contracts dans EMBEDDED_CONTRACTS

4. **Tests** :
   - Le slash command parse correctement les arguments
   - Le workflow block-forge est decouvert
   - Les 2 nouveaux contracts sont charges
   - Pas de regression sur les tests existants

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
cd packages/maestro-code && npm run test:visual
cd packages/maestro-code && node tests/real-demo-check.cjs
```

---

## 54-C : Dogfooding

### Taches

1. **Creer 2 agents via `/create-agent`** :
   - Un code-reviewer : `/create-agent An agent that reviews TypeScript code --contract code-reviewer`
   - Un test-generator : `/create-agent An agent that generates vitest tests --contract test-generator`

2. **Verifier** :
   - Les blocks sont crees et apparaissent dans le Catalog
   - Les tests d'acceptance ont ete generes et executes
   - Le fitness score est raisonnable
   - Les features actives/inactives correspondent aux capabilities du modele

3. **Comparer avec creation manuelle** :
   - Combien de temps pour creer un agent via `/create-agent` vs manuellement ?
   - La qualite du prompt genere est-elle acceptable ?
   - Les tests generes sont-ils pertinents ?

4. **Tester les variantes** :
   - `/create-agent Adapt maestro-assistant for small models --contract maestro-assistant --model mistral-7b`
   - Verifier que les features sont reduites (pas d'orchestration)

### Gate de sortie
- [ ] 2 agents crees via `/create-agent` avec fitness > 0.5
- [ ] Les agents passent au moins les features `requiredCapabilities` de leur contract
- [ ] Le processus est plus rapide que la creation manuelle
- [ ] Score experience utilisateur >= 3/5

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] Workflow `block-forge` assemble et fonctionnel
- [ ] Inference block `request-analyzer` operationnel
- [ ] 2 contracts supplementaires (code-reviewer, test-generator) avec tests
- [ ] TUI `/create-agent` fonctionnel
- [ ] CLI `maestro create-agent` fonctionnel
- [ ] 2 agents crees et valides par dogfooding
- [ ] Score experience >= 3/5
- [ ] Tous les tests passent

### NOT in scope
- `/adapt` comme commande TUI (Phase 57+)
- Production de variantes en batch (Phase 58+)
- Catalogue communautaire (Phase 60+)
- Self-improvement (Phase 62+)
