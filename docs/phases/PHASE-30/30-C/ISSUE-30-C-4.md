# Issue 30-C-4 : Tester le composite sur une tache complexe

**Statut** : A faire
**Estimation** : 2 heures
**Bloquant** : Non
**Prerequis** : 30-C-3 reussi (le test modere passe)

---

## Description

Troisieme test du composite : "Create a file-tree component that lists all project files in a tree view". Ce test valide que le pipeline gere une tache multi-fichiers, multi-domaines (types, composant, tests).

---

## Tache

```bash
node index.js session invoke <session-id> dev \
  --input task="Create a file-tree component that lists all project files in a tree view" \
  --input repoPath="C:\Cantante"
```

---

## Verification par noeud

| Noeud | Attendu |
|-------|---------|
| prepare | Comprend l'architecture React/TypeScript de Cantante |
| plan | Decompose en : types → service/hook → composant → tests (5-10 steps) |
| for-each | Cree chaque piece separement, respecte les dependances |
| test | Les tests passent (si des tests sont crees dans le plan) |
| review | Verifie qualite, conventions, completude |
| commit | `feat(file-tree): add file tree component` |

---

## Verification detaillee du plan

Le plan doit ressembler a :

```
1. [types]    - Creer les interfaces (FileNode, TreeProps)
2. [frontend] - Creer le hook useFileTree (lecture de la structure)
3. [frontend] - Creer le composant FileTree
4. [frontend] - Creer le composant FileTreeNode (recursif)
5. [frontend] - Integrer dans le layout/navigation (si applicable)
6. [test]     - Tests pour le composant FileTree
7. [test]     - Tests pour le hook useFileTree
```

- [ ] Les types sont en premier
- [ ] Les dependances sont correctes (hook avant composant)
- [ ] Les tests sont en dernier
- [ ] Le nombre de steps est raisonnable (5-12)

---

## Critere de completion

- [ ] Le plan decompose la tache en types → composants → tests
- [ ] Chaque fichier est cree individuellement
- [ ] Le code compile (`tsc --noEmit` passe)
- [ ] Les tests passent (si crees)
- [ ] Le review donne un score >= 0.8
- [ ] Le commit est propre avec un message `feat(...)`
- [ ] Le composant est fonctionnel (les fichiers existent avec du contenu coherent)
- [ ] Temps total < 15 minutes

---

## En cas d'echec

- Si le plan est trop vague : renforcer le prompt du planner (separation par domaine)
- Si les fichiers ne compilent pas : verifier que les `context_files` sont corrects
- Si le composant est incoherent : verifier que les conventions du projet sont passees
- **3 iterations minimum** avant de declarer echec
