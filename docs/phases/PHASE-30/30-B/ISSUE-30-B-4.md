# Issue 30-B-4 : Mettre a jour test-executor (Sonnet)

**Statut** : A faire
**Estimation** : 1 heure
**Bloquant** : Non
**Prerequis** : 30-A-2 (tools fonctionnels)

---

## Description

Le bloc `test-executor` execute la suite de tests d'un projet et produit un rapport structure. Il detecte le framework de test, installe les dependances si necessaire, execute les tests, et parse les resultats.

---

## Tache detaillee

### 1. Verifier le .block.json

- `"model": "claude-sonnet"` (confirmer)
- Inputs : `repoPath` (string, required), `stack` (string — extrait du prepare)
- Outputs : `testResults` (object — rapport structure)

### 2. Mettre a jour le system-prompt.md

**Detection du framework** :
- Lire `package.json` → scripts.test, devDependencies
- Si vitest → `npx vitest run`
- Si jest → `npx jest --ci`
- Si mocha → `npx mocha`
- Si pytest → `python -m pytest`
- Si aucun → reporter "No test framework detected"

**Installation des deps** :
- Si `node_modules/` n'existe pas → `npm install` (ou `yarn install` / `pnpm install`)
- Timeout installation : 60 secondes

**Parsing des resultats** :
- Nombre de tests passes/echoues/ignores
- Pour chaque echec : fichier, nom du test, message d'erreur
- Temps d'execution

**Checks supplementaires** :
- Type check (`npx tsc --noEmit`) si TypeScript detecte
- Linter si configure (eslint, etc.)

**Format de sortie** :
```json
{
  "framework": "vitest",
  "command": "npx vitest run",
  "passed": 24,
  "failed": 2,
  "skipped": 1,
  "duration": "3.2s",
  "failures": [
    { "file": "...", "test": "...", "error": "...", "line": 15 }
  ],
  "typeCheck": { "passed": true, "errors": [] },
  "linter": { "passed": false, "warnings": 3, "errors": 0 }
}
```

---

## Instructions de test

### Test 1 : Projet avec tests

```bash
cd maestro-cli
node index.js run test-executor --input repoPath="C:\Cantante"
```

**Verifications** :
- [ ] Le framework de test est detecte
- [ ] Les tests sont executes
- [ ] Le nombre de tests passes/echoues est correct
- [ ] Les details des echecs sont presents (fichier, test, erreur)

### Test 2 : Projet sans tests

```bash
mkdir -p /tmp/no-tests-project
echo '{"name":"empty","version":"1.0.0"}' > /tmp/no-tests-project/package.json

node index.js run test-executor --input repoPath="/tmp/no-tests-project"
```

**Verifications** :
- [ ] Le rapport indique "No test framework detected"
- [ ] Pas de crash, pas de boucle

### Test 3 : Type check

```bash
node index.js run test-executor --input repoPath="C:\Cantante" --input stack='{"language":"TypeScript"}'
```

**Verifications** :
- [ ] Le type check est execute (`tsc --noEmit`)
- [ ] Les erreurs de type sont reportees (s'il y en a)

---

## Critere de completion

- [ ] Le modele est `claude-sonnet` dans le .block.json
- [ ] Detection du framework de test : vitest, jest, mocha, pytest geres
- [ ] `npm install` execute si `node_modules/` manquant
- [ ] Resultats parses : passed, failed, skipped, failures avec details
- [ ] Projet sans tests : rapport propre, pas de crash
- [ ] Type check execute si TypeScript detecte
- [ ] La sortie est un JSON valide avec les champs requis
- [ ] Temps d'execution < 2 minutes (timeout gere)

---

## Risques

- **Risque** : `npm install` prend trop de temps (timeout)
- **Mitigation** : Timeout 60s pour install, 120s pour tests
- **Risque** : Le parsing des resultats de test echoue (format non attendu)
- **Mitigation** : Si le parsing echoue, retourner le stdout brut dans un champ `rawOutput`
