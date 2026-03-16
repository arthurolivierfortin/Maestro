# Phase 59-PRE + 59-PRE-2 — Validation Visuelle des Fonctionnalites de Couts

**Date** : 2026-03-16
**Mode** : Real (backend + LLM-Provider + sessions reelles avec couts)

---

## 1. Status Bar — Cout du jour

### Sans depassement de limite
```
│ ● connected  •  5ms  •  12:02:05  •  $0.00 today              [Ctrl+←→]page ...
```
**Comportement** : Affiche `$X.XX today` en jaune/gris. Refresh toutes les 60 secondes.

### Avec depassement (enforcement: block)
```
│ ● connected  •  8ms  •  12:28:28  •  $0.01 today (LIMIT)      [Ctrl+←→]page ...
```
**Comportement** : Affiche `$X.XX today (LIMIT)` en rouge quand la limite daily est depassee et l'enforcement est `block`. Visible sur TOUTES les pages (Agent, Home, Spaces, Foundry, Catalog, Models).

### Apres augmentation de la limite
```
│ ● connected  •  5ms  •  12:30:33  •  $0.01 today              [Ctrl+←→]page ...
```
**Comportement** : Apres `/costs set --per-day 5`, le `(LIMIT)` disparait au prochain poll (60s) car le cout est sous la nouvelle limite.

---

## 2. `/costs` — Resume des couts et limites

**Commande** : Taper `/costs` puis Enter

```
16:29:09 Cost Summary
  Today:      $0.01  (1 requests)
  This week:  $0.01  (1 requests)
  This month: $0.01  (1 requests)
Limits
  Per session: $0.01
  Per day:     $0.00  (remaining: $0.00)
  Per week:    not set
  Per month:   not set
```

**Affiche** : Cout par periode (today/week/month), nombre de requetes, et chaque limite configuree avec le remaining.

---

## 3. `/costs set` — Configurer les limites

### Avec enforcement block
**Commande** : `/costs set --per-day 5 --per-session 1 --enforcement block`

```
16:29:48 Updating cost limits...
16:29:48 Cost limits updated: per-session = $1.00, per-day = $5.00 (block)
```

### Avec enforcement warn et auto-resume
**Commande** : `/costs set --per-day 5 --enforcement warn --auto-resume`

```
15:42:37 Updating cost limits...
15:42:37 Cost limits updated: per-day = $5.00 (warn, auto-resume)
```

### Syntaxe complete
```
/costs set --per-day <amount>       Limite journaliere
           --per-session <amount>   Limite par session
           --per-week <amount>      Limite hebdomadaire
           --per-month <amount>     Limite mensuelle
           --enforcement block|warn  block = arrete l'execution, warn = avertit
           --auto-resume            Reprend automatiquement quand le quota reset
```

---

## 4. `/costs status` — Etat des limites

**Commande** : `/costs status`

```
16:31:16 Cost Status
  No limits exceeded.
  Daily: $0.01 / $5.00  (remaining: $4.99, enforcement: block)
```

**Affiche** : Si des limites sont depassees, avec le type d'enforcement et le remaining.

---

## 5. `/costs clear` — Supprimer toutes les limites

**Commande** : `/costs clear`

```
12:46:48 Clearing cost limits...
12:46:48 All cost limits cleared.
```

---

## 6. `/help` — Aide avec /costs

**Commande** : `/help`

```
16:32:18 Available commands:
  /help    — Show this help message
  /status  — Show session and connection status
  /new     — Start a new conversation (keeps history)
  /clear   — Clear conversation and start fresh
  /stop    — Cancel the current task
  /purge   — Delete all idle/completed sessions
  /costs        — View/set cost limits
  /agent        — Show or switch active agent (/agent compact)
  /create-agent — Create an agent via block-forge workflow
  /quit         — Quit Maestro Code
```

---

## 7. Spaces — Cout par session + PAUSED

```
│  189 session(s)  1/189 ▼                                                                  │
│ → ▼ ○ Visual Test                    4c147c39  idle      PAUSED  fit:   -  $0.01  0ms     │
│     ○ Cost Visual Test               d3807e27  idle      PAUSED  fit:   -  $0.01  0ms     │
│     ○ Cost Limit Test                3dd6f567  idle      PAUSED  fit:   -  $0.01  0ms     │
│     ○ Cost Chain E2E Final           fbaeb25b  idle      PAUSED  fit:   -  $0.01  14h 14m │
│     ○ Cost Chain E2E                 b04aa95e  stopped    fit:   -  $0.00  2m 30s         │
│     ○ Block Forge - An agent that re 34ee0541  idle       fit:  0%  $1.80  42h 23m        │
│     ○ Block Forge - An agent that ge 5431999c  idle       fit:  0%  $0.71  42h 39m        │
```

**Comportement** :
- **`PAUSED`** en rouge pour les sessions avec `_costLimitExceeded = true`
- **`$X.XX`** cout accumule par session visible a cote du fitness
- Les sessions sans depassement n'ont pas `PAUSED`

---

## 8. Pages non impactees

Toutes les pages continuent de fonctionner normalement avec le cout dans le status bar :

- **Home** : Status systeme + sessions actives
- **Foundry** : Liste des blocks
- **Catalog** : 159 blocks avec filtres
- **Models** : Providers + modeles disponibles

---

## Bugs corrige pendant la validation

| Bug | Cause | Fix |
|-----|-------|-----|
| `/costs` affichait `$NaN` pour les limites | `Number({value: 5})` = NaN — le TUI ne gerait pas le nouveau format objet | `getLimitValue()` helper qui gere number et {value} |
| `/costs set` retournait "Operation is not valid" | Le controller utilisait `[FromBody] JsonElement` mais Newtonsoft ne peut pas binder un type System.Text.Json | Lecture du body via `StreamReader` + deserialization System.Text.Json |

---

## Resume des validations

| # | Feature | Mode | Resultat |
|---|---------|------|----------|
| 1 | Status bar `$X.XX today` | Real | PASS |
| 2 | Status bar `(LIMIT)` rouge quand depassement block | Real | PASS |
| 3 | Status bar normal apres augmentation limite | Real | PASS |
| 4 | `/costs` resume avec couts reels | Real | PASS |
| 5 | `/costs set --enforcement block` | Real | PASS |
| 6 | `/costs set --enforcement warn --auto-resume` | Demo | PASS |
| 7 | `/costs status` avec couts reels | Real | PASS |
| 8 | `/costs clear` | Demo | PASS |
| 9 | `/help` inclut `/costs` | Real | PASS |
| 10 | Spaces : cout par session `$X.XX` | Real | PASS |
| 11 | Spaces : `PAUSED` sur sessions avec limite depassee | Real | PASS |
| 12 | Toutes les pages fonctionnent (Home, Foundry, Catalog, Models) | Real | PASS |
