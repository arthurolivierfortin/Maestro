# Issue P3-B : Add Quality Gate Enforcement

**Priorite** : P3 (safety)
**Estimation** : 2-3 heures
**Bloque** : Rien
**Bloque par** : P3-A

---

## Probleme

`BlockApprovalService.ApproveAsync()` approuve n'importe quel bloc sans verifier la qualite minimale.

**Fichier** : `backend/src/Maestro.Application/Services/BlockApprovalService.cs:116-154`

Un bloc avec fitness 0.0, sans system prompt, sans version — peut etre approuve et publie. Ca contredit la philosophie de Maestro ou chaque bloc doit avoir un fitness mesure.

---

## Solution

### 1. Gates de qualite dans `ApproveAsync`

Ajouter des verifications obligatoires avant d'autoriser l'approbation :

```csharp
public async Task<BlockApproval> ApproveAsync(string approvalId, string reviewedBy,
    CancellationToken ct = default)
{
    var approval = await _approvalRepository.GetByIdAsync(approvalId, ct);
    if (approval == null) throw new NotFoundException($"Approval {approvalId} not found");

    var block = await _blockRepository.GetByIdAsync(approval.BlockId, ct);
    if (block == null) throw new NotFoundException($"Block {approval.BlockId} not found");

    // Quality gates
    var gateErrors = new List<string>();

    // Gate 1: Version must be set
    if (string.IsNullOrEmpty(block.Version))
        gateErrors.Add("Block has no version set");

    // Gate 2: Must have content (system prompt or script)
    bool hasContent = !string.IsNullOrEmpty(block.Config?.SystemPrompt)
        || block.Config?.Script != null
        || block.Config?.Nodes?.Count > 0;  // Workflow has nodes
    if (!hasContent)
        gateErrors.Add("Block has no content (no system prompt, script, or workflow nodes)");

    // Gate 3: Must have a name
    if (string.IsNullOrEmpty(block.Metadata?.Name))
        gateErrors.Add("Block has no name in metadata");

    if (gateErrors.Count > 0)
    {
        // Auto-reject with gate failure reasons
        var reason = "Quality gate failed:\n" + string.Join("\n", gateErrors.Select(e => $"- {e}"));
        approval.Reject(reviewedBy, reason);
        await _approvalRepository.SaveAsync(approval, ct);
        throw new ValidationException(reason);
    }

    // ... existing approve + publish logic ...
}
```

### 2. Gates optionnelles (fitness threshold)

Les gates ci-dessus sont obligatoires. Le seuil de fitness est optionnel car :
- Les blocs crees manuellement n'ont pas de fitness mesure
- Le premier publish d'un bloc n'a jamais ete entraine en foundry

Pour les gates de fitness, utiliser une config :

```json
// In appsettings.json or project config
"Publishing": {
  "RequireMinimumFitness": false,
  "MinimumFitnessThreshold": 0.7
}
```

Si `RequireMinimumFitness` est true, ajouter un gate :
```csharp
if (options.RequireMinimumFitness && manifest.Fitness < options.MinimumFitnessThreshold)
    gateErrors.Add($"Fitness {manifest.Fitness} below threshold {options.MinimumFitnessThreshold}");
```

### 3. Reponse API enrichie

En cas de rejet automatique, l'API retourne 422 avec les raisons :

```json
{
  "error": "Quality gate failed",
  "gates": [
    "Block has no version set",
    "Block has no content"
  ],
  "approvalId": "xxx",
  "status": "rejected"
}
```

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `backend/src/Maestro.Application/Services/BlockApprovalService.cs` | Ajouter quality gates dans `ApproveAsync` |
| `backend/src/Maestro.Api/Controllers/ApprovalsController.cs` | Retourner 422 pour les gate failures |
| `maestro-cli/cli.ts` | Afficher les raisons de rejet clairement dans le terminal |

---

## Criteres de completion

- [ ] Approuver un bloc sans version → rejet automatique avec raison
- [ ] Approuver un bloc sans contenu (pas de prompt, pas de script, pas de nodes) → rejet automatique
- [ ] Approuver un bloc sans nom → rejet automatique
- [ ] Approuver un bloc valide → succes (non-regression)
- [ ] L'API retourne 422 (pas 500) avec les raisons de rejet
- [ ] Le CLI affiche les raisons de rejet lisiblement
