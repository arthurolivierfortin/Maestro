# Phase 32 : Optimisation multi-tiers

**Statut** : A faire
**Prerequis** : Phase 31 COMPLETE (maestro code fonctionnel avec Tier 1)
**Objectif** : Creer 5 tiers d'optimisation en substituant les modeles Claude par des modeles plus petits, bloc par bloc. Chaque tier est mesure et publie avec un manifeste.

---

## Vision

Le Tier 1 utilise Claude Opus/Sonnet partout — qualite maximale, cout maximal. Les tiers 2-5 substituent progressivement des modeles plus petits (Haiku, Qwen, locaux) pour les blocs qui le tolerent, jusqu'au Tier 5 100% local.

```
Tier 1 : Opus + Sonnet        → Qualite 100%, cout $$$
Tier 2 : Opus + Sonnet + Haiku → Qualite ~95%, cout $$
Tier 3 : Sonnet + Haiku + Qwen → Qualite ~85%, cout $
Tier 4 : Sonnet + Qwen local   → Qualite ~75%, cout minimal
Tier 5 : Tout local (Qwen)     → Qualite ~60%, cout 0
```

---

## Sous-phases

| Phase | Titre | Objectif |
|-------|-------|----------|
| 32-A | Substitution par bloc | Creer les tiers 2-5 |
| 32-B | Manifeste et `maestro check` | Publier avec metadata + outil de compatibilite |
| 32-C | Selection automatique dans `maestro code` | Detection des modeles disponibles → meilleur tier |

---

## Principe

- **Substitution granulaire** : on change UN bloc a la fois, pas tout d'un coup
- **Mesure obligatoire** : chaque substitution est mesuree dans la foundry
- **Pas de degradation silencieuse** : si un modele plus petit ne tient pas la qualite, on ne le substitue pas
- **Le manifeste documente tout** : modeles, fitness, substituts testes

## Avertissement : complexite de la substitution vers des petits modeles

La substitution n'est PAS un simple changement de `model_id` dans le .block.json. Les constats de la Phase 13 (research) et Phase 26 (agents) montrent :

1. **Les prompts qui fonctionnent avec Opus NE FONCTIONNENT PAS avec Qwen/SmolLM** — les petits modeles necessitent des prompts plus explicites, avec des few-shot examples, des formats de sortie exacts, et moins d'ambiguite.
2. **SmolLM2-1.7B ne suit pas le protocole tool-call** — il ne peut pas etre utilise pour les agents (Phase 26, valide). Qwen2.5-Coder-1.5B fonctionne mais ajoute des patterns non desires.
3. **Le re-training d'un bloc avec un modele plus petit = reecrire le system prompt** — pas juste le repointer. Budget : 1-2h par bloc par modele, pas 30min.

### Estimations realistes

| Tier | Estimation originale | Estimation corrigee | Raison |
|------|---------------------|--------------------|----|
| 2 (Sonnet/Haiku) | 2-3h | 3-5h | Haiku proche de Sonnet, adaptation minimale |
| 3 (Haiku/Qwen) | 2-3h | 5-8h | Qwen necessite reecriture des prompts |
| 4 (Sonnet/Qwen local) | 2-3h | 8-12h | Prompts agent avec Qwen = travail significatif |
| 5 (tout Qwen) | 2-3h | 12-20h | plan + implement avec Qwen = risque d'echec total |

### Strategie recommandee

- **Tier 2** (Sonnet + Haiku) : realisable rapidement, peu de risque
- **Tier 3** (Haiku + Qwen) : realisable avec effort, fitness probablement degrade
- **Tier 4-5** (majoritairement/tout local) : risque eleve. Ne pas promettre. Tester et voir.

**Si Tier 4 ou 5 ne tient pas un fitness minimal (< 0.50)** : ne pas les publier. Mieux vaut 3 tiers de qualite que 5 tiers dont 2 sont inutilisables.
