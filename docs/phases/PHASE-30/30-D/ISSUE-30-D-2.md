# Issue 30-D-2 : Foundry pour chaque sous-bloc

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 30-D-1 (workspace cree), 30-C-5 (composite stable)

---

## Description

Creer une session foundry pour chaque sous-bloc du composite. Mesurer le fitness sur des scenarios predetermines. Seuil : fitness >= 0.85 par bloc.

---

## Tache detaillee

Pour chaque bloc (project-preparer, task-planner, implement-single-step, test-executor, code-reviewer, git-committer) :

### 1. Creer la session foundry

```bash
node index.js session create --type foundry --name "Foundry <bloc-name>" --start
node index.js workspace add-session <ws-id> <session-id>
```

### 2. Lancer le moniteur

```bash
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"
```

### 3. Mesurer le fitness

| Bloc | Scenarios de test | Fitness = |
|------|------------------|-----------|
| project-preparer | Cantante, un projet Python, un projet vide | Detection stack correcte, docs pertinents |
| task-planner | README, fix errors, new component | Plan structure, dependances correctes, JSON parsable |
| implement-single-step | Creer un fichier, modifier un fichier, ajouter une dep | Fichier correct, type check passe |
| test-executor | Projet avec tests, projet sans tests | Detection correcte, parsing correct |
| code-reviewer | Bon code, code mediocre | Score coherent, issues pertinentes |
| git-committer | Changements existants, pas de changements | Commit propre ou pas de commit |

### 4. Documenter les resultats

Pour chaque bloc, noter dans le workspace :
- Fitness mesure sur chaque scenario
- Fitness moyen
- Problemes identifies
- Ajustements effectues

---

## Criteres de fitness par bloc

| Bloc | Critere principal | Seuil |
|------|------------------|-------|
| project-preparer | Stack correctement detecte + docs pertinents | >= 0.85 |
| task-planner | Plan ordonne + JSON parsable + dependances correctes | >= 0.85 |
| implement-single-step | Code compile + type check passe + contenu correct | >= 0.85 |
| test-executor | Framework detecte + resultats parses + details echecs | >= 0.85 |
| code-reviewer | Score coherent + issues actionnables | >= 0.85 |
| git-committer | Stage selectif + message conventionnel | >= 0.85 |

---

## Critere de completion

- [ ] 6 sessions foundry creees et ajoutees au workspace
- [ ] Chaque bloc teste sur au moins 3 scenarios
- [ ] Fitness >= 0.85 pour chaque bloc
- [ ] Resultats documentes dans le workspace
- [ ] Si un bloc est < 0.85 : ajuster le prompt et re-mesurer (max 3 iterations)
