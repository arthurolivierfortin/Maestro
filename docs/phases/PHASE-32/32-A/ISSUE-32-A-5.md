# Issue 32-A-5 : Re-entrainer et mesurer Tier 5

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 32-A-4 (Tier 4 valide)

---

## Description

Tier 5 : 100% local. Tout tourne sur Qwen (ou le meilleur modele local disponible). Cout zero, qualite degradee acceptee.

---

## Substitutions Tier 5

| Bloc | Tier 4 | Tier 5 | Changement |
|------|--------|--------|-----------|
| prepare | Qwen | Qwen | inchange |
| plan | Sonnet | **Qwen** | ↓ local (le plus risque) |
| implement | Sonnet | **Qwen** | ↓ local (le deuxieme plus risque) |
| test | Qwen | Qwen | inchange |
| review | Haiku | **Qwen** | ↓ local |
| commit | Qwen | Qwen | inchange |

---

## Risques specifiques Tier 5

- **plan avec Qwen** : le plan risque d'etre incoherent ou de manquer des dependances
- **implement avec Qwen** : le code risque de ne pas compiler ou de ne pas suivre les conventions
- **Seuil de fitness reduit** : on accepte >= 0.50 pour le Tier 5

---

## Critere de completion

- [ ] Tous les blocs en local
- [ ] Fitness composite >= 0.50
- [ ] Si le Tier 5 est inutilisable : documenter et fixer le seuil minimal a Tier 4
- [ ] Resultats documentes avec les limites observees

---

## Note

Le Tier 5 est un objectif ambitieux. Il est acceptable que le Tier 5 ne soit pas utilisable pour des taches complexes. L'important est de MESURER la degradation et de DOCUMENTER les limites.
