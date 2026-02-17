# Issue 30-C-3 : Tester le composite sur une tache moderee

**Statut** : A faire
**Estimation** : 1 heure
**Bloquant** : Non
**Prerequis** : 30-C-2 reussi (le test simple passe)

---

## Description

Deuxieme test du composite : "Fix the TypeScript errors in this project". Ce test valide que le pipeline gere des taches qui modifient du code existant (pas seulement de la creation).

---

## Tache

```bash
node index.js session invoke <session-id> dev \
  --input task="Fix the TypeScript compilation errors in this project" \
  --input repoPath="C:\Cantante"
```

---

## Verification par noeud

| Noeud | Attendu |
|-------|---------|
| prepare | Detecte TypeScript, identifie les erreurs via `tsc --noEmit` |
| plan | Identifie les fichiers avec erreurs, ordonne les corrections par dependance |
| for-each | Corrige chaque fichier un par un |
| test | `tsc --noEmit` passe (0 erreurs) |
| review | Valide les corrections, verifie qu'aucun comportement n'est change |
| commit | `fix(types): resolve TypeScript compilation errors` |

---

## Critere de completion

- [ ] Le plan identifie les fichiers concernes et les ordonne par dependance
- [ ] Chaque step corrige UN fichier
- [ ] Apres for-each, `tsc --noEmit` passe
- [ ] Le review valide que les corrections sont minimales (pas de refactoring inutile)
- [ ] Le commit est propre avec un message `fix(...)`
- [ ] Le moniteur TUI montre la progression
- [ ] Temps total < 10 minutes

---

## En cas d'echec

- Si le planner ne detecte pas les erreurs : ajouter `tsc --noEmit` dans la phase prepare
- Si l'implementeur ne corrige pas correctement : verifier les `context_files` dans le plan
- Si le type check echoue apres les corrections : le review doit avoir un score < 0.8 et la boucle fix doit se declencher
