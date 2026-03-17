# 61-B : Pre-flight Bloquant + Loop Detection Verification

**Effort** : 0.5 jour
**Prerequis** : 61-A COMPLETE (provider verifie, fixes confirmes)
**Critere de passage** : Pre-flight bloque les configs invalides, loop detection arrete un agent qui boucle

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` — lignes 127-167 : pre-flight actuel (INFORMATIF SEULEMENT, a renforcer)
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` — lignes 402-518 : loop detection actuelle (deja codee, a verifier)
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — `CheckCostBeforeExecutionAsync()` : pattern existant de pre-flight bloquant

---

## Tache 1 — Renforcer le pre-flight (BLOQUANT, pas informatif)

Le pre-flight actuel (`MultiNodeBlockExecutor.cs:127-167`) est trop faible : il log des warnings mais ne bloque jamais. Le commentaire dit explicitement "Informational only — does not block execution."

**Probleme** : Un pre-flight qui ne bloque pas n'est pas un pre-flight, c'est un log. Le risque d'un faux positif (bloquer un workflow valide) est mineur. Le risque d'un faux negatif (lancer un workflow qui brule $10 pour rien) est majeur.

### Modifications

Transformer `PreFlightCheck` en `PreFlightCheckAsync` (async pour le check modele) et ajouter des conditions bloquantes :

```csharp
private async Task PreFlightCheckAsync(BlockDefinition block, ProjectSession session)
{
    // 1. maxIterations MUST be resolved to a valid number
    var maxIterStr = block.Config?.TryGetValue("maxIterations", out var maxIterObj) == true
        ? maxIterObj?.ToString() : null;

    if (!string.IsNullOrEmpty(maxIterStr) && !int.TryParse(maxIterStr, out var maxIter))
    {
        // Check if it's a template variable that should have been resolved
        var resolved = session.GetVariable("maxIterations")?.ToString();
        if (string.IsNullOrEmpty(resolved) || !int.TryParse(resolved, out _))
        {
            throw new InvalidOperationException(
                $"Pre-flight FAILED for block '{block.Id}': maxIterations not resolved " +
                $"(config='{maxIterStr}', session variable='{resolved ?? "null"}'). " +
                "This would default to 50 iterations. Fix the config or set the variable.");
        }
    }

    // 2. Estimate and log cost
    var iterations = int.TryParse(
        session.GetVariable("maxIterations")?.ToString() ?? maxIterStr, out var mi) ? mi : 50;
    var estimatedCostPerIter = 0.14m; // ~$0.14/iter for Sonnet with 30K system prompt
    var estimatedMaxCost = iterations * estimatedCostPerIter;

    StateManager.AppendExecutionLog(session, "info",
        $"Pre-flight: block '{block.Id}', model={model}, maxIterations={iterations}, " +
        $"estimated max cost: ${estimatedMaxCost:F2} ({iterations} x ${estimatedCostPerIter:F3}/iter)");

    // 3. Log warning if cost is high
    if (estimatedMaxCost > 5.0m)
    {
        StateManager.AppendExecutionLog(session, "warning",
            $"Pre-flight: estimated cost ${estimatedMaxCost:F2} exceeds $5. Consider reducing maxIterations.");
    }
}
```

### Ce qui BLOQUE vs ce qui AVERTIT

| Condition | Action |
|-----------|--------|
| maxIterations non resolu a un nombre | **BLOQUE** (throw) |
| maxIterations > 50 | **AVERTIT** (log warning) |
| Cout estime > $5 | **AVERTIT** (log warning) |
| Modele non specifie | **AVERTIT** (log info, le defaut sera utilise) |

---

## Tache 2 — Verifier la loop detection

Le code est deja dans `NodeExecutionEngine.cs:402-518`. Verifier qu'il fonctionne correctement.

### Test manuel

1. **Creer un agent minimal** qui boucle volontairement (system prompt qui fait uniquement `file-read` en boucle)
2. Lancer avec maxIterations=10
3. Observer les logs :
   - Iteration 3 : `"Agent may be stuck: tool 'file-read' called 3 times consecutively"` (warning)
   - Iteration 5 : `"Agent stuck in loop: tool 'file-read' called 5 times consecutively. Forcing stop."` (error)
   - `_agentDone = true`
   - `_agentResult = "Stopped: agent stuck in loop calling 'file-read' repeatedly"`

### Verification de la detection

Le code actuel (lignes 460-498) verifie `_nodeResult_parse-response` via `TemplateResolver.ExtractJsonSubPath(parseResultVar, "toolId")`.

**Bug potentiel** : Si `_nodeResult_parse-response` est un objet JSON serialise en string, `ExtractJsonSubPath` doit parser le JSON pour extraire `toolId`. Verifier que ca fonctionne. Si la variable contient juste le string "file-read" (pas du JSON), l'extraction echouera.

### Progress detection

Le code (lignes 500-517) track les `uniqueToolTypesSeen`. Verifier que :
- Les tool types exclus (`step-complete`, `file-write`, `file-edit`) sont corrects
- Le warning ne se declenche pas pour des agents qui font legitimement beaucoup de `file-read` (ex: lire un contract, puis lire un block, puis lire un test = 3 file-read mais c'est normal si les paths sont differents)

**Note** : La detection actuelle compare les toolIds, pas les arguments. `file-read` x3 avec des paths differents sera detecte comme "no progress". C'est un faux positif potentiel. Pour V1, accepter ce trade-off (mieux vaut un faux positif qu'un agent qui tourne indefiniment).

---

## Tache 3 — Test unitaire de la loop detection

Ecrire un test qui simule 5 tool calls identiques et verifie le stop :

```csharp
[Fact]
public void LoopDetection_ForcesStopAfter5IdenticalToolCalls()
{
    var recentToolCalls = new List<string> { "file-read", "file-read", "file-read", "file-read", "file-read" };
    var last5 = recentToolCalls.Skip(recentToolCalls.Count - 5).ToList();
    Assert.True(last5.All(t => t == last5[0]));
    Assert.NotEqual("step-complete", last5[0]); // step-complete is excluded
}

[Fact]
public void LoopDetection_DoesNotTriggerForMixedToolCalls()
{
    var recentToolCalls = new List<string> { "file-read", "file-write", "file-read", "contract-test", "file-read" };
    var last5 = recentToolCalls.Skip(recentToolCalls.Count - 5).ToList();
    Assert.False(last5.All(t => t == last5[0]));
}
```

---

## Verification finale 61-B

- [ ] Pre-flight BLOQUE si maxIterations non resolu (test : passer un block avec `maxIterations: "{{unresolved}}"`)
- [ ] Pre-flight log estime le cout max
- [ ] Loop detection : warning apres 3 calls identiques (verifie dans les logs)
- [ ] Loop detection : stop apres 5 calls identiques (verifie : `_agentDone = true`)
- [ ] Workflows normaux (non-agents) : pas de faux positifs
- [ ] `dotnet build` : 0 erreurs
- [ ] Tests existants : 0 regressions
- [ ] Au moins 2 tests unitaires ajoutes (loop detection)

---

## Anti-patterns

- Ne PAS ajouter d'appel LLM dans le pre-flight pour tester le modele — ca coute de l'argent
- Ne PAS injecter automatiquement des messages de "nudge" dans la conversation — ca peut confondre l'agent
- Ne PAS utiliser un seuil de 2 pour la detection — les agents font souvent 2 appels identiques consecutifs normalement
- Ne PAS comparer les arguments des tool calls — seulement le toolId. Deux `file-read` avec des paths differents ne sont PAS une boucle au niveau toolId, mais la detection actuelle les traite comme tel (trade-off accepte pour V1)

---

## Checkpoint

```markdown
## 61-B : Pre-flight Bloquant + Loop Detection
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**Tests** : X nouveaux, tous passent (0 regressions)
**Pre-flight bloquant** : OUI — throw si maxIterations non resolu
**Pre-flight cout** : log "estimated max cost: $X.XX" present
**Loop detection 3x** : warning present dans les logs
**Loop detection 5x** : _agentDone = true, error logged
**Faux positifs** : aucun sur workflows normaux
```
