# 10. Workflow Orchestrateur — JSON Conceptuel Complet

## Block definition

```json
{
  "id": "maestro-agent-v4",
  "name": "Maestro Agent v4 — Autonomous Fullstack Developer",
  "version": "4.0.0",
  "blockType": "workflow",
  "isAtomic": false,
  "metadata": {
    "designation": "workflow",
    "category": "development",
    "description": "Workflow orchestrateur complet: comprendre → planifier → implementer → verifier → reviewer → iterer → livrer, avec interaction-handler parallele"
  },
  "config": {
    "nodes": "voir ci-dessous"
  }
}
```

---

## config.nodes — Structure complete

```json
{
  "nodes": [
    {
      "id": "root",
      "type": "parallel",
      "description": "Workflow principal + interaction-handler en parallele",
      "children": [
        {
          "id": "main-workflow",
          "type": "sequence",
          "description": "Workflow de developpement principal (7 phases)",
          "children": [

            {
              "id": "init",
              "type": "blockRef",
              "blockId": "state-manager",
              "description": "Initialiser l'etat du workflow",
              "input": {
                "operation": "set",
                "path": "",
                "value": {
                  "status": "running",
                  "currentPhase": "comprendre",
                  "iteration": 0,
                  "maxIterations": 3,
                  "results": {},
                  "history": [],
                  "userOverrides": {}
                }
              }
            },

            {
              "id": "load-memory",
              "type": "blockRef",
              "blockId": "memory-read",
              "description": "Charger la memoire persistante",
              "input": { "file": "index.md" }
            },

            {
              "id": "phase-comprendre",
              "type": "sequence",
              "description": "Phase 1: Comprendre le projet et la tache",
              "children": [
                {
                  "id": "analyze-project",
                  "type": "blockRef",
                  "blockId": "project-analyzer",
                  "description": "Analyser le projet",
                  "input": {
                    "repoPath": "{{repoPath}}",
                    "task": "{{task}}"
                  }
                },
                {
                  "id": "design-architecture",
                  "type": "blockRef",
                  "blockId": "task-architect",
                  "description": "Concevoir l'architecture de haut niveau",
                  "input": {
                    "task": "{{task}}",
                    "projectContext": "{{results.analyze-project}}"
                  }
                },
                {
                  "id": "needs-research",
                  "type": "decision",
                  "description": "Le task-architect a-t-il identifie des questions necessitant une recherche?",
                  "condition": "{{results.design-architecture.designDecisions.length}} > 0",
                  "ifTrue": {
                    "id": "do-research",
                    "type": "blockRef",
                    "blockId": "research-agent",
                    "description": "Recherche web complementaire",
                    "input": {
                      "query": "{{results.design-architecture.designDecisions[0].decision}}",
                      "projectContext": "{{results.analyze-project}}"
                    }
                  },
                  "ifFalse": null
                },
                {
                  "id": "checkpoint-comprendre",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": {
                    "operation": "set",
                    "path": "results.comprendre",
                    "value": {
                      "project": "{{results.analyze-project}}",
                      "architecture": "{{results.design-architecture}}",
                      "research": "{{results.do-research}}"
                    }
                  }
                },
                {
                  "id": "transition-planifier",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": { "operation": "transition", "phase": "planifier" }
                }
              ]
            },

            {
              "id": "phase-planifier",
              "type": "sequence",
              "description": "Phase 2: Planifier l'implementation",
              "children": [
                {
                  "id": "plan-loop",
                  "type": "while",
                  "description": "Boucle plan → validate → re-plan (max 2 iterations)",
                  "condition": "{{planValid}} == false",
                  "maxIterations": 2,
                  "evaluateFirst": false,
                  "children": [
                    {
                      "id": "create-plan",
                      "type": "blockRef",
                      "blockId": "task-planner",
                      "input": {
                        "task": "{{task}}",
                        "projectContext": "{{results.comprendre.project}}",
                        "architecture": "{{results.comprendre.architecture}}",
                        "researchContext": "{{results.comprendre.research}}",
                        "userOverrides": "{{userOverrides}}",
                        "previousValidation": "{{results.validate-plan}}"
                      }
                    },
                    {
                      "id": "validate-plan",
                      "type": "blockRef",
                      "blockId": "plan-validator",
                      "input": {
                        "plan": "{{results.create-plan}}",
                        "projectContext": "{{results.comprendre.project}}",
                        "architecture": "{{results.comprendre.architecture}}"
                      }
                    },
                    {
                      "id": "set-plan-valid",
                      "type": "write",
                      "variable": "planValid",
                      "value": "{{results.validate-plan.valid}}"
                    }
                  ]
                },
                {
                  "id": "checkpoint-planifier",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": {
                    "operation": "set",
                    "path": "results.planifier",
                    "value": {
                      "plan": "{{results.create-plan}}",
                      "validated": "{{planValid}}"
                    }
                  }
                },
                {
                  "id": "transition-implementer",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": { "operation": "transition", "phase": "implementer" }
                }
              ]
            },

            {
              "id": "phase-iteration-loop",
              "type": "while",
              "description": "Boucle principale: implementer → verifier → reviewer, max 3 iterations",
              "condition": "{{reviewApproved}} == false",
              "maxIterations": 3,
              "evaluateFirst": false,
              "children": [

                {
                  "id": "phase-implementer",
                  "type": "for-each",
                  "description": "Phase 3: Implementer chaque step du plan",
                  "collection": "{{results.planifier.plan}}",
                  "itemVariable": "currentStep",
                  "children": [
                    {
                      "id": "route-step",
                      "type": "decision",
                      "description": "Router le step vers le bon developpeur",
                      "condition": "{{currentStep.developer}}",
                      "branches": {
                        "backend-developer": {
                          "id": "exec-backend",
                          "type": "blockRef",
                          "blockId": "backend-developer",
                          "input": {
                            "step": "{{currentStep}}",
                            "projectContext": "{{results.comprendre.project}}",
                            "workingDir": "{{repoPath}}",
                            "reviewFeedback": "{{reviewFeedback}}"
                          }
                        },
                        "frontend-developer": {
                          "id": "exec-frontend",
                          "type": "blockRef",
                          "blockId": "frontend-developer",
                          "input": {
                            "step": "{{currentStep}}",
                            "projectContext": "{{results.comprendre.project}}",
                            "workingDir": "{{repoPath}}",
                            "designContext": "{{results.comprendre.architecture.visualComponents}}",
                            "reviewFeedback": "{{reviewFeedback}}"
                          }
                        },
                        "styling-developer": {
                          "id": "exec-styling",
                          "type": "blockRef",
                          "blockId": "styling-developer",
                          "input": {
                            "step": "{{currentStep}}",
                            "projectContext": "{{results.comprendre.project}}",
                            "workingDir": "{{repoPath}}",
                            "designContext": "{{results.comprendre.architecture.visualComponents}}"
                          }
                        }
                      }
                    },
                    {
                      "id": "validate-step",
                      "type": "blockRef",
                      "blockId": "step-validator",
                      "input": {
                        "step": "{{currentStep}}",
                        "implementationResult": "{{results.route-step}}",
                        "workingDir": "{{repoPath}}"
                      }
                    },
                    {
                      "id": "compile-check-periodic",
                      "type": "decision",
                      "description": "Compilation check toutes les 5 steps ou au dernier step",
                      "condition": "{{currentStep.id}} % 5 == 0 OR {{currentStep.id}} == {{planLength}}",
                      "ifTrue": {
                        "id": "do-compile",
                        "type": "blockRef",
                        "blockId": "compilation-checker",
                        "input": {
                          "projectContext": "{{results.comprendre.project}}",
                          "workingDir": "{{repoPath}}"
                        }
                      },
                      "ifFalse": null
                    }
                  ]
                },

                {
                  "id": "checkpoint-implementer",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": {
                    "operation": "set",
                    "path": "results.implementer",
                    "value": "{{results.phase-implementer}}"
                  }
                },

                {
                  "id": "phase-verifier",
                  "type": "sequence",
                  "description": "Phase 4: Verifier le code implemente",
                  "children": [
                    {
                      "id": "write-tests",
                      "type": "blockRef",
                      "blockId": "test-writer",
                      "input": {
                        "implementedSteps": "{{results.phase-implementer}}",
                        "projectContext": "{{results.comprendre.project}}",
                        "workingDir": "{{repoPath}}"
                      }
                    },
                    {
                      "id": "run-tests",
                      "type": "blockRef",
                      "blockId": "test-runner",
                      "input": {
                        "projectContext": "{{results.comprendre.project}}",
                        "workingDir": "{{repoPath}}",
                        "testsWritten": "{{results.write-tests.testsWritten}}"
                      }
                    },
                    {
                      "id": "has-ui",
                      "type": "decision",
                      "description": "Le projet a-t-il un UI a tester visuellement?",
                      "condition": "{{results.comprendre.architecture.visualComponents.hasUI}} == true",
                      "ifTrue": {
                        "id": "visual-verification",
                        "type": "sequence",
                        "children": [
                          {
                            "id": "run-e2e",
                            "type": "blockRef",
                            "blockId": "e2e-tester",
                            "input": {
                              "projectContext": "{{results.comprendre.project}}",
                              "workingDir": "{{repoPath}}",
                              "implementedSteps": "{{results.phase-implementer}}"
                            }
                          },
                          {
                            "id": "review-ui",
                            "type": "blockRef",
                            "blockId": "ui-reviewer",
                            "input": {
                              "screenshots": "{{results.run-e2e.screenshots}}",
                              "accessibilityTree": "{{results.run-e2e.accessibilityTree}}",
                              "designContext": "{{results.comprendre.architecture.visualComponents}}",
                              "projectContext": "{{results.comprendre.project}}"
                            }
                          },
                          {
                            "id": "check-a11y",
                            "type": "blockRef",
                            "blockId": "accessibility-checker",
                            "input": {
                              "accessibilityTree": "{{results.run-e2e.accessibilityTree}}"
                            }
                          }
                        ]
                      },
                      "ifFalse": null
                    }
                  ]
                },

                {
                  "id": "checkpoint-verifier",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": {
                    "operation": "set",
                    "path": "results.verifier",
                    "value": {
                      "tests": "{{results.run-tests}}",
                      "e2e": "{{results.run-e2e}}",
                      "ui": "{{results.review-ui}}",
                      "accessibility": "{{results.check-a11y}}"
                    }
                  }
                },

                {
                  "id": "phase-reviewer",
                  "type": "sequence",
                  "description": "Phase 5: Reviewer le code",
                  "children": [
                    {
                      "id": "review-code",
                      "type": "blockRef",
                      "blockId": "code-reviewer",
                      "input": {
                        "implementedSteps": "{{results.phase-implementer}}",
                        "projectContext": "{{results.comprendre.project}}",
                        "testResults": "{{results.run-tests}}",
                        "iteration": "{{iteration}}"
                      }
                    },
                    {
                      "id": "review-security",
                      "type": "blockRef",
                      "blockId": "security-reviewer",
                      "input": {
                        "implementedCode": "{{results.phase-implementer}}",
                        "projectContext": "{{results.comprendre.project}}"
                      }
                    },
                    {
                      "id": "review-architecture",
                      "type": "blockRef",
                      "blockId": "architecture-reviewer",
                      "input": {
                        "implementedCode": "{{results.phase-implementer}}",
                        "projectContext": "{{results.comprendre.project}}",
                        "architecture": "{{results.comprendre.architecture}}"
                      }
                    },
                    {
                      "id": "compute-score",
                      "type": "write",
                      "description": "Calculer le score combine",
                      "variable": "reviewScore",
                      "value": "{{results.review-code.score * 0.5 + results.review-security.score * 0.3 + results.review-architecture.score * 0.2}}"
                    },
                    {
                      "id": "compute-approved",
                      "type": "write",
                      "variable": "reviewApproved",
                      "value": "{{reviewScore >= 0.8 AND results.review-security.pass AND results.review-architecture.coherent}}"
                    },
                    {
                      "id": "build-feedback",
                      "type": "decision",
                      "description": "Si non approuve, construire le feedback pour l'iteration suivante",
                      "condition": "{{reviewApproved}} == false",
                      "ifTrue": {
                        "id": "aggregate-feedback",
                        "type": "write",
                        "variable": "reviewFeedback",
                        "value": "{{results.review-code.issues}} + {{results.review-security.vulnerabilities}} + {{results.review-architecture.issues}}"
                      },
                      "ifFalse": null
                    }
                  ]
                },

                {
                  "id": "checkpoint-reviewer",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": {
                    "operation": "set",
                    "path": "results.reviewer",
                    "value": {
                      "code": "{{results.review-code}}",
                      "security": "{{results.review-security}}",
                      "architecture": "{{results.review-architecture}}",
                      "combinedScore": "{{reviewScore}}",
                      "approved": "{{reviewApproved}}"
                    }
                  }
                },

                {
                  "id": "increment-iteration",
                  "type": "write",
                  "variable": "iteration",
                  "value": "{{iteration + 1}}"
                }
              ]
            },

            {
              "id": "phase-livrer",
              "type": "sequence",
              "description": "Phase 7: Livrer (commit, changelog, rapport)",
              "children": [
                {
                  "id": "do-commit",
                  "type": "blockRef",
                  "blockId": "git-committer",
                  "input": {
                    "implementedSteps": "{{results.phase-implementer}}",
                    "reviewResult": "{{results.reviewer}}",
                    "workingDir": "{{repoPath}}"
                  }
                },
                {
                  "id": "write-changelog",
                  "type": "blockRef",
                  "blockId": "changelog-writer",
                  "input": {
                    "commitMessage": "{{results.do-commit.commitMessage}}",
                    "implementedSteps": "{{results.phase-implementer}}",
                    "reviewResult": "{{results.reviewer}}"
                  }
                },
                {
                  "id": "generate-report",
                  "type": "blockRef",
                  "blockId": "summary-reporter",
                  "input": {
                    "task": "{{task}}",
                    "implementedSteps": "{{results.phase-implementer}}",
                    "testResults": "{{results.run-tests}}",
                    "reviewResult": "{{results.reviewer}}",
                    "commitResult": "{{results.do-commit}}",
                    "iterations": "{{iteration}}",
                    "duration": "{{elapsed}}"
                  }
                },
                {
                  "id": "save-learnings",
                  "type": "decision",
                  "condition": "{{results.generate-report.learnings.length}} > 0",
                  "ifTrue": {
                    "id": "write-learnings",
                    "type": "blockRef",
                    "blockId": "memory-write",
                    "input": {
                      "file": "learnings.md",
                      "content": "{{results.generate-report.learnings}}",
                      "mode": "append"
                    }
                  },
                  "ifFalse": null
                },
                {
                  "id": "set-completed",
                  "type": "blockRef",
                  "blockId": "state-manager",
                  "input": { "operation": "set", "path": "status", "value": "completed" }
                }
              ]
            }
          ]
        },

        {
          "id": "interaction-handler-loop",
          "type": "blockRef",
          "blockId": "interaction-handler",
          "description": "Agent d'interaction en parallele (boucle infinie, termine quand main-workflow termine)"
        }
      ]
    }
  ]
}
```

---

## Notes sur le workflow

### Types de noeuds utilises

| Type | Implemente dans EntryPointExecutor | Usage dans v4 |
|------|-----------------------------------|----------------|
| `sequence` | Oui (default, children sequentiels) | Phases, groupes d'operations |
| `blockRef` | Oui (ExecuteBlockRefAsync) | Invocation de chaque bloc |
| `decision` | Oui (ExecuteConditionalNodeAsync) | Routing des steps, checks conditionnels |
| `while` | Oui (ExecuteWhileNodeAsync) | Boucle iteration review, boucle plan validation |
| `for-each` | Oui (ExecuteForEachNodeAsync) | Iteration sur les steps du plan |
| `write` | Oui (ExecuteWriteNodeAsync) | Ecrire dans les variables de session |
| **`parallel`** | **NON — A IMPLEMENTER** | Workflow principal + interaction-handler |

### Profondeur du workflow

```
parallel (root)
  ├── sequence (main-workflow)
  │     ├── blockRef (init)
  │     ├── blockRef (load-memory)
  │     ├── sequence (phase-comprendre)
  │     │     ├── blockRef (analyze-project)
  │     │     ├── blockRef (design-architecture)
  │     │     ├── decision (needs-research)
  │     │     └── ...
  │     ├── sequence (phase-planifier)
  │     │     └── while (plan-loop)
  │     │           └── ...
  │     ├── while (phase-iteration-loop)
  │     │     ├── for-each (phase-implementer)
  │     │     │     ├── decision (route-step)
  │     │     │     ├── blockRef (validate-step)
  │     │     │     └── decision (compile-check-periodic)
  │     │     ├── sequence (phase-verifier)
  │     │     │     └── decision (has-ui)
  │     │     │           └── sequence (visual-verification)
  │     │     ├── sequence (phase-reviewer)
  │     │     └── ...
  │     └── sequence (phase-livrer)
  └── blockRef (interaction-handler-loop)
```

**Profondeur max** : 5 niveaux (parallel → sequence → while → for-each → decision → blockRef)

### Variables de workflow

| Variable | Type | Definie par | Utilisee par |
|----------|------|-------------|--------------|
| `repoPath` | string | Input utilisateur | project-analyzer, tous les developers |
| `task` | string | Input utilisateur | task-architect, task-planner |
| `planValid` | boolean | plan-validator | while (plan-loop) |
| `reviewScore` | float | compute-score | while (iteration-loop) |
| `reviewApproved` | boolean | compute-approved | while (iteration-loop) |
| `reviewFeedback` | string | aggregate-feedback | developers (iteration 2+) |
| `iteration` | number | increment-iteration | code-reviewer, while condition |
| `planLength` | number | set apres plan | compile-check-periodic |
| `elapsed` | string | runtime | summary-reporter |
