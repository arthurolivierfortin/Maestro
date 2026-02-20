# Plan C — Specialists COMPRENDRE : project-analyzer, task-architect, research-agent

**Objectif** : Creer les 3 blocs specialistes de la phase COMPRENDRE du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/spec/03-specialists-comprendre.md`.
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

**Points critiques** :
- `inputs` est un tableau d'objets `{id, type, required, description}` — PAS un objet avec des champs
- `config.systemPromptFile` pointe vers un fichier markdown relatif au dossier du bloc
- `config.model` utilise les model IDs reels : `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- `metadata.designation` = `"autonomous"` pour les agents, `"tool"` pour les tools

### Inference block format (reference : `code-reviewer.inference.block.json`)

```json
{
  "id": "<block-id>",
  "blockType": "inference",
  "config": {
    "systemPrompt": "Inline prompt text here...",
    "model": "claude-opus-4-6",
    "temperature": 0.3,
    "maxTokens": 4000
  }
}
```

**Difference cle** : Les inference blocks ont `config.systemPrompt` (inline string), pas `config.systemPromptFile`.

---

## Bloc 1 : project-analyzer (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/project-analyzer/project-analyzer.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/project-analyzer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "project-analyzer",
  "name": "Project Analyzer v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Analyzes a project repository to understand its stack, architecture, conventions, and gaps. Produces structured JSON context used by downstream agents (task-architect, planner, developers).",
  "inputs": [
    { "id": "repoPath", "type": "string", "required": true, "description": "Absolute path to the project repository" },
    { "id": "task", "type": "string", "required": true, "description": "Description of the task to be accomplished" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { project, stack, architecture, conventions, existingCode, gaps, relevantFiles }" }
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
    "tags": ["project", "analysis", "context", "v4"],
    "tier": 1
  }
}
```

### System prompt

Le system prompt complet est defini dans `spec/03-specialists-comprendre.md` section 3.1. Il doit etre copie **tel quel** (pas de modification) dans `system-prompt.md`.

**Contenu** : Voir le bloc markdown dans le spec, section "System prompt complet". C'est le texte entre les balises triple-backtick du spec.

### Differences vs project-preparer v2

| Aspect | project-preparer v2 | project-analyzer v4 |
|--------|---------------------|---------------------|
| Model | claude-opus | claude-sonnet-4-6 (suffisant pour analyse factuelle) |
| Output | Texte + docs creees | JSON strictement structure |
| Scope | Analyse + creation de docs | Analyse seule (read-only) |
| Iterations | 8 | 8 (meme) |
| Task context | Non | Oui (input `task`) |
| Gap detection | Non | Oui |
| Relevant files | Non | Oui (filtrage par tache) |

### Verification individuelle

```bash
# Le bloc est decouvert par le backend
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'project-analyzer'"
# Resultat attendu : project-analyzer  agent  4.0.0

# Execution directe (necessite LLM-Provider + backend actifs)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run project-analyzer --input repoPath=C:\Meastro --input task='Add a login page'"
# Resultat attendu : JSON valide avec les champs attendus
```

---

## Bloc 2 : task-architect (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/task-architect/task-architect.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/task-architect/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "task-architect",
  "name": "Task Architect v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Senior software architect. Given a task and project context, designs high-level architecture: decomposes into modules with dependencies, makes design decisions, identifies visual components.",
  "inputs": [
    { "id": "task", "type": "string", "required": true, "description": "Description of the task to implement" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer" },
    { "id": "researchContext", "type": "string", "required": false, "description": "JSON output from research-agent (if available)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { taskAnalysis, architecture, designDecisions, visualComponents }" }
  ],
  "config": {
    "model": "claude-opus-4-6",
    "maxIterations": 6,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["architecture", "design", "decomposition", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/03-specialists-comprendre.md` section 3.2 dans `system-prompt.md`.

### Points d'attention

1. **`researchContext` est optionnel** — le prompt doit fonctionner sans. Ajouter une instruction dans le prompt : "If researchContext is not provided, rely solely on projectContext and your own knowledge."
2. **Opus est necessaire** ici car la tache est du raisonnement architectural complexe (decomposition, detection de risques, decisions de design).
3. **maxIterations: 6** — le context est deja fourni (par project-analyzer), l'architecte n'a pas besoin de beaucoup d'exploration.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'task-architect'"
# Resultat attendu : task-architect  agent  4.0.0
```

---

## Bloc 3 : research-agent (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/research-agent/research-agent.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/research-agent/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "research-agent",
  "name": "Research Agent v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Research agent that searches the web for documentation, examples, and best practices. Returns structured findings with source URLs and actionable recommendations.",
  "inputs": [
    { "id": "query", "type": "string", "required": true, "description": "What to search for (derived from task and context)" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON output from project-analyzer (for tech stack context)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { findings, recommendations, warnings }" }
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
    "tags": ["research", "web-search", "documentation", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/03-specialists-comprendre.md` section 3.3 dans `system-prompt.md`.

### Dependance critique : web-search tool block

Le research-agent appelle `run web-search --input query=...` dans son prompt. Ce tool block **n'existe pas encore** — il sera cree dans le Plan B (tool blocks).

**Impact** : Le research-agent peut etre cree et teste partiellement (lecture de fichiers locaux), mais la recherche web ne fonctionnera pas tant que le tool block `web-search` n'est pas cree.

**Strategie de test sans web-search** :
- Tester avec des queries qui se resolvent par lecture de fichiers locaux
- Verifier que le format JSON de sortie est correct
- Verifier que le prompt gere l'absence de resultats web gracieusement

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'research-agent'"
# Resultat attendu : research-agent  agent  4.0.0
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

1. **project-analyzer** — pas de dependance
2. **task-architect** — a besoin de la sortie de project-analyzer comme input (pour test)
3. **research-agent** — a besoin du tool block web-search (dependance Plan B)

### Workflow de test chaine

```bash
# 1. Tester project-analyzer
cd C:\Meastro\packages\maestro-cli
node index.js run project-analyzer --input repoPath=C:\SomeTestProject --input task="Add a login page"
# Capturer le JSON de sortie → fichier /tmp/project-context.json

# 2. Tester task-architect avec la sortie de 1
node index.js run task-architect --input task="Add a login page" --input projectContext="<json from step 1>"

# 3. Tester research-agent (si web-search existe)
node index.js run research-agent --input query="React login form best practices" --input projectContext="<json from step 1>"
```

---

## Criteres de qualite (QualityScore)

Chaque bloc est evalue sur P (Performance) et W (Composabilite) :

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| project-analyzer | Precision des champs sur 3+ repos | >= 0.85 | % reponses JSON valides | >= 0.95 |
| task-architect | Qualite decomposition sur 3+ taches | >= 0.85 | % JSON valides, 0 deps circulaires | >= 0.90 |
| research-agent | Pertinence findings sur 3+ queries | >= 0.80 | % JSON valides, 0% URLs fabriquees | >= 0.95 |

### Test de P : 3 scenarios minimum

1. **Simple** : Petit projet React (5 fichiers), tache "add a button"
2. **Modere** : Projet React + Express (20+ fichiers), tache "add user management CRUD"
3. **Complexe** : Projet monorepo (50+ fichiers), tache "add real-time notifications with WebSocket"

### Test de W : verification automatisee

```bash
# Verifier que la sortie est du JSON valide
node index.js run project-analyzer --input repoPath=... --input task=... 2>/dev/null | python -m json.tool
# Si la commande echoue → W = 0 pour cette execution
```

---

## Erreurs courantes a eviter

1. **Utiliser `config.systemPrompt` inline** au lieu de `config.systemPromptFile` — les agents utilisent des fichiers externes, pas des inline strings
2. **Utiliser des model IDs incorrects** — c'est `claude-sonnet-4-6`, pas `sonnet` ou `Sonnet 4.6`
3. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet
4. **Mettre `isAtomic: false`** — les agents sont atomiques (`true`), seuls les workflows sont `false`
5. **Ne pas tester** — creer le fichier JSON ne suffit pas, il faut verifier que le backend le decouvre ET que l'execution produit un resultat valide
6. **Copier le prompt du spec sans le relire** — verifier que le prompt mentionne les bons noms de commandes (`maestro_cli`, `run file-read`, etc.)

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples de choses a documenter :
- Commandes CLI qui ne marchent pas comme attendu
- Erreurs de decouverte de blocs (bloc non trouve par `list-blocks`)
- Format JSON rejete par le backend
- Divergences entre spec et realite du codebase
- Bugs dans le backend/CLI/executors
- Documentation manquante ou incorrecte
- Temps d'execution excessifs
- Tout ce qui fait perdre du temps ou frustre

Format par entree :
```
### [Plan C — COMPRENDRE] — YYYY-MM-DD
- **Irritation** : Description du probleme
- **Contexte** : Ce que je faisais quand c'est arrive
- **Contournement** : Ce que j'ai fait pour avancer (ou "bloque" si rien)
- **Suggestion** : Comment ameliorer pour la prochaine fois
```

---

## Checkpoint

```markdown
## Plan C : Specialists COMPRENDRE
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - project-analyzer : CREE / TESTE / PUBLIE / VALIDE
  - task-architect : CREE / TESTE / PUBLIE / VALIDE
  - research-agent : CREE / TESTE / PUBLIE / VALIDE (sans web-search)
**P score** :
  - project-analyzer : _/0.85
  - task-architect : _/0.85
  - research-agent : _/0.80
**W score** :
  - project-analyzer : _/0.95
  - task-architect : _/0.90
  - research-agent : _/0.95
**Problemes** : [si BLOQUE]
```
