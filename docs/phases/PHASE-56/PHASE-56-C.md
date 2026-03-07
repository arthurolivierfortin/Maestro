# Phase 56-C : TUI + Validation E2E

**Statut** : A FAIRE
**Effort estime** : 1 jour
**Prerequis** : Phase 56-B COMPLETE

---

## Objectif

Le fitness est visible et actionnable dans le TUI. Le E2E complet prouve que la chaine fonctionne de bout en bout : LLM-Provider → estimation cout → accumulation → fitness → affichage.

---

## Etat actuel du TUI — Ce qui existe deja

| Composant | Existant | Etat |
|-----------|----------|------|
| `CatalogScreen` | Affiche `block.fitness` avec progress bar + couleur | Toujours null (jamais calcule) |
| `BlockDetail` | Affiche fitness breakdown (P, S, W) + task fitness (4 dims) | Toujours null |
| `MetricsPanel` | Affiche tokens mais PAS le cout USD | Tokens seulement |
| `CatalogScreen` raccourci `[T]` | **N'existe pas** | A ajouter |
| Cout USD dans le TUI | **N'existe nulle part** | A ajouter |

---

## Tache 1 : CatalogScreen — raccourci [T] pour tester un block

### Fichier

`packages/maestro-code/components/CatalogScreen.ts`

### Comportement

1. L'utilisateur selectionne un block dans le catalog
2. L'utilisateur appuie sur `[T]`
3. Le TUI verifie que le block a un `contract` dans sa definition
   - Si non : afficher "No contract defined for this block"
   - Si oui : continuer
4. Afficher un etat de chargement : `Testing {blockId} against {contractId}...`
5. Appeler `apiClient.contracts.test(contractId, blockId)`
6. Afficher le resultat inline dans le detail panel

### Design d'affichage

Quand le test est en cours :
```
> maestro-assistant  agent  Testing against maestro-assistant...
```

Quand le test est termine :
```
> maestro-assistant  agent  Fitness: 15% [$0.42]

  Contract: maestro-assistant v2.0.0
  Tests: 24/24 passed | Cost: $0.42 | Duration: 45.2s

  Features:
  ├─ conversation     7/7   ████████████ 100%
  ├─ maestro-ops      7/7   ████████████ 100%
  ├─ orchestration    5/5   ████████████ 100%
  └─ memory           5/5   ████████████ 100%

  Fitness Breakdown:
  ├─ Performance:     0.95
  ├─ Specialization:  0.48
  ├─ Composability:   1.00
  └─ Cost Factor:     ×4.1 (C_norm=2.3 × C_compute=11.0 × C_hw=1.0)^0.3
```

### Implementation

1. Ajouter state : `testingBlockId: string | null`, `testResult: ContractTestResult | null`
2. Ajouter handler dans `useKeyboard` : `t` → declencher le test
3. Le test est async — utiliser `useState` + `useEffect` pattern
4. Pendant le test, le block selectionne affiche le spinner
5. Apres le test, stocker le resultat dans le state et l'afficher dans la zone expand

### Points d'attention

- Le test prend 30-60s (24 appels LLM) → le TUI doit rester reactif
- Ne PAS bloquer la navigation pendant le test
- Si l'utilisateur change de block pendant le test, annuler n'est pas necessaire mais le resultat doit s'afficher pour le bon block
- Erreur reseau/API : afficher le message d'erreur inline, pas de crash

---

## Tache 2 : Affichage du cout USD dans le detail

### Fichier

`packages/maestro-code/components/BlockDetail.ts`

### Actions

1. Si `block.fitness` est non-null, afficher le cout a cote du fitness :
   ```
   Fitness: 15%  Cost: $0.42
   ```

2. Si le block a un `lastTestResult` en memoire (depuis le `[T]` test), afficher le breakdown complet.

3. Formater le cout :
   - `< $0.01` → `< $0.01`
   - `$0.01 - $9.99` → `$X.XX`
   - `$10+` → `$XX.XX`
   - `$0.00` (local) → `Free`

---

## Tache 3 : Hint dans la barre de raccourcis

### Fichier

`packages/maestro-code/components/CatalogScreen.ts`

### Actions

La barre de raccourcis en bas du CatalogScreen doit inclure `[T]` :
```
[1-4] Filter  [↑↓] Navigate  [Enter] Expand  [T] Test  [Esc] Back
```

Le hint `[T] Test` est affiche seulement quand un block est selectionne et a un contract.

---

## Tache 4 : Tests unitaires

### Fichiers

| Fichier | Tests |
|---------|-------|
| `tests/CatalogContractTest.test.ts` | **NOUVEAU** — test du raccourci [T] et affichage resultat |

### Scenarios

1. **Block sans contract** : appuyer sur `[T]` → message "No contract"
2. **Block avec contract** : appuyer sur `[T]` → appel API mock → affichage resultat
3. **API error** : appuyer sur `[T]` → erreur → affichage message erreur
4. **Resultat affiché** : verifier que fitness, features, cout sont presents dans le rendu

### Pattern de test

```typescript
import { render } from 'ink-testing-library';
import { createElement as h } from 'react';
// ... mock apiClient.contracts.test()
```

---

## Tache 5 : Validation E2E complete

### Prerequis

- Backend demarre (`dotnet run` port 5000)
- LLM-Provider demarre (port 5010)
- Un modele Claude configure et disponible

### Test E2E 1 : Via CLI

```bash
cd packages/maestro-cli
node index.js contract test maestro-assistant --block system:maestro-assistant
```

**Criteres** :
- [ ] 24/24 tests passent (Claude est bon)
- [ ] `estimatedCostUsd > 0` (cout reel mesure)
- [ ] `fitness < 0.5` (Claude est cher → denominateur eleve)
- [ ] `performanceScore > 0.9` (qualite elevee)
- [ ] Breakdown affiche avec toutes les composantes non-zero

### Test E2E 2 : Via curl

```bash
curl -X POST "http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant" | jq '.'
```

**Criteres** :
- [ ] Reponse JSON complete avec tous les champs
- [ ] `estimatedCostUsd` > 0
- [ ] `fitnessBreakdown.economicCost` > 1.0 (pas le fallback 1.0 de $0.001)
- [ ] `features` contient 4 entries avec scores
- [ ] `testResults` contient 24 entries

### Test E2E 3 : Via TUI

1. Lancer maestro-code
2. Naviguer vers Catalog (`[5]`)
3. Selectionner `maestro-assistant`
4. Appuyer sur `[T]`
5. Attendre le resultat (30-60s)

**Criteres** :
- [ ] Spinner affiche pendant le test
- [ ] Resultat affiche avec fitness + features + cout
- [ ] Progress bars colories correctement (vert pour 100%)
- [ ] Le TUI reste reactif pendant le test

### Test E2E 4 : Verifier la coherence

Comparer :
- `performanceScore` (P) devrait etre proche de 1.0 → tous tests passent
- `fitness` devrait etre significativement plus bas → cout penalise
- Le ratio P/fitness indique l'impact du cout

---

## Verification globale 56-C

```bash
# TypeScript
cd packages/maestro-code && npx tsc --noEmit      # 0 errors
cd packages/maestro-code && npx vitest run          # tous tests passent
cd packages/maestro-code && node tests/real-demo-check.cjs  # TUI se lance

# Fonctionnel
node packages/maestro-cli/index.js contract test maestro-assistant --block system:maestro-assistant
# → tous tests passent, cout > 0, fitness < 0.5
```

---

## Definition of Done 56-C

- [ ] `CatalogScreen` : `[T]` lance un contract test sur le block selectionne
- [ ] Spinner pendant le test, resultat inline apres
- [ ] Affichage : fitness + features (avec scores et progress bars) + cout + breakdown
- [ ] Hint `[T] Test` dans la barre de raccourcis
- [ ] Tests unitaires pour le raccourci [T]
- [ ] `npx tsc --noEmit` : 0 errors
- [ ] `npx vitest run` : tous tests passent
- [ ] `real-demo-check.cjs` : TUI se lance sans crash
- [ ] E2E CLI : 24/24 tests, cost > 0, fitness < 0.5, performance > 0.9
- [ ] E2E TUI : test lance via [T], resultat affiche correctement

---

## Definition of Done Phase 55 Complete

Quand 55-A + 55-B + 56-C sont termines :

- [ ] La chaine de cout est complete : LLM call → tokens → prix reel → accumulation → fitness
- [ ] Plus de table hardcodee dans `LLMBlockExecutorBase`
- [ ] Les prix viennent de LLM-Provider (principle : "LLM-Provider owns all provider logic")
- [ ] L'utilisateur peut tester un block contre son contract depuis CLI OU TUI
- [ ] Le fitness score reflete la realite : bon modele cher = tests passent + fitness bas
- [ ] La fondation est posee pour Phase 56 (agent-creator) et au-dela
