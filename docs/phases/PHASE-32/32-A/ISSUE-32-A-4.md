# Issue 32-A-4 : Re-entrainer et mesurer Tier 4

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 32-A-3 (Tier 3 valide)

---

## Description

Tier 4 : Sonnet uniquement pour plan et implement (les plus critiques), tout le reste en local.

---

## Substitutions Tier 4

| Bloc | Tier 3 | Tier 4 | Changement |
|------|--------|--------|-----------|
| prepare | Haiku | **Qwen** | ↓ local |
| plan | Sonnet | Sonnet | inchange |
| implement | Sonnet | Sonnet | inchange |
| test | Haiku | **Qwen** | ↓ local |
| review | Sonnet | **Haiku** | ↓ un niveau |
| commit | Qwen | Qwen | inchange |

---

## Critere de completion

- [ ] Fitness par bloc >= 0.65 (seuil Tier 4)
- [ ] Fitness composite >= 0.65
- [ ] Si Qwen ne tient pas pour prepare → documenter et revenir a Haiku
- [ ] Resultats documentes
