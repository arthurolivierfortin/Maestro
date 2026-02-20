# Plan E2 — Specialists IMPLEMENTER (Validators) : step-validator, compilation-checker

**Objectif** : Creer les 2 blocs specialistes de validation de la phase IMPLEMENTER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/05-specialists-implementer/spec.md`.
**Impact** : Creation de fichiers JSON + Markdown dans `content/system/blocks/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-validators.md`) : Lis ce fichier integralement avant de commencer
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
| step-validator: inference block avec prompts longs | `config.systemPrompt` inline | Tout dans la string inline |

---

## Bloc 1 : step-validator (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/step-validator/step-validator.inference.block.json` | Definition du bloc |

**PAS de fichier `system-prompt.md`** — inference block, tout dans `config.systemPrompt` inline.

### Block definition JSON

```json
{
  "id": "step-validator",
  "name": "Step Validator v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Validates that an implementation step was executed correctly. Checks file existence, non-emptiness, and action-specific criteria. Read-only — never modifies files.",
  "inputs": [
    { "id": "step", "type": "string", "required": true, "description": "JSON object: the plan step (action, target)" },
    { "id": "implementationResult", "type": "string", "required": true, "description": "JSON output from the developer agent (stepId, action, target, success, filesModified, notes)" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { valid, checks: [{ check, target, passed }] }" }
  ],
  "config": {
    "model": "claude-haiku-4-5-20251001",
    "temperature": 0.1,
    "maxTokens": 2000,
    "systemPrompt": "# Step Validator v4\n\nYou verify that an implementation step was executed correctly. You check that files exist, are non-empty, and match the expected action.\n\n## CRITICAL RULES\n\n1. Your ENTIRE response is a single JSON object — the validation result.\n2. NEVER modify any file. You only validate based on the implementation result.\n3. valid=true ONLY if ALL checks pass.\n4. Be strict: if the implementation result says success=false, the validation is automatically invalid.\n\n## Verification Rules\n\n| Action | Checks |\n|--------|--------|\n| create | implementationResult.success=true AND filesModified includes the target |\n| modify | implementationResult.success=true AND filesModified includes the target |\n| delete | implementationResult.success=true AND target is in filesModified |\n| add-dependency | implementationResult.success=true |\n| run-command | implementationResult.success=true |\n\n## Output Format\n\n```json\n{\n  \"valid\": true,\n  \"checks\": [\n    { \"check\": \"file-exists\", \"target\": \"src/services/userService.ts\", \"passed\": true },\n    { \"check\": \"non-empty\", \"target\": \"src/services/userService.ts\", \"passed\": true }\n  ]\n}\n```\n\nIf implementationResult.success is false:\n```json\n{\n  \"valid\": false,\n  \"checks\": [\n    { \"check\": \"implementation-success\", \"target\": \"src/services/userService.ts\", \"passed\": false }\n  ]\n}\n```\n\nOutput ONLY the JSON object. No prose, no markdown, no explanation."
  },
  "metadata": {
    "category": "development",
    "tags": ["validation", "step", "implementation", "quality-gate", "v4"],
    "tier": 1
  }
}
```

### Points d'attention critiques — Divergence spec vs implementation

Le spec decrit le `step-validator` comme un **agent** qui fait des tool calls (`maestro_cli` pour lire les fichiers). MAIS le spec le definit aussi comme un **inference block** (Type: inference). C'est contradictoire.

**Decision** : Le step-validator est un **inference block**. Raison : la validation peut se faire en analysant le `implementationResult` JSON (qui contient `success`, `filesModified`, etc.) sans avoir besoin de faire des tool calls. L'agent developer a deja lu et verifie le fichier. Le step-validator valide la **sortie** du developer, pas le fichier lui-meme.

**Implication** : Le system prompt est simplifie par rapport au spec. Pas de tool calls, pas de `maestro_cli`. Le validator analyse les inputs et produit un verdict.

Si l'on veut un step-validator qui lit reellement les fichiers (comme le spec le suggere dans certaines sections), il faudrait en faire un agent block. Mais le spec dit "Type: inference" et "You MUST call done within 3 tool calls" — ces deux instructions sont contradictoires (inference blocks ne font pas de tool calls). On suit le type declare : **inference**.

### Autres points

1. **Model : `claude-haiku-4-5-20251001`** — le spec dit Haiku 4.5. C'est suffisant pour une validation simple.
2. **`temperature: 0.1`** — tres basse pour maximiser le determinisme. La validation est binaire.
3. **`maxTokens: 2000`** — la sortie est petite (un objet JSON avec quelques checks).
4. **Pas de `designation: "autonomous"`** — inference block.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'step-validator'"
# Resultat attendu : step-validator  inference  4.0.0

# Execution directe
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run step-validator --input step='{\"action\":\"create\",\"target\":\"src/types/User.ts\"}' --input implementationResult='{\"stepId\":1,\"action\":\"create\",\"target\":\"src/types/User.ts\",\"success\":true,\"filesModified\":[\"src/types/User.ts\"],\"notes\":\"Created User interface\"}' --input workingDir=C:\TestProject"
# Resultat attendu : JSON avec valid=true, checks=[{check:'file-exists', ...}]
```

---

## Bloc 2 : compilation-checker (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/compilation-checker/compilation-checker.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/compilation-checker/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "compilation-checker",
  "name": "Compilation Checker v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Builds the project and reports compilation results. Detects the correct build command from project context, executes it, and parses errors and warnings from the output. Read-only — never modifies code.",
  "inputs": [
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer (buildTool, packageManager, stack)" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { compiles, buildCommand, duration, errors: [{ file, line, message }], warnings }" }
  ],
  "config": {
    "model": "claude-haiku-4-5-20251001",
    "maxIterations": 4,
    "wallClockTimeoutSeconds": 300,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["compilation", "build", "checker", "validation", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 5.5 dans `system-prompt.md`. Le texte commence par `# Compilation Checker Agent v4`.

### Points d'attention

1. **Model : `claude-haiku-4-5-20251001`** — le spec dit Haiku 4.5. Suffisant pour executer un build et parser les erreurs.
2. **`maxIterations: 4`** — le spec dit "You MUST call done within 4 tool calls". Workflow typique : (1) lire package.json/config pour confirmer le build command, (2) executer le build, (3) parser le resultat, (4) done.
3. **`wallClockTimeoutSeconds: 300`** — 5 minutes au lieu de 10. Un build qui prend plus de 5 minutes est anormal pour ce contexte. Peut etre augmente si necessaire.
4. **Read-only** — le prompt insiste : "NEVER modify any file". Le compilation-checker reporte, il ne corrige pas.
5. **Le prompt utilise `shell-execute`** — c'est le tool block qui execute des commandes shell via `maestro_cli`. C'est critique pour le build.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'compilation-checker'"
# Resultat attendu : compilation-checker  agent  4.0.0

# Execution directe (necessite un vrai projet avec un build)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run compilation-checker --input projectContext='{\"stack\":{\"language\":\"TypeScript\",\"framework\":\"React\",\"buildTool\":\"vite\"},\"packageManager\":\"npm\"}' --input workingDir=C:\SomeProject"
# Resultat attendu : JSON avec compiles, buildCommand, duration, errors, warnings
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

Les 2 blocs sont independants pour la CREATION. Pour le TEST, un ordre logique :

1. **step-validator** — inference block, pas de dependance externe, testable immediatement avec un implementationResult simule
2. **compilation-checker** — necessite un projet complet buildable pour un test realiste

### Workflow de test chaine

```bash
cd C:\Meastro\packages\maestro-cli

# 1. Tester step-validator avec un resultat reussi
node index.js run step-validator \
  --input step='{"action":"create","target":"src/types/User.ts"}' \
  --input implementationResult='{"stepId":1,"action":"create","target":"src/types/User.ts","success":true,"filesModified":["src/types/User.ts"],"notes":"Created User interface"}' \
  --input workingDir=C:\TestProject
# Verifier : valid=true

# 2. Tester step-validator avec un resultat echoue
node index.js run step-validator \
  --input step='{"action":"create","target":"src/types/User.ts"}' \
  --input implementationResult='{"stepId":1,"action":"create","target":"src/types/User.ts","success":false,"filesModified":[],"notes":"Failed to create file"}' \
  --input workingDir=C:\TestProject
# Verifier : valid=false

# 3. Tester step-validator avec target manquant dans filesModified
node index.js run step-validator \
  --input step='{"action":"create","target":"src/types/User.ts"}' \
  --input implementationResult='{"stepId":1,"action":"create","target":"src/types/User.ts","success":true,"filesModified":["src/types/Other.ts"],"notes":"Created something else"}' \
  --input workingDir=C:\TestProject
# Verifier : valid=false

# 4. Tester compilation-checker
node index.js run compilation-checker \
  --input projectContext='{"stack":{"language":"TypeScript","framework":"React","buildTool":"vite"},"packageManager":"npm"}' \
  --input workingDir=C:\SomeProject
# Verifier : compiles=true/false avec erreurs parsees
```

---

## Criteres de qualite (QualityScore)

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| step-validator | Detection correcte (true positive + true negative) | >= 0.95 | JSON valide, pas de false positives | >= 0.98 |
| compilation-checker | Detection correcte du build command + parsing des erreurs | >= 0.90 | JSON valide, erreurs parsees correctement | >= 0.95 |

### Test de P : 3 scenarios minimum

#### Pour step-validator

1. **Step reussi** : implementationResult.success=true, fichier dans filesModified — attendu : valid=true
2. **Step echoue** : implementationResult.success=false — attendu : valid=false
3. **Step incomplet** : success=true mais filesModified ne contient pas le target — attendu : valid=false

#### Pour compilation-checker

1. **Projet qui compile** : Projet React/TS valide — attendu : compiles=true, errors=[]
2. **Projet avec erreurs TS** : Fichier avec type error — attendu : compiles=false, errors avec file/line/message
3. **Projet Node sans build** : Projet JS sans commande build — attendu : detection de `node` comme runtime, ou report d'absence de build command

### Test de W : verification automatisee

```bash
# Verifier que toutes les sorties sont du JSON valide
node index.js run step-validator --input ... 2>/dev/null | python -m json.tool
node index.js run compilation-checker --input ... 2>/dev/null | python -m json.tool
```

---

## Erreurs courantes a eviter

1. **Utiliser `config.systemPrompt` inline pour les agents** — les agents (compilation-checker) utilisent `system-prompt.md` comme fichier externe. Seuls les inference blocks (step-validator) utilisent `config.systemPrompt` inline.
2. **Utiliser `config.systemPromptFile` pour le step-validator** — le `InferenceBlockExecutor` ne supporte PAS `systemPromptFile`. Tout va dans `config.systemPrompt` inline.
3. **Confondre step-validator agent vs inference** — le spec est contradictoire (dit "inference" mais decrit des tool calls). La decision est : inference block sans tool calls.
4. **Utiliser des model IDs incorrects** — `claude-haiku-4-5-20251001` (pas `haiku` ni `Haiku 4.5`), `claude-sonnet-4-6` (pas `sonnet`)
5. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet
6. **Mettre `type: "object"` dans les inputs** — TOUS les inputs sont `"type": "string"`. Les objets JSON sont passes en string serialisee.
7. **Mettre `isAtomic: false`** — les agents ET inference blocks sont atomiques (`true`)
8. **Ne pas tester la chaine complete** — tester chaque bloc isole ne suffit pas. Tester le flux : step-validator avec un vrai implementationResult, compilation-checker sur un vrai projet
9. **Oublier que le compilation-checker est read-only** — il ne modifie JAMAIS de code. Il reporte les erreurs, c'est tout.
10. **Ne pas mettre les sections Tool/Output dans le system prompt du compilation-checker** — le `system-prompt.md` doit etre autonome et inclure le bloc Tool complet (avec `shell-execute`), le format Output (done), et les Rules.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan E2 — IMPLEMENTER Validators] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan E2 : Specialists IMPLEMENTER (Validators)
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 2
  - step-validator : CREE / TESTE / PUBLIE / VALIDE
  - compilation-checker : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - step-validator : _/0.95
  - compilation-checker : _/0.90
**W score** :
  - step-validator : _/0.98
  - compilation-checker : _/0.95
**Problemes** : [si BLOQUE]
```
