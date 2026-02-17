# Phase 30-E : Test E2E en session projet

**Statut** : A faire
**Prerequis** : 30-D-4 (tous les blocs publies)
**Objectif** : Tester l'agent publie comme un utilisateur le ferait. 5 scenarios, gate >= 4/5.

---

## Vue d'ensemble

| Issue | Titre | Estimation |
|-------|-------|------------|
| 30-E-1 | Creer et configurer la session projet | 15min |
| 30-E-2 | 5 scenarios de validation | 2-4h |

## Strategie de protection du repo (OBLIGATOIRE)

Les 5 scenarios E2E modifient Cantante. Chaque scenario DOIT s'executer dans une branche isolee :

```bash
# Avant chaque scenario
cd C:\Cantante
git checkout main
git checkout -b maestro-e2e-scenario-<N>

# Executer le scenario
# ...

# Apres le scenario — noter le resultat, puis nettoyer
git checkout main
git branch -D maestro-e2e-scenario-<N>
```

**Regle** : Pas de modification du composite entre les scenarios (memes prompts pour les 5 tests). Mais chaque scenario repart d'un repo propre (branche fresh depuis main).
