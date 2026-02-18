# Phase 30-C : Assembler le workflow composite

**Statut** : COMPLETE (2026-02-18) — 3/3 tests passing, 7 iterations documented
**Prerequis** : 30-A (toutes les issues) + 30-B (tous les sous-blocs testes individuellement)
**Objectif** : Assembler `autonomous-dev` comme workflow composite et le tester sur 3 niveaux de difficulte.

---

## Vue d'ensemble

| Issue | Titre | Estimation |
|-------|-------|------------|
| 30-C-1 | Reecrire autonomous-dev.agent.block.json | 1h |
| 30-C-2 | Test simple : "Create a README.md" | 1h |
| 30-C-3 | Test modere : "Fix TypeScript errors" | 1h |
| 30-C-4 | Test complexe : "Create a file-tree module" | 2h |
| 30-C-5 | Iterer le composite (minimum 3 iterations) | 3-6h |

**Ordre** : Strictement sequentiel. 30-C-1 → 30-C-2 → 30-C-3 → 30-C-4 → 30-C-5.

---

## Principe

- **Tous les tests via `session invoke`** (pas `run`) — on veut le monitoring
- **Le moniteur DOIT tourner** avant chaque invoke
- **Si un test echoue** : analyser le probleme, ajuster les prompts des sous-blocs, retester
- **Minimum 3 iterations** sur chaque test avant de declarer stable

## Strategie de protection du repo Cantante (OBLIGATOIRE)

Les tests 30-C modifient des fichiers et creent des commits dans un vrai repo. Sans protection, le repo sera dans un etat indetermine apres quelques iterations.

### Protocole avant CHAQUE test

```bash
# 1. Creer une branche de test isolee
cd C:\Cantante
git checkout -b maestro-test-<timestamp>

# 2. Executer le test (session invoke)
# ...

# 3. Apres le test — analyser les resultats
# Verifier les fichiers crees/modifies, les commits, etc.

# 4. Retourner sur la branche principale
git checkout main

# 5. Supprimer la branche de test (les commits sont conserves dans le reflog si besoin)
git branch -D maestro-test-<timestamp>
```

### Alternative : copie du repo

Pour eviter de polluer l'historique Git de Cantante :

```bash
# Copier le repo dans un sandbox
xcopy C:\Cantante C:\temp\cantante-test-<timestamp> /E /I /H
cd C:\temp\cantante-test-<timestamp>

# Utiliser le sandbox comme repoPath dans session invoke
node index.js session invoke <id> dev --input repoPath="C:\temp\cantante-test-<timestamp>" ...

# Apres le test, supprimer le sandbox
rmdir /S /Q C:\temp\cantante-test-<timestamp>
```

**Recommandation** : Utiliser la branche Git pour les premiers tests (plus rapide). Si les tests creent trop de pollution, basculer sur la copie.
