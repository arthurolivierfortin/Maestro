> **NOTE** : Ce plan a ete decoupe en sous-plans executables independamment :
> - [plan-test-agents.md](plan-test-agents.md) — test-writer, test-runner, e2e-tester
> - [plan-visual-reviewers.md](plan-visual-reviewers.md) — ui-reviewer, accessibility-checker
> Les sous-plans sont auto-suffisants et incluent tout le contexte necessaire.

# Plan F — Specialists VERIFIER : test-writer, test-runner, e2e-tester, ui-reviewer, accessibility-checker

**Objectif** : Creer les 5 blocs specialistes de la phase VERIFIER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/06-specialists-verifier/spec.md`.
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

#### Agent block format (reference : `implement-single-step.agent.block.json`)

```
content/system/blocks/agents/<block-id>/
├── <block-id>.agent.block.json    <- Definition du bloc
└── system-prompt.md               <- System prompt externe
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

Pour les inference blocks avec des prompts LONGS (plus de 500 caracteres), utiliser `systemPromptFile` avec un fichier externe :

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
    "model": "claude-opus-4-6",
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
- Agent blocks : `config.systemPromptFile` pointe vers un fichier markdown relatif au dossier du bloc
- Inference blocks avec prompts longs : utiliser egalement `systemPromptFile` au lieu de `systemPrompt` inline
- `config.model` utilise les model IDs reels : `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- `metadata.designation` = `"autonomous"` pour les agents
- `isAtomic: true` pour TOUS les agents et inference blocks

### Differences cles spec vs codebase

| Spec dit | Codebase reel | Action |
|----------|---------------|--------|
| `inputs` en objet `{ champ: { type, description } }` | `inputs` en tableau `[{ id, type, required, description }]` | Convertir en tableau |
| `model: "Sonnet 4.6"` | `model: "claude-sonnet-4-6"` | Utiliser le model ID reel |
| `model: "Opus 4.6"` | `model: "claude-opus-4-6"` | Utiliser le model ID reel |
| `tools: [...]` dans la config | Pas de `tools` dans la config — les tools sont decrits dans le prompt | Ne pas ajouter `tools` |
| `config.systemPrompt` inline (tres long) | `config.systemPromptFile: "system-prompt.md"` | Utiliser un fichier externe pour les prompts longs |

---

## Bloc 1 : test-writer (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/test-writer/test-writer.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/test-writer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "test-writer",
  "name": "Test Writer v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Writes unit tests for code that was just implemented. Creates comprehensive test suites covering happy paths, edge cases, and error handling. Split from the old test-executor — writes only, does not run.",
  "inputs": [
    { "id": "implementedSteps", "type": "string", "required": true, "description": "JSON array of implemented steps with their files" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON object with stack, testFramework, conventions" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { testsWritten, totalTests, notes }" }
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
    "tags": ["testing", "unit-tests", "quality", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/06-specialists-verifier.md` section 6.1 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (one tool call per response, read source before writing tests, follow project conventions)
- Test Quality Standards (structure, coverage, assertions, mocking)
- Test Framework Patterns (vitest/jest, React Testing Library)
- Workflow (list files, read source, read existing tests, write test file)
- Test File Placement conventions
- Rules (no tests for unread files, no snapshot tests unless project uses them, etc.)

### Points d'attention

1. **`maxIterations: 15`** (pas 8) — le test-writer doit lire N fichiers source + ecrire N fichiers de test, ce qui demande beaucoup d'iterations.
2. **Les inputs sont tous `type: "string"`** dans le codebase meme si le spec dit `array` ou `object`. Le JSON est passe en string et parse par le LLM.
3. **Split de l'ancien `test-executor`** : le test-writer ECRIT seulement. Il ne fait jamais `npm test` ou `pytest`. C'est le role du test-runner.

### Differences vs test-executor v2

| Aspect | test-executor v2 | test-writer v4 |
|--------|-------------------|----------------|
| Scope | Ecrit ET execute les tests | Ecrit seulement |
| Iterations | 8 | 15 (plus de fichiers a lire/ecrire) |
| Output | Resultats mixtes (tests + execution) | JSON avec testsWritten uniquement |
| Version | 2.0.0 | 4.0.0 |

### Verification individuelle

```bash
# Le bloc est decouvert par le backend
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'test-writer'"
# Resultat attendu : test-writer  agent  4.0.0

# Execution directe (necessite LLM-Provider + backend actifs)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run test-writer --input workingDir=C:\SomeTestProject --input implementedSteps='[{\"id\":\"1\",\"file\":\"src/utils.ts\"}]' --input projectContext='{\"testFramework\":\"vitest\"}'"
# Resultat attendu : JSON avec testsWritten, totalTests
```

---

## Bloc 2 : test-runner (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/test-runner/test-runner.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/test-runner/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "test-runner",
  "name": "Test Runner v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Executes tests and parses results. Detects the test framework, runs the test command, and produces structured results with pass/fail counts and failure details. Never modifies files.",
  "inputs": [
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON object with testFramework, packageManager" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" },
    { "id": "testsWritten", "type": "string", "required": false, "description": "JSON array of test files to run (if absent, runs all tests)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { framework, command, passed, failed, skipped, total, duration, failures, coverage }" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 4,
    "wallClockTimeoutSeconds": 300,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["testing", "execution", "runner", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/06-specialists-verifier.md` section 6.2 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (max 4 tool calls, never modify files, never invent counts)
- Test Command Detection (vitest, jest, pytest, dotnet test, cargo test)
- Tool format for shell-execute
- Workflow (determine command, run tests, parse output, call done)
- Failure Parsing (file, test name, error, line)

### Points d'attention

1. **`maxIterations: 4`** — le spec dit "MUST call done within 4 tool calls". C'est un runner, pas un explorateur.
2. **`wallClockTimeoutSeconds: 300`** (5 minutes) — les tests peuvent prendre du temps mais pas 10 minutes.
3. **Ne JAMAIS modifier de fichiers** — ce point est critique dans le prompt. Le runner reporte, il ne corrige pas.
4. **Parsing des failures** — chaque echec doit etre structure : `{ file, test, error, line }`.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'test-runner'"
# Resultat attendu : test-runner  agent  4.0.0

# Execution directe sur un projet avec des tests existants
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run test-runner --input workingDir=C:\Meastro\packages\tui --input projectContext='{\"testFramework\":\"vitest\",\"packageManager\":\"npm\"}'"
# Resultat attendu : JSON avec passed, failed, total, failures
```

---

## Bloc 3 : e2e-tester (agent)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/agents/e2e-tester/e2e-tester.agent.block.json` | Definition du bloc |
| `content/system/blocks/agents/e2e-tester/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "e2e-tester",
  "name": "E2E Tester v4",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Tests user flows end-to-end using Playwright. Starts the dev server, navigates through the application, interacts with the UI, takes screenshots, and verifies expected behavior.",
  "inputs": [
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON object with stack, framework, devServerCommand, port" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Absolute path to the project repository" },
    { "id": "implementedSteps", "type": "string", "required": true, "description": "JSON array of implemented steps (to know what to test)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { testsRun, passed, failed, flows, failures }" }
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
    "tags": ["testing", "e2e", "playwright", "ui", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/06-specialists-verifier.md` section 6.3 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (start dev server first, accessibility-first selectors, take screenshots, max 15 tool calls, never modify code)
- Workflow (start server, wait for ready, test each flow, kill server, call done)
- Playwright Commands via maestro_cli (navigate, click, type, screenshot, accessibility tree)
- User Flow Design principles
- Selector Priority (accessibility-first hierarchy)

### Dependance critique : tool blocks Playwright

Le e2e-tester utilise les tool blocks suivants via `maestro_cli` :
- `playwright-interact` — navigate, click, type
- `playwright-screenshot` — capture screenshots
- `playwright-accessibility` — read accessibility tree
- `shell-execute` — start/kill dev server

Ces tool blocks **n'existent pas encore** — ils seront crees dans la phase 09-tool-blocks.

**Impact** : Le e2e-tester peut etre cree et son JSON/prompt valides, mais ne peut PAS etre teste fonctionnellement tant que les tool blocks Playwright n'existent pas.

**Strategie de test sans Playwright** :
- Verifier que le bloc est decouvert par `list-blocks`
- Verifier que le JSON est valide
- Verifier que le prompt est coherent (pas de references a des commandes inexistantes)
- Test fonctionnel sera fait apres creation des tool blocks Playwright

### Points d'attention

1. **`maxIterations: 15`** — les E2E tests impliquent beaucoup d'interactions (navigate, click, type, screenshot pour chaque flow).
2. **Le serveur dev doit etre demarre ET tue** — le prompt insiste sur le fait de tuer le serveur meme en cas d'echec.
3. **Selecteurs accessibility-first** — pas de CSS selectors sauf en dernier recours. Le prompt definit la hierarchie de priorite.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'e2e-tester'"
# Resultat attendu : e2e-tester  agent  4.0.0
# NOTE: Test fonctionnel impossible sans les tool blocks Playwright
```

---

## Bloc 4 : ui-reviewer (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/ui-reviewer/ui-reviewer.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/ui-reviewer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "ui-reviewer",
  "name": "UI Reviewer v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Reviews visual quality of implemented UI by analyzing screenshots and accessibility trees. Evaluates layout, alignment, spacing, color, animations, responsiveness, and accessibility. Uses vision model for screenshot analysis.",
  "inputs": [
    { "id": "screenshots", "type": "string", "required": true, "description": "JSON array of screenshot file paths captured by e2e-tester" },
    { "id": "accessibilityTree", "type": "string", "required": true, "description": "Accessibility tree of the page from playwright-accessibility" },
    { "id": "designContext", "type": "string", "required": false, "description": "JSON object with architecture.visualComponents (expected animations, components)" },
    { "id": "projectContext", "type": "string", "required": false, "description": "JSON object with CSS framework, design system info" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { score, issues, positives, accessibilityIssues }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.3,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["review", "ui", "visual", "accessibility", "vision", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/06-specialists-verifier.md` section 6.4 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, accessibility tree first, strict but fair, every issue needs a suggestion, never ignore accessibility issues)
- Evaluation Axes avec poids : Layout & Alignment (25%), Visual Design (25%), Interactions & Animations (20%), Consistency (15%), Accessibility (15%)
- Scoring scale (0.9-1.0 = exceptional, 0.8-0.89 = good, etc.)
- Accessibility Tree Analysis checklist
- Screenshot Analysis guidance
- Output format JSON

### Points d'attention

1. **Opus 4.6 OBLIGATOIRE** — ce bloc necessite la capacite de vision (analyse de screenshots) et le jugement esthetique. Sonnet n'est pas suffisant.
2. **C'est un inference block, PAS un agent** — une seule invocation LLM, pas de boucle agentic, pas de tool calls.
3. **L'accessibilite est une dimension primaire** — severity "error" par defaut pour les violations a11y. Le prompt est tres clair la-dessus.
4. **Chaque issue DOIT avoir une suggestion concrete** — "fix the alignment" n'est pas acceptable, "add items-center to the flex container" l'est.
5. **Vision model** — le modele Opus supporte l'analyse d'images. Les screenshots seront passes en tant qu'inputs au modele. L'infrastructure d'execution doit supporter le passage d'images (verifier que `LLMBlockExecutorBase` gere les inputs image).

### Note sur la capacite VISION

Le ui-reviewer est le seul bloc qui necessite un modele avec capacite vision. Si l'infrastructure d'execution ne supporte pas encore le passage d'images en input au LLM, ce bloc ne pourra pas fonctionner pleinement. Dans ce cas :
- Le bloc peut quand meme analyser l'accessibility tree (texte pur)
- L'analyse des screenshots sera degradee (le modele recevra les chemins mais pas les images)
- **Ceci est une limitation connue** a documenter, pas un bloquant pour la creation du bloc

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'ui-reviewer'"
# Resultat attendu : ui-reviewer  inference  4.0.0

# Test avec donnees simulees (sans screenshots reels)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run ui-reviewer --input screenshots='[\"screenshot-1.png\"]' --input accessibilityTree='<tree><button name=\"Submit\"/></tree>'"
# Resultat attendu : JSON avec score, issues, positives, accessibilityIssues
```

---

## Bloc 5 : accessibility-checker (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/accessibility-checker/accessibility-checker.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/accessibility-checker/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "accessibility-checker",
  "name": "Accessibility Checker v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Audits web pages for WCAG 2.1 AA compliance by analyzing the accessibility tree and optionally HTML source. Identifies violations, suggests fixes, and scores overall accessibility.",
  "inputs": [
    { "id": "accessibilityTree", "type": "string", "required": true, "description": "Complete accessibility tree of the page" },
    { "id": "htmlSource", "type": "string", "required": false, "description": "HTML source code of the page (optional, for deeper analysis)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { score, level, violations, passes, incomplete }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-sonnet-4-6",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["accessibility", "wcag", "a11y", "audit", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/06-specialists-verifier.md` section 6.5 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, every violation references WCAG criterion, every violation includes fix, based on WCAG AA, mark "incomplete" if unsure)
- WCAG 2.1 AA Checks complet : Perceivable (1.1.1, 1.3.1, 1.4.1, 1.4.3, 1.4.4), Operable (2.1.1, 2.4.1-2.4.6), Understandable (3.1.1, 3.2.1, 3.3.1, 3.3.2), Robust (4.1.1, 4.1.2)
- Scoring scale
- Output format JSON

### Points d'attention

1. **Sonnet 4.6 suffit** — l'analyse d'accessibilite est structurelle (arbre + HTML), pas visuelle. Pas besoin d'Opus.
2. **`temperature: 0.2`** — scoring deterministe, pas creatif.
3. **Chaque violation DOIT avoir** : `wcag` (numero de critere), `severity`, `element`, `description`, `fix`.
4. **La categorie "incomplete"** est importante — si le checker ne peut pas determiner la conformite (ex: contraste de couleurs depuis l'arbre seul), il doit le dire honnetement, pas deviner.

### Differences vs ui-reviewer

| Aspect | ui-reviewer | accessibility-checker |
|--------|-------------|----------------------|
| Modele | Opus 4.6 (vision) | Sonnet 4.6 (texte) |
| Scope | Visual quality + accessibilite | Accessibilite WCAG uniquement |
| Inputs | Screenshots + accessibility tree | Accessibility tree + HTML source |
| Profondeur a11y | Surface (15% du score) | Complete (WCAG 2.1 AA full audit) |

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'accessibility-checker'"
# Resultat attendu : accessibility-checker  inference  4.0.0

# Test avec un arbre d'accessibilite simule
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run accessibility-checker --input accessibilityTree='<tree><heading level=1>Page Title</heading><img src=\"avatar.png\"/><button>Submit</button></tree>'"
# Resultat attendu : JSON avec score, level, violations (img sans alt), passes, incomplete
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

1. **test-writer** — pas de dependance directe
2. **test-runner** — independant (execute des tests, ne depend pas de test-writer pour fonctionner)
3. **e2e-tester** — depend des tool blocks Playwright (09-tool-blocks) — creation du JSON/prompt possible, test fonctionnel bloque
4. **accessibility-checker** — independant (analyse de texte)
5. **ui-reviewer** — depend de e2e-tester (screenshots) et accessibility-checker (accessibility tree) pour un test reel, mais peut etre teste avec des donnees simulees

### Workflow de test chaine (phase VERIFIER complete)

```bash
cd C:\Meastro\packages\maestro-cli

# 1. Tester test-writer sur un projet reel
node index.js run test-writer \
  --input workingDir=C:\SomeTestProject \
  --input implementedSteps='[{"id":"1","file":"src/utils.ts","action":"create"}]' \
  --input projectContext='{"testFramework":"vitest","conventions":{"testDir":"__tests__"}}'
# Capturer la sortie (testsWritten)

# 2. Tester test-runner sur le meme projet
node index.js run test-runner \
  --input workingDir=C:\SomeTestProject \
  --input projectContext='{"testFramework":"vitest","packageManager":"npm"}'
# Verifier passed/failed/total

# 3. Tester accessibility-checker avec un arbre simule
node index.js run accessibility-checker \
  --input accessibilityTree='<tree><heading level=1>Title</heading><img/><button>OK</button></tree>'
# Verifier que l'img sans alt est detectee

# 4. Tester ui-reviewer avec des donnees simulees
node index.js run ui-reviewer \
  --input screenshots='["test-screenshot.png"]' \
  --input accessibilityTree='<tree><heading level=1>Title</heading></tree>' \
  --input designContext='{"hasUI":true}' \
  --input projectContext='{"cssFramework":"tailwind"}'

# 5. e2e-tester — TEST BLOQUE jusqu'a creation des tool blocks Playwright
```

---

## Criteres de qualite (QualityScore)

Chaque bloc est evalue sur P (Performance) et W (Composabilite) :

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| test-writer | % de tests ecrits qui passent (pas de syntax errors) | >= 0.85 | JSON valide, tests sans imports hallucines | >= 0.90 |
| test-runner | Parsing correct des resultats sur 10 executions variees | >= 0.90 | JSON valide, compteurs exacts (pas inventes) | >= 0.95 |
| e2e-tester | % de flows testes qui refletent de vrais parcours utilisateur | >= 0.80 | JSON valide, screenshots reellement captures | >= 0.90 |
| ui-reviewer | Correlation avec l'evaluation humaine sur 20 UI reviews | >= 0.80 | JSON valide, chaque issue a une suggestion concrete | >= 0.95 |
| accessibility-checker | Detection des violations WCAG reelles (compare a axe-core) | >= 0.85 | JSON valide, chaque violation a wcag + fix | >= 0.95 |

### Test de P : 3 scenarios minimum par bloc

#### test-writer

1. **Simple** : Un seul fichier utilitaire (pure functions) dans un projet vitest
2. **Modere** : 3 fichiers (service + component + utility) dans un projet React + vitest
3. **Complexe** : Module avec dependances externes (API calls, file system) necessitant du mocking

#### test-runner

1. **Simple** : Projet vitest avec 5 tests qui passent
2. **Modere** : Projet vitest avec 10 tests dont 2 echecs — verifier le parsing des failures
3. **Complexe** : Projet pytest (Python) — verifier la detection de framework et le parsing different

#### e2e-tester (apres creation des tool blocks)

1. **Simple** : Une page statique — navigate + screenshot
2. **Modere** : Formulaire de creation — navigate, type, submit, verify
3. **Complexe** : Flow multi-pages — creation + listing + suppression

#### ui-reviewer

1. **Simple** : Screenshot d'une page propre + accessibility tree complet — score attendu >= 0.85
2. **Modere** : Screenshot avec problemes d'alignement + arbre avec images sans alt — score attendu 0.6-0.75
3. **Complexe** : Multiple screenshots (avant/apres interaction) + arbre avec violations multiples

#### accessibility-checker

1. **Simple** : Arbre propre (headings ordonnes, labels, alt text) — score attendu >= 0.90
2. **Modere** : Arbre avec 2-3 violations (img sans alt, heading skip h1->h3) — score attendu 0.7-0.8
3. **Complexe** : Arbre avec violations multiples + HTML source — verifier la profondeur de l'audit

### Test de W : verification automatisee

```bash
# Verifier que la sortie est du JSON valide pour chaque bloc
node index.js run test-writer --input ... 2>/dev/null | python -m json.tool
node index.js run test-runner --input ... 2>/dev/null | python -m json.tool
node index.js run accessibility-checker --input ... 2>/dev/null | python -m json.tool
node index.js run ui-reviewer --input ... 2>/dev/null | python -m json.tool
# Si la commande echoue -> W = 0 pour cette execution
```

---

## Erreurs courantes a eviter

1. **Mettre `config.systemPrompt` inline pour les inference blocks** — les prompts de cette phase sont LONGS (60+ lignes). Utiliser `config.systemPromptFile: "system-prompt.md"` avec un fichier externe. Ne PAS mettre tout le texte inline dans le JSON.
2. **Utiliser des model IDs incorrects** — c'est `claude-sonnet-4-6` (pas `sonnet`), `claude-opus-4-6` (pas `opus`).
3. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet.
4. **Mettre `isAtomic: false`** — les agents ET les inference blocks sont atomiques (`true`). Seuls les workflows sont `false`.
5. **Ne pas tester** — creer le fichier JSON ne suffit pas. Verifier que le backend decouvre le bloc ET que l'execution produit un resultat valide.
6. **Confondre agent et inference** — test-writer, test-runner, e2e-tester sont des AGENTS (boucle agentic, tool calls). ui-reviewer et accessibility-checker sont des INFERENCE blocks (un seul appel LLM, pas de tools).
7. **Mettre `designation: "autonomous"` sur les inference blocks** — ce champ est pour les agents. Les inference blocks n'ont pas de `designation` dans leur metadata (ou l'omettre).
8. **Oublier que ui-reviewer necessite Opus** — c'est le seul inference block de cette phase sur Opus (les autres sont sur Sonnet). La raison est la capacite vision pour analyser les screenshots.
9. **Placer les inference blocks dans `agents/`** — les inference blocks vont dans `content/system/blocks/inference/<block-id>/`, PAS dans `agents/`.
10. **Copier le prompt du spec sans verifier** — les commandes maestro_cli dans le prompt (surtout pour e2e-tester) doivent correspondre aux tool blocks reels qui seront crees.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan F — VERIFIER] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan F : Specialists VERIFIER
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 5
  - test-writer : CREE / TESTE / PUBLIE / VALIDE
  - test-runner : CREE / TESTE / PUBLIE / VALIDE
  - e2e-tester : CREE / TESTE_PARTIEL (tool blocks Playwright manquants) / PUBLIE / VALIDE
  - ui-reviewer : CREE / TESTE / PUBLIE / VALIDE
  - accessibility-checker : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - test-writer : _/0.85
  - test-runner : _/0.90
  - e2e-tester : _/0.80 (bloque)
  - ui-reviewer : _/0.80
  - accessibility-checker : _/0.85
**W score** :
  - test-writer : _/0.90
  - test-runner : _/0.95
  - e2e-tester : _/0.90 (bloque)
  - ui-reviewer : _/0.95
  - accessibility-checker : _/0.95
**Dependances bloquantes** :
  - e2e-tester attend tool blocks Playwright (09-tool-blocks)
  - ui-reviewer vision: verifier que l'infrastructure gere les inputs image
**Problemes** : [si BLOQUE]
```
