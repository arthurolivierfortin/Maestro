# Phase 30 — Plan detaille

**Date** : 2026-02-17
**Objectif** : Premier agent autonome fonctionnel → CLI `maestro code` → Optimisation multi-tiers

---

## Vue d'ensemble

```
Phase 30   │  Premier agent autonome composite (Tier 1, Claude, qualite 100%)
    │        Prouver que la specialisation et la composition fonctionnent.
    ▼
Phase 31   │  CLI `maestro code` (teste avec l'agent Tier 1)
    │
    ▼
Phase 32   │  Optimisation multi-tiers (Tier 1→5) + manifeste
    │
    ▼
Phase 33   │  Agent Creator + meta-optimisation (`adapt`, `optimize`)
```

**Philosophie** : bottom-up, un delivrable concret par phase, chaque phase est utilisable avant de passer a la suivante.

---

## Phase 30 : Premier agent autonome

### Decision architecturale : agent COMPOSITE pour prouver la philosophie Maestro

La proposition de valeur de Maestro n'est pas d'etre un wrapper autour de Claude. C'est :
1. **La specialisation du contexte** — chaque sous-agent a exactement le contexte dont il a besoin
2. **La decomposition elimine le probleme de context window** — meme Opus a une limite
3. **Chaque bloc est remplacable** — c'est ce qui permet la Phase 32 (optimization par bloc)
4. **La composition prouve l'architecture** — si ca marche avec 7 blocs, ca marchera avec 70

Le Tier 1 utilise les meilleurs modeles Claude pour maximiser la qualite, mais la structure composite est la des le debut. C'est ce qui differencie Maestro d'un simple chat Claude.

### Architecture du Tier 1

```
autonomous-dev (workflow composite, orchestrateur)
│
├── prepare (agent, Opus)
│   Lit le projet, cree les docs .maestro/ manquants,
│   detecte stack/conventions, note les questions pour l'utilisateur
│
├── plan (agent, Opus)
│   Decompose la tache en sous-taches ordonnees
│   Separe frontend/backend/tests/docs
│   Produit un JSON array de steps
│
├── for-each step dans le plan :
│   └── implement-step (agent, Sonnet)
│       Implemente UNE sous-tache
│       Context chirurgical : seulement les fichiers pertinents
│       Verifie (type check, lint)
│
├── test (agent, Sonnet)
│   Execute la suite de tests complete
│   Parse les resultats, identifie les echecs
│
├── review (inference, Opus)
│   Review holiste de TOUS les changements
│   Score, issues, suggestions
│
├── conditional : score >= 0.8 ?
│   ├── oui → commit
│   └── non → fix (reimplemente les issues, max 2 fois)
│
└── commit (agent, Sonnet)
    Git add selectif, message conventionnel, commit
```

**Choix des modeles :**

| Bloc | Modele | Raison |
|------|--------|--------|
| prepare | Opus | Comprendre tout le projet, creer de la documentation de qualite |
| plan | Opus | Decomposition strategique, necessite une vision d'ensemble |
| implement-step | Sonnet | Code focus, une seule tache, Sonnet est excellent pour ca |
| test | Sonnet | Execution + interpretation, Sonnet suffit |
| review | Opus | Vision holiste de tous les changements |
| commit | Sonnet | Simple mais doit etre precis |

---

### 30-A : Nettoyage et infrastructure

> Prerequis avant tout travail. Nettoyer la dette technique et preparer l'infrastructure.

#### Issue 30-A-1 : Supprimer les fichiers agents legacy

**Fichiers a supprimer** (13 fichiers loose dans `content/system/blocks/agents/`) :
```
autonomous-programmer.agent.block.json
autonomous-programmer.agent.json
cantante-audio-developer.agent.block.json
cantante-developer.agent.block.json
cantante-simple-dev.agent.block.json
cantante-smollm.agent.block.json
cantante-ui-developer.agent.block.json
code-developer.agent.block.json
result-validator.agent.block.json
simple-task-executor.agent.block.json
task-decomposer.agent.block.json
test-pipeline-agent.agent.block.json
ui-feature-developer.agent.block.json
```

**Dossiers vestiges a supprimer** (7 dossiers) :
```
coder-agent/
git-agent/
planner-agent/
reviewer-agent/
tester-agent/
fix-bug/
implement-feature/
```

**Blocs prematures a supprimer** (Phase 33, pas Phase 30) :
```
agent-creator/
agent-assembler/
understand-request/
design-architecture/
block-generator/
training-orchestrator/
code-implementer/        (for-each composite, remplace par implement-single-step)
workflow-state-manager/  (state manager, Phase 31)
```

**Garder** (utilises par le Tier 1 composite) :
```
autonomous-dev/          → orchestrateur, sera reecrit
project-preparer/        → prepare
context-analyzer/        → fusionne avec prepare ou garde pour Phase 32
task-planner/            → plan
implement-single-step/   → implement-step (dans la boucle for-each)
test-executor/           → test
git-committer/           → commit
interaction-handler/     → garde pour Phase 31 (maestro code)
```

**Garder** (inference, deja fonctionnel) :
```
content/system/blocks/inference/code-reviewer/  → review
```

**Verification** : `ls content/system/blocks/agents/` ne montre que les dossiers necessaires.

---

#### Issue 30-A-2 : Debugger le bug tools-in-session-context

**Symptome** : `directory-list`, `file-read`, `shell-execute` retournent vide quand invoques via `session invoke` → `EntryPointExecutor` → `AgentBlockExecutor` → `ICliExecutor`.

**Approche de debug** :
1. Ajouter du logging dans `CliExecutor.ExecuteAsync()` : arguments passes, working dir, stdout length, stderr
2. Comparer le flow entre `node index.js run <block>` (qui fonctionne) et le path session
3. Verifier si `Process.Start` recoit les memes variables d'environnement dans les deux cas
4. Tester avec un tool simple d'abord (file-read d'un fichier connu) avant les agents

**Critere de reussite** : `session invoke` → un agent agent lit un fichier du repo et retourne son contenu.

**Ce bug est BLOQUANT pour la suite.** Pas de contournement. Il doit etre corrige.

---

#### Issue 30-A-3 : Infrastructure for-each sur donnees dynamiques

Le plan produit un JSON array de steps. Le for-each handler lit une variable de session qui doit etre une liste. Probleme : `_nodeResult_plan` est un string (la sortie brute du LLM).

**Solution** : Ajouter dans le for-each handler de `EntryPointExecutor` une tentative de parsing JSON si la variable source est un string :

```csharp
// Dans ExecuteForEachNodeAsync, apres avoir lu la variable source :
if (sourceValue is string sourceStr && sourceStr.TrimStart().StartsWith("["))
{
    try {
        sourceValue = JsonSerializer.Deserialize<List<object>>(sourceStr);
    } catch { /* garder la string telle quelle */ }
}
```

Alternative : ajouter un noeud de type `parse-json` qui lit un _nodeResult, parse le JSON, et stocke le resultat comme variable de session. Plus propre mais plus de travail.

**Critere de reussite** : un for-each peut iterer sur le resultat d'un noeud precedent qui a produit un JSON array.

---

#### Issue 30-A-4 : Template session projet pour autonomous-dev

Creer `content/system/templates/sessions/project-autonomous.session.json` :

```json
{
  "id": "project-autonomous",
  "type": "project",
  "description": "Project session with autonomous-dev agent",
  "entryPoints": {
    "dev": "autonomous-dev",
    "plan": "task-planner",
    "review": "code-reviewer"
  },
  "variables": {
    "_monitorDescriptor": {
      "layout": { "mode": "agent", "zones": { ... } },
      "components": [
        { "type": "execution-tree", "zone": "left" },
        { "type": "llm-activity", "zone": "right" },
        { "type": "execution-log", "zone": "bottom" }
      ]
    }
  },
  "config": {
    "maxIterations": 100,
    "timeout": 7200
  }
}
```

**Critere de reussite** : `session create --type project --template project-autonomous --repo <path>` fonctionne.

---

### 30-B : Construction bottom-up des sous-blocs

> Chaque sous-bloc est teste INDIVIDUELLEMENT avant de l'integrer dans le composite.

#### Issue 30-B-1 : Mettre a jour project-preparer (Opus)

**Etat actuel** : system-prompt.md existe, bon contenu. Manque :
- Le modele est `claude-sonnet` → changer pour `claude-opus`
- Le prompt ne mentionne pas la creation de fichiers de structure initiale (CONVENTIONS.md, ARCHITECTURE.md, etc.)
- Le prompt ne questionne pas l'utilisateur sur ce qui manque

**Modifications** :
1. Dans le .block.json : `"model": "claude-opus"`
2. Dans system-prompt.md : ajouter l'instruction de creer les fichiers .maestro/ manquants :
   - `.maestro/docs/PROJECT.md` — description, objectifs, stack
   - `.maestro/docs/CONVENTIONS.md` — conventions de code, naming, patterns
   - `.maestro/docs/ARCHITECTURE.md` — structure du projet, modules, dependances
   - `.maestro/docs/ROADMAP.md` — taches planifiees (si il y en a)
3. Ajouter l'instruction de lister les questions pour l'utilisateur dans le output

**Test standalone** : `node index.js run project-preparer --input repoPath="C:\Cantante"`
- [ ] Detecte le stack (TypeScript, React, Electron)
- [ ] Cree les fichiers .maestro/docs/ manquants
- [ ] Le contenu des docs est pertinent et precis
- [ ] La sortie JSON contient un champ `questions` avec les informations manquantes

---

#### Issue 30-B-2 : Mettre a jour task-planner (Opus)

**Etat actuel** : system-prompt.md existe, bon contenu. Manque :
- Le modele est implicite → expliciter `claude-opus`
- Le prompt ne separe pas explicitement frontend/backend/tests/docs
- Le prompt ne priorise pas les dependances

**Modifications** :
1. Dans le .block.json : `"model": "claude-opus"`
2. Dans system-prompt.md : renforcer :
   - Separer les taches par domaine (backend, frontend, tests, docs, infra)
   - Ordonner par dependance (les types/interfaces avant les implementations)
   - Chaque step doit avoir un `domain` et un `dependencies` array
   - Le output est un JSON ARRAY de steps (pas un objet wrapper) pour etre compatible avec le for-each

**Format de sortie** :
```json
[
  { "id": 1, "domain": "backend", "action": "create", "target": "src/types/FileTree.ts", "description": "Create type definitions", "dependencies": [] },
  { "id": 2, "domain": "frontend", "action": "create", "target": "src/components/FileTree.tsx", "description": "Create component", "dependencies": [1] },
  { "id": 3, "domain": "test", "action": "create", "target": "src/__tests__/FileTree.test.tsx", "description": "Create tests", "dependencies": [2] }
]
```

**Test standalone** : `node index.js run task-planner --input task="Create a file-tree module" --input context="..."`
- [ ] Produit un plan structure avec des steps ordonnees
- [ ] Les dependances sont logiques
- [ ] Les domaines sont separes
- [ ] Le output est un JSON array parsable

---

#### Issue 30-B-3 : Mettre a jour implement-single-step (Sonnet)

**Etat actuel** : system-prompt.md bon. Le plus avance des sous-blocs.

**Modifications** :
1. Confirmer `"model": "claude-sonnet"` dans le .block.json
2. Ajouter l'input `conventions` (pour que le codeur respecte les conventions du projet)
3. Renforcer dans le prompt : "Read the target file FIRST if it exists. Never write blind."
4. Ajouter : "If a type check fails, fix the issue before calling done."

**Test standalone** : `node index.js run implement-single-step --input step='{"action":"create","target":"src/hello.ts","description":"Create hello module"}' --input workingDir="C:\Cantante"`
- [ ] Le fichier est cree
- [ ] Le contenu est correct
- [ ] Le type check passe (si applicable)

---

#### Issue 30-B-4 : Mettre a jour test-executor (Sonnet)

**Etat actuel** : system-prompt.md bon.

**Modifications** :
1. Confirmer `"model": "claude-sonnet"`
2. Ajouter la gestion des cas ou le test runner n'est pas installe (`npm install` d'abord si necessaire)
3. Ajouter le parsing structure des erreurs pour que la review puisse les analyser

**Test standalone** : `node index.js run test-executor --input repoPath="C:\Cantante"`
- [ ] Detecte le framework de test
- [ ] Execute les tests
- [ ] Parse les resultats correctement
- [ ] Les erreurs sont detaillees

---

#### Issue 30-B-5 : Verifier code-reviewer (inference, Opus)

**Etat actuel** : `code-reviewer.inference.block.json` dans `content/system/blocks/inference/code-reviewer/`. Deja teste et fonctionnel (produit des JSON reviews avec score).

**Modifications** :
1. Changer le modele de `claude-sonnet` a `claude-opus` (pour la review holiste, Opus est meilleur)
2. Le reste est bon — le systemPrompt est dans `config.systemPrompt`, les criteres de score sont clairs

**Test standalone** : `node index.js run code-reviewer --input changes="..." --input task="..."`
- [ ] Produit un JSON valide avec score, approved, issues, suggestions
- [ ] Le score est coherent avec la qualite reelle

---

#### Issue 30-B-6 : Mettre a jour git-committer (Sonnet)

**Etat actuel** : system-prompt.md bon.

**Modifications** :
1. Confirmer `"model": "claude-sonnet"`
2. Le workingDir doit etre correctement passe et utilise par les commandes git

**Test standalone** : `node index.js run git-committer --input repoPath="C:\Cantante" --input changes="..." --input task="..."`
- [ ] Detecte les changements (git status)
- [ ] Stage les bons fichiers (pas git add .)
- [ ] Produit un message de commit descriptif
- [ ] Le commit est cree

---

### 30-C : Assembler le workflow composite

> Tous les sous-blocs sont testes individuellement. On assemble.

#### Issue 30-C-1 : Reecrire autonomous-dev.agent.block.json

Le nouveau .block.json avec config.nodes :

```json
{
  "id": "autonomous-dev",
  "name": "Autonomous Developer",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Autonomous development workflow. Composite: prepare → plan → implement each step → test → review → commit.",
  "inputs": [
    { "id": "task", "type": "string", "required": true },
    { "id": "repoPath", "type": "string", "required": true }
  ],
  "outputs": [
    { "id": "summary", "type": "object" }
  ],
  "config": {
    "wallClockTimeoutSeconds": 3600,
    "nodes": [
      {
        "id": "prepare",
        "blockRef": "project-preparer",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "model": "claude-opus"
        }
      },
      {
        "id": "plan",
        "blockRef": "task-planner",
        "inputs": {
          "task": "{{inputs.task}}",
          "context": "{{_nodeResult_prepare}}",
          "repoPath": "{{inputs.repoPath}}",
          "model": "claude-opus"
        }
      },
      {
        "id": "implement-loop",
        "type": "for-each",
        "source": "_nodeResult_plan",
        "itemVariable": "_currentStep",
        "children": [
          {
            "id": "implement-step",
            "blockRef": "implement-single-step",
            "inputs": {
              "step": "{{_currentStep}}",
              "context": "{{_nodeResult_prepare}}",
              "workingDir": "{{inputs.repoPath}}",
              "model": "claude-sonnet"
            }
          }
        ]
      },
      {
        "id": "test",
        "blockRef": "test-executor",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "stack": "{{_nodeResult_prepare}}",
          "model": "claude-sonnet"
        }
      },
      {
        "id": "review",
        "blockRef": "code-reviewer",
        "inputs": {
          "changes": "{{_nodeResult_implement-loop}}",
          "testResults": "{{_nodeResult_test}}",
          "conventions": "{{_nodeResult_prepare}}",
          "task": "{{inputs.task}}",
          "model": "claude-opus"
        }
      },
      {
        "id": "commit",
        "blockRef": "git-committer",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "task": "{{inputs.task}}",
          "review": "{{_nodeResult_review}}",
          "model": "claude-sonnet"
        }
      }
    ]
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tier": 1,
    "qualityTarget": 1.0,
    "models": {
      "prepare": "claude-opus",
      "plan": "claude-opus",
      "implement-step": "claude-sonnet",
      "test": "claude-sonnet",
      "review": "claude-opus",
      "commit": "claude-sonnet"
    }
  }
}
```

**Points cles :**
- Opus pour les taches strategiques (prepare, plan, review)
- Sonnet pour les taches focalisees (implement, test, commit)
- for-each sur le plan pour implementer une tache a la fois
- Chaque noeud passe son modele via `inputs.model`

**Critere de reussite** : le JSON est valide, le backend le parse correctement.

---

#### Issue 30-C-2 : Tester le composite sur une tache simple

**Tache** : "Create a README.md file for this project"

Via `session invoke` (pas `run` — on veut le monitoring) :
```bash
node index.js session invoke <id> dev --input task="Create a README.md for the project" --input repoPath="C:\Cantante"
```

**Verifications** :
- [ ] prepare : detecte le stack, cree les docs manquants dans .maestro/
- [ ] plan : produit un plan avec 1-3 steps (creer README, verifier contenu)
- [ ] for-each : execute chaque step individuellement
- [ ] test : verifie que le fichier existe (ou pas de tests a executer)
- [ ] review : score >= 0.8
- [ ] commit : commit propre avec message descriptif
- [ ] Le monitor affiche l'arbre d'execution avec chaque noeud

---

#### Issue 30-C-3 : Tester le composite sur une tache moderee

**Tache** : "Fix the TypeScript errors in this project"

**Verifications** :
- [ ] plan : identifie les fichiers avec erreurs, ordonne les corrections
- [ ] for-each : corrige chaque fichier un par un
- [ ] test : tsc --noEmit passe
- [ ] review : valide les corrections
- [ ] commit : commit propre

---

#### Issue 30-C-4 : Tester le composite sur une tache complexe

**Tache** : "Create a file-tree component that lists all project files in a tree view"

**Verifications** :
- [ ] plan : decompose en types, composant, tests, integration
- [ ] for-each : cree chaque piece separement
- [ ] test : les tests passent
- [ ] review : verifie la qualite, les conventions, la completude
- [ ] commit : commit propre

---

#### Issue 30-C-5 : Iterer le composite

Apres les 3 tests, analyser les echecs et ajuster :
- Les system prompts des sous-blocs
- L'ordre des noeuds
- Les inputs passes entre noeuds
- Le format de sortie du planner (pour le for-each)

**Minimum 3 iterations** sur chaque test avant de declarer stable.

**Critere de reussite** : 3/3 taches reussies avec les memes prompts, sans modification entre les tests.

---

### 30-D : Pipeline foundry et publication

> Le composite fonctionne. On le mesure via le pipeline officiel.

#### Issue 30-D-1 : Creer le workspace Phase 30

```bash
node index.js workspace create --name "Phase-30 autonomous-dev Tier 1"
```

---

#### Issue 30-D-2 : Foundry pour chaque sous-bloc

Pour chaque sous-bloc (project-preparer, task-planner, implement-single-step, test-executor, code-reviewer, git-committer) :

```bash
node index.js session create --type foundry --name "Foundry <bloc-name>" --start
node index.js workspace add-session <ws-id> <session-id>

# Monitor AVANT invoke
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"

# Mesurer le fitness via des scenarios predetermines
# Le fitness d'un sous-bloc = qualite de sa sortie sur un input donne
```

**Criteres de fitness par bloc :**

| Bloc | Fitness = quoi ? |
|------|-----------------|
| project-preparer | Detecte correctement le stack, cree les docs pertinents |
| task-planner | Plan structure, ordonne, avec les bonnes dependances |
| implement-single-step | Le code compile, le type check passe, le fichier est correct |
| test-executor | Detecte le framework, execute les tests, parse les resultats |
| code-reviewer | Score coherent avec la qualite reelle, issues pertinentes |
| git-committer | Commit propre, message descriptif, stage selectif |

**Seuil** : fitness >= 0.85 par bloc.

---

#### Issue 30-D-3 : Foundry pour le composite autonomous-dev

Mesurer le workflow complet sur les 3 scenarios (simple, modere, complexe).

**Fitness composite** = moyenne ponderee :
- task-completed: 0.35
- code-quality: 0.25
- tests-pass: 0.20
- plan-quality: 0.10
- commit-quality: 0.10

**Seuil** : fitness >= 0.85.

---

#### Issue 30-D-4 : Publier

```bash
node index.js block publish project-preparer --version 1.0.0
node index.js block publish task-planner --version 1.0.0
node index.js block publish implement-single-step --version 1.0.0
node index.js block publish test-executor --version 1.0.0
node index.js block publish code-reviewer --version 1.0.0
node index.js block publish git-committer --version 1.0.0
node index.js block publish autonomous-dev --version 1.0.0
```

**Critere de reussite** : tous les blocs publies, listables via `node index.js list-blocks`.

---

### 30-E : Test E2E en session projet

> L'agent est publie. On le teste comme un utilisateur le ferait.

#### Issue 30-E-1 : Creer et configurer la session projet

```bash
node index.js session create --type project --name "Cantante - Autonomous Dev E2E" --template project-autonomous --repo "C:\Cantante" --start
```

---

#### Issue 30-E-2 : 5 scenarios de validation

| # | Scenario | Critere de reussite |
|---|----------|---------------------|
| 1 | "Create README.md" | Fichier cree, contenu pertinent, commit |
| 2 | "Fix TypeScript errors" | Erreurs corrigees, tsc passe, commit |
| 3 | "Create a file-tree module with tests" | Module + tests, npm test passe, commit |
| 4 | "Add accessibility labels to all buttons" | Labels ajoutes, tests, commit |
| 5 | "Refactor audio module to use custom hooks" | Refactoring propre, tests, commit |

**Gate Phase 30** : >= 4/5 scenarios reussis.

---

## Phase 31 : CLI `maestro code`

> Un mode interactif TUI, comme Claude Code mais avec les widgets Maestro.

### 31-A : Mode interactif de base

#### Issue 31-A-1 : Commande `maestro code`

1. Detecte le repo courant (cwd)
2. Cherche `.maestro/` pour la config
3. Cree une session projet automatiquement
4. Lance le mode TUI interactif
5. L'agent `prepare` s'execute automatiquement → questionne l'utilisateur si des docs manquent

**Pas un alias.** Une vraie experience interactive.

---

#### Issue 31-A-2 : Selection d'agent et interaction

Au lancement :
```
? Select an agent:
  > autonomous-dev (Tier 1 - Claude Opus/Sonnet)
    [futurs tiers ici]
```

Pendant l'execution :
- L'utilisateur peut taper a tout moment
- Les messages sont routes a l'interaction-handler
- L'interaction-handler peut : pause, redirect, answer questions

---

#### Issue 31-A-3 : Widgets TUI

Reutiliser les composants du monitor :
- Execution tree (workflow en cours)
- LLM activity (appels en cours)
- Plan view (les steps du plan, coches au fur et a mesure)
- File changes (diff courant)

---

### 31-B : Test et amelioration avec l'agent Tier 1

Tester `maestro code` dans Cantante, corriger les problemes, iterer.

---

## Phase 32 : Optimisation multi-tiers

> Le composite fonctionne avec Claude. On substitue des modeles plus petits bloc par bloc.

### 32-A : Substitution par bloc

La structure composite permet de changer le modele de CHAQUE bloc independamment :

| Tier | prepare | plan | implement | test | review | commit |
|------|---------|------|-----------|------|--------|--------|
| 1 | Opus | Opus | Sonnet | Sonnet | Opus | Sonnet |
| 2 | Sonnet | Opus | Sonnet | Haiku | Sonnet | Haiku |
| 3 | Haiku | Sonnet | Sonnet | Haiku | Sonnet | Qwen |
| 4 | Qwen | Sonnet | Sonnet | Qwen | Haiku | Qwen |
| 5 | Qwen | Qwen | Qwen | Qwen | Qwen | Qwen |

**Pour chaque tier** :
1. Changer le modele dans les metadata
2. Re-entrainer chaque sous-bloc affecte dans la foundry
3. Mesurer le fitness du composite
4. Publier avec le manifeste

### 32-B : Manifeste et `maestro check`

Chaque tier publie embarque un manifeste avec les modeles requis, fitness mesure, et substituts testes.

`maestro check` compare les modeles disponibles avec les manifestes et recommande le meilleur tier.

### 32-C : Selection automatique dans `maestro code`

Au lancement, le systeme detecte les modeles et selectionne le tier optimal.

---

## Phase 33 : Meta-optimisation et Agent Creator

### 33-A : `maestro adapt` — adaptation automatique
### 33-B : Agent Creator — agent qui cree des agents
### 33-C : `maestro optimize` — meta-workflow d'optimisation

(Plans detailles crees quand les phases precedentes seront terminees.)

---

## Ordre d'execution — Recapitulatif

```
30-A-1  Supprimer legacy                    │ 30min
30-A-2  Fix tools-in-session-context        │ 2-4h (bloquant)
30-A-3  for-each sur donnees dynamiques     │ 1h
30-A-4  Template session projet             │ 30min
   │
   ▼
30-B-1  project-preparer (Opus)             │ 1-2h
30-B-2  task-planner (Opus)                 │ 1-2h
30-B-3  implement-single-step (Sonnet)      │ 1-2h
30-B-4  test-executor (Sonnet)              │ 1h
30-B-5  code-reviewer (Opus)                │ 30min
30-B-6  git-committer (Sonnet)              │ 30min
   │
   ▼
30-C-1  Assembler le composite              │ 1h
30-C-2  Test simple (README)                │ 1h
30-C-3  Test modere (fix errors)            │ 1h
30-C-4  Test complexe (new module)          │ 2h
30-C-5  Iterer (minimum 3x)                │ 3-6h
   │
   ▼
30-D    Foundry + publish                   │ 2-4h
30-E    E2E 5 scenarios                     │ 2-4h
   │
   ▼
31      maestro code                        │ 3-5 sessions
32      Tiers + manifeste                   │ 4-6 sessions
33      Meta-optimisation                   │ 3-4 sessions
```

---

## Regles a suivre

1. **Chaque issue est verifiable** — critere de reussite explicite
2. **Bottom-up** — ne jamais commencer une issue dont les prerequis ne sont pas termines
3. **Pas de scaffolding sans test** — si un fichier est ecrit, il est teste dans la meme issue
4. **Le monitor DOIT tourner** avant tout invoke de session
5. **3 tentatives minimum** avant de declarer un probleme
6. **Pas de version aspirationnelle** — v1.0.0 quand c'est publie, pas avant
7. **L'agent composite prouve la philosophie** — jamais de raccourci "Claude fait tout"
