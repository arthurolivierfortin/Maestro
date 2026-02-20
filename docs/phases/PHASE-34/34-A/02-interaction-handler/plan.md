> **NOTE** : Ce plan a ete decoupe en sous-plans executables independamment :
> - [plan-blocks.md](plan-blocks.md) — classify-intent, decide-action, send-widget-response
> - [plan-workflow-tui.md](plan-workflow-tui.md) — interaction-handler workflow + TUI WidgetRenderer
> Les sous-plans sont auto-suffisants et incluent tout le contexte necessaire.

# Plan D — Interaction Handler : agent composite + widget protocol + TUI integration

**Objectif** : Creer l'interaction-handler complet — l'agent composite parallele qui gere les interactions utilisateur pendant l'execution du workflow v4, avec ses 4 noeuds internes, le state-manager, le widget protocol, et l'integration TUI dans `maestro code`.

**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/02-interaction-handler/spec.md`. Lire `docs/phases/PHASE-34/34-A/13-technical-dependencies/plan.md` (Plan A — parallel node, checkpointing, branches).

**Impact** :
- Creation de fichiers JSON + Markdown dans `content/system/blocks/` (blocs)
- Creation de fichier Node.js dans `content/system/blocks/tools/state-manager/` (script)
- Modification de `packages/maestro-code/App.ts` (widget rendering + polling)
- Aucune modification de code C# (les dependances backend sont couvertes par le Plan A)

**Phase d'implementation** : 34-D (ce plan est le design complet, l'implementation vient apres 34-B et 34-C)

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient les system prompts complets et le widget protocol
3. **Le plan infrastructure** (`13-technical-dependencies/plan.md`) : Dependances backend (parallel node, checkpointing)
4. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 4 documents.**

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
|  |  Boucle infinie : attend message → classifie → decide →    |  |
|  |  execute → repond. Controle le workflow via state-manager.  |  |
|  |  Termine quand main-workflow termine (cancelled by parallel).|  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +-- state-manager (tool block, partagé) ----------------------+  |
|  |  Session variables comme store.                             |  |
|  |  Operations : get, set, transition, pause, resume, rewind,  |  |
|  |  inject. Accessible par BOTH main-workflow et interaction.  |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
+--------------------------------------------------------------------+
```

### Flux de communication

```
Utilisateur (TUI)  ←→  _widgetRequest / _widgetResponse (session vars)  ←→  interaction-handler
                                                                           ↕
                                                                     state-manager
                                                                           ↕
                                                                     main-workflow
```

---

## Inventaire des blocs a creer

| # | ID | Type | Dossier | Fichiers |
|---|---|------|---------|----------|
| 1 | `interaction-handler` | workflow (composite) | `content/system/blocks/workflows/interaction-handler/` | `interaction-handler.workflow.block.json` |
| 2 | `classify-intent` | inference | `content/system/blocks/inference/classify-intent/` | `classify-intent.inference.block.json`, `system-prompt.md` |
| 3 | `decide-action` | inference | `content/system/blocks/inference/decide-action/` | `decide-action.inference.block.json`, `system-prompt.md` |
| 4 | `send-widget-response` | inference | `content/system/blocks/inference/send-widget-response/` | `send-widget-response.inference.block.json` |
| 5 | `state-manager` | tool (script) | `content/system/blocks/tools/state-manager/` | `state-manager.tool.block.json`, `state-manager.js` |

**Note** : `execute-action` n'est PAS un bloc separe — c'est un noeud `conditional` avec `branches` dans le workflow `interaction-handler`. Les branches font des appels au `state-manager` via `blockRef`.

**Total** : 5 blocs + 5 fichiers system prompt/script + 1 integration TUI

---

## Bloc 1 : `state-manager` (tool block)

### Pourquoi en premier

Le state-manager est la dependance fondamentale de tous les autres blocs. Le workflow principal ET l'interaction-handler y accedent. Il doit etre cree et teste avant tout le reste.

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/state-manager/state-manager.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/state-manager/state-manager.js` | Script Node.js d'execution |

### Block definition JSON

```json
{
  "id": "state-manager",
  "name": "State Manager v4",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Shared state management between the main workflow and the interaction-handler. Provides get/set/pause/resume/rewind/inject/transition operations on session variables via the Maestro REST API.",
  "inputs": [
    { "id": "operation", "type": "string", "required": true, "description": "Operation: get|set|transition|pause|resume|rewind|inject" },
    { "id": "sessionId", "type": "string", "required": true, "description": "Session UUID (passed automatically by EntryPointExecutor)" },
    { "id": "path", "type": "string", "required": false, "description": "Dot-notation path for get/set/inject (e.g., 'results.comprendre.project')" },
    { "id": "value", "type": "string", "required": false, "description": "JSON-encoded value for set/inject operations" },
    { "id": "phase", "type": "string", "required": false, "description": "Phase name for transition/rewind operations" }
  ],
  "outputs": [
    { "id": "content", "type": "string", "description": "JSON result: {success, data?, error?}" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "state-manager.js"
  },
  "metadata": {
    "category": "infrastructure",
    "designation": "tool",
    "tags": ["state", "workflow", "pause", "resume", "rewind", "v4"],
    "tier": 1
  }
}
```

### Script implementation (`state-manager.js`)

Le script utilise `fetch` (Node.js 18+) pour appeler l'API REST Maestro directement. C'est le pattern le plus simple et le plus fiable — pas de dependance sur le CLI.

```javascript
#!/usr/bin/env node
/**
 * State Manager — Tool Block Script
 *
 * Operations:
 *   get(path)                → read value at dot-path from _workflowState
 *   set(path, value)         → write value at dot-path in _workflowState
 *   transition(phase)        → mark previous phase complete, start new phase
 *   pause()                  → set _workflowStatus = "paused"
 *   resume()                 → set _workflowStatus = "running"
 *   rewind(phase)            → clear results after phase, set currentPhase
 *   inject(path, value)      → same as set, but without pausing (soft write)
 *
 * All operations read/write session variables via:
 *   GET  /api/sessions/{id}/variables/_workflowState
 *   PUT  /api/sessions/{id}/variables/_workflowState
 *   PUT  /api/sessions/{id}/variables/_workflowStatus
 */

const API_BASE = process.env.MAESTRO_API_URL || 'http://localhost:5000';

async function getVariable(sessionId, varName) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/variables/${varName}`);
  if (!res.ok) return null;
  return await res.json();
}

async function setVariable(sessionId, varName, value) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/variables/${varName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  return res.ok;
}

function getAtPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function setAtPath(obj, path, value) {
  if (!path) return value;
  const keys = path.split('.');
  const last = keys.pop();
  let target = obj || {};
  for (const key of keys) {
    if (target[key] === undefined || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  }
  target[last] = value;
  return obj;
}

async function main() {
  // Inputs arrive as environment variables from the tool block executor
  const operation = process.env.MAESTRO_INPUT_OPERATION || process.argv[2];
  const sessionId = process.env.MAESTRO_INPUT_SESSIONID || process.env.SESSION_ID;
  const path = process.env.MAESTRO_INPUT_PATH || process.argv[3] || '';
  const rawValue = process.env.MAESTRO_INPUT_VALUE || process.argv[4] || '';
  const phase = process.env.MAESTRO_INPUT_PHASE || process.argv[5] || '';

  if (!sessionId) {
    console.log(JSON.stringify({ success: false, error: 'No sessionId provided' }));
    process.exit(1);
  }

  let value;
  try { value = rawValue ? JSON.parse(rawValue) : undefined; }
  catch { value = rawValue; }

  let state = await getVariable(sessionId, '_workflowState') || {};

  switch (operation) {
    case 'get': {
      const result = getAtPath(state, path);
      console.log(JSON.stringify({ success: true, data: result }));
      break;
    }
    case 'set': {
      state = setAtPath(state, path, value);
      const ok = await setVariable(sessionId, '_workflowState', state);
      console.log(JSON.stringify({ success: ok }));
      break;
    }
    case 'transition': {
      const prevPhase = state.currentPhase;
      if (prevPhase && state.results && state.results[prevPhase]) {
        state.results[prevPhase]._completed = true;
        state.results[prevPhase]._completedAt = new Date().toISOString();
      }
      state.currentPhase = phase;
      state.history = state.history || [];
      state.history.push({ time: new Date().toISOString(), event: 'transition', from: prevPhase, to: phase });
      const ok = await setVariable(sessionId, '_workflowState', state);
      console.log(JSON.stringify({ success: ok }));
      break;
    }
    case 'pause': {
      const ok = await setVariable(sessionId, '_workflowStatus', 'paused');
      state.history = state.history || [];
      state.history.push({ time: new Date().toISOString(), event: 'paused' });
      await setVariable(sessionId, '_workflowState', state);
      console.log(JSON.stringify({ success: ok }));
      break;
    }
    case 'resume': {
      const ok = await setVariable(sessionId, '_workflowStatus', 'running');
      state.history = state.history || [];
      state.history.push({ time: new Date().toISOString(), event: 'resumed' });
      await setVariable(sessionId, '_workflowState', state);
      console.log(JSON.stringify({ success: ok }));
      break;
    }
    case 'rewind': {
      // Clear all results after the target phase
      const phaseOrder = ['comprendre', 'planifier', 'implementer', 'verifier', 'reviewer', 'livrer'];
      const targetIdx = phaseOrder.indexOf(phase);
      if (targetIdx >= 0 && state.results) {
        for (let i = targetIdx; i < phaseOrder.length; i++) {
          delete state.results[phaseOrder[i]];
        }
      }
      state.currentPhase = phase;
      state.history = state.history || [];
      state.history.push({ time: new Date().toISOString(), event: 'rewind', toPhase: phase });
      const ok = await setVariable(sessionId, '_workflowState', state);
      console.log(JSON.stringify({ success: ok }));
      break;
    }
    case 'inject': {
      // Same as set but semantically different — no pause needed
      state = setAtPath(state, path, value);
      state.history = state.history || [];
      state.history.push({ time: new Date().toISOString(), event: 'inject', path, value });
      const ok = await setVariable(sessionId, '_workflowState', state);
      console.log(JSON.stringify({ success: ok }));
      break;
    }
    default:
      console.log(JSON.stringify({ success: false, error: `Unknown operation: ${operation}` }));
      process.exit(1);
  }
}

main().catch(err => {
  console.log(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
```

### Points d'attention

1. **`_workflowState`** est la variable de session qui contient l'etat complet du workflow (status, currentPhase, results, history, userOverrides). C'est la "single source of truth".
2. **`_workflowStatus`** est une variable SEPAREE contenant uniquement `"running"` ou `"paused"`. Separee pour permettre un polling rapide par `CheckPauseAsync` (Plan A, Etape 4) sans deserialiser tout l'etat.
3. Le script utilise `fetch` natif de Node.js 18+ — pas de dependance npm.
4. Le `MAESTRO_INPUT_SESSIONID` sera passe automatiquement par l'`EntryPointExecutor` quand il execute un tool block dans le contexte d'une session (convention : `MAESTRO_INPUT_<KEY_UPPER>`). Si ce mecanisme n'existe pas encore, il devra etre ajoute — voir la section "Dependances backend" ci-dessous.

### Verification individuelle

```bash
# Le bloc est decouvert par le backend
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'state-manager'"
# Resultat attendu : state-manager  tool  4.0.0

# Test direct avec une session existante
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run state-manager --input operation=set --input sessionId=<SESSION-UUID> --input path=status --input value='\"running\"'"
# Verifier : curl http://localhost:5000/api/sessions/<UUID>/variables/_workflowState | python -m json.tool
```

---

## Bloc 2 : `classify-intent` (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/classify-intent/classify-intent.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/classify-intent/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "classify-intent",
  "name": "Intent Classifier v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Classifies user messages sent during an autonomous development workflow into intent categories (question, feedback, change-request, override, acknowledgment) with urgency levels. Conservative classification — when uncertain, defaults to 'question' (least disruptive).",
  "inputs": [
    { "id": "userMessage", "type": "string", "required": true, "description": "The raw user message to classify" },
    { "id": "currentState", "type": "string", "required": true, "description": "JSON: {status, currentPhase, currentNode, iteration}" },
    { "id": "conversationHistory", "type": "string", "required": false, "description": "JSON array: last 10 exchanges [{role, content, time}]" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON: {intent, urgency, requiresPause, affectedPhases, confidence, details}" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.1,
    "maxTokens": 1000
  },
  "metadata": {
    "category": "interaction",
    "designation": "inference",
    "tags": ["intent", "classification", "interaction", "v4"],
    "tier": 1
  }
}
```

### System prompt (`system-prompt.md`)

Copier le system prompt complet de `spec/02-interaction-handler.md` section 2.1.

Le prompt est reproduit ici pour reference et DOIT etre copie TEL QUEL dans le fichier `system-prompt.md` :

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

### Points critiques

1. **Temperature 0.1** — tres basse pour la classification. On veut un comportement deterministe, pas creatif.
2. **Opus 4.6** est necessaire car la classification d'intent est subtile : "utilise des tabs" est du feedback, pas un change-request. "Finalement, utilise une classe" est un change-request, pas du feedback. Haiku/Sonnet risquent de confondre.
3. **maxTokens: 1000** — la sortie est un petit JSON, pas besoin de plus.
4. **Le fallback est TOUJOURS `question`** — c'est la classification la moins disruptive. En cas de doute, on ne pause pas le workflow.

### Anti-patterns a surveiller

| Anti-pattern | Consequence | Prevention |
|-------------|-------------|------------|
| Classifier "OK" comme change-request | Pause inutile du workflow | Rule 5 dans le prompt |
| Classifier "utilise des tabs" comme question | Feedback ignore | Rule 2 dans le prompt |
| Mettre urgency=immediate pour tout | Workflow constamment interrompu | Rule 4 dans le prompt |
| Repondre avec du texte au lieu de JSON | Parse error dans decide-action | Rule 1, temperature 0.1 |
| Ignorer conversationHistory | Perte de contexte ("ca" fait reference a quoi ?) | Le prompt indique d'utiliser l'historique |

### Verification individuelle

```bash
# Bloc decouvert
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'classify-intent'"

# Test avec une question simple
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run classify-intent --input userMessage='Where are you in the process?' --input currentState='{\"status\":\"running\",\"currentPhase\":\"implementer\",\"currentNode\":\"exec-backend\",\"iteration\":1}'"
# Resultat attendu : {"intent":"question","urgency":"none","requiresPause":false,...}

# Test avec un change-request
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run classify-intent --input userMessage='Actually, use a class instead of functions' --input currentState='{\"status\":\"running\",\"currentPhase\":\"implementer\",\"currentNode\":\"exec-backend\",\"iteration\":1}'"
# Resultat attendu : {"intent":"change-request","urgency":"immediate","requiresPause":true,...}
```

---

## Bloc 3 : `decide-action` (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/decide-action/decide-action.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/decide-action/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "decide-action",
  "name": "Action Decider v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Given a classified user intent and full workflow state, decides what action to take (respond, pause-and-modify, rewind, inject, override) and constructs the response message and widget configuration.",
  "inputs": [
    { "id": "classifiedIntent", "type": "string", "required": true, "description": "JSON output from classify-intent: {intent, urgency, requiresPause, affectedPhases, confidence, details}" },
    { "id": "fullState", "type": "string", "required": true, "description": "JSON: complete workflow state from state-manager (status, currentPhase, results, history, userOverrides)" },
    { "id": "userMessage", "type": "string", "required": true, "description": "Original user message (for context in generating responseMessage)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON: {action, params, responseMessage, widgetType, widgetParams}" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.2,
    "maxTokens": 2000
  },
  "metadata": {
    "category": "interaction",
    "designation": "inference",
    "tags": ["decision", "action", "interaction", "v4"],
    "tier": 1
  }
}
```

### System prompt (`system-prompt.md`)

Copier le system prompt complet de `spec/02-interaction-handler.md` section 2.2.

Le prompt est reproduit ici pour reference et DOIT etre copie TEL QUEL dans le fichier `system-prompt.md` :

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

### Points critiques

1. **Temperature 0.2** — legerement plus haute que classify-intent car le responseMessage doit etre naturel, mais toujours conservative pour le choix d'action.
2. **maxTokens: 2000** — la reponse inclut le responseMessage (qui peut etre long) ET les widgetParams (qui peuvent inclure des listes de phases, options, etc.).
3. **Opus 4.6** est necessaire car la decision multi-facteurs (intent + urgency + state + phases affectees → action) est complexe et les erreurs sont couteuses (rewind quand un inject suffit, override sans confirmation...).
4. **Le `userMessage` est passe en plus** du `classifiedIntent` pour que le decide-action puisse generer un `responseMessage` contextuel.

### Anti-patterns a surveiller

| Anti-pattern | Consequence | Prevention |
|-------------|-------------|------------|
| Choisir "rewind" pour un feedback de style | Destruction du travail pour rien | Action Matrix dans le prompt |
| Ne pas fournir de responseMessage | L'utilisateur ne voit rien | Rule 3 dans le prompt |
| Choisir "inject" pour un changement de direction majeur | Le workflow continue dans la mauvaise direction | Action Matrix : change-request → rewind |
| Ne pas demander confirmation pour override/rewind | Actions destructives sans consentement | Widget rules dans le prompt |

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'decide-action'"

# Test avec une question classifiee
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run decide-action --input classifiedIntent='{\"intent\":\"question\",\"urgency\":\"none\",\"requiresPause\":false,\"affectedPhases\":[],\"confidence\":0.98,\"details\":\"Asking progress\"}' --input fullState='{\"status\":\"running\",\"currentPhase\":\"implementer\",\"iteration\":1,\"results\":{\"comprendre\":{\"_completed\":true},\"planifier\":{\"_completed\":true}}}' --input userMessage='Where are you?'"
# Resultat attendu : {"action":"respond","widgetType":"progress",...}
```

---

## Bloc 4 : `send-widget-response` (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/send-widget-response/send-widget-response.inference.block.json` | Definition du bloc |

**Note** : Ce bloc utilise `config.systemPrompt` (inline) au lieu de `config.systemPromptFile` car le prompt est tres court (pure formatting).

### Block definition JSON

```json
{
  "id": "send-widget-response",
  "name": "Widget Response Formatter v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Formats agent responses as widget JSON for the Maestro TUI. Pure formatting task — receives responseMessage and widgetType from decide-action, produces the final widget JSON that gets written to _widgetRequest.",
  "inputs": [
    { "id": "responseMessage", "type": "string", "required": true, "description": "The message to display to the user" },
    { "id": "widgetType", "type": "string", "required": true, "description": "Widget type: message|progress|option-select|confirmation|plan-view|diff-view|test-results" },
    { "id": "widgetParams", "type": "string", "required": false, "description": "JSON widget-specific parameters (phases, options, action, etc.)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON widget object to write to _widgetRequest" }
  ],
  "config": {
    "systemPrompt": "You format agent responses as widget JSON for the Maestro TUI. This is a pure formatting task.\n\nCRITICAL RULES:\n1. Your ENTIRE response is a single JSON object.\n2. NEVER modify the responseMessage content — format it exactly as received.\n3. ALWAYS include the widgetType field.\n4. If widgetParams is empty or not provided, use an empty object {}.\n\nOutput format:\n```json\n{\n  \"widget\": {\n    \"type\": \"<widgetType>\",\n    \"content\": \"<responseMessage>\",\n    \"params\": <widgetParams or {}>,\n    \"id\": \"<generate a unique 8-char hex id>\",\n    \"timestamp\": \"<current ISO timestamp>\"\n  }\n}\n```\n\nWidget types: message, progress, option-select, confirmation, plan-view, diff-view, test-results, file-tree, log-stream.",
    "model": "claude-haiku-4-5-20251001",
    "temperature": 0.0,
    "maxTokens": 2000
  },
  "metadata": {
    "category": "interaction",
    "designation": "inference",
    "tags": ["widget", "response", "formatting", "tui", "v4"],
    "tier": 1
  }
}
```

### Points critiques

1. **Haiku 4.5** est suffisant — c'est du pur formatage JSON, pas de raisonnement.
2. **Temperature 0.0** — aucune creativite, format strict.
3. **Inline systemPrompt** au lieu de fichier externe — le prompt fait 15 lignes, un fichier separe serait du overhead.
4. **Le champ `id`** dans le widget est genere par le LLM — un hex de 8 caracteres. Cela permet au TUI de deduplicquer les widgets (ne pas reafficher le meme widget si le poll le recapture).
5. **Le champ `timestamp`** permet au TUI de trier chronologiquement.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'send-widget-response'"

# Test de formatage
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run send-widget-response --input responseMessage='I am implementing step 3 of 5' --input widgetType='progress' --input widgetParams='{\"phases\":[{\"name\":\"Comprendre\",\"status\":\"completed\"},{\"name\":\"Implementer\",\"status\":\"in_progress\"}]}'"
# Resultat attendu : {"widget":{"type":"progress","content":"I am implementing step 3 of 5","params":{...}}}
```

---

## Bloc 5 : `interaction-handler` (workflow composite)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/workflows/interaction-handler/interaction-handler.workflow.block.json` | Definition du bloc |

### Architecture interne

```
interaction-handler (workflow, boucle while)
│
├── [1] read-user-message
│     Lit _userMessage (session variable) et _workflowState
│     Si pas de message → continue la boucle (noop)
│
├── [2] classify-intent (blockRef → classify-intent)
│     Input : userMessage, currentState, conversationHistory
│     Output : {intent, urgency, requiresPause, affectedPhases, confidence, details}
│
├── [3] decide-action (blockRef → decide-action)
│     Input : classifiedIntent, fullState, userMessage
│     Output : {action, params, responseMessage, widgetType, widgetParams}
│
├── [4] execute-action (conditional, multi-way branches)
│     Condition : {{_nodeResult_decide-action.action}}
│     Branches :
│       "respond"          → noop (just pass through to send-response)
│       "inject"           → blockRef state-manager (operation=inject)
│       "pause-and-modify" → blockRef state-manager (operation=pause) → inject → resume
│       "rewind"           → blockRef state-manager (send confirmation widget, wait for response, then rewind)
│       "override"         → blockRef state-manager (send confirmation widget, wait for response, then transition)
│
├── [5] send-response (blockRef → send-widget-response)
│     Input : responseMessage, widgetType, widgetParams from decide-action
│     Output : widget JSON → written to _widgetRequest
│
└── [6] save-to-conversation-history
      Appends the exchange to _conversationHistory (set-variable)
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

4. read-state: state-manager.get("") → {status:"running", currentPhase:"implementer", ...}

5. classify-intent:
   Input: userMessage="T'en es ou ?", currentState={...}
   Output: {intent:"question", urgency:"none", requiresPause:false, ...}

6. decide-action:
   Input: classifiedIntent={...}, fullState={...}, userMessage="T'en es ou ?"
   Output: {action:"respond", responseMessage:"J'implemente le step 3...", widgetType:"progress", widgetParams:{phases:[...]}}

7. execute-action: branche "respond" → noop (pas de modification du workflow)

8. send-widget-response: formate en widget JSON

9. write-widget-to-session: PUT /api/sessions/{id}/variables/_widgetRequest
   body: { "value": { "widget": { "type": "progress", "content": "J'implemente le step 3...", ... } } }

10. clear-user-message: PUT /api/sessions/{id}/variables/_userMessage
    body: { "value": null }

11. maestro code (polling 500ms) detecte _widgetRequest, rend le widget progress

12. Le main-workflow n'a PAS ete interrompu — il continue en parallele
```

---

## Integration TUI — Modifications de `packages/maestro-code/App.ts`

### Vue d'ensemble des changements

Le fichier `packages/maestro-code/App.ts` doit etre modifie pour :

1. **Envoyer les messages de l'utilisateur** vers `_userMessage` (au lieu de creer une nouvelle session par message)
2. **Poller `_widgetRequest`** a 500ms et rendre les widgets
3. **Capturer les reponses** aux widgets interactifs et les ecrire dans `_widgetResponse`
4. **Afficher les widgets** selon leur type (message, progress, confirmation, option-select, etc.)

### Mode dual : premier message = creation de session, messages suivants = interaction

```
Premier message de l'utilisateur :
  → Cree la session, importe le template, start, invoke (comportement actuel)
  → La session demarre le workflow v4 (parallel: main-workflow + interaction-handler)

Messages suivants (quand busy=true) :
  → Ecrit dans _userMessage via PUT API
  → L'interaction-handler les traite
  → Les widgets sont affiches via le poller _widgetRequest
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

Ajouter les methodes suivantes au `SessionManager` :

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
- **Premier message** (pas de session active) → creer la session (comportement actuel)
- **Messages suivants** (session active, `busy=true`) → envoyer via `sendMessage`
- **Reponse a un widget interactif** (pendingInteractive != null) → envoyer via `sendWidgetResponse`

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

## Dependances backend (recap Plan A)

Ce plan presuppose que les elements suivants du Plan A (13-technical-dependencies/plan.md) sont implementes :

| Dependance | Quoi | Utilise par |
|-----------|------|------------|
| **Etape 2** : `ExecuteParallelNodeAsync` | Execution parallele de children | Le noeud racine `root` du workflow v4 qui lance main-workflow + interaction-handler |
| **Etape 3** : `branches` multi-way dans conditional | Decision avec N branches | Le noeud `execute-action` dans l'interaction-handler |
| **Etape 4** : `CheckPauseAsync` | Polling de `_workflowStatus` avant chaque noeud | Le main-workflow qui attend quand l'interaction-handler set `_workflowStatus = "paused"` |
| **Etape 1** : `ExecuteSequenceNodeAsync` | Noeuds `sequence` imbriques | Les sequences internes de chaque branche d'action |

### Dependance additionnelle : session ID dans les tool blocks

Le `state-manager` a besoin du `sessionId` pour appeler l'API REST. Actuellement, l'`EntryPointExecutor` ne passe pas l'ID de session aux tool blocks.

**Solution** : L'`EntryPointExecutor` doit passer `SESSION_ID` comme variable d'environnement a chaque tool block de type `script`. L'endroit exact est dans `ExecuteToolBlockAsync` ou equivalent — il faut verifier si `process.env.SESSION_ID` est deja disponible dans le contexte d'execution des scripts.

**Si ce n'est pas le cas**, ajouter dans `EntryPointExecutor.cs` :

```csharp
// Lors de l'execution d'un tool block script:
environment["SESSION_ID"] = session.Id.ToString();
environment["MAESTRO_API_URL"] = "http://localhost:5000";
```

C'est une modification mineure (~2 lignes) mais **bloquante** pour le state-manager.

### Dependance additionnelle : template resolution dans les inputs de workflow nodes

Le workflow de l'interaction-handler utilise des template expressions comme `{{_nodeResult_decide.action}}` et `{{_nodeResult_decide.params.path}}`. L'`EntryPointExecutor` doit supporter :

1. **Dot-notation dans les template expressions** — `{{_nodeResult_decide.action}}` doit resoudre a la propriete `action` du resultat JSON du noeud `decide`.
2. **Variables de session dans les template expressions** — `{{_conversationHistory}}` doit resoudre a la variable de session `_conversationHistory`.

**Verification** : Dans `EntryPointExecutor.cs`, chercher comment `ResolveTemplateValue` fonctionne. Si elle ne supporte que les variables simples (pas les dot-paths dans les node results), il faudra l'etendre.

---

## Scenarios de test detailles

### Scenario 1 : Question simple — "T'en es ou ?"

**Preconditions** : Session active, main-workflow en phase `implementer`, step 3/5.

| Etape | Bloc | Input | Output attendu |
|-------|------|-------|----------------|
| 1 | TUI | "T'en es ou ?" | → `_userMessage = {text: "T'en es ou ?"}` |
| 2 | classify-intent | userMessage="T'en es ou ?" | `{intent:"question", urgency:"none", requiresPause:false}` |
| 3 | decide-action | intent=question, state=... | `{action:"respond", widgetType:"progress", responseMessage:"J'implemente le step 3/5..."}` |
| 4 | execute-action | action="respond" | Branche respond → noop |
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
| 1 | TUI | "Stop, utilise des tabs pas des espaces" | → `_userMessage` |
| 2 | classify-intent | | `{intent:"change-request", urgency:"immediate", requiresPause:true, affectedPhases:["current"]}` |
| 3 | decide-action | | `{action:"pause-and-modify", params:{modifications:[{path:"results.comprendre.project.conventions.indentation",value:"tabs"}],rerunCurrentStep:true}}` |
| 4 | execute-action | action="pause-and-modify" | Branche pause-and-modify: pause → inject → resume |
| 5 | state-manager | operation=pause | `_workflowStatus = "paused"` |
| 6 | state-manager | operation=inject | `_workflowState.results.comprendre.project.conventions.indentation = "tabs"` |
| 7 | state-manager | operation=resume | `_workflowStatus = "running"` |
| 8 | send-widget-response | "OK, je passe aux tabs..." | Widget message |

**Impact workflow** : PAUSE momentanee pendant la modification, puis reprise.

**Verification** :
```bash
# Pendant le traitement, verifier la pause
curl -s http://localhost:5000/api/sessions/<UUID>/variables/_workflowStatus
# "paused" (transitoire)

# Apres, verifier la reprise
curl -s http://localhost:5000/api/sessions/<UUID>/variables/_workflowStatus
# "running"

# Verifier l'injection
curl -s http://localhost:5000/api/sessions/<UUID>/variables/_workflowState | python -m json.tool | grep indentation
# "indentation": "tabs"
```

### Scenario 3 : Changement de direction — "Finalement, utilise une classe"

**Preconditions** : Session active, main-workflow en phase `implementer`, step 2/5.

| Etape | Bloc | Input | Output attendu |
|-------|------|-------|----------------|
| 1 | classify-intent | "Finalement, utilise une classe au lieu de fonctions pures" | `{intent:"change-request", urgency:"immediate", affectedPhases:["plan","implement"]}` |
| 2 | decide-action | | `{action:"rewind", params:{toPhase:"planifier",inject:{path:"userOverrides.pattern",value:"class-based"}}}` |
| 3 | execute-action | action="rewind" | Branche rewind |
| 4 | | | Widget confirmation ecrit dans `_widgetRequest` |
| 5 | TUI | Affiche confirmation | "Rembobiner vers Planifier? Les resultats seront perdus." |
| 6 | TUI | Utilisateur tape "yes" | → `_widgetResponse = {response:"yes"}` |
| 7 | state-manager | operation=pause | `_workflowStatus = "paused"` |
| 8 | state-manager | operation=rewind,phase=planifier | Results planifier+implementer effaces |
| 9 | state-manager | operation=inject | userOverrides.pattern = "class-based" |
| 10 | state-manager | operation=resume | `_workflowStatus = "running"` |
| 11 | | | Workflow reprend a la phase planifier |

**Impact workflow** : PAUSE + REWIND + RESUME. Le travail d'implementation est perdu et refait.

**Verification** :
```bash
# Verifier le rewind
curl -s http://localhost:5000/api/sessions/<UUID>/variables/_workflowState | python -m json.tool
# results.planifier = absent (efface)
# results.implementer = absent (efface)
# currentPhase = "planifier"
# userOverrides.pattern = "class-based"
```

### Scenario 4 : Override — "Commit ca, le score m'importe pas"

| Etape | Bloc | Output attendu |
|-------|------|----------------|
| 1 | classify-intent | `{intent:"override", urgency:"immediate", affectedPhases:["reviewer"]}` |
| 2 | decide-action | `{action:"override", params:{gate:"review",skipTo:"livrer"}}` |
| 3 | execute-action | Branche override → widget confirmation |
| 4 | TUI | "Bypass le review gate (score 0.65)? Le code sera commite." |
| 5 | Utilisateur | "yes" |
| 6 | state-manager | transition("livrer") |

### Scenario 5 : Escalade automatique (confidence basse)

Ce scenario est initie par le workflow, pas par l'utilisateur :

```
1. Le backend-developer ecrit dans _workflowState :
   state.escalation = {from:"backend-developer", question:"Should I use async/await or callbacks?"}

2. Le main-workflow set _userMessage = {text: "__ESCALATION__", ...}
   (OU l'interaction-handler poll _workflowState.escalation directement)

3. classify-intent: intent=question (interne)
4. decide-action: action=respond, widgetType=option-select
5. Widget option-select affiche dans le TUI
6. Utilisateur choisit
7. inject: state.escalation.answer = userChoice
8. Le backend-developer lit la reponse au prochain checkpoint
```

**Note** : L'escalade automatique est un scenario avance qui necessite que les agents specialistes ecrivent dans `_workflowState.escalation`. Cela sera implemente apres les scenarios de base (34-E).

---

## Ordre d'execution recommande

```
1. state-manager (tool block)
   → Pas de dependance. Tester avec curl directement.

2. classify-intent (inference block)
   → Tester en isolation via `node index.js run classify-intent`

3. decide-action (inference block)
   → Tester avec une sortie simulee de classify-intent

4. send-widget-response (inference block)
   → Tester avec des entrees simulees

5. interaction-handler (workflow composite)
   → NECESSITE : parallel node (Plan A), branches multi-way (Plan A)
   → Tester d'abord les noeuds individuels, puis le workflow complet

6. Integration TUI (App.ts)
   → NECESSITE : session active avec interaction-handler
   → Tester manuellement en lancant maestro code et en envoyant des messages
```

---

## Criteres de qualite (QualityScore)

### Par bloc

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| state-manager | Operations correctes sur 20 appels | >= 0.95 | Toutes les operations retournent du JSON valide | >= 1.00 |
| classify-intent | Classification correcte sur 50 messages varies | >= 0.92 | 100% JSON valide avec tous les champs requis | >= 0.95 |
| decide-action | Action correcte sur 30 scenarios | >= 0.90 | 100% JSON valide, 0% params hallucines | >= 0.95 |
| send-widget-response | Widget formate correctement sur 20 entrees | >= 0.95 | 100% JSON valide | >= 1.00 |
| interaction-handler | 5 scenarios end-to-end passent | >= 0.80 | Le workflow principal n'est pas casse | >= 1.00 |

### Test de P : 50 messages de test pour classify-intent

Categories de messages de test :

| Categorie | Exemples | Count |
|-----------|----------|-------|
| Questions (status) | "Where are you?", "What step?", "How long will it take?" | 10 |
| Feedback (mild) | "Use tabs", "The button should be blue", "Add a comment here" | 10 |
| Change-request | "Actually use classes", "Start over", "Skip testing" | 10 |
| Override | "Commit anyway", "Force push", "Ignore the warning" | 10 |
| Acknowledgment | "OK", "Go ahead", "Looks good", "Sure" | 5 |
| Edge cases | "hmm", "...", "can you?", "!!" | 5 |

### Test de W : verification automatisee

```bash
# Pour chaque test message:
OUTPUT=$(node index.js run classify-intent --input userMessage="<message>" --input currentState="{...}" 2>/dev/null)
echo $OUTPUT | python -m json.tool > /dev/null 2>&1
if [ $? -ne 0 ]; then echo "W FAIL: not valid JSON"; fi
echo $OUTPUT | python -c "import sys,json;d=json.load(sys.stdin);assert 'intent' in d;assert 'urgency' in d;assert 'requiresPause' in d;assert 'confidence' in d"
if [ $? -ne 0 ]; then echo "W FAIL: missing required fields"; fi
```

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
9. **Oublier les modifications TUI** — le plan ne concerne pas SEULEMENT les blocs. L'integration dans `maestro code` est INDISPENSABLE pour que l'interaction fonctionne.
10. **Mettre `isAtomic: true` sur l'interaction-handler** — c'est un WORKFLOW (`isAtomic: false`) car il a des `config.nodes`

---

## Fichiers a modifier (existants)

| Fichier | Modification | Risque |
|---------|-------------|--------|
| `packages/maestro-code/App.ts` | Ajouter WidgetRenderer, modifier SessionManager, modifier InteractiveApp | Moyen — impact sur l'UX existante |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Passer SESSION_ID aux tool blocks scripts (si pas deja fait) | Faible — 2 lignes |

## Fichiers a creer (nouveaux)

| Fichier | Type |
|---------|------|
| `content/system/blocks/tools/state-manager/state-manager.tool.block.json` | Block JSON |
| `content/system/blocks/tools/state-manager/state-manager.js` | Node.js script |
| `content/system/blocks/inference/classify-intent/classify-intent.inference.block.json` | Block JSON |
| `content/system/blocks/inference/classify-intent/system-prompt.md` | Prompt |
| `content/system/blocks/inference/decide-action/decide-action.inference.block.json` | Block JSON |
| `content/system/blocks/inference/decide-action/system-prompt.md` | Prompt |
| `content/system/blocks/inference/send-widget-response/send-widget-response.inference.block.json` | Block JSON |
| `content/system/blocks/workflows/interaction-handler/interaction-handler.workflow.block.json` | Block JSON |

**Total : 8 fichiers a creer + 2 fichiers a modifier**

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : widget protocol mal documente, state-manager pas accessible, parallel node manquant, interaction-handler qui ne se termine pas, TUI rendering issues.

Format par entree :
```
### [Plan D — INTERACTION HANDLER] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Pipeline de creation et publication (OBLIGATOIRE)

Chaque bloc DOIT passer par ce pipeline complet. **Creer les fichiers ne suffit PAS** — le bloc doit etre teste et publie via le CLI.

### Pre-requis
1. Verifier que le backend est accessible :
   ```bash
   curl -s http://localhost:5000/api/health
   ```
2. **DEPENDANCE** : Le tool block `state-manager` de ce plan est AUSSI defini dans le Plan 09 (tool-blocks). Si Plan 09 a deja ete execute, verifier que `state-manager` existe via `list-blocks`. Si oui, ne PAS le recreer — passer directement aux autres blocs.
3. **DEPENDANCE** : Les inference blocks de ce plan utilisent `system-prompt.md` (si leurs prompts sont longs). Cela necessite l'Etape 5 du Plan A (13-infrastructure).

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
4. **Iterer si la qualite est insuffisante** : modifier le prompt/script, ajuster la config, changer de modele. **Minimum 2 tentatives, maximum 5.**
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

## Checkpoint

```markdown
## Plan D : Interaction Handler
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 5
  - state-manager : CREE / TESTE / PUBLIE / VALIDE
  - classify-intent : CREE / TESTE / PUBLIE / VALIDE
  - decide-action : CREE / TESTE / PUBLIE / VALIDE
  - send-widget-response : CREE / TESTE / PUBLIE / VALIDE
  - interaction-handler (workflow) : CREE / TESTE / PUBLIE / VALIDE
**TUI integration** : NON / EN_COURS / DONE
  - WidgetRenderer : CREE / TESTE
  - SessionManager.sendMessage : CREE / TESTE
  - SessionManager.startWidgetPolling : CREE / TESTE
  - InputPrompt toujours actif : CREE / TESTE
**Scenarios valides** : X / 5
  - Scenario 1 (question simple) : PASS / FAIL
  - Scenario 2 (feedback urgent) : PASS / FAIL
  - Scenario 3 (changement direction) : PASS / FAIL
  - Scenario 4 (override) : PASS / FAIL
  - Scenario 5 (escalade) : PASS / FAIL / SKIP (avance)
**P score** :
  - classify-intent : _/0.92
  - decide-action : _/0.90
  - send-widget-response : _/0.95
  - interaction-handler (e2e) : _/0.80
**W score** :
  - classify-intent : _/0.95
  - decide-action : _/0.95
  - send-widget-response : _/1.00
  - state-manager : _/1.00
**Backend deps** :
  - parallel node (Plan A) : DONE / PAS FAIT
  - branches multi-way (Plan A) : DONE / PAS FAIT
  - CheckPauseAsync (Plan A) : DONE / PAS FAIT
  - SESSION_ID env var : DONE / PAS FAIT
**Problemes** : [si BLOQUE]
```
