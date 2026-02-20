# Plan D2 — Interaction Handler (Workflow + TUI) : interaction-handler workflow + WidgetRenderer

**Objectif** : Creer le bloc workflow `interaction-handler` qui orchestre les 3 blocs inference + state-manager, et integrer le rendu des widgets dans le TUI `maestro code`.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/02-interaction-handler/spec.md`.
**Impact** :
- Creation de fichier JSON dans `content/system/blocks/workflows/interaction-handler/` (workflow block)
- Modification de `packages/maestro-code/App.ts` (widget rendering + polling + message sending)
- Aucune modification de code C#

**Phase d'implementation** : 34-D (ce plan est le design complet, l'implementation vient apres 34-B et 34-C)

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-workflow-tui.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient le widget protocol complet et les types de widgets
3. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 3 documents.**

---

## Vue d'ensemble de l'architecture

L'interaction-handler est le **differenciateur cle** de Maestro v4 par rapport a Claude Code brut. Il permet a l'utilisateur d'interagir avec l'agent pendant qu'il travaille — sans perdre le contexte, sans casser le workflow, et meme en changeant de direction.

```
+-- Session (parallel node racine) ---------------------------------+
|                                                                    |
|  +-- main-workflow (sequence) ---------------------------------+  |
|  |  comprendre -> planifier -> implementer -> verifier -> ...  |  |
|  |  Lit l'etat via state-manager a chaque checkpoint           |  |
|  |  Verifie _workflowStatus avant chaque noeud (CheckPauseAsync)|  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +-- interaction-handler (agent composite) --------------------+  |
|  |  Boucle infinie : attend message -> classifie -> decide ->  |  |
|  |  execute -> repond. Controle le workflow via state-manager.  |  |
|  |  Termine quand main-workflow termine (cancelled by parallel).|  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +-- state-manager (tool block, partage) ----------------------+  |
|  |  Session variables comme store.                             |  |
|  |  Operations : get, set, transition, pause, resume, rewind,  |  |
|  |  inject. Accessible par BOTH main-workflow et interaction.  |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
+--------------------------------------------------------------------+
```

### Flux de communication

```
Utilisateur (TUI)  <->  _widgetRequest / _widgetResponse (session vars)  <->  interaction-handler
                                                                           |
                                                                     state-manager
                                                                           |
                                                                     main-workflow
```

**Ce sous-plan** couvre le workflow composite `interaction-handler` et l'integration TUI (WidgetRenderer, widget polling, message sending). Les 3 blocs inference individuels sont dans `plan-blocks.md`.

---

## Dependances

### Blocs inference (Plan D1 — plan-blocks.md)

Les 3 blocs inference suivants DOIVENT exister avant de creer le workflow :

| Bloc | Verification |
|------|-------------|
| `classify-intent` | `powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks \| Select-String 'classify-intent'"` |
| `decide-action` | `powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks \| Select-String 'decide-action'"` |
| `send-widget-response` | `powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks \| Select-String 'send-widget-response'"` |

Si un bloc manque, **STOPPER** et documenter dans `docs/phases/PHASE-34/irritations.md`. Le plan-blocks.md doit etre execute en premier.

### state-manager (Plan 09)

Le `state-manager` est un tool block cree par le Plan 09 (tool-blocks). Verifier qu'il existe :

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'state-manager'"
```

Si absent → documenter dans `docs/phases/PHASE-34/irritations.md`. Le Plan 09 doit etre execute en premier.

### Plan A (13-infrastructure) — Parallel node, branches multi-way

Le workflow `interaction-handler` presuppose que les elements suivants du Plan A sont implementes :

| Dependance | Quoi | Utilise par |
|-----------|------|------------|
| **Etape 2** : `ExecuteParallelNodeAsync` | Execution parallele de children | Le noeud racine `root` du workflow v4 qui lance main-workflow + interaction-handler |
| **Etape 3** : `branches` multi-way dans conditional | Decision avec N branches | Le noeud `execute-action` dans l'interaction-handler |
| **Etape 4** : `CheckPauseAsync` | Polling de `_workflowStatus` avant chaque noeud | Le main-workflow qui attend quand l'interaction-handler set `_workflowStatus = "paused"` |
| **Etape 1** : `ExecuteSequenceNodeAsync` | Noeuds `sequence` imbriques | Les sequences internes de chaque branche d'action |

Si ces dependances ne sont pas encore implementees, le workflow peut etre CREE (fichiers JSON) mais ne pourra PAS etre TESTE end-to-end. Documenter dans `docs/phases/PHASE-34/irritations.md`.

---

## Contexte — Format attendu des blocs

### Workflow block format

```
content/system/blocks/workflows/<block-id>/
+-- <block-id>.workflow.block.json    <- Definition du bloc avec config.nodes
```

```json
{
  "id": "<block-id>",
  "name": "<Display Name>",
  "blockType": "workflow",
  "version": "4.0.0",
  "isAtomic": false,
  "description": "...",
  "inputs": [
    { "id": "inputName", "type": "string", "required": true, "description": "..." }
  ],
  "outputs": [
    { "id": "outputName", "type": "string", "description": "..." }
  ],
  "config": {
    "nodes": [
      {
        "id": "node-id",
        "type": "sequence|while|conditional|blockRef|shell|set-variable",
        "description": "...",
        "children": []
      }
    ]
  },
  "metadata": {
    "category": "interaction",
    "designation": "workflow",
    "tags": ["..."],
    "tier": 1
  }
}
```

**Points critiques** :
- Workflow blocks ont `isAtomic: false` (ils contiennent des children)
- `config.nodes` contient l'arbre complet des noeuds du workflow
- Les noeuds `blockRef` utilisent le champ `blockRef` (PAS `blockId`) pour referencer un bloc externe
- Les noeuds `set-variable` ecrivent dans les session variables
- Les noeuds `shell` executent des commandes Node.js
- Les noeuds `conditional` avec `branches` supportent le multi-way branching (dependance Plan A)
- Les noeuds `while` supportent les boucles avec condition et `maxIterations`
- Les template expressions `{{...}}` permettent de referencer les resultats des noeuds precedents et les variables de session
- Tous les tool block scripts utilisent `MAESTRO_INPUT_<KEY_UPPER>` comme convention d'env var (PAS `INPUT_<KEY>`)

---

## Partie 1 : Bloc `interaction-handler` (workflow composite)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/workflows/interaction-handler/interaction-handler.workflow.block.json` | Definition du bloc |

### Architecture interne

```
interaction-handler (workflow, boucle while)
|
+-- [1] wait-for-message
|     Lit _userMessage (session variable) et _workflowState
|     Si pas de message -> continue la boucle (noop)
|
+-- [2] check-message-valid (conditional)
|     Si message reel -> process-message (sequence)
|     |
|     +-- [2a] read-state (blockRef -> state-manager)
|     +-- [2b] classify (blockRef -> classify-intent)
|     +-- [2c] decide (blockRef -> decide-action)
|     +-- [2d] execute-action (conditional, multi-way branches)
|     |     "respond"          -> noop
|     |     "inject"           -> blockRef state-manager (operation=inject)
|     |     "pause-and-modify" -> pause -> inject -> resume
|     |     "rewind"           -> send confirmation, wait response, then rewind
|     |     "override"         -> send confirmation, wait response, then transition
|     +-- [2e] format-and-send (blockRef -> send-widget-response)
|     +-- [2f] write-widget-to-session (set-variable -> _widgetRequest)
|     +-- [2g] clear-user-message (set-variable -> _userMessage = null)
|     +-- [2h] update-conversation-history (set-variable -> _conversationHistory)
```

### Block definition JSON

```json
{
  "id": "interaction-handler",
  "name": "Interaction Handler v4",
  "blockType": "workflow",
  "version": "4.0.0",
  "isAtomic": false,
  "description": "Agent composite that manages human-agent interaction in parallel with the main workflow. Receives user messages, classifies intent, decides actions (respond, inject, pause, rewind, override), executes via state-manager, and responds via widgets. Runs as an infinite loop until the main workflow completes.",
  "inputs": [
    { "id": "sessionId", "type": "string", "required": true, "description": "Session UUID for state-manager operations" }
  ],
  "outputs": [
    { "id": "summary", "type": "string", "description": "Interaction summary when workflow ends" }
  ],
  "config": {
    "nodes": [
      {
        "id": "interaction-loop",
        "type": "while",
        "description": "Main interaction loop — runs until workflow completes or is cancelled",
        "condition": "{{_workflowStatus}} != completed",
        "maxIterations": 1000,
        "evaluateFirst": true,
        "children": [

          {
            "id": "wait-for-message",
            "type": "shell",
            "description": "Poll _userMessage every 500ms until a new message arrives or workflow completes. This is the blocking wait that makes the loop event-driven.",
            "command": "node",
            "args": ["-e", "async function poll(){const API=process.env.MAESTRO_API_URL||'http://localhost:5000';const sid=process.env.SESSION_ID;for(let i=0;i<600;i++){const r=await fetch(`${API}/api/sessions/${sid}/variables/_userMessage`);if(r.ok){const d=await r.json();if(d&&d.text){console.log(JSON.stringify(d));return;}}const s=await fetch(`${API}/api/sessions/${sid}/variables/_workflowStatus`);if(s.ok){const v=await s.text();if(v.includes('completed')){console.log(JSON.stringify({text:'__WORKFLOW_DONE__'}));return;}}await new Promise(r=>setTimeout(r,500));}console.log(JSON.stringify({text:'__TIMEOUT__'}));}poll();"]
          },

          {
            "id": "check-message-valid",
            "type": "conditional",
            "description": "Skip processing if no real message (timeout or workflow done)",
            "condition": "{{_nodeResult_wait-for-message}}",
            "then": {
              "id": "process-message",
              "type": "sequence",
              "children": [

                {
                  "id": "read-state",
                  "type": "blockRef",
                  "blockRef": "state-manager",
                  "description": "Read current workflow state for classify-intent and decide-action",
                  "input": {
                    "operation": "get",
                    "sessionId": "{{sessionId}}",
                    "path": ""
                  }
                },

                {
                  "id": "classify",
                  "type": "blockRef",
                  "blockRef": "classify-intent",
                  "description": "Classify the user's intent",
                  "input": {
                    "userMessage": "{{_nodeResult_wait-for-message.text}}",
                    "currentState": "{{_nodeResult_read-state.data}}",
                    "conversationHistory": "{{_conversationHistory}}"
                  }
                },

                {
                  "id": "decide",
                  "type": "blockRef",
                  "blockRef": "decide-action",
                  "description": "Decide what action to take",
                  "input": {
                    "classifiedIntent": "{{_nodeResult_classify}}",
                    "fullState": "{{_nodeResult_read-state.data}}",
                    "userMessage": "{{_nodeResult_wait-for-message.text}}"
                  }
                },

                {
                  "id": "execute-action",
                  "type": "conditional",
                  "description": "Route to the correct action branch based on decide-action output",
                  "condition": "{{_nodeResult_decide.action}}",
                  "branches": {

                    "respond": {
                      "id": "action-respond",
                      "type": "sequence",
                      "description": "No workflow modification needed — just pass through to send-response",
                      "children": []
                    },

                    "inject": {
                      "id": "action-inject",
                      "type": "blockRef",
                      "blockRef": "state-manager",
                      "description": "Inject value into workflow state without pausing",
                      "input": {
                        "operation": "inject",
                        "sessionId": "{{sessionId}}",
                        "path": "{{_nodeResult_decide.params.path}}",
                        "value": "{{_nodeResult_decide.params.value}}"
                      }
                    },

                    "pause-and-modify": {
                      "id": "action-pause-modify",
                      "type": "sequence",
                      "description": "Pause workflow, apply modifications, optionally rerun current step, resume",
                      "children": [
                        {
                          "id": "do-pause",
                          "type": "blockRef",
                          "blockRef": "state-manager",
                          "input": { "operation": "pause", "sessionId": "{{sessionId}}" }
                        },
                        {
                          "id": "do-modify",
                          "type": "blockRef",
                          "blockRef": "state-manager",
                          "input": {
                            "operation": "inject",
                            "sessionId": "{{sessionId}}",
                            "path": "{{_nodeResult_decide.params.modifications[0].path}}",
                            "value": "{{_nodeResult_decide.params.modifications[0].value}}"
                          }
                        },
                        {
                          "id": "do-resume",
                          "type": "blockRef",
                          "blockRef": "state-manager",
                          "input": { "operation": "resume", "sessionId": "{{sessionId}}" }
                        }
                      ]
                    },

                    "rewind": {
                      "id": "action-rewind",
                      "type": "sequence",
                      "description": "Send confirmation widget, wait for user response, then rewind if confirmed",
                      "children": [
                        {
                          "id": "send-rewind-confirmation",
                          "type": "set-variable",
                          "variable": "_widgetRequest",
                          "value": {
                            "widget": {
                              "type": "confirmation",
                              "content": "{{_nodeResult_decide.responseMessage}}",
                              "params": {
                                "action": "Rewind to {{_nodeResult_decide.params.toPhase}}",
                                "consequence": "All results after this phase will be cleared and re-executed."
                              },
                              "id": "rewind-confirm",
                              "interactive": true
                            }
                          }
                        },
                        {
                          "id": "wait-rewind-response",
                          "type": "shell",
                          "description": "Wait for user confirmation via _widgetResponse",
                          "command": "node",
                          "args": ["-e", "async function poll(){const API=process.env.MAESTRO_API_URL||'http://localhost:5000';const sid=process.env.SESSION_ID;for(let i=0;i<120;i++){const r=await fetch(`${API}/api/sessions/${sid}/variables/_widgetResponse`);if(r.ok){const d=await r.json();if(d&&d.response){console.log(JSON.stringify(d));return;}}await new Promise(r=>setTimeout(r,500));}console.log(JSON.stringify({response:'timeout'}));}poll();"]
                        },
                        {
                          "id": "do-rewind-if-confirmed",
                          "type": "conditional",
                          "condition": "{{_nodeResult_wait-rewind-response.response}} == yes",
                          "then": {
                            "id": "rewind-sequence",
                            "type": "sequence",
                            "children": [
                              {
                                "id": "rewind-pause",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": { "operation": "pause", "sessionId": "{{sessionId}}" }
                              },
                              {
                                "id": "rewind-execute",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": {
                                  "operation": "rewind",
                                  "sessionId": "{{sessionId}}",
                                  "phase": "{{_nodeResult_decide.params.toPhase}}"
                                }
                              },
                              {
                                "id": "rewind-inject",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": {
                                  "operation": "inject",
                                  "sessionId": "{{sessionId}}",
                                  "path": "{{_nodeResult_decide.params.inject.path}}",
                                  "value": "{{_nodeResult_decide.params.inject.value}}"
                                }
                              },
                              {
                                "id": "rewind-resume",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": { "operation": "resume", "sessionId": "{{sessionId}}" }
                              }
                            ]
                          },
                          "else": null
                        }
                      ]
                    },

                    "override": {
                      "id": "action-override",
                      "type": "sequence",
                      "description": "Send confirmation widget, wait for response, then bypass gate if confirmed",
                      "children": [
                        {
                          "id": "send-override-confirmation",
                          "type": "set-variable",
                          "variable": "_widgetRequest",
                          "value": {
                            "widget": {
                              "type": "confirmation",
                              "content": "{{_nodeResult_decide.responseMessage}}",
                              "params": {
                                "action": "Bypass {{_nodeResult_decide.params.gate}} gate",
                                "consequence": "The quality gate will be skipped."
                              },
                              "id": "override-confirm",
                              "interactive": true
                            }
                          }
                        },
                        {
                          "id": "wait-override-response",
                          "type": "shell",
                          "description": "Wait for user confirmation",
                          "command": "node",
                          "args": ["-e", "async function poll(){const API=process.env.MAESTRO_API_URL||'http://localhost:5000';const sid=process.env.SESSION_ID;for(let i=0;i<120;i++){const r=await fetch(`${API}/api/sessions/${sid}/variables/_widgetResponse`);if(r.ok){const d=await r.json();if(d&&d.response){console.log(JSON.stringify(d));return;}}await new Promise(r=>setTimeout(r,500));}console.log(JSON.stringify({response:'timeout'}));}poll();"]
                        },
                        {
                          "id": "do-override-if-confirmed",
                          "type": "conditional",
                          "condition": "{{_nodeResult_wait-override-response.response}} == yes",
                          "then": {
                            "id": "override-sequence",
                            "type": "sequence",
                            "children": [
                              {
                                "id": "override-pause",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": { "operation": "pause", "sessionId": "{{sessionId}}" }
                              },
                              {
                                "id": "override-transition",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": {
                                  "operation": "transition",
                                  "sessionId": "{{sessionId}}",
                                  "phase": "{{_nodeResult_decide.params.skipTo}}"
                                }
                              },
                              {
                                "id": "override-resume",
                                "type": "blockRef",
                                "blockRef": "state-manager",
                                "input": { "operation": "resume", "sessionId": "{{sessionId}}" }
                              }
                            ]
                          },
                          "else": null
                        }
                      ]
                    },

                    "default": {
                      "id": "action-default",
                      "type": "sequence",
                      "description": "Unknown action — log warning and respond",
                      "children": []
                    }
                  }
                },

                {
                  "id": "format-and-send",
                  "type": "blockRef",
                  "blockRef": "send-widget-response",
                  "description": "Format response as widget JSON",
                  "input": {
                    "responseMessage": "{{_nodeResult_decide.responseMessage}}",
                    "widgetType": "{{_nodeResult_decide.widgetType}}",
                    "widgetParams": "{{_nodeResult_decide.widgetParams}}"
                  }
                },

                {
                  "id": "write-widget-to-session",
                  "type": "set-variable",
                  "description": "Write the widget JSON to _widgetRequest for the TUI to pick up",
                  "variable": "_widgetRequest",
                  "value": "{{_nodeResult_format-and-send}}"
                },

                {
                  "id": "clear-user-message",
                  "type": "set-variable",
                  "description": "Clear _userMessage so the next poll waits for a new message",
                  "variable": "_userMessage",
                  "value": null
                },

                {
                  "id": "update-conversation-history",
                  "type": "set-variable",
                  "description": "Append this exchange to conversation history (kept to last 10)",
                  "variable": "_conversationHistory",
                  "value": "{{_conversationHistory.concat([{role:'user',content:_nodeResult_wait-for-message.text,time:new Date().toISOString()},{role:'assistant',content:_nodeResult_decide.responseMessage,time:new Date().toISOString()}]).slice(-10)}}"
                }
              ]
            },
            "else": null
          }
        ]
      }
    ]
  },
  "metadata": {
    "category": "interaction",
    "designation": "workflow",
    "tags": ["interaction", "parallel", "widget", "pause", "resume", "rewind", "v4"],
    "tier": 1
  }
}
```

### Points critiques — Architecture du workflow

1. **Boucle `while`** — L'interaction-handler est une boucle `while` avec `maxIterations: 1000` et condition `_workflowStatus != completed`. Quand le main-workflow termine, il set `_workflowStatus = "completed"`, et la boucle s'arrete naturellement au prochain cycle.

2. **`wait-for-message` est un noeud `shell`** — Il fait du polling (500ms) sur `_userMessage` via l'API REST. C'est le point d'attente qui rend la boucle event-driven. Sans message, il attend jusqu'a 5 minutes (600 iterations x 500ms), puis timeout. Ce n'est PAS un busy-wait : il dort 500ms entre chaque poll.

3. **Le `check-message-valid` filtre les timeouts** — Si le message est `__TIMEOUT__` ou `__WORKFLOW_DONE__`, le noeud `process-message` est skippe et la boucle recommence (verification de la condition while).

4. **Les branches `rewind` et `override` sont interactives** — Elles ecrivent un widget `confirmation` dans `_widgetRequest`, puis attendent `_widgetResponse` via un deuxieme noeud shell polling. C'est un cycle requete-reponse asynchrone via session variables.

5. **`_conversationHistory`** est mise a jour a chaque echange — gardee a 10 entries max pour limiter la taille du contexte.

6. **`clear-user-message`** est critique — sans ce noeud, le prochain tour de boucle re-traiterait le meme message.

### Concurrence — Points sensibles

| Situation | Risque | Mitigation |
|-----------|--------|------------|
| Interaction-handler lit `_workflowState` pendant que main-workflow l'ecrit | Read stale | Acceptable (MVP) — l'interaction-handler lit un snapshot recent, pas l'etat exact |
| Interaction-handler ecrit `_workflowStatus = paused` pendant un save du main-workflow | Race condition sur le fichier JSON | MVP : last-write-wins. Phase 34-D+ : SemaphoreSlim dans EntryPointExecutor |
| Deux messages utilisateur arrivent en 500ms | Le premier est traite, le second ecrase `_userMessage` | Acceptable (MVP) — en pratique l'utilisateur ne tape pas si vite |
| Le workflow termine pendant que l'interaction-handler attend `_widgetResponse` | Poll de 60s sur un widget que personne ne verra | Le timeout du poll (60s) finit, retourne "timeout", la boucle while verifie la condition et s'arrete |

### Verification du workflow

```bash
# Bloc decouvert
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'interaction-handler'"
# Resultat attendu : interaction-handler  workflow  4.0.0
```

---

## Widget Protocol — Communication TUI

### Session variables utilisees

| Variable | Ecrit par | Lu par | Format |
|----------|-----------|--------|--------|
| `_userMessage` | maestro code (TUI) | interaction-handler | `{text: string, time: string}` |
| `_widgetRequest` | interaction-handler | maestro code (TUI) | `{widget: {type, content, params, id, interactive?, timestamp}}` |
| `_widgetResponse` | maestro code (TUI) | interaction-handler | `{response: string, widgetId: string}` |
| `_conversationHistory` | interaction-handler | classify-intent | `[{role, content, time}]` (max 10) |
| `_workflowStatus` | state-manager / main-workflow | interaction-handler / CheckPauseAsync | `"running" \| "paused" \| "completed"` |
| `_workflowState` | state-manager | interaction-handler / main-workflow | `{status, currentPhase, results, history, userOverrides}` |

### Flux complet d'un echange

```
1. Utilisateur tape "T'en es ou ?" dans maestro code
2. maestro code ecrit PUT /api/sessions/{id}/variables/_userMessage
   body: { "value": { "text": "T'en es ou ?", "time": "2026-02-19T14:30:00Z" } }

3. interaction-handler (wait-for-message) detecte le nouveau _userMessage

4. read-state: state-manager.get("") -> {status:"running", currentPhase:"implementer", ...}

5. classify-intent:
   Input: userMessage="T'en es ou ?", currentState={...}
   Output: {intent:"question", urgency:"none", requiresPause:false, ...}

6. decide-action:
   Input: classifiedIntent={...}, fullState={...}, userMessage="T'en es ou ?"
   Output: {action:"respond", responseMessage:"J'implemente le step 3...", widgetType:"progress", widgetParams:{phases:[...]}}

7. execute-action: branche "respond" -> noop (pas de modification du workflow)

8. send-widget-response: formate en widget JSON

9. write-widget-to-session: PUT /api/sessions/{id}/variables/_widgetRequest
   body: { "value": { "widget": { "type": "progress", "content": "J'implemente le step 3...", ... } } }

10. clear-user-message: PUT /api/sessions/{id}/variables/_userMessage
    body: { "value": null }

11. maestro code (polling 500ms) detecte _widgetRequest, rend le widget progress

12. Le main-workflow n'a PAS ete interrompu — il continue en parallele
```

---

## Partie 2 : Integration TUI — Modifications de `packages/maestro-code/App.ts`

### Vue d'ensemble des changements

Le fichier `packages/maestro-code/App.ts` doit etre modifie pour :

1. **Envoyer les messages de l'utilisateur** vers `_userMessage` (au lieu de creer une nouvelle session par message)
2. **Poller `_widgetRequest`** a 500ms et rendre les widgets
3. **Capturer les reponses** aux widgets interactifs et les ecrire dans `_widgetResponse`
4. **Afficher les widgets** selon leur type (message, progress, confirmation, option-select, etc.)

### Mode dual : premier message = creation de session, messages suivants = interaction

```
Premier message de l'utilisateur :
  -> Cree la session, importe le template, start, invoke (comportement actuel)
  -> La session demarre le workflow v4 (parallel: main-workflow + interaction-handler)

Messages suivants (quand busy=true) :
  -> Ecrit dans _userMessage via PUT API
  -> L'interaction-handler les traite
  -> Les widgets sont affiches via le poller _widgetRequest
```

### Nouveau composant : `WidgetRenderer`

```typescript
// Ajout dans App.ts

interface Widget {
  type: string;
  content: string;
  params: Record<string, any>;
  id: string;
  interactive?: boolean;
  timestamp?: string;
}

const WidgetRenderer = ({
  widget,
  onResponse,
}: {
  widget: Widget | null;
  onResponse: (response: string) => void;
}) => {
  if (!widget) return null;

  switch (widget.type) {
    case 'message':
      return h(Box, { borderStyle: 'round', borderColor: 'blue', paddingX: 1, marginY: 1 },
        h(Text, { color: 'blue', bold: true }, 'Agent: '),
        h(Text, null, widget.content)
      );

    case 'progress':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'cyan',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'cyan', bold: true }, 'Progress'),
        h(Text, null, widget.content),
        ...(widget.params.phases || []).map((phase: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: phase.status === 'completed' ? 'green'
                : phase.status === 'in_progress' ? 'yellow'
                : 'gray',
            },
              phase.status === 'completed' ? '  [done] '
                : phase.status === 'in_progress' ? '  [>>]   '
                : '  [  ]   '
            ),
            h(Text, null, `${phase.name}${phase.detail ? ` — ${phase.detail}` : ''}`)
          )
        )
      );

    case 'confirmation':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'yellow',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'yellow', bold: true }, 'Confirmation required'),
        h(Text, null, widget.content),
        h(Text, { color: 'gray', dimColor: true },
          `Action: ${widget.params.action || 'N/A'}`
        ),
        h(Text, { color: 'gray', dimColor: true },
          `Consequence: ${widget.params.consequence || 'N/A'}`
        ),
        h(Text, { color: 'cyan' }, 'Type "yes" or "no" to respond.')
      );

    case 'option-select':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'magenta',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'magenta', bold: true }, widget.params.prompt || 'Choose:'),
        h(Text, null, widget.content),
        ...(widget.params.options || []).map((opt: any, i: number) =>
          h(Box, { key: i },
            h(Text, { color: 'cyan' }, `  [${opt.id}] `),
            h(Text, null, opt.label),
            opt.description
              ? h(Text, { color: 'gray', dimColor: true }, ` — ${opt.description}`)
              : null
          )
        ),
        h(Text, { color: 'cyan' }, 'Type the option ID to select.')
      );

    case 'plan-view':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'green',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'green', bold: true }, 'Implementation Plan'),
        ...(widget.params.steps || []).map((step: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: step.status === 'done' ? 'green'
                : step.status === 'in_progress' ? 'yellow'
                : 'gray',
            },
              step.status === 'done' ? '  [done] '
                : step.status === 'in_progress' ? '  [>>]   '
                : '  [  ]   '
            ),
            h(Text, null, step.description),
            step.domain
              ? h(Text, { color: 'gray', dimColor: true }, ` (${step.domain})`)
              : null
          )
        )
      );

    case 'test-results':
      return h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'green',
        paddingX: 1,
        marginY: 1,
      },
        h(Text, { color: 'green', bold: true }, 'Test Results'),
        ...(widget.params.suites || []).map((suite: any, i: number) =>
          h(Box, { key: i },
            h(Text, {
              color: suite.failed > 0 ? 'red' : 'green',
            }, `  ${suite.name}: `),
            h(Text, { color: 'green' }, `${suite.passed} passed`),
            suite.failed > 0
              ? h(Text, { color: 'red' }, ` / ${suite.failed} failed`)
              : null
          )
        )
      );

    default:
      return h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 1, marginY: 1 },
        h(Text, { color: 'gray' }, `[${widget.type}] ${widget.content}`)
      );
  }
};
```

### Modifications au `SessionManager`

Ajouter les methodes suivantes au `SessionManager` class dans `packages/maestro-code/App.ts` :

```typescript
// Dans SessionManager class:

private widgetPollTimer: ReturnType<typeof setInterval> | null = null;
private lastWidgetId: string | null = null;
private pendingInteractiveWidget: Widget | null = null;

/**
 * Send a user message to the interaction-handler via _userMessage.
 * Used when a session is already running (busy=true).
 */
async sendMessage(
  message: string,
  addLine: (line: LogLine) => void
): Promise<void> {
  if (!this.sessionId) return;

  try {
    await this.client._fetch('PUT',
      `/api/sessions/${this.sessionId}/variables/_userMessage`,
      { body: { value: { text: message, time: new Date().toISOString() } } }
    );
    addLine({ text: `> ${message}`, color: 'green', bold: true, timestamp: ts() });
  } catch (err: any) {
    addLine({ text: `Error sending message: ${err.message}`, color: 'red', timestamp: ts() });
  }
}

/**
 * Start polling _widgetRequest for widget updates from the interaction-handler.
 */
startWidgetPolling(
  addLine: (line: LogLine) => void,
  setWidget: (w: Widget | null) => void,
  setPendingInteractive: (w: Widget | null) => void
): void {
  this.widgetPollTimer = setInterval(async () => {
    try {
      const session = await this.client.getSession(this.sessionId);
      const vars = session.variables || {};
      const widgetReq = vars._widgetRequest;

      if (widgetReq && widgetReq.widget && widgetReq.widget.id !== this.lastWidgetId) {
        this.lastWidgetId = widgetReq.widget.id;
        const widget = widgetReq.widget as Widget;
        setWidget(widget);

        // For non-interactive widgets, also add to log
        if (!widget.interactive) {
          addLine({
            text: `[${widget.type}] ${widget.content}`,
            color: 'blue',
            timestamp: widget.timestamp || ts(),
          });
        } else {
          // Interactive widget — user must respond
          setPendingInteractive(widget);
        }
      }
    } catch {
      // Non-fatal
    }
  }, 500);
}

/**
 * Send user response to an interactive widget via _widgetResponse.
 */
async sendWidgetResponse(
  response: string,
  widgetId: string,
  addLine: (line: LogLine) => void
): Promise<void> {
  if (!this.sessionId) return;

  try {
    await this.client._fetch('PUT',
      `/api/sessions/${this.sessionId}/variables/_widgetResponse`,
      { body: { value: { response, widgetId } } }
    );
    addLine({ text: `  Response: ${response}`, color: 'cyan', timestamp: ts() });
  } catch (err: any) {
    addLine({ text: `Error sending response: ${err.message}`, color: 'red', timestamp: ts() });
  }
}

stopWidgetPolling(): void {
  if (this.widgetPollTimer) {
    clearInterval(this.widgetPollTimer);
    this.widgetPollTimer = null;
  }
}
```

### Modifications au `InteractiveApp`

Le `handleSubmit` doit etre modifie pour distinguer :
- **Premier message** (pas de session active) -> creer la session (comportement actuel)
- **Messages suivants** (session active, `busy=true`) -> envoyer via `sendMessage`
- **Reponse a un widget interactif** (pendingInteractive != null) -> envoyer via `sendWidgetResponse`

```typescript
// Modifications dans InteractiveApp:

// Ajouter state:
const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);

// Modifier handleSubmit:
const handleSubmit = useCallback((input: string) => {
  if (pendingInteractive) {
    // User is responding to an interactive widget
    addLine({ text: `> ${input}`, color: 'green' });
    sessionManager?.sendWidgetResponse(input, pendingInteractive.id, addLine);
    setPendingInteractive(null);
    setCurrentWidget(null);
    return;
  }

  if (busy && sessionManager?.getSessionId()) {
    // Session running — send as user message to interaction-handler
    sessionManager.sendMessage(input, addLine);
    return;
  }

  // First message — create session (existing behavior)
  addLine({ text: `> ${input}`, color: 'green', bold: true });
  if (sessionManager) {
    sessionManager.submitTask(input, addLine, (b) => {
      setBusy(b);
      if (!b) {
        setCurrentSessionId(null);
        sessionManager.stopWidgetPolling();
      } else {
        setCurrentSessionId(sessionManager.getSessionId());
        // Start widget polling when session begins
        sessionManager.startWidgetPolling(addLine, setCurrentWidget, setPendingInteractive);
      }
    });
  }
}, [addLine, sessionManager, busy, pendingInteractive]);

// Modifier le render pour inclure le widget:
return h(Box, { flexDirection: 'column', width: '100%', height: rows },
  h(OutputPanel, { lines, height: outputHeight - (currentWidget ? 8 : 0) }),
  currentWidget ? h(WidgetRenderer, { widget: currentWidget, onResponse: () => {} }) : null,
  h(StatusBar, { sessionId: currentSessionId, busy }),
  h(InputPrompt, {
    onSubmit: handleSubmit,
    disabled: false,  // CHANGED: no longer disabled when busy
    placeholder: pendingInteractive
      ? 'Respond to the widget above...'
      : busy
        ? 'Send a message to the agent...'
        : 'Describe your task...',
  })
);
```

### Points critiques — Integration TUI

1. **`disabled` supprime sur InputPrompt quand busy** — C'est le changement fondamental. Actuellement, quand un workflow est en cours, l'input est desactive. Avec l'interaction-handler, l'utilisateur DOIT pouvoir taper pendant que le workflow tourne.

2. **Le placeholder change dynamiquement** — il indique clairement a l'utilisateur ce qu'on attend de lui (reponse widget vs message libre vs nouvelle tache).

3. **Le widget n'est affiche que si il est nouveau** (deduplication par `widget.id`) — cela evite de reafficher le meme widget a chaque poll.

4. **Les widgets interactifs bloquent conceptuellement** — le `pendingInteractive` state indique qu'on attend une reponse. Le prochain input de l'utilisateur est traite comme une reponse au widget.

5. **Le `startWidgetPolling` est lance en meme temps que le session polling** — pas besoin de les separer.

---

## Fichiers a creer (nouveaux)

| Fichier | Type |
|---------|------|
| `content/system/blocks/workflows/interaction-handler/interaction-handler.workflow.block.json` | Block JSON |

## Fichiers a modifier (existants)

| Fichier | Modification | Risque |
|---------|-------------|--------|
| `packages/maestro-code/App.ts` | Ajouter WidgetRenderer, modifier SessionManager, modifier InteractiveApp | Moyen — impact sur l'UX existante |

---

## Scenarios de test detailles

### Scenario 1 : Question simple — "T'en es ou ?"

**Preconditions** : Session active, main-workflow en phase `implementer`, step 3/5.

| Etape | Bloc | Input | Output attendu |
|-------|------|-------|----------------|
| 1 | TUI | "T'en es ou ?" | -> `_userMessage = {text: "T'en es ou ?"}` |
| 2 | classify-intent | userMessage="T'en es ou ?" | `{intent:"question", urgency:"none", requiresPause:false}` |
| 3 | decide-action | intent=question, state=... | `{action:"respond", widgetType:"progress", responseMessage:"J'implemente le step 3/5..."}` |
| 4 | execute-action | action="respond" | Branche respond -> noop |
| 5 | send-widget-response | widgetType="progress" | Widget JSON |
| 6 | TUI | Widget progress | Affiche les phases avec statuts |

**Impact workflow** : AUCUN. Le main-workflow continue sans interruption.

**Verification** :
```bash
# Verifier que _workflowStatus est reste "running"
curl -s http://localhost:5000/api/sessions/<UUID>/variables/_workflowStatus
# "running"

# Verifier le widget
curl -s http://localhost:5000/api/sessions/<UUID>/variables/_widgetRequest | python -m json.tool
# {"widget":{"type":"progress",...}}
```

### Scenario 2 : Feedback urgent — "Stop, utilise des tabs pas des espaces"

**Preconditions** : Session active, main-workflow en phase `implementer`.

| Etape | Bloc | Input | Output attendu |
|-------|------|-------|----------------|
| 1 | TUI | "Stop, utilise des tabs pas des espaces" | -> `_userMessage` |
| 2 | classify-intent | | `{intent:"change-request", urgency:"immediate", requiresPause:true, affectedPhases:["current"]}` |
| 3 | decide-action | | `{action:"pause-and-modify", params:{modifications:[{path:"results.comprendre.project.conventions.indentation",value:"tabs"}],rerunCurrentStep:true}}` |
| 4 | execute-action | action="pause-and-modify" | Branche pause-and-modify: pause -> inject -> resume |
| 5 | state-manager | operation=pause | `_workflowStatus = "paused"` |
| 6 | state-manager | operation=inject | `_workflowState.results.comprendre.project.conventions.indentation = "tabs"` |
| 7 | state-manager | operation=resume | `_workflowStatus = "running"` |
| 8 | send-widget-response | "OK, je passe aux tabs..." | Widget message |

**Impact workflow** : PAUSE momentanee pendant la modification, puis reprise.

### Scenario 3 : Changement de direction — "Finalement, utilise une classe"

**Preconditions** : Session active, main-workflow en phase `implementer`, step 2/5.

| Etape | Bloc | Input | Output attendu |
|-------|------|-------|----------------|
| 1 | classify-intent | "Finalement, utilise une classe au lieu de fonctions pures" | `{intent:"change-request", urgency:"immediate", affectedPhases:["plan","implement"]}` |
| 2 | decide-action | | `{action:"rewind", params:{toPhase:"planifier",inject:{path:"userOverrides.pattern",value:"class-based"}}}` |
| 3 | execute-action | action="rewind" | Branche rewind |
| 4 | | | Widget confirmation ecrit dans `_widgetRequest` |
| 5 | TUI | Affiche confirmation | "Rembobiner vers Planifier? Les resultats seront perdus." |
| 6 | TUI | Utilisateur tape "yes" | -> `_widgetResponse = {response:"yes"}` |
| 7 | state-manager | operation=pause | `_workflowStatus = "paused"` |
| 8 | state-manager | operation=rewind,phase=planifier | Results planifier+implementer effaces |
| 9 | state-manager | operation=inject | userOverrides.pattern = "class-based" |
| 10 | state-manager | operation=resume | `_workflowStatus = "running"` |
| 11 | | | Workflow reprend a la phase planifier |

**Impact workflow** : PAUSE + REWIND + RESUME. Le travail d'implementation est perdu et refait.

### Scenario 4 : Override — "Commit ca, le score m'importe pas"

| Etape | Bloc | Output attendu |
|-------|------|----------------|
| 1 | classify-intent | `{intent:"override", urgency:"immediate", affectedPhases:["reviewer"]}` |
| 2 | decide-action | `{action:"override", params:{gate:"review",skipTo:"livrer"}}` |
| 3 | execute-action | Branche override -> widget confirmation |
| 4 | TUI | "Bypass le review gate (score 0.65)? Le code sera commite." |
| 5 | Utilisateur | "yes" |
| 6 | state-manager | transition("livrer") |

### Scenario 5 : Escalade automatique (confidence basse)

Ce scenario est initie par le workflow, pas par l'utilisateur :

```
1. Le backend-developer ecrit dans _workflowState :
   state.escalation = {from:"backend-developer", question:"Should I use async/await or callbacks?"}

2. Le main-workflow set _userMessage = {text: "__ESCALATION__", ...}

3. classify-intent: intent=question (interne)
4. decide-action: action=respond, widgetType=option-select
5. Widget option-select affiche dans le TUI
6. Utilisateur choisit
7. inject: state.escalation.answer = userChoice
8. Le backend-developer lit la reponse au prochain checkpoint
```

**Note** : L'escalade automatique est un scenario avance qui necessite que les agents specialistes ecrivent dans `_workflowState.escalation`. Cela sera implemente apres les scenarios de base (34-E).

---

## Pipeline de creation et publication (OBLIGATOIRE)

### Pour le workflow block (`interaction-handler`)

Le workflow block passe par le meme pipeline que les blocs inference :

1. **Creer le fichier** dans `content/system/blocks/workflows/interaction-handler/`
2. **Verifier la decouverte** par le backend :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'interaction-handler'"
   ```
   Si le bloc n'apparait pas -> verifier le format JSON, le nom de fichier, le chemin.
3. **Tester l'execution** — le workflow complet necessite le parallel node (Plan A). Si pas disponible, tester les sous-parties individuellement :
   ```bash
   # Verifier que les blockRef sont resolus correctement
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'classify-intent|decide-action|send-widget-response|state-manager'"
   ```
4. **Iterer si la qualite est insuffisante** : modifier la structure des nodes, ajuster les conditions, verifier les template expressions. **Minimum 2 tentatives, maximum 5.**
5. **Publier le bloc** une fois les tests satisfaisants :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block publish interaction-handler"
   ```
6. **Verifier la publication** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js approvals list"
   ```
7. **Documenter le score P/W** dans le checkpoint.
8. **Si bloque apres 5 iterations** : documenter dans `docs/phases/PHASE-34/irritations.md`.

> **RAPPEL** : Un bloc cree mais non publie via `block publish` n'est PAS considere comme termine. Le statut DONE requiert la publication.

### Pour les modifications TUI (`App.ts`)

Les modifications TypeScript ne passent PAS par le pipeline de publication des blocs. Elles suivent le process standard :

1. **Modifier `packages/maestro-code/App.ts`** selon les specifications ci-dessus
2. **Verifier la compilation** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit"
   ```
3. **Executer les tests existants** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
   ```
   Tous les tests existants DOIVENT encore passer. Ne pas introduire de regressions.
4. **Test manuel** (si les services sont actifs) :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js code"
   ```
   - Taper une tache -> verifier que la session se cree normalement
   - Pendant que le workflow tourne, taper un message -> verifier qu'il est envoye via `_userMessage`
   - Verifier que les widgets s'affichent quand l'interaction-handler repond

---

## Criteres de qualite (QualityScore)

### Workflow block

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| interaction-handler | 5 scenarios end-to-end passent | >= 0.80 | Le workflow principal n'est pas casse | >= 1.00 |

### TUI Integration

| Composant | Critere | Seuil |
|-----------|---------|-------|
| WidgetRenderer | Rend correctement 6 types de widgets | 100% |
| SessionManager.sendMessage | Message ecrit dans _userMessage | 100% |
| SessionManager.startWidgetPolling | Detecte les nouveaux widgets | 100% |
| InputPrompt toujours actif quand busy | L'utilisateur peut taper pendant le workflow | OUI |
| Deduplication par widget.id | Un meme widget n'est pas re-rendu | OUI |
| Reponse aux widgets interactifs | _widgetResponse ecrit correctement | 100% |
| Tests existants | Aucune regression | 0 nouveaux echecs |

---

## Erreurs courantes a eviter

1. **Utiliser `blockId` au lieu de `blockRef`** dans les nodes du workflow — le codebase utilise `blockRef`
2. **Oublier le `clear-user-message`** dans la boucle — le message serait re-traite indefiniment
3. **Ne pas gerer le cas ou `_userMessage` est null/vide** — le wait-for-message doit attendre
4. **Timeout du polling widget trop court** — mettre 60s minimum pour les confirmations (l'utilisateur peut reflechir)
5. **Oublier de passer `sessionId` au state-manager** — sans ca, il ne sait pas quelle session modifier
6. **Ecrire `_workflowStatus` dans `_workflowState`** — ce sont deux variables SEPAREES. `_workflowStatus` est pour le polling rapide (CheckPauseAsync), `_workflowState` contient l'etat complet
7. **Ne pas tester les branches `rewind` et `override`** — ce sont les plus complexes et les plus risquees
8. **Hardcoder les noms de phases dans le state-manager** — la liste `['comprendre', 'planifier', ...]` est dans le script state-manager.js. Si les phases changent dans le workflow, le script doit etre mis a jour. A terme, le state-manager devrait lire les phases du workflow JSON.
9. **Oublier les modifications TUI** — le plan ne concerne pas SEULEMENT le bloc workflow. L'integration dans `maestro code` est INDISPENSABLE pour que l'interaction fonctionne.
10. **Mettre `isAtomic: true` sur l'interaction-handler** — c'est un WORKFLOW (`isAtomic: false`) car il a des `config.nodes`
11. **Desactiver l'InputPrompt quand busy** — c'est le changement fondamental : l'input DOIT rester actif pour permettre l'interaction pendant le workflow
12. **Oublier la deduplication par widget.id** — sans deduplication, le meme widget sera re-rendu a chaque poll (toutes les 500ms)
13. **Ne pas gerer le cas `pendingInteractive`** — quand un widget interactif est affiche, le prochain input DOIT etre traite comme une reponse, pas comme un nouveau message
14. **Oublier de stopper le widget polling** quand la session se termine — memory leak
15. **Oublier les env vars** — tout script tool block utilise `MAESTRO_INPUT_<KEY_UPPER>` (PAS `INPUT_<KEY>` sans prefix MAESTRO_). Les noeuds `shell` dans le workflow utilisent `process.env.SESSION_ID` et `process.env.MAESTRO_API_URL`.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : parallel node manquant, multi-way branches non supportees, workflow JSON invalide, TUI rendering issues, widget polling bugs, template expressions non resolues, session variable corruption.

Format par entree :
```
### [Plan D2 — INTERACTION WORKFLOW+TUI] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan D2 : Interaction Handler (Workflow + TUI)
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Dependances verifiees** :
  - classify-intent (Plan D1) existe : OUI / NON
  - decide-action (Plan D1) existe : OUI / NON
  - send-widget-response (Plan D1) existe : OUI / NON
  - state-manager (Plan 09) existe : OUI / NON
  - parallel node (Plan A Etape 2) : DONE / PAS FAIT
  - branches multi-way (Plan A Etape 3) : DONE / PAS FAIT
  - CheckPauseAsync (Plan A Etape 4) : DONE / PAS FAIT
**Workflow block** :
  - interaction-handler : CREE / TESTE / PUBLIE / VALIDE
**TUI integration** : NON / EN_COURS / DONE
  - WidgetRenderer : CREE / TESTE
  - SessionManager.sendMessage : CREE / TESTE
  - SessionManager.startWidgetPolling : CREE / TESTE
  - InputPrompt toujours actif : CREE / TESTE
  - Tests existants passent : OUI / NON
**Scenarios valides** : X / 5
  - Scenario 1 (question simple) : PASS / FAIL
  - Scenario 2 (feedback urgent) : PASS / FAIL
  - Scenario 3 (changement direction) : PASS / FAIL
  - Scenario 4 (override) : PASS / FAIL
  - Scenario 5 (escalade) : PASS / FAIL / SKIP (avance)
**P score** :
  - interaction-handler (e2e) : _/0.80
**W score** :
  - interaction-handler : _/1.00
**Problemes** : [si BLOQUE]
```
