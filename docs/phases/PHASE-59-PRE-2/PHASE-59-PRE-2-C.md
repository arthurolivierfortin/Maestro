# 59-PRE-2-C : TUI + CLI — Affichage enforcement, /costs status, parsing

---

## Lecture obligatoire

- `docs/phases/PHASE-59-PRE-2/PHASE-59-PRE-2-A.md` — CostLimitConfig, variables _costStopped*
- `packages/maestro-code/App.ts` — parseCostsCommand actuel, handler /costs, status bar
- `packages/maestro-code/components/SpacesScreen.ts` — liste sessions
- `packages/maestro-code/tests/CostsSlash.test.ts` — tests existants
- `packages/maestro-cli/cli.ts` — commande `costs set-limit` actuelle

---

## Ce que cette sous-phase fait

### 1. Update parseCostsCommand

Supporter les nouveaux flags :
- `--enforcement block|warn` (defaut: block)
- `--auto-resume` (flag boolean)
- Nouveau sous-commande : `/costs status`

Exemples :
```
/costs set --per-day 5 --enforcement block --auto-resume
/costs set --per-week 20 --enforcement warn
/costs status
```

### 2. Handler /costs set — envoyer enforcement + autoResume

Le handler `set` doit construire le nouveau format :
```json
{ "maxPerDay": { "value": 5.0, "enforcement": "block", "autoResume": true } }
```

Fetch existing limits d'abord, merge, envoyer.

### 3. Handler /costs status (nouveau)

Appeler `apiClient.getCostsSummary()` et afficher les sessions en pause :
```
Cost Status
  2 sessions paused by cost limits
  Session abc123 — paused at $5.12 (daily limit $5.00, auto-resume: on)
  Session def456 — paused at $1.05 (session limit $1.00, auto-resume: off)
  Next daily reset: in 3h 12m
```

Note : V1 simplifiee — `/costs status` affiche les limites et le "remaining" deja present dans summary. L'info sur les sessions pausees viendrait de l'API (les sessions avec `_costLimitExceeded=true`). Si l'API ne fournit pas ca, afficher seulement les limites + remaining.

### 4. Status bar — indicateurs

Modifier le composant StatusBar :
- Si le daily cost poll retourne que la limite est depassee (comparer `today.totalCost >= limits.maxPerDay.value`) :
  - Si enforcement = block : afficher `$5.12 today (LIMIT)` en rouge
  - Si enforcement = warn : afficher `$5.12 today (!)` en jaune
- Si pas depassee : `$0.42 today` en jaune normal

### 5. Messages conversation

Quand le handler `/costs` affiche le summary et qu'une limite est depassee :
- Block : ligne rouge `Daily limit EXCEEDED: $5.12 / $5.00 (enforcement: block — executions stopped)`
- Warn : ligne jaune `Daily limit exceeded: $5.12 / $5.00 (enforcement: warn — executions continue)`

### 6. SpacesScreen — indicateur PAUSED

Pour chaque session, lire `variables._costLimitExceeded`. Si "true", afficher `PAUSED` en rouge a cote du statut.

### 7. CLI costs set-limit — update

Ajouter `--enforcement block|warn` et `--auto-resume` flags. Meme logique de merge que le TUI.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | parseCostsCommand (--enforcement, --auto-resume, status), handler /costs status, status bar color logic |
| `packages/maestro-code/components/SpacesScreen.ts` | Indicateur PAUSED par session |
| `packages/tui/components/StatusBar.ts` | Props pour limit exceeded type (block/warn/none) |
| `packages/maestro-cli/cli.ts` | costs set-limit --enforcement --auto-resume |
| `packages/maestro-code/mocks/DemoApiClient.ts` | Update mock getCostsSummary avec enforcement data |

---

## Verification

```bash
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

cd C:\Meastro\packages\maestro-code && npx vitest run tests/CostsSlash.test.ts
# Tous les tests passent (anciens + nouveaux)
```

---

## Anti-patterns

- Ne PAS appeler l'API a chaque render pour le status bar — utiliser le poll deja en place (60s)
- Ne PAS bloquer le TUI si l'API echoue — afficher l'etat sans indicateur
- Ne PAS dupliquer la logique de comparaison limite/usage — une seule fonction utilitaire

---

## Checkpoint

```markdown
## 59-PRE-2-C : TUI + CLI enforcement
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**parseCostsCommand --enforcement** : fonctionne
**parseCostsCommand --auto-resume** : fonctionne
**/costs status** : affiche
**Status bar LIMIT rouge** : visible
**Status bar ! jaune** : visible
**SpacesScreen PAUSED** : visible
**CLI --enforcement + --auto-resume** : fonctionne
**Type check** : 0 erreurs
```
