# Plan — Workflow Orchestrateur v4 : maestro-agent-v4

**Objectif** : Creer le workflow orchestrateur complet (`maestro-agent-v4`) et son session template.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/10-workflow-orchestrator/spec.md`. Lire `docs/phases/PHASE-34/34-A/01-architecture-overview/spec.md`.
**Dependances** :
- **34-B** : `ExecuteParallelNodeAsync` doit etre implemente dans `EntryPointExecutor.cs` (pour le noeud `parallel` racine)
- **34-B** : Le support `branches` multi-way dans le conditional node (pour le routing des developers)
- **Plans precedents** : tous les specialist blocks et tool blocks doivent exister
**Impact** : Creation de 2 fichiers JSON dans `content/system/blocks/workflows/` et `content/system/templates/sessions/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient le JSON conceptuel complet du workflow
3. **L'architecture overview** (`01-architecture-overview/spec.md`) : Vue d'ensemble des 7 phases
4. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 4 documents.**

---

## Contexte — Le spec utilise des noms de champs INCORRECTS

Le spec `10-workflow-orchestrator/spec.md` contient le JSON complet de `config.nodes`, mais il utilise des noms de champs qui **ne correspondent PAS** au codebase reel. Ce plan corrige chaque divergence.

### Table de traduction spec -> codebase

| Champ dans le spec | Champ dans le codebase | Explication |
|--------------------|------------------------|-------------|
| `"type": "blockRef"` + `"blockId": "xxx"` | `"blockRef": "xxx"` (pas de `type`) | Les noeuds avec `blockRef` n'ont pas besoin de `type`. Le dispatcher `ExecuteConfigNodesAsync` tombe dans le cas `default` qui appelle `ExecuteRegularNodeAsync`, lequel detecte `blockRef`. |
| `"type": "decision"` + `"ifTrue"` / `"ifFalse"` | `"type": "conditional"` + `"then"` / `"else"` | Renomme le type ET les branches. |
| `"type": "decision"` + `"branches": {}` | `"type": "conditional"` + `"branches": {}` | Le support multi-way branches n'existe pas encore. A implementer en 34-B. |
| `"type": "write"` + `"variable"` + `"value"` | `"type": "set-variable"` + `"variable"` + `"value"` | Renomme le type. Le handler est `ExecuteSetVariableNode`. |
| `"type": "sequence"` + `"children": [...]` | Pas de type `sequence` dans le codebase actuel. | **A implementer en 34-B.** Actuellement, les children sequentiels sont dans `"nodes": [...]` (le default behavior d'un parent node). En attendant, utiliser `"nodes": [...]` sans type explicite. |
| `"type": "parallel"` + `"children": [...]` | Pas de type `parallel` dans le codebase. | **A implementer en 34-B.** `ExecuteParallelNodeAsync` n'existe pas encore. |
| `"type": "while"` + `"children": [...]` | `"type": "while"` + `"nodes": [...]` | Les children d'un while sont dans `nodes`, pas `children`. |
| `"type": "for-each"` + `"collection"` + `"children": [...]` | `"type": "for-each"` + `"source"` + `"nodes": [...]` | Renomme `collection` -> `source` et `children` -> `nodes`. Le `source` est le nom d'une variable de session. |
| `"input": { ... }` | `"inputs": { ... }` | Le codebase existant (autonomous-development.workflow.block.json) utilise `inputs`. |

### Points critiques

1. **`blockRef` est un champ du noeud, PAS un type.** Dans le codebase, un noeud qui execute un bloc s'ecrit : `{ "id": "foo", "blockRef": "block-id", "inputs": {...} }`. Il n'a PAS `"type": "blockRef"`.

2. **`nodes` est le nom du tableau de children** pour les while, for-each, et les noeuds parents. PAS `children`.

3. **Les templates sont `{{inputs.xxx}}` ou `{{_nodeResult_xxx}}`** — PAS `{{results.xxx}}` comme dans le spec. Le resultat d'un noeud `id: "foo"` est stocke dans la variable de session `_nodeResult_foo`.

4. **`source` dans for-each est un NOM de variable de session** — le executor lit `session.GetVariable(source)` pour obtenir la liste. Il faut donc d'abord stocker la liste dans une variable via un noeud `set-variable`.

5. **`parallel` et `sequence` explicites n'existent pas encore** — ils sont prevus pour 34-B. En attendant :
   - Les `sequence` sont implicites (les `nodes` d'un parent sont toujours executes sequentiellement)
   - Le `parallel` racine est BLOQUANT — le workflow ne peut pas demarrer tant que 34-B n'est pas fait

---

## Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/workflows/maestro-agent-v4.workflow.block.json` | Workflow orchestrateur complet |
| `content/system/templates/sessions/project-v4.session.json` | Session template pour le workflow v4 |

---

## Fichier 1 : maestro-agent-v4.workflow.block.json

### Block definition JSON complete

```json
{
  "id": "maestro-agent-v4",
  "name": "Maestro Agent v4 — Autonomous Fullstack Developer",
  "blockType": "workflow",
  "version": "4.0.0",
  "isAtomic": false,
  "description": "Complete autonomous development workflow v4: comprendre (analyze, architect, research) -> planifier (plan, validate) -> implementer (for-each step with routing) -> verifier (tests, e2e, UI review) -> reviewer (code, security, architecture) -> iterer (while loop) -> livrer (commit, changelog, report). Runs interaction-handler in parallel.",

  "inputs": [
    {
      "id": "task",
      "name": "Development Task",
      "type": "string",
      "required": true,
      "description": "The development task to accomplish"
    },
    {
      "id": "repoPath",
      "name": "Repository Path",
      "type": "string",
      "required": true,
      "description": "Absolute path to the target repository"
    }
  ],

  "outputs": [
    { "id": "summary", "type": "string", "description": "Workflow execution summary and final report" }
  ],

  "config": {
    "nodes": [
      {
        "id": "root",
        "type": "parallel",
        "description": "Main workflow + interaction-handler in parallel",
        "nodes": [
          {
            "id": "main-workflow",
            "description": "Main development workflow (7 phases)",
            "nodes": [

              {
                "id": "init",
                "blockRef": "state-manager",
                "description": "Initialize workflow state",
                "inputs": {
                  "operation": "set",
                  "path": "",
                  "value": "{\"status\":\"running\",\"currentPhase\":\"comprendre\",\"iteration\":0,\"maxIterations\":3,\"results\":{},\"history\":[],\"userOverrides\":{}}",
                  "sessionId": "{{_sessionId}}"
                }
              },

              {
                "id": "load-memory",
                "blockRef": "memory-read",
                "description": "Load persistent memory from .maestro/memory/",
                "inputs": {
                  "file": "index.md",
                  "workingDir": "{{inputs.repoPath}}"
                }
              },

              {
                "id": "phase-comprendre",
                "phaseId": "comprendre",
                "description": "Phase 1: Understand the project and the task",
                "nodes": [
                  {
                    "id": "analyze-project",
                    "blockRef": "project-analyzer",
                    "description": "Analyze the project repository",
                    "inputs": {
                      "repoPath": "{{inputs.repoPath}}",
                      "task": "{{inputs.task}}"
                    }
                  },
                  {
                    "id": "design-architecture",
                    "blockRef": "task-architect",
                    "description": "Design high-level architecture",
                    "inputs": {
                      "task": "{{inputs.task}}",
                      "projectContext": "{{_nodeResult_analyze-project}}"
                    }
                  },
                  {
                    "id": "needs-research",
                    "type": "conditional",
                    "description": "Does the task-architect identify questions needing research?",
                    "condition": "{{_nodeResult_design-architecture}} contains designDecisions",
                    "then": {
                      "id": "do-research",
                      "blockRef": "research-agent",
                      "description": "Complementary web research",
                      "inputs": {
                        "query": "{{inputs.task}}",
                        "projectContext": "{{_nodeResult_analyze-project}}"
                      }
                    }
                  },
                  {
                    "id": "checkpoint-comprendre",
                    "blockRef": "state-manager",
                    "description": "Checkpoint comprendre results",
                    "inputs": {
                      "operation": "set",
                      "path": "results.comprendre",
                      "value": "{\"project\":\"stored\",\"architecture\":\"stored\",\"research\":\"stored\"}",
                      "sessionId": "{{_sessionId}}"
                    }
                  },
                  {
                    "id": "transition-planifier",
                    "blockRef": "state-manager",
                    "description": "Transition to planifier phase",
                    "inputs": {
                      "operation": "transition",
                      "phase": "planifier",
                      "sessionId": "{{_sessionId}}"
                    }
                  }
                ]
              },

              {
                "id": "phase-planifier",
                "phaseId": "planifier",
                "description": "Phase 2: Plan the implementation",
                "nodes": [
                  {
                    "id": "plan-loop",
                    "type": "while",
                    "description": "Plan -> validate -> re-plan loop (max 2 iterations)",
                    "condition": "{{planValid}} != true",
                    "maxIterations": 2,
                    "nodes": [
                      {
                        "id": "create-plan",
                        "blockRef": "task-planner",
                        "description": "Create implementation plan",
                        "inputs": {
                          "task": "{{inputs.task}}",
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "architecture": "{{_nodeResult_design-architecture}}",
                          "researchContext": "{{_nodeResult_do-research}}",
                          "userOverrides": "{{userOverrides}}",
                          "previousValidation": "{{_nodeResult_validate-plan}}"
                        }
                      },
                      {
                        "id": "validate-plan",
                        "blockRef": "plan-validator",
                        "description": "Validate the plan against architecture and conventions",
                        "inputs": {
                          "plan": "{{_nodeResult_create-plan}}",
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "architecture": "{{_nodeResult_design-architecture}}"
                        }
                      },
                      {
                        "id": "set-plan-valid",
                        "type": "set-variable",
                        "variable": "planValid",
                        "value": "{{_nodeResult_validate-plan}}",
                        "description": "Store plan validation result"
                      }
                    ]
                  },
                  {
                    "id": "store-plan",
                    "type": "set-variable",
                    "variable": "_planSteps",
                    "value": "{{_nodeResult_create-plan}}",
                    "description": "Store validated plan steps for for-each iteration"
                  },
                  {
                    "id": "checkpoint-planifier",
                    "blockRef": "state-manager",
                    "description": "Checkpoint planifier results",
                    "inputs": {
                      "operation": "set",
                      "path": "results.planifier",
                      "value": "{\"plan\":\"stored\",\"validated\":true}",
                      "sessionId": "{{_sessionId}}"
                    }
                  },
                  {
                    "id": "transition-implementer",
                    "blockRef": "state-manager",
                    "description": "Transition to implementer phase",
                    "inputs": {
                      "operation": "transition",
                      "phase": "implementer",
                      "sessionId": "{{_sessionId}}"
                    }
                  }
                ]
              },

              {
                "id": "phase-iteration-loop",
                "phaseId": "iteration",
                "type": "while",
                "description": "Main loop: implement -> verify -> review, max 3 iterations",
                "condition": "{{reviewApproved}} != true",
                "maxIterations": 3,
                "nodes": [

                  {
                    "id": "phase-implementer",
                    "phaseId": "implementer",
                    "type": "for-each",
                    "description": "Phase 3: Implement each plan step",
                    "source": "_planSteps",
                    "itemId": "id",
                    "configLookup": false,
                    "nodes": [
                      {
                        "id": "implement-step",
                        "blockRef": "implement-single-step",
                        "description": "Implement a single step (routes to appropriate developer internally)",
                        "inputs": {
                          "step": "{{_currentItemJson}}",
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "workingDir": "{{inputs.repoPath}}",
                          "reviewFeedback": "{{reviewFeedback}}"
                        }
                      },
                      {
                        "id": "validate-step-impl",
                        "blockRef": "step-validator",
                        "description": "Verify the step was actually implemented on disk",
                        "inputs": {
                          "step": "{{_currentItemJson}}",
                          "result": "{{previousOutput}}",
                          "workingDir": "{{inputs.repoPath}}"
                        }
                      }
                    ]
                  },

                  {
                    "id": "checkpoint-implementer",
                    "blockRef": "state-manager",
                    "description": "Checkpoint implementation results",
                    "inputs": {
                      "operation": "set",
                      "path": "results.implementer",
                      "value": "{{_nodeResult_phase-implementer}}",
                      "sessionId": "{{_sessionId}}"
                    }
                  },

                  {
                    "id": "phase-verifier",
                    "phaseId": "verifier",
                    "description": "Phase 4: Verify the implemented code",
                    "nodes": [
                      {
                        "id": "write-tests",
                        "blockRef": "test-writer",
                        "description": "Write unit tests for implemented changes",
                        "inputs": {
                          "implementedSteps": "{{_nodeResult_phase-implementer}}",
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "workingDir": "{{inputs.repoPath}}"
                        }
                      },
                      {
                        "id": "run-tests",
                        "blockRef": "test-runner",
                        "description": "Execute the test suite",
                        "inputs": {
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "workingDir": "{{inputs.repoPath}}",
                          "testsWritten": "{{_nodeResult_write-tests}}"
                        }
                      },
                      {
                        "id": "has-ui",
                        "type": "conditional",
                        "description": "Does the project have a UI to test visually?",
                        "condition": "{{_nodeResult_design-architecture}} contains visualComponents",
                        "then": {
                          "id": "visual-verification",
                          "description": "Visual verification sequence",
                          "nodes": [
                            {
                              "id": "run-e2e",
                              "blockRef": "e2e-tester",
                              "description": "Run end-to-end tests with Playwright",
                              "inputs": {
                                "projectContext": "{{_nodeResult_analyze-project}}",
                                "workingDir": "{{inputs.repoPath}}",
                                "implementedSteps": "{{_nodeResult_phase-implementer}}"
                              }
                            },
                            {
                              "id": "review-ui",
                              "blockRef": "ui-reviewer",
                              "description": "Review UI screenshots and accessibility",
                              "inputs": {
                                "screenshots": "{{_nodeResult_run-e2e}}",
                                "accessibilityTree": "{{_nodeResult_run-e2e}}",
                                "designContext": "{{_nodeResult_design-architecture}}",
                                "projectContext": "{{_nodeResult_analyze-project}}"
                              }
                            },
                            {
                              "id": "check-a11y",
                              "blockRef": "accessibility-checker",
                              "description": "Check WCAG accessibility compliance",
                              "inputs": {
                                "accessibilityTree": "{{_nodeResult_run-e2e}}"
                              }
                            }
                          ]
                        }
                      }
                    ]
                  },

                  {
                    "id": "checkpoint-verifier",
                    "blockRef": "state-manager",
                    "description": "Checkpoint verification results",
                    "inputs": {
                      "operation": "set",
                      "path": "results.verifier",
                      "value": "{{_nodeResult_run-tests}}",
                      "sessionId": "{{_sessionId}}"
                    }
                  },

                  {
                    "id": "phase-reviewer",
                    "phaseId": "reviewer",
                    "description": "Phase 5: Review the code",
                    "nodes": [
                      {
                        "id": "review-code",
                        "blockRef": "code-reviewer",
                        "description": "Score implementation quality across 7 axes",
                        "inputs": {
                          "implementedSteps": "{{_nodeResult_phase-implementer}}",
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "testResults": "{{_nodeResult_run-tests}}",
                          "iteration": "{{iteration}}"
                        }
                      },
                      {
                        "id": "review-security",
                        "blockRef": "security-reviewer",
                        "description": "OWASP top 10 security audit",
                        "inputs": {
                          "implementedCode": "{{_nodeResult_phase-implementer}}",
                          "projectContext": "{{_nodeResult_analyze-project}}"
                        }
                      },
                      {
                        "id": "review-architecture",
                        "blockRef": "architecture-reviewer",
                        "description": "Architecture coherence check",
                        "inputs": {
                          "implementedCode": "{{_nodeResult_phase-implementer}}",
                          "projectContext": "{{_nodeResult_analyze-project}}",
                          "architecture": "{{_nodeResult_design-architecture}}"
                        }
                      },
                      {
                        "id": "compute-approved",
                        "type": "set-variable",
                        "variable": "reviewApproved",
                        "value": "{{_nodeResult_review-code}}",
                        "description": "Store review approval status (the code-reviewer block returns approved/rejected)"
                      },
                      {
                        "id": "build-feedback",
                        "type": "conditional",
                        "description": "If not approved, build feedback for next iteration",
                        "condition": "{{reviewApproved}} != true",
                        "then": {
                          "id": "aggregate-feedback",
                          "type": "set-variable",
                          "variable": "reviewFeedback",
                          "value": "{{_nodeResult_review-code}}"
                        }
                      }
                    ]
                  },

                  {
                    "id": "checkpoint-reviewer",
                    "blockRef": "state-manager",
                    "description": "Checkpoint review results",
                    "inputs": {
                      "operation": "set",
                      "path": "results.reviewer",
                      "value": "{{_nodeResult_review-code}}",
                      "sessionId": "{{_sessionId}}"
                    }
                  }
                ]
              },

              {
                "id": "phase-livrer",
                "phaseId": "livrer",
                "description": "Phase 7: Deliver (commit, changelog, report)",
                "nodes": [
                  {
                    "id": "do-commit",
                    "blockRef": "git-committer",
                    "description": "Create conventional commit",
                    "inputs": {
                      "implementedSteps": "{{_nodeResult_phase-implementer}}",
                      "reviewResult": "{{_nodeResult_review-code}}",
                      "workingDir": "{{inputs.repoPath}}",
                      "repoPath": "{{inputs.repoPath}}"
                    }
                  },
                  {
                    "id": "write-changelog",
                    "blockRef": "changelog-writer",
                    "description": "Update the changelog",
                    "inputs": {
                      "commitMessage": "{{_nodeResult_do-commit}}",
                      "implementedSteps": "{{_nodeResult_phase-implementer}}",
                      "reviewResult": "{{_nodeResult_review-code}}"
                    }
                  },
                  {
                    "id": "generate-report",
                    "blockRef": "summary-reporter",
                    "description": "Generate final execution report",
                    "inputs": {
                      "task": "{{inputs.task}}",
                      "implementedSteps": "{{_nodeResult_phase-implementer}}",
                      "testResults": "{{_nodeResult_run-tests}}",
                      "reviewResult": "{{_nodeResult_review-code}}",
                      "commitResult": "{{_nodeResult_do-commit}}",
                      "iterations": "{{iteration}}"
                    }
                  },
                  {
                    "id": "save-learnings",
                    "type": "conditional",
                    "description": "Save learnings to memory if any",
                    "condition": "{{_nodeResult_generate-report}} contains learnings",
                    "then": {
                      "id": "write-learnings",
                      "blockRef": "memory-write",
                      "description": "Append learnings to memory",
                      "inputs": {
                        "file": "learnings.md",
                        "content": "{{_nodeResult_generate-report}}",
                        "mode": "append",
                        "workingDir": "{{inputs.repoPath}}"
                      }
                    }
                  },
                  {
                    "id": "set-completed",
                    "blockRef": "state-manager",
                    "description": "Mark workflow as completed",
                    "inputs": {
                      "operation": "set",
                      "path": "status",
                      "value": "\"completed\"",
                      "sessionId": "{{_sessionId}}"
                    }
                  }
                ]
              }
            ]
          },

          {
            "id": "interaction-handler-loop",
            "blockRef": "interaction-handler",
            "description": "Interaction handler agent running in parallel (terminates when main-workflow ends)"
          }
        ]
      }
    ],

    "connections": []
  },

  "metadata": {
    "category": "development",
    "tags": ["workflow", "autonomous", "development", "full-pipeline", "v4"],
    "author": "maestro-team",
    "tier": 1
  }
}
```

### Differences cles avec le spec

| Element du spec | Correction dans le plan | Raison |
|-----------------|------------------------|--------|
| `"type": "blockRef"` + `"blockId": "xxx"` | `"blockRef": "xxx"` (pas de type) | Codebase convention — `ExecuteRegularNodeAsync` detecte `blockRef` |
| `"type": "decision"` | `"type": "conditional"` | `ExecuteConditionalNodeAsync` est cale sur `"conditional"` |
| `"ifTrue"` / `"ifFalse"` | `"then"` / `"else"` | `condNode.TryGetProperty("then", ...)` dans le code |
| `"type": "write"` | `"type": "set-variable"` | Case `"set-variable"` dans le switch |
| `"children": [...]` | `"nodes": [...]` | Le code utilise `TryGetProperty("nodes", ...)` partout |
| `"collection": "xxx"` dans for-each | `"source": "xxx"` | `forEachNode.TryGetProperty("source", ...)` |
| `"input": {}` | `"inputs": {}` | Coherence avec le workflow existant |
| `{{results.xxx}}` | `{{_nodeResult_xxx}}` | Les resultats sont stockes dans `_nodeResult_{nodeId}` |
| `"branches": {}` dans decision | Non supporte actuellement | A implementer en 34-B |
| `"type": "sequence"` | Implicite (pas de type) | Les `nodes` d'un parent sont sequentiels par defaut |
| `"type": "parallel"` | Conserve (type explicite) | A implementer en 34-B |

### Simplifications par rapport au spec

Le spec definit un workflow ideal avec des features qui n'existent pas encore. Ce plan fait les adaptations suivantes :

1. **Pas de routing multi-way des developers** — le spec envisage `branches: { "backend-developer": ..., "frontend-developer": ..., "styling-developer": ... }`. Ce feature n'existe pas dans `ExecuteConditionalNodeAsync`. A la place, on utilise `implement-single-step` existant comme executeur unique (il peut etre remplace par les developers specialises quand le routing multi-way sera implemente en 34-B).

2. **Pas de `computeScore` inline** — le spec calcule `reviewScore = code * 0.5 + security * 0.3 + architecture * 0.2`. Ce calcul ne peut pas etre fait par un `set-variable` (qui ne fait que copier). A la place, le `code-reviewer` v4 retournera directement un `approved: true/false` dans sa sortie.

3. **Le `parallel` racine est bloquant** — tant que 34-B n'implemente pas `ExecuteParallelNodeAsync`, le workflow ne pourra pas tourner avec l'interaction-handler en parallele. La structure est en place pour quand l'implementation existera.

4. **Les conditions utilisent des heuristiques simples** — `"condition": "{{_nodeResult_xxx}} contains yyy"` au lieu des expressions complexes du spec. L'evaluateur de conditions existant (`EvaluateCondition`) supporte `==`, `!=`, `contains`, `true`/`false`.

---

## Fichier 2 : project-v4.session.json

### Session template JSON complete

```json
{
  "id": "project-v4",
  "name": "Maestro Agent v4 — Autonomous Development",
  "description": "Project session using the maestro-agent-v4 workflow. Provides the complete 7-phase pipeline: comprendre -> planifier -> implementer -> verifier -> reviewer -> iterer -> livrer, with interaction-handler in parallel.",

  "type": "project",
  "authority": {
    "type": "human",
    "identifier": "default",
    "displayName": "Developer"
  },

  "permissions": {
    "allowedCommands": ["*"],
    "allowedTools": ["*"],
    "allowedBlocks": ["*"],
    "canCreateBlocks": false,
    "canCreateSessions": false,
    "canAccessNetwork": true,
    "canAccessFilesystem": true
  },

  "entryPoints": {
    "dev": "maestro-agent-v4",
    "plan": "task-planner",
    "review": "code-reviewer",
    "analyze": "project-analyzer"
  },

  "variables": {
    "sessionMode": "autonomous-dev-v4",
    "currentTask": "",
    "currentStep": "idle",
    "filesModified": [],
    "testsPassed": false,
    "reviewScore": 0,
    "reviewApproved": false,
    "planValid": false,
    "reviewFeedback": "",
    "userOverrides": "",
    "iteration": 0,

    "_phases": [
      { "id": "comprendre", "name": "1. Comprendre", "status": "pending", "description": "Analyze project, design architecture, research" },
      { "id": "planifier", "name": "2. Planifier", "status": "pending", "description": "Create and validate implementation plan" },
      { "id": "implementer", "name": "3. Implementer", "status": "pending", "description": "Implement each plan step with specialized developers" },
      { "id": "verifier", "name": "4. Verifier", "status": "pending", "description": "Write tests, run tests, E2E, UI review" },
      { "id": "reviewer", "name": "5. Reviewer", "status": "pending", "description": "Code review, security audit, architecture check" },
      { "id": "iteration", "name": "6. Iterer", "status": "pending", "description": "Loop implement-verify-review if score < threshold" },
      { "id": "livrer", "name": "7. Livrer", "status": "pending", "description": "Commit, changelog, final report" }
    ],

    "_workflowState": {},
    "_blockOutputs": {},
    "_llmActivity": [],
    "_executionLog": [],
    "_executionTree": [],
    "_planSteps": [],

    "_monitorDescriptor": {
      "layout": {
        "mode": "phased-v2",
        "zones": {
          "header-left": { "width": "60%", "height": 7, "components": ["header"] },
          "header-right": { "width": "40%", "height": 7, "components": ["session-metrics"] },
          "left": { "width": "55%", "height": "75%", "components": ["phase-workflow"] },
          "right": { "width": "45%", "height": "75%", "components": ["llm-activity"] },
          "bottom": { "width": "100%", "height": "25%", "components": ["execution-log"] }
        }
      },
      "components": [
        { "id": "phase-workflow", "type": "phase-workflow", "data": ["$.variables._phases", "$.variables._executionTree"] },
        { "id": "llm-activity", "type": "llm-activity", "data": "$.variables._llmActivity" },
        { "id": "execution-log", "type": "execution-log", "data": "$.variables._executionLog" },
        { "id": "session-metrics", "type": "widgets", "data": "$.monitorWidgets" }
      ]
    }
  },

  "monitorWidgets": [
    {
      "id": "current-phase",
      "type": "counter",
      "zone": "custom",
      "config": {
        "label": "Current Phase",
        "value": "$.variables.currentStep"
      }
    },
    {
      "id": "iteration-count",
      "type": "counter",
      "zone": "custom",
      "config": {
        "label": "Iteration",
        "value": "$.variables.iteration"
      }
    },
    {
      "id": "review-score",
      "type": "counter",
      "zone": "custom",
      "config": {
        "label": "Review Score",
        "value": "$.variables.reviewScore"
      }
    },
    {
      "id": "plan-valid",
      "type": "counter",
      "zone": "custom",
      "config": {
        "label": "Plan Valid",
        "value": "$.variables.planValid"
      }
    },
    {
      "id": "tests-passed",
      "type": "counter",
      "zone": "custom",
      "config": {
        "label": "Tests",
        "value": "$.variables.testsPassed"
      }
    }
  ],

  "config": {
    "maxIterations": 200,
    "timeout": 14400000,
    "autoSave": true,
    "saveInterval": 15000
  },

  "metadata": {
    "category": "development",
    "priority": "high",
    "version": "4.0.0",
    "author": "maestro-phase-34"
  }
}
```

### Differences avec project-autonomous.session.json (v3)

| Aspect | v3 (project-autonomous) | v4 (project-v4) |
|--------|-------------------------|------------------|
| Workflow | `autonomous-development` | `maestro-agent-v4` |
| Phases | 7 (prepare, plan, validate, implement, test, review, commit) | 7 (comprendre, planifier, implementer, verifier, reviewer, iteration, livrer) |
| Phase IDs | English (prepare, plan...) | French (comprendre, planifier...) — matches spec |
| Variables | Basic (currentTask, reviewScore) | Extended (planValid, reviewApproved, reviewFeedback, userOverrides, iteration) |
| `_workflowState` | Non existent | Present — state-manager shared state |
| `_planSteps` | Not pre-declared | Pre-declared as empty array |
| Entry points | dev, plan, review | dev, plan, review, analyze |
| Timeout | 2h (7200000) | 4h (14400000) — v4 workflow is longer |
| Widgets | 3 (step, score, tests) | 5 (phase, iteration, score, plan, tests) |

---

## Variables de workflow et templates

### Comment les templates se resolvent

Le `EntryPointExecutor` utilise `ResolveTemplate()` pour remplacer `{{xxx}}` par des valeurs. Les sources de resolution sont :

1. **Session variables** : `session.GetVariable("xxx")` — donc `{{iteration}}` lit la variable `iteration`
2. **`inputs.xxx`** : les inputs fournis lors du `session invoke` — donc `{{inputs.task}}` lit l'input `task`
3. **`_nodeResult_xxx`** : le resultat du noeud `id: "xxx"` — stocke automatiquement apres execution
4. **`previousOutput`** : la sortie du noeud precedent — `{{previousOutput}}`
5. **`_currentItemJson`** : dans un for-each, l'item courant serialise en JSON

### Tableau de resolution des variables cles

| Template dans le workflow | Resolu depuis | Quand disponible |
|---------------------------|---------------|------------------|
| `{{inputs.task}}` | Input du `session invoke` | Des le debut |
| `{{inputs.repoPath}}` | Input du `session invoke` | Des le debut |
| `{{_nodeResult_analyze-project}}` | Resultat de l'execution du noeud `analyze-project` | Apres phase comprendre |
| `{{_nodeResult_design-architecture}}` | Resultat du noeud `design-architecture` | Apres phase comprendre |
| `{{_nodeResult_do-research}}` | Resultat du noeud `do-research` | Apres phase comprendre (si la condition est vraie) |
| `{{_nodeResult_create-plan}}` | Resultat du noeud `create-plan` | Apres phase planifier |
| `{{_nodeResult_validate-plan}}` | Resultat du noeud `validate-plan` | Apres chaque iteration du plan-loop |
| `{{planValid}}` | Variable de session `planValid` | Mise a jour par `set-plan-valid` |
| `{{reviewApproved}}` | Variable de session `reviewApproved` | Mise a jour par `compute-approved` |
| `{{reviewFeedback}}` | Variable de session `reviewFeedback` | Mise a jour par `aggregate-feedback` |
| `{{iteration}}` | Variable de session `iteration` | Auto-incrementee par le while loop |
| `{{_planSteps}}` | Variable de session `_planSteps` | Mise a jour par `store-plan` |
| `{{_currentItemJson}}` | Item courant dans le for-each | Pendant l'iteration for-each |
| `{{_sessionId}}` | ID de la session | Toujours disponible (injecte par l'executor) |

### Note sur `_sessionId`

Le state-manager a besoin du `sessionId` pour appeler l'API REST. Actuellement, l'`EntryPointExecutor` n'injecte PAS `_sessionId` comme variable. Deux options :

1. **Ajouter `session.SetVariable("_sessionId", sessionId.Value)` dans `ExecuteWorkflowAsync`** — modification C# mineure, a faire en 34-B.
2. **Passer le sessionId via l'env var `MAESTRO_SESSION_ID`** — l'executor pourrait le setter dans le `ProcessStartInfo.Environment` lors de l'execution des tool blocks. A faire en 34-B.

En attendant, le state-manager fonctionnera si le `sessionId` est passe explicitement dans les inputs du noeud.

---

## Phase de pre-requis 34-B

Le workflow ne pourra s'executer completement qu'apres l'implementation de ces features dans 34-B :

| Feature | Impact sur le workflow | Criticite |
|---------|----------------------|-----------|
| `ExecuteParallelNodeAsync` | Le noeud `root` (parallel) ne sera pas execute | BLOQUANT pour l'interaction-handler. Le main-workflow peut fonctionner seul si on le change en noeud implicite (retirer le parallel wrapper). |
| Multi-way `branches` dans conditional | Le routing des developers ne fonctionne pas | CONTOURNABLE — on utilise `implement-single-step` a la place |
| `_sessionId` injection | Le state-manager ne peut pas appeler l'API | CONTOURNABLE — passer le sessionId dans les inputs |

### Strategie d'execution sans 34-B

Pour tester le workflow AVANT que 34-B soit fait :

1. **Retirer le wrapper `parallel` racine** — executer `main-workflow.nodes` directement comme top-level `config.nodes`
2. **Ignorer l'interaction-handler** — il sera ajoute quand `parallel` sera implemente
3. **Passer `sessionId` en dur** dans les inputs du session invoke pour les noeuds state-manager

Version simplifiee pour test sans parallel :

```json
{
  "config": {
    "nodes": [
      { "id": "init", "blockRef": "state-manager", "inputs": { ... } },
      { "id": "load-memory", "blockRef": "memory-read", "inputs": { ... } },
      { "id": "phase-comprendre", "phaseId": "comprendre", "nodes": [ ... ] },
      ...
    ]
  }
}
```

Cela fonctionne car les `nodes` de premier niveau sont executes sequentiellement par defaut.

---

## Verification

### 1. Verification de la decouverte du bloc

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'maestro-agent-v4'"
# Resultat attendu : maestro-agent-v4  workflow  4.0.0
```

### 2. Verification de la structure JSON

```bash
# Valider que le JSON est syntaxiquement correct
powershell.exe -Command "Get-Content C:\Meastro\content\system\blocks\workflows\maestro-agent-v4.workflow.block.json | ConvertFrom-Json | Select-Object id, blockType, version"
# Resultat attendu : id=maestro-agent-v4, blockType=workflow, version=4.0.0
```

### 3. Verification du session template

```bash
powershell.exe -Command "Get-Content C:\Meastro\content\system\templates\sessions\project-v4.session.json | ConvertFrom-Json | Select-Object id, type"
# Resultat attendu : id=project-v4, type=project
```

### 4. Test de bout en bout (necessite backend + tous les blocs)

```bash
# 1. Creer une session v4
cd C:\Meastro\packages\maestro-cli
node index.js session create --type project --name "V4 Test - Login Page" --repo C:\SomeTestProject --template project-v4 --start

# 2. Verifier les phases
curl -s http://localhost:5000/api/sessions/<FULL-UUID>/variables/_phases | python -m json.tool
# Resultat attendu : 7 phases avec ids comprendre, planifier, implementer, verifier, reviewer, iteration, livrer

# 3. Lancer le monitor
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\packages\maestro-cli; node index.js monitor <session-id>'"

# 4. Invoquer le workflow
node index.js session invoke <session-id> dev --input task="Add a login page" --input repoPath=C:\SomeTestProject
# Le monitor devrait afficher les phases en progression
```

### 5. Test de la phase comprendre seule (sans parallel)

Si le workflow complet est trop complexe, tester phase par phase :

```bash
# Executer project-analyzer directement
node index.js run project-analyzer --input repoPath=C:\SomeTestProject --input task="Add a login page"
# Verifier que le JSON de sortie est valide

# Executer task-architect avec la sortie de project-analyzer
node index.js run task-architect --input task="Add a login page" --input projectContext="<json de project-analyzer>"
```

---

## Erreurs courantes a eviter

1. **Utiliser `"type": "blockRef"` + `"blockId":`** — FAUX. Utiliser `"blockRef": "xxx"` sans type.
2. **Utiliser `"type": "decision"`** — FAUX. Utiliser `"type": "conditional"`.
3. **Utiliser `"ifTrue"` / `"ifFalse"`** — FAUX. Utiliser `"then"` / `"else"`.
4. **Utiliser `"type": "write"`** — FAUX. Utiliser `"type": "set-variable"`.
5. **Utiliser `"children": [...]`** — FAUX (dans le contexte des while/for-each). Utiliser `"nodes": [...]`.
6. **Utiliser `"collection"` dans for-each** — FAUX. Utiliser `"source"`.
7. **Utiliser `{{results.xxx}}`** — FAUX. Utiliser `{{_nodeResult_xxx}}`.
8. **Oublier de pre-declarer les variables dans le session template** — `planValid`, `reviewApproved`, `reviewFeedback`, `iteration` doivent avoir des valeurs initiales.
9. **Oublier `isAtomic: false`** — les workflows sont TOUJOURS non-atomiques.
10. **Mettre des expressions complexes dans les conditions** — l'evaluateur supporte `==`, `!=`, `contains`, mais PAS les expressions arithmetiques (`score * 0.5 + ...`). Garder les conditions simples.

---

## Arborescence du workflow (visualisation)

```
maestro-agent-v4 (workflow)
|
+-- parallel (root) [REQUIRES 34-B]
    |
    +-- main-workflow (sequence implicite)
    |   |
    |   +-- init (blockRef: state-manager)
    |   +-- load-memory (blockRef: memory-read)
    |   |
    |   +-- phase-comprendre (sequence, phaseId: comprendre)
    |   |   +-- analyze-project (blockRef: project-analyzer)
    |   |   +-- design-architecture (blockRef: task-architect)
    |   |   +-- needs-research (conditional)
    |   |   |   +-- then: do-research (blockRef: research-agent)
    |   |   +-- checkpoint-comprendre (blockRef: state-manager)
    |   |   +-- transition-planifier (blockRef: state-manager)
    |   |
    |   +-- phase-planifier (sequence, phaseId: planifier)
    |   |   +-- plan-loop (while, max 2)
    |   |   |   +-- create-plan (blockRef: task-planner)
    |   |   |   +-- validate-plan (blockRef: plan-validator)
    |   |   |   +-- set-plan-valid (set-variable: planValid)
    |   |   +-- store-plan (set-variable: _planSteps)
    |   |   +-- checkpoint-planifier (blockRef: state-manager)
    |   |   +-- transition-implementer (blockRef: state-manager)
    |   |
    |   +-- phase-iteration-loop (while, max 3, phaseId: iteration)
    |   |   +-- phase-implementer (for-each: _planSteps, phaseId: implementer)
    |   |   |   +-- implement-step (blockRef: implement-single-step)
    |   |   |   +-- validate-step-impl (blockRef: step-validator)
    |   |   +-- checkpoint-implementer (blockRef: state-manager)
    |   |   +-- phase-verifier (sequence, phaseId: verifier)
    |   |   |   +-- write-tests (blockRef: test-writer)
    |   |   |   +-- run-tests (blockRef: test-runner)
    |   |   |   +-- has-ui (conditional)
    |   |   |       +-- then: visual-verification (sequence)
    |   |   |           +-- run-e2e (blockRef: e2e-tester)
    |   |   |           +-- review-ui (blockRef: ui-reviewer)
    |   |   |           +-- check-a11y (blockRef: accessibility-checker)
    |   |   +-- checkpoint-verifier (blockRef: state-manager)
    |   |   +-- phase-reviewer (sequence, phaseId: reviewer)
    |   |       +-- review-code (blockRef: code-reviewer)
    |   |       +-- review-security (blockRef: security-reviewer)
    |   |       +-- review-architecture (blockRef: architecture-reviewer)
    |   |       +-- compute-approved (set-variable: reviewApproved)
    |   |       +-- build-feedback (conditional)
    |   |           +-- then: aggregate-feedback (set-variable: reviewFeedback)
    |   |   +-- checkpoint-reviewer (blockRef: state-manager)
    |   |
    |   +-- phase-livrer (sequence, phaseId: livrer)
    |       +-- do-commit (blockRef: git-committer)
    |       +-- write-changelog (blockRef: changelog-writer)
    |       +-- generate-report (blockRef: summary-reporter)
    |       +-- save-learnings (conditional)
    |       |   +-- then: write-learnings (blockRef: memory-write)
    |       +-- set-completed (blockRef: state-manager)
    |
    +-- interaction-handler-loop (blockRef: interaction-handler) [REQUIRES 34-B + 34-D]
```

**Profondeur max** : 5 niveaux (parallel -> while -> for-each -> nodes -> blockRef)

---

## Blocs references par le workflow

| Block ID | Type | Existe deja | Cree dans quel plan |
|----------|------|-------------|---------------------|
| state-manager | tool | Non | Plan 09 (tool blocks) |
| memory-read | tool | Non | Plan 09 (tool blocks) |
| memory-write | tool | Non | Plan 09 (tool blocks) |
| project-analyzer | agent | Non | Plan 03 (specialists comprendre) |
| task-architect | agent | Non | Plan 03 (specialists comprendre) |
| research-agent | agent | Non | Plan 03 (specialists comprendre) |
| task-planner | agent | Oui (v2) | Plan 04 (specialists planifier) — v4 upgrade |
| plan-validator | inference | Non | Plan 04 (specialists planifier) |
| implement-single-step | agent | Oui (v3) | Plan 05 (specialists implementer) — v4 upgrade |
| step-validator | tool | Oui | Reutilise tel quel |
| test-writer | agent | Non | Plan 06 (specialists verifier) |
| test-runner | agent | Non | Plan 06 (specialists verifier) |
| e2e-tester | agent | Non | Plan 06 (specialists verifier) |
| ui-reviewer | inference | Non | Plan 06 (specialists verifier) |
| accessibility-checker | inference | Non | Plan 06 (specialists verifier) |
| code-reviewer | inference | Oui (v2) | Plan 07 (specialists reviewer) — v4 upgrade |
| security-reviewer | inference | Non | Plan 07 (specialists reviewer) |
| architecture-reviewer | inference | Non | Plan 07 (specialists reviewer) |
| git-committer | agent | Oui (v2) | Plan 08 (specialists livrer) — v4 upgrade |
| changelog-writer | inference | Non | Plan 08 (specialists livrer) |
| summary-reporter | inference | Non | Plan 08 (specialists livrer) |
| interaction-handler | agent | Non | Plan 34-D |

**Total** : 22 blocs references, dont 4 existants (step-validator, task-planner v2, implement-single-step v3, code-reviewer v2, git-committer v2) qui sont upgraded en v4 par les plans respectifs.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : JSON invalide, template de session rejete, variables mal resolues, blocs manquants references par le workflow, divergences entre les noms de noeuds dans le spec vs le codebase, bugs dans le resolving des templates.

Format par entree :
```
### [Plan 10 — WORKFLOW ORCHESTRATOR] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Pipeline de creation et publication (OBLIGATOIRE)

Le workflow block et le session template DOIVENT passer par ce pipeline complet.

### Pre-requis
1. Verifier que le backend est accessible :
   ```bash
   curl -s http://localhost:5000/api/health
   ```
2. **DEPENDANCE CRITIQUE** : Les node types `sequence` et `parallel` doivent etre implementes dans `EntryPointExecutor` (Plan A / 13-infrastructure) AVANT de tester le workflow. Sans ces types, l'execution du workflow echouera.
3. Tous les blocs references par le workflow (specialistes + tools) doivent etre crees et publies.

### Pour le workflow block :
1. **Creer le fichier** `content/system/blocks/workflows/maestro-agent-v4/maestro-agent-v4.workflow.block.json`
2. **Verifier la decouverte** par le backend :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'maestro-agent-v4'"
   ```
3. **Valider la structure JSON** : verifier que tous les `blockRef` references existent dans `list-blocks`
4. **Tester le workflow complet** dans une session :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session create --type project --name 'Test Workflow v4' --repo C:\SomeTestProject --template project-v4 --start"
   ```
5. **Publier le workflow** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block publish maestro-agent-v4"
   ```
6. **Verifier la publication** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js approvals list"
   ```

### Pour le session template :
1. **Creer le fichier** `content/system/templates/sessions/project-v4.session.json`
2. **Tester l'import du template** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session create --type project --name 'Template Test' --repo C:\SomeTestProject --template project-v4 --start"
   ```
3. **Verifier les variables** :
   ```bash
   curl -s http://localhost:5000/api/sessions/<session-id>/variables/_phases | python -m json.tool
   curl -s http://localhost:5000/api/sessions/<session-id>/variables/_monitorDescriptor | python -m json.tool
   ```

> **RAPPEL** : Un workflow cree mais non publie via `block publish` n'est PAS considere comme termine. Le statut DONE requiert la publication.

---

## Checkpoint

```markdown
## Plan — Workflow Orchestrateur v4
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers crees** :
  - maestro-agent-v4 workflow : CREE / VALIDE_JSON / TESTE / PUBLIE
  - project-v4 session template : CREE / IMPORTE / TESTE
**Backend decouvert** : OUI / NON (list-blocks)
**Session template fonctionne** : OUI / NON (session create)
**Test phases affichees** : OUI / NON (curl _phases)
**Test bout en bout** : OUI / NON / BLOQUE (parallel non implemente)
**Dependances 34-B** :
  - ExecuteParallelNodeAsync : IMPLEMENTE / NON
  - Multi-way branches : IMPLEMENTE / NON
  - _sessionId injection : IMPLEMENTE / NON
**Problemes** : [si BLOQUE]
```
