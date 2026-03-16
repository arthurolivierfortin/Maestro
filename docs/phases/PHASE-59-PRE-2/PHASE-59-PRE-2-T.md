# 59-PRE-2-T : Tests — 47 tests planifies

---

## Lecture obligatoire

- `docs/phases/PHASE-59-PRE-2/cost-enforcement-analysis.md` — liste complete des 47 tests
- `docs/system/TESTING-PROTOCOL.md` — 6 couches obligatoires
- `apps/backend/tests/Maestro.Execution.Tests/` — pattern de tests backend existants
- `packages/maestro-code/tests/CostsSlash.test.ts` — tests existants (9) pour parseCostsCommand

---

## Couches applicables

| Couche | Applicable | Description |
|--------|-----------|-------------|
| C1 — Type Check | OUI | `dotnet build` + `npx tsc --noEmit` |
| C2 — Unit tests | OUI | CostTrackingService (15), BlockRefHandler (8), parsing TUI (7) |
| C3 — Visual Gate | OUI | Status bar LIMIT/!, PAUSED dans Spaces |
| C4 — Real Demo Check | OUI | Verification module resolution |
| C5 — Integration | OUI | Resume (6), workflows multi-blocks (4) |
| C6 — E2E Dogfooding | OUI | Verification visuelle via TUI dogfood (7 scenarios) |

---

## Tests backend — CostTrackingService (15 unit tests)

Fichier : `apps/backend/tests/Maestro.Execution.Tests/CostTrackingServiceTests.cs`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | CheckLimit block — session depassee | limit session $0.01, cost $0.02 | exceeded=true, enforcement=block, type=session |
| 2 | CheckLimit block — jour depasse | limit day $0.01, daily total $0.02 | exceeded=true, enforcement=block, type=day |
| 3 | CheckLimit block — semaine depassee | limit week $0.05, weekly total $0.06 | exceeded=true, enforcement=block, type=week |
| 4 | CheckLimit block — mois depasse | limit month $1.00, monthly total $1.05 | exceeded=true, enforcement=block, type=month |
| 5 | CheckLimit warn — depasse mais warn | limit day $0.01 warn, cost $0.02 | exceeded=true, enforcement=warn |
| 6 | CheckLimit — sous la limite | limit day $1.00, cost $0.01 | exceeded=false |
| 7 | CheckLimit — pas de limite configuree | no limits | exceeded=false |
| 8 | CheckLimit — multiple limites, une depassee block | session OK, day block depasse | retourne day (block prend priorite) |
| 9 | CheckLimit — multiple limites, priorite block > warn | session warn depasse, day block depasse | retourne day (block) |
| 10 | Backward compat — ancien format nombre | `"maxPerDay": 5.0` dans config | parse comme `{ value: 5.0, enforcement: "block", autoResume: false }` |
| 11 | Backward compat — nouveau format objet | `"maxPerDay": { "value": 5, "enforcement": "warn" }` | parse correctement |
| 12 | Reset detection — nouveau jour | stoppedAt = hier, type = day | quota reset, pas de blocage |
| 13 | Reset detection — meme jour | stoppedAt = aujourd'hui 3h, type = day | quota PAS reset |
| 14 | Reset detection — nouvelle semaine | stoppedAt = semaine derniere, type = week | quota reset |
| 15 | Reset detection — nouveau mois | stoppedAt = mois dernier, type = month | quota reset |

---

## Tests backend — BlockRefHandler (8 unit/integration tests)

Fichier : `apps/backend/tests/Maestro.Execution.Tests/BlockRefHandlerCostTests.cs`

| # | Test | Description |
|---|------|-------------|
| 16 | Hard stop — block refuse | Limite depassee block → block suivant PAS execute, retourne Success=false |
| 17 | Hard stop — block en cours pas interrompu | Block 1 execute OK, cout depasse, block 2 refuse (block 1 pas touche) |
| 18 | Warn — block continue | Limite depassee warn → block execute normalement, _costLimitExceeded=true |
| 19 | Variables preservees apres stop | Toutes les variables pre-existantes intactes apres hard stop |
| 20 | _activeWorkflow nettoyee | _activeWorkflow = "" apres hard stop |
| 21 | Session status idle | session.status = idle (pas error) apres hard stop |
| 22 | _costStopped* vars set | _costStoppedAt, _costStoppedEntryPoint, _costStoppedNodeId renseignes |
| 23 | _costAutoResume set | autoResume=true dans config → _costAutoResume="true" sur session |

---

## Tests backend — Resume (6 integration tests)

Fichier : `apps/backend/tests/Maestro.Execution.Tests/CostResumeTests.cs`

| # | Test | Description |
|---|------|-------------|
| 24 | Resume apres augmentation limite | Hard stop → augmenter limite → reinvoquer → execution passe |
| 25 | Resume apres changement enforcement | Hard stop → changer en warn → reinvoquer → execution continue |
| 26 | Auto-resume — reset quotidien | stoppedAt = hier, autoResume=true → nouvelle invocation passe |
| 27 | Auto-resume — meme jour | stoppedAt = aujourd'hui, autoResume=true → invocation refusee |
| 28 | Auto-resume — reset hebdo | stoppedAt = semaine derniere → invocation passe |
| 29 | Pas d'auto-resume si desactive | autoResume=false, stoppedAt = hier → invocation toujours refusee |

---

## Tests backend — Workflows multi-blocks (4 integration tests)

Fichier : `apps/backend/tests/Maestro.Execution.Tests/CostWorkflowTests.cs`

| # | Test | Description |
|---|------|-------------|
| 30 | Workflow 3 blocks — stop au milieu | Block 1 OK, cout depasse, block 2 refuse, block 3 jamais atteint |
| 31 | Workflow avec for-each — stop en iteration | Iteration 1 OK, cout depasse, iteration 2 refuse |
| 32 | Workflow avec condition — stop avant condition | Block depasse, condition jamais evaluee |
| 33 | Agent loop — stop entre iterations | Iteration agent 1 OK, cout depasse, iteration 2 refuse |

---

## Tests TUI — Parsing (7 unit tests)

Fichier : `packages/maestro-code/tests/CostsSlash.test.ts` (ajouter aux 9 existants)

| # | Test | Input | Expected |
|---|------|-------|----------|
| 34 | enforcement block | `/costs set --per-day 5 --enforcement block` | `{ action: 'set', limits: { perDay: 5 }, enforcement: 'block' }` |
| 35 | enforcement warn | `/costs set --per-day 5 --enforcement warn` | `{ action: 'set', limits: { perDay: 5 }, enforcement: 'warn' }` |
| 36 | default enforcement | `/costs set --per-day 5` | enforcement = 'block' (defaut) |
| 37 | auto-resume flag | `/costs set --per-day 5 --auto-resume` | `autoResume: true` |
| 38 | enforcement + auto-resume | `/costs set --per-day 5 --enforcement warn --auto-resume` | les deux flags |
| 39 | enforcement invalide | `/costs set --per-day 5 --enforcement invalid` | retourne null |
| 40 | /costs status | `/costs status` | `{ action: 'status' }` |

---

## Tests TUI — Affichage (7 visual/e2e tests)

Via TUI dogfood (e2e-tester agent) :

| # | Test | Scenario | Verification |
|---|------|----------|-------------|
| 41 | Status bar LIMIT rouge | Config limit block depassee | Frame contient `(LIMIT)` |
| 42 | Status bar ! jaune | Config limit warn depassee | Frame contient `(!)` |
| 43 | Status bar normal | Pas de limite depassee | Pas de `(LIMIT)` ni `(!)` |
| 44 | Message conversation hard stop | Invoquer apres hard stop | Frame contient "Execution stopped" en rouge |
| 45 | Message conversation warning | Invoquer avec warn depassee | Frame contient "Warning:" en jaune |
| 46 | Spaces PAUSED | Session avec _costLimitExceeded=true | Frame contient "PAUSED" |
| 47 | /costs status | Taper /costs status | Frame contient "sessions paused" ou "No sessions paused" |

---

## Verification globale

```bash
# Type check
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests backend
cd C:\Meastro\apps\backend && dotnet test
# Tous les nouveaux tests passent

# Tests TUI
cd C:\Meastro\packages\maestro-code && npx vitest run
# 0 regression, 16 nouveaux tests (9 existants + 7 nouveaux parsing)

# Visual gate
cd C:\Meastro\packages\maestro-code && npm run test:visual
# Golden files OK
```

---

## Anti-patterns

- Ne PAS ecrire des tests qui dependant de l'heure exacte — utiliser des dates injectables ou mocker DateTime
- Ne PAS tester uniquement le happy path — tester les edge cases (multiple limites, backward compat, resume echoue)
- Ne PAS skip les tests integration (workflows multi-blocks) — c'est la que les bugs de graceful shutdown apparaissent
- Ne PAS supposer que les tests visual passent sans les lancer — capturer les frames

---

## Checkpoint

```markdown
## 59-PRE-2-T : Tests
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tests backend CostTrackingService** : X/15 pass
**Tests backend BlockRefHandler** : X/8 pass
**Tests backend Resume** : X/6 pass
**Tests backend Workflows** : X/4 pass
**Tests TUI parsing** : X/7 pass (+ 9 existants)
**Tests TUI visual** : X/7 pass
**Total** : X/47
**Regression** : 0 nouveaux echecs sur tests existants
```
