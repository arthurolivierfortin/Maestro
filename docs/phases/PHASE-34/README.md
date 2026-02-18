# Phase 34 : Optimisation multi-tiers

**Statut** : A faire
**Prerequis** : Phase 33 COMPLETE (maestro code fonctionnel avec Tier 1)
**Objectif** : Creer des tiers d'optimisation en substituant les modeles Claude par des modeles plus petits, bloc par bloc. Chaque tier est mesure et publie avec un manifeste.

---

## Vision

Le Tier 1 utilise Claude Opus/Sonnet partout — qualite maximale, cout maximal.
Les tiers suivants substituent progressivement des modeles plus petits (Haiku, Qwen,
locaux) pour les blocs qui le tolerent, en mesurant le fitness a chaque etape.

```
Tier 1 : Opus + Sonnet        → Qualite 100%, cout $$$    (Phase 30, existe)
Tier 2 : Sonnet + Haiku       → Qualite ~95%, cout $$
Tier 3 : Haiku + Qwen         → Qualite ~85%, cout $
Tier 4 : Sonnet + Qwen local  → Qualite ~75%, cout minimal
Tier 5 : Tout local (Qwen)    → Qualite ~60%, cout 0     (si possible)
```

---

## Sous-phases

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 34-A | Fitness par bloc | Mesurer le fitness individuel de chaque sous-bloc | 2-3 jours |
| 34-B | Tier 2 (Sonnet + Haiku) | Substituer les blocs simples par Haiku | 3-5 jours |
| 34-C | Manifeste et `maestro check` | Publier avec metadata, outil de compatibilite | 2-3 jours |
| 34-D | Tier 3+ (si fitness suffisant) | Continuer la descente si les resultats sont bons | 5-10 jours |

---

## 34-A : Fitness par bloc

Actuellement, le fitness est mesure au niveau du workflow (3/3 tests passing).
Il faut mesurer chaque sous-bloc individuellement :

| Bloc | Metriques a mesurer |
|------|-------------------|
| project-preparer | Produit un contexte JSON valide avec les bons champs |
| task-planner | Produit un plan avec des etapes atomiques et realisables |
| implement-single-step | Le code produit compile/fonctionne |
| test-executor | Les tests produits sont pertinents et executables |
| code-reviewer | Le review identifie les vrais problemes |
| git-committer | Le commit est propre avec un bon message |

**Methode** : Executer chaque bloc 5 fois avec des inputs varies, mesurer le taux de succes.

---

## 34-B : Tier 2 (Sonnet + Haiku)

Substitution des blocs les moins exigeants par Haiku :

| Bloc | Modele Tier 1 | Candidat Tier 2 | Risque |
|------|--------------|----------------|--------|
| project-preparer | Claude Sonnet | Claude Haiku | Faible |
| git-committer | Claude Sonnet | Claude Haiku | Faible |
| test-executor | Claude Sonnet | Claude Haiku | Moyen |
| code-reviewer | Claude Sonnet | Claude Haiku | Moyen |
| task-planner | Claude Sonnet | Claude Sonnet | Garder (critique) |
| implement-single-step | Claude Sonnet | Claude Sonnet | Garder (critique) |

**Principe** : On ne substitue que les blocs ou la qualite tient. Si un bloc degrade
le fitness global en-dessous de 0.80, on revient au modele precedent.

---

## 34-C : Manifeste et `maestro check`

Chaque tier publie inclut un manifeste :

```json
{
  "tier": 2,
  "models": {
    "project-preparer": {"model": "claude-haiku", "fitness": 0.92},
    "task-planner": {"model": "claude-sonnet", "fitness": 0.95},
    "implement-single-step": {"model": "claude-sonnet", "fitness": 0.90}
  },
  "globalFitness": 0.91,
  "testedSubstitutes": {
    "project-preparer": [
      {"model": "claude-haiku", "fitness": 0.92},
      {"model": "qwen-2.5-coder", "fitness": 0.65}
    ]
  }
}
```

`maestro check <workflow>` : verifie que les modeles requis par le manifeste sont
disponibles via le LLM-Provider.

---

## Avertissement : complexite de la substitution vers des petits modeles

Les constats de Phase 13 (research) et Phase 26 (agents) montrent :

1. **Les prompts Opus/Sonnet NE FONCTIONNENT PAS avec Qwen/SmolLM** — il faut
   reecrire les prompts avec des few-shot examples et des formats explicites.
2. **SmolLM2-1.7B ne suit pas le protocole tool-call** — inutilisable pour les agents.
3. **Le re-training = reecrire le system prompt** — pas juste changer le model_id.

**Si un tier ne tient pas un fitness minimal (< 0.50)** : ne pas le publier.
Mieux vaut 3 tiers de qualite que 5 tiers dont 2 sont inutilisables.

---

## Criteres de completion

- [ ] Fitness individuel mesure pour les 6 sous-blocs
- [ ] Tier 2 publie avec manifeste (fitness global >= 0.80)
- [ ] `maestro check` verifie la compatibilite modeles
- [ ] Au moins 2 tiers publies et fonctionnels
