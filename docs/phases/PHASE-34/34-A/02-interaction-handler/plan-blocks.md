# Plan D1 — Interaction Handler (Blocks) : classify-intent, decide-action, send-widget-response

**Objectif** : Creer les 3 blocs inference du systeme d'interaction humain-agent du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/02-interaction-handler/spec.md`.
**Impact** : Creation de fichiers JSON + Markdown dans `content/system/blocks/`. Aucune modification de code C# ou TypeScript.

**Phase d'implementation** : 34-D (ce plan est le design complet, l'implementation vient apres 34-B et 34-C)

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-blocks.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient les system prompts complets et le widget protocol
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

**Ce sous-plan** couvre les 3 blocs inference (classify-intent, decide-action, send-widget-response). Le workflow `interaction-handler` et l'integration TUI sont dans le sous-plan `plan-workflow-tui.md`.

---

## Dependances

### state-manager (Plan 09)

Le `state-manager` est un tool block cree par le Plan 09 (tool-blocks). **Ne PAS le recreer ici.** Verifier qu'il existe :

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'state-manager'"
```

Si le resultat est vide (state-manager non trouve), **STOPPER** et documenter dans `docs/phases/PHASE-34/irritations.md`. Le Plan 09 doit etre execute en premier.

### Plan A Etape 6 — systemPromptFile pour inference blocks

Les inference blocks `classify-intent` et `decide-action` utilisent `config.systemPromptFile` pointant vers un fichier `system-prompt.md`. Cela necessite que le backend supporte le chargement de fichiers prompt externes pour les inference blocks (Plan A, Etape 5/6 du plan infrastructure `13-technical-dependencies`).

**Si ce support n'existe pas encore** : utiliser `config.systemPrompt` avec le contenu inline (comme `send-widget-response`). Le prompt sera long mais fonctionnel. Migrer vers `systemPromptFile` quand le support sera disponible.

---

## Contexte — Format attendu des blocs

### Inference block format (reference : `code-reviewer.inference.block.json`)

```
content/system/blocks/inference/<block-id>/
+-- <block-id>.inference.block.json    <- Definition du bloc
+-- system-prompt.md                   <- System prompt externe (si long)
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
    "temperature": 0.1,
    "maxTokens": 1000
  },
  "metadata": {
    "category": "interaction",
    "designation": "inference",
    "tags": ["..."],
    "tier": 1
  }
}
```

**Points critiques** :
- `inputs` est un tableau d'objets `{id, type, required, description}` — PAS un objet avec des champs
- `config.systemPromptFile` pointe vers un fichier markdown relatif au dossier du bloc (pour les prompts longs)
- `config.systemPrompt` est une inline string (pour les prompts courts, comme `send-widget-response`)
- `config.model` utilise les model IDs reels : `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Tous les tool block scripts utilisent `MAESTRO_INPUT_<KEY_UPPER>` comme convention d'env var (PAS `INPUT_<KEY>`)

**DEPENDANCE** : Les inference blocks de ce plan qui utilisent `systemPromptFile` (prompts longs) necessitent le support de l'Etape 5/6 du Plan A (13-infrastructure). Si ce support n'est pas encore disponible, utiliser `systemPrompt` inline.

---

## Inventaire des blocs a creer

| # | ID | Type | Dossier | Fichiers |
|---|---|------|---------|----------|
| 1 | `classify-intent` | inference | `content/system/blocks/inference/classify-intent/` | `classify-intent.inference.block.json`, `system-prompt.md` |
| 2 | `decide-action` | inference | `content/system/blocks/inference/decide-action/` | `decide-action.inference.block.json`, `system-prompt.md` |
| 3 | `send-widget-response` | inference | `content/system/blocks/inference/send-widget-response/` | `send-widget-response.inference.block.json` |

**Total** : 3 blocs inference + 2 fichiers system prompt

---

## Bloc 1 : `classify-intent` (inference block)

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

Copier le system prompt complet de `spec.md` section 2.1 (dans le meme dossier que ce plan).

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

1. If the message is a question (interrogative, "where", "what", "how", "status") -> intent=question, urgency=none
2. If the message suggests a preference without demanding change -> intent=feedback, urgency=low
3. If the message says "stop", "wait", "actually", "change", "instead" -> intent=change-request, urgency=immediate
4. If the message says "force", "ignore", "bypass", "commit anyway", "skip" -> intent=override, urgency=immediate
5. If the message is "ok", "sure", "yes", "go ahead", "looks good" -> intent=acknowledgment, urgency=none
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

## Bloc 2 : `decide-action` (inference block)

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

Copier le system prompt complet de `spec.md` section 2.2 (dans le meme dossier que ce plan).

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
3. **Opus 4.6** est necessaire car la decision multi-facteurs (intent + urgency + state + phases affectees -> action) est complexe et les erreurs sont couteuses (rewind quand un inject suffit, override sans confirmation...).
4. **Le `userMessage` est passe en plus** du `classifiedIntent` pour que le decide-action puisse generer un `responseMessage` contextuel.

### Anti-patterns a surveiller

| Anti-pattern | Consequence | Prevention |
|-------------|-------------|------------|
| Choisir "rewind" pour un feedback de style | Destruction du travail pour rien | Action Matrix dans le prompt |
| Ne pas fournir de responseMessage | L'utilisateur ne voit rien | Rule 3 dans le prompt |
| Choisir "inject" pour un changement de direction majeur | Le workflow continue dans la mauvaise direction | Action Matrix : change-request -> rewind |
| Ne pas demander confirmation pour override/rewind | Actions destructives sans consentement | Widget rules dans le prompt |

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'decide-action'"

# Test avec une question classifiee
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run decide-action --input classifiedIntent='{\"intent\":\"question\",\"urgency\":\"none\",\"requiresPause\":false,\"affectedPhases\":[],\"confidence\":0.98,\"details\":\"Asking progress\"}' --input fullState='{\"status\":\"running\",\"currentPhase\":\"implementer\",\"iteration\":1,\"results\":{\"comprendre\":{\"_completed\":true},\"planifier\":{\"_completed\":true}}}' --input userMessage='Where are you?'"
# Resultat attendu : {"action":"respond","widgetType":"progress",...}
```

---

## Bloc 3 : `send-widget-response` (inference block)

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

## Pipeline de creation et publication (OBLIGATOIRE)

Chaque bloc DOIT passer par ce pipeline complet. **Creer les fichiers ne suffit PAS** — le bloc doit etre teste et publie via le CLI.

### Pre-requis
1. Verifier que le backend est accessible :
   ```bash
   curl -s http://localhost:5000/api/health
   ```
2. **DEPENDANCE** : Le tool block `state-manager` est cree par le Plan 09. Verifier qu'il existe :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'state-manager'"
   ```
   Si absent → documenter dans `docs/phases/PHASE-34/irritations.md`. Les 3 blocs inference de CE plan n'ont PAS de dependance directe sur state-manager pour etre crees et testes individuellement. Mais le workflow complet (plan-workflow-tui.md) en aura besoin.
3. **DEPENDANCE** : Les inference blocks `classify-intent` et `decide-action` utilisent `config.systemPromptFile`. Cela necessite le support backend de l'Etape 5/6 du Plan A (13-infrastructure). Si pas encore disponible, utiliser `config.systemPrompt` inline.

### Pour chaque bloc :
1. **Creer les fichiers** dans le dossier approprie (`content/system/blocks/inference/<block-id>/`)
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

## Ordre d'execution recommande

```
1. classify-intent (inference block)
   -> Tester en isolation via `node index.js run classify-intent`

2. decide-action (inference block)
   -> Tester avec une sortie simulee de classify-intent

3. send-widget-response (inference block)
   -> Tester avec des entrees simulees
```

---

## Criteres de qualite (QualityScore)

### Par bloc

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| classify-intent | Classification correcte sur 50 messages varies | >= 0.92 | 100% JSON valide avec tous les champs requis | >= 0.95 |
| decide-action | Action correcte sur 30 scenarios | >= 0.90 | 100% JSON valide, 0% params hallucines | >= 0.95 |
| send-widget-response | Widget formate correctement sur 20 entrees | >= 0.95 | 100% JSON valide | >= 1.00 |

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

1. **Utiliser des model IDs incorrects** — c'est `claude-opus-4-6`, pas `opus` ou `Opus 4.6`. C'est `claude-haiku-4-5-20251001`, pas `haiku`.
2. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet
3. **Mettre `isAtomic: false`** — les inference blocks sont atomiques (`isAtomic: true`). Seuls les workflows sont `false`.
4. **Ne pas tester** — creer le fichier JSON ne suffit pas, il faut verifier que le backend le decouvre ET que l'execution produit un resultat valide
5. **Copier le prompt du spec sans le relire** — verifier que le format JSON attendu en sortie est coherent avec les `outputs` du block definition
6. **Utiliser `config.systemPrompt` inline pour les prompts longs** de classify-intent et decide-action — preferer `config.systemPromptFile` si le backend le supporte. Si non disponible, utiliser inline en attendant.
7. **Ecrire `_workflowStatus` dans `_workflowState`** — ce sont deux variables SEPAREES. `_workflowStatus` est pour le polling rapide (CheckPauseAsync), `_workflowState` contient l'etat complet. Les prompts mentionnent les deux.
8. **Repondre avec du texte au lieu de JSON** — tous les blocs doivent produire du JSON strict. La temperature basse et les rules "ENTIRE response is JSON" sont la pour ca.
9. **Oublier de verifier les env vars** — tout script tool block utilise `MAESTRO_INPUT_<KEY_UPPER>` (PAS `INPUT_<KEY>` sans prefix MAESTRO_).
10. **Ne pas iterer** — si le premier test echoue, ajuster le prompt, le modele, la temperature. Minimum 2 tentatives avant de documenter un blocage.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : inference block non decouvert, systemPromptFile non supporte, JSON parse errors, model timeout, classification incorrecte repetee.

Format par entree :
```
### [Plan D1 — INTERACTION BLOCKS] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan D1 : Interaction Handler (Blocks)
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - classify-intent : CREE / TESTE / PUBLIE / VALIDE
  - decide-action : CREE / TESTE / PUBLIE / VALIDE
  - send-widget-response : CREE / TESTE / PUBLIE / VALIDE
**Dependances verifiees** :
  - state-manager (Plan 09) existe : OUI / NON
  - systemPromptFile backend support : OUI / NON (si NON, inline utilise)
**P score** :
  - classify-intent : _/0.92
  - decide-action : _/0.90
  - send-widget-response : _/0.95
**W score** :
  - classify-intent : _/0.95
  - decide-action : _/0.95
  - send-widget-response : _/1.00
**Problemes** : [si BLOQUE]
```
