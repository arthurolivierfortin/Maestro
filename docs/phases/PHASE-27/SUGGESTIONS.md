# Phase 27 — Suggestions : Comment empêcher ces erreurs de se reproduire

> Ce document analyse les causes racines des erreurs de la Phase 26 et propose des mécanismes concrets pour les prévenir.

---

## 1. Analyse des causes racines

### Cause 1 : Pas de "gate" entre les versions

**Ce qui s'est passé** : Phase 26 (V3) commencée sans que V1 ou V2 soient terminées.

**Pourquoi** : Aucun mécanisme ne forçait la vérification des prérequis. Le roadmap existait mais rien ne l'imposait comme checklist obligatoire.

**Mécanisme de prévention** : **Gate files** — Un fichier `GATE.md` par version qui liste les critères de passage obligatoires. Chaque critère a un statut (PASS/FAIL) et une preuve (screenshot, commande, URL). On ne passe pas à la version suivante tant que tous les critères ne sont pas PASS.

### Cause 2 : Vérification par API au lieu de l'interface utilisateur

**Ce qui s'est passé** : Les données étaient vérifiées via `curl` (API brute) au lieu de vérifier ce que le monitor/CLI/frontend affiche réellement.

**Pourquoi** : C'est plus rapide et plus facile de parser du JSON que de vérifier une interface visuelle. Mais ça contourne exactement les bugs que l'utilisateur verra.

**Mécanisme de prévention** : **Protocole de vérification visuelle** — Chaque étape doit être vérifiée par ce que l'utilisateur voit. Concrètement :
1. Lancer le monitor dans une fenêtre séparée AVANT toute invocation
2. Après chaque action, vérifier les données telles que le monitor les affiche (via l'API que le monitor utilise, pas via des endpoints directs)
3. Si un composant du monitor n'affiche rien ou affiche des données incorrectes, c'est un bug à corriger AVANT de continuer

### Cause 3 : Pas de critères de "done" explicites

**Ce qui s'est passé** : Des fonctionnalités déclarées "faites" sans validation objective. Le coder-agent a été considéré comme fonctionnel parce qu'il retournait un status 200, alors qu'il ne produisait pas de travail réel.

**Pourquoi** : Pas de définition de ce que "fonctionne" signifie pour chaque feature.

**Mécanisme de prévention** : **Critères d'acceptation** par étape — Chaque tâche dans le plan détaillé a des critères mesurables. Exemples :
- "Le coder-agent fonctionne" = il a modifié un fichier réel dans le repo + le diff est visible dans `git diff`
- "Le monitor affiche les phases" = chaque phase a le bon statut + les phases running ont des enfants dans l'arbre
- "La session est propre" = 0 variables vides, 0 métriques à zéro après exécution

### Cause 4 : Pas de cleanup systématique

**Ce qui s'est passé** : 10 sessions zombies, 7 sessions avec le même nom, 2 références fantômes. Accumulation de déchets sans jamais nettoyer.

**Pourquoi** : Le nettoyage n'est pas dans le workflow. On crée, on teste, on passe à la suite.

**Mécanisme de prévention** : **Étape de cleanup obligatoire** — À la fin de chaque journée de travail ou avant de passer à une nouvelle tâche :
1. Vérifier `session list` — toutes les sessions en "running" sont-elles légitimes ?
2. Vérifier les workspaces — les sessionIds pointent-elles vers des sessions existantes ?
3. Supprimer les sessions de test abandonnées
4. Convention de naming respectée ?

### Cause 5 : Plans trop vagues

**Ce qui s'est passé** : Le plan Phase 26 décrivait des couches (Layer 1-4) et des tables de blocks, mais pas des étapes séquentielles vérifiables.

**Pourquoi** : Un plan architectural n'est pas un plan d'exécution. "Créer le context-builder" n'est pas actionnable — il manque : quels inputs, quels outputs, comment tester, quel critère de succès.

**Mécanisme de prévention** : **Plans d'exécution séquentiels** avec 4 colonnes :
1. **Étape** — Action concrète (verbe + objet)
2. **Commande** — La commande CLI exacte à exécuter
3. **Vérification** — Ce qu'on doit voir après (dans le monitor, le CLI, ou le filesystem)
4. **Statut** — ⬜ TODO / 🔄 EN COURS / ✅ FAIT / ❌ BLOQUÉ

---

## 2. Proposition de structure de travail

### Niveau 1 : Roadmap révisé (ROADMAP-V2.md)

Un nouveau roadmap qui :
- Reprend les versions V1-V4
- Marque ce qui est fait vs ce qui reste
- Réordonne les tâches en fonction de l'état actuel
- Ajoute des gates explicites entre les versions

### Niveau 2 : Plan d'exécution par phase (PLAN-PHASE-XX.md)

Pour chaque phase, un fichier avec :
- **Prérequis** — Quelles phases doivent être complètes
- **Objectif** — En une phrase
- **Étapes** — Tableau séquentiel (étape, commande, vérification, statut)
- **Gate de sortie** — Critères de passage mesurables
- **Cleanup** — Actions de nettoyage en fin de phase

### Niveau 3 : Fichier de statut vivant (STATUS.md)

Un fichier unique à la racine de `docs/phases/PHASE-27/` qui est mis à jour en temps réel :
- Version actuelle en cours
- Phase actuelle
- Étape actuelle dans la phase
- Dernière vérification (date, résultat)
- Blockers actifs
- Sessions actives et leur état

### Niveau 3 bis : Fichier ISSUES.md

Chaque problème découvert pendant l'exécution est logué ici :
- Date
- Contexte (quelle phase, quelle étape)
- Description du problème
- Impact (bloquant / non-bloquant)
- Correction appliquée ou en attente
- Leçon apprise

---

## 3. Règles de conduite proposées

### Règle 1 : Gate obligatoire

> **On ne passe pas à la version N+1 tant que la gate de la version N n'est pas 100% PASS.**

Le fichier GATE contient des critères vérifiables. Chaque critère a une preuve. Si un critère est FAIL, on corrige avant de continuer.

### Règle 2 : Vérification par l'interface utilisateur

> **Toute action doit être vérifiée par ce que l'utilisateur voit, pas par l'API brute.**

Concrètement :
- Monitor lancé AVANT toute invocation de session
- Après invocation : vérifier les phases, l'arbre, les logs DANS le monitor
- Si le monitor n'affiche pas les bonnes données, c'est un bug prioritaire

### Règle 3 : Naming convention unique

> **Format : `{Projet} — {Feature/Action}` pour les sessions réelles, `[TEST] {Description}` pour les tests temporaires.**

Exemples :
- `Cantante — File Tree Module` (session réelle)
- `Cantante — Initial Setup` (session réelle)
- `[TEST] Phase chain validation` (test temporaire, à supprimer après)

### Règle 4 : Cleanup systématique

> **Avant de commencer une nouvelle phase, nettoyer les artefacts de la phase précédente.**

Checklist :
- [ ] Sessions "running" : légitimes ou zombies ?
- [ ] Workspaces : toutes les refs de sessions existent ?
- [ ] Sessions de test : supprimées ?
- [ ] Naming : toutes les sessions suivent la convention ?

### Règle 5 : Plan d'exécution avant le code

> **Pas de code sans plan validé. Le plan contient les commandes CLI exactes et les critères de vérification.**

Un plan vague ("créer le context-builder") n'est pas acceptable. Un plan doit dire :
- Quelle commande créer le block (`maestro block create --name context-builder --type tool ...`)
- Comment le tester (`maestro run context-builder --input workingDir=C:\Cantante`)
- Quel résultat est attendu (output contient les fichiers pertinents, pas d'erreur)
- Comment vérifier dans le monitor (le block apparaît dans le catalog, metrics à jour)

### Règle 6 : Un problème dans le monitor = un blocage

> **Si le monitor affiche quelque chose d'incorrect, on arrête tout et on corrige le monitor d'abord.**

Le monitor EST l'interface utilisateur du TUI. Si le monitor ne fonctionne pas, rien ne fonctionne du point de vue de l'utilisateur. C'est la plus haute priorité.

---

## 4. Proposition de fichiers à créer

| Fichier | Contenu | Quand le mettre à jour |
|---------|---------|----------------------|
| `PHASE-27/ROADMAP-V2.md` | Roadmap révisé avec état actuel | À chaque changement de version |
| `PHASE-27/GATE-V1.md` | Critères de passage V1 → V2 | À chaque critère validé |
| `PHASE-27/GATE-V2.md` | Critères de passage V2 → V3 | Quand V1 est terminée |
| `PHASE-27/STATUS.md` | Statut vivant (version, phase, étape) | À chaque étape complétée |
| `PHASE-27/ISSUES.md` | Journal des problèmes découverts | À chaque problème trouvé |
| `PHASE-27/PLAN-V1-PHASE-19.md` | Plan détaillé Phase 19 | Avant de commencer la phase |
| `PHASE-27/PLAN-V1-PHASE-20.md` | Plan détaillé Phase 20 | Avant de commencer la phase |
| `PHASE-27/PLAN-V1-PHASE-21.md` | Plan détaillé Phase 21 | Avant de commencer la phase |
| `PHASE-27/PLAN-V1-PHASE-22.md` | Plan détaillé Phase 22 | Avant de commencer la phase |

### Format des plans d'exécution

```markdown
# Plan — Phase XX : {Nom}

## Prérequis
- [ ] Phase YY gate PASS

## Objectif
{En une phrase}

## Étapes

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer X | `maestro ...` | Monitor affiche X, CLI retourne Y | ⬜ |
| 2 | Tester X | `maestro run X --input ...` | Output contient Z, pas d'erreur | ⬜ |
| 3 | Vérifier visuellement | Ouvrir monitor, naviguer vers X | X visible, données correctes | ⬜ |

## Gate de sortie
- [ ] Critère 1 — {description} — Preuve : {screenshot/commande}
- [ ] Critère 2 — ...

## Cleanup
- [ ] Supprimer sessions de test
- [ ] Vérifier naming
- [ ] Vérifier workspaces
```

---

## 5. Résumé

| Cause racine | Mécanisme de prévention |
|-------------|------------------------|
| Pas de gate entre versions | Gate files avec critères PASS/FAIL |
| Vérification API au lieu de UI | Protocole de vérification visuelle |
| Pas de critères de "done" | Critères d'acceptation par étape |
| Pas de cleanup | Étape de cleanup obligatoire |
| Plans trop vagues | Plans d'exécution séquentiels avec commandes et vérifications |
| Problèmes monitor ignorés | Règle : monitor cassé = blocage total |

**La question pour l'utilisateur** : Cette structure convient-elle ? Faut-il ajuster le format des plans, ajouter/retirer des règles, ou modifier la granularité des étapes ?
