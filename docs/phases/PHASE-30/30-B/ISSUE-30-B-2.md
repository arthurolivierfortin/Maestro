# Issue 30-B-2 : Mettre a jour task-planner (Opus)

**Statut** : A faire
**Estimation** : 1-2 heures
**Bloquant** : Non (mais deuxieme dans le pipeline)
**Prerequis** : 30-A-2 (tools fonctionnels)

---

## Description

Le bloc `task-planner` est le cerveau strategique du pipeline. Il decompose une tache en sous-taches atomiques, ordonnees par dependance, separees par domaine, avec les fichiers de contexte necessaires pour chaque step.

La qualite du plan determine la qualite de TOUT le reste. Un plan mediocre = code mediocre.

---

## Tache detaillee

### 1. Mettre a jour le .block.json

Fichier : `content/system/blocks/agents/task-planner/*.block.json`

Modifications :
- `"model": "claude-opus"` (explicite)
- Inputs : `task` (string, required), `context` (string — sortie du prepare), `repoPath` (string)
- Outputs : `plan` (array — JSON array de steps)

### 2. Mettre a jour le system-prompt.md

Renforcer les instructions :

**Separation par domaine** :
- `types` — interfaces, types partages
- `backend` — services, controllers, routes
- `frontend` — composants, hooks, pages
- `api` — clients HTTP, endpoints
- `test` — tests unitaires et integration
- `config` — configuration, variables d'environnement
- `docs` — documentation

**Ordre par dependance** :
- Types/Interfaces TOUJOURS en premier
- Services avant controllers
- Clients API avant hooks
- Hooks avant composants
- Implementations avant tests

**Chaque step contient** :
```json
{
  "id": 1,
  "domain": "types",
  "action": "create|modify|delete|add-dependency|run-command",
  "target": "src/types/User.ts",
  "description": "Define User interface and API types",
  "dependencies": [],
  "context_files": ["src/types/index.ts"],
  "acceptance": "File exports User, GetUsersResponse types"
}
```

**Format de sortie** : JSON array PUR (pas d'objet wrapper, pas de texte autour)

**Regles** :
- Maximum 25 steps par plan
- Chaque step est atomique (un fichier, une action)
- Chaque step a un `acceptance` clair
- Chaque step a `context_files` (les fichiers que l'implementeur doit lire)

---

## Instructions de test

### Test 1 : Tache simple (documentation)

```bash
cd maestro-cli
node index.js run task-planner --input task="Create a README.md file for the project" --input context='{"stack":{"language":"TypeScript","framework":"React"},"architecture":{"pattern":"feature-based"}}' --input repoPath="C:\Cantante"
```

**Verifications** :
- [ ] Le plan contient 1-3 steps
- [ ] Le format est un JSON array pur (commence par `[`, finit par `]`)
- [ ] Chaque step a les champs requis (id, domain, action, target, description, dependencies, acceptance)

### Test 2 : Tache moderee (bug fix)

```bash
node index.js run task-planner --input task="Fix the TypeScript compilation errors in the project" --input context='{"stack":{"language":"TypeScript"},"gaps":["15 type errors in tsc output"]}' --input repoPath="C:\Cantante"
```

**Verifications** :
- [ ] Le plan identifie les fichiers avec erreurs
- [ ] L'ordre corrige les dependances d'abord (types avant implementations)
- [ ] Les `context_files` incluent les fichiers concernes

### Test 3 : Tache complexe (nouvelle feature)

```bash
node index.js run task-planner --input task="Create a file-tree component that lists all project files in a tree view" --input context='{"stack":{"language":"TypeScript","framework":"React","testFramework":"vitest"},"conventions":{"naming":"camelCase files, PascalCase components"}}' --input repoPath="C:\Cantante"
```

**Verifications** :
- [ ] Le plan decompose en types → service → composant → tests
- [ ] Les dependances sont logiques (types avant composants)
- [ ] Les domaines sont separes (types, frontend, test)
- [ ] Le nombre de steps est raisonnable (5-15)
- [ ] Les `acceptance` sont specifiques (pas "file is correct")

### Test 4 : Le JSON est parsable par for-each

```bash
# Capturer la sortie et la parser
node index.js run task-planner --input task="Create a README.md" --input context="{}" | python -m json.tool
# Doit etre un JSON valide
```

---

## Critere de completion

- [ ] Le modele est `claude-opus` dans le .block.json
- [ ] Le system-prompt.md contient les instructions detaillees de planification
- [ ] Test tache simple : plan coherent, 1-3 steps
- [ ] Test tache moderee : plan ordonne par dependances
- [ ] Test tache complexe : plan decompose par domaine, 5-15 steps
- [ ] La sortie est un JSON array pur parsable par `JSON.parse()`
- [ ] Chaque step a tous les champs requis (id, domain, action, target, description, dependencies, context_files, acceptance)
- [ ] 3 executions de la meme tache donnent des plans structurellement similaires

---

## Risques

- **Risque** : Le LLM ajoute du texte autour du JSON ("Here's the plan: [...]")
- **Mitigation** : Insister dans le prompt : "Output ONLY the JSON array. No text before or after."
- **Risque** : Le plan est trop detaille (>25 steps) pour une tache simple
- **Mitigation** : Ajouter dans le prompt : "For simple tasks, 1-5 steps. For complex tasks, 10-25 steps max."
- **Risque** : Les `context_files` referencent des fichiers qui n'existent pas
- **Mitigation** : Le planner doit lire le repo (via file-read) pour verifier les fichiers existants
