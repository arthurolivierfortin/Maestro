# 59-PRE-F : Slash command `/costs` — Configuration des limites dans le TUI

**But** : Permettre a l'utilisateur de voir et configurer les limites de cout directement dans le TUI via slash commands `/costs`.

---

## Commandes

| Commande | Action |
|----------|--------|
| `/costs` | Affiche le resume (today/week/month) + limites actuelles |
| `/costs limits` | Affiche les limites actuelles |
| `/costs set --per-day 5.00` | Configure la limite journaliere |
| `/costs set --per-session 1.00 --per-day 5.00 --per-week 20.00 --per-month 50.00` | Configure plusieurs limites |
| `/costs clear` | Supprime toutes les limites |

## Lecture obligatoire

- `packages/maestro-code/App.ts` — pattern des slash commands existantes (`/create-agent`, `/agent`, `/help`, `/quit`)
- `packages/maestro-code/tests/CreateAgentSlash.test.ts` — pattern de test pour le parsing
- `packages/maestro-cli/api-client.ts` — `getCostsSummary()`, `getCostsLimits()`, `setCostsLimits()`
- `packages/tui/types/api-client.ts` — interface IApiClient (getCostsSummary, getCostsLimits deja presents)
- `apps/backend/src/Maestro.Api/Controllers/CostsController.cs` — endpoints API existants

## Ce que cette sous-phase fait

### F1 : Parser `/costs`

Creer une fonction `parseCostsCommand(input: string)` exportee (comme `parseCreateAgent`) qui retourne :
- `{ action: 'summary' }` pour `/costs` ou `/costs summary`
- `{ action: 'limits' }` pour `/costs limits`
- `{ action: 'set', limits: { perDay?, perSession?, perWeek?, perMonth? } }` pour `/costs set --per-day X ...`
- `{ action: 'clear' }` pour `/costs clear`
- `null` si le parsing echoue

### F2 : Handler dans App.ts

Dans `handleSubmit`, ajouter le handler pour `/costs` (meme pattern que `/create-agent`) :

**`/costs` ou `/costs summary`** :
- Appeler `apiClient.getCostsSummary()`
- Afficher dans la conversation :
  ```
  Cost Summary
    Today:      $0.42  (23 requests)
    This week:  $1.87  (112 requests)
    This month: $5.23  (342 requests)

  Limits
    Per session: $1.00
    Per day:     $5.00  (remaining: $4.58)
    Per week:    not set
    Per month:   not set
  ```

**`/costs set --per-day 5.00`** :
- Appeler `apiClient.setCostsLimits(merged)` (fetch existing first, merge, write)
- Afficher confirmation : `Cost limit updated: per-day = $5.00`

**`/costs clear`** :
- Appeler `apiClient.setCostsLimits({})` (toutes les limites a null)
- Afficher confirmation : `All cost limits cleared`

### F3 : Ajouter `setCostsLimits` a IApiClient + DemoApiClient

- `packages/tui/types/api-client.ts` : ajouter `setCostsLimits(limits: any): Promise<any>`
- `packages/maestro-code/mocks/DemoApiClient.ts` : ajouter mock qui retourne les limites passees
- `packages/maestro-cli/api-client.ts` : deja present (`setCostsLimits`)

### F4 : Ajouter `/costs` dans HelpOverlay

- `packages/maestro-code/components/HelpOverlay.ts` : ajouter `/costs` dans la liste des commandes

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | Modifier : ajouter handler `/costs` dans handleSubmit + parseCostsCommand export |
| `packages/maestro-code/components/HelpOverlay.ts` | Modifier : ajouter `/costs` |
| `packages/tui/types/api-client.ts` | Modifier : ajouter `setCostsLimits` |
| `packages/maestro-code/mocks/DemoApiClient.ts` | Modifier : ajouter `setCostsLimits` mock |
| `packages/maestro-code/tests/CostsSlash.test.ts` | Creer : tests unitaires |

## Tests (F-T)

### Tests unitaires — `CostsSlash.test.ts`

| Test | Description |
|------|-------------|
| 1 | `parseCostsCommand('/costs')` retourne `{ action: 'summary' }` |
| 2 | `parseCostsCommand('/costs summary')` retourne `{ action: 'summary' }` |
| 3 | `parseCostsCommand('/costs limits')` retourne `{ action: 'limits' }` |
| 4 | `parseCostsCommand('/costs set --per-day 5.00')` retourne `{ action: 'set', limits: { perDay: 5.0 } }` |
| 5 | `parseCostsCommand('/costs set --per-session 1 --per-day 5 --per-month 50')` retourne les 3 limites |
| 6 | `parseCostsCommand('/costs clear')` retourne `{ action: 'clear' }` |
| 7 | `parseCostsCommand('/costs set')` sans flags retourne `null` (erreur) |
| 8 | `parseCostsCommand('/costs invalid')` retourne `null` |
| 9 | `parseCostsCommand('/cost')` ne matche pas (pas de 's') |

### Verification visuelle — agent e2e-tester via TUI dogfood

Apres implementation, lancer le TUI en mode real et verifier :

1. **Spawn** TUI en mode demo (pas besoin de backend pour le parsing)
2. **Taper** `/costs` → verifier qu'un resume s'affiche dans la conversation (meme si mock data)
3. **Taper** `/costs set --per-day 5.00` → verifier message de confirmation
4. **Taper** `/costs limits` → verifier que les limites s'affichent
5. **Taper** `/costs clear` → verifier message de confirmation
6. **Taper** `/help` → verifier que `/costs` apparait dans la liste

Utiliser `mcp__tui-dogfood__tui_spawn` en mode demo, `tui_type`, `tui_press`, `tui_check` pour verifier chaque etape.

## Verification

```bash
# Type check
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests unitaires
cd C:\Meastro\packages\maestro-code && npx vitest run tests/CostsSlash.test.ts
# 9/9 pass

# Tests complets (pas de regression)
cd C:\Meastro\packages\maestro-code && npx vitest run
# 155+9 = 164 pass / memes echecs pre-existants

# Verification visuelle via TUI dogfood
# (voir section ci-dessus)
```

## Anti-patterns

- Ne PAS creer une page entiere pour les couts — une slash command dans la conversation suffit
- Ne PAS appeler l'API a chaque render — un seul appel au moment ou la commande est tapee
- Ne PAS bloquer le TUI si l'API costs echoue — afficher un message d'erreur dans la conversation
- Ne PAS utiliser `globalThis.fetch` — utiliser `apiClient.getCostsSummary()` et `apiClient.setCostsLimits()` (le SDK gere le transport)

## Checkpoint

```markdown
## 59-PRE-F : Slash command /costs
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tests unitaires** : X/9 pass
**Verification visuelle** : /costs affiche resume, /costs set confirme, /help liste /costs
**Type check** : 0 erreurs
**Regression** : 0 nouveaux echecs
```

---

## Effort

~0.5 jour (implementation + tests + verification visuelle)
