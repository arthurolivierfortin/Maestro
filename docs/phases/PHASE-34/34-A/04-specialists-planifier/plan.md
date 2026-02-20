# Plan D — Specialists PLANIFIER : task-planner, plan-validator

**Objectif** : Creer les 2 blocs specialistes de la phase PLANIFIER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/04-specialists-planifier/spec.md`.
**Impact** : Creation de fichiers JSON + Markdown dans `content/system/blocks/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan.md`) : Lis ce fichier integralement avant de commencer
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
- Agent blocks : `config.systemPromptFile` pointe vers un fichier markdown relatif ; le `AgentBlockExecutor` charge `system-prompt.md` depuis le dossier du bloc (via `config.path` injecte par le discovery service)
- Inference blocks : `config.systemPrompt` est une string inline. **Note** : Apres l'implementation de l'Etape 5 du Plan A (13-infrastructure), les inference blocks supporteront aussi `system-prompt.md` dans leur dossier. Pour les prompts courts (< 100 lignes), `config.systemPrompt` inline reste acceptable.
- `config.model` utilise les model IDs reels : `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- `metadata.designation` = `"autonomous"` pour les agents

### Corrections de format vs spec

| Champ spec | Format reel | Correction |
|-----------|-------------|------------|
| `inputs.projectContext` type `object` | `"type": "string"` | Les objets sont passes comme JSON stringifie |
| `inputs.architecture` type `object` | `"type": "string"` | Idem |
| `inputs.researchContext` type `object` | `"type": "string"` | Idem |
| `inputs.userOverrides` type `object` | `"type": "string"` | Idem |
| `inputs.plan` type `array` | `"type": "string"` | Idem — le plan est passe comme JSON stringifie |
| plan-validator `systemPromptFile` | `config.systemPrompt` inline | Inference blocks n'ont PAS de `systemPromptFile` dans l'executor |

---

## Bloc 1 : task-planner (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/task-planner/task-planner.agent.block.json` | Definition du bloc (REMPLACE l'existant v2) |
| `content/system/blocks/agents/task-planner/system-prompt.md` | System prompt complet v4 (REMPLACE l'existant v2) |

**ATTENTION** : Un bloc `task-planner` v2 existe deja dans `content/system/blocks/agents/task-planner/`. Le bloc v4 le REMPLACE — pas de legacy support (CLAUDE.md). Ecraser les fichiers existants.

### Block definition JSON

```json
{
  "id": "task-planner",
  "name": "Task Planner v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Development task planner. Given a task, project context, and high-level architecture, produces an atomic, dependency-ordered implementation plan with domain routing for each step.",
  "inputs": [
    { "id": "task", "type": "string", "required": true, "description": "Description of the task to implement" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer (stack, conventions, architecture)" },
    { "id": "architecture", "type": "string", "required": true, "description": "JSON output from task-architect (modules, design decisions, visual components)" },
    { "id": "researchContext", "type": "string", "required": false, "description": "JSON output from research-agent (if available)" },
    { "id": "userOverrides", "type": "string", "required": false, "description": "JSON modifications injected by the interaction-handler (if any)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON array of ordered implementation steps, each with id, domain, developer, action, target, description, dependencies, context_files, acceptance, verification" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 6,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["planning", "decomposition", "task", "implementation-plan", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 4.1 dans `system-prompt.md`. C'est le texte entre les balises triple-backtick du spec (tout le bloc markdown commencant par `# Task Planner Agent v4`).

**Points d'attention sur le prompt** :
1. Le prompt mentionne `maestro_cli` comme outil unique — c'est correct
2. Le prompt specifie `done` comme outil de finalisation — c'est correct
3. Le prompt demande `done` en max 4 tool calls — coherent avec `maxIterations: 6` (marge de securite)
4. Le prompt specifie 3 developers : `backend-developer`, `frontend-developer`, `styling-developer` — ce sont les blocs de la phase IMPLEMENTER (spec 05)
5. Le prompt reference `file-read` et `directory-list` comme commandes disponibles
6. Le format de sortie est un JSON array dans `done.summary` — stringifie

### Differences vs task-planner v2

| Aspect | task-planner v2 | task-planner v4 |
|--------|-----------------|-----------------|
| Model | claude-opus | claude-sonnet-4-6 (contexte deja fourni) |
| Inputs | task, context (texte libre), repoPath | task, projectContext (JSON), architecture (JSON), researchContext, userOverrides |
| Output | Array de steps basiques | Array de steps enrichis (domain, developer, acceptance, verification) |
| maxIterations | 8 | 6 (exploration minimale — le contexte est fourni) |
| Domain routing | Non | Oui — chaque step assigne a un developer |
| User overrides | Non | Oui — integration des modifications utilisateur |
| Plan validation | Non | En aval via plan-validator |

### Verification individuelle

```bash
# Le bloc est decouvert par le backend
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'task-planner'"
# Resultat attendu : task-planner  agent  4.0.0

# Execution directe (necessite LLM-Provider + backend actifs)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run task-planner --input task='Add a login page with email/password' --input projectContext='{\"stack\":{\"frontend\":\"React\",\"backend\":\"Express\"},\"conventions\":{}}' --input architecture='{\"modules\":[{\"name\":\"types\",\"priority\":1},{\"name\":\"api\",\"priority\":2},{\"name\":\"ui\",\"priority\":3}],\"designDecisions\":[]}'"
# Resultat attendu : JSON array de steps avec id, domain, developer, etc.
```

---

## Bloc 2 : plan-validator (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/plan-validator/plan-validator.inference.block.json` | Definition du bloc |

**PAS de fichier `system-prompt.md`** — les inference blocks utilisent `config.systemPrompt` inline. **Note** : Apres l'implementation de l'Etape 5 du Plan A (13-infrastructure), les inference blocks supporteront aussi `system-prompt.md` dans leur dossier. Pour les prompts courts (< 100 lignes), `config.systemPrompt` inline reste acceptable.

### Block definition JSON

Le system prompt est long. Pour un inference block, il DOIT aller dans `config.systemPrompt` inline (string avec `\n`). C'est le pattern du `code-reviewer.inference.block.json` existant.

```json
{
  "id": "plan-validator",
  "name": "Plan Validator v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Validates implementation plans produced by task-planner. Checks structural validity, dependency ordering, convention adherence, and architectural coherence. Quality gate before implementation.",
  "inputs": [
    { "id": "plan", "type": "string", "required": true, "description": "JSON array of steps from task-planner" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer" },
    { "id": "architecture", "type": "string", "required": true, "description": "JSON output from task-architect" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { valid, score, issues, warnings, suggestion }" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "temperature": 0.2,
    "maxTokens": 4000,
    "systemPrompt": "# Plan Validator v4\n\nYou validate implementation plans produced by the task-planner. You check structural validity, dependency ordering, convention adherence, and architectural coherence. You are a quality gate — the plan should not proceed if it has critical issues.\n\n## CRITICAL RULES\n\n1. Your ENTIRE response is a single JSON object — the validation result.\n2. NEVER modify the plan. Only validate and report issues.\n3. A plan is `valid: false` if ANY issue has severity \"error\". Warnings are acceptable.\n4. NEVER approve a plan with circular dependencies or absolute paths.\n5. score is a float [0, 1] representing overall plan quality.\n\n## Validation Checks\n\n### Structural (automatic fail if violated)\n- [ ] Each step has ALL required fields: id, domain, developer, action, target, description, dependencies, context_files, acceptance, verification\n- [ ] No circular dependencies (check transitive closure)\n- [ ] No absolute paths in target or context_files\n- [ ] IDs are sequential starting at 1\n- [ ] dependencies only reference existing step IDs\n- [ ] action is one of: create, modify, delete, add-dependency, run-command\n- [ ] developer is one of: backend-developer, frontend-developer, styling-developer\n\n### Quality (warnings, not failures)\n- [ ] descriptions are specific enough (> 20 words, mention file/function names)\n- [ ] context_files reference files that exist or are created by earlier steps\n- [ ] acceptance criteria are verifiable (not vague)\n- [ ] dependency ordering follows the rules (types -> backend -> frontend -> styling)\n- [ ] domain matches the assigned developer\n\n### Architectural coherence\n- [ ] Plan covers all modules from the architecture\n- [ ] No modules are orphaned (defined in architecture but not in plan)\n- [ ] Design decisions are reflected in step descriptions\n- [ ] Visual components from architecture have corresponding steps\n\n## Scoring\n\n- Start at 1.0\n- -0.15 per structural error\n- -0.05 per quality warning\n- -0.10 per architectural coherence gap\n- Minimum 0.0\n\n## Output Format\n\n```json\n{\n  \"valid\": true,\n  \"score\": 0.92,\n  \"issues\": [{ \"stepId\": 1, \"type\": \"...\", \"message\": \"...\" }],\n  \"warnings\": [{ \"stepId\": 1, \"type\": \"...\", \"message\": \"...\" }],\n  \"suggestion\": \"How to fix the main issue\" \n}\n```\n\nIssue types: circular-dependency, absolute-path, missing-field, invalid-action, invalid-developer, orphaned-module, missing-design-decision\nWarning types: vague-description, missing-context, wrong-domain, weak-acceptance\n\nOutput ONLY the JSON object. No prose, no markdown, no explanation."
  },
  "metadata": {
    "category": "development",
    "tags": ["validation", "plan", "quality-gate", "v4"],
    "tier": 1
  }
}
```

### Points d'attention

1. **Pas de `designation: "autonomous"`** — les inference blocks ne sont pas des agents. Pas de designation necessaire.
2. **`temperature: 0.2`** — basse pour la validation (deterministe). Meme pattern que `code-reviewer`.
3. **`maxTokens: 4000`** — suffisant pour un rapport de validation. Le plan peut avoir 30 steps, chacun avec potentiellement un issue/warning.
4. **Le system prompt est inline** — c'est le seul moyen pour les inference blocks. Les caracteres speciaux (`"`, `\n`) doivent etre echappes correctement dans le JSON.
5. **Le prompt du spec utilise `true|false`** dans le format JSON — ce n'est pas du JSON valide. Remplacer par `true` dans l'exemple et ajouter une note que la valeur est booleenne.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'plan-validator'"
# Resultat attendu : plan-validator  inference  4.0.0

# Execution directe
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run plan-validator --input plan='[{\"id\":1,\"domain\":\"types\",\"developer\":\"backend-developer\",\"action\":\"create\",\"target\":\"src/types/User.ts\",\"description\":\"Create User interface\",\"dependencies\":[],\"context_files\":[],\"acceptance\":\"File exports User type\",\"verification\":\"file-exists\"}]' --input projectContext='{\"stack\":{}}' --input architecture='{\"modules\":[]}'"
# Resultat attendu : JSON avec valid, score, issues, warnings, suggestion
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

1. **task-planner** — a besoin des sorties de project-analyzer et task-architect comme inputs (blocs du Plan C)
2. **plan-validator** — a besoin de la sortie du task-planner comme input

### Workflow de test chaine

```bash
cd C:\Meastro\packages\maestro-cli

# 1. Generer le contexte projet (prerequis — bloc du Plan C)
node index.js run project-analyzer --input repoPath=C:\SomeTestProject --input task="Add user management"
# Capturer le JSON → variable $projectContext

# 2. Generer l'architecture (prerequis — bloc du Plan C)
node index.js run task-architect --input task="Add user management" --input projectContext="<json from step 1>"
# Capturer le JSON → variable $architecture

# 3. Tester task-planner
node index.js run task-planner --input task="Add user management" --input projectContext="<json from step 1>" --input architecture="<json from step 2>"
# Capturer le JSON array → variable $plan

# 4. Tester plan-validator
node index.js run plan-validator --input plan="<json from step 3>" --input projectContext="<json from step 1>" --input architecture="<json from step 2>"
# Verifier : valid=true/false, score, issues coherents
```

### Test de la boucle plan -> validate -> re-plan

```bash
# 1. Creer un plan volontairement invalide (deps circulaires, chemin absolu)
# 2. Passer au plan-validator → doit retourner valid=false avec issues
# 3. Passer les issues au task-planner → doit produire un plan corrige
# 4. Re-valider → doit retourner valid=true
```

---

## Criteres de qualite (QualityScore)

Chaque bloc est evalue sur P (Performance) et W (Composabilite) :

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| task-planner | % de plans ou chaque step est implementable tel quel | >= 0.85 | % reponses JSON valides, 0% deps circulaires, 0% chemins absolus | >= 0.95 |
| plan-validator | Detection de vrais problemes sur 20 plans (10 valides, 10 invalides) — precision + recall | >= 0.90 | 100% reponses JSON valides | >= 1.0 |

### Test de P : 3 scenarios minimum

#### Pour task-planner

1. **Simple** : Petit projet React (5 fichiers), tache "add a button component" — attendu : 2-4 steps, tous domain=frontend
2. **Modere** : Projet React + Express (20+ fichiers), tache "add user management CRUD" — attendu : 10-15 steps, mix backend/frontend, types en premier
3. **Complexe** : Projet monorepo (50+ fichiers), tache "add real-time notifications with WebSocket" — attendu : 15-25 steps, backend (WebSocket server), frontend (notifications UI), styling (animations)

#### Pour plan-validator

1. **Plan valide** : Plan bien forme de 10 steps, deps correctes, chemins relatifs — attendu : valid=true, score >= 0.85
2. **Plan avec erreurs structurelles** : Deps circulaires, chemins absolus, champs manquants — attendu : valid=false, issues listent chaque probleme
3. **Plan avec warnings qualite** : Descriptions vagues, acceptance non verifiable — attendu : valid=true, warnings listent les problemes, score < 0.85

### Test de W : verification automatisee

```bash
# Verifier que la sortie est du JSON valide
node index.js run task-planner --input task=... --input projectContext=... --input architecture=... 2>/dev/null | python -m json.tool
# Si la commande echoue → W = 0 pour cette execution

node index.js run plan-validator --input plan=... --input projectContext=... --input architecture=... 2>/dev/null | python -m json.tool
# Si la commande echoue → W = 0 pour cette execution
```

---

## Erreurs courantes a eviter

1. **Utiliser `config.systemPrompt` inline pour le task-planner (agent)** — les agents utilisent `system-prompt.md` comme fichier externe. Le `config.systemPromptFile` pointe vers le fichier, mais c'est le `AgentBlockExecutor` qui charge le fichier depuis `config.path + "system-prompt.md"`.
2. **Utiliser `config.systemPromptFile` pour le plan-validator (inference)** — les inference blocks utilisent `config.systemPrompt` inline. **Note** : Apres l'implementation de l'Etape 5 du Plan A (13-infrastructure), les inference blocks supporteront aussi `system-prompt.md` dans leur dossier. Pour les prompts courts (< 100 lignes), `config.systemPrompt` inline reste acceptable.
3. **Utiliser des model IDs incorrects** — c'est `claude-sonnet-4-6`, pas `sonnet` ou `Sonnet 4.6`
4. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet
5. **Mettre `type: "object"` dans les inputs** — dans le codebase, TOUS les inputs sont `"type": "string"`. Les objets JSON sont passes en string serialisee.
6. **Mettre `isAtomic: false`** — les agents ET inference blocks sont atomiques (`true`). Seuls les workflows sont `false`.
7. **Ne pas tester** — creer le fichier JSON ne suffit pas, il faut verifier que le backend le decouvre ET que l'execution produit un resultat valide
8. **Ne pas echapper les caracteres dans `config.systemPrompt`** — les `"`, `\n` et `\t` doivent etre echappes correctement dans le JSON du plan-validator
9. **Oublier de remplacer le task-planner v2** — le bloc v2 existe deja. Ecraser, pas cohabiter (no legacy support).
10. **Ne pas verifier la boucle plan -> validate** — tester chaque bloc isole ne suffit pas. Tester que le plan-validator detecte bien les problemes ET que le task-planner peut corriger son plan.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan D — PLANIFIER] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan D : Specialists PLANIFIER
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 2
  - task-planner : CREE / TESTE / PUBLIE / VALIDE
  - plan-validator : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - task-planner : _/0.85
  - plan-validator : _/0.90
**W score** :
  - task-planner : _/0.95
  - plan-validator : _/1.0
**Problemes** : [si BLOQUE]
```
