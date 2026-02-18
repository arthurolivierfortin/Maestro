# Issue P3-A : Add Version Conflict Protection

**Priorite** : P3 (data safety)
**Estimation** : 2-3 heures
**Bloque** : P3-B, P3-C, P4-A
**Bloque par** : Rien

---

## Probleme

`FileSystemBlockPublisher.UpdateCatalogIndexAsync()` ecrase silencieusement les entrees existantes du catalogue :

**Fichier** : `backend/src/Maestro.Infrastructure/Publishing/FileSystemBlockPublisher.cs:181-194`

```csharp
catalog.Blocks.RemoveAll(b => b.Id == manifest.Id);  // Silent removal
catalog.Blocks.Add(entry);                            // Silent replacement
```

Publier `my-agent@1.0.0` deux fois ecrase la premiere publication sans avertissement. ZERO protection contre la perte de donnees. Inacceptable pour un systeme qui met l'accent sur la tracabilite et le fitness mesure.

---

## Solution

### 1. Detection de conflit de version

Avant de publier, verifier si `{blockId}@{version}` existe deja dans le catalogue.

**Dans `FileSystemBlockPublisher.cs`** :

```csharp
public async Task PublishBlockAsync(BlockDefinition block, BlockManifest manifest,
    bool force = false, CancellationToken ct = default)
{
    // ... existing code to write block files ...

    await UpdateCatalogIndexAsync(manifest, force, ct);
}

private async Task UpdateCatalogIndexAsync(BlockManifest manifest, bool force, CancellationToken ct)
{
    var catalog = await LoadOrCreateCatalogAsync(ct);

    var existing = catalog.Blocks.FirstOrDefault(b => b.Id == manifest.Id);
    if (existing != null)
    {
        if (existing.Version == manifest.Version && !force)
        {
            throw new InvalidOperationException(
                $"Version conflict: {manifest.Id}@{manifest.Version} already exists in catalog. " +
                $"Use --force to overwrite, or increment the version.");
        }

        // Log the overwrite
        _logger.LogWarning("Overwriting catalog entry {BlockId}@{Version} (force={Force})",
            manifest.Id, manifest.Version, force);
        catalog.Blocks.RemoveAll(b => b.Id == manifest.Id);
    }

    catalog.Blocks.Add(new CatalogEntry { /* ... */ });
    await SaveCatalogAsync(catalog, ct);
}
```

### 2. Flag `--force` dans le CLI

**Dans `maestro-cli/cli.ts`** (block publish command, ~line 4071) :

Le CLI a deja un flag `force` dans le boolean array. Il faut le passer a l'API :

```typescript
async function submitBlockForApproval(/* ... */) {
  // existing code...
  const body = {
    blockId: id,
    version: version,
    force: argv.force || false,  // Pass force flag
    // ...
  };
}
```

### 3. Flag `--force` dans l'API

**Dans `backend/src/Maestro.Api/Controllers/ApprovalsController.cs`** :

Ajouter `Force` au DTO de requete. Le `BlockApprovalService.ApproveAsync()` passe le flag au publisher.

### 4. Gestion de version par ID (pas juste Id)

Le `RemoveAll(b => b.Id == manifest.Id)` supprime TOUTES les versions d'un bloc. On devrait :
- Permettre plusieurs versions d'un meme bloc dans le catalogue
- Ou au minimum, archiver l'ancienne version avant d'ecraser

**Recommandation pour cette issue** : Garder le comportement "une seule version par bloc" (simple) mais ajouter le guard de conflit. Le multi-version est un sujet plus large pour plus tard.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `backend/src/Maestro.Infrastructure/Publishing/FileSystemBlockPublisher.cs` | Ajouter detection de conflit + parametre `force` |
| `backend/src/Maestro.Application/Services/BlockApprovalService.cs:116-154` | Passer `force` au publisher |
| `backend/src/Maestro.Application/DTOs/` | Ajouter `Force` au DTO de requete d'approbation |
| `maestro-cli/cli.ts` | Passer `--force` dans le body de la requete |

---

## Criteres de completion

- [ ] Publier le meme bloc@version deux fois SANS `--force` → erreur explicite
- [ ] Publier avec `--force` → ecrasement avec log warning
- [ ] Publier une NOUVELLE version (1.0.0 → 1.1.0) → succes sans `--force`
- [ ] Le message d'erreur est clair et indique les options (--force ou incrementer la version)
- [ ] L'API retourne 409 Conflict (pas 500) en cas de conflit
