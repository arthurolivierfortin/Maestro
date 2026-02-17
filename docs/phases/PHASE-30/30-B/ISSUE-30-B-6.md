# Issue 30-B-6 : Mettre a jour git-committer (Sonnet)

**Statut** : A faire
**Estimation** : 30 minutes
**Bloquant** : Non
**Prerequis** : 30-A-2 (tools fonctionnels — git utilise shell-execute)

---

## Description

Le bloc `git-committer` cree un commit propre avec un message conventionnel. Il fait `git status`, `git diff`, stage selectif, et commit.

---

## Tache detaillee

### 1. Verifier le .block.json

- `"model": "claude-sonnet"` (confirmer)
- Inputs : `repoPath` (string, required), `task` (string — la tache originale), `review` (string — sortie du reviewer), `changes` (string — resume des changements)

### 2. Verifier le system-prompt.md

Le prompt doit insister sur :

**Stage selectif** :
> "NEVER use `git add .`. Always `git add <specific-file>` for each file related to the task."

**Message conventionnel** :
```
<type>(<scope>): <short description>

<detailed body>

Files changed:
- file1.ts (created)
- file2.ts (modified)
```

Types : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`

**Regles** :
- Ignorer les fichiers generes (dist/, node_modules/, .env)
- Message en anglais par defaut
- Si pas de changements → ne pas committer, retourner `{"committed": false, "reason": "No changes"}`

**Format de sortie** :
```json
{
  "committed": true,
  "hash": "abc1234",
  "message": "feat(users): add user list component",
  "filesStaged": ["src/components/UserList.tsx", "src/hooks/useUsers.ts"]
}
```

---

## Instructions de test

### Test 1 : Commit apres des modifications

```bash
# Preparer un repo sandbox
mkdir -p /tmp/git-test && cd /tmp/git-test
git init
echo '# Test' > README.md
git add README.md && git commit -m "initial"

# Creer des changements
echo 'export function hello() {}' > hello.ts
echo '# Updated README' > README.md

cd /mnt/c/Meastro/maestro-cli
node index.js run git-committer \
  --input repoPath="/tmp/git-test" \
  --input task="Create hello module and update README" \
  --input changes="Created hello.ts, updated README.md"
```

**Verifications** :
- [ ] `git status` dans /tmp/git-test montre "nothing to commit" (le commit a ete fait)
- [ ] `git log --oneline -1` montre un message conventionnel (feat/fix/...)
- [ ] Seuls hello.ts et README.md sont dans le commit (pas de fichiers parasites)
- [ ] La sortie JSON a `committed: true` et un hash

### Test 2 : Aucun changement a committer

```bash
# Pas de modifications dans le repo
node index.js run git-committer \
  --input repoPath="/tmp/git-test" \
  --input task="Nothing to do"
```

**Verifications** :
- [ ] Pas de commit cree
- [ ] La sortie a `committed: false`

### Test 3 : Git add selectif (pas de fichiers parasites)

```bash
# Ajouter un fichier qui ne devrait PAS etre committe
echo 'secret' > /tmp/git-test/.env
echo 'build' > /tmp/git-test/dist/output.js
echo 'export function world() {}' > /tmp/git-test/world.ts

node index.js run git-committer \
  --input repoPath="/tmp/git-test" \
  --input task="Create world module" \
  --input changes="Created world.ts"
```

**Verifications** :
- [ ] Seul `world.ts` est dans le commit
- [ ] `.env` n'est PAS dans le commit
- [ ] `dist/output.js` n'est PAS dans le commit

---

## Critere de completion

- [ ] Le modele est `claude-sonnet` dans le .block.json
- [ ] Commit cree avec message conventionnel
- [ ] Stage selectif : seuls les fichiers pertinents sont ajoutes
- [ ] Fichiers ignores : .env, dist/, node_modules/ ne sont jamais stages
- [ ] Aucun changement → `committed: false`, pas d'erreur
- [ ] La sortie JSON contient les champs requis (committed, hash, message, filesStaged)

---

## Risques

- **Risque** : L'agent fait `git add .` malgre les instructions
- **Mitigation** : Verifier le prompt. Si le probleme persiste, ajouter un garde-fou dans le system prompt : "If you use `git add .`, the task FAILS."
- **Risque** : Le working directory n'est pas correctement defini pour les commandes git
- **Mitigation** : Toutes les commandes git doivent utiliser `git -C <repoPath>` ou etre executees dans le bon repertoire
