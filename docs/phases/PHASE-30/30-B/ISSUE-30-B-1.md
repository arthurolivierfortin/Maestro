# Issue 30-B-1 : Mettre a jour project-preparer (Opus)

**Statut** : A faire
**Estimation** : 1-2 heures
**Bloquant** : Non (mais premier dans le pipeline)
**Prerequis** : 30-A-2 (tools fonctionnels en session)

---

## Description

Le bloc `project-preparer` est le premier agent du pipeline `autonomous-dev`. Il analyse un repository, detecte le stack technique, comprend l'architecture, et cree les documents `.maestro/docs/` manquants.

Le system-prompt.md existe deja avec un bon contenu. Modifications necessaires : modele, instructions de creation de docs, et format de sortie JSON.

---

## Tache detaillee

### 1. Mettre a jour le .block.json

Fichier : `content/system/blocks/agents/project-preparer/*.block.json`

Modifications :
- `"model": "claude-opus"` (etait `claude-sonnet`)
- Verifier que les inputs incluent `repoPath` (requis)
- Verifier que les outputs incluent `summary` (objet JSON)

### 2. Mettre a jour le system-prompt.md

Fichier : `content/system/blocks/agents/project-preparer/system-prompt.md`

Ajouter les instructions suivantes :

**Detection du stack** :
- Lire `package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `.csproj`, etc.
- Identifier : langage, framework, runtime, package manager, build tool, test framework

**Comprehension de l'architecture** :
- Lister la structure a 2 niveaux de profondeur
- Identifier le pattern : clean architecture, MVC, feature-based, domain-driven, flat

**Creation des documents manquants dans `.maestro/docs/`** :
- `PROJECT.md` — nom, description, stack detecte
- `CONVENTIONS.md` — naming, patterns, style d'import
- `ARCHITECTURE.md` — modules, couches, dependances
- `STACK.md` — langage, framework, versions, outils

**Regles** :
- Ne JAMAIS ecraser un document existant
- Les documents sont DEDUITS du code, pas inventes
- Si une information n'est pas determinable, noter "a confirmer par l'utilisateur"

**Format de sortie JSON** :
```json
{
  "project": { "name": "...", "description": "...", "type": "..." },
  "stack": { "language": "...", "framework": "...", "runtime": "...", ... },
  "architecture": { "pattern": "...", "layers": [...], "entryPoints": [...] },
  "conventions": { "naming": "...", "imports": "...", "patterns": [...] },
  "docsCreated": ["..."],
  "gaps": ["..."],
  "questions": ["..."]
}
```

### 3. Tester

Executer 3 fois sur Cantante et verifier la coherence.

---

## Instructions de test

### Test 1 : Detection du stack

```bash
cd maestro-cli
node index.js run project-preparer --input repoPath="C:\Cantante"
```

**Verifications** :
- [ ] Le JSON de sortie est valide
- [ ] `stack.language` = "TypeScript" (ou ce que Cantante utilise)
- [ ] `stack.framework` est detecte correctement
- [ ] `stack.testFramework` est detecte (s'il existe)

### Test 2 : Creation des docs .maestro/

```bash
# Verifier AVANT si les docs existent deja
ls C:\Cantante\.maestro\docs\

# Executer
node index.js run project-preparer --input repoPath="C:\Cantante"

# Verifier APRES
ls C:\Cantante\.maestro\docs\
cat C:\Cantante\.maestro\docs\PROJECT.md
cat C:\Cantante\.maestro\docs\CONVENTIONS.md
```

**Verifications** :
- [ ] Les fichiers ont ete crees (s'ils n'existaient pas avant)
- [ ] Le contenu est pertinent et specifique a Cantante (pas generique)
- [ ] Aucun fichier existant n'a ete ecrase

### Test 3 : Questions et gaps

**Verifications** :
- [ ] Le champ `questions` contient des questions pertinentes (pas des questions generiques)
- [ ] Le champ `gaps` identifie les vrais manques (pas de tests ? pas de CI ?)

### Test 4 : Coherence entre 3 executions

Executer 3 fois et comparer les resultats. Ils doivent etre coherents (memes detections de stack, memes conventions).

---

## Critere de completion

- [ ] Le modele est `claude-opus` dans le .block.json
- [ ] Le system-prompt.md contient les instructions de creation de docs
- [ ] `node index.js run project-preparer --input repoPath="C:\Cantante"` :
  - [ ] Detecte correctement le stack technique
  - [ ] Cree les fichiers `.maestro/docs/` manquants
  - [ ] Le contenu des docs est pertinent et specifique au projet
  - [ ] La sortie JSON contient les champs requis (project, stack, architecture, conventions, docsCreated, gaps, questions)
  - [ ] Les questions sont pertinentes
- [ ] 3 executions successives donnent des resultats coherents
- [ ] Le temps d'execution est < 2 minutes

---

## Risques

- **Risque** : Opus est trop lent ou trop cher pour ce bloc
- **Mitigation** : Si Opus prend > 3min, tester avec Sonnet. Le prepare a besoin de comprehension mais pas de raisonnement complexe.
- **Risque** : L'agent cree des docs dans le mauvais repertoire
- **Mitigation** : Verifier que `file-write` utilise le bon chemin relatif au `repoPath`
