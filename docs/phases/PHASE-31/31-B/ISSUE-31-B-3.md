# Issue 31-B-3 : Documentation utilisateur

**Statut** : A faire
**Estimation** : 1 heure
**Prerequis** : 31-B-2 (corrections appliquees)

---

## Description

Ecrire la documentation utilisateur pour `maestro code`.

---

## Tache

Creer `docs/guides/users/maestro-code.md` avec :

### 1. Getting Started

- Installation prerequis
- Premier lancement (`maestro code`)
- Ce qui se passe automatiquement (detection, docs, prepare)

### 2. Donner une tache

- Exemples de taches : feature, bug fix, refactoring, tests, docs
- Bonnes pratiques pour formuler une tache
- Exemples de taches trop vagues vs bien formulees

### 3. Pendant l'execution

- Comprendre les widgets (PlanView, ExecutionTree, FileChanges)
- Commandes disponibles (status, pause, resume, abort)
- Envoyer des messages a l'agent

### 4. Apres l'execution

- Verifier les changements
- Le commit a ete fait automatiquement
- Continuer avec une autre tache ou quitter

### 5. Sessions

- Reprendre une session (`--session <id>`)
- Voir l'historique des sessions
- Supprimer une session

### 6. Troubleshooting

- L'agent ne comprend pas la tache → reformuler
- Le plan est incorrect → utiliser `pause` et reformuler
- Les tools ne fonctionnent pas → verifier les services (`maestro health`)

---

## Critere de completion

- [ ] Le guide couvre les 6 sections
- [ ] Les exemples sont concrets et testes
- [ ] Le guide est dans `docs/guides/users/`
- [ ] Le guide est reference dans `docs/system/README.md`
