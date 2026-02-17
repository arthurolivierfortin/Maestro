# Issue 32-A-2 : Re-entrainer et mesurer Tier 2

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 32-A-1 (matrice definie)

---

## Description

Creer le Tier 2 en substituant les blocs les plus tolerants (test, commit, review) par des modeles plus petits. Mesurer le fitness du composite.

---

## Tache

### 1. Substitutions Tier 2

| Bloc | Tier 1 | Tier 2 | Changement |
|------|--------|--------|-----------|
| prepare | Opus | **Sonnet** | ↓ un niveau |
| plan | Opus | Opus | inchange |
| implement | Sonnet | Sonnet | inchange |
| test | Sonnet | **Haiku** | ↓ un niveau |
| review | Opus | **Sonnet** | ↓ un niveau |
| commit | Sonnet | **Haiku** | ↓ un niveau |

### 2. Pour chaque bloc modifie

1. Creer une session foundry pour le bloc avec le nouveau modele
2. Mesurer le fitness sur les memes scenarios que 30-D-2
3. Si fitness >= seuil → la substitution est validee
4. Si fitness < seuil → revenir au modele precedent pour ce bloc

### 3. Tester le composite Tier 2

Assembler le composite avec les modeles Tier 2 et executer les 3 scenarios de 30-C.

---

## Critere de completion

- [ ] Chaque bloc substitue est mesure individuellement
- [ ] Fitness par bloc >= 0.80 (seuil Tier 2, 5% sous le Tier 1)
- [ ] Le composite Tier 2 est teste sur 3 scenarios
- [ ] Fitness composite >= 0.80
- [ ] Resultats documentes avec les modeles exacts utilises
