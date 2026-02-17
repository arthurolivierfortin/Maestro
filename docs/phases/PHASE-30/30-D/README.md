# Phase 30-D : Pipeline foundry et publication

**Statut** : A faire
**Prerequis** : 30-C-5 (composite stable, 3/3 tests reussis)
**Objectif** : Mesurer le fitness de chaque sous-bloc et du composite via le pipeline officiel, puis publier.

---

## Vue d'ensemble

| Issue | Titre | Estimation | Bloquant ? |
|-------|-------|------------|-----------|
| 30-D-0 | **Verifier/adapter le template foundry pour les agents** | 1-2h | **OUI** |
| 30-D-1 | Creer le workspace Phase 30 | 10min | Non |
| 30-D-2 | Foundry pour chaque sous-bloc | 2-3h | Non |
| 30-D-3 | Foundry pour le composite autonomous-dev | 1-2h | Non |
| 30-D-4 | Publier tous les blocs | 30min | Non |

**Ordre** : 30-D-0 en premier (valide que la foundry fonctionne pour les agents). Puis strictement sequentiel.

> **ATTENTION** : 30-D-0 est une issue de validation ajoutee suite a l'analyse des plans. Le template foundry-default a ete concu pour l'inference (gen-commit). Rien ne garantit qu'il fonctionne pour les agents. Tester AVANT de lancer 6 sessions foundry.
