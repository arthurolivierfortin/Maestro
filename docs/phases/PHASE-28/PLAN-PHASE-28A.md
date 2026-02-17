# Plan : Phase 28-A — Agent Autonome de Développement

> Prérequis : Phase 28-INFRA ✅ (BlockRef dispatch + Claude E2E + model-detector)
> Effort estimé : ~3-4 jours
> But : Créer `autonomous-dev-v3`, un bloc agent composite contenant un workflow déterministe, un state manager, et un interaction agent — capable de développer du code de A à Z tout en étant interactif.

---

# PART 1 : LE BLOC (ce qu'on crée)

---

## 1. Architecture d'ensemble

### Principe fondamental

> *"Le type d'un block définit son interface (comment on l'utilise), pas son implémentation (ce qu'il contient)."*

`autonomous-dev-v3` est un **bloc agent** (`blockType: "agent"`). Pour l'utilisateur, c'est un agent : on lui parle, il travaille, il répond. Son implémentation interne est invisible — c'est la composition fractale.

À l'intérieur, trois composants :

```
autonomous-dev-v3 (blockType: "agent", isAtomic: false)
│
├── 1. State Manager (tool block)
│      État partagé entre le workflow et l'interaction agent.
│      Unique source de vérité. Opérations: get, set, transition, rewind.
│
├── 2. Workflow interne (config.nodes — pipeline déterministe)
│      prepare → analyze → plan → implement → test → review → commit
│      Lit et écrit l'état via le state manager.
│      Peut être pausé, résumé, rewound par l'interaction agent.
│
└── 3. Interaction Agent (agent block — complexe)
│      Reçoit les messages de l'utilisateur EN PARALLÈLE du workflow.
│      C'est LUI qui a le contrôle. C'est lui qui a le dernier mot.
│      Peut: pause, resume, rewind, dispatcher, répondre, overrider.
│      Lit et écrit l'état via le même state manager.
```

### Pourquoi trois composants

| Composant | Rôle | Analogie |
|-----------|------|----------|
| State Manager | Mémoire partagée, source de vérité | La base de données |
| Workflow | Exécution déterministe A→Z | Le pipeline CI/CD |
| Interaction Agent | Intelligence, contrôle, dernier mot | Le tech lead qui supervise |

Le workflow ne sait PAS qu'il y a un interaction agent. Il exécute ses nœuds, lit/écrit le state manager, et peut être pausé/résumé de l'extérieur. L'interaction agent connaît le workflow (il peut le contrôler) et le state manager (il peut lire/modifier l'état). C'est une séparation propre.

---

## 2. State Manager

### Le problème

Le workflow et l'interaction agent doivent partager le même état :
- Le workflow écrit "Phase: implement, step 3/5 terminé"
- L'interaction agent lit "Phase: implement" pour répondre "On est à l'implémentation, step 3 sur 5"
- L'utilisateur dit "Reviens à la planification"
- L'interaction agent appelle rewind(plan) sur le state manager
- Le workflow reprend depuis la phase plan

Sans state manager, l'état serait dispersé dans les variables de session, difficile à coordonner.

### Le bloc `workflow-state-manager`

```json
{
  "id": "workflow-state-manager",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Gère l'état partagé d'un agent composite. Unique source de vérité entre le workflow et l'interaction agent."
}
```

### Structure de l'état

```json
{
  "status": "running",
  "currentPhase": "implement",
  "currentNode": "for-each-step",
  "currentStepIndex": 2,
  "totalSteps": 5,

  "projectContext": {
    "name": "Cantante",
    "language": "TypeScript",
    "framework": "Electron + React",
    "conventions": { "style": "ESLint", "naming": "camelCase" },
    "stack": { "main": ["typescript", "react", "electron"] }
  },

  "plan": {
    "steps": [
      { "id": 1, "action": "create", "target": "src/file-tree/index.ts", "status": "done" },
      { "id": 2, "action": "create", "target": "src/file-tree/types.ts", "status": "done" },
      { "id": 3, "action": "modify", "target": "src/index.ts", "status": "in-progress" },
      { "id": 4, "action": "create", "target": "src/file-tree/__tests__/", "status": "pending" },
      { "id": 5, "action": "modify", "target": "package.json", "status": "pending" }
    ]
  },

  "results": {
    "prepare": { "completedAt": "...", "documents": {...} },
    "analyze": { "completedAt": "...", "relevantFiles": [...] },
    "plan": { "completedAt": "...", "steps": [...] },
    "implement": null,
    "test": null,
    "review": null,
    "commit": null
  },

  "history": [
    { "event": "phase-start", "phase": "prepare", "at": "..." },
    { "event": "phase-complete", "phase": "prepare", "at": "..." },
    { "event": "phase-start", "phase": "analyze", "at": "..." },
    { "event": "user-message", "message": "Use tabs not spaces", "at": "..." },
    { "event": "dispatch", "action": "update-conventions", "at": "..." }
  ],

  "userConversation": [
    { "role": "user", "message": "Add a file-tree module", "at": "..." },
    { "role": "agent", "message": "Je commence par vérifier les docs projet...", "at": "..." }
  ]
}
```

### Opérations du state manager

| Opération | Appelé par | Effet |
|-----------|-----------|-------|
| `get(path)` | Workflow + Interaction Agent | Lire un champ de l'état |
| `set(path, value)` | Workflow + Interaction Agent | Écrire un champ |
| `transition(phase)` | Workflow | Marquer une phase comme commencée/terminée |
| `pause()` | Interaction Agent | Mettre le workflow en pause |
| `resume()` | Interaction Agent | Reprendre le workflow |
| `rewind(toPhase)` | Interaction Agent | Revenir à une phase précédente : reset les résultats après `toPhase`, reset le status à `running`, le workflow reprend depuis `toPhase` |
| `getHistory()` | Interaction Agent | Lire l'historique complet (pour répondre aux questions) |
| `inject(path, value)` | Interaction Agent | Modifier un élément du workflow en cours (ex: ajouter une convention au projectContext) |

### Rewind : comment ça marche

```
État actuel:
  prepare ✅ → analyze ✅ → plan ✅ → implement 🔄(step 3/5) → test ⬜ → review ⬜ → commit ⬜

User: "Reviens à la planification, j'ai changé d'avis sur l'approche"

Interaction Agent appelle: stateManager.rewind("plan")

Résultat:
  prepare ✅ → analyze ✅ → plan ⬜ → implement ⬜ → test ⬜ → review ⬜ → commit ⬜
  ↑ results.plan = null, results.implement = null, etc.
  ↑ status = "running", currentPhase = "plan"
  ↑ history += { event: "rewind", from: "implement", to: "plan", reason: "user request" }

Le workflow reprend l'exécution depuis le noeud "plan".
```

---

## 3. Workflow interne (pipeline déterministe)

Le workflow est le `config.nodes` du bloc agent. Il exécute les phases dans l'ordre, lit/écrit via le state manager.

### Structure JSON

```json
{
  "id": "autonomous-dev-v3",
  "blockType": "agent",
  "isAtomic": false,
  "version": "3.0.0",
  "description": "Agent de développement autonome. Interface: agent conversationnel. Implémentation: workflow déterministe + state manager + interaction agent.",

  "inputs": [
    { "id": "task", "type": "string", "required": true },
    { "id": "repoPath", "type": "string", "required": true }
  ],
  "outputs": [
    { "id": "summary", "type": "object" }
  ],

  "metadata": {
    "designation": "autonomous",
    "category": "development",
    "tags": ["agent", "autonomous", "code"]
  },

  "config": {
    "stateManager": {
      "blockRef": "workflow-state-manager"
    },

    "interactionAgent": {
      "blockRef": "interaction-handler-v3",
      "capabilities": ["pause", "resume", "rewind", "dispatch", "answer", "override"]
    },

    "nodes": [
      {
        "id": "prepare",
        "blockRef": "project-preparer-v3",
        "inputs": { "repoPath": "{{inputs.repoPath}}" }
      },
      {
        "id": "analyze",
        "blockRef": "context-analyzer-v3",
        "inputs": {
          "task": "{{inputs.task}}",
          "repoPath": "{{inputs.repoPath}}",
          "projectContext": "{{state.projectContext}}"
        }
      },
      {
        "id": "plan",
        "blockRef": "task-planner-v3",
        "inputs": {
          "task": "{{inputs.task}}",
          "context": "{{state.results.analyze}}",
          "projectContext": "{{state.projectContext}}"
        }
      },
      {
        "id": "implement",
        "blockRef": "code-implementer-v3",
        "inputs": {
          "plan": "{{state.plan}}",
          "context": "{{state.results.analyze}}",
          "conventions": "{{state.projectContext.conventions}}"
        }
      },
      {
        "id": "test",
        "blockRef": "test-executor-v3",
        "inputs": {
          "repoPath": "{{inputs.repoPath}}",
          "changedFiles": "{{state.results.implement.changedFiles}}",
          "stack": "{{state.projectContext.stack}}"
        }
      },
      {
        "id": "review",
        "blockRef": "code-reviewer-v3",
        "inputs": {
          "changes": "{{state.results.implement}}",
          "testResults": "{{state.results.test}}",
          "conventions": "{{state.projectContext.conventions}}"
        }
      },
      {
        "id": "fix-or-commit",
        "type": "conditional",
        "condition": "state.results.review.score >= 0.8",
        "then": {
          "id": "commit",
          "blockRef": "git-committer-v3",
          "inputs": {
            "repoPath": "{{inputs.repoPath}}",
            "changes": "{{state.results.implement}}",
            "task": "{{inputs.task}}"
          }
        },
        "else": {
          "id": "fix",
          "blockRef": "code-implementer-v3",
          "inputs": {
            "plan": "{{state.plan}}",
            "context": "{{state.results.analyze}}",
            "feedback": "{{state.results.review}}",
            "conventions": "{{state.projectContext.conventions}}"
          }
        }
      }
    ]
  }
}
```

**Note** : Les nœuds utilisent `{{state.xxx}}` pour lire le state manager, pas les variables de session directement. Le state manager est l'unique source de vérité.

### Flux d'exécution phase par phase

```
PHASE 0 — PREPARE (project-preparer-v3, workflow composite)
  Nœuds internes:
  ├── check-docs-exist (tool: directory-list .maestro/docs/)
  ├── read-existing-docs (tool: file-read)
  ├── detect-stack (tool: convention-reader)
  ├── identify-gaps (inference: comparer found vs required)
  ├── ask-missing-info (conditional → ask-user pour chaque doc manquant)
  ├── create-missing-docs (tool: file-write)
  └── synthesize-context (inference: produire JSON structuré)
  → Écrit dans state: projectContext, documents

PHASE 1 — ANALYZE (context-analyzer-v3, workflow composite)
  Nœuds internes:
  ├── read-structure (tool: project-structure)
  ├── identify-relevant-files (inference: task + structure → file list)
  ├── read-relevant-files (for-each: file-read)
  ├── analyze-patterns (inference: patterns dans le code)
  └── synthesize-context (inference: analyse JSON)
  → Écrit dans state: results.analyze

PHASE 2 — PLAN (task-planner-v3, workflow composite)
  Nœuds internes:
  ├── assess-complexity (inference: évaluer ambiguïté)
  ├── ask-clarifications (conditional → ask-user si ambigu)
  ├── decompose-task (inference: décomposer en steps)
  └── validate-plan (inference: vérifier cohérence)
  → Écrit dans state: plan, results.plan

PHASE 3 — IMPLEMENT (code-implementer-v3, workflow composite)
  Nœuds internes:
  ├── for-each-step (for-each sur plan.steps)
  │   └── implement-step (agent block: boucle agentique read/write/verify)
  └── verify-all (tool: shell-execute — tsc/eslint)
  → Écrit dans state: results.implement

PHASE 4 — TEST (test-executor-v3, workflow composite)
  Nœuds internes:
  ├── detect-test-framework (tool: file-read package.json)
  ├── run-tests (tool: shell-execute)
  ├── parse-results (inference: structurer la sortie)
  └── check-imports (tool: shell-execute)
  → Écrit dans state: results.test

PHASE 5 — REVIEW (code-reviewer-v3, inference block)
  Single LLM call: diff + conventions + test results → score + issues
  → Écrit dans state: results.review

PHASE 6 — COMMIT ou FIX (conditional)
  Si score >= 0.8 → git-committer-v3 (workflow: status → diff → message → add → commit)
  Si score < 0.8 → retour à code-implementer-v3 avec feedback (max 2 retries)
  → Écrit dans state: results.commit
```

---

## 4. Interaction Agent (le cerveau — complexe)

### Pourquoi il est complexe

L'interaction agent n'est PAS un simple routeur de messages. C'est **celui qui contrôle**. C'est lui qui a le **dernier mot**. Concrètement :

- Si le workflow veut commiter mais l'utilisateur a dit "attends" → l'interaction agent pause
- Si l'utilisateur dit "change l'approche" en pleine implémentation → l'interaction agent évalue s'il faut rewind ou juste injecter un feedback
- Si l'utilisateur pose une question technique → l'interaction agent lit l'état complet et répond intelligemment
- Si l'utilisateur donne un feedback ("utilise des tabs") → l'interaction agent décide si c'est urgent (modifier le code en cours) ou différé (mettre à jour les conventions pour la prochaine fois)

### Structure interne (workflow composite)

L'interaction agent est lui-même un bloc agent composite (`blockType: "agent"`, `isAtomic: false`) avec sa propre logique multi-nœuds :

```json
{
  "id": "interaction-handler-v3",
  "blockType": "agent",
  "isAtomic": false,
  "description": "Agent d'interaction utilisateur. Reçoit les messages, classifie l'intention, décide de l'action, exécute. A le contrôle sur le workflow via le state manager.",

  "config": {
    "nodes": [
      {
        "id": "classify-intent",
        "blockRef": "inference:llm-generate",
        "description": "Classifier l'intention du message utilisateur",
        "inputs": {
          "systemPrompt": "Tu reçois un message de l'utilisateur et l'état actuel du workflow. Classifie l'intention. Output JSON: { intent: 'question'|'feedback'|'change-request'|'override'|'acknowledgment', urgency: 'immediate'|'deferred'|'none', requiresPause: bool, affectedPhases: [], details: string }",
          "userPrompt": "Message: {{userMessage}}\nÉtat actuel: phase={{state.currentPhase}}, step={{state.currentStepIndex}}/{{state.totalSteps}}\nHistorique conversation:\n{{state.userConversation}}"
        }
      },
      {
        "id": "decide-action",
        "blockRef": "inference:llm-generate",
        "description": "Décider de l'action à prendre basée sur l'intention",
        "inputs": {
          "systemPrompt": "Tu es le contrôleur du workflow. Basé sur l'intention classifiée, décide l'action. Options:\n- respond: répondre à une question (pas de pause)\n- pause-and-modify: pauser le workflow, modifier l'état, reprendre\n- rewind: revenir à une phase précédente\n- inject: injecter une info dans l'état sans pauser\n- dispatch-update: mettre à jour un document (.maestro/docs/)\n- override: forcer une décision (ex: skip tests, force commit)\n\nOutput JSON: { action, params: {...}, response: string (message pour l'utilisateur) }",
          "userPrompt": "Intention: {{classify-intent.output}}\nÉtat complet:\n{{state}}"
        }
      },
      {
        "id": "execute-action",
        "type": "conditional",
        "description": "Dispatch vers le bon handler selon l'action décidée",
        "branches": {
          "respond": {
            "blockRef": "inference:llm-generate",
            "description": "Générer une réponse informative pour l'utilisateur"
          },
          "pause-and-modify": {
            "blockRef": "state-modifier-agent",
            "description": "Pauser le workflow, modifier le plan/conventions/state, reprendre"
          },
          "rewind": {
            "blockRef": "rewind-handler",
            "description": "Appeler stateManager.rewind(toPhase), informer l'utilisateur"
          },
          "inject": {
            "blockRef": "state-injector",
            "description": "Injecter une info dans le state sans pause (ex: convention)"
          },
          "dispatch-update": {
            "blockRef": "doc-updater-agent",
            "description": "Mettre à jour un document .maestro/docs/"
          },
          "override": {
            "blockRef": "override-handler",
            "description": "Forcer une décision (avec avertissement à l'utilisateur)"
          }
        }
      },
      {
        "id": "send-response",
        "blockRef": "show-widget",
        "description": "Envoyer la réponse à l'utilisateur via le widget approprié",
        "inputs": {
          "type": "{{decide-action.output.widgetType}}",
          "content": "{{decide-action.output.response}}"
        }
      }
    ]
  }
}
```

### Exemples de scénarios

**Scénario 1 : Question simple**
```
User: "T'en es où ?"
→ classify: intent=question, urgency=none, requiresPause=false
→ decide: action=respond
→ execute: Lit state → "Je suis à l'implémentation, step 3/5.
   J'ai créé index.ts et types.ts, je modifie maintenant src/index.ts."
→ send: widget text-message
```

**Scénario 2 : Feedback urgent**
```
User: "Stop, utilise des tabs pas des espaces"
→ classify: intent=change-request, urgency=immediate, requiresPause=true
→ decide: action=pause-and-modify
→ execute:
    1. stateManager.pause()
    2. stateManager.inject("projectContext.conventions.indentation", "tabs")
    3. Mettre à jour .maestro/docs/CONVENTIONS.md
    4. Si step en cours a écrit du code avec des espaces → rewind au step courant
    5. stateManager.resume()
→ send: "OK, je passe en tabs. J'ai mis à jour les conventions et je reprends
   le step en cours avec la bonne indentation."
```

**Scénario 3 : Changement d'approche**
```
User: "En fait, fais-le plutôt comme une classe, pas des fonctions pures"
→ classify: intent=change-request, urgency=immediate, requiresPause=true,
   affectedPhases=["plan", "implement"]
→ decide: action=rewind, params={toPhase: "plan"}
→ execute:
    1. stateManager.pause()
    2. stateManager.rewind("plan")
    3. stateManager.inject("plan.userOverride", "Use class pattern instead of pure functions")
    4. stateManager.resume()
→ send: "Compris, je reviens à la planification pour refaire le plan en mode classe.
   L'analyse du code est conservée."
```

**Scénario 4 : Override**
```
User: "Commite tel quel, je m'en fous du score du reviewer"
→ classify: intent=override, urgency=immediate, requiresPause=true
→ decide: action=override, params={skipPhase: "review", goTo: "commit"}
→ execute:
    1. stateManager.pause()
    2. Avertissement: "Le score du reviewer est 0.6. Vous êtes sûr ?"
    3. Si l'utilisateur confirme → stateManager.transition("commit")
    4. stateManager.resume() → le workflow saute au commit
→ send: widget confirmation → puis résultat du commit
```

---

## 5. Sous-blocs spécialisés

Chaque sous-bloc du workflow est lui-même un bloc composite (`blockType: "agent"`, `isAtomic: false`) avec `config.nodes`. Ils lisent/écrivent le state manager.

### 5A. `project-preparer-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `agent` |
| isAtomic | `false` |
| Nœuds internes | 7 (check-docs → read-docs → detect-stack → identify-gaps → ask-missing → create-docs → synthesize) |
| Modèle (inference) | Claude Sonnet |
| Outils | file-read, file-write, directory-list, convention-reader, ask-user |
| State écrit | `projectContext`, `documents` |

**Nœuds détaillés** : voir Section 3 (Phase 0 — PREPARE)

### 5B. `context-analyzer-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `agent` |
| isAtomic | `false` |
| Nœuds internes | 5 (read-structure → identify-relevant → read-files → analyze-patterns → synthesize) |
| Modèle (inference) | Claude Sonnet |
| Outils | project-structure, file-read, code-search |
| State écrit | `results.analyze` |

### 5C. `task-planner-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `agent` |
| isAtomic | `false` |
| Nœuds internes | 4 (assess-complexity → ask-clarifications → decompose → validate) |
| Modèle (inference) | Claude Sonnet |
| Outils | ask-user |
| State écrit | `plan`, `results.plan` |

### 5D. `code-implementer-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `agent` |
| isAtomic | `false` |
| Nœuds internes | 3 (for-each-step → [implement-step (agent boucle)] → verify-all) |
| Modèle (agent interne) | Claude Sonnet |
| Outils | file-read, file-write, shell-execute, code-search |
| State écrit | `results.implement` |

**Note** : `implement-step` est un sous-bloc `blockType: "agent"` avec boucle agentique (le LLM décide l'ordre des lectures/écritures/vérifications). C'est le seul endroit où une boucle agentique est nécessaire — l'implémentation de code est trop imprévisible pour des nœuds statiques.

### 5E. `test-executor-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `agent` |
| isAtomic | `false` |
| Nœuds internes | 4 (detect-framework → determine-command → run-tests → parse-results) |
| Modèle (inference) | Claude Sonnet |
| Outils | shell-execute, file-read |
| State écrit | `results.test` |

### 5F. `code-reviewer-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `inference` |
| isAtomic | `true` |
| Nœuds internes | Aucun — single LLM call |
| Modèle | Claude Sonnet |
| Temperature | 0.2 |
| State écrit | `results.review` |

**Output** : `{ score, approved, issues[], suggestions[], summary }`

### 5G. `git-committer-v3`

| Propriété | Valeur |
|-----------|--------|
| blockType | `agent` |
| isAtomic | `false` |
| Nœuds internes | 5 (get-status → get-diff → generate-message → stage-files → commit) |
| Modèle (inference) | Claude Sonnet ou Haiku |
| Outils | shell-execute |
| State écrit | `results.commit` |

---

## 6. Documents projet dans `.maestro/docs/`

### Documents attendus

| Fichier | Contenu | Obligatoire | Si manquant |
|---------|---------|-------------|-------------|
| `.maestro/docs/PROJECT.md` | Nom, description, objectif | Oui | ask-user |
| `.maestro/docs/CONVENTIONS.md` | Style, nommage, patterns, linter | Oui | Déduire configs + ask-user |
| `.maestro/docs/STACK.md` | Langage, framework, runtime, deps | Oui | Détecter auto + confirmer |
| `.maestro/docs/ROADMAP.md` | État du projet, priorités | Non | Proposer |
| `.maestro/docs/ARCHITECTURE.md` | Structure, modules | Non | Générer auto |

### Flux de vérification (Phase 0)

Le `project-preparer-v3` vérifie ces documents au démarrage. Pour chaque doc obligatoire manquant :
1. Tenter de déduire des fichiers de config existants (package.json, tsconfig, eslint, etc.)
2. Si non-déductible → ask-user pour le contenu
3. Créer le fichier
4. Synthétiser le tout en `projectContext` dans le state manager

---

## 7. Infrastructure ask-user / Protocole de widgets

### Comment ask-user fonctionne

Les sous-blocs du workflow (comme task-planner-v3) appellent `ask-user` quand ils ont besoin d'une réponse de l'utilisateur. Le message remonte au mode `maestro code` qui le rend via un widget.

```
Sous-bloc task-planner-v3 (noeud ask-clarifications):
  → Appelle: ask-user --type option-select
       --question "Classe ou fonctions pures ?"
       --options "Classe,Fonctions pures"

Mode maestro code:
  → Reçoit la demande (via session variable _widgetRequest)
  → Rend le widget option-select dans le terminal
  → L'utilisateur choisit
  → Écrit la réponse dans _widgetResponse
  → Le sous-bloc continue avec la réponse
```

### Types de widgets (réutilisables, génériques)

L'agent spécifie le TYPE de widget — le mode le rend. Aucun widget n'est spécifique à un agent particulier.

| Type | Usage | Paramètres |
|------|-------|-----------|
| `option-select` | Choix parmi options | question, options[], default |
| `text-input` | Entrée libre | question, placeholder, multiline? |
| `confirmation` | Oui/Non | question, defaultYes? |
| `progress` | Barre de progression | label, current, total, steps[] |
| `file-tree` | Arbre de fichiers | rootPath, highlighted[] |
| `diff-view` | Diff de code | filePath, before, after |
| `table` | Données tabulaires | columns[], rows[] |
| `log-stream` | Log temps réel | entries[] |
| `plan-view` | Plan d'étapes | steps[], currentStep |
| `test-results` | Résultats tests | passed, failed, details[] |

Les widgets sont définis dans `shared/tui/widgets/` et implémentés comme composants Ink réutilisables. Détails dans le plan 28-B.

---

# PART 2 : LE PROCESSUS (comment on le crée)

> **Note importante** : Cette section décrit le processus DÉVELOPPEUR pour Phase 28-A — c'est nous (les développeurs de Maestro) qui créons manuellement les blocs. C'est normal : on construit le premier agent avant d'avoir l'outil pour le faire automatiquement.
>
> **Phase 28-B2** introduit un **Agent Creator** qui automatise ce processus. Dans l'app finale, les utilisateurs ne programment pas directement — ils utilisent l'Agent Creator dans un workspace foundry pour créer des agents à partir d'un plan. Le processus ci-dessous sera alors remplacé par l'Agent Creator.

---

## 8. Processus développeur (Phase 28-A — temporaire)

### 8A. Pourquoi c'est manuel pour 28-A

C'est un problème de poule et d'œuf :
- Pour créer `autonomous-dev-v3`, il faut le processus foundry
- Les workflows foundry existent (`agent-improvement-loop`, `tool-creation`, etc.)
- Mais il n'y a pas encore d'agent qui ORCHESTRE le processus foundry automatiquement
- Cet agent = l'Agent Creator (Phase 28-B2)

Pour 28-A, nous créons manuellement :
1. Écrire les block JSON
2. Écrire les prompts
3. Lancer les foundry sessions
4. Tester et itérer
5. Publier

### 8B. Ordre de création (bottom-up)

| # | Bloc | blockType | Dépendances |
|---|------|-----------|-------------|
| 0 | `workflow-state-manager` | tool | Aucune |
| 1 | `project-preparer-v3` | agent (composite) | state-manager, ask-user, file-read/write |
| 2 | `context-analyzer-v3` | agent (composite) | state-manager, project-structure, file-read |
| 3 | `task-planner-v3` | agent (composite) | state-manager, ask-user |
| 4 | `implement-single-step` | agent (boucle) | file-read/write, shell-execute |
| 5 | `code-implementer-v3` | agent (composite) | implement-single-step, state-manager |
| 6 | `test-executor-v3` | agent (composite) | shell-execute, file-read, state-manager |
| 7 | `code-reviewer-v3` | inference | Aucune |
| 8 | `git-committer-v3` | agent (composite) | shell-execute, state-manager |
| 9 | `interaction-handler-v3` | agent (composite) | state-manager, ask-user |
| 10 | `autonomous-dev-v3` | agent (composite) | TOUS les blocs ci-dessus |

### 8C. Critères de fitness par bloc

| Bloc | Critères | Seuil |
|------|----------|-------|
| `project-preparer-v3` | Docs créés, contexte JSON valide, questions pertinentes | 0.80 |
| `context-analyzer-v3` | Fichiers pertinents identifiés, analyse JSON valide | 0.80 |
| `task-planner-v3` | Plan JSON valide, steps concrets et ordonnés | 0.85 |
| `implement-single-step` | Code syntaxiquement valide, step complété | 0.85 |
| `code-implementer-v3` | Tous les steps implémentés, tsc passe | 0.85 |
| `test-executor-v3` | Framework détecté, tests exécutés, résultats JSON | 0.80 |
| `code-reviewer-v3` | Score cohérent, issues pertinentes | 0.80 |
| `git-committer-v3` | Commit créé, message conventionnel | 0.85 |
| `interaction-handler-v3` | Intent correct, action correcte, state modifié correctement | 0.85 |
| `autonomous-dev-v3` | Tâche E2E complétée : code + tests + commit | 0.80 |

### 8D. Cible : automatisation par l'Agent Creator (Phase 28-B2)

Ce processus manuel sera remplacé par l'Agent Creator qui :
1. Lit un plan (comme la Part 1 de ce document)
2. Crée les blocs JSON automatiquement
3. Orchestre les foundry sessions
4. Entraîne, évalue, itère
5. Publie quand le fitness est atteint

Voir : `PLAN-PHASE-28B2.md` pour les détails.

---

## 9. Tests d'intégration sur Cantante

| # | Test | Description | Critères de succès |
|---|------|-------------|-------------------|
| 1 | **Phase 0 : Documents** | Lancer sur Cantante sans `.maestro/docs/` | `PROJECT.md`, `CONVENTIONS.md`, `STACK.md` créés |
| 2 | **Tâche simple** | `"Run npm install and fix deps"` | npm install réussi. Commit créé. |
| 3 | **Tâche modérée** | `"Fix TypeScript import errors"` | `tsc --noEmit` passe. Commit. |
| 4 | **Tâche complexe** | `"Create a file-tree module"` | Module créé, testé, commité. |
| 5 | **Boucle review** | Code imparfait intentionnel | implement → review (< 0.8) → fix → commit |
| 6 | **Question interactive** | `"Add accessibility features"` (ambigu) | Question posée, réponse utilisée |
| 7 | **Interjection utilisateur** | Pendant l'implémentation, user dit "utilise tabs" | Convention injectée, code ajusté |
| 8 | **Rewind** | Pendant l'implémentation, user dit "reviens au plan" | Rewind fonctionne, workflow reprend |
| 9 | **Override** | User dit "commite tel quel" pendant review | Confirmation demandée, commit forcé |

---

## 10. Gate 28-A

| Critère | Vérification | Statut |
|---------|--------------|--------|
| State manager fonctionne | get/set/transition/rewind/inject | ⬜ |
| 7 sous-blocs publiés | Tous composites (config.nodes) sauf code-reviewer (inference) | ⬜ |
| Interaction agent fonctionne | Classify intent + decide action + execute pour 4 scénarios | ⬜ |
| `autonomous-dev-v3` publié | blockType: "agent", contient workflow + state-manager + interaction-agent | ⬜ |
| Test E2E "file tree" | Module créé, testé, commité sur Cantante | ⬜ |
| Boucle review | implement → review → fix → commit | ⬜ |
| Rewind | User demande rewind → workflow reprend depuis la bonne phase | ⬜ |
| Interjection | User injecte feedback sans pauser le workflow | ⬜ |
| Widgets ask-user | Questions rendues via widgets génériques | ⬜ |
| State partagé | Workflow et interaction agent lisent/écrivent le même state | ⬜ |
| Tout via foundry | Workspace avec 10 foundry sessions | ⬜ |
| Zéro code spécifique Cantante | `grep -r "cantante" backend/` → 0 | ⬜ |
