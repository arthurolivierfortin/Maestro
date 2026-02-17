# Issue 30-B-3 : Mettre a jour implement-single-step (Sonnet)

**Statut** : A faire
**Estimation** : 1-2 heures
**Bloquant** : Non
**Prerequis** : Aucun pour les tests standalone (via `run`). 30-A-2 est requis pour les tests via `session invoke` (Phase 30-C).

---

## Description

Le bloc `implement-single-step` est le codeur du pipeline. Il recoit UNE step du plan et l'execute : creer un fichier, modifier un fichier existant, ou executer une commande. Son contexte est VOLONTAIREMENT restreint — il ne connait que sa step et les fichiers pertinents.

C'est le bloc le plus avance existant. Modifications mineures.

---

## Tache detaillee

### 1. Verifier le .block.json

Fichier : `content/system/blocks/agents/implement-single-step/*.block.json`

Verifications :
- `"model": "claude-sonnet"` (confirmer)
- Inputs : `step` (object — la step du plan), `context` (string — extrait du prepare), `workingDir` (string — chemin du repo), `conventions` (string — conventions du projet)
- Outputs : `result` (object — details de l'implementation)

### 2. Renforcer le system-prompt.md

Ajouter/renforcer les instructions suivantes :

**"Read before write" obligatoire** :
> "If the file already exists, you MUST read it FIRST before making any changes. Never write blind."

**Verification apres ecriture** :
> "After writing any TypeScript file, run `npx tsc --noEmit` to type-check. If it fails, fix the issue before calling done. Max 3 attempts."

**Input conventions** :
> Ajouter un input `conventions` pour que le codeur respecte les conventions du projet (naming, patterns, imports).

**Regles supplementaires** :
- Jamais d'imports inventes — verifier que le module existe
- Pas de TODO, pas de placeholder — le code doit etre complet
- Suivre les patterns existants du projet (detectes dans `context_files`)
- Max 15 iterations agent — si ca ne compile pas apres 15 tentatives, reporter l'erreur

### 3. Format de sortie

```json
{
  "stepId": 5,
  "action": "create",
  "target": "src/components/UserList.tsx",
  "linesWritten": 45,
  "verified": true,
  "verificationMethod": "tsc --noEmit",
  "notes": "Created component following existing Card pattern"
}
```

---

## Contexte d'execution des tests

> **IMPORTANT** : Tous les tests de 30-B utilisent `node index.js run` (execution directe, HORS session).
> Ce chemin fonctionne DEJA — il ne depend PAS du fix 30-A-2.
> Les tests en contexte session (`session invoke`) seront faits en 30-C et 30-E, APRES le fix 30-A-2.
>
> Si `run` ne fonctionne pas non plus, c'est un probleme different de 30-A-2 (qui est specifique au chemin session).

## Instructions de test

### Test 1 : Creer un nouveau fichier

```bash
cd maestro-cli

# Creer un dossier sandbox (PAS Cantante — on isole les tests)
mkdir -p /tmp/impl-test
echo '{"name":"test","version":"1.0.0"}' > /tmp/impl-test/package.json

node index.js run implement-single-step \
  --input step='{"id":1,"action":"create","target":"src/hello.ts","description":"Create a hello world module that exports a greet function","acceptance":"File exports greet(name: string): string"}' \
  --input workingDir="/tmp/impl-test" \
  --input conventions="camelCase for functions, PascalCase for types"
```

**Verifications** :
- [ ] Le fichier `/tmp/impl-test/src/hello.ts` est cree
- [ ] Le contenu exporte une fonction `greet`
- [ ] Le code est TypeScript valide
- [ ] La sortie JSON contient `verified: true`

### Test 2 : Modifier un fichier existant

```bash
# Creer un fichier existant
mkdir -p /tmp/impl-test/src
echo 'export function greet(name: string): string { return "Hello"; }' > /tmp/impl-test/src/hello.ts

node index.js run implement-single-step \
  --input step='{"id":2,"action":"modify","target":"src/hello.ts","description":"Add a farewell function that says goodbye","acceptance":"File exports farewell(name: string): string"}' \
  --input workingDir="/tmp/impl-test" \
  --input conventions="camelCase for functions"
```

**Verifications** :
- [ ] Le fichier est modifie (pas ecrase completement)
- [ ] La fonction `greet` est toujours la
- [ ] La fonction `farewell` est ajoutee
- [ ] L'agent a LU le fichier avant de le modifier

### Test 3 : Contexte files (lit les fichiers de reference)

```bash
# Creer un fichier de reference
echo 'export interface User { id: string; name: string; }' > /tmp/impl-test/src/types.ts

node index.js run implement-single-step \
  --input step='{"id":3,"action":"create","target":"src/userService.ts","description":"Create user service with getUser function","context_files":["src/types.ts"],"acceptance":"Imports User type, exports getUser(id: string): User"}' \
  --input workingDir="/tmp/impl-test" \
  --input conventions="camelCase"
```

**Verifications** :
- [ ] Le fichier importe `User` depuis `./types`
- [ ] L'import est correct (pas un import invente)
- [ ] Le service utilise le type `User`

---

## Critere de completion

- [ ] Le modele est `claude-sonnet` dans le .block.json
- [ ] Le system-prompt.md contient "read before write" et "verify after write"
- [ ] Test "creer un fichier" : fichier cree avec le contenu attendu
- [ ] Test "modifier un fichier" : le fichier existant est respecte, la modification est ajoutee
- [ ] Test "context_files" : l'agent lit les fichiers de contexte et les utilise correctement
- [ ] La sortie JSON contient les champs requis (stepId, action, target, verified)
- [ ] Le code produit est TypeScript valide (si applicable)
- [ ] 3 executions donnent du code de qualite similaire

---

## Risques

- **Risque** : L'agent ecrase tout le fichier au lieu de modifier
- **Mitigation** : Le prompt doit insister sur "read first, then modify"
- **Risque** : Le type check echoue et l'agent boucle
- **Mitigation** : Max 3 tentatives de fix, puis reporter l'erreur
- **Risque** : Sonnet invente des imports qui n'existent pas
- **Mitigation** : Les `context_files` dans le plan listent les fichiers existants que l'agent doit utiliser
