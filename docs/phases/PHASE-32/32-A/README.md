# Phase 32-A : Substitution par bloc

**Statut** : A faire
**Prerequis** : Phase 31 complete (Tier 1 valide)
**Objectif** : Creer les tiers 2-5 en substituant les modeles bloc par bloc.

---

## Vue d'ensemble

| Issue | Titre | Estimation | Risque |
|-------|-------|------------|--------|
| 32-A-1 | Definir la matrice de substitution | 1h | Faible |
| 32-A-2 | Re-entrainer et mesurer Tier 2 (Sonnet/Haiku) | 3-5h | Faible |
| 32-A-3 | Re-entrainer et mesurer Tier 3 (Haiku/Qwen) | 5-8h | Moyen |
| 32-A-4 | Re-entrainer et mesurer Tier 4 (Sonnet/Qwen local) | 8-12h | Eleve |
| 32-A-5 | Re-entrainer et mesurer Tier 5 (tout local) | 12-20h | Tres eleve |

> **Note** : Les estimations ont ete revues a la hausse par rapport au plan initial. La substitution vers des modeles plus petits necessite une reecriture des system prompts, pas un simple changement de model_id. Voir le README Phase 32 pour les details.
>
> **Strategie** : Faire 32-A-2 et 32-A-3 d'abord. Si Tier 3 atteint un fitness acceptable, ALORS tenter 32-A-4. Ne tenter 32-A-5 que si 32-A-4 fonctionne. Chaque tier est un delivrable independant — pas besoin des 5 pour avoir de la valeur.
