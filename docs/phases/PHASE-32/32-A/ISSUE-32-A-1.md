# Issue 32-A-1 : Definir la matrice de substitution

**Statut** : A faire
**Estimation** : 1 heure
**Bloquant** : Bloque 32-A-2 a 32-A-5
**Prerequis** : Phase 30 complete (fitness connus pour Tier 1)

---

## Description

Definir exactement quels modeles remplacent quels autres dans chaque tier, en se basant sur la nature cognitive de chaque bloc.

---

## Tache

### 1. Matrice de reference

| Tier | prepare | plan | implement | test | review | commit |
|------|---------|------|-----------|------|--------|--------|
| 1 | Opus | Opus | Sonnet | Sonnet | Opus | Sonnet |
| 2 | Sonnet | Opus | Sonnet | Haiku | Sonnet | Haiku |
| 3 | Haiku | Sonnet | Sonnet | Haiku | Sonnet | Qwen |
| 4 | Qwen | Sonnet | Sonnet | Qwen | Haiku | Qwen |
| 5 | Qwen | Qwen | Qwen | Qwen | Qwen | Qwen |

### 2. Justifier chaque substitution

Pour chaque changement de modele, expliquer :
- **Pourquoi ce bloc tolere un modele plus petit** : ex. `test-executor` fait de la detection et du parsing, pas du raisonnement complexe
- **Risque** : ex. `plan` avec Qwen risque des plans incoherents
- **Seuil de fitness minimum** : si le fitness baisse de > 15%, la substitution est rejetee

### 3. Documenter dans un fichier

Creer `docs/phases/PHASE-32/SUBSTITUTION-MATRIX.md` avec la matrice, les justifications, et les seuils.

---

## Critere de completion

- [ ] La matrice est definie pour les 5 tiers
- [ ] Chaque substitution est justifiee
- [ ] Les seuils de fitness minimum sont definis
- [ ] Le document est dans `docs/phases/PHASE-32/`
