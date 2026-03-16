# 59-PRE-H : Cost Enforcement — Hard stop configurable + Graceful shutdown + Auto-resume

**But** : Faire en sorte que les limites de couts arretent reellement l'execution quand elles sont depassees, sans corrompre les sessions en cours. L'utilisateur choisit le comportement (hard block ou soft warning). Les sessions arretees peuvent reprendre manuellement ou automatiquement quand le quota se reinitialise.

**Priorite** : HAUTE — sans enforcement, les limites n'ont aucun effet concret.

---

## Probleme actuel

Quand une limite est depassee, `BlockRefHandler` set `_costLimitExceeded = true` sur la session mais l'execution continue. Les limites sont decoratives.

## Exigences

1. **L'utilisateur choisit** : hard stop ou soft warning (par limite)
2. **Graceful shutdown** : le block en cours termine normalement, c'est le SUIVANT qui est refuse
3. **Pas de perte de donnees** : la session reste dans un etat coherent (idle, pas error/corrupted)
4. **Resume manuel** : apres un hard stop, l'utilisateur peut augmenter la limite et relancer
5. **Resume automatique** : option `autoResume: true` — quand le quota journalier/hebdo/mensuel se reinitialise, les sessions en attente reprennent automatiquement
6. **Message clair** : l'utilisateur sait exactement quelle limite, combien depense, et comment reprendre

---

## Design

### Modele de configuration

```json
{
  "limits": {
    "maxPerSession": { "value": 1.00, "enforcement": "block" },
    "maxPerDay": { "value": 5.00, "enforcement": "block", "autoResume": true },
    "maxPerWeek": { "value": 20.00, "enforcement": "warn" },
    "maxPerMonth": { "value": 50.00, "enforcement": "block", "autoResume": false }
  }
}
```

- `enforcement` : `"block"` (defaut) ou `"warn"`
- `autoResume` : `true` = les sessions stoppees par cette limite reprennent automatiquement quand le quota reset (minuit pour day, lundi pour week, 1er du mois pour month). `false` (defaut) = resume manuel uniquement
- **Backward compat** : si la valeur est un nombre simple (`"maxPerDay": 5.0`), traiter comme `{ value: 5.0, enforcement: "block", autoResume: false }`
- `maxPerSession` ne supporte pas `autoResume` (pas de reset temporel)

### Enforcement dans BlockRefHandler

**AVANT chaque execution de block** :

```
1. Lire les limites + usage courant (session + jour + semaine + mois)
2. Pour chaque limite configuree :
   a. Si depassee ET enforcement = "block" :
      - Ne PAS executer le block
      - Set _costLimitExceeded = true
      - Set _costLimitType = "day" | "week" | "month" | "session"
      - Set _costLimitMessage = message detaille
      - Set _costStoppedAt = timestamp ISO
      - Set _costAutoResume = true/false (selon config)
      - Signaler au workflow engine : STOP_GRACEFUL
      - Return BlockExecutionResult { Success = false, ... }
   b. Si depassee ET enforcement = "warn" :
      - Set _costLimitExceeded = true + message
      - Log warning
      - Continuer normalement
3. Si aucune limite depassee : executer normalement
```

### Graceful shutdown — session coherente

Quand un hard stop se produit :
- Le block en cours a DEJA termine (check AVANT le prochain)
- Variables de session preservees (_accumulatedCost, tout l'etat du workflow)
- `_activeWorkflow` nettoyee proprement
- Session status = `idle` (PAS `error`) — elle est resumable
- `_costStoppedAt` = quand le stop s'est produit
- `_costStoppedEntryPoint` = quel entry point etait en cours (pour resume)
- `_costStoppedNodeId` = quel noeud etait le prochain (pour resume exact)
- Arbre d'execution : dernier block = "completed", noeud suivant = "cost-limit-stopped"

### Resume manuel

1. L'utilisateur augmente la limite : `/costs set --per-day 10.00`
2. Reinvoque le meme entry point : la session reprend
3. OU : `/costs set --per-day 5.00 --enforcement warn` (change en warning)

### Resume automatique

Quand `autoResume: true` sur une limite temporelle :
- Un timer dans `CostTrackingService` verifie periodiquement (toutes les 60s) si des sessions sont en attente de resume
- Quand le quota se reinitialise (nouvelle journee, nouvelle semaine, nouveau mois) :
  - Trouver les sessions avec `_costAutoResume = true` et `_costLimitType` correspondant
  - Verifier que le nouveau quota n'est pas deja depasse
  - Reinvoquer l'entry point stocke dans `_costStoppedEntryPoint`
  - Log : "Auto-resuming session {id} — daily cost limit reset"

**Implementation V1 simplifiee** : au lieu d'un timer actif, verifier au prochain `BlockRefHandler` call si le quota a ete reset depuis `_costStoppedAt`. Si oui, clear les flags et continuer. Ca evite un background timer et couvre le cas d'usage principal (l'utilisateur relance le lendemain).

### TUI — affichage

**Hard stop** :
- Message rouge dans conversation : "Execution stopped: daily cost limit ($5.00) exceeded. Current: $5.12."
- Sous-message gris : "Use /costs set --per-day X to increase, or wait for daily reset (auto-resume: on)."
- Status bar : `$5.12 today (LIMIT)` en rouge

**Warning** :
- Message jaune : "Warning: daily cost limit ($5.00) exceeded. Current: $5.12."
- Status bar : `$5.12 today (!)` en jaune

**Auto-resume en attente** :
- Status bar : `$5.12 today (PAUSED - resets in 3h12m)` en jaune

### CLI / Slash commands

```bash
# Set avec enforcement + autoResume
/costs set --per-day 5.00 --enforcement block --auto-resume
/costs set --per-day 5.00 --enforcement warn
/costs set --per-session 1.00 --enforcement block

# Voir l'etat des sessions stoppees
/costs status
# Output: 2 sessions paused (cost limit). Next reset: daily in 3h12m.
```

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Domain/Entities/CostLimits.cs` | Refactorer : `CostLimitConfig { Value, Enforcement, AutoResume }` par limite |
| `apps/backend/src/Maestro.Application/DTOs/CostDtos.cs` | Update CostLimitsDto, ajouter CostLimitCheckResult.Enforcement |
| `apps/backend/src/Maestro.Infrastructure/Pricing/CostTrackingService.cs` | Update CheckLimitAsync (retourne enforcement + autoResume), backward compat config, reset detection |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Check AVANT execution, graceful stop, set _costStopped* vars |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` | Gerer le signal STOP_GRACEFUL de BlockRefHandler |
| `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` | Methode GracefulCostStop() : cleanup _activeWorkflow, preserve state |
| `packages/maestro-code/App.ts` | Status bar rouge/jaune, message conversation, parseCostsCommand update |
| `packages/maestro-code/App.ts` | `parseCostsCommand` : `--enforcement block|warn`, `--auto-resume` |
| `packages/maestro-cli/cli.ts` | `costs set-limit` : `--enforcement`, `--auto-resume` |
| `packages/maestro-code/components/SpacesScreen.ts` | Indicateur "PAUSED" pour sessions stoppees par cout |
| `packages/maestro-code/tests/CostsSlash.test.ts` | Tests parsing enforcement + auto-resume |

---

## Tests

### Backend — CostTrackingService (unit)

| # | Test | Description |
|---|------|-------------|
| 1 | CheckLimit block — session depassee | Limite session $0.01, cout $0.02 → exceeded=true, enforcement=block |
| 2 | CheckLimit block — jour depasse | Limite jour $0.01, cumul jour $0.02 → exceeded=true, enforcement=block |
| 3 | CheckLimit block — semaine depassee | Limite semaine $0.05, cumul semaine $0.06 → exceeded=true |
| 4 | CheckLimit block — mois depasse | Limite mois $1.00, cumul mois $1.05 → exceeded=true |
| 5 | CheckLimit warn — depasse mais continue | Limite jour $0.01 warn, cout $0.02 → exceeded=true, enforcement=warn |
| 6 | CheckLimit — sous la limite | Limite jour $1.00, cout $0.01 → exceeded=false |
| 7 | CheckLimit — pas de limite configuree | Aucune limite → exceeded=false |
| 8 | CheckLimit — multiple limites, une depassee | Session OK, jour depasse → retourne la limite depassee |
| 9 | CheckLimit — multiple limites, priorite | Session + jour depasses → retourne session (plus restrictive) |
| 10 | Backward compat — ancien format nombre | `"maxPerDay": 5.0` → interprete comme `{ value: 5.0, enforcement: "block" }` |
| 11 | Config reload — limites modifiees | Modifier limits, appeler CheckLimit → nouvelles limites appliquees |
| 12 | Reset detection — nouveau jour | `_costStoppedAt` = hier, limite = day → quota reset, pas de blocage |
| 13 | Reset detection — meme jour | `_costStoppedAt` = aujourd'hui → quota pas reset, blocage maintenu |
| 14 | Reset detection — nouvelle semaine | `_costStoppedAt` = semaine derniere → quota reset |
| 15 | Reset detection — nouveau mois | `_costStoppedAt` = mois dernier → quota reset |

### Backend — BlockRefHandler (unit/integration)

| # | Test | Description |
|---|------|-------------|
| 16 | Hard stop — block refuse | Limite depassee block → block suivant pas execute, retourne Success=false |
| 17 | Hard stop — block en cours termine | Block 1 execute, cout depasse, block 2 refuse (pas block 1 interrompu) |
| 18 | Warn — block continue | Limite depassee warn → block execute normalement, _costLimitExceeded=true |
| 19 | Variables preservees apres stop | Apres hard stop, toutes les variables de session sont intactes |
| 20 | _activeWorkflow nettoyee | Apres hard stop, _activeWorkflow = "" |
| 21 | Session status idle | Apres hard stop, session.status = idle (pas error) |
| 22 | _costStopped* vars set | _costStoppedAt, _costStoppedEntryPoint, _costStoppedNodeId sont renseignes |
| 23 | _costAutoResume set | Si autoResume=true dans config, _costAutoResume="true" sur la session |

### Backend — Resume (integration)

| # | Test | Description |
|---|------|-------------|
| 24 | Resume apres augmentation limite | Hard stop → augmenter limite → reinvoquer → execution reprend |
| 25 | Resume apres changement enforcement | Hard stop → changer en warn → reinvoquer → execution continue |
| 26 | Resume auto — reset quotidien | Session stoppee hier, autoResume=true → nouvelle invocation passe |
| 27 | Resume auto — meme jour | Session stoppee aujourd'hui, autoResume=true → invocation refusee |
| 28 | Resume auto — reset hebdo | Session stoppee semaine derniere → invocation passe |
| 29 | Pas de resume auto si desactive | autoResume=false → invocation toujours refusee (meme apres reset) |

### Backend — Workflows multi-blocks (integration)

| # | Test | Description |
|---|------|-------------|
| 30 | Workflow 3 blocks — stop au milieu | Block 1 OK, cout depasse, block 2 refuse, block 3 jamais atteint |
| 31 | Workflow avec for-each — stop en iteration | Iteration 1 OK, cout depasse, iteration 2 refuse |
| 32 | Workflow avec condition — stop avant condition | Block depasse, condition jamais evaluee |
| 33 | Agent loop — stop entre iterations | Iteration agent 1 OK, cout depasse, iteration 2 refuse, _agentDone pas set |

### TUI — Parsing (unit)

| # | Test | Description |
|---|------|-------------|
| 34 | `/costs set --per-day 5 --enforcement block` | Parse enforcement=block |
| 35 | `/costs set --per-day 5 --enforcement warn` | Parse enforcement=warn |
| 36 | `/costs set --per-day 5` | Default enforcement=block |
| 37 | `/costs set --per-day 5 --auto-resume` | Parse autoResume=true |
| 38 | `/costs set --per-day 5 --enforcement warn --auto-resume` | Les deux flags |
| 39 | `/costs set --enforcement invalid` | Retourne null (erreur) |
| 40 | `/costs status` | Parse action=status |

### TUI — Affichage (visual/e2e)

| # | Test | Description |
|---|------|-------------|
| 41 | Status bar — limite block atteinte | `(LIMIT)` en rouge visible |
| 42 | Status bar — limite warn atteinte | `(!)` en jaune visible |
| 43 | Status bar — pas de limite atteinte | Pas d'indicateur special |
| 44 | Conversation — message hard stop | Message rouge avec montant + instruction /costs |
| 45 | Conversation — message warning | Message jaune avec montant |
| 46 | Spaces — session pausee | Indicateur "PAUSED" sur la session |
| 47 | `/costs status` — sessions en attente | Liste les sessions pausees + prochain reset |

---

## Verification visuelle (obligatoire)

Via TUI dogfood (e2e-tester) :

1. `/costs set --per-day 0.001 --enforcement block`
2. Lancer une inference → depasse immediatement
3. Verifier : message rouge "Execution stopped..."
4. Verifier : status bar `(LIMIT)` rouge
5. `/costs set --per-day 5.00` → augmenter
6. Relancer → verifier que ca reprend
7. `/costs set --per-day 0.001 --enforcement warn`
8. Lancer une inference → depasse
9. Verifier : message jaune "Warning..." (pas d'arret)
10. Verifier : status bar `(!)` jaune

---

## Anti-patterns

- Ne PAS bloquer PENDANT l'execution d'un block — seulement AVANT le suivant
- Ne PAS mettre la session en statut "error" — utiliser "idle" (resumable)
- Ne PAS perdre les variables de session lors du stop
- Ne PAS hardcoder l'enforcement — toujours lire la config
- Ne PAS ignorer l'ancien format de config (nombre simple) — backward compat
- Ne PAS implementer un timer actif pour l'auto-resume V1 — verifier au prochain appel
- Ne PAS faire de l'auto-resume sur les limites par session (pas de reset temporel)
- Ne PAS resume une session si la nouvelle periode est AUSSI deja depassee

---

## Effort

~2.5 jours (backend enforcement + graceful shutdown + auto-resume + TUI updates + 47 tests + verification visuelle)
