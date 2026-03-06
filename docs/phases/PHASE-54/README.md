# Phase 54 : Re-verification Phase 52 — Contract Test Runner + FitnessScore

**Statut** : COMPLETE
**Prerequis** : Phase 53 COMPLETE (tool dispatch extrait)
**Objectif** : Corriger les 3 problemes de Phase 52-C (fitness formula, test-suites separees, tool mapping). Puis re-tester l'agent test-designer de bout en bout avec la nouvelle architecture (dispatch extrait, FitnessScore reel, tests dans le contract). Le test-designer doit fonctionner correctement avant de passer a l'agent-creator (Phase 55).
**Duree estimee** : 3-4 jours

---

## Problemes identifies (Phase 52-C)

### 1. ContractTestRunner utilise une formule simpliste au lieu de FitnessScore

**Actuel** : `weighted_average(pass_rate)` → peut donner 1.0 (impossible dans le vrai systeme)

**Cible** : Utiliser `FitnessScore.Calculate()` qui prend en compte :
- P (Performance) = weighted average des scores de features (= les resultats de test)
- S (Specialization) = P / TaskEntropy
- W (Composability) = success_rate × retry_penalty
- C_norm, C_compute, C_hw = couts normalises
- λ = sensibilite au cout (default 0.3)

Un score de 1.0 est **impossible** car les couts reduisent toujours le score.

### 2. Les tests vivent DANS le contract, pas dans des fichiers test-suite separes

**Actuel** : `content/system/test-suites/*.test-suite.json` existe en parallele des contracts

**Cible** :
- Les tests sont dans `features[].tests[]` du contract JSON
- Le test-designer modifie les tests **dans** le contract
- Le contract est la source de verite unique, versionne et publiable
- Supprimer `content/system/test-suites/` et le parametre `testSuitePath`

### 3. Le Contract Test Runner doit fonctionner avec le tool dispatch compose

**Actuel** : Le runner cree un `ExecutionContext` basique et invoque l'agent directement

**Cible** : Le runner peut configurer un `_toolMapping` dans le contexte pour tester avec des tools mappes (mock-file-write, etc.)

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 54-A | Merger tests dans contracts, supprimer test-suites, nettoyer parametres | 1 jour |
| 54-B | Integrer FitnessScore.Calculate() dans ContractTestRunner | 1 jour |
| 54-C | Re-test complet de l'agent test-designer avec la nouvelle architecture | 1-1.5 jours |
| 54-D | Iteration si necessaire (fix agent, fix runner, fix environment) | 0.5-1 jour |

---

## 54-A : Merger et nettoyer

### Taches

1. **Merger les bons tests des test-suites dans les contracts** :
   - Lire `content/system/test-suites/maestro-assistant.test-suite.json`
   - Identifier les tests qui ajoutent de la valeur au contract `maestro-assistant`
   - Les ajouter dans `content/system/contracts/maestro-assistant.contract.json`
   - Meme chose pour `test-designer.test-suite.json` → `test-designer.contract.json`

2. **Supprimer `content/system/test-suites/`** — le concept n'existe plus

3. **Nettoyer `ContractTestRunner.cs`** :
   - Supprimer le parametre `testSuitePath` de `RunAsync()`
   - Supprimer la logique de merge test-suite/contract
   - Les tests viennent uniquement du contract JSON

4. **Nettoyer `ContractTestController.cs`** :
   - Supprimer le parametre `testSuitePath` de l'endpoint POST

5. **Nettoyer le tool block `contract-test`** :
   - Supprimer l'input `testSuitePath`

6. **Mettre a jour `contract-resolver.ts`** (si necessaire) :
   - Supprimer les references aux test-suites embeddes

---

## 54-B : Integrer FitnessScore

### Taches

1. **Modifier `ContractTestRunner.RunAsync()`** :
   - Apres avoir calcule `weighted_average(feature_scores)` → c'est le P (Performance)
   - Construire un `WorkflowExecutionMetrics` avec les donnees du test run
   - Construire un `ModelProfile` depuis le block (modele, parametres)
   - Construire un `TaskEntropy` (nombre de features, complexite)
   - Appeler `FitnessScore.Calculate(metrics, modelProfile, taskEntropy, config)`
   - Retourner le vrai score de fitness

2. **Ajouter `IFitnessService` au DI de `ContractTestRunner`** (ou utiliser `FitnessScore.Calculate()` directement)

3. **Mettre a jour `ContractTestResult`** :
   - Ajouter `performanceScore` (le P brut)
   - Le `fitness` existant contient le score final post-FitnessScore

---

## 54-C : Re-test complet de l'agent test-designer

L'agent test-designer a ete cree en Phase 52. Il faut verifier qu'il fonctionne toujours avec :
- Le nouveau `IToolDispatcher` (Phase 53) au lieu du dispatch monolithique
- Les tests dans le contract (plus de test-suites separees)
- La vraie formule `FitnessScore.Calculate()` pour le scoring

### Taches

1. **Rebuild et tests unitaires** :
   ```bash
   cd apps/backend && dotnet build
   cd packages/maestro-code && npx vitest run
   ```

2. **E2E : Invoquer le test-designer via pipeline Maestro** :
   - Creer une session, enregistrer un entry point, lancer le monitor
   - Invoquer le test-designer avec `contractId=maestro-assistant`
   - Verifier qu'il lit le contract, genere des tests, valide le JSON, appelle step-complete
   - Verifier que les tool calls passent par le nouveau dispatcher

3. **E2E : Contract test runner sur test-designer** :
   ```bash
   curl -X POST http://localhost:5000/api/contracts/test-designer/test?blockId=test-designer
   ```
   - Le fitness ne doit PAS etre 1.0 (impossible avec FitnessScore)
   - Chaque feature doit avoir un score realiste
   - Les tests viennent du contract JSON, pas d'un fichier test-suite
   - Analyser le score : est-il raisonnable pour le modele utilise ?

4. **E2E : Contract test runner sur maestro-assistant** :
   ```bash
   curl -X POST http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant
   ```

5. **Verification avec tool mapping** (si Phase 53-B est complete) :
   - Creer une session avec `_toolMapping`
   - Invoquer le contract test runner dans cette session
   - Les tools mappes sont utilises

---

## 54-D : Iteration si necessaire

Si des tests echouent en 54-C, c'est ici qu'on corrige. **Regle absolue : on ne faiblit jamais les tests.** On corrige :
- L'agent (meilleur prompt, meilleures instructions)
- Le runner (meilleure capture des outputs, meilleure evaluation des checks)
- L'environnement (tools manquants, permissions, contexte incomplet)

### Criteres de reussite
- Le test-designer passe au minimum 80% des tests de son contract
- Le score de fitness est realiste (< 1.0, reflete les couts du modele)
- Aucune regression sur les tests existants

---

## Definition of Done

- [x] `content/system/test-suites/` supprime
- [x] `testSuitePath` supprime de ContractTestRunner, ContractTestController, contract-test tool block
- [x] Tests du contract sont dans le contract JSON (source unique)
- [x] ContractTestRunner utilise `FitnessScore.Calculate()`
- [x] Le score de fitness n'est plus 1.0 pour un test parfait
- [x] `ContractTestResult` inclut `performanceScore` et `fitness`
- [x] SendPromptToBlockAsync fournit sessionId (regression Phase 53 corrigee)
- [x] **Le test-designer fonctionne avec le nouveau dispatcher (Phase 53)** — ToolDispatcherBlockExecutor dispatches file-read/file-write correctly
- [x] **Le test-designer passe son contract avec un score realiste** — fitness=0.0037, P=0.3, NOT 1.0
- [x] **Invocation E2E du test-designer via pipeline Maestro reussie** — 3 iterations, 12 tests generated, clean completion
- [x] Tous les tests existants passent

### NOT in scope
- Agent agent-creator (Phase 55)
- Workflow block-forge (Phase 56)
- Creation de mock tools specifiques (les utilisateurs les creent comme blocks)
