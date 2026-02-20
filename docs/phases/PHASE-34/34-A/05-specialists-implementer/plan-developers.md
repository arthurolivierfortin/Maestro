# Plan E1 — Specialists IMPLEMENTER (Developers) : backend-developer, frontend-developer, styling-developer

**Objectif** : Creer les 3 blocs specialistes developpeurs de la phase IMPLEMENTER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/05-specialists-implementer/spec.md`.
**Impact** : Creation de fichiers JSON + Markdown dans `content/system/blocks/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-developers.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient les system prompts complets et les details de conception. Tu DOIS le lire pour copier les prompts.
3. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 3 documents.**

---

## Contexte — Format attendu des blocs

### Format reel du codebase (PAS le format du spec)

Le spec v4 utilise des noms de champs qui different du codebase reel. **Le codebase fait foi.**

#### Agent block format (reference : `project-preparer.agent.block.json`)

```
content/system/blocks/agents/<block-id>/
├── <block-id>.agent.block.json    ← Definition du bloc
└── system-prompt.md               ← System prompt externe
```

```json
{
  "id": "<block-id>",
  "name": "<Display Name>",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "...",
  "inputs": [
    { "id": "inputName", "type": "string", "required": true, "description": "..." }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "..." }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 8,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["..."],
    "tier": 1
  }
}
```

#### Inference block format (reference : `code-reviewer.inference.block.json`)

```
content/system/blocks/inference/<block-id>/
├── <block-id>.inference.block.json    ← Definition du bloc
```

```json
{
  "id": "<block-id>",
  "name": "<Display Name>",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "...",
  "inputs": [
    { "id": "inputName", "type": "string", "required": true, "description": "..." }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "..." }
  ],
  "config": {
    "systemPrompt": "Inline prompt text here...",
    "model": "claude-sonnet-4-6",
    "temperature": 0.3,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["..."],
    "tier": 1
  }
}
```

**Points critiques** :
- `inputs` est un tableau d'objets `{id, type, required, description}` — PAS un objet avec des champs
- Le spec utilise `inputs` avec des types `object` — dans le codebase, TOUS les inputs sont `"type": "string"` car les objets sont passes en JSON serialise
- Agent blocks : le `AgentBlockExecutor` charge `system-prompt.md` depuis le dossier du bloc (via `config.path` injecte par le discovery service)
- Inference blocks : `config.systemPrompt` est une string inline — PAS de `systemPromptFile`. Le `InferenceBlockExecutor` ne supporte PAS `systemPromptFile`
- `config.model` utilise les model IDs reels : `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- `metadata.designation` = `"autonomous"` pour les agents

### Corrections de format vs spec

| Champ spec | Format reel | Correction |
|-----------|-------------|------------|
| `inputs.step` type `object` | `"type": "string"` | Les objets sont passes comme JSON stringifie |
| `inputs.projectContext` type `object` | `"type": "string"` | Idem |
| `inputs.previousResults` type `object` | `"type": "string"` | Idem |
| `inputs.designContext` type `object` | `"type": "string"` | Idem |
| `inputs.implementationResult` type `object` | `"type": "string"` | Idem |

---

## Bloc 1 : backend-developer (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/backend-developer/backend-developer.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/backend-developer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "backend-developer",
  "name": "Backend Developer v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Specialized backend developer agent. Implements ONE step at a time, focusing on server-side code: APIs, services, data models, business logic, configuration, and type definitions. Follows project conventions exactly.",
  "inputs": [
    { "id": "step", "type": "string", "required": true, "description": "JSON object: the current plan step (id, action, target, description, dependencies, context_files, acceptance, verification)" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer (stack, conventions)" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" },
    { "id": "previousResults", "type": "string", "required": false, "description": "JSON results from previously completed steps" },
    { "id": "reviewFeedback", "type": "string", "required": false, "description": "Feedback from reviewer if this is a re-execution after review" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { stepId, action, target, success, filesModified, notes }" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 12,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["backend", "developer", "implementation", "api", "services", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 5.1 dans `system-prompt.md`. C'est le texte entre les balises triple-backtick du spec (tout le bloc markdown commencant par `# Backend Developer Agent v4`).

### Points d'attention

1. **`maxIterations: 12`** — le spec mentionne "Maximum 12 tool calls per step". Chaque iteration = 1 tool call dans la boucle agent, donc `maxIterations: 12` correspond exactement.
2. **`reviewFeedback` est optionnel** — le prompt gere ce cas ("If reviewFeedback is provided..."). Ne pas forcer `required: true`.
3. **`previousResults` est optionnel** — utilise pour le contexte des steps precedents.
4. **Le prompt utilise `--input-json`** pour file-write — c'est le format correct pour les contenus multilignes.
5. **Sonnet est suffisant** — l'implementation de code est du pattern matching (conventions + context), pas du raisonnement profond.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'backend-developer'"
# Resultat attendu : backend-developer  agent  4.0.0

# Execution directe (necessite un vrai repo cible)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run backend-developer --input step='{\"id\":1,\"action\":\"create\",\"target\":\"src/types/User.ts\",\"description\":\"Create User interface with id (string), name (string), email (string)\",\"dependencies\":[],\"context_files\":[],\"acceptance\":\"File exports User type\",\"verification\":\"file-exists\",\"domain\":\"types\",\"developer\":\"backend-developer\"}' --input projectContext='{\"stack\":{\"language\":\"TypeScript\",\"framework\":\"Express\"},\"conventions\":{\"indentation\":\"2 spaces\"}}' --input workingDir=C:\TestProject"
# Resultat attendu : JSON avec stepId, action, target, success=true, filesModified, notes
```

---

## Bloc 2 : frontend-developer (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/frontend-developer/frontend-developer.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/frontend-developer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "frontend-developer",
  "name": "Frontend Developer v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Specialized frontend developer agent. Implements ONE step at a time, focusing on UI components, state management, routing, hooks, and user interactions. Enforces accessibility and responsive design.",
  "inputs": [
    { "id": "step", "type": "string", "required": true, "description": "JSON object: the current plan step (id, action, target, description, dependencies, context_files, acceptance, verification)" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer (stack, conventions)" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" },
    { "id": "previousResults", "type": "string", "required": false, "description": "JSON results from previously completed steps" },
    { "id": "reviewFeedback", "type": "string", "required": false, "description": "Feedback from reviewer if this is a re-execution after review" },
    { "id": "designContext", "type": "string", "required": false, "description": "JSON from architecture.visualComponents (components, animations, needsDesignReview)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { stepId, action, target, success, filesModified, notes }" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 15,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["frontend", "developer", "implementation", "react", "components", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 5.2 dans `system-prompt.md`. Le texte commence par `# Frontend Developer Agent v4`.

**ATTENTION au prompt** : Le spec dit "Same as backend-developer" pour le Tool section. Il faut copier le meme bloc `maestro_cli` que dans le backend-developer :

```markdown
## Tool

You have ONE tool: `maestro_cli`. Output a JSON object as your ENTIRE response:

```json
{"tool":"maestro_cli","args":{"command":"run file-read --input path=/some/path"}}
```

### Available commands

- **Read file**: `{"tool":"maestro_cli","args":{"command":"run file-read --input path=<absolute-path>"}}`
- **Write file**: `{"tool":"maestro_cli","args":{"command":"run file-write --input-json {\"path\":\"<absolute-path>\",\"content\":\"<escaped content>\"}"}}`
- **List directory**: `{"tool":"maestro_cli","args":{"command":"run directory-list --input path=<absolute-path>"}}`
- **Run command**: `{"tool":"maestro_cli","args":{"command":"run shell-execute --input-json {\"command\":\"<cmd>\"}"}}`

**IMPORTANT**: For file-write, ALWAYS use `--input-json` format because content contains newlines and special characters.
```

Egalement ajouter le bloc Output (done format) et le bloc Rules du backend-developer, adapte au frontend :

```markdown
## Output Format

```json
{"tool":"done","args":{"summary":"{\"stepId\":1,\"action\":\"create\",\"target\":\"src/components/UserCard.tsx\",\"success\":true,\"filesModified\":[\"src/components/UserCard.tsx\"],\"notes\":\"Created UserCard component with props interface, loading state, error handling\"}"}}
```

## Rules

- NEVER import modules that do not exist. Verify by reading the directory first.
- NEVER leave incomplete implementations. Every function must be fully implemented.
- Write COMPLETE file content when creating. For modifications, write the complete updated file.
- Combine workingDir + step.target to get the absolute path.
- Maximum 15 tool calls per step. If you need more, the step description was too complex.
- If a step is truly impossible (missing dependency, incompatible framework), report success=false with notes explaining why.
```

### Points d'attention

1. **`maxIterations: 15`** — le spec dit "Maximum 15 tool calls per step" pour le frontend developer. Ceci est plus que le backend (12) car les composants UI necessitent souvent plus de lecture de contexte (theme, composants existants, patterns).
2. **`designContext` est optionnel** — le prompt gere ce cas ("If designContext is provided..."). Seuls les steps avec des composants visuels l'utilisent.
3. **Accessibilite obligatoire** — le prompt insiste : "Accessibility is NOT optional". C'est un critere de qualite, pas une option.
4. **Le prompt du spec est incomplet** pour le Tool section — il dit "Same as backend-developer" sans le copier. L'agent qui cree le fichier DOIT inclure le bloc complet dans le system-prompt.md.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'frontend-developer'"
# Resultat attendu : frontend-developer  agent  4.0.0
```

---

## Bloc 3 : styling-developer (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/styling-developer/styling-developer.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/styling-developer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "styling-developer",
  "name": "Styling Developer v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Specialized styling and animation developer. Handles CSS, Tailwind, animations (CSS transitions, Framer Motion, GSAP), responsive design, and visual polish. Modifies existing components without removing functionality.",
  "inputs": [
    { "id": "step", "type": "string", "required": true, "description": "JSON object: the current plan step (id, action, target, description)" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer (stack, conventions, CSS framework)" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" },
    { "id": "designContext", "type": "string", "required": false, "description": "JSON from architecture.visualComponents (animations, components, theme)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { stepId, action, target, success, filesModified, notes }" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 10,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["styling", "css", "animation", "tailwind", "responsive", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 5.3 dans `system-prompt.md`. Le texte commence par `# Styling Developer Agent v4`.

**ATTENTION au prompt** : Le spec dit "Same as backend-developer" pour le Tool section. Il faut inclure le bloc complet (voir Bloc 2 ci-dessus). Egalement ajouter :

```markdown
## Output Format

```json
{"tool":"done","args":{"summary":"{\"stepId\":5,\"action\":\"modify\",\"target\":\"src/components/UserCard.tsx\",\"success\":true,\"filesModified\":[\"src/components/UserCard.tsx\"],\"notes\":\"Added Tailwind classes, hover animation, responsive breakpoints, dark mode support\"}"}}
```
```

### Points d'attention

1. **`maxIterations: 10`** — le spec dit "Maximum 10 tool calls per step". Moins que le frontend car le styling modifie des fichiers existants (pas de creation de structure).
2. **Pas de `reviewFeedback`** — le spec ne le mentionne pas pour le styling-developer. Le workflow de retry re-execute le step complet.
3. **Pas de `previousResults`** — le styling-developer n'a pas besoin du contexte des steps precedents. Il lit le fichier existant et le modifie.
4. **Le prompt insiste sur "NEVER remove functionality"** — c'est critique. Le styling-developer ajoute des classes CSS, il ne reecrit pas le composant.
5. **`prefers-reduced-motion`** — le prompt mentionne explicitement le respect de cette media query. C'est un critere de qualite.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'styling-developer'"
# Resultat attendu : styling-developer  agent  4.0.0
```

---

## Pipeline de creation et publication (OBLIGATOIRE)

Chaque bloc DOIT passer par ce pipeline complet. **Creer les fichiers ne suffit PAS** — le bloc doit etre teste et publie via le CLI.

### Pre-requis
Verifier que le backend est accessible :
```bash
curl -s http://localhost:5000/api/health
```
Si le backend n'est pas actif, le documenter dans `docs/phases/PHASE-34/irritations.md`. Les tests d'execution seront impossibles mais la creation des fichiers et la validation JSON restent possibles.

### Pour chaque bloc :
1. **Creer les fichiers** dans le dossier approprie (`content/system/blocks/<type>/<block-id>/`)
2. **Verifier la decouverte** par le backend :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String '<block-id>'"
   ```
   Si le bloc n'apparait pas → verifier le format JSON, le nom de fichier, le chemin. Corriger avant de continuer.
3. **Tester l'execution** avec **minimum 2 scenarios** distincts :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run <block-id> --input key=value"
   ```
   Verifier que la sortie est du JSON valide (pour les blocs qui produisent du JSON).
4. **Iterer si la qualite est insuffisante** : modifier le prompt, ajuster la config, changer de modele. **Minimum 2 tentatives, maximum 5.**
5. **Publier le bloc** une fois les tests satisfaisants :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block publish <block-id>"
   ```
6. **Verifier la publication** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js approvals list"
   ```
   Le bloc doit apparaitre dans la liste des approbations en attente.
7. **Documenter le score P/W** dans le checkpoint (voir section Criteres de qualite).
8. **Si bloque apres 5 iterations** : documenter dans `docs/phases/PHASE-34/irritations.md`, noter la raison du blocage, et passer au bloc suivant.

> **RAPPEL** : Un bloc cree mais non publie via `block publish` n'est PAS considere comme termine. Le statut DONE requiert la publication.

---

## Ordre d'execution

Les 3 blocs sont independants les uns des autres pour la CREATION. Mais pour le TEST chaine, il faut un ordre :

1. **backend-developer** — le plus generique, testable immediatement avec un step simple (creer un fichier TypeScript)
2. **frontend-developer** — similaire au backend mais avec designContext
3. **styling-developer** — necessite un fichier existant a modifier (output du frontend-developer)

### Workflow de test chaine

```bash
cd C:\Meastro\packages\maestro-cli

# 1. Preparer un projet de test (ou utiliser un projet existant)
# Creer un dossier C:\TestProject avec un package.json minimal et tsconfig.json

# 2. Tester backend-developer
node index.js run backend-developer \
  --input step='{"id":1,"action":"create","target":"src/types/User.ts","description":"Create User interface with id (string), name (string), email (string)","dependencies":[],"context_files":[],"acceptance":"File exports User type","verification":"file-exists","domain":"types","developer":"backend-developer"}' \
  --input projectContext='{"stack":{"language":"TypeScript","framework":"Express"},"conventions":{"indentation":"2 spaces"}}' \
  --input workingDir=C:\TestProject
# Capturer → $backendResult

# 3. Tester frontend-developer
node index.js run frontend-developer \
  --input step='{"id":3,"action":"create","target":"src/components/UserCard.tsx","description":"Create UserCard component displaying user name, email, and avatar with loading and error states","dependencies":[1],"context_files":["src/types/User.ts"],"acceptance":"Component renders User data with loading/error states","verification":"file-exists","domain":"frontend","developer":"frontend-developer"}' \
  --input projectContext='{"stack":{"language":"TypeScript","framework":"React"},"conventions":{"components":"functional with hooks"}}' \
  --input workingDir=C:\TestProject

# 4. Tester styling-developer sur le composant cree
node index.js run styling-developer \
  --input step='{"id":5,"action":"modify","target":"src/components/UserCard.tsx","description":"Add Tailwind classes: rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow. Add fadeIn animation with Framer Motion.","domain":"styling","developer":"styling-developer"}' \
  --input projectContext='{"stack":{"cssFramework":"tailwind"},"conventions":{}}' \
  --input workingDir=C:\TestProject
```

---

## Criteres de qualite (QualityScore)

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| backend-developer | % de steps implementes qui compilent et passent les tests | >= 0.85 | % reponses JSON valides, code sans imports hallucines | >= 0.90 |
| frontend-developer | % de composants qui compilent et rendent sans erreur | >= 0.85 | JSON valide, pas d'imports hallucines, accessibilite presente | >= 0.90 |
| styling-developer | Qualite visuelle evaluee par ui-reviewer (score >= 0.8) | >= 0.80 | Pas de !important, pas d'animations sur layout properties | >= 0.90 |

### Test de P : 3 scenarios minimum

#### Pour les developers (backend, frontend, styling)

1. **Simple** : Creer un fichier TypeScript avec une interface simple (3 champs) — attendu : success=true, fichier cree correctement
2. **Modere** : Creer un service avec fetch API, error handling, types — attendu : success=true, code complet sans TODO
3. **Complexe** : Modifier un fichier existant en ajoutant une nouvelle methode qui utilise des imports existants — attendu : success=true, imports corrects, pas de code supprime

### Test de W : verification automatisee

```bash
# Verifier que toutes les sorties sont du JSON valide
node index.js run backend-developer --input ... 2>/dev/null | python -m json.tool
node index.js run frontend-developer --input ... 2>/dev/null | python -m json.tool
node index.js run styling-developer --input ... 2>/dev/null | python -m json.tool
```

---

## Erreurs courantes a eviter

1. **Utiliser `config.systemPrompt` inline pour les agents** — les agents (backend-developer, frontend-developer, styling-developer) utilisent `system-prompt.md` comme fichier externe. Seuls les inference blocks utilisent `config.systemPrompt` inline.
2. **Utiliser `config.systemPromptFile` pour les inference blocks** — le `InferenceBlockExecutor` ne supporte PAS `systemPromptFile`. Tout va dans `config.systemPrompt` inline.
3. **Oublier de completer le prompt du frontend-developer** — le spec dit "Same as backend-developer" pour les sections Tool, Output Format, et Rules. Il faut COPIER ces sections dans le `system-prompt.md` du frontend-developer et du styling-developer, pas ecrire "Same as backend-developer".
4. **Utiliser des model IDs incorrects** — `claude-haiku-4-5-20251001` (pas `haiku` ni `Haiku 4.5`), `claude-sonnet-4-6` (pas `sonnet`)
5. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet
6. **Mettre `type: "object"` dans les inputs** — TOUS les inputs sont `"type": "string"`. Les objets JSON sont passes en string serialisee.
7. **Mettre `isAtomic: false`** — les agents sont atomiques (`true`)
8. **Ne pas tester la chaine complete** — tester chaque bloc isole ne suffit pas. Tester le flux : backend-developer -> frontend-developer -> styling-developer
9. **Ne pas mettre les sections Tool/Output/Rules dans les system prompts** — les prompts des 3 developers DOIVENT inclure le bloc Tool complet (avec les 4 commandes), le format Output (done), et les Rules. Le spec les abbrevie avec "Same as backend-developer" mais le fichier `system-prompt.md` doit etre autonome.
10. **Oublier que le styling-developer n'a PAS de `reviewFeedback`** — contrairement au backend et frontend developers, le styling-developer n'a pas cet input. Ne pas l'ajouter.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan E1 — IMPLEMENTER Developers] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan E1 : Specialists IMPLEMENTER (Developers)
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - backend-developer : CREE / TESTE / PUBLIE / VALIDE
  - frontend-developer : CREE / TESTE / PUBLIE / VALIDE
  - styling-developer : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - backend-developer : _/0.85
  - frontend-developer : _/0.85
  - styling-developer : _/0.80
**W score** :
  - backend-developer : _/0.90
  - frontend-developer : _/0.90
  - styling-developer : _/0.90
**Problemes** : [si BLOQUE]
```
