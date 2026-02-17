# Issue 32-A-3 : Re-entrainer et mesurer Tier 3

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 32-A-2 (Tier 2 valide)

---

## Description

Tier 3 : Sonnet reste pour l'implementation et la review, Haiku et Qwen pour le reste.

---

## Substitutions Tier 3

| Bloc | Tier 2 | Tier 3 | Changement |
|------|--------|--------|-----------|
| prepare | Sonnet | **Haiku** | ↓ un niveau |
| plan | Opus | **Sonnet** | ↓ un niveau |
| implement | Sonnet | Sonnet | inchange |
| test | Haiku | Haiku | inchange |
| review | Sonnet | Sonnet | inchange |
| commit | Haiku | **Qwen** | ↓ un niveau (local) |

---

## Critere de completion

- [ ] Chaque bloc substitue mesure individuellement
- [ ] Fitness par bloc >= 0.75 (seuil Tier 3)
- [ ] Le composite Tier 3 teste sur 3 scenarios
- [ ] Fitness composite >= 0.75
- [ ] Resultats documentes
