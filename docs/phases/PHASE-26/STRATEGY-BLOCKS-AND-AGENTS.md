# Phase 26 — Strategie detaillee : Blocks et Agents

## Vue d'ensemble

```
autonomous-developer (Layer 4)
├── implement-feature workflow (Layer 3)
│   ├── planner-agent (Layer 2)
│   │   ├── context-builder (L1)
│   │   ├── convention-reader (L1)
│   │   ├── project-structure (L0)
│   │   └── code-analyzer (L1)
│   ├── coder-agent (Layer 2)
│   │   ├── context-builder (L1)
│   │   ├── code-generator (L1)
│   │   ├── file-write (L0)
│   │   └── typescript-check (L0)
│   ├── tester-agent (Layer 2)
│   │   ├── test-generator (L1)
│   │   ├── file-write (L0)
│   │   ├── test-runner (L0)
│   │   └── npm-run (L0)
│   ├── reviewer-agent (Layer 2)
│   │   ├── git-diff (L0)
│   │   ├── code-reviewer (L1)
│   │   └── convention-reader (L1)
│   └── git-agent (Layer 2)
│       ├── git-status (L0)
│       ├── commit-writer (L1)
│       ├── pr-writer (L1)
│       └── shell-execute (L0)
├── fix-bug workflow (Layer 3)
│   └── (meme agents, ordre different)
└── setup-project workflow (Layer 3)
    ├── convention-reader (L1)
    ├── dependency-manager (L1)
    ├── file-scaffolder (L1)
    └── typescript-check (L0)
```

---

## Layer 1 — Outils Atomiques (10 blocks)

### 1.1 context-builder

> **Le block le plus important du systeme.** Les petits modeles ont un contexte limite.
> Ce block decide quels fichiers sont pertinents pour une tache donnee.

```json
{
  "id": "context-builder",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Context Builder",
  "version": "1.0.0",
  "description": "Builds focused context for LLM inference by selecting relevant files from a project",
  "inputs": [
    { "id": "projectPath", "type": "string", "required": true, "description": "Root path of the project" },
    { "id": "task", "type": "string", "required": true, "description": "Description of the task to accomplish" },
    { "id": "maxTokens", "type": "number", "required": false, "description": "Maximum token budget for context (default: 1500)" },
    { "id": "focusFiles", "type": "array", "required": false, "description": "Specific files to prioritize" }
  ],
  "outputs": [
    { "id": "context", "type": "string", "description": "Assembled context string ready for LLM prompt" },
    { "id": "filesIncluded", "type": "array", "description": "List of files included in context" }
  ]
}
```

**Implementation interne :**
1. `project-structure` → arbre du projet
2. `file-read` → lire README.md, CLAUDE.md, package.json (config de base)
3. Heuristique : si `task` mentionne un fichier, le lire en priorite
4. Si `focusFiles` fourni, les lire
5. Assembler : structure + config + fichiers pertinents, tronquer a `maxTokens`

**Fitness criteria :**
- Le contexte contient les fichiers necessaires (recall)
- Le contexte ne depasse pas maxTokens (constraint)
- Le contexte est coherent (pas de coupure au milieu d'une fonction)

**Prompt strategy :**
Pas de LLM ici — c'est un outil deterministe. Selection par heuristiques (mots-cles dans la tache matchent les noms de fichiers/dossiers).

---

### 1.2 convention-reader

> Lit les fichiers de conventions d'un projet et produit un resume structure.

```json
{
  "id": "convention-reader",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Convention Reader",
  "inputs": [
    { "id": "projectPath", "type": "string", "required": true }
  ],
  "outputs": [
    { "id": "conventions", "type": "string", "description": "Structured summary of project conventions" },
    { "id": "language", "type": "string", "description": "Primary language detected" },
    { "id": "framework", "type": "string", "description": "Framework detected" }
  ]
}
```

**Implementation :**
1. Chercher : README.md, CLAUDE.md, .editorconfig, tsconfig.json, eslint*, prettier*, package.json
2. Extraire : langage, framework, conventions de nommage, architecture
3. Produire un resume concis (< 500 tokens)

**Deterministe** — pas de LLM, lecture + extraction.

---

### 1.3 code-generator

> Genere du code en suivant des conventions et un contexte.

```json
{
  "id": "code-generator",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Code Generator",
  "inputs": [
    { "id": "task", "type": "string", "required": true, "description": "What code to generate" },
    { "id": "context", "type": "string", "required": true, "description": "Project context (from context-builder)" },
    { "id": "conventions", "type": "string", "required": false, "description": "Conventions to follow" },
    { "id": "outputPath", "type": "string", "required": true, "description": "Target file path" },
    { "id": "model", "type": "string", "required": false }
  ],
  "outputs": [
    { "id": "code", "type": "string", "description": "Generated code" },
    { "id": "explanation", "type": "string", "description": "Brief explanation of what was generated" }
  ]
}
```

**LLM Prompt Template :**
```
System: You are a code generator. Output ONLY valid TypeScript code. No explanations, no markdown fences.

Conventions:
{{conventions}}

Project context:
{{context}}

Example output format:
import { something } from './somewhere';

export function myFunction(): string {
  return 'value';
}

Task: {{task}}

Generate the code for {{outputPath}}:
```

**Temperature :** 0.3
**Fitness criteria :**
- `validSyntax` — le code parse sans erreur
- `followsConventions` — imports, nommage, structure coherents
- `completeness` — le code repond a la tache

---

### 1.4 test-generator

> Genere des tests unitaires pour un fichier source.

```json
{
  "id": "test-generator",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Test Generator",
  "inputs": [
    { "id": "sourceFile", "type": "string", "required": true, "description": "Path to file to test" },
    { "id": "sourceContent", "type": "string", "required": true, "description": "Content of the source file" },
    { "id": "testFramework", "type": "string", "required": false, "description": "jest, vitest, mocha (default: jest)" },
    { "id": "conventions", "type": "string", "required": false }
  ],
  "outputs": [
    { "id": "testCode", "type": "string" },
    { "id": "testPath", "type": "string" }
  ]
}
```

**LLM Prompt Template :**
```
System: You are a test writer. Output ONLY valid test code. No explanations.

Source file ({{sourceFile}}):
{{sourceContent}}

Test framework: {{testFramework}}

Example test format:
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('output');
  });
});

Generate tests for this file:
```

**Temperature :** 0.3
**Fitness :** Tests compilent, couvrent les exports principaux, assertions valides.

---

### 1.5 code-analyzer

> Analyse un fichier : structure, imports, exports, patterns, issues potentielles.

```json
{
  "id": "code-analyzer",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Code Analyzer",
  "inputs": [
    { "id": "filePath", "type": "string", "required": true },
    { "id": "content", "type": "string", "required": true }
  ],
  "outputs": [
    { "id": "analysis", "type": "object", "description": "{ imports, exports, functions, classes, issues, lineCount }" }
  ]
}
```

**Deterministe** — parsing AST-like via regex (pas de LLM). Extraire :
- Liste des imports
- Liste des exports
- Signatures des fonctions/classes
- Nombre de lignes
- Issues basiques (TODO, FIXME, fichier vide, imports non utilises)

---

### 1.6 code-reviewer

> Review du code : qualite, conventions, issues.

```json
{
  "id": "code-reviewer",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Code Reviewer",
  "inputs": [
    { "id": "code", "type": "string", "required": true },
    { "id": "conventions", "type": "string", "required": false },
    { "id": "task", "type": "string", "required": false, "description": "What the code is supposed to do" }
  ],
  "outputs": [
    { "id": "approved", "type": "boolean" },
    { "id": "issues", "type": "array", "description": "List of { severity, message, line }" },
    { "id": "score", "type": "number", "description": "Quality score 0-1" }
  ]
}
```

**LLM Prompt :**
```
System: You are a code reviewer. Output ONLY a JSON object with this exact format:
{"approved": true/false, "issues": [{"severity": "error|warning|info", "message": "..."}], "score": 0.0-1.0}

Conventions: {{conventions}}
Task: {{task}}

Code to review:
{{code}}

Review (JSON only):
```

**Temperature :** 0.2
**Fitness :** JSON valide, issues pertinentes, score coherent avec la qualite.

---

### 1.7 commit-writer

> Ecrit un message de commit conventionnel a partir d'un diff.

```json
{
  "id": "commit-writer",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Commit Message Writer",
  "inputs": [
    { "id": "diff", "type": "string", "required": true },
    { "id": "conventions", "type": "string", "required": false }
  ],
  "outputs": [
    { "id": "message", "type": "string" }
  ]
}
```

**LLM Prompt :**
```
System: Write a conventional commit message. Format: type(scope): description
Types: feat, fix, refactor, test, docs, chore, style
Output ONLY the commit message, nothing else.

Example: feat(editor): add file tree component with keyboard navigation

Diff:
{{diff}}

Commit message:
```

**Temperature :** 0.3
**Fitness :** Format conventionnel, scope correct, description pertinente.

---

### 1.8 pr-writer

> Ecrit une description de PR.

```json
{
  "id": "pr-writer",
  "blockType": "tool",
  "isAtomic": true,
  "name": "PR Description Writer",
  "inputs": [
    { "id": "commits", "type": "string", "required": true, "description": "Commit log" },
    { "id": "diffSummary", "type": "string", "required": false }
  ],
  "outputs": [
    { "id": "title", "type": "string" },
    { "id": "body", "type": "string" }
  ]
}
```

**LLM Prompt :**
```
System: Write a PR title and body. Output ONLY JSON: {"title": "...", "body": "## Summary\n..."}
Title: under 70 chars. Body: markdown with Summary and Changes sections.

Commits:
{{commits}}

PR description (JSON only):
```

**Temperature :** 0.3

---

### 1.9 file-scaffolder

> Cree une structure de fichiers selon un template.

```json
{
  "id": "file-scaffolder",
  "blockType": "tool",
  "isAtomic": true,
  "name": "File Scaffolder",
  "inputs": [
    { "id": "basePath", "type": "string", "required": true },
    { "id": "structure", "type": "object", "required": true, "description": "{ 'src/module/index.ts': 'content', ... }" }
  ],
  "outputs": [
    { "id": "created", "type": "array", "description": "List of files created" }
  ]
}
```

**Deterministe** — pas de LLM. Cree les dossiers et fichiers specifies.

---

### 1.10 dependency-manager

> Execute des commandes de gestion de dependances.

```json
{
  "id": "dependency-manager",
  "blockType": "tool",
  "isAtomic": true,
  "name": "Dependency Manager",
  "inputs": [
    { "id": "projectPath", "type": "string", "required": true },
    { "id": "command", "type": "string", "required": true, "description": "install | add | remove" },
    { "id": "packages", "type": "array", "required": false }
  ],
  "outputs": [
    { "id": "success", "type": "boolean" },
    { "id": "output", "type": "string" }
  ]
}
```

**Deterministe** — execute `npm install`, `npm add <pkg>`, `npm remove <pkg>` via `shell-execute`.

---

## Layer 2 — Agents Specialises (5 agents)

### 2.1 planner-agent

> Analyse une tache et produit un plan d'execution structure.

**Workflow interne :**
```
1. context-builder(projectPath, task)           → context
2. convention-reader(projectPath)               → conventions
3. project-structure(projectPath)               → structure
4. code-analyzer(fichiers pertinents)           → analyses
5. LLM inference: Produire le plan              → plan JSON
```

**Prompt LLM (etape 5) :**
```
System: You are a task planner. Given a project context and a task, produce a step-by-step implementation plan.
Output ONLY JSON: {"steps": [{"id": 1, "action": "create|modify|delete", "file": "path", "description": "what to do"}]}

Project structure:
{{structure}}

Conventions:
{{conventions}}

Context:
{{context}}

Task: {{task}}

Example plan:
{"steps": [
  {"id": 1, "action": "create", "file": "src/components/FileTree.tsx", "description": "Create file tree component with recursive directory rendering"},
  {"id": 2, "action": "modify", "file": "src/App.tsx", "description": "Import and add FileTree to sidebar panel"}
]}

Plan (JSON only):
```

**Temperature :** 0.3
**Fitness :** Plan est JSON valide, etapes sont logiques, fichiers existent ou sont creables.

---

### 2.2 coder-agent

> Implemente du code selon un plan, un fichier a la fois.

**Workflow interne (pour chaque etape du plan) :**
```
1. context-builder(projectPath, step.description, focusFiles=[step.file])  → context
2. convention-reader(projectPath)                                          → conventions
3. code-generator(task=step.description, context, conventions, step.file)  → code
4. file-write(step.file, code)                                             → written
5. typescript-check(projectPath)                                           → result
6. Si erreur → code-generator(task="Fix: " + erreur, ...) → retry (max 3)
```

**Strategie :** Un fichier a la fois. Verifier apres chaque ecriture. Retry si erreur.

---

### 2.3 tester-agent

> Ecrit des tests et les execute.

**Workflow interne :**
```
1. file-read(sourceFile)                                → sourceContent
2. test-generator(sourceFile, sourceContent, framework)  → testCode, testPath
3. file-write(testPath, testCode)                        → written
4. test-runner(projectPath, testPath)                    → results
5. Si echec → test-generator(avec feedback d'erreur)     → retry (max 3)
```

---

### 2.4 reviewer-agent

> Review les changements avant commit.

**Workflow interne :**
```
1. git-diff(projectPath)                    → diff
2. convention-reader(projectPath)           → conventions
3. Pour chaque fichier modifie:
   a. file-read(filePath)                   → content
   b. code-reviewer(content, conventions)   → review
4. Agreger les reviews                      → rapport final
5. Si issues critiques → retourner echec
```

---

### 2.5 git-agent

> Gere les operations git.

**Workflow interne :**
```
1. git-status(projectPath)              → status
2. git-diff(projectPath)                → diff
3. commit-writer(diff, conventions)     → message
4. shell-execute("git add -A")          → staged
5. shell-execute("git commit -m ...")   → committed
6. Si PR demande:
   a. git-log(depuis derniere PR)       → commits
   b. pr-writer(commits, diff)          → title, body
   c. shell-execute("gh pr create ...") → PR URL
```

---

## Layer 3 — Workflows (3 workflows)

### 3.1 implement-feature

```json
{
  "config": {
    "nodes": [
      {
        "id": "plan",
        "type": "phase",
        "configSection": "planning",
        "blockRef": "planner-agent"
      },
      {
        "id": "implement",
        "type": "for-each",
        "source": "_planSteps",
        "configSection": "coding",
        "blockRef": "coder-agent"
      },
      {
        "id": "test",
        "type": "phase",
        "configSection": "testing",
        "blockRef": "tester-agent"
      },
      {
        "id": "review",
        "type": "phase",
        "configSection": "reviewing",
        "blockRef": "reviewer-agent"
      },
      {
        "id": "commit",
        "type": "conditional",
        "condition": "reviewPassed == true",
        "then": { "blockRef": "git-agent" },
        "else": { "blockRef": "coder-agent", "note": "fix issues, retry" }
      }
    ]
  }
}
```

**Flow :**
1. **Planning** : planner-agent analyse la tache → plan stocke dans `_planSteps`
2. **Implementation** : coder-agent execute chaque etape du plan (for-each)
3. **Testing** : tester-agent ecrit et execute les tests
4. **Review** : reviewer-agent valide le code
5. **Commit** : Si review OK → git-agent commit + optionnel PR

### 3.2 fix-bug

```
1. code-analyzer → identifier le probleme
2. planner-agent → plan de correction
3. coder-agent → appliquer le fix
4. tester-agent → verifier le fix + regression
5. git-agent → commit
```

### 3.3 setup-project

```
1. convention-reader → comprendre le projet
2. dependency-manager → npm install
3. file-scaffolder → creer la structure manquante
4. typescript-check → verifier
```

---

## Layer 4 — Agent Autonome

### autonomous-developer

**Workflow interne :**
```
1. COMPRENDRE
   ├── convention-reader(projectPath)
   ├── project-structure(projectPath)
   └── context-builder(projectPath, task)

2. PLANIFIER
   └── planner-agent(task, context)  → plan global

3. EXECUTER (for-each sur plan global)
   ├── Si step.type == "feature" → implement-feature workflow
   ├── Si step.type == "fix" → fix-bug workflow
   └── Si step.type == "setup" → setup-project workflow

4. VALIDER
   ├── typescript-check → compilation OK?
   ├── test-runner → tests passent?
   └── reviewer-agent → qualite OK?

5. ITERER (while: !validated, max: 3)
   └── Ajuster et re-executer les etapes echouees

6. LIVRER
   └── git-agent → commit final + PR
```

---

## Strategie d'entrainement

### Phase A — Tools individuels (2-3 jours)

Pour chaque tool de Layer 1 :
1. Creer le `*.block.json`
2. Placer dans `content/system/blocks/tools/`
3. Creer une session de test via template
4. Tester avec `maestro test start <tool-id> --iterations 10`
5. Mesurer le fitness
6. Si fitness < 0.7 : ajuster le prompt, temperature, few-shot examples
7. Repeter jusqu'a fitness >= 0.8

**Ordre de creation :** Deterministes d'abord (pas de LLM, plus faciles a valider)
1. `convention-reader` (deterministe)
2. `code-analyzer` (deterministe)
3. `file-scaffolder` (deterministe)
4. `dependency-manager` (deterministe)
5. `context-builder` (deterministe + heuristiques)
6. `commit-writer` (LLM, simple)
7. `pr-writer` (LLM, simple)
8. `code-reviewer` (LLM, moyen)
9. `code-generator` (LLM, complexe)
10. `test-generator` (LLM, complexe)

### Phase B — Agents (3-5 jours)

Pour chaque agent de Layer 2 :
1. Creer le block agent avec workflow interne
2. Tester sur une tache simple dans Cantante
3. Mesurer : le resultat est-il correct? Les tools sont-ils bien coordonnes?
4. Ajuster la coordination, les prompts de selection d'outils

**Premiere tache de test par agent :**
- `planner-agent` : "Planifier l'ajout d'un fichier vide src/core/types.ts"
- `coder-agent` : "Creer src/core/types.ts avec une interface AppConfig"
- `tester-agent` : "Ecrire un test pour src/core/config.ts"
- `reviewer-agent` : "Review les changements courants"
- `git-agent` : "Commiter les changements avec un message conventionnel"

### Phase C — Workflows (3-5 jours)

Tester des features completes dans Cantante :
1. `setup-project` : Initialiser Cantante (npm install, verifier structure)
2. `fix-bug` : Corriger renderer.ts
3. `implement-feature` : Ajouter un module file-manager

### Phase D — Autonome (ongoing)

Donner des taches de plus en plus complexes a l'`autonomous-developer` :
1. "Install the project dependencies"
2. "Fix the broken renderer.ts file"
3. "Replace the audio player HTML with a basic code editor skeleton"
4. "Add a file tree component in the sidebar"
5. "Implement basic TTS accessibility for screen readers"

---

## Gestion du contexte

### Principe : Minimum viable context

Chaque inference LLM recoit le MINIMUM de contexte necessaire :

| Type d'inference | Contexte type | Budget tokens |
|-----------------|---------------|---------------|
| Commit message | Diff uniquement | 500 |
| Code review | Code + conventions | 800 |
| Code generation | Contexte + conventions + tache + exemple | 1200 |
| Test generation | Source file + framework example | 1000 |
| Planning | Structure + conventions + tache | 1000 |

### Hierarchie de contexte

```
Niveau 1 (toujours inclus) : Tache + format de sortie attendu
Niveau 2 (si disponible) : Conventions du projet (resume)
Niveau 3 (si pertinent) : Fichiers directement impliques
Niveau 4 (si budget reste) : Structure du projet
Niveau 5 (rarement) : Historique git recent
```

### Few-shot examples (OBLIGATOIRE)

Chaque prompt LLM DOIT inclure un exemple concret du format attendu. Pas d'instruction abstraite. Recherche Phase 13 : "make compact" = 0% fitness, "shorten to 5 words" = 39%.

---

## Sessions et Workspaces

### Workspace : cantante-dev

```bash
maestro workspace create --name "cantante-dev" --path "C:\Cantante"
maestro workspace bind cantante-dev --path "C:\Cantante"
```

### Session : tool-training

Une session par tool pour entrainement :
```bash
maestro session create --name "train-commit-writer" --type foundry
maestro session import-template <id> foundry-training
maestro session set-var <id> _targetBlock "commit-writer"
maestro session start <id>
```

### Session : cantante-development

Session principale pour le developpement Cantante :
```bash
maestro session create --name "cantante-v1" --type foundry
maestro session set-var <id> projectPath "C:\Cantante"
maestro session set-var <id> currentFeature "..."
```

---

## Anticipation des features manquantes

| Feature potentiellement manquante | Impact | Contournement |
|----------------------------------|--------|---------------|
| Chainage automatique output→input entre blocks | Eleve | Passer les outputs via variables de session |
| Block "context-builder" n'existe pas encore | Critique | Le creer en premier |
| Validation de syntaxe integree (AST) | Moyen | Utiliser `typescript-check` + shell execute |
| Gestion des retries dans les workflows | Moyen | Utiliser `while` node avec condition |
| Human-in-the-loop (demander a l'utilisateur) | Moyen | Utiliser session variables + pause |
| Metriques de qualite de code | Faible | Utiliser le score du `code-reviewer` |
| Pipeline de CI/CD integre | Faible | Utiliser shell-execute pour les commandes |

---

## Calendrier previsionnel

| Semaine | Objectif |
|---------|----------|
| S1 | Creer les 5 outils deterministes (L1) + tester |
| S2 | Creer les 5 outils LLM (L1) + entrainer + tester |
| S3 | Creer les 5 agents (L2) + tester sur Cantante |
| S4 | Creer les 3 workflows (L3) + tester sur features Cantante |
| S5 | Creer l'orchestrateur (L4) + tester sur taches completes |
| S6+ | Iterer, optimiser, developper Cantante |
