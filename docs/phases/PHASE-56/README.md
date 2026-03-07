# Phase 56 : Metrics Pipeline — Fitness Accuracy

**Statut** : COMPLETE
**Prerequis** : Phase 55 COMPLETE (Block Dependency Resolution)
**Objectif** : Rendre le fitness score REEL. Reparer la chaine de cout, connecter LLM-Provider → ModelProfile, exposer dans le SDK/CLI/TUI.
**Duree estimee** : 3 jours

---

## Contexte — Pourquoi maintenant

Les metriques sont le coeur de Maestro. L'optimisation et la reduction de cout est le but principal de l'app. Or la chaine de cout est **cassee** :

1. `ContractTestRunner` ne somme jamais les couts des tests individuels → `EstimatedCostUsd = 0`
2. `LLMBlockExecutorBase.EstimateCost()` utilise une table hardcodee → deconnecte de LLM-Provider
3. `ModelProfile.CreateGeneric("unknown")` → compute cost artificiel de 1100
4. LLM-Provider fournit `InputTokenPrice`/`OutputTokenPrice` mais le mapping Maestro les drop
5. Le TUI `CatalogScreen` affiche deja le fitness mais il est toujours null

Phase 56 (agent-creator) va creer des blocks. Si le fitness est faux, tout ce qui suit (block-forge, /adapt, variantes) est construit sur du sable.

---

## Decisions architecturales (tranchees)

### 1. LLM-Provider fournit, Maestro consomme
- Les prix viennent de l'API `/api/v1/models/`, pas de tables C#
- Maestro fetch et cache les ModelInfo au demarrage
- **Supprimer** la table hardcodee dans `LLMBlockExecutorBase.EstimateCost()`

### 2. Configurable vs factuel
- **Faits** (prix, parametres) : viennent de LLM-Provider, PAS configurables
- **Preferences** (lambda, poids P/S/W) : configurables via `FitnessConfig` (deja en place)

### 3. Pas de priorisation de modeles dans cette phase
- Le fitness suffit pour V1. La priorisation sera un filtre au moment du choix (Phase 60)

---

## Sous-phase 56-A : Reparer la chaine de cout (backend, ~1 jour)

**Objectif** : Les couts sont mesures et circulent correctement de l'appel LLM jusqu'au fitness.

### Tache 1 : Mapper les prix depuis LLM-Provider

**Fichiers** :
- `Infrastructure/LLMGateway/LLMProviderService.cs` (ligne 436) : `ProviderModelInfo`
- `Application/DTOs/LLMDtos.cs` (ligne 85) : `CompatibleModel`

**Ce qui manque** : `ProviderModelInfo` ne capture pas `InputTokenPrice`/`OutputTokenPrice` depuis la reponse LLM-Provider.

**Actions** :
1. Ajouter `InputTokenPrice` et `OutputTokenPrice` (decimal?) a `ProviderModelInfo`
2. Ajouter `InputTokenPrice` et `OutputTokenPrice` (decimal?) a `CompatibleModel`
3. Mapper dans `GetCompatibleModelsAsync()` (ligne 154)
4. Ajouter `ParametersBillions` optionnel dans `ProviderModelInfo` si fourni par LLM-Provider

### Tache 2 : Remplacer EstimateCost() hardcode par lookup dynamique

**Fichier** : `Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` (lignes 237-280)

**Etat actuel** : Table hardcodee `if (id.Contains("opus")) → 15m/75m`

**Actions** :
1. Creer `IModelPricingService` dans `Application/Interfaces/`
   - `Task<(decimal inputPricePerMillion, decimal outputPricePerMillion)?> GetPricingAsync(string modelId)`
   - Implementation : cache des prix fetches depuis `/api/v1/models/` via `ILLMProviderService`
2. Injecter dans `LLMBlockExecutorBase`
3. `EstimateCost()` → `EstimateCostAsync()` : lookup prix via service, fallback sur estimation si indisponible
4. Supprimer la table hardcodee (garder un fallback minimal pour les modeles non-resolus : $5/$15 per million)

### Tache 3 : Accumuler les couts dans ContractTestRunner

**Fichier** : `Infrastructure/Testing/ContractTestRunner.cs`

**Etat actuel** : `result.EstimatedCostUsd` reste a 0 (DTO default). Les `BlockExecutionResult` individuels contiennent le cout mais il n'est jamais somme.

**Actions** :
1. Dans `ExecuteTestAsync()` : retourner le `BlockExecutionResult` en plus du `SingleTestResult`
2. Dans `RunInternalAsync()` : accumuler les couts :
   ```csharp
   decimal totalCost = 0;
   // ... dans la boucle de tests:
   totalCost += blockResult.EstimatedCostUsd;
   // ... avant FitnessScore.Calculate():
   result.EstimatedCostUsd = totalCost;
   ```
3. Utiliser `totalCost` dans `WorkflowExecutionMetrics.TotalCostUsd`

### Tache 4 : Resoudre le vrai modele dans ContractTestRunner

**Fichier** : `Infrastructure/Testing/ContractTestRunner.cs` (ligne 223-227)

**Etat actuel** : `ModelProfile.CreateGeneric("unknown", "unknown")` → placeholder 100B params.

**Actions** :
1. Injecter `IModelPricingService` dans `ContractTestRunner`
2. Resoudre le modele reel du block : `block.Config["model"]` OU modele actif de la session
3. Construire un `ModelProfile` a partir des donnees reelles (prix, taille si disponible)
4. Si le modele est inconnu, `CreateGeneric()` reste le fallback

### Tache 5 : Propagation des couts multi-modele

**Fichiers** : `BlockRefHandler.cs`, `MultiNodeBlockExecutor.cs`, `AgentBlockExecutor.cs`

**Etat actuel** : `BlockRefHandler.SerializeBlockOutput()` ne serialise que le texte — les couts du `BlockExecutionResult` des sous-blocs sont perdus. `AgentBlockExecutor.ExtractResultAsync()` cree un nouveau result sans aucun cout.

**Actions** :
1. `BlockRefHandler` : apres `executor.ExecuteAsync()`, accumuler les couts dans les variables de session (`_accumulatedCost`, `_accumulatedPromptTokens`, `_accumulatedCompletionTokens`)
2. `MultiNodeBlockExecutor` : methode protected `GetAccumulatedCosts()` pour lire les couts accumules
3. `AgentBlockExecutor.ExtractResultAsync()` : reporter les couts accumules sur le `BlockExecutionResult` final
4. Impact : les workflows multi-modele (Opus planning + Haiku execution) propagent correctement le cout total

### Verification 56-A
```bash
cd apps/backend && dotnet build   # 0 errors
cd apps/backend && dotnet test    # all tests pass
# Test fonctionnel :
curl http://localhost:5000/api/provider/models | jq '.[0].inputTokenPrice'  # non-null
```

---

## Sous-phase 56-B : SDK + CLI + LLM-Provider enrichissement (~1 jour)

**Objectif** : Exposer le contract test via SDK et CLI. Enrichir LLM-Provider si necessaire.

### Tache 1 : Ajouter `parametersBillions` a LLM-Provider (optionnel)

**Fichier** : `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json`

**Actions** :
1. Ajouter `ParametersBillions` optionnel dans la config model du LLM-Provider
2. Remplir pour les modeles connus (Claude Sonnet ~70B, Claude Opus ~200B, GPT-4 ~1760B)
3. Mapper dans `ModelResponse` du LLM-Provider
4. Le champ est optionnel — les modeles sans cette info retournent null

### Tache 2 : SDK client — ajouter contracts.test()

**Fichier** : `packages/maestro-client/src/index.ts`

**Actions** :
1. Ajouter domaine `contracts` au client SDK :
   ```typescript
   contracts: {
     list(): Promise<Contract[]>
     get(id: string): Promise<Contract>
     test(contractId: string, blockId: string): Promise<ContractTestResult>
   }
   ```
2. Ajouter types dans `types.ts` :
   ```typescript
   interface ContractTestResult {
     contractId: string;
     blockId: string;
     fitness: number;
     performanceScore: number;
     fitnessBreakdown: FitnessBreakdown;
     passed: boolean;
     features: FeatureTestResult[];
     testResults: SingleTestResult[];
     totalTests: number;
     passedTests: number;
     failedTests: number;
     estimatedCostUsd: number;
     durationMs: number;
   }
   ```

### Tache 3 : CLI — ajouter `maestro contract test`

**Fichier** : `packages/maestro-cli/cli.ts`

**Actions** :
1. Ajouter sous-commande `contract` avec actions :
   - `maestro contract list` → GET /api/contracts
   - `maestro contract test <contractId> --block <blockId>` → POST /api/contracts/{id}/test?blockId=X
   - Affichage : features avec score, tests passed/failed, fitness, cout, breakdown
2. Adapter l'api-client.ts avec les methodes SDK

### Verification 56-B
```bash
cd packages/maestro-cli && npx tsc --noEmit
cd packages/maestro-client && npx tsc --noEmit
node index.js contract list
node index.js contract test maestro-assistant --block system:maestro-assistant
```

---

## Sous-phase 56-C : TUI + Validation E2E (~1 jour)

**Objectif** : Le fitness est visible dans le TUI avec breakdown, et le E2E prouve que tout fonctionne.

### Tache 1 : Enrichir CatalogScreen avec les prix modele

**Fichier** : `packages/maestro-code/components/CatalogScreen.ts`

**Etat actuel** : Affiche `block.fitness` (toujours null) avec progress bar.

**Actions** :
1. Quand un block a un `contract`, afficher le contract ID a cote du type badge
2. Ajouter un raccourci `[T]` pour lancer un contract test sur le block selectionne
   - Appel SDK : `client.contracts.test(block.contract, block.id)`
   - Afficher un spinner pendant l'execution
   - Afficher le resultat inline : fitness score + features passed/failed + cout
3. Le fitness retourne persiste sur le block dans le catalog (via `block.fitness`)

### Tache 2 : Block detail panel avec breakdown

**Actions** :
1. Quand un block est selectionne (expand) et a un fitness, afficher le breakdown :
   ```
   Fitness: 0.15  [████░░░░░░░░] 15%
   ├─ Performance:     0.95  (24/24 tests passed)
   ├─ Specialization:  0.48  (4 features)
   ├─ Composability:   1.00
   ├─ Economic Cost:   2.30  ($0.42)
   ├─ Compute Cost:   11.00  (~70B params)
   └─ Hardware Cost:   1.00  (cloud)
   ```
2. Afficher les features avec leur score :
   ```
   Features:
   ├─ conversation     7/7  ████████████ 100%  ✓
   ├─ maestro-ops      7/7  ████████████ 100%  ✓
   ├─ orchestration    5/5  ████████████ 100%  ✓
   └─ memory           5/5  ████████████ 100%  ✓
   ```

### Tache 3 : Validation E2E complete

**Actions** :
1. Demarrer backend + LLM-Provider
2. **Test 1** : Via CLI
   ```bash
   node index.js contract test maestro-assistant --block system:maestro-assistant
   ```
   Attendu :
   - Tous les 24 tests passent (Claude est bon)
   - `estimatedCostUsd > 0` (cout reel mesure)
   - `fitness < 0.5` (Claude est cher → denominateur eleve)
   - `performanceScore > 0.9` (qualite elevee)

3. **Test 2** : Via curl direct
   ```bash
   curl -X POST "http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant"
   ```
   Verifier que la reponse contient un breakdown complet avec toutes les composantes non-zero.

4. **Test 3** : Via TUI
   - Ouvrir maestro-code
   - Aller dans Catalog (`[5]`)
   - Selectionner maestro-assistant
   - Appuyer sur `[T]` pour tester
   - Verifier l'affichage du fitness + features + cout

### Verification 56-C
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
cd packages/maestro-code && node tests/real-demo-check.cjs
```

---

## Resume des modifications par fichier

### Backend (C#)
| Fichier | Modification |
|---------|-------------|
| `Application/Interfaces/IModelPricingService.cs` | **NOUVEAU** — interface pricing lookup |
| `Application/DTOs/LLMDtos.cs` | Ajouter `InputTokenPrice`, `OutputTokenPrice` a `CompatibleModel` |
| `Infrastructure/LLMGateway/LLMProviderService.cs` | Ajouter prix a `ProviderModelInfo` + mapping |
| `Infrastructure/Pricing/ModelPricingService.cs` | **NOUVEAU** — implementation avec cache |
| `Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` | Remplacer table hardcodee par pricing service |
| `Infrastructure/Testing/ContractTestRunner.cs` | Accumuler couts, resoudre vrai modele |
| `Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Accumuler couts des sous-blocs dans variables session |
| `Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` | Methode `GetAccumulatedCosts()` |
| `Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Reporter couts accumules dans `ExtractResultAsync` |
| `Api/Program.cs` | Enregistrer `IModelPricingService` dans DI |

### LLM-Provider (.NET)
| Fichier | Modification |
|---------|-------------|
| `LLMProvider.Web/appsettings.json` | Ajouter `ParametersBillions` aux modeles connus |
| `LLMProvider.Domain/Entities/ModelInfo.cs` | Ajouter `ParametersBillions` optionnel |
| `LLMProvider.Web/Endpoints/ModelsEndpoints.cs` | Mapper dans `ModelResponse` |

### SDK/CLI/TUI (TypeScript)
| Fichier | Modification |
|---------|-------------|
| `packages/maestro-client/src/types.ts` | Ajouter `ContractTestResult`, `FeatureTestResult`, `SingleTestResult` |
| `packages/maestro-client/src/index.ts` | Ajouter domaine `contracts` |
| `packages/maestro-cli/cli.ts` | Ajouter commande `contract list/test` |
| `packages/maestro-cli/api-client.ts` | Wrapper SDK contracts |
| `packages/maestro-code/components/CatalogScreen.ts` | `[T]` test, breakdown display |

---

## Definition of Done

- [ ] `ProviderModelInfo` et `CompatibleModel` incluent les prix des modeles
- [ ] `EstimateCost()` utilise les prix reels via `IModelPricingService` (plus de table hardcodee)
- [ ] `ContractTestRunner.EstimatedCostUsd` reflete le cout reel des tests executes
- [ ] Les couts des sous-blocs (multi-modele) propagent via `BlockRefHandler` → parent
- [ ] `FitnessScore.Calculate()` recoit le vrai cout et le vrai profil modele
- [ ] SDK `client.contracts.test()` fonctionne
- [ ] CLI `maestro contract test maestro-assistant --block system:maestro-assistant` fonctionne
- [ ] TUI `CatalogScreen` : `[T]` lance un test et affiche fitness + features + cout
- [ ] E2E : tests passent, fitness < 0.5 (Claude cher), cost > 0, breakdown complet
- [ ] Tous les tests existants passent (backend + TS)

### NOT in scope
- Agent agent-creator (Phase 56)
- Workflow block-forge (Phase 57)
- Configuration FitnessConfig via UI (existe deja via API)
- Priorisation de modeles par l'utilisateur (Phase 60)
- Nouveau contract ou block
- Persistence du fitness sur le block (sera fait quand block-forge cree des blocks)
