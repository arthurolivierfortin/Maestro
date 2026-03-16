# 59-PRE-2-B : Backend — Auto-resume detection + Resume logic

---

## Lecture obligatoire

- `docs/phases/PHASE-59-PRE-2/PHASE-59-PRE-2-A.md` — prerequis (CostLimitConfig, _costStopped* vars)
- `apps/backend/src/Maestro.Infrastructure/Pricing/CostTrackingService.cs` — CheckLimitAsync apres sous-phase A
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — enforcement apres sous-phase A

---

## Ce que cette sous-phase fait

### 1. Reset detection dans CheckLimitAsync

Avant de verifier si une limite est depassee, checker si le quota a ete reinitialise depuis le dernier stop :

- Lire `_costStoppedAt` de la session (ISO timestamp)
- Lire `_costLimitType` de la session ("day", "week", "month")
- Lire `_costAutoResume` de la session ("true"/"false")
- Si `autoResume == true` ET le stop est dans une periode precedente :
  - **day** : `_costStoppedAt` est avant minuit aujourd'hui
  - **week** : `_costStoppedAt` est avant lundi 00:00 de cette semaine
  - **month** : `_costStoppedAt` est avant le 1er du mois courant 00:00
- Alors : clear les flags `_costLimitExceeded`, `_costStopped*` et laisser l'execution continuer
- MAIS : verifier que le nouveau quota n'est pas DEJA depasse (d'autres sessions ont pu depenser)

### 2. Resume manuel

Deja gere par la sous-phase A : si l'utilisateur augmente la limite via `/costs set`, le prochain CheckLimitAsync ne depassera plus → execution reprend.

### 3. Clear des flags au resume

Quand une session reprend (manuellement ou auto), clearer :
- `_costLimitExceeded` → supprimer ou set "false"
- `_costLimitMessage` → supprimer
- `_costStoppedAt` → supprimer
- `_costStoppedEntryPoint` → supprimer
- `_costStoppedNodeId` → supprimer
- `_costAutoResume` → supprimer

---

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `apps/backend/src/Maestro.Infrastructure/Pricing/CostTrackingService.cs` | Logique reset detection (date comparison par periode) |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Clear _costStopped* flags quand quota reset et autoResume=true |

---

## Verification

```bash
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

# Test manuel :
# 1. Configurer limite $0.001 day block autoResume=true
# 2. Invoquer → cost stop
# 3. Simuler passage au jour suivant (modifier _costStoppedAt manuellement ou changer la date du JSONL)
# 4. Reinvoquer → devrait reprendre
```

---

## Anti-patterns

- Ne PAS implementer un timer/background job pour l'auto-resume — V1 = detection au prochain appel
- Ne PAS resume si la nouvelle periode est DEJA depassee
- Ne PAS faire d'auto-resume sur les limites par session (pas de reset temporel)
- Ne PAS laisser des flags _costStopped* orphelins apres un resume reussi

---

## Checkpoint

```markdown
## 59-PRE-2-B : Auto-resume
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Reset detection day** : fonctionne / non
**Reset detection week** : fonctionne / non
**Reset detection month** : fonctionne / non
**Clear flags au resume** : OUI / NON
**Pas de resume si nouvelle periode depassee** : verifie / non
```
