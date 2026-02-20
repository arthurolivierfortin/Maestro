# Plan H — Specialists LIVRER : git-committer, changelog-writer, summary-reporter

**Objectif** : Creer les 3 blocs specialistes de la phase LIVRER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/08-specialists-livrer/spec.md`.
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

Cette phase a un mix : 1 agent block (git-committer) et 2 inference blocks (changelog-writer, summary-reporter).

#### Agent block format (reference : `git-committer.agent.block.json` v2)

```
content/system/blocks/agents/<block-id>/
├── <block-id>.agent.block.json
└── system-prompt.md
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
    "wallClockTimeoutSeconds": 180,
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

#### Inference block format

> **DEPENDANCE** : Les inference blocks de ce plan utilisent `system-prompt.md` (fichier externe) pour leurs system prompts. Cela necessite l'Etape 5 du Plan A (13-infrastructure) qui ajoute le support `system-prompt.md` a `InferenceBlockExecutor`. Si Plan A n'est pas encore execute, les inference blocks doivent temporairement utiliser `config.systemPrompt` inline en attendant.

```
content/system/blocks/inference/<block-id>/
├── <block-id>.inference.block.json
└── system-prompt.md
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
    "systemPromptFile": "system-prompt.md",
    "model": "claude-sonnet-4-6",
    "temperature": 0.3,
    "maxTokens": 2000
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
- Agent blocks : `config.systemPromptFile: "system-prompt.md"` + `maxIterations` + `wallClockTimeoutSeconds`
- Inference blocks : `config.systemPromptFile: "system-prompt.md"` + `temperature` + `maxTokens`
- Model IDs reels : `claude-sonnet-4-6` (pas `sonnet` ou `Sonnet 4.6`)
- `isAtomic: true` pour tous
- `metadata.designation: "autonomous"` pour les agents UNIQUEMENT

### Differences cles spec vs codebase

| Spec dit | Codebase reel | Action |
|----------|---------------|--------|
| `inputs` en objet | `inputs` en tableau `[{ id, type, required, description }]` | Convertir en tableau |
| `model: "Sonnet 4.6"` | `model: "claude-sonnet-4-6"` | Utiliser le model ID reel |
| `tools: [...]` dans la config | Pas de `tools` — decrits dans le prompt | Ne pas ajouter |

### Note sur le git-committer existant (v2)

Un `git-committer.agent.block.json` v2 existe deja dans `content/system/blocks/agents/git-committer/`. La v4 le REMPLACE — pas de legacy support. Ecraser le fichier existant avec la nouvelle version. Le `system-prompt.md` existant sera egalement remplace.

---

## Bloc 1 : git-committer (agent)

### Fichiers a creer/remplacer

| Fichier | Action | Contenu |
|---------|--------|---------|
| `content/system/blocks/agents/git-committer/git-committer.agent.block.json` | **REMPLACER** (v2 existe) | Definition du bloc v4 |
| `content/system/blocks/agents/git-committer/system-prompt.md` | **REMPLACER** (v2 existe) | System prompt complet v4 |

### Block definition JSON

```json
{
  "id": "git-committer",
  "name": "Git Committer v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Creates clean, conventional git commits for implemented changes. Stages files individually (never git add . or git add -A), writes a meaningful conventional commit message, and verifies the commit exists.",
  "inputs": [
    { "id": "implementedSteps", "type": "string", "required": true, "description": "JSON array of implemented steps with their modified files" },
    { "id": "reviewResult", "type": "string", "required": true, "description": "JSON object with review score and approved status" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { committed, commitHash, commitMessage, filesStaged, notes }" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 8,
    "wallClockTimeoutSeconds": 180,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["git", "commit", "version-control", "conventional-commits", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/08-specialists-livrer.md` section 8.1 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (one tool call per response, NEVER `git add .` or `git add -A`, never commit unverified files, mandatory sequence: status -> add -> commit -> log -> done, conventional commits format, max 8 tool calls)
- Commit Message Format (`type(scope): description` + bullet points)
- Types (feat, fix, refactor, style, test, docs, chore)
- Scope rules
- Tool format for shell-execute
- Workflow (git status, git add individual files, git commit, git log, done)
- Deciding WHAT to commit (implementation files + test files, NOT node_modules/.env/build artifacts/lock files)
- Commit Message Quality (good vs bad examples)
- Rules (never commit if no changes, never commit sensitive files, one commit per workflow, verify commit hash)

### Differences vs git-committer v2

| Aspect | git-committer v2 | git-committer v4 |
|--------|-------------------|-------------------|
| Inputs | `repoPath`, `changes`, `task`, `review` | `implementedSteps`, `reviewResult`, `workingDir` |
| Input format | Loose strings | Structured JSON (steps with files, review with score) |
| Model | `claude-sonnet` (ancien ID) | `claude-sonnet-4-6` (nouveau ID) |
| Commit format | Conventional (basic) | Conventional (ameliore, avec scope detection) |
| Staged verification | Basic | Mandatory sequence: status -> add -> commit -> log |
| Version | 2.0.0 | 4.0.0 |

### Points d'attention

1. **REMPLACER les fichiers v2** — le git-committer v2 et son system-prompt.md existants seront ecrases. CLAUDE.md : "No legacy support."
2. **`maxIterations: 8`** — suffisant pour: status (1) + add N files (1-4) + commit (1) + log (1) + done (1).
3. **`wallClockTimeoutSeconds: 180`** (3 minutes) — les operations git sont rapides, pas besoin de 10 minutes.
4. **JAMAIS `git add .`** — c'est la regle la plus critique. Stage individuel pour eviter les .env, node_modules, etc. Le prompt du spec est tres clair la-dessus.
5. **Mandatory sequence** — le prompt impose `status -> add -> commit -> log -> done`. Pas de raccourci.
6. **Conventional Commits** — format strict `type(scope): description`. Le prompt inclut des exemples de bons et mauvais messages.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'git-committer'"
# Resultat attendu : git-committer  agent  4.0.0 (PAS 2.0.0)

# Test dans un repo git (creer un repo temporaire)
# 1. Creer un fichier test
# 2. Executer le git-committer
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run git-committer --input workingDir=C:\TempTestRepo --input implementedSteps='[{\"id\":\"1\",\"file\":\"src/utils.ts\",\"action\":\"create\"}]' --input reviewResult='{\"score\":0.85,\"approved\":true}'"
# Resultat attendu : JSON avec committed=true, commitHash, commitMessage au format conventionnel
```

---

## Bloc 2 : changelog-writer (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/changelog-writer/changelog-writer.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/changelog-writer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "changelog-writer",
  "name": "Changelog Writer v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Generates a CHANGELOG.md entry following the Keep a Changelog format. Produces user-facing descriptions of changes (not file-level details). Single LLM call.",
  "inputs": [
    { "id": "commitMessage", "type": "string", "required": true, "description": "The conventional commit message from git-committer" },
    { "id": "implementedSteps", "type": "string", "required": true, "description": "JSON array of what was implemented" },
    { "id": "reviewResult", "type": "string", "required": false, "description": "JSON object with review score and issues" },
    { "id": "existingChangelog", "type": "string", "required": false, "description": "Current content of CHANGELOG.md (or null if none exists)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { entry, section, hasChangelog }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-sonnet-4-6",
    "temperature": 0.3,
    "maxTokens": 2000
  },
  "metadata": {
    "category": "development",
    "tags": ["changelog", "documentation", "release-notes", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/08-specialists-livrer.md` section 8.2 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, Keep a Changelog format, user-visible changes only, note if no CHANGELOG.md exists)
- Categories : Added, Changed, Deprecated, Removed, Fixed, Security
- Output format JSON
- Rules (write for humans, one bullet per feature, group related changes, use "Changed" for internal-only changes)

### Points d'attention

1. **C'est un inference block** — un seul appel LLM. Pas de boucle, pas de tools.
2. **Sonnet 4.6 suffit** — la generation de changelog est une tache de redaction structuree, pas de raisonnement profond.
3. **`temperature: 0.3`** — un peu de creativite pour la redaction mais pas trop pour rester factuellement correct.
4. **`maxTokens: 2000`** — une entree changelog est courte (quelques bullets). 2000 tokens est largement suffisant.
5. **Write for humans** — anti-pattern : "Created userService.ts, UserCard.tsx". Le changelog dit "Add user management module" — description fonctionnelle, pas technique.
6. **`hasChangelog: false`** si le projet n'a pas de CHANGELOG.md — le flux aval doit savoir s'il faut creer le fichier ou l'editer.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'changelog-writer'"
# Resultat attendu : changelog-writer  inference  4.0.0

# Test avec des donnees simulees
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run changelog-writer --input commitMessage='feat(users): add user management module with CRUD operations' --input implementedSteps='[{\"id\":\"1\",\"action\":\"create\",\"target\":\"User types\"},{\"id\":\"2\",\"action\":\"create\",\"target\":\"User service\"},{\"id\":\"3\",\"action\":\"create\",\"target\":\"UserCard component\"}]' --input existingChangelog='# Changelog\n\n## [Unreleased]\n\n### Added\n- Initial project setup'"
# Resultat attendu : JSON avec entry (markdown), section="Unreleased", hasChangelog=true
```

---

## Bloc 3 : summary-reporter (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/summary-reporter/summary-reporter.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/summary-reporter/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "summary-reporter",
  "name": "Summary Reporter v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Produces a concise, informative summary of the work completed by the autonomous agent. Includes metrics, files modified, commit info, and project-specific learnings. Displayed to the user as final output.",
  "inputs": [
    { "id": "task", "type": "string", "required": true, "description": "The original task description" },
    { "id": "implementedSteps", "type": "string", "required": true, "description": "JSON array of all implemented steps" },
    { "id": "testResults", "type": "string", "required": false, "description": "JSON object with test results from the VERIFIER phase" },
    { "id": "reviewResult", "type": "string", "required": false, "description": "JSON object with review scores and details" },
    { "id": "commitResult", "type": "string", "required": false, "description": "JSON object with commit hash and message from git-committer" },
    { "id": "iterations", "type": "string", "required": false, "description": "Number of iterations performed (0 = first pass succeeded)" },
    { "id": "duration", "type": "string", "required": false, "description": "Total execution duration (e.g. '4m 32s')" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { summary, metrics, learnings }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-sonnet-4-6",
    "temperature": 0.3,
    "maxTokens": 3000
  },
  "metadata": {
    "category": "development",
    "tags": ["summary", "reporting", "metrics", "learnings", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/08-specialists-livrer.md` section 8.3 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, summary in markdown, include ALL metrics, learnings = project-specific patterns, be honest about failures)
- Summary Structure : Task header, What was done (3-5 bullets), Metrics, Files, Commit, Issues (if any)
- Learnings definition (project-specific patterns for `.maestro/memory/`)
- Output format JSON

### Points d'attention

1. **C'est un inference block** — un seul appel LLM. Pas de boucle, pas de tools.
2. **Sonnet 4.6 suffit** — production de rapport structure, pas de raisonnement profond.
3. **`maxTokens: 3000`** — le summary peut etre relativement long (markdown + metrics + learnings). 3000 est suffisant.
4. **Beaucoup d'inputs optionnels** — le summary-reporter doit fonctionner meme si certains inputs sont absents (ex: pas de testResults si le projet n'a pas de tests). Le prompt doit gerer gracieusement les inputs manquants.
5. **Transparence totale** — anti-pattern : cacher les echecs. Si 2 tests ont echoue, le summary doit le dire.
6. **Learnings = specifiques au projet** — anti-pattern : "JavaScript is a programming language". Les learnings doivent etre actionables : "This project uses custom React hooks for all data fetching".
7. **Metriques exactes** — les metriques viennent des inputs, pas du jugement du LLM. Si `testResults.passed = 5`, le summary dit "5 passed", pas "several tests passed".

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'summary-reporter'"
# Resultat attendu : summary-reporter  inference  4.0.0

# Test avec des donnees simulees completes
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run summary-reporter --input task='Add user management module' --input implementedSteps='[{\"id\":\"1\",\"target\":\"User types\"},{\"id\":\"2\",\"target\":\"User service\"},{\"id\":\"3\",\"target\":\"UserCard component\"}]' --input testResults='{\"passed\":9,\"failed\":0,\"total\":9}' --input reviewResult='{\"score\":0.85,\"approved\":true}' --input commitResult='{\"committed\":true,\"commitHash\":\"a1b2c3d\",\"commitMessage\":\"feat(users): add user management module\"}' --input iterations='1' --input duration='4m 32s'"
# Resultat attendu : JSON avec summary (markdown), metrics (structured), learnings (array)

# Test avec inputs minimaux (pas de tests, pas de commit)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run summary-reporter --input task='Add user management module' --input implementedSteps='[{\"id\":\"1\",\"target\":\"User types\"}]'"
# Resultat attendu : JSON valide meme sans testResults, reviewResult, commitResult
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

Dans le flux reel de la phase LIVRER, l'ordre est sequentiel : git-committer -> changelog-writer -> summary-reporter. Mais pour la CREATION des blocs, l'ordre n'importe pas — ils sont independants.

Ordre recommande pour la creation :
1. **git-committer** — remplacer le v2 existant par la v4
2. **changelog-writer** — nouveau bloc, pas de dependance pour la creation
3. **summary-reporter** — nouveau bloc, pas de dependance pour la creation

### Workflow de test chaine (phase LIVRER complete)

```bash
cd C:\Meastro\packages\maestro-cli

# Prerequis : avoir un repo git avec des fichiers modifies

# 1. Git commit
node index.js run git-committer \
  --input workingDir=C:\TempTestRepo \
  --input implementedSteps='[{"id":"1","file":"src/utils.ts","action":"create"}]' \
  --input reviewResult='{"score":0.85,"approved":true}'
# Capturer commitHash et commitMessage

# 2. Changelog entry (utiliser le commitMessage de l'etape 1)
node index.js run changelog-writer \
  --input commitMessage='feat(users): add user management module' \
  --input implementedSteps='[{"id":"1","action":"create","target":"User types"}]' \
  --input reviewResult='{"score":0.85}' \
  --input existingChangelog='# Changelog'

# 3. Summary report (utiliser les resultats de toutes les phases precedentes)
node index.js run summary-reporter \
  --input task='Add user management module' \
  --input implementedSteps='[{"id":"1","target":"User types"}]' \
  --input testResults='{"passed":9,"failed":0}' \
  --input reviewResult='{"score":0.85,"approved":true}' \
  --input commitResult='{"committed":true,"commitHash":"a1b2c3d","commitMessage":"feat(users): add user management module"}' \
  --input iterations='1' \
  --input duration='4m 32s'
```

---

## Criteres de qualite (QualityScore)

Chaque bloc est evalue sur P (Performance) et W (Composabilite) :

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| git-committer | Commit reussi + message conventionnel valide | >= 0.90 | JSON valide, commit hash reel | >= 0.95 |
| changelog-writer | Qualite de l'entree changelog (evaluee par humain) | >= 0.80 | JSON valide, format Keep a Changelog respecte | >= 0.95 |
| summary-reporter | Clarte et completude du rapport (evaluee par humain) | >= 0.85 | JSON valide, markdown bien forme, metriques exactes | >= 0.95 |

### Test de P : 3 scenarios minimum par bloc

#### git-committer

1. **Simple** : Un seul fichier cree. Verifier que le commit message est au format `feat(scope): description`.
2. **Modere** : 5 fichiers crees + 2 fichiers modifies. Verifier que tous les fichiers sont stages individuellement (pas de `git add .`).
3. **Avec suppressions** : Fichiers crees + fichiers supprimes. Verifier que les deletions sont aussi staged.

#### changelog-writer

1. **Feature ajoutee** : Commit `feat(users): add user management` + steps de creation. Resultat attendu : section "### Added" avec bullets descriptifs.
2. **Bug fix** : Commit `fix(auth): handle token expiration` + steps de correction. Resultat attendu : section "### Fixed".
3. **Sans changelog existant** : `existingChangelog` = null. Resultat attendu : `hasChangelog: false`, entry quand meme generee.

#### summary-reporter

1. **Succes complet** : Tous les inputs fournis, tests passes, review approuve, commit reussi. Verifier que le summary est complet et positif.
2. **Succes partiel** : Tests avec echecs (2 failed), review approuve avec warnings. Verifier que les echecs sont mentionnes (pas caches).
3. **Inputs minimaux** : Seulement `task` et `implementedSteps` fournis. Verifier que le bloc produit un JSON valide sans planter sur les inputs manquants.

### Test de W : verification automatisee

```bash
# Verifier que la sortie est du JSON valide pour chaque bloc
node index.js run git-committer --input ... 2>/dev/null | python -m json.tool
node index.js run changelog-writer --input ... 2>/dev/null | python -m json.tool
node index.js run summary-reporter --input ... 2>/dev/null | python -m json.tool
# Si la commande echoue -> W = 0 pour cette execution

# Verifier le format de commit message
# Le commitMessage doit matcher le pattern: type(scope): description
# Regex: ^(feat|fix|refactor|style|test|docs|chore)\([a-z-]+\): .+$
```

### Test specifique git-committer : verification anti-patterns

```bash
# Verifier que le git-committer ne fait JAMAIS git add . ou git add -A
# Executer le bloc et examiner les tool calls dans le log
# Chaque git add doit specifier un fichier individuel
```

---

## Erreurs courantes a eviter

1. **Mettre `config.systemPrompt` inline** — les prompts sont longs. Utiliser `config.systemPromptFile: "system-prompt.md"` avec un fichier externe pour les 3 blocs.
2. **Utiliser des model IDs incorrects** — c'est `claude-sonnet-4-6`, pas `sonnet`, `claude-sonnet`, ou `Sonnet 4.6`. L'ancien `git-committer` avait `claude-sonnet` (ancien format) — le v4 utilise `claude-sonnet-4-6`.
3. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet.
4. **Mettre `isAtomic: false`** — les agents ET les inference blocks sont atomiques (`true`). Seuls les workflows sont `false`.
5. **Confondre agent et inference** — git-committer est un AGENT (boucle agentic, tool calls via shell-execute). changelog-writer et summary-reporter sont des INFERENCE blocks (un seul appel LLM).
6. **Mettre `designation: "autonomous"` sur les inference blocks** — ce champ est pour les agents seulement.
7. **Mettre `maxIterations` sur les inference blocks** — les inference blocks n'ont PAS de `maxIterations`. Ils ont `temperature` et `maxTokens`.
8. **Ne pas remplacer les fichiers v2 du git-committer** — le v2 doit etre ECRASE par le v4. CLAUDE.md : "No legacy support."
9. **Placer les inference blocks dans `agents/`** — changelog-writer et summary-reporter vont dans `content/system/blocks/inference/<block-id>/`, PAS dans `agents/`.
10. **Oublier de tester le git-committer dans un vrai repo git** — ce bloc execute des commandes git reelles. Un test en isolation (sans repo git) echouera. Creer un repo temporaire pour les tests.
11. **Le summary-reporter plante si des inputs optionnels manquent** — le prompt DOIT gerer gracieusement les inputs absents. Tester avec des inputs minimaux.
12. **Le changelog-writer liste des fichiers** au lieu de features — "Created userService.ts" est un anti-pattern. "Add user management" est correct.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan H — LIVRER] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan H : Specialists LIVRER
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - git-committer : REMPLACE v2->v4 / TESTE / PUBLIE / VALIDE
  - changelog-writer : CREE / TESTE / PUBLIE / VALIDE
  - summary-reporter : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - git-committer : _/0.90
  - changelog-writer : _/0.80
  - summary-reporter : _/0.85
**W score** :
  - git-committer : _/0.95
  - changelog-writer : _/0.95
  - summary-reporter : _/0.95
**Remplacement v2** :
  - git-committer v2 ecrase : OUI / NON
  - Version affichee par list-blocks : 4.0.0 / autre
**Tests chaines** :
  - git-committer -> changelog-writer -> summary-reporter : PASS / FAIL
**Problemes** : [si BLOQUE]
```
