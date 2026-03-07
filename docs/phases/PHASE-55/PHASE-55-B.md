# Phase 55-B : Validation pre-execution

**Statut** : A FAIRE
**Effort estime** : 0.25 jour
**Prerequis** : Phase 55-A COMPLETE

---

## Objectif

Avant d'executer un block, verifier que toutes ses dependances (blockRefs) existent. Avertir l'utilisateur si des dependances manquent. Enrichir les messages d'erreur quand un blockRef echoue au runtime.

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — point d'entree de l'execution. C'est ici qu'on ajoute la validation pre-execution.
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` (lignes 54-60) — le crash actuel quand un blockRef n'est pas trouve. Message a enrichir.
- `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` — pour `AppendExecutionLog()`, le mecanisme de logging dans l'execution tree.

---

## Ce que cette sous-phase fait

### Tache 1 : Validation au demarrage dans EntryPointExecutor

#### Fichier

`Infrastructure/Sessions/EntryPointExecutor.cs`

#### Actions

1. Injecter `IBlockDependencyService` dans le constructeur
2. Avant d'executer les config.nodes d'un entry point, appeler :
   ```csharp
   var validation = await _dependencyService.ValidateAsync(blockId, ct);
   if (!validation.IsValid)
   {
       foreach (var missing in validation.MissingBlocks)
       {
           _logger.LogWarning(
               "Missing dependency: blockRef '{BlockRef}' referenced by '{ReferencedBy}' node '{NodeId}'",
               missing.BlockRef, missing.ReferencedBy, missing.NodeId);
           _stateManager.AppendExecutionLog(session, "warning",
               $"Missing dependency: '{missing.BlockRef}' referenced by node '{missing.NodeId}' in '{missing.ReferencedBy}'");
       }
       foreach (var cycle in validation.CircularReferences)
       {
           _logger.LogWarning("Circular dependency detected: {Cycle}", cycle);
           _stateManager.AppendExecutionLog(session, "warning", $"Circular dependency: {cycle}");
       }
   }
   ```
3. **Ne PAS bloquer l'execution** — certains blockRefs sont dynamiques (resolus au runtime via variables de template). Le warning suffit.

### Tache 2 : Message d'erreur enrichi dans BlockRefHandler

#### Fichier

`Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs`

#### Actions

Remplacer le message d'erreur generique (ligne 60) :
```csharp
// Avant :
throw new InvalidOperationException($"Block not found: {blockRefId}");

// Apres :
throw new InvalidOperationException(
    $"Block not found: '{blockRefId}'. " +
    $"Referenced by node '{nodeId}' in the current execution. " +
    $"Run 'maestro block deps <parent-block>' to see all dependencies.");
```

Le `nodeId` est deja disponible (ligne 51). Le nom du parent block n'est pas directement accessible dans le handler — utiliser le `blockRefId` du contexte suffit pour V1.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `Infrastructure/Sessions/EntryPointExecutor.cs` | Ajouter injection IBlockDependencyService + validation pre-execution |
| `Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Enrichir le message InvalidOperationException |

---

## Verification

```bash
# Build
cd apps/backend && dotnet build  # 0 errors

# Tests
cd apps/backend && dotnet test   # tous tests passent

# Fonctionnel : creer un block temporaire avec un blockRef invalide
# et verifier que le warning apparait dans les logs
# (test manuel — verifier les logs de l'execution)
```

---

## Anti-patterns

- Ne PAS bloquer l'execution pour des dependances manquantes — warning seulement. Les blockRefs dynamiques (avec template variables comme `{{selectedBlock}}`) ne sont pas resolvables au moment de la validation
- Ne PAS appeler ValidateAsync dans BlockRefHandler — la validation est au niveau entry point (une seule fois au debut), pas a chaque node. BlockRefHandler ne fait que enrichir le message d'erreur au runtime
- Ne PAS logger les dependances manquantes comme "error" — utiliser "warning". L'execution peut reussir si le chemin vers le blockRef manquant n'est pas emprunte (branch conditionnelle)

---

## Checkpoint

```markdown
## 55-B : Validation pre-execution
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**EntryPointExecutor** : IBlockDependencyService injecte, validation avant execution
**BlockRefHandler** : Message d'erreur enrichi avec nodeId
**dotnet build** : [0 errors / N errors]
**dotnet test** : [all pass / N failures]
**Warning log** : [exemple de warning pour blockRef manquant]
```
