# Propositions UX — Raffinements Post-V1 Fixes

**Date**: 11 fevrier 2026
**Statut**: IMPLEMENTE
**Contexte**: Suite a l'implementation des 37 items P0-P3, voici des propositions de raffinement UX basees sur les retours d'utilisation.

---

## 1. Monitor: Ne PAS lancer par defaut

### Probleme actuel

`maestro session start <id>` lance automatiquement le monitor dans une nouvelle fenetre (`cmd /c start powershell...`). Ca pose plusieurs problemes:

- Un utilisateur qui travaille avec le **frontend web** se retrouve avec une fenetre PowerShell non desiree
- Un agent/script automatise recoit un processus detache inattendu
- Le lancement echoue silencieusement sur certains environnements (pas de terminal interactif, SSH, CI)
- Ca viole le principe de moindre surprise : une commande `start` ne devrait pas ouvrir une fenetre

### Proposition

**Inverser le defaut** : le monitor ne se lance plus sauf si explicitement demande.

```
Avant:
  maestro session start <id>              → lance le monitor (defaut)
  maestro session start <id> --no-monitor → pas de monitor

Apres:
  maestro session start <id>              → pas de monitor (defaut)
  maestro session start <id> --monitor    → lance le monitor
```

**Message post-start ameliore** :
```
✓ Session started (f2e844a3)

  Status: idle
  Next:   maestro session invoke f2e844 start

  Tip: maestro monitor f2e844   (TUI monitor)
       http://localhost:5173     (Web dashboard)
```

**Impact** : ~10 lignes dans `cli.ts`

---

## 2. Unifier `execute` et `run` en une seule commande

### Probleme actuel

Deux commandes pour la meme action :

| Commande | Cible | API |
|----------|-------|-----|
| `execute <id>` | Workflows | `client.executeWorkflow()` |
| `run <id>` | Blocks atomiques | `POST /api/blocks/{id}/execute` |

L'utilisateur doit savoir si son block est un workflow ou non. C'est une fuite d'abstraction : dans la philosophie Maestro, **tout est un block**.

### Proposition

**Une seule commande `run`** qui detecte automatiquement le type. `execute` devient un alias silencieux.

```
Avant:
  maestro execute gen-commit-workflow --input repo=/path
  maestro run evaluate-fitness --input file=output.json

Apres:
  maestro run gen-commit-workflow --input repo=/path
  maestro run evaluate-fitness --input file=output.json
  maestro run <n'importe-quel-block-id> --input key=value
```

**Impact** : ~50 lignes dans `cli.ts`

---

## 3. Navigation monitor unifiee

### Modele de navigation

Le meme schema partout dans le monitor, que ce soit sur une page (Home, Spaces...) ou dans un detail session :

| Touche | Action | Partout |
|--------|--------|---------|
| **Fleches ←→↑↓** | Se deplacer entre widgets/panels | Oui |
| **Ctrl+←/→** | Changer d'onglet/page | Oui |
| **Ctrl+Shift** | Retour (= Escape) | Oui |
| **1-3** | Saut direct a un panel | Session detail |
| **H/S/F/C/M** | Saut direct a une page | Raccourci rapide |

### 3a. Fleches = navigation entre widgets

**Actuellement** : dans SessionMonitor, Tab/Shift-Tab cyclent entre panels, et les fleches servent au scroll/tree. Sur les pages (Home, Spaces...), les fleches servent a la selection dans les listes.

**Proposition** : Les fleches regulieres deplacent le focus entre les widgets/panels visibles :
- **←→** : navigation horizontale (entre panels sur la meme ligne)
- **↑↓** : navigation verticale (entre lignes de panels, ou scroll si un seul panel est focus)

Quand un panel est en focus et contient un tree/list :
- **↑↓** : navigation dans le contenu du panel (scroll, tree up/down)
- **←→** : collapse/expand dans un tree, sinon panel precedent/suivant

Ca conserve le comportement actuel du tree nav tout en ajoutant la navigation spatiale entre panels.

### 3b. Ctrl+Fleches = changer de page/onglet

Les pages sont ordonnees : Home → Spaces → Foundry → Catalog → Models

```
Ctrl+→  Page suivante   (wrap-around : Models → Home)
Ctrl+←  Page precedente (wrap-around : Home → Models)
```

**Fonctionne partout** — meme dans un SessionMonitor (detail). Ca permet de naviguer entre onglets sans revenir en arriere d'abord.

Necessite de passer `onNavigate` en prop au SessionMonitor depuis App.ts :
```typescript
h(SessionMonitor, {
  sessionId: detailView.id,
  apiClient,
  onExit: handleBack,
  onQuit: handleQuit,
  onNavigate: handleNavigate,  // nouveau
})
```

Les lettres H/S/F/C/M restent comme raccourcis directs (saut en 1 touche).

### 3c. Ctrl+Shift = retour (comme Escape)

#### Limitation technique : terminaux standards

Les terminaux classiques (Windows Terminal, cmd, xterm, gnome-terminal) **ne peuvent pas detecter** les touches modificateurs seules (Ctrl, Shift, Ctrl+Shift) sans une touche accompagnante. C'est une limitation du protocole ANSI : seules les combinaisons modificateur+caractere generent une sequence d'echappement.

Le **Kitty keyboard protocol** (supporte par Kitty, WezTerm, et certains terminaux recents) peut detecter les modificateurs seuls, mais on ne peut pas se baser dessus pour tous les utilisateurs.

#### Decision

Puisque les terminaux standards ne peuvent pas detecter Ctrl+Shift seul, on garde **Escape** comme unique touche de retour. C'est simple, universel, et deja en place.

| Touche | Action |
|--------|--------|
| **Escape** | Retour (inchange) |

---

## 4. Raccourcis chiffres : garder pour les panels

Les touches **1-3** pour sauter directement a un panel dans SessionMonitor restent pertinentes :

- Moins de deplacement des doigts (ligne du haut vs fleches)
- Acces direct vs sequentiel (1 touche vs N presses de fleche)
- Pas de conflit avec les autres raccourcis

**Aucun changement necessaire.**

---

## Resume des changements

| # | Changement | Effort | Impact |
|---|-----------|--------|--------|
| 1 | Monitor off par defaut | ~10 lignes | Haut |
| 2 | `run` unifie (`execute` = alias) | ~50 lignes | Haut |
| 3a | Fleches = nav entre widgets | ~40 lignes | Moyen |
| 3b | Ctrl+←/→ = changer de page (partout) | ~45 lignes | Haut |
| 3c | Escape = retour (inchange) | 0 lignes | - |
| 4 | Chiffres pour panels (inchange) | 0 lignes | - |

**Total** : ~145 lignes, 0 breaking changes.

---

## Schema visuel du modele de navigation

```
          Ctrl+←              Ctrl+→
            ←                   →             (wrap-around)
  ┌──────┬──────┬───────┬───────┬──────┐
  │ Home │Spaces│Foundry│Catalog│Models│──── Ctrl+→ ──→ Home
  └──┬───┴──────┴───────┴───────┴──────┘
     │
     │  Esc = retour
     │
     ┌──────────────────────────────────┐
     │        Page ou Session Detail    │
     │                                  │
     │   ┌─────────┐  ┌─────────┐      │
     │   │ Panel 1 │←→│ Panel 2 │  ←→  │  Fleches ←→
     │   └────┬────┘  └─────────┘      │
     │        ↕                         │  Fleches ↑↓
     │   ┌─────────┐  ┌─────────┐      │
     │   │ Panel 3 │←→│ Panel 4 │      │
     │   └─────────┘  └─────────┘      │
     │                                  │
     │   1-3 = saut direct au panel     │
     └──────────────────────────────────┘
```

---

## Decisions

1. **Wrap-around** : Oui. Ctrl+→ sur Models revient a Home, Ctrl+← sur Home va a Models.
2. **Retour** : Escape uniquement. Pas de Backspace (risque de conflit avec futurs champs texte).
3. **Fleches sur les pages** : ←→ changent de section/panel, ↑↓ naviguent dans la liste/contenu du panel actif.
