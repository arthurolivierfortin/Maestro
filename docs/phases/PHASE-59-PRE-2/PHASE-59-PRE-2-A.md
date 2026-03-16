# 59-PRE-2-A : Backend — Config enforcement + Check avant execution + Graceful stop

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Domain/Entities/CostLimits.cs` — modele actuel (decimal? par limite)
- `apps/backend/src/Maestro.Application/DTOs/CostDtos.cs` — CostLimitsDto, CostLimitCheckResult actuels
- `apps/backend/src/Maestro.Infrastructure/Pricing/CostTrackingService.cs` — CheckLimitAsync, GetLimitsAsync, config file parsing
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — AccumulateCosts, RecordAndCheckCosts
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` — boucle d'execution des nodes, DispatchNodeAsync
- `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` — gestion etat session (_activeWorkflow, status)
- `docs/phases/PHASE-59-PRE-2/cost-enforcement-analysis.md` — design complet

---

## Ce que cette sous-phase fait

### 1. Refactorer CostLimits

Remplacer `decimal?` par `CostLimitConfig` pour chaque limite :

```csharp
public class CostLimitConfig
{
    public decimal? Value { get; set; }
    public string Enforcement { get; set; } = "block";  // "block" ou "warn"
    public bool AutoResume { get; set; } = false;
}
```

CostLimits :
```csharp
public class CostLimits
{
    public CostLimitConfig MaxPerSession { get; set; } = new();
    public CostLimitConfig MaxPerDay { get; set; } = new();
    public CostLimitConfig MaxPerWeek { get; set; } = new();
    public CostLimitConfig MaxPerMonth { get; set; } = new();
}
```

### 2. Backward compat dans CostTrackingService

La config JSON peut etre en ancien format (`"maxPerDay": 5.0`) ou nouveau (`"maxPerDay": { "value": 5.0, "enforcement": "block" }`). Le parsing doit gerer les deux.

### 3. Update CheckLimitAsync

Retourne un `CostLimitCheckResult` enrichi :
```csharp
public record CostLimitCheckResult(
    bool Exceeded,
    string? LimitType,        // "session", "day", "week", "month"
    string? Enforcement,      // "block", "warn"
    bool AutoResume,
    decimal CurrentValue,
    decimal? MaxValue,
    string? Message
);
```

Verifier les 4 limites dans l'ordre session → day → week → month. Retourner la premiere depassee avec enforcement="block". Si aucune block, retourner la premiere warn.

### 4. Enforcement dans BlockRefHandler

Dans `RecordAndCheckCosts` (ou nouveau point d'entree `CheckCostBeforeExecution`) :

**AVANT** l'execution du block (pas apres) :
- Appeler CheckLimitAsync
- Si `exceeded && enforcement == "block"` :
  - Set variables sur la session : `_costLimitExceeded`, `_costLimitType`, `_costLimitMessage`, `_costStoppedAt` (ISO timestamp), `_costStoppedEntryPoint`, `_costStoppedNodeId`, `_costAutoResume`
  - Retourner un `BlockExecutionResult` avec `Success = false` et un flag special pour distinguer du erreur normale
- Si `exceeded && enforcement == "warn"` :
  - Set `_costLimitExceeded = true`, `_costLimitMessage`
  - Continuer normalement

### 5. Graceful stop dans NodeExecutionEngine

Quand BlockRefHandler retourne un cost-stop :
- Arreter la boucle de nodes proprement
- Appeler SessionStateManager pour cleanup : clear `_activeWorkflow`, session.status = idle
- NE PAS set error sur la session
- Preserver TOUTES les variables

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Domain/Entities/CostLimits.cs` | Refactorer : CostLimitConfig avec Value, Enforcement, AutoResume |
| `apps/backend/src/Maestro.Application/DTOs/CostDtos.cs` | Update CostLimitsDto, CostLimitCheckResult enrichi |
| `apps/backend/src/Maestro.Infrastructure/Pricing/CostTrackingService.cs` | Backward compat parsing, CheckLimitAsync enrichi |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Check AVANT execution, set _costStopped* vars, retour cost-stop signal |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` | Gerer cost-stop signal, arreter proprement |
| `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` | GracefulCostStop() |
| `apps/backend/src/Maestro.Api/Controllers/CostsController.cs` | Update pour nouveau format CostLimitsDto |

---

## Verification

```bash
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

# Test manuel : configurer limite $0.001 block, invoquer inference, verifier que le 2e block est refuse
curl -X PUT http://localhost:5000/api/costs/limits -H "Content-Type: application/json" \
  -d '{"maxPerDay": {"value": 0.001, "enforcement": "block"}}'
# Invoquer un workflow, verifier _costLimitExceeded=true et session status=idle
```

---

## Anti-patterns

- Ne PAS bloquer PENDANT l'execution d'un block — check AVANT le prochain uniquement
- Ne PAS mettre la session en statut "error" — idle signifie resumable
- Ne PAS throw une exception non-catchee — utiliser un signal/return value
- Ne PAS perdre les variables existantes lors du cleanup
- Ne PAS ignorer l'ancien format de config

---

## Checkpoint

```markdown
## 59-PRE-2-A : Backend enforcement
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**CostLimitConfig** : Value + Enforcement + AutoResume
**Backward compat** : ancien format nombre fonctionne
**Hard stop** : block refuse quand limite depassee
**Session status apres stop** : idle (pas error)
**Variables preservees** : OUI / NON
```
