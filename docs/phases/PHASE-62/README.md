# Phase 62 : Agents Fonctionnels + Optimisation

**Statut** : A faire
**Prerequis** : Phase 61 COMPLETE (block-forge fiable, contracts valides)
**Objectif** : Condenser le system prompt (informe par les donnees de 61-C), creer 2 agents fonctionnels via le pipeline Maestro (foundry), et ajouter une live execution view dans le TUI.
**Duree estimee** : 2-3 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire `docs/phases/PHASE-61/contract-validation-results.md`** — donnees empiriques de 61-C
3. **Ecrire dans `PHASE-62/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS augmenter maxIterations** — si l'agent echoue en 12, le system prompt est le probleme
5. **Utiliser le pipeline Maestro** — foundry sessions, contract tests, publish. Pas de curl ad-hoc
6. **Documenter chaque iteration** — model, fitness, cout, diagnostic

---

## Contexte

Phase 61 a rendu l'infrastructure fiable :
- Provider Anthropic verifie et fonctionnel
- maxIterations fixe a 12 (pas 50)
- Loop detection active (warn@3, stop@5)
- Pre-flight bloquant si config invalide
- Couts propagent vers le parent
- Contracts valides empiriquement (resultats dans `contract-validation-results.md`)

Phase 62 utilise cette infrastructure pour creer des agents qui fonctionnent.

---

## Sous-phases

| Phase | Titre | Effort | Document |
|-------|-------|--------|----------|
| 62-A | Condenser le system prompt (guide par 61-C) | 0.5 jour | ci-dessous |
| 62-B | Creer les agents via foundry pipeline | 1-1.5 jours | ci-dessous |
| 62-C | Live execution view dans le TUI | 1 jour | ci-dessous |
| 62-T | Tests + validation | 0.5 jour | ci-dessous |

**Ordre d'execution** : A → B → C → T

62-A DOIT etre fait avant 62-B (la condensation informe la creation). 62-C peut etre fait en parallele de 62-B si necessaire.

---

## 62-A : Condenser le system prompt agent-creator

### Prerequis

Lire `docs/phases/PHASE-61/contract-validation-results.md`. Les recommandations de 61-C indiquent quels aspects du system prompt causent des echecs et quels sont redondants.

### Objectif

Reduire de 994 → ~400-500 lignes. Strategie guidee par les donnees :

**Garder** :
- Role et objectif (20 lignes)
- Tools JSON schema (obligatoire pour tool-calling) (~80 lignes)
- step-complete format et champs requis (~20 lignes)
- Iteration budget et strategie (~10 lignes)
- Un exemple minimal de block.json genere (~30 lignes)

**Condenser** :
- Anatomy of block.json : garder un schema annoté au lieu de field-by-field docs
- System prompt writing rules : 3 regles essentielles au lieu de 15 paragraphes

**Retirer** :
- Les 2+ exemples de block.json complets (garder 1 court)
- Les anti-patterns detailles (les mettre dans le contract si necessaire)
- Les model tier guidelines (l'agent n'a pas besoin de connaitre les tiers pour generer un block)
- La documentation des champs optionnels (l'agent peut deduire les bons defauts)
- Les sections redondantes

### Impact sur le cout

System prompt 994L ≈ 30K tokens → ~$0.11/appel en input
System prompt 400L ≈ 12K tokens → ~$0.04/appel en input
**Economie : ~60% sur l'input par appel, ~$0.84/agent sur 12 iterations**

### Verification

```bash
wc -l content/system/blocks/agents/agent-creator/system-prompt.md
# Cible : < 500 lignes

# Re-tester le contract pour verifier que la condensation n'a rien casse
cd C:\Meastro\packages\maestro-cli
node index.js contract test agent-creator --block agent-creator
# Fitness doit etre >= fitness de 61-C (pas de regression)
```

---

## 62-B : Creer les agents via foundry pipeline

### Workflow pour chaque agent

#### 1. Creer une session foundry

```bash
cd C:\Meastro\packages\maestro-cli
node index.js session create --type project --name "Foundry - Agent Creator v2" \
  --repo C:\Meastro --start
```

#### 2. Baseline : tester le system prompt actuel

```bash
node index.js contract test agent-creator --block agent-creator
# Noter le fitness de base
```

#### 3. Iterer le system prompt

Si fitness < 0.5 :
1. Lire les resultats des tests qui echouent
2. Identifier la cause (format incorrect, instruction manquante, instruction contradictoire)
3. Modifier le system prompt
4. Re-tester
5. Repeter

**Max 5 iterations par agent.** Si fitness < 0.5 apres 5 iterations, le probleme est probablement dans les contracts (revenir a 61-C) ou dans le ContractTestRunner.

#### 4. Tester avec au moins 2 modeles

```bash
# Modele principal : claude-sonnet-4-6
node index.js contract test agent-creator --block agent-creator
# Modele alternatif : modifier temporairement config.model
```

#### 5. Publier si fitness > 0.5

```bash
node index.js block publish agent-creator
```

#### 6. Repeter pour test-designer

### Documentation

Creer `docs/phases/PHASE-62/foundry-iterations.md` avec un log par iteration :

```markdown
### Iteration 1 (baseline)
- Model : claude-sonnet-4-6
- System prompt : X lignes
- Fitness : X.XX
- Tests passes : X/Y
- Cout : $X.XX
- Diagnostic : [ce qui ne marche pas]

### Iteration 2
- Changement : [description]
- Fitness : X.XX (delta: +X.XX)
```

Et `docs/phases/PHASE-62/benchmark-results.md` avec le tableau comparatif.

### Criteres de succes

- agent-creator : fitness >= 0.5
- test-designer : fitness >= 0.5
- Au moins 2 modeles testes
- Cout total des iterations documente
- Benchmark documente

---

## 62-C : Live Execution View dans le TUI

### Objectif

Quand block-forge tourne via `/create-agent`, le TUI montre en temps reel :
- L'agent actif (test-designer ou agent-creator) et son iteration
- Les tool calls au fur et a mesure
- Le cout cumule
- La possibilite d'annuler (Esc)

### Mockup cible

```
Creating agent via block-forge workflow...
  Description: An agent that reviews TypeScript code
  Contract:    code-reviewer

  -- test-designer ----------- iter 2/12 --- $0.012 --
  [ok] directory-list content/system/contracts/
  [ok] file-read code-reviewer.contract.json
  [->] file-write test-suite.json

  -- agent-creator ----------- iter 5/12 --- $0.048 --
  [ok] file-read code-reviewer.contract.json
  [ok] file-write code-reviewer.agent.block.json
  [ok] contract-test code-reviewer -> fitness: 0.35
  [->] contract-test code-reviewer...

  Cost: $0.060 | Time: 2m 15s
  [Esc to cancel]
```

### Implementation

1. **Enrichir le polling** dans le handler `/create-agent` (App.ts) :
   - Lire `_childSession_{nodeId}` pour trouver les child sessions
   - Pour chaque child, lire `_executionLog` et `currentIteration`
   - Parser les tool calls depuis les logs

2. **Approche recommandee** : Copier un resume structure du child vers le parent dans `BlockRefHandler` :
   ```csharp
   session.SetVariable($"_childLog_{nodeId}", childSession.GetVariable("_executionLog"));
   session.SetVariable($"_childIteration_{nodeId}", childSession.GetVariable("currentIteration"));
   ```
   Le TUI lit alors tout depuis la session parent (un seul appel API).

3. **Cancel via Esc** : `useInput` handler → `POST /api/sessions/<id>/stop`

### Verification

```bash
npx tsc --noEmit  # 0 erreurs
npx vitest run    # 0 regressions
node tests/real-demo-check.cjs  # process starts
```

---

## 62-T : Tests + Validation

### Tests unitaires

- System prompt condensation : re-tester contract (pas de regression)
- TUI polling enrichi : `create-agent-polling.test.ts` (2-3 tests)

### Tests d'integration

- Block-forge E2E : workflow complet via CLI ou TUI
- 1 agent cree avec fitness > 0.5

### Dogfooding

- Lancer `/create-agent` dans le TUI
- Observer la live view
- Verifier fitness > 0.5

---

## Definition of Done

- [ ] System prompt condense : < 500 lignes, 0 regression de fitness
- [ ] agent-creator : fitness >= 0.5 (verifie par contract test)
- [ ] test-designer : fitness >= 0.5 (verifie par contract test)
- [ ] Au moins 2 modeles testes par agent
- [ ] Live execution view : tool calls + iterations + cout visibles
- [ ] Cancel (Esc) fonctionne
- [ ] Foundry iterations documentees
- [ ] Benchmark documente
- [ ] Tous les tests passent, 0 regression
- [ ] `dotnet build` : 0 erreurs
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] Real demo check : PASS

### NOT in scope

- /adapt workflow (Phase 63)
- Production de ~30 variantes (Phase 64)
- Modification du ContractTestRunner (sauf bugs bloquants)
- Nouveaux contracts
