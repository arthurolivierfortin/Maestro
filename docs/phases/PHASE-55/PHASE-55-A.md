# Phase 55-A : IBlockDependencyService + API endpoints

**Statut** : A FAIRE
**Effort estime** : 1 jour
**Prerequis** : Phase 54 COMPLETE

---

## Objectif

Creer le service backend qui extrait l'arbre de dependances complet d'un block multi-noeud, et l'exposer via l'API REST. C'est le port de `extractManifest()` (CLI) vers le backend, enrichi avec la validation et le reverse lookup.

---

## Lecture obligatoire

- `packages/maestro-cli/adapt-optimize.ts` (lignes 143-286) — l'implementation de reference : `extractManifest()`, `flattenModels()`, `collectModelBlocks()`. C'est le code a porter en C#.
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` (lignes 225-319, 712-738) — l'endpoint `/children` existant et les DTOs `BlockChildrenResponse`/`BlockChildInfo`. A enrichir.
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` (lignes 40-119) — resolution runtime des blockRef, pour comprendre le format des references.
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` — le service qui resout les block IDs en definitions.

---

## Ce que cette sous-phase fait

### Tache 1 : Creer IBlockDependencyService

#### Fichiers

| Fichier | Action |
|---------|--------|
| `Application/Interfaces/IBlockDependencyService.cs` | **NOUVEAU** |
| `Application/DTOs/BlockManifestDtos.cs` | **NOUVEAU** |
| `Infrastructure/BlockStore/BlockDependencyService.cs` | **NOUVEAU** |
| `Api/Program.cs` | Enregistrer dans DI |

#### Interface

```csharp
public interface IBlockDependencyService
{
    /// <summary>
    /// Extract the full dependency tree of a block.
    /// Walks config.nodes recursively, handles while/conditional/for-each.
    /// Detects cycles.
    /// </summary>
    Task<BlockManifest> GetManifestAsync(string blockId, CancellationToken ct = default);

    /// <summary>
    /// Flatten the manifest into model -> blockId[] map.
    /// </summary>
    Task<Dictionary<string, List<string>>> GetRequiredModelsAsync(string blockId, CancellationToken ct = default);

    /// <summary>
    /// Validate that all blockRefs in the tree resolve to existing blocks.
    /// Returns list of missing/broken references.
    /// </summary>
    Task<DependencyValidationResult> ValidateAsync(string blockId, CancellationToken ct = default);

    /// <summary>
    /// Find all blocks that reference the given block (reverse lookup).
    /// </summary>
    Task<List<string>> GetDependentsAsync(string blockId, CancellationToken ct = default);
}
```

#### DTOs

```csharp
public record BlockManifest(
    string BlockId,
    string BlockType,
    string? Model,
    string? PlanningModel,
    bool IsAtomic,
    List<BlockManifest> Children);

public record DependencyValidationResult(
    bool IsValid,
    List<MissingDependency> MissingBlocks,
    List<string> CircularReferences);

public record MissingDependency(
    string BlockRef,
    string ReferencedBy,
    string NodeId);
```

#### Implementation de GetManifestAsync

Port de `extractManifest()` (adapt-optimize.ts lignes 143-245) en C# :

1. **Walk recursif** de `config.nodes` (JsonElement)
2. Pour chaque node : extraire `blockRef`, `config.model`, `config.planningModel`
3. Gerer les structures imbriquees (reproduire la logique TS exacte) :
   - `node.nodes` (while body, for-each body)
   - `node.then` / `node.else` (conditional branches — blockRef direct OU sous-array .nodes)
   - `node.then.nodes` / `node.else.nodes` (conditional branches avec sous-nodes)
4. Detection de cycles via `HashSet<string> visited`
5. Resolution de blockRef via `IFileSystemBlockDiscoveryService.GetByIdAsync()`
6. Pour les blocks non resolus : retourner un `BlockManifest` avec `BlockType = "unresolved"` au lieu de crash

#### Implementation de GetRequiredModelsAsync

Port de `flattenModels()` (adapt-optimize.ts lignes 250-268) :
1. Appeler `GetManifestAsync()`
2. Walk recursif du manifest
3. Collecter `model` et `planningModel` dans un `Dictionary<string, List<string>>`

#### Implementation de ValidateAsync

1. Appeler `GetManifestAsync()`
2. Walk recursif : collecter tous les nodes avec `BlockType == "unresolved"`
3. Detecter les cycles (noter dans `CircularReferences`)
4. Retourner `IsValid = MissingBlocks.Count == 0 && CircularReferences.Count == 0`

#### Implementation de GetDependentsAsync (reverse lookup)

1. Scanner tous les blocks via `IFileSystemBlockDiscoveryService.GetAllAsync()`
2. Pour chaque block composite, walk `config.nodes` au premier niveau
3. Si un node a `blockRef` == blockId cible → ajouter a la liste
4. Pas de cache pour V1 (scan a la demande)

---

### Tache 2 : Enrichir GET /api/blocks/{id}/children + nouveaux endpoints

#### Fichier

`Api/Controllers/BlocksController.cs`

#### Actions sur l'endpoint existant

1. **Remplacer `GetBlockChildrenAsync()`** (methode privee, lignes 260-319) par un appel a `IBlockDependencyService.GetManifestAsync()`
2. **Enrichir `BlockChildInfo`** (ligne 727-738) avec :
   ```csharp
   public string? Model { get; set; }
   public string? PlanningModel { get; set; }
   ```
3. **Mapper** le `BlockManifest` vers `BlockChildInfo` pour compatibilite arriere
4. **Supprimer** le code de walk `config.nodes` local — la logique est dans le service

#### Nouveaux endpoints

```
GET /api/blocks/{id}/manifest
```
Retourne directement le `BlockManifest` (arbre complet avec modeles, types, isAtomic).

```
GET /api/blocks/{id}/manifest/models
```
Retourne `{ model: string, blockIds: string[] }[]` (carte aplatie).

```
GET /api/blocks/{id}/manifest/validate
```
Retourne `DependencyValidationResult` (isValid, missingBlocks, circularReferences).

```
GET /api/blocks/{id}/dependents
```
Retourne `string[]` (IDs des blocks qui referent ce block).

---

## Verification

```bash
# Build
cd apps/backend && dotnet build  # 0 errors

# Unit tests
cd apps/backend && dotnet test   # tous tests passent

# Fonctionnel (services demarres)
# Manifest complet
curl http://localhost:5000/api/blocks/maestro-assistant/manifest | jq '.children | length'
# Attendu : > 0 (les sous-blocks sont resolus)

# Modeles requis
curl http://localhost:5000/api/blocks/maestro-assistant/manifest/models | jq '.'
# Attendu : au moins un modele avec blockIds non-vide

# Validation
curl http://localhost:5000/api/blocks/maestro-assistant/manifest/validate | jq '.isValid'
# Attendu : true (tous blockRefs resolus)

# Children enrichi (compatibilite)
curl http://localhost:5000/api/blocks/maestro-assistant/children?recursive=true | jq '.children[0] | {nodeId, model, blockRef}'
# Attendu : model non-null pour les nodes avec modele
```

---

## Anti-patterns

- Ne PAS dupliquer la logique de walk dans le controller — tout est dans `BlockDependencyService`, le controller appelle le service
- Ne PAS crash sur un blockRef non resolu — retourner un manifest avec `BlockType = "unresolved"`. Le crash est pour la validation, pas l'extraction
- Ne PAS scanner tous les blocks pour `GetDependentsAsync` sans limiter — pour V1 le scan complet est OK, mais ne pas le cacher indefiniment (les blocks changent)
- Ne PAS ajouter un champ `dependencies` dans `block.schema.json` — les dependances sont implicites dans config.nodes, l'extraction automatique est la source de verite

---

## Checkpoint

```markdown
## 55-A : IBlockDependencyService + API
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers crees** : IBlockDependencyService.cs, BlockManifestDtos.cs, BlockDependencyService.cs
**Endpoints** : /manifest, /manifest/models, /manifest/validate, /dependents
**dotnet build** : [0 errors / N errors]
**dotnet test** : [all pass / N failures]
**curl manifest** : [copier output jq '.children | length']
**curl models** : [copier output]
**curl validate** : [copier output jq '.isValid']
```
