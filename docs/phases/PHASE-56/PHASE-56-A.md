# Phase 56-A : Reparer la chaine de cout (backend)

**Statut** : DONE (2026-03-06)
**Effort estime** : 1 jour
**Prerequis** : Phase 55 COMPLETE

---

## Objectif

Les couts sont mesures et circulent correctement de l'appel LLM jusqu'au fitness score. Chaque appel LLM produit un cout reel, et ce cout remonte dans `FitnessScore.Calculate()`.

---

## Etat actuel — La chaine cassee

```
LLM-Provider repond avec tokens + prix disponibles ✓
  → LLMProviderService mappe dans CompatibleModel SANS les prix ✗ (Tache 1)
    → LLMBlockExecutorBase.EstimateCost() utilise une table hardcodee ✗ (Tache 2)
      → InferenceBlockExecutor set EstimatedCostUsd sur BlockExecutionResult ✓
        → BlockRefHandler.SerializeBlockOutput() drop les couts ✗ (Tache 5)
          → AgentBlockExecutor.ExtractResultAsync() cree result SANS couts ✗ (Tache 5)
            → ContractTestRunner NE SOMME PAS les couts ✗ (Tache 3)
              → WorkflowExecutionMetrics.TotalCostUsd = 0 ✗
                → FitnessScore.Calculate() recoit 0 → fallback $0.001 ✗
```

---

## Tache 1 : Mapper les prix depuis LLM-Provider

### Contexte

LLM-Provider fournit `InputTokenPrice` et `OutputTokenPrice` dans `ModelResponse`. Mais `ProviderModelInfo` (le DTO interne de Maestro) ne capture pas ces champs. Le mapping dans `GetCompatibleModelsAsync()` les drop.

### Fichiers

| Fichier | Lignes | Modification |
|---------|--------|-------------|
| `Infrastructure/LLMGateway/LLMProviderService.cs` | 436-445 | Ajouter prix a `ProviderModelInfo` |
| `Infrastructure/LLMGateway/LLMProviderService.cs` | 154-162 | Mapper prix dans `GetCompatibleModelsAsync()` |
| `Application/DTOs/LLMDtos.cs` | 85-107 | Ajouter prix a `CompatibleModel` |

### Actions

1. `ProviderModelInfo` — ajouter :
   ```csharp
   public decimal? InputTokenPrice { get; set; }   // per 1000 tokens
   public decimal? OutputTokenPrice { get; set; }   // per 1000 tokens
   public double? ParametersBillions { get; set; }
   ```

2. `CompatibleModel` — ajouter :
   ```csharp
   public decimal? InputTokenPricePerMillion { get; init; }
   public decimal? OutputTokenPricePerMillion { get; init; }
   ```
   Note : convertir de "per 1000" (LLM-Provider) a "per million" (Maestro convention).

3. Mapping dans `GetCompatibleModelsAsync()` :
   ```csharp
   InputTokenPricePerMillion = m.InputTokenPrice.HasValue ? m.InputTokenPrice.Value * 1000 : null,
   OutputTokenPricePerMillion = m.OutputTokenPrice.HasValue ? m.OutputTokenPrice.Value * 1000 : null,
   ```

### Verification
```bash
curl http://localhost:5000/api/provider/models | jq '.models[0] | {modelId, inputTokenPricePerMillion, outputTokenPricePerMillion}'
# Attendu : prix non-null pour les modeles cloud
```

---

## Tache 2 : Creer IModelPricingService

### Contexte

`LLMBlockExecutorBase.EstimateCost()` (lignes 237-280) contient une table hardcodee :
```csharp
if (id.Contains("opus")) { inputPerM = 15m; outputPerM = 75m; }
else if (id.Contains("sonnet")) { inputPerM = 3m; outputPerM = 15m; }
```

Cette table est deconnectee de LLM-Provider et de `ModelProfile`. Elle doit etre remplacee par un service qui fetch les vrais prix.

### Fichiers

| Fichier | Action |
|---------|--------|
| `Application/Interfaces/IModelPricingService.cs` | **NOUVEAU** |
| `Infrastructure/Pricing/ModelPricingService.cs` | **NOUVEAU** |
| `Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` | Remplacer `EstimateCost()` |
| `Api/Program.cs` | Enregistrer dans DI |

### Design

```csharp
// Application/Interfaces/IModelPricingService.cs
public interface IModelPricingService
{
    /// <summary>
    /// Get pricing for a model. Returns null if model not found.
    /// Caches prices fetched from LLM-Provider.
    /// </summary>
    Task<ModelPricing?> GetPricingAsync(string modelId, CancellationToken ct = default);

    /// <summary>
    /// Estimate cost from token counts. Uses cached pricing.
    /// </summary>
    Task<decimal> EstimateCostAsync(string modelId, int promptTokens, int completionTokens, CancellationToken ct = default);
}

public record ModelPricing(
    decimal InputPricePerMillion,
    decimal OutputPricePerMillion,
    double? ParametersBillions);
```

### Implementation

`ModelPricingService` :
1. Injecte `ILLMProviderService`
2. Au premier appel : fetch `GetCompatibleModelsAsync()` et cache les prix dans un `ConcurrentDictionary<string, ModelPricing>`
3. TTL du cache : 5 minutes (refresh automatique)
4. Fallback pour modeles inconnus : `$5/$15 per million` (cloud generique)
5. Fallback pour modeles locaux (prix = 0) : `$0/$0`

### Migration de EstimateCost()

`LLMBlockExecutorBase` :
1. Ajouter `IModelPricingService` au constructeur (protected, passe par les sous-classes)
2. Remplacer `EstimateCost()` statique par un appel au service :
   ```csharp
   protected async Task<decimal> EstimateCostAsync(string? modelId, int promptTokens, int completionTokens)
   {
       if (string.IsNullOrEmpty(modelId)) return 0m;
       return await _pricingService.EstimateCostAsync(modelId, promptTokens, completionTokens);
   }
   ```
3. Supprimer la table hardcodee
4. Mettre a jour `InferenceBlockExecutor` pour appeler la version async

### Impact DI

Verifier que `InferenceBlockExecutor` et toutes les sous-classes de `LLMBlockExecutorBase` recoivent le service. Attention a la resolution DI — `LLMBlockExecutorBase` est abstract, les constructeurs des sous-classes doivent forwarder.

---

## Tache 3 : Accumuler les couts dans ContractTestRunner

### Contexte

`ContractTestRunner` execute N tests, chacun produit un `BlockExecutionResult` avec `EstimatedCostUsd`. Mais le runner ne les somme jamais. `result.EstimatedCostUsd` reste a 0.

### Fichier

`Infrastructure/Testing/ContractTestRunner.cs`

### Actions

1. Declarer un accumulateur dans `RunInternalAsync()` :
   ```csharp
   decimal totalCost = 0;
   int totalPromptTokens = 0;
   int totalCompletionTokens = 0;
   ```

2. Modifier `ExecuteTestAsync()` pour retourner aussi le `BlockExecutionResult` :
   ```csharp
   private async Task<(SingleTestResult test, BlockExecutionResult? block)> ExecuteTestAsync(...)
   ```

3. Accumuler dans la boucle de tests :
   ```csharp
   var (testResult, blockResult) = await ExecuteTestAsync(test, block, featureId, ct);
   if (blockResult != null)
   {
       totalCost += blockResult.EstimatedCostUsd;
       totalPromptTokens += blockResult.PromptTokens;
       totalCompletionTokens += blockResult.CompletionTokens;
   }
   ```

4. Avant `FitnessScore.Calculate()` :
   ```csharp
   result.EstimatedCostUsd = totalCost;
   // ... dans WorkflowExecutionMetrics:
   TotalCostUsd = totalCost,
   ```

### Verification
```bash
# Apres un contract test, le cout doit etre > 0
curl -X POST "http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant" | jq '.estimatedCostUsd'
# Attendu : > 0 (pas 0)
```

---

## Tache 4 : Resoudre le vrai modele dans ContractTestRunner

### Contexte

Ligne 223-227 :
```csharp
var modelId = "unknown";
if (block.Config != null && block.Config.TryGetValue("model", out var modelObj))
    modelId = modelObj?.ToString() ?? "unknown";
var profile = ModelProfile.CreateGeneric(modelId, "unknown");
```

Les blocks agent n'ont pas `config.model` — ils delegent au LLM-Provider. Le modele est toujours "unknown" → `CreateGeneric()` cree un profil 100B params → compute cost = 1100 (artificiel).

### Actions

1. Injecter `IModelPricingService` dans `ContractTestRunner`
2. Resoudre le modele :
   - Priorite 1 : `block.Config["model"]` (si present)
   - Priorite 2 : modele actif du LLM-Provider (via config ou session)
   - Priorite 3 : `"unknown"` (fallback)
3. Construire un `ModelProfile` enrichi :
   ```csharp
   var pricing = await _pricingService.GetPricingAsync(modelId, ct);
   var profile = pricing != null
       ? ModelProfile.CreateGeneric(modelId, "unknown") with
         {
             CostPerMillionInputTokens = pricing.InputPricePerMillion,
             CostPerMillionOutputTokens = pricing.OutputPricePerMillion,
             ParametersBillions = pricing.ParametersBillions ?? (isLocal ? 7 : 100)
         }
       : ModelProfile.CreateGeneric(modelId, "unknown");
   ```

---

## Tache 5 : Propagation des couts multi-modele (BlockRefHandler → parent)

### Contexte — Le trou structurel

Dans un workflow multi-modele (ex: agent utilisant Opus pour le planning + Haiku pour l'execution), chaque `InferenceBlockExecutor` calcule correctement son cout. Mais les couts sont **perdus** au niveau du handler :

```
InferenceBlockExecutor (Opus, $0.25)  ← calcule son cout ✓
  → BlockRefHandler recoit BlockExecutionResult avec cout ✓
    → SerializeBlockOutput() retourne SEULEMENT le texte ✗ (cout perdu)
      → AgentBlockExecutor.ExtractResultAsync() cree un NOUVEAU result sans couts ✗
```

La methode `SerializeBlockOutput()` (BlockRefHandler ligne 226-248) ne serialise que les outputs texte (non prefixes `_`). Le `EstimatedCostUsd`, `PromptTokens`, `CompletionTokens` du `BlockExecutionResult` sont ignores.

`AgentBlockExecutor.ExtractResultAsync()` (ligne 87-103) cree un `new BlockExecutionResult` avec seulement `content` et `_agentResult` — aucun champ de cout.

### Fichiers

| Fichier | Modification |
|---------|-------------|
| `Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Accumuler les couts dans les variables de session |
| `Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` | Lire les couts accumules dans `ExecuteConfigNodesAsync` |
| `Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Reporter les couts dans `ExtractResultAsync` |

### Actions

1. **BlockRefHandler** — apres `executor.ExecuteAsync()` (ligne 101), accumuler les couts :
   ```csharp
   var result = await executor.ExecuteAsync(block, execContext, inputs);

   // Accumuler les couts dans les variables de session
   var currentCost = context.Variables.ContainsKey("_accumulatedCost")
       ? decimal.Parse(context.Variables["_accumulatedCost"]?.ToString() ?? "0")
       : 0m;
   context.Variables["_accumulatedCost"] = (currentCost + result.EstimatedCostUsd).ToString();
   context.Variables["_accumulatedPromptTokens"] = (
       int.Parse(context.Variables.GetValueOrDefault("_accumulatedPromptTokens")?.ToString() ?? "0")
       + result.PromptTokens).ToString();
   context.Variables["_accumulatedCompletionTokens"] = (
       int.Parse(context.Variables.GetValueOrDefault("_accumulatedCompletionTokens")?.ToString() ?? "0")
       + result.CompletionTokens).ToString();
   ```

2. **MultiNodeBlockExecutor** — dans `ExecuteConfigNodesAsync` ou une methode protected, exposer les couts accumules :
   ```csharp
   protected (decimal cost, int promptTokens, int completionTokens) GetAccumulatedCosts(ExecutionContext context)
   {
       var cost = decimal.Parse(context.Variables.GetValueOrDefault("_accumulatedCost")?.ToString() ?? "0");
       var prompt = int.Parse(context.Variables.GetValueOrDefault("_accumulatedPromptTokens")?.ToString() ?? "0");
       var completion = int.Parse(context.Variables.GetValueOrDefault("_accumulatedCompletionTokens")?.ToString() ?? "0");
       return (cost, prompt, completion);
   }
   ```

3. **AgentBlockExecutor.ExtractResultAsync** — reporter les couts :
   ```csharp
   var (cost, promptTokens, completionTokens) = GetAccumulatedCosts(context);
   return Task.FromResult(new BlockExecutionResult
   {
       Success = true,
       EstimatedCostUsd = cost,
       PromptTokens = promptTokens,
       CompletionTokens = completionTokens,
       TotalTokens = promptTokens + completionTokens,
       Outputs = new Dictionary<string, object>
       {
           ["content"] = agentResult,
           ["_agentResult"] = agentResult
       }
   });
   ```

### Impact sur la Tache 3

Avec cette tache, `ContractTestRunner` recevra des `BlockExecutionResult` avec les vrais couts accumules de tous les sous-blocs. L'accumulation de la Tache 3 fonctionnera correctement meme pour les blocks agent multi-modele.

### Verification
```bash
# Lancer un contract test sur un agent (qui utilise des sous-blocs)
curl -X POST "http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant" \
  | jq '{estimatedCostUsd, performanceScore}'
# Attendu : estimatedCostUsd reflète le cout TOTAL de tous les appels LLM (pas juste le dernier)
```

---

## Verification globale 56-A

```bash
cd apps/backend && dotnet build             # 0 errors
cd apps/backend && dotnet test              # all tests pass
# Fonctionnel (necessite services demarres) :
curl http://localhost:5000/api/provider/models | jq '.models[0].inputTokenPricePerMillion'
curl -X POST "http://localhost:5000/api/contracts/maestro-assistant/test?blockId=system:maestro-assistant" \
  | jq '{fitness, estimatedCostUsd, performanceScore}'
# Attendu : estimatedCostUsd > 0, fitness < 0.5 (Claude cher)
```

---

## Definition of Done 56-A

- [ ] `ProviderModelInfo` et `CompatibleModel` incluent les prix (input/output per million)
- [ ] `IModelPricingService` cree avec cache et fallback
- [ ] `LLMBlockExecutorBase.EstimateCost()` hardcode supprime, remplace par pricing service
- [ ] `ContractTestRunner.EstimatedCostUsd` accumule les couts reels des tests
- [ ] `ContractTestRunner` resolve le vrai modele et construit un profil enrichi
- [ ] `BlockRefHandler` accumule les couts des sous-blocs dans les variables de session
- [ ] `AgentBlockExecutor.ExtractResultAsync` reporte les couts accumules sur le `BlockExecutionResult`
- [ ] Les workflows multi-modele propagent correctement les couts de chaque `InferenceBlockExecutor`
- [ ] `dotnet build` : 0 errors
- [ ] `dotnet test` : tous les tests existants passent
