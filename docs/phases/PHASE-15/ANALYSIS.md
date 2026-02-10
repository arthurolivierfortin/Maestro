# Phase 15 — Analyse : CLI UX Polish & Monitor Improvements

**Date** : 2026-02-10
**Statut** : Analyse initiale
**Requête source** : `docs/phases/PHASE-15/request.md`

> **Focus Phase 15** : Rendre le CLI shell et le TUI Monitor plus "user-friendly" — style, loading, interactivité, ergonomie. Pas de nouvelles features fonctionnelles, mais du polish UX.

---

## Table des matières

1. [Audit de l'existant](#1-audit-de-lexistant)
2. [Analyse des demandes](#2-analyse-des-demandes)
3. [Recommandations](#3-recommandations)
4. [Plan d'implémentation](#4-plan-dimplémentation)
5. [Questions techniques](#5-questions-techniques)

---

## 1. Audit de l'existant

### 1.1 CLI Shell (`maestro-cli/shell.js`)

| Aspect | État actuel | Verdict |
|--------|------------|---------|
| **Prompt** | `maestro> ` ou `maestro [shortId]> ` | Basique, pas de couleur |
| **Autocomplétion** | Aucune | Manque critique |
| **Historique** | `readline` natif, pas de persistance | Fonctionnel mais limité |
| **Commandes contextuelles** | `use <id>` pour switcher de session | L'ID complet est requis |
| **Affichage des résultats** | `console.log` / `console.table` brut | Pas de formatage riche |
| **Loading/Spinners** | Aucun | Les requêtes API semblent "mortes" |
| **Couleurs** | Aucune dans le shell | Tout est monochrome |
| **Sélection interactive** | Aucune | Pas de listes navigables |

### 1.2 TUI Monitor

| Aspect | État actuel | Verdict |
|--------|------------|---------|
| **Bibliothèque** | `blessed@0.1.81` + `blessed-contrib@4.11.0` | Stable mais ancien |
| **Background** | Noir (`black`) par défaut | Pas de gris uniforme |
| **Panels** | Layout fixe (% hardcodé) | Pas redimensionnable |
| **Souris** | Désactivée | Pas de clic, pas de drag |
| **Thème** | 8 couleurs de base, noir/blanc/cyan/green/red | Fonctionnel mais plat |
| **Bordures** | `line` style basique | Pas de shadow, pas de depth |
| **Status bar** | 160+ caractères de shortcuts | Surchargée |
| **Widgets blessed-contrib** | Non utilisés | Table, Bar, Line, Donut disponibles mais ignorés |
| **Transitions** | Aucune | Changement de mode abrupt |

### 1.3 Ce qui fonctionne bien

- Architecture de composants propre et extensible
- Auto-détection de mode (descriptor/execution/idle)
- Auto-scroll vers le nœud actif dans le workflow tree
- Sparklines pour l'historique de scores
- Session cards bien formatées dans la liste globale
- Couleurs cohérentes (cyan = actif, green = succès, red = erreur)

---

## 2. Analyse des demandes

### 2.1 "Le shell CLI plus user-friendly, comme Claude Code"

Claude Code utilise :
- **Autocomplétion intelligente** avec fuzzy search
- **Spinners/loading** animés pendant les requêtes
- **Sélection interactive** (listes navigables avec flèches)
- **Couleurs riches** et formatage Markdown dans le terminal
- **Raccourcis contextuels** affichés en bas
- **Historique persistant** avec recherche

**Ce qu'on peut faire** :
- Remplacer `readline` par une lib plus riche (`inquirer` pour la sélection, `ora` pour les spinners, `chalk` pour les couleurs)
- Autocomplétion : commandes + IDs de session (via API)
- Sélection d'ID par liste interactive au lieu de taper l'ID complet
- Spinners pendant les appels API
- Couleurs dans les résultats

### 2.2 "Le monitor avec un background gris complet"

Blessed supporte `style.bg` sur le screen et les boxes. Changer le background global :

```javascript
const screen = blessed.screen({
  style: { bg: 'gray' }  // ou '#1a1a2e' pour un gris foncé
});
```

Et les panels avec un fond légèrement différent pour créer du contraste :

```javascript
const box = blessed.box({
  style: { bg: '#16213e', fg: 'white' }  // fond bleu-gris foncé
});
```

**Note** : `blessed@0.1.81` supporte les couleurs 256 et hex sur les terminaux modernes. Le rendu dépend du terminal.

### 2.3 "Fenêtres redimensionnables avec la souris"

**Verdict : Partiellement possible, mais avec des limites.**

Ce que `blessed` peut faire :
- `mouse: true` sur le screen — active les événements souris
- `clickable: true` sur les boxes — rend cliquable
- Événements `mousedown`, `mouseup`, `mousemove` — permettent le drag custom

Ce que `blessed` ne peut PAS faire nativement :
- Pas de resize handles natifs
- Pas de window docking/snapping
- Pas de split panes natifs

**Approche réaliste** : Implémenter un **système de resize custom** :
1. Détecter le clic sur la bordure entre deux panels (zone de 1 char)
2. Tracker le drag (mousemove)
3. Recalculer les dimensions des panels adjacents
4. Re-render

C'est faisable mais demande un effort significatif. Alternative plus simple : **modes de layout prédéfinis** (compact, expanded, focus-left, focus-right) switchables via raccourcis.

### 2.4 "Aperçus sans ouvrir le monitor"

Le CLI devrait pouvoir afficher un résumé rapide d'une session sans lancer le TUI complet :

```bash
maestro session info <id>        # Déjà existant mais basique
maestro session peek <id>        # NOUVEAU : aperçu riche inline
maestro session peek <id> --live # NOUVEAU : mini-monitor inline (auto-refresh)
```

Le `peek` afficherait dans le terminal normal (pas de blessed) :
- Status + phase courante
- Fitness + itération
- Derniers 3 logs
- Arbre d'exécution condensé (1 ligne par nœud actif)

---

## 3. Recommandations

### 3.1 Nouvelles dépendances proposées

| Package | Usage | Taille | Justification |
|---------|-------|--------|---------------|
| `chalk` | Couleurs dans le shell | 10KB | Standard Node.js pour les couleurs terminal |
| `ora` | Spinners/loading | 15KB | Standard pour les indicateurs de chargement |
| `inquirer` | Sélection interactive | 30KB | Listes navigables, prompts confirmés |
| `cli-table3` | Tableaux formatés | 12KB | Meilleur que `console.table` (alignement, couleurs, bordures) |
| `fuzzy` | Recherche fuzzy | 5KB | Pour l'autocomplétion intelligente |

**Alternative légère** : On peut aussi rester avec `readline` et implémenter l'autocomplétion + les couleurs manuellement avec `chalk` seul. Plus léger mais plus de code.

### 3.2 Améliorations CLI Shell — Par priorité

#### Priorité 1 : Impact visuel immédiat

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | **Spinners API** — `ora` pendant chaque appel API | S | Élimine l'impression de "mort" |
| 2 | **Couleurs résultats** — `chalk` pour formatter les outputs | S | Visuel immédiatement meilleur |
| 3 | **Prompt coloré** — Couleur cyan pour `maestro>`, vert quand session active | S | Repère visuel du contexte |
| 4 | **Tableaux propres** — `cli-table3` au lieu de `console.table` | S | Alignement et bordures propres |

#### Priorité 2 : Ergonomie

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 5 | **Autocomplétion commandes** — Tab complète les commandes | M | Découvrabilité |
| 6 | **Sélection interactive d'ID** — Liste navigable au lieu de taper l'ID | M | Élimine le copier-coller d'IDs |
| 7 | **Historique persistant** — Sauvé dans `~/.maestro_history` | S | Confort entre sessions |
| 8 | **Session peek** — Aperçu inline sans monitor | M | Info rapide |

#### Priorité 3 : Polish

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 9 | **Welcome message amélioré** — Stats au démarrage (sessions actives, blocks) | S | Professionnel |
| 10 | **Aide contextuelle** — Suggestions de commandes basées sur le contexte | M | Guidage |
| 11 | **Raccourcis Ctrl+** — Ctrl+L clear, Ctrl+R search history | S | Power users |

### 3.3 Améliorations TUI Monitor — Par priorité

#### Priorité 1 : Style

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | **Background gris uniforme** — `#1a1a2e` ou `#2d2d44` sur tout le screen | S | Look professionnel immédiat |
| 2 | **Panels avec depth** — Fond légèrement plus clair, bordures subtiles | S | Hiérarchie visuelle |
| 3 | **Status bar condensée** — Seulement les shortcuts pertinents au mode | S | Moins de bruit |
| 4 | **Header redesign** — Logo/titre centré, fitness prominente | S | Première impression |

#### Priorité 2 : Interactivité

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 5 | **Support souris** — Clic sur panels pour focus, scroll avec molette | M | Navigation naturelle |
| 6 | **Panels focusables** — Tab/clic pour changer le focus, panel focusé a une bordure bright | M | Indication claire du contexte |
| 7 | **Zoom/expand** — Double-clic ou raccourci pour maximiser un panel | M | Focus sur un détail |

#### Priorité 3 : Avancé

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 8 | **Resize avec drag** — Drag sur les bordures pour redimensionner | L | Flexibilité totale |
| 9 | **Layout presets** — Ctrl+1/2/3 pour basculer entre layouts (compact/expanded/focus) | M | Personnalisation |
| 10 | **Widgets blessed-contrib** — Bar charts pour fitness, line charts pour historique | M | Visualisation données |

### 3.4 Mon avis sur le redimensionnement à la souris

**C'est faisable mais je recommande une approche progressive** :

1. **Phase 15a** : Support souris basique (clic pour focus, scroll molette) + layout presets (raccourcis)
2. **Phase 15b** : Drag-to-resize si le besoin est confirmé

Raisons :
- Le drag-to-resize dans blessed est un système custom complet (300+ lignes)
- Les layout presets couvrent 80% du besoin pour 20% de l'effort
- Le clic pour focus + zoom est plus intuitif que le resize précis
- On peut toujours ajouter le drag plus tard sans casser

---

## 4. Plan d'implémentation

### Phase 15a : Style + Ergonomie de base

```
1.  Installer chalk, ora, cli-table3
2.  CLI : Spinners sur tous les appels API
3.  CLI : Prompt coloré (cyan/vert)
4.  CLI : Tableaux cli-table3 au lieu de console.table
5.  CLI : Couleurs dans les résultats (success vert, error rouge, info cyan)
6.  CLI : Autocomplétion des commandes (readline.completer)
7.  CLI : Historique persistant (~/.maestro_history)
8.  Monitor : Background gris uniforme + panels avec depth
9.  Monitor : Status bar condensée par mode
10. Monitor : Header redesign
```

### Phase 15b : Interactivité

```
11. CLI : Sélection interactive d'IDs (inquirer ou custom)
12. CLI : Session peek (aperçu inline)
13. Monitor : Support souris (clic focus, molette scroll)
14. Monitor : Panels focusables (Tab + bordure bright)
15. Monitor : Zoom/expand panel (Enter ou double-clic)
16. Monitor : Layout presets (Ctrl+1/2/3)
```

### Phase 15c : Polish avancé (si le temps le permet)

```
17. Monitor : Widgets blessed-contrib (bar charts, line charts)
18. Monitor : Drag-to-resize sur les bordures
19. CLI : Aide contextuelle
20. CLI : Welcome message avec stats
```

---

## 5. Questions techniques

### Q1 : `chalk` vs blessed tags pour les couleurs ?

- **Shell** : `chalk` — le shell utilise `console.log`, pas blessed
- **Monitor** : blessed tags (`{cyan-fg}...{/}`) — le monitor est dans blessed

Pas de conflit, chacun utilise le système de couleurs de son contexte.

### Q2 : `inquirer` vs custom pour la sélection interactive ?

| | `inquirer` | Custom readline |
|--|-----------|----------------|
| **Effort** | Petit (lib fait tout) | Moyen (gestion clavier manuelle) |
| **Taille** | +30KB deps | 0 deps |
| **Features** | Listes, checkbox, confirmation, fuzzy | Ce qu'on code |
| **Style** | Propre par défaut | Contrôle total |

**Recommandation** : `inquirer` pour la sélection d'IDs. Le gain de temps justifie la dépendance.

### Q3 : Couleur de background gris — quelle valeur ?

Options testées sur terminaux courants :

| Valeur | Apparence | Compatibilité |
|--------|-----------|---------------|
| `gray` (named) | Gris moyen | Tous terminaux |
| `#1a1a2e` | Bleu-gris très foncé (style "modern dark") | 256-color+ |
| `#2d2d44` | Violet-gris foncé | 256-color+ |
| `#1e1e2e` | Catppuccin-like dark | 256-color+ |
| `234` (xterm) | Gris foncé (#1c1c1c) | 256-color |

**Recommandation** : Utiliser `234` (xterm-256) comme fallback et `#1a1a2e` pour les terminaux qui supportent le hex. Blessed choisit automatiquement le meilleur disponible.

### Q4 : Impact sur les performances ?

- `chalk` : Négligeable
- `ora` : Un timer interval par spinner — négligeable
- Souris dans blessed : Events supplémentaires — négligeable
- `blessed-contrib` charts : Calcul de rendu — acceptable si < 100 points de données
- `inquirer` : Seulement actif quand on demande un input — aucun impact en arrière-plan

### Q5 : Compatibilité Windows (WSL/PowerShell/cmd) ?

| Feature | WSL | PowerShell | cmd.exe |
|---------|-----|------------|---------|
| `chalk` couleurs | Oui | Oui (Win10+) | Limité |
| `ora` spinners | Oui | Oui | Glitchy |
| Souris blessed | Oui | Oui | Non |
| 256 couleurs | Oui | Windows Terminal oui | Non |
| Hex couleurs | Oui | Windows Terminal oui | Non |

Le projet tourne principalement sous WSL → tout fonctionne. Pour cmd.exe natif, les couleurs se dégradent gracieusement.
