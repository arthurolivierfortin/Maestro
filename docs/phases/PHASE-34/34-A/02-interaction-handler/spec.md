# 2. L'Interaction Handler — Chapitre Complet

> **C'est LA feature differenciante de Maestro.** L'utilisateur peut interagir avec l'agent pendant qu'il travaille, sans perdre le contexte, et meme changer de direction.

## Vue d'ensemble

L'interaction-handler est un **agent composite** (`blockType: "agent"`, `isAtomic: false`) qui tourne **en parallele** du workflow principal. Il partage un **state-manager** (tool block) comme unique source de verite avec le workflow.

### Pourquoi c'est critique

Claude Code brut perd son contexte quand on l'interrompt. L'interaction-handler de Maestro v4 permet :
- **Questions sans interruption** : demander "t'en es ou ?" sans pauser le workflow
- **Feedback en temps reel** : "utilise des tabs, pas des espaces" → le changement est injecte immediatement
- **Changement de direction** : "finalement, utilise une classe" → rewind au plan, re-planification
- **Override** : "commit ca, le score m'importe pas" → bypass le review gate
- **Escalade automatique** : si l'agent a une confiance basse, il demande a l'humain

---

## Architecture

```
+-- Session -----------------------------------------------------------+
|                                                                       |
|  +-- Workflow autonome (deterministe) -----------------------------+ |
|  |  comprendre -> planifier -> implementer -> verifier -> ...      | |
|  |  Lit/ecrit le state-manager a chaque noeud                      | |
|  +----------------------------------------------------------------+ |
|                                                                       |
|  +-- Interaction Handler (parallele, intelligent) -----------------+ |
|  |  Recoit les messages utilisateur                                | |
|  |  Classifie l'intent (question, feedback, override)              | |
|  |  Decide l'action (repondre, pauser, rewind, inject)             | |
|  |  Controle le workflow via le state-manager                      | |
|  +----------------------------------------------------------------+ |
|                                                                       |
|  +-- State Manager (tool block, single source of truth) ----------+ |
|  |  status: running|paused|completed                               | |
|  |  currentPhase, currentNode, plan, results, history              | |
|  |  Operations: get, set, pause, resume, rewind, inject            | |
|  +----------------------------------------------------------------+ |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## Block definition : `interaction-handler`

```json
{
  "id": "interaction-handler",
  "name": "Interaction Handler",
  "version": "4.0.0",
  "blockType": "agent",
  "isAtomic": false,
  "metadata": {
    "designation": "agent",
    "category": "interaction",
    "description": "Agent composite qui gere l'interaction humain-agent en parallele du workflow"
  },
  "config": {
    "model": "claude-opus",
    "maxIterations": 100,
    "nodes": [
      {
        "id": "classify-intent",
        "type": "blockRef",
        "blockId": "classify-intent",
        "description": "Classifie l'intent du message utilisateur"
      },
      {
        "id": "decide-action",
        "type": "blockRef",
        "blockId": "decide-action",
        "description": "Decide quelle action prendre"
      },
      {
        "id": "execute-action",
        "type": "decision",
        "description": "Execute l'action decidee",
        "condition": "{{action}}",
        "branches": {
          "respond": { "blockId": "generate-response" },
          "pause-and-modify": { "blockId": "pause-modify-resume" },
          "rewind": { "blockId": "rewind-workflow" },
          "inject": { "blockId": "inject-state" },
          "override": { "blockId": "override-gate" }
        }
      },
      {
        "id": "send-response",
        "type": "blockRef",
        "blockId": "send-widget-response",
        "description": "Envoie la reponse via widget"
      }
    ]
  }
}
```

---

## Noeuds internes

### 2.1 classify-intent (inference block)

**ID** : `classify-intent`
**Type** : inference
**Version** : 4.0.0
**Modele Tier 1** : Opus 4.6 (comprehension d'intent complexe, nuance)

**Inputs** :
- `userMessage` : string — le message de l'utilisateur
- `currentState` : object — etat courant du state-manager (phase, node, status)
- `conversationHistory` : array — les 10 derniers echanges

**Output** :
```json
{
  "intent": "question|feedback|change-request|override|acknowledgment",
  "urgency": "none|low|immediate",
  "requiresPause": false,
  "affectedPhases": [],
  "confidence": 0.95,
  "details": "L'utilisateur demande le statut actuel"
}
```

#### System prompt complet

```markdown
# Intent Classifier — Interaction Handler

You classify user messages sent during an autonomous development workflow. The workflow is actively running — your classification determines whether it should be interrupted.

## CRITICAL RULES

1. Your ENTIRE response is a single JSON object. No text, no explanation.
2. You MUST classify conservatively: if unsure, classify as "question" (least disruptive).
3. NEVER classify a greeting or acknowledgment as "change-request" or "override".
4. urgency="immediate" means the workflow MUST be paused. Use sparingly.
5. requiresPause=true ONLY for change-request with urgency=immediate or override.

## Intent Taxonomy

| Intent | Description | Typical triggers |
|--------|-------------|------------------|
| question | User wants information, no workflow change | "Where are you?", "What step?", "How long?" |
| feedback | User provides input that improves the current approach | "Use tabs", "Add error handling", "The button should be blue" |
| change-request | User wants to change direction or approach | "Actually, use classes", "Start over", "Skip testing" |
| override | User wants to bypass a gate or force a decision | "Commit anyway", "Ignore the warning", "Force push" |
| acknowledgment | User confirms or approves | "OK", "Go ahead", "Looks good" |

## Urgency Levels

| Level | Meaning | When to use |
|-------|---------|-------------|
| none | No action needed on workflow | Questions, acknowledgments |
| low | Apply when convenient (next checkpoint) | Minor feedback, style preferences |
| immediate | Pause workflow NOW | Critical changes, overrides, direction changes |

## Classification Rules

1. If the message is a question (interrogative, "where", "what", "how", "status") → intent=question, urgency=none
2. If the message suggests a preference without demanding change → intent=feedback, urgency=low
3. If the message says "stop", "wait", "actually", "change", "instead" → intent=change-request, urgency=immediate
4. If the message says "force", "ignore", "bypass", "commit anyway", "skip" → intent=override, urgency=immediate
5. If the message is "ok", "sure", "yes", "go ahead", "looks good" → intent=acknowledgment, urgency=none
6. If confidence < 0.7, default to intent=question (safest)

## affectedPhases Rules

- Empty array for questions, acknowledgments
- ["current"] for feedback that affects only the active step
- List specific phases for change-requests: ["plan"], ["implement", "verify"], etc.
- ["all"] for direction changes that affect the entire workflow

## Input Format

You receive:
- `userMessage`: the raw user message
- `currentState`: { status, currentPhase, currentNode, iteration }
- `conversationHistory`: last 10 exchanges [{ role, content, time }]

## Output Format

Your ENTIRE response must be:

```json
{
  "intent": "question",
  "urgency": "none",
  "requiresPause": false,
  "affectedPhases": [],
  "confidence": 0.95,
  "details": "User is asking about the current progress"
}
```
```

**Fitness criteria** :
- P : accuracy de classification sur 50 messages de test (intents varies), seuil >= 0.92
- S : mesure sur le seul domaine "classification d'intent" (pas d'autres taches)
- W : 100% des reponses sont du JSON valide avec les champs requis

**Anti-patterns** :
1. Classifier un "OK" comme change-request (sur-reaction)
2. Classifier un "utilise des tabs" comme question (sous-reaction)
3. Mettre urgency=immediate pour tout (paralyse le workflow)
4. Mettre requiresPause=true pour une question simple
5. Ignorer le conversationHistory (perte de contexte conversationnel)

---

### 2.2 decide-action (inference block)

**ID** : `decide-action`
**Type** : inference
**Version** : 4.0.0
**Modele Tier 1** : Opus 4.6 (decision multi-facteurs)

**Inputs** :
- `classifiedIntent` : object — la sortie de classify-intent
- `fullState` : object — etat complet du state-manager

**Output** :
```json
{
  "action": "respond|pause-and-modify|rewind|inject|override",
  "params": {},
  "responseMessage": "Je suis en train d'implementer le step 3 sur 5...",
  "widgetType": "message|option-select|confirmation|progress",
  "widgetParams": {}
}
```

#### System prompt complet

```markdown
# Action Decider — Interaction Handler

Given a classified user intent and the full workflow state, you decide WHAT action to take and HOW to respond. You are the decision-making brain of the interaction handler.

## CRITICAL RULES

1. Your ENTIRE response is a single JSON object. No text.
2. NEVER choose "rewind" or "override" unless the intent explicitly requires it.
3. ALWAYS provide a responseMessage — the user expects a reply.
4. For "inject" actions, the params MUST contain the exact path and value to inject.
5. For "rewind" actions, params MUST contain toPhase (the phase to rewind to).

## Action Matrix

| Intent | Urgency | Default Action | Notes |
|--------|---------|----------------|-------|
| question | any | respond | Read state, generate informative answer |
| feedback | low | inject | Apply at next checkpoint, no pause |
| feedback | immediate | pause-and-modify | Pause, apply, resume |
| change-request | any | rewind | Pause, rewind to affected phase, inject override, resume |
| override | any | override | Confirm with user first, then bypass gate |
| acknowledgment | any | respond | Simple confirmation, continue |

## Action Details

### respond
Generate a contextual response based on the workflow state.
- Read currentPhase, currentNode, iteration from state
- Provide progress info, estimates, current status
- widgetType: "message" or "progress"

### inject
Modify state without pausing the workflow.
- params.path: dot-notation path in state (e.g., "projectContext.conventions.indentation")
- params.value: the new value
- The workflow picks up the change at its next checkpoint read
- widgetType: "message" (confirmation of injection)

### pause-and-modify
1. Pause the workflow
2. Apply the modification
3. Decide if current step needs re-execution
4. Resume
- params.modifications: array of {path, value} to inject
- params.rerunCurrentStep: boolean
- widgetType: "message" or "confirmation" (if risky)

### rewind
1. Pause the workflow
2. Rewind to a previous phase (clears downstream results)
3. Inject the user's new direction
4. Resume from that phase
- params.toPhase: the phase to rewind to
- params.inject: {path, value} for the new direction
- widgetType: "confirmation" (always confirm rewind, it destroys work)

### override
Bypass a gate or decision in the workflow.
- params.gate: which gate to bypass ("review", "test", "compilation")
- params.skipTo: which phase to jump to
- ALWAYS request confirmation first
- widgetType: "confirmation"

## Widget Types

| Type | When to use | Interactive |
|------|-------------|-------------|
| message | Simple text response | No |
| progress | Status update with phases | No |
| option-select | User must choose between options | Yes |
| confirmation | User must confirm a risky action | Yes |
| plan-view | Show the current plan with statuses | No |
| diff-view | Show code changes before confirming | No |

## Output Format

```json
{
  "action": "respond",
  "params": {},
  "responseMessage": "I'm implementing step 3 of 5: creating the UserService...",
  "widgetType": "progress",
  "widgetParams": {
    "phases": [
      { "name": "Comprendre", "status": "completed" },
      { "name": "Planifier", "status": "completed" },
      { "name": "Implementer", "status": "in_progress", "detail": "Step 3/5" },
      { "name": "Verifier", "status": "pending" },
      { "name": "Reviewer", "status": "pending" },
      { "name": "Livrer", "status": "pending" }
    ]
  }
}
```
```

**Fitness criteria** :
- P : exactitude de l'action choisie sur 30 scenarios de test, seuil >= 0.90
- S : mesure uniquement sur des scenarios d'interaction (pas de code, pas de review)
- W : 100% JSON valide, 0% d'hallucination de params inexistants

**Anti-patterns** :
1. Choisir "rewind" pour un simple feedback de style (trop destructif)
2. Ne pas fournir de responseMessage (l'utilisateur ne recoit rien)
3. Choisir "inject" pour un changement de direction majeur (insuffisant)
4. Ne pas demander confirmation pour "override" ou "rewind" (actions destructives)
5. Ignorer le fullState et donner une reponse generique

---

### 2.3 execute-action (decision block)

Ce noeud n'est pas un agent — c'est un **block `decision`** qui route vers le bon sous-bloc selon l'action decidee. Chaque branche est un mini-workflow :

#### Branche `respond` → `generate-response` (inference)

Simple generation de texte contextuel. Le prompt du decide-action a deja determine le message — ce noeud le formate pour le widget.

#### Branche `pause-and-modify` → `pause-modify-resume` (workflow)

```
1. state-manager.pause()
2. Pour chaque modification dans params.modifications:
     state-manager.inject(modification.path, modification.value)
3. Si params.rerunCurrentStep:
     state-manager.rewind(currentPhase) — re-execute le step courant
4. state-manager.resume()
```

#### Branche `rewind` → `rewind-workflow` (workflow)

```
1. state-manager.pause()
2. Afficher confirmation widget: "Rembobiner vers {phase}? Les resultats en aval seront perdus."
3. Si confirme:
     state-manager.rewind(params.toPhase)
     state-manager.inject(params.inject.path, params.inject.value)
4. state-manager.resume()
```

#### Branche `inject` → `inject-state` (tool call)

```
1. state-manager.inject(params.path, params.value)
   (pas de pause — le workflow continue, prend en compte au prochain checkpoint)
```

#### Branche `override` → `override-gate` (workflow)

```
1. state-manager.pause()
2. Afficher confirmation widget: "Bypass {gate}? Score actuel: {score}."
3. Si confirme:
     state-manager.transition(params.skipTo)
4. state-manager.resume()
```

---

### 2.4 send-response (inference block)

**ID** : `send-widget-response`
**Type** : inference
**Version** : 4.0.0
**Modele Tier 1** : Haiku 4.5 (formatage simple, pas de raisonnement)

Formate la reponse finale en widget JSON pour le TUI. Ce bloc est volontairement simple : il recoit le responseMessage et widgetType de decide-action, et produit le JSON final.

#### System prompt complet

```markdown
# Widget Response Formatter

You format agent responses as widget JSON for the Maestro TUI. This is a pure formatting task — do not modify the content.

## CRITICAL RULES

1. Your ENTIRE response is a single JSON object.
2. NEVER modify the responseMessage content — format it exactly as received.
3. ALWAYS include the widgetType field.
4. If widgetParams is empty, use an empty object {}.

## Input

- `responseMessage`: string — the message to display
- `widgetType`: string — the widget type
- `widgetParams`: object — widget-specific parameters

## Output Format

```json
{
  "tool": "done",
  "args": {
    "summary": "{\"widget\":{\"type\":\"message\",\"content\":\"The response text\",\"params\":{}}}"
  }
}
```

## Widget Types Reference

| Type | Required params | Description |
|------|----------------|-------------|
| message | none | Simple text message |
| progress | phases: [{name, status, detail?}] | Phase progress bars |
| option-select | options: [{id, label, description}] | User choice |
| confirmation | action: string, consequence: string | Yes/No confirmation |
| plan-view | steps: [{id, description, status}] | Implementation plan |
| diff-view | files: [{path, additions, deletions}] | Code diff |
| test-results | suites: [{name, passed, failed, total}] | Test results |
```

---

## State Manager — Specification complete

### Block definition

```json
{
  "id": "state-manager",
  "name": "State Manager",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "infrastructure",
    "description": "Gestion de l'etat partage entre le workflow et l'interaction-handler"
  },
  "config": {
    "command": "state-manager",
    "operations": ["get", "set", "transition", "pause", "resume", "rewind", "inject"]
  }
}
```

### Operations

| Operation | Appelant | Signature | Effet |
|-----------|----------|-----------|-------|
| `get` | Workflow + Interaction | `get(path: string)` | Retourne la valeur a path (dot-notation) |
| `set` | Workflow + Interaction | `set(path: string, value: any)` | Ecrit la valeur a path |
| `transition` | Workflow | `transition(phase: string)` | Marque la phase precedente comme complete, demarre la nouvelle |
| `pause` | Interaction | `pause()` | Met status="paused", le workflow attend |
| `resume` | Interaction | `resume()` | Met status="running", le workflow reprend |
| `rewind` | Interaction | `rewind(toPhase: string)` | Reset les resultats de toutes les phases apres toPhase |
| `inject` | Interaction | `inject(path: string, value: any)` | Set sans pause — le workflow lit au prochain checkpoint |

### Concurrence

Le state-manager doit gerer les acces concurrents entre le workflow et l'interaction-handler :
- **Read** : pas de lock (les lectures sont safe)
- **Write** : mutex simple — un seul ecrivain a la fois
- **Pause/Resume** : atomique — le workflow verifie `status` avant chaque noeud
- **Rewind** : acquiert le mutex, pause le workflow, reset les resultats, relache le mutex

### Implementation technique

Le state-manager est un **tool block** qui manipule les **session variables** via l'API REST Maestro :
- `GET /api/sessions/{id}/variables/state` → operation `get`
- `PUT /api/sessions/{id}/variables/state` → operations `set`, `inject`
- Actions `pause`, `resume`, `rewind`, `transition` modifient le champ `status` et/ou les sous-champs de `state`

Le workflow principal (EntryPointExecutor) doit, a chaque noeud :
1. Lire `state.status` — si "paused", attendre en polling (1s interval)
2. Apres execution du noeud, sauvegarder les resultats via `state.set()`

---

## Widget Protocol — Communication TUI

### Principe

L'interaction-handler communique avec `maestro code` (le TUI interactif) via des **session variables** speciales :

- `_widgetRequest` : l'interaction-handler ecrit un widget a afficher
- `_widgetResponse` : l'utilisateur ecrit sa reponse (pour les widgets interactifs)

### Flux de communication

```
Interaction Handler                   maestro code (TUI)
        |                                     |
        |--- SET _widgetRequest ----------->  |
        |    {type: "confirmation",           |
        |     content: "Rewind to plan?",     |
        |     params: {action: "rewind"}}     |
        |                                     |
        |                                     |--- Affiche le widget
        |                                     |--- Utilisateur repond "Oui"
        |                                     |
        |  <--- SET _widgetResponse --------- |
        |       {response: "yes",             |
        |        widgetId: "abc123"}          |
        |                                     |
        |--- Lit _widgetResponse              |
        |--- Execute l'action                 |
```

### Types de widgets

| Type | Interactif | Params requis | Response format |
|------|------------|---------------|-----------------|
| `message` | Non | `content: string` | N/A |
| `option-select` | Oui | `options: [{id, label, description}], prompt: string` | `{response: "option-id"}` |
| `text-input` | Oui | `prompt: string, placeholder?: string` | `{response: "user text"}` |
| `confirmation` | Oui | `content: string, action: string, consequence: string` | `{response: "yes"|"no"}` |
| `progress` | Non | `phases: [{name, status, detail?}]` | N/A |
| `plan-view` | Non | `steps: [{id, description, status, domain}]` | N/A |
| `diff-view` | Non | `files: [{path, additions, deletions, hunks}]` | N/A |
| `test-results` | Non | `suites: [{name, passed, failed, skipped}]` | N/A |
| `file-tree` | Non | `tree: [{path, type, status}]` | N/A |
| `log-stream` | Non | `entries: [{time, level, message}]` | N/A |

### Implementation dans maestro code

`maestro code` doit :
1. Poller `_widgetRequest` toutes les 500ms
2. Quand un nouveau widget arrive, le rendre dans la zone appropriee
3. Pour les widgets interactifs, capturer l'input et ecrire dans `_widgetResponse`
4. Nettoyer `_widgetRequest` apres affichage

> **DEPENDANCE** : Le widget protocol n'est pas encore implemente dans `maestro code`. C'est un livrable de Phase 34-D.

---

## Scenarios detailles

### Scenario 1 : Question simple — "T'en es ou ?"

```
1. classify-intent:
   {
     "intent": "question",
     "urgency": "none",
     "requiresPause": false,
     "affectedPhases": [],
     "confidence": 0.98,
     "details": "User is asking about current progress"
   }

2. decide-action:
   {
     "action": "respond",
     "params": {},
     "responseMessage": "Je suis en train d'implementer le step 3 sur 5 : creation du composant FileTree. Les phases Comprendre et Planifier sont terminees. 2 steps ont ete implementes avec succes.",
     "widgetType": "progress",
     "widgetParams": {
       "phases": [
         { "name": "Comprendre", "status": "completed" },
         { "name": "Planifier", "status": "completed" },
         { "name": "Implementer", "status": "in_progress", "detail": "Step 3/5" },
         { "name": "Verifier", "status": "pending" },
         { "name": "Reviewer", "status": "pending" },
         { "name": "Livrer", "status": "pending" }
       ]
     }
   }

3. execute-action: branche "respond" → formate le widget
4. send-response: envoie le widget progress au TUI
```

**Workflow impact** : aucun. Le workflow continue sans interruption.

### Scenario 2 : Feedback urgent — "Stop, utilise des tabs pas des espaces"

```
1. classify-intent:
   {
     "intent": "change-request",
     "urgency": "immediate",
     "requiresPause": true,
     "affectedPhases": ["current"],
     "confidence": 0.92,
     "details": "User wants to change indentation convention from spaces to tabs"
   }

2. decide-action:
   {
     "action": "pause-and-modify",
     "params": {
       "modifications": [
         { "path": "results.comprendre.project.conventions.indentation", "value": "tabs" }
       ],
       "rerunCurrentStep": true
     },
     "responseMessage": "OK, je passe aux tabs. Je re-execute le step en cours avec la nouvelle convention.",
     "widgetType": "message"
   }

3. execute-action: branche "pause-and-modify"
   a. state-manager.pause() → workflow paused
   b. state-manager.inject("results.comprendre.project.conventions.indentation", "tabs")
   c. rerunCurrentStep=true → state-manager.rewind("implementer") pour le step courant
   d. state-manager.resume() → workflow reprend

4. send-response: "OK, je passe aux tabs. Je re-execute le step en cours."
```

### Scenario 3 : Changement de direction — "Finalement, utilise une classe au lieu de fonctions pures"

```
1. classify-intent:
   {
     "intent": "change-request",
     "urgency": "immediate",
     "requiresPause": true,
     "affectedPhases": ["plan", "implement"],
     "confidence": 0.88,
     "details": "User wants to change architecture pattern from functional to class-based"
   }

2. decide-action:
   {
     "action": "rewind",
     "params": {
       "toPhase": "planifier",
       "inject": {
         "path": "userOverrides.pattern",
         "value": "class-based instead of functional"
       }
     },
     "responseMessage": "Je reviens a la planification pour integrer l'approche class-based. Les implementations actuelles seront refaites.",
     "widgetType": "confirmation",
     "widgetParams": {
       "action": "Rembobiner vers la phase Planifier",
       "consequence": "Les steps deja implementes seront perdus et re-faits avec le nouveau pattern."
     }
   }

3. execute-action: branche "rewind"
   a. Afficher confirmation widget
   b. Utilisateur confirme "Oui"
   c. state-manager.pause()
   d. state-manager.rewind("planifier") → results.planifier, results.implementer effaces
   e. state-manager.inject("userOverrides.pattern", "class-based instead of functional")
   f. state-manager.resume() → workflow reprend a la phase planifier

4. send-response: "Je reviens a la planification avec le pattern class-based."
```

### Scenario 4 : Override — "Commit ca, le score m'importe pas"

```
1. classify-intent:
   {
     "intent": "override",
     "urgency": "immediate",
     "requiresPause": true,
     "affectedPhases": ["reviewer"],
     "confidence": 0.95,
     "details": "User wants to bypass review gate and commit regardless of score"
   }

2. decide-action:
   {
     "action": "override",
     "params": {
       "gate": "review",
       "skipTo": "livrer"
     },
     "responseMessage": "Le review score est 0.65 (seuil: 0.80). Tu veux quand meme commit?",
     "widgetType": "confirmation",
     "widgetParams": {
       "action": "Bypass le review gate (score 0.65)",
       "consequence": "Le code sera commite sans atteindre le seuil de qualite requis."
     }
   }

3. execute-action: branche "override"
   a. Afficher confirmation widget
   b. Utilisateur confirme "Oui"
   c. state-manager.pause()
   d. state-manager.transition("livrer") → saute directement a la phase livrer
   e. state-manager.resume()

4. send-response: widget confirmation puis "OK, je commit."
```

### Scenario 5 : Escalade automatique (confidence basse)

Quand un specialiste a une confiance basse (< 0.7) sur sa tache, il peut demander de l'aide :

```
1. Le backend-developer rencontre une ambiguite dans le step
2. Il ecrit dans state: { "escalation": { "from": "backend-developer", "question": "..." } }
3. L'interaction-handler detecte l'escalation
4. classify-intent: intent=question (interne)
5. decide-action: action=respond, widgetType=option-select
6. Widget: "Le backend-developer a une question: '...' Options: [A, B, C]"
7. Utilisateur choisit
8. state-manager.inject("escalation.answer", userChoice)
9. Le backend-developer reprend avec la reponse
```

---

## Dependance critique : block `parallel`

L'interaction-handler **doit** tourner en parallele du workflow principal. Le block type `parallel` est :
- **Concu** dans `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md`
- **NON implemente** dans `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`

### Ce qu'il faut implementer (Phase 34-B)

```csharp
// Dans EntryPointExecutor.cs
private async Task ExecuteParallelNodeAsync(WorkflowNode node, ...)
{
    // Lancer tous les noeuds enfants en parallele
    var tasks = node.Children.Select(child => ExecuteNodeAsync(child, ...));
    // Attendre que TOUS les enfants terminent
    // OU que le workflow principal termine (l'interaction-handler tourne indefiniment)
    await Task.WhenAll(tasks);
}
```

### Semantique pour l'interaction-handler

Le noeud `parallel` a la racine du workflow v4 contient :
1. Le workflow principal (sequence deterministe des 7 phases)
2. L'interaction-handler (boucle infinie qui attend les messages utilisateur)

Le `parallel` termine quand le workflow principal termine. L'interaction-handler est annule (graceful shutdown).

### Alternative si parallel n'est pas pret

Si l'implementation de `parallel` est retardee, un mode degrade est possible :
- L'interaction-handler tourne comme un **thread/task separee** lance par `maestro code`
- Il communique avec le workflow via les session variables (polling)
- Le workflow n'a pas de noeud parallel — juste les 7 phases sequentielles
- Moins elegant, mais fonctionnel

Cette alternative est un **plan B uniquement** — le design cible utilise le block parallel.
