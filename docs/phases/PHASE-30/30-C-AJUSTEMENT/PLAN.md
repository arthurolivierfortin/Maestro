# Plan : 30-C-AJUSTEMENT

**Date**: 2026-02-17
**Objectif**: Corriger l'infrastructure et ajouter les blocks necessaires pour que le workflow `autonomous-development` fonctionne sur des taches complexes (multi-fichiers).

---

## 0. Contexte (lire ceci en premier)

### Qu'est-ce que Maestro?

Maestro est une plateforme d'orchestration de LLMs. L'architecture repose sur des **blocks** (unites de travail) composes en **workflows**. Les blocks sont de plusieurs types :

- **workflow** : orchestre d'autres blocks via `config.nodes` (sequentiel, for-each, while, conditional)
- **agent** : block qui fait un loop agentic — envoie un prompt au LLM, parse la reponse comme un tool call JSON, execute le tool via le CLI, renvoie le resultat, recommence
- **inference** : block qui fait UN appel LLM (pas de loop)
- **tool** : block qui execute une action atomique (lire un fichier, ecrire, executer un script)

Les blocks sont definis dans des fichiers JSON (`.block.json`) dans `content/system/blocks/`. L'infrastructure C# est dans `backend/src/Maestro.Infrastructure/`.

### Le workflow `autonomous-development`

C'est un workflow qui prend une tache de dev et un chemin de repo, puis :
1. Analyse le projet (agent: project-preparer)
2. Decompose la tache en steps (agent: task-planner)
3. Implemente les steps (agent: implement-single-step)
4. Teste (agent: test-executor)
5. Review (inference: code-reviewer)
6. Commit (agent: git-committer)

**Fichier**: `content/system/blocks/workflows/autonomous-development.workflow.block.json`

### Le probleme

Pour les **taches complexes** (5+ fichiers a creer), l'agent implement-single-step **hallucine** : il repond immediatement `{"tool":"done"}` avec un resume fabrique sans avoir fait un seul tool call reel. Zero fichier cree sur disque.

**Root causes identifiees** (voir `ANALYSIS-FINALE.md`) :
1. L'executor accepte "done" sans verifier qu'un seul tool call ait ete execute
2. Le loop de l'agent casse au premier non-JSON au lieu de retenter
3. L'agent recoit 1-25 steps d'un coup — scope trop large pour un seul agent
4. L'output entre agents est pollue par un prefixe `result: `
5. Aucune validation entre agents — erreurs propagees silencieusement

### La solution

- **Reduire le scope** : 1 agent par step, pas 1 agent pour 25 steps (utiliser `for-each`)
- **Valider les donnees** entre agents via un block `json-validator`
- **Verifier sur disque** apres chaque step via un block `step-validator`
- **Fixer le loop** de l'agent (gardes mecaniques minimales)
- **Nettoyer les outputs** (pas de prefixe `result:`)
- **Stocker les donnees** proprement via un node type `set-variable`

### Fichiers cles a connaitre

| Fichier | Role |
|---------|------|
| `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Execute les workflows : dispatch les nodes, resout les templates, gere for-each/while/conditional |
| `backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Execute les agent blocks : loop agentic (LLM → parse JSON → execute tool → feed back) |
| `backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` | Execute les tool blocks : scripts, filesystem, shell, CLI bridge |
| `content/system/blocks/workflows/autonomous-development.workflow.block.json` | Definition du workflow |
| `content/system/blocks/agents/*/system-prompt.md` | Prompts des agents |

### Philosophie a respecter

- **Infrastructure generique, contenu specifique** : le C# ne sait rien des "plans" ou du "dev". Il orchestre des blocks.
- **Tout est un block** : les validateurs sont des tool blocks avec des scripts, pas du C# special.
- **Ajouter un block = creer 2 fichiers** (JSON + script). Si c'est plus complique, l'architecture est cassee.

---

## Vue d'ensemble des phases

```
Phase A : Fixes infrastructure C#           (~105 lignes, 4 changements)
Phase B : Nouveaux tool blocks              (0 lignes C#, 2 blocks + 2 scripts)
Phase C : Workflow v3 + prompts             (0 lignes C#, JSON + markdown)
Phase D : Tests de validation               (3 niveaux : simple, modere, complexe)
```

A et B sont independantes et peuvent etre faites en parallele.
C depend de A et B.
D depend de tout.

---

## Phase A : Fixes Infrastructure C#

### A-1 : Fix output formatting

**Fichier**: `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
**Ou**: Dans `ExecuteBlockRefAsync`, vers lignes 1084-1091

**Probleme**: Quand un block produit un output avec une seule cle (ex: `result.Outputs["result"] = "..."`), l'executor formate l'output comme `"result: <value>"`. Ce prefixe `result: ` casse le JSON en aval. Si le plan est `[{"id":1,...}]`, l'agent suivant recoit `result: [{"id":1,...}]` qui n'est plus du JSON valide.

**Actuellement**:
```csharp
var outputParts = new List<string>();
foreach (var kv in result.Outputs)
{
    outputParts.Add($"{kv.Key}: {kv.Value}");
}
var output = string.Join("\n", outputParts);
```

**Apres**:
```csharp
string output;
if (result.Outputs.Count == 1)
{
    // Single output — raw value, no key prefix
    output = result.Outputs.Values.First()?.ToString() ?? "";
}
else if (result.Outputs.Count > 1)
{
    // Multiple outputs — keep key:value for disambiguation
    var outputParts = new List<string>();
    foreach (var kv in result.Outputs)
        outputParts.Add($"{kv.Key}: {kv.Value}");
    output = string.Join("\n", outputParts);
}
else
{
    output = result.Success
        ? $"Block '{blockRefId}' completed successfully"
        : $"Block '{blockRefId}' failed";
}
```

**Test**: Executer `node index.js run file-read --input path=C:\temp\test.txt` via une session invoke. Verifier que `_nodeResult_xxx` ne commence PAS par `content: `.

---

### A-2 : Fix AgentBlockExecutor — gardes mecaniques minimales

**Fichier**: `backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs`

**Principe important** : Les gardes dans le loop de l'agent sont des **filets de securite mecaniques minimaux**. Ils empechent les cas les plus evidents (done sans travail, loop casse par un non-JSON). Mais la **vraie validation** se fait au niveau du workflow par le `json-validator` block (Phase B), qui retourne des erreurs dynamiques et specifiques au schema. Les messages hardcodes ici sont des fallbacks de dernier recours — pas la strategie principale.

#### Bug 1 : Done guard (ligne ~95 + lignes 182-189)

Ajouter un compteur de tool calls reels. Refuser `done` si zero tool calls executes.

```csharp
// Avant le while(true) loop (ligne ~92):
var actualToolCallCount = 0;

// Dans le handler de tool execution (apres ExecuteToolCall, ligne ~207):
actualToolCallCount++;

// Dans le handler "done" (ligne ~182):
if (toolId == "done")
{
    if (actualToolCallCount == 0 && iteration < maxIterations - 1)
    {
        result.Logs.Add("Agent claimed 'done' with 0 tool calls. Forcing real work.");
        messages.Add(ChatMessage.Assistant(jsonContent));
        messages.Add(ChatMessage.User(
            "You have not made any tool calls yet. " +
            "You must use tools to complete the task. " +
            "Start by reading a file or listing the directory."));
        toolCalled = true;
        continue;
    }
    // ... normal done handling
}
```

**Note** : Ce message est generique car l'executor ne connait pas le contexte du workflow. C'est voulu — la validation specifique ("le plan manque le champ target au step 3") est faite par le json-validator au niveau workflow. L'executor dit juste "tu n'as rien fait, recommence".

#### Bug 2 : Non-JSON retry (ligne ~227)

```csharp
// Declarer avant le loop:
var nonJsonRetryCount = 0;

// Remplacer la ligne 227 (if (!toolCalled || iteration >= maxIterations) break;):
if (!toolCalled)
{
    if (nonJsonRetryCount < 2)
    {
        nonJsonRetryCount++;
        result.Logs.Add($"Response not valid JSON (retry {nonJsonRetryCount}/2).");
        messages.Add(ChatMessage.Assistant(response.Content));
        messages.Add(ChatMessage.User(
            "Your response was not a valid JSON tool call. " +
            "Respond with ONLY a JSON object. Example:\n" +
            "{\"tool\":\"maestro_cli\",\"args\":{\"command\":\"run directory-list --input path=/some/path\"}}"));
        continue;
    }
    break;
}
if (iteration >= maxIterations) break;
```

#### Bug 3 : Exception retry (lignes 222-225)

```csharp
catch (Exception ex)
{
    result.Logs.Add($"Tool call parse error: {ex.Message}");
    if (nonJsonRetryCount < 2)
    {
        nonJsonRetryCount++;
        messages.Add(ChatMessage.Assistant(response.Content));
        messages.Add(ChatMessage.User(
            "Your response caused a parsing error. " +
            "Respond with ONLY a valid JSON object. No text before or after."));
        continue;
    }
}
```

**Test**: Relancer le test simple (math.ts) pour verifier pas de regression. Puis test complexe — l'agent devrait etre force a faire des tool calls au lieu d'halluciner "done" immediatement.

---

### A-3 : Ajouter `set-variable` node type

**Fichier**: `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
**Ou**: Dans `ExecuteConfigNodesAsync` (le switch sur `nodeType`, vers ligne ~475)

**Pourquoi**: On a besoin de stocker l'output du `json-validator` (un JSON propre et valide) dans une variable de session pour que le `for-each` puisse iterer dessus. Sans `set-variable`, il faudrait que le for-each lise directement `_nodeResult_validate-plan` (implicite, cache) ou qu'on passe par un fichier sur disque (lourd).

**Usage dans le workflow**:
```json
{
  "id": "store-plan",
  "type": "set-variable",
  "variable": "_planSteps",
  "value": "{{previousOutput}}"
}
```

Ceci prend l'output du node precedent (le JSON valide du json-validator) et le stocke dans `_planSteps`. Le `for-each` ensuite lit `_planSteps`.

**Ajouter dans le switch**:
```csharp
case "set-variable":
    lastOutput = ExecuteSetVariableNode(session, configNode, lastOutput);
    break;
```

**Handler**:
```csharp
/// <summary>
/// Sets a session variable from a template value or previousOutput.
/// Config: { "type": "set-variable", "id": "store-plan", "variable": "_planSteps", "value": "{{previousOutput}}" }
/// If "value" is absent, uses previousOutput directly.
/// If the value is a JSON array/object, parses it for proper List/Dict storage.
/// </summary>
private string ExecuteSetVariableNode(
    Domain.Entities.ProjectSession session,
    JsonElement nodeConfig,
    string? previousOutput)
{
    var nodeId = nodeConfig.TryGetProperty("id", out var idProp)
        ? idProp.GetString() ?? "set-variable" : "set-variable";
    var variableName = nodeConfig.TryGetProperty("variable", out var varProp)
        ? varProp.GetString() : null;

    if (string.IsNullOrEmpty(variableName))
    {
        AppendExecutionLog(session, "error", $"set-variable '{nodeId}': missing 'variable' property");
        return previousOutput ?? "";
    }

    // Resolve value — from template, or use previousOutput
    var rawValue = previousOutput ?? "";
    if (nodeConfig.TryGetProperty("value", out var valProp))
    {
        var templateValue = valProp.GetString() ?? "";
        rawValue = ResolveTemplate(templateValue, session);
    }

    // Try to parse as JSON for proper List<object>/Dictionary storage
    var trimmed = rawValue.Trim();
    if (trimmed.StartsWith("[") || trimmed.StartsWith("{"))
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<JsonElement>(trimmed);
            session.SetVariable(variableName, parsed);
            NormalizeJsonElementToList(session, variableName);
            AppendExecutionLog(session, "info",
                $"set-variable '{nodeId}': stored parsed JSON in '{variableName}' ({trimmed.Length} chars)");
        }
        catch
        {
            session.SetVariable(variableName, rawValue);
            AppendExecutionLog(session, "info",
                $"set-variable '{nodeId}': stored string in '{variableName}' ({rawValue.Length} chars)");
        }
    }
    else
    {
        session.SetVariable(variableName, rawValue);
        AppendExecutionLog(session, "info",
            $"set-variable '{nodeId}': stored in '{variableName}' ({rawValue.Length} chars)");
    }

    return rawValue;
}
```

**C'est generique** : `set-variable` ne sait rien des plans, steps, ou dev. Il stocke une valeur dans une variable. Reutilisable partout.

---

### A-4 : Ajouter `_currentItemJson` dans for-each

**Fichier**: `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
**Ou**: Dans `ExecuteForEachNodeAsync`, juste avant le dispatch des child nodes

**Pourquoi**: Quand le `for-each` itere sur `_planSteps`, chaque child node (implement-step, validate-step) a besoin de recevoir le step courant dans ses inputs. Actuellement, le for-each ne stocke pas l'item courant dans une variable accessible par les templates `{{...}}`.

**Ajouter juste avant le commentaire "DISPATCH TO CHILD NODES"**:
```csharp
// Expose current item as template-accessible session variables
session.SetVariable("_currentItem", itemDict);
try
{
    session.SetVariable("_currentItemJson", JsonSerializer.Serialize(itemDict));
}
catch
{
    session.SetVariable("_currentItemJson", itemId ?? "");
}
```

**Usage dans le workflow**:
```json
{
  "id": "implement-step",
  "blockRef": "implement-single-step",
  "inputs": {
    "step": "{{_currentItemJson}}",
    "workingDir": "{{inputs.repoPath}}"
  }
}
```

L'agent recoit UN step en JSON, pas 25.

---

### A-5 : Retirer le diagnostic logging

Apres validation des fixes, retirer les `Console.WriteLine("[DIAG-...")` :
- `AgentBlockExecutor.cs` lignes 428, 430 (2 lignes)
- `ToolBlockExecutor.cs` lignes 811, 814-816 (4 lignes)

---

## Phase B : Nouveaux Tool Blocks

### B-1 : `json-validator` tool block

**Role central** : C'est la piece maitresse de la validation inter-agents. Il transforme du texte brut (potentiellement pollue) en JSON valide et structure, ou retourne des erreurs specifiques et dynamiques.

**Fichiers a creer**:
- `content/system/blocks/tools/json-validator/json-validator.tool.block.json`
- `content/system/blocks/tools/json-validator/validate.js`

#### Pourquoi un tool block et pas du C#

Les schemas de validation sont du **contenu specifique au workflow**, pas de l'infrastructure :
- "Un plan a des champs id, action, target" → specifique au workflow de dev
- "Un resultat de test a des champs passed, failed" → specifique aux tests
- Un workflow de traduction aurait des schemas completement differents

Ajouter un schema = ajouter une fonction dans `validate.js`. Zero recompilation du backend.

#### Comment il alimente le feedback aux agents

Dans le workflow v3, le json-validator est place **apres** chaque agent producteur de donnees. Si la validation echoue, le workflow peut :

1. **Niveau actuel (v3)** : Logger l'erreur et continuer (l'execution tree montre l'echec)
2. **Niveau futur (v3.1)** : Utiliser un `while` + `conditional` pour re-invoquer l'agent avec les erreurs du validator

Exemple de feedback dynamique (futur v3.1) :
```json
{
  "id": "plan-with-retry",
  "type": "while",
  "condition": "{{_planValid}} != true",
  "maxIterations": 3,
  "nodes": [
    {
      "id": "plan",
      "blockRef": "task-planner",
      "inputs": {
        "task": "{{inputs.task}}",
        "context": "{{_nodeResult_prepare}}",
        "validationErrors": "{{_planValidationErrors}}"
      }
    },
    {
      "id": "validate-plan",
      "blockRef": "json-validator",
      "inputs": { "data": "{{previousOutput}}", "schema": "plan-steps" }
    },
    {
      "id": "store-validation",
      "type": "set-variable",
      "variable": "_planValid",
      "value": "{{_nodeResult_validate-plan}}"
    }
  ]
}
```

Le task-planner recoit `validationErrors` en input — qui contient les erreurs specifiques du json-validator comme "Step 3: missing 'target'" ou "Expected JSON array, got object". C'est **dynamique et specifique**, pas un message hardcode generique.

**Pour v3 (maintenant)** : Le json-validator est lineaire (pas de retry). Si la validation echoue, le workflow continue mais le `set-variable` ne stocke rien → le `for-each` a zero items → le workflow se termine proprement avec un log d'erreur visible.

#### block.json

```json
{
  "id": "json-validator",
  "name": "JSON Validator",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Validates JSON data against named schemas. Strips prefixes, extracts from markdown, checks required fields. Returns cleaned JSON or specific error messages.",
  "inputs": [
    { "id": "data", "type": "string", "required": true, "description": "Raw data to validate (may have prefixes, markdown wrapping, etc.)" },
    { "id": "schema", "type": "string", "required": true, "description": "Schema name: project-context, plan-steps, step-result, test-results" }
  ],
  "outputs": [
    { "id": "content", "type": "string", "description": "JSON: {isValid, errors[], parsed} — parsed is the clean JSON if valid, null if not" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "validate.js"
  },
  "metadata": {
    "category": "validation",
    "tags": ["json", "validator", "schema", "data-quality"]
  }
}
```

#### validate.js

```javascript
// Inputs via environment variables (set by ToolBlockExecutor for script-based tools)
const raw = process.env.MAESTRO_INPUT_DATA || '';
const schemaName = process.env.MAESTRO_INPUT_SCHEMA || '';

// --- Step 1: Clean the raw input ---
let cleaned = raw.trim();

// Strip common output prefixes added by EntryPointExecutor (fallback for pre-fix code)
for (const prefix of ['result: ', 'content: ', 'response: ', 'output: ', 'summary: ']) {
  if (cleaned.startsWith(prefix)) {
    cleaned = cleaned.slice(prefix.length).trim();
    break; // Only strip the first match
  }
}

// Extract from markdown code blocks (agents sometimes wrap JSON in ```)
const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
if (mdMatch) cleaned = mdMatch[1].trim();

// --- Step 2: Parse JSON ---
let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  // Return specific parse error — this is what gets fed back to the agent on retry
  output({ isValid: false, errors: [`JSON parse error: ${e.message}. Input starts with: "${cleaned.substring(0, 100)}..."`], parsed: null });
  process.exit(0);
}

// --- Step 3: Validate against schema ---
const errors = [];

const schemas = {
  'plan-steps': (data) => {
    if (!Array.isArray(data)) return [`Expected a JSON array of steps, got ${typeof data}`];
    if (data.length === 0) return ['Plan is empty — no steps defined'];
    const errs = [];
    data.forEach((step, i) => {
      const prefix = `Step ${i + 1}`;
      if (step.id === undefined) errs.push(`${prefix}: missing 'id' (required: unique step number)`);
      if (!step.action) errs.push(`${prefix}: missing 'action' (required: create|modify|delete|add-dependency|run-command)`);
      if (!step.target) errs.push(`${prefix}: missing 'target' (required: relative file path from repo root)`);
      if (!step.description) errs.push(`${prefix}: missing 'description' (required: what to do)`);
      if (step.action && !['create','modify','delete','add-dependency','run-command'].includes(step.action)) {
        errs.push(`${prefix}: invalid action '${step.action}' — must be one of: create, modify, delete, add-dependency, run-command`);
      }
      if (step.target && path.isAbsolute && require('path').isAbsolute(step.target)) {
        errs.push(`${prefix}: target '${step.target}' is an absolute path — must be relative to repo root`);
      }
    });
    return errs;
  },

  'project-context': (data) => {
    if (typeof data !== 'object' || Array.isArray(data)) return ['Expected a JSON object'];
    const errs = [];
    if (!data.project && !data.stack && !data.name) {
      errs.push("Missing project info — expected at least 'project', 'stack', or 'name' field");
    }
    return errs;
  },

  'step-result': (data) => {
    if (typeof data !== 'object' || Array.isArray(data)) return ['Expected a JSON object with step results'];
    return [];
  },

  'test-results': (data) => {
    if (typeof data !== 'object' || Array.isArray(data)) return ['Expected a JSON object with test results'];
    return [];
  }
};

const validator = schemas[schemaName];
if (!validator) {
  errors.push(`Unknown schema '${schemaName}'. Available: ${Object.keys(schemas).join(', ')}`);
} else {
  errors.push(...validator(parsed));
}

// --- Step 4: Output ---
output({
  isValid: errors.length === 0,
  errors,
  parsed: errors.length === 0 ? cleaned : null
});

function output(result) {
  console.log(JSON.stringify(result));
}
```

**Test direct (sans session)** :
```bash
cd C:\Meastro\maestro-cli
node index.js run json-validator --input-json '{"data":"[{\"id\":1,\"action\":\"create\",\"target\":\"src/types/FileNode.ts\",\"description\":\"Create FileNode type\"}]","schema":"plan-steps"}'
```

**Test avec prefixe** :
```bash
node index.js run json-validator --input-json '{"data":"result: [{\"id\":1,\"action\":\"create\",\"target\":\"src/types/FileNode.ts\",\"description\":\"Create FileNode type\"}]","schema":"plan-steps"}'
```

**Test avec erreur (champ manquant)** :
```bash
node index.js run json-validator --input-json '{"data":"[{\"id\":1,\"action\":\"create\"}]","schema":"plan-steps"}'
# Expected output: isValid=false, errors=["Step 1: missing 'target'", "Step 1: missing 'description'"]
```

---

### B-2 : `step-validator` tool block

**Role** : Apres chaque step d'implementation, verifie sur le **filesystem** que le travail a reellement ete fait. C'est le garde anti-hallucination au niveau fichier.

**Fichiers a creer**:
- `content/system/blocks/tools/step-validator/step-validator.tool.block.json`
- `content/system/blocks/tools/step-validator/validate-step.js`

#### block.json

```json
{
  "id": "step-validator",
  "name": "Step Validator",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Validates that an implementation step was completed by checking the filesystem. Returns specific errors if files are missing or empty.",
  "inputs": [
    { "id": "step", "type": "string", "required": true, "description": "Step JSON: {action, target, description}" },
    { "id": "result", "type": "string", "required": false, "description": "Agent's claimed result (for logging)" },
    { "id": "workingDir", "type": "string", "required": true, "description": "Repository root path" }
  ],
  "outputs": [
    { "id": "content", "type": "string", "description": "JSON: {isValid, errors[], target, action, fileSize}" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "validate-step.js"
  },
  "metadata": {
    "category": "validation",
    "tags": ["step", "validator", "filesystem", "anti-hallucination"]
  }
}
```

#### validate-step.js

```javascript
const fs = require('fs');
const path = require('path');

const stepJson = process.env.MAESTRO_INPUT_STEP || '{}';
const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || '';
const agentResult = process.env.MAESTRO_INPUT_RESULT || '';

let step;
try { step = JSON.parse(stepJson); } catch { step = {}; }

const errors = [];
const target = step.target ? path.resolve(workingDir, step.target) : null;

if (!target) {
  errors.push('No target path in step definition');
} else if (!step.action) {
  errors.push('No action in step definition');
} else {
  switch (step.action) {
    case 'create':
      if (!fs.existsSync(target)) {
        errors.push(`HALLUCINATION DETECTED: File '${step.target}' should have been CREATED but does NOT exist on disk`);
      } else {
        const stat = fs.statSync(target);
        if (stat.size === 0) {
          errors.push(`File '${step.target}' exists but is EMPTY (0 bytes) — likely not properly written`);
        }
      }
      break;
    case 'modify':
      if (!fs.existsSync(target)) {
        errors.push(`HALLUCINATION DETECTED: File '${step.target}' should have been MODIFIED but does NOT exist on disk`);
      }
      // Future: could compare with git to verify actual modification
      break;
    case 'delete':
      if (fs.existsSync(target)) {
        errors.push(`File '${step.target}' should have been DELETED but still exists on disk`);
      }
      break;
    case 'add-dependency':
    case 'run-command':
      // Can't easily verify on filesystem — pass
      break;
    default:
      errors.push(`Unknown action '${step.action}' — expected: create, modify, delete, add-dependency, run-command`);
  }
}

const result = {
  isValid: errors.length === 0,
  errors,
  target: step.target || null,
  action: step.action || null,
  fileSize: target && fs.existsSync(target) ? fs.statSync(target).size : null
};

console.log(JSON.stringify(result));
```

---

## Phase C : Workflow v3 + Prompts

### C-1 : Mettre a jour `autonomous-development.workflow.block.json`

Remplacer la v2.0.0 (6 nodes plats) par la v3.0.0 avec :
- `json-validator` apres prepare et plan
- `set-variable` pour stocker le plan valide
- `for-each` sur les steps du plan
- `step-validator` apres chaque implement
- `conditional` pour commit seulement si review OK

```
nodes:
  1. prepare              (blockRef: project-preparer)
  2. validate-context     (blockRef: json-validator, schema=project-context)
  3. plan                 (blockRef: task-planner)
  4. validate-plan        (blockRef: json-validator, schema=plan-steps)
  5. store-plan           (type: set-variable, variable=_planSteps, value={{previousOutput}})
  6. implement-steps      (type: for-each, source=_planSteps, itemId=id)
     ├── implement-step   (blockRef: implement-single-step, inputs.step={{_currentItemJson}})
     └── validate-step    (blockRef: step-validator, inputs.step={{_currentItemJson}})
  7. test                 (blockRef: test-executor)
  8. review               (blockRef: code-reviewer)
  9. maybe-commit         (type: conditional)
     ├── then: commit     (blockRef: git-committer)
     └── else: skip
```

**Ce que le monitor affichera** :
```
autonomous-development                    [running]
├── Analyze Project                       [done]     42s
├── Validate Context                      [done]     <1s
├── Plan Implementation                   [done]     1m 15s
├── Validate Plan                         [done]     <1s  ✓ 7 steps
├── Store Plan                            [done]     <1s
├── Implement Steps                       [running]  Step 3/7
│   ├── Step 1: Create FileNode type      [done]     25s  ✓ verified
│   ├── Step 2: Create tree utils         [done]     30s  ✓ verified
│   ├── Step 3: Create FileTree component [running]  ...
│   ├── Step 4-7                          [pending]
├── Run Tests                             [pending]
├── Review Code Quality                   [pending]
└── Commit If Quality OK                  [pending]
```

### C-2 : Simplifier `implement-single-step/system-prompt.md`

Le prompt actuel gere multi-step ET single-step (89 lignes). En v3, l'agent recoit **un seul step** via `{{_currentItemJson}}`. Simplifier :

- Retirer tout le parsing de plan multi-step ("If you received a multi-step plan...")
- Retirer "process steps in order"
- L'input `step` est directement un JSON object, pas un array a parser
- Ajouter des regles anti-hallucination :
  - "Your FIRST response MUST be a tool call (file-read or directory-list). NEVER start with done."
  - "The system checks your work on disk after you finish. If the file doesn't exist, you have failed."
  - "You MUST make at least one file-write tool call for create/modify actions."

### C-3 : Ajuster les autres prompts

- **task-planner** : Ajouter "Each step `target` must be a RELATIVE path from the repo root (e.g., `src/types/FileNode.ts`, not `C:\temp\...\src\types\FileNode.ts`). The system validates this."
- **git-committer** : Ajouter "Your FIRST action MUST be running `git status`. NEVER report results without running the actual command."
- **task-planner** : Ajouter un rappel sur le format attendu en output — le json-validator va verifier `{id, action, target, description}` sur chaque step. Si un champ manque, la validation echoue.

---

## Phase D : Tests de Validation

### D-1 : Test simple (regression)

- **Tache**: "Add a multiply function to math.ts"
- **Repo**: `C:\temp\react-test-app` (scaffold basique)
- **Attentes**: 1-2 steps dans le plan, json-validator passe, 1 file-write, step-validator confirme, commit cree
- **Verifie**: Pas de regression par rapport aux tests 30-C-2

### D-2 : Test modere

- **Tache**: "Fix all TypeScript compilation errors in this project. Run tsc --noEmit to verify."
- **Repo**: `C:\temp\ts-errors-test` (2 fichiers avec erreurs de type)
- **Attentes**: 2-3 steps, json-validator passe, step-validator confirme chaque fichier modifie
- **Verifie**: `npx tsc --noEmit` passe apres les fixes

### D-3 : Test complexe (le vrai test)

- **Tache**: "Create a FileTree component with types, component, styles, tests, and barrel export"
- **Repo**: `C:\temp\react-test-app`
- **Attentes**: 5-7 steps, for-each iterate, chaque step cree un fichier
- **Checklist**:
  - [ ] json-validator accepte le plan (isValid=true)
  - [ ] for-each montre "Step 1/7", "Step 2/7", etc. dans l'execution tree
  - [ ] step-validator confirme chaque fichier (isValid=true, fileSize > 0)
  - [ ] Fichiers existent reellement sur disque (verification manuelle)
  - [ ] review donne un score
  - [ ] commit cree si score >= 0.7

---

## Ordre d'Execution

```
1. Phase A (A-1 a A-4)     — Build + test backend
2. Phase B (B-1 et B-2)     — Creer blocks + test CLI direct (independant de A)
3. Phase A-5                 — Retirer diagnostic logging
4. Phase C (C-1 a C-3)      — Workflow v3 + prompts (depend de A + B)
5. Phase D (D-1 a D-3)      — Tests (depend de tout)
```

---

## Ou Repartir Apres

**Si D-3 passe** :
- 30-C-AJUSTEMENT = COMPLETE
- Documenter les resultats dans `30-C-AJUSTEMENT/RESULTS.md`
- Continuer vers Phase 30-D (ou 30-E selon `PHASE-30/PLAN.md`)
- Le workflow v3 valide = Maestro peut faire du vrai dev autonome

**Si D-1/D-2 passent mais D-3 echoue** :
- L'infrastructure fonctionne (les fixes C# sont bons)
- Le probleme est dans le contenu (prompts, schemas)
- Iterer sur les prompts de implement-single-step et task-planner
- Possiblement ajouter le retry avec while + json-validator feedback (v3.1)

**Si D-1 echoue** :
- Regression dans les fixes C#
- Debugger A-1 (output format) et A-2 (agent loop) en priorite

---

## Resume des fichiers

### C# a modifier

| Fichier | Changement |
|---------|-----------|
| `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | A-1: output format, A-3: set-variable, A-4: _currentItemJson |
| `backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | A-2: done guard + retry, A-5: remove DIAG |
| `backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` | A-5: remove DIAG |

### Fichiers a creer

| Fichier | Type |
|---------|------|
| `content/system/blocks/tools/json-validator/json-validator.tool.block.json` | Block definition |
| `content/system/blocks/tools/json-validator/validate.js` | Validation script |
| `content/system/blocks/tools/step-validator/step-validator.tool.block.json` | Block definition |
| `content/system/blocks/tools/step-validator/validate-step.js` | Validation script |

### Fichiers a modifier

| Fichier | Changement |
|---------|-----------|
| `content/system/blocks/workflows/autonomous-development.workflow.block.json` | v2 → v3 |
| `content/system/blocks/agents/implement-single-step/system-prompt.md` | Single-step + anti-hallucination |
| `content/system/blocks/agents/task-planner/system-prompt.md` | Relative paths + format reminder |
| `content/system/blocks/agents/git-committer/system-prompt.md` | Anti-hallucination |
