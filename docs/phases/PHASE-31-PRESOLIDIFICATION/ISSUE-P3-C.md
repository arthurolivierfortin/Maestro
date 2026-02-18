# Issue P3-C : Add Block Provenance Tracking

**Priorite** : P3 (traceability)
**Estimation** : 2-3 heures
**Bloque** : Rien
**Bloque par** : P3-A

---

## Probleme

Quand un bloc est approuve et publie, aucun lien n'est enregistre vers :
- La session foundry ou il a ete developpe
- Le workspace d'origine
- Les metriques de training (fitness, iterations, modele utilise)

Un utilisateur qui consulte le catalogue ne peut pas repondre a : "D'ou vient ce bloc ? Avec quel fitness a-t-il ete mesure ? Dans quel workspace a-t-il ete cree ?"

---

## Solution

### 1. Enrichir le manifest avec la provenance

**Dans `backend/src/Maestro.Domain/Entities/BlockManifest.cs`** :

```csharp
public class BlockManifest
{
    // ... existing fields (Id, Version, Fitness, etc.) ...

    // New: Provenance
    public BlockProvenance? Provenance { get; set; }
}

public class BlockProvenance
{
    public string? SourceSessionId { get; set; }
    public string? SourceSessionName { get; set; }
    public string? WorkspaceId { get; set; }
    public string? WorkspaceName { get; set; }
    public DateTime? TrainedAt { get; set; }
    public string? ModelUsed { get; set; }
    public int? TrainingIterations { get; set; }
    public double? FinalFitness { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
}
```

### 2. Remplir la provenance a l'approbation

**Dans `BlockApprovalService.ApproveAsync()`** :

```csharp
// After approval, before publishing:
var manifest = BuildManifest(block);
manifest.Provenance = new BlockProvenance
{
    SourceSessionId = approval.SourceSessionId,  // Set at submission time
    WorkspaceId = approval.WorkspaceId,           // Set at submission time
    ApprovedBy = reviewedBy,
    ApprovedAt = DateTime.UtcNow,
    // Training metrics from the approval submission
    FinalFitness = approval.Metadata?.GetValueOrDefault("fitness") as double?,
    TrainingIterations = approval.Metadata?.GetValueOrDefault("iterations") as int?,
    ModelUsed = approval.Metadata?.GetValueOrDefault("model") as string
};
```

### 3. Enrichir la soumission (CLI)

**Dans `maestro-cli/cli.ts`** (submitBlockForApproval, ~line 4071) :

Ajouter les champs de provenance a la requete de publication :

```typescript
const body = {
  blockId: id,
  version: version,
  // Provenance fields (optional)
  sourceSessionId: argv['session'] || null,
  workspaceId: argv['workspace'] || null,
  fitness: argv['fitness'] ? parseFloat(argv['fitness']) : null,
  iterations: argv['iterations'] ? parseInt(argv['iterations']) : null,
  model: argv['model'] || null,
};
```

Usage :
```bash
node index.js block publish task-planner --version 1.0.0 \
  --session abc123 --workspace def456 \
  --fitness 0.95 --iterations 7 --model claude-sonnet-4-5-20250929
```

### 4. Afficher la provenance dans le catalogue

**Dans `maestro-cli/cli.ts`** (catalog show command) :

```
Block: task-planner@1.0.0
Type: agent
Description: Decomposes a task into implementation steps

Provenance:
  Source session: abc123 (Cantante - Autonomous Dev)
  Workspace: def456
  Trained at: 2026-02-18T14:30:00Z
  Model: claude-sonnet-4-5-20250929
  Iterations: 7
  Final fitness: 0.95
  Approved by: user
  Approved at: 2026-02-18T15:00:00Z
```

### 5. Expose via API

`GET /api/catalog/{blockId}` retourne le manifest complet incluant la provenance.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `backend/src/Maestro.Domain/Entities/BlockManifest.cs` | Ajouter `BlockProvenance` class + propriete |
| `backend/src/Maestro.Application/Services/BlockApprovalService.cs` | Remplir provenance a l'approbation |
| `backend/src/Maestro.Application/DTOs/` | Ajouter champs provenance au DTO de soumission |
| `backend/src/Maestro.Infrastructure/Publishing/FileSystemBlockPublisher.cs` | Serialiser la provenance dans le manifest JSON |
| `maestro-cli/cli.ts` | Passer provenance a la soumission + afficher dans catalog show |

---

## Criteres de completion

- [ ] `block publish` accepte `--session`, `--workspace`, `--fitness`, `--iterations`, `--model`
- [ ] Le manifest JSON sur disque contient la section `provenance`
- [ ] `maestro catalog show <id>` affiche la provenance si presente
- [ ] L'API `/api/catalog/{id}` retourne la provenance
- [ ] Les champs de provenance sont optionnels (publish sans provenance = OK, juste pas de tracking)
