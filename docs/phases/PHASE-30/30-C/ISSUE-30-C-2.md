# Issue 30-C-2 : Tester le composite sur une tache simple

**Statut** : FAIT (test simple réussi avec v2.0.0, à re-tester avec v3.0.0)
**Estimation** : 1 heure
**Bloquant** : Non
**Prerequis** : 30-C-1 (composite assemble), 30-A-4 (template session)

---

## Description

Premier test du workflow composite `autonomous-dev` sur une tache simple : "Create a README.md file for this project". Ce test valide que le pipeline end-to-end fonctionne.

---

## Tache detaillee

### 0. Isoler le repo (OBLIGATOIRE — voir 30-C README)

```bash
# Creer une branche de test isolee AVANT tout
cd C:\Cantante
git checkout -b maestro-test-30c2-readme
```

### 1. Creer la session

```bash
cd maestro-cli

# Creer la session avec le template
node index.js session create --type project --name "Cantante - README creation" --template project-autonomous --repo "C:\Cantante" --start

# Ajouter au workspace Phase 30 (si cree en 30-D-1, sinon ignorer)
# node index.js workspace add-session <ws-id> <session-id>
```

### 2. Lancer le moniteur

```bash
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"
```

### 3. Invoquer

```bash
node index.js session invoke <session-id> dev --input task="Create a README.md for the project" --input repoPath="C:\Cantante"
```

### 4. Observer et verifier

Chaque noeud doit s'executer et apparaitre dans le moniteur.

---

## Instructions de test

### Verification par noeud

| Noeud | Ce qu'il doit faire | Comment verifier |
|-------|---------------------|-----------------|
| prepare | Detecter le stack Cantante, creer les docs .maestro/ | Verifier les fichiers crees |
| plan | Produire un plan avec 1-3 steps (creer README, verifier contenu) | Verifier `_nodeResult_plan` |
| for-each | Executer chaque step individuellement | Verifier `_executionTree` |
| test | Verifier que le fichier README existe | Verifier `_nodeResult_test` |
| review | Score >= 0.8 | Verifier `_nodeResult_review` |
| commit | Commit propre avec message "docs: add README.md" | `git log -1` dans Cantante |

### Verification globale

```bash
# Verifier que le README a ete cree
cat C:\Cantante\README.md

# Verifier le commit
cd C:\Cantante && git log --oneline -1
# Attendu : "docs: add README.md" ou similaire

# Verifier le moniteur
# L'arbre d'execution doit montrer tous les noeuds avec status "completed"
```

---

## Critere de completion

- [ ] prepare : detecte le stack, cree les docs manquants
- [ ] plan : produit un plan avec 1-3 steps
- [ ] for-each : execute chaque step individuellement
- [ ] test : verifie que le fichier existe
- [ ] review : score >= 0.8
- [ ] commit : commit propre avec message descriptif
- [ ] Le moniteur TUI affiche l'arbre d'execution complet avec tous les noeuds
- [ ] Le README.md est present dans Cantante avec un contenu pertinent
- [ ] Temps total < 5 minutes

---

## En cas d'echec

- **prepare echoue** : Verifier les logs, ajuster le prompt (30-B-1)
- **plan echoue** : Verifier le format de sortie, ajuster le prompt (30-B-2)
- **for-each echoue** : Verifier le parsing JSON (30-A-3)
- **implement-step echoue** : Verifier les tools (30-A-2)
- **test echoue** : Verifier la detection du framework (30-B-4)
- **review echoue** : Verifier le format de sortie (30-B-5)
- **commit echoue** : Verifier les commandes git (30-B-6)

**Regle** : Ne pas modifier le composite (30-C-1) pour contourner un probleme. Corriger le sous-bloc concerne.

### 5. Nettoyer apres le test

```bash
cd C:\Cantante
git checkout main
git branch -D maestro-test-30c2-readme
```
