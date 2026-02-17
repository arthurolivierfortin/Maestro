# Issue 30-D-3 : Foundry pour le composite autonomous-dev

**Statut** : A faire
**Estimation** : 1-2 heures
**Prerequis** : 30-D-2 (tous les sous-blocs avec fitness >= 0.85)

---

## Description

Mesurer le workflow composite complet sur les 3 scenarios (simple, modere, complexe). Le fitness composite est une moyenne ponderee.

---

## Formule de fitness composite

| Critere | Poids |
|---------|-------|
| task-completed (la tache est realisee) | 0.35 |
| code-quality (review score) | 0.25 |
| tests-pass (les tests passent) | 0.20 |
| plan-quality (plan structure et complet) | 0.10 |
| commit-quality (message conventionnel, stage selectif) | 0.10 |

**Seuil** : fitness composite >= 0.85.

---

## Scenarios de test

| # | Scenario | Critere "task-completed" |
|---|----------|------------------------|
| 1 | "Create a README.md" | README existe avec contenu pertinent |
| 2 | "Fix TypeScript errors" | `tsc --noEmit` passe |
| 3 | "Create a file-tree component" | Composant, types, et tests existent |

---

## Critere de completion

- [ ] Session foundry creee et ajoutee au workspace
- [ ] 3 scenarios executes
- [ ] Fitness composite calcule pour chaque scenario
- [ ] Fitness moyen >= 0.85
- [ ] Resultats documentes
