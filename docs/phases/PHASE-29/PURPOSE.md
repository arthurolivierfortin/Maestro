# Phase 29 — Adaptation et Optimisation Automatiques

> Date : 2026-02-15
> Prérequis : Phase 28 ✅ (Agent fonctionnel + tiers publiés + manifestes)
> Effort estimé : ~4 jours

---

## Problème

Phase 28 crée et publie des tiers manuellement. Le processus est répétitif :
1. Prendre un bloc
2. Tester avec un modèle moins cher
3. Mesurer le fitness
4. Si OK → substituer, sinon → garder
5. Publier quand tout est testé

Ce processus est automatisable. De plus, chaque utilisateur a une combinaison unique de modèles. Les tiers pré-publiés ne couvrent pas tous les cas.

## Solution

Deux commandes complémentaires, toutes deux implémentées comme des **workflows system** (pas du code hardcodé) :

### `maestro adapt <workflow>`

Prend un workflow publié et les modèles de l'utilisateur, produit un workflow adapté.

- Utilise le **manifeste** (généré en Phase 28-C) pour savoir quels modèles sont requis
- Raccourcit via les **substituts déjà testés** dans le manifeste
- Pour les modèles non testés : exécute une **mini-foundry** (3 itérations, heuristiques)
- Produit un workflow personnalisé sauvegardé dans `.maestro/blocks/`

### `maestro optimize <block>`

Prend un bloc et une stratégie, produit un bloc optimisé.

- L'optimisation est un **meta-workflow** (`system:optimize-block`) qui agit SUR un bloc
- Les **stratégies** sont elles-mêmes des blocs (`model-downgrade`, `prompt-refinement`, etc.)
- Mode `--recursive` pour les workflows : optimise bottom-up (feuilles d'abord)
- Tout est overridable : l'utilisateur peut créer ses propres stratégies

## Principes

1. **Tout est un bloc** — Évaluateurs, adaptateurs, stratégies = blocs system overridables
2. **Le manifeste est la source de vérité** — Pas de devinette, données concrètes
3. **3 niveaux d'évaluation** — Heuristique (toujours) → LLM local (si capable) → Cloud (futur)
4. **Aucune logique domain-spécifique** — Fonctionne pour du code, de la traduction, de la musique
5. **L'évaluateur cloud est un service, pas une dépendance** — Arrêter de payer ≠ perte de fonctionnalité

## Non-goals Phase 29

- Service cloud d'évaluation (Phase 30)
- Marketplace de blocs (Phase 31)
- Auto-découverte de stratégies (recherche future)
