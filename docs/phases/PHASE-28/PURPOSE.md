# Phase 28 — But et Vision

> Date : 2026-02-15
> Statut : Document de compréhension — V2 après review

---

## La philosophie ne change pas

> "Small specialized LLMs with focused context > large generalist LLMs. Composition and orchestration over monolithic solutions."

Le but de Maestro n'est pas d'utiliser Claude comme un gros agent monolithique. Le but est de **créer des workflows optimisés** qui fonctionnent avec **n'importe quelle combinaison de providers/modèles**, et que chaque utilisateur puisse utiliser le meilleur workflow possible pour ses ressources.

Ce que Claude nous donne, c'est un **point de départ de qualité maximale** — pas une destination.

---

## Le problème que Phase 28 résout

Phase 26 a échoué parce que les petits modèles locaux ne pouvaient pas produire de la qualité suffisante pour des tâches complexes. On passait tout notre temps à contourner les limitations des modèles au lieu de construire des workflows.

Maintenant, avec le ClaudeCodeProvider (Phase 26-B), on a accès à des modèles capables. Ça nous permet de :

1. **D'abord construire le workflow parfait** avec les meilleurs modèles (qualité maximale, fitness élevé)
2. **Ensuite optimiser** en remplaçant progressivement les gros modèles par des plus petits, là où la qualité le permet
3. **Publier des variantes** à différents niveaux de qualité/coût pour que chaque utilisateur ait un agent adapté à ses ressources

C'est exactement la philosophie Maestro : fitness = (qualité × succès) / coût. On commence par maximiser la qualité, puis on optimise le coût.

---

## Le plan en 3 phases

### Phase A : L'agent "idéal" (qualité maximale)

Créer le meilleur workflow d'agent autonome possible, en utilisant les meilleurs modèles disponibles (Claude Opus/Sonnet). Cet agent est le **plafond de qualité** — on sait que avec ces modèles, il n'y a plus de problème de contexte trop court ou de modèle trop faible.

Le workflow doit :
- Prendre une tâche en texte libre
- Analyser le projet (conventions, architecture, code existant)
- Planifier les étapes
- Implémenter le code
- Tester
- Faire la review
- Commiter et livrer

À la fin de cette phase, on a un agent fonctionnel qui peut autonomement développer un projet. On le teste sur Cantante.

**Mais** : cet agent utilise Claude Opus partout — c'est cher et pas accessible à tous. Ce n'est pas la destination, c'est le point de départ.

### Phase B : Le mode agent dans le CLI

Ajouter un mode au CLI qui utilise ce workflow pour offrir une expérience interactive de développement autonome. Ce mode :

- Se lance dans un repo : `maestro agent` (ou similaire)
- Lit le dossier `.maestro/` du repo (ROADMAP.md, CONVENTIONS.md, README.md, etc.)
- **Questionne l'utilisateur** pour remplir ou créer les documents manquants (comme Claude Code qui demande des clarifications)
- Quand il a toutes les informations nécessaires, **exécute le projet autonomement**
- Affiche la progression en temps réel via des widgets (réutilisant le monitor TUI)
- Ressemble à Claude Code mais avec l'orchestration et la traçabilité Maestro

L'utilisateur voit ce qui se passe, peut intervenir, et tout est tracé dans les sessions/workspaces.

### Phase C : Optimisation et publication multi-tiers

C'est ici que la philosophie Maestro s'exprime pleinement.

**Étape 1 — Même qualité, meilleur fitness :**
Le workflow de l'agent "idéal" utilise Claude Opus partout. Mais pour générer un message de commit, Claude Opus est overkill — un petit modèle fait très bien le travail. On optimise chaque bloc du workflow :
- Garder Claude Opus là où c'est nécessaire (planification complexe, raisonnement architectural)
- Descendre à Sonnet/Haiku pour les tâches intermédiaires (code review, test generation)
- Descendre à des modèles locaux pour les tâches simples (commit messages, PR descriptions)

Le critère : **le fitness baisse mais la qualité reste identique**. Quand on atteint un plateau → publish cet agent.

**Étape 2 — Descendre le seuil de qualité de 5% :**
On recommence l'optimisation mais en acceptant 5% de qualité en moins. Ça permet de remplacer plus de modèles coûteux par des modèles accessibles.

Quand le nouveau plateau est atteint → publish cette variante.

**Étape 3 — Répéter :**
On descend encore de 5%, optimise, publie. Et ainsi de suite jusqu'à avoir :
- **Agent Tier 1** : Claude Opus partout — qualité maximale, coût élevé
- **Agent Tier 2** : Mix Opus + Sonnet + locaux — 95% qualité, coût moyen
- **Agent Tier 3** : Mix Sonnet + Haiku + locaux — 90% qualité, coût faible
- **Agent Tier 4** : Principalement locaux — 80% qualité, coût quasi-nul
- ...

**Résultat** : N'importe quel utilisateur peut arriver, configurer ses providers (juste des modèles locaux, ou Claude, ou Azure, ou un mix), et Maestro lui propose le meilleur agent possible pour ses ressources.

---

## Ce que ça change concrètement

### Avant (Phase 26)
- Moi (Claude Code) = le coaching/entraineur humain
- Les agents = des blocs avec des petits modèles limités
- Le workflow = je lance manuellement chaque étape
- Résultat : agents qui décrivent ce qu'ils feraient au lieu de le faire

### Maintenant (Phase 28)
- Le workflow Maestro = l'orchestrateur autonome
- Claude (dans le workflow) = le modèle qui exécute les tâches complexes
- Moi (Claude Code) = le créateur du workflow et des blocs (pas l'exécutant)
- L'optimisation = le processus Maestro standard (foundry → fitness → publish)
- Résultat : des agents publiés à différents niveaux de qualité/coût

### Le rôle de chacun

| Acteur | Rôle |
|--------|------|
| **Moi (Claude Code dans cette session)** | Crée les workflows, blocs, system prompts. Configure les sessions. Lance les tests. Itère sur les prompts. |
| **L'agent dans le workflow** | Exécute les tâches de développement autonomement. Ne sait pas qu'il est dans Maestro. A des outils CLI. |
| **Maestro (infrastructure)** | Orchestre, trace, mesure, contrôle le contexte, gère les sessions et le fitness. |
| **L'utilisateur final** | Configure ses providers, lance `maestro agent` dans un repo, interagit quand nécessaire. |

---

## Audit V1/V2 — Prérequis

Le STATUS.md de Phase 27 dit V1 et V2 sont terminées. Avant de commencer la V3 :

1. Vérifier que les gates V1 (24 critères) et V2 (19 critères) sont réellement passées
2. Si des gaps bloquants sont trouvés → les résoudre d'abord
3. Mettre à jour le roadmap avec l'état réel

---

## Vérification technique — Ce qui doit marcher

Avant de construire le workflow :

1. **Le ClaudeCodeProvider fonctionne** — un bloc Maestro avec `model=claude-sonnet` produit une réponse
2. **Le LLM-Provider route correctement** — la requête passe par le .NET API et arrive au bon provider
3. **L'AgentBlockExecutor supporte les modèles Claude** — model override dans config fonctionne
4. **Les tool calls marchent** — l'agent peut appeler file-read, file-write, shell-execute via maestro_cli
5. **Le contexte est gérable** — on peut contrôler ce que l'agent reçoit comme contexte

---

## Résumé

**Phase 28 = Créer le meilleur workflow d'agent autonome possible (qualité max avec Claude), l'encapsuler dans un mode CLI interactif (comme Claude Code mais avec Maestro), puis optimiser progressivement pour publier des variantes à chaque palier de fitness/qualité, pour que n'importe quel utilisateur avec n'importe quels modèles ait accès à un agent autonome adapté à ses ressources.**

La philosophie Maestro ne change pas — elle s'applique enfin à son objectif le plus ambitieux.
