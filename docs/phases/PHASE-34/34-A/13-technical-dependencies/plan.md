# Plan A — Infrastructure Backend : EntryPointExecutor + Tool Block Execution

**Objectif** : Ajouter les capacites manquantes dans le workflow engine pour supporter le workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`.
**Impact** : Modifications C# dans `EntryPointExecutor.cs` et `InferenceBlockExecutor.cs`. Aucun nouveau fichier. Aucune modification de bloc.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Liste ce qui existe vs ce qui manque dans le backend
3. **Le fichier a modifier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
4. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 4 documents.**

---

## Contexte — Ce qui existe

L'`EntryPointExecutor` (2500+ lignes) est le moteur d'execution des workflows. Il dispatch les noeuds selon leur `type` dans `ExecuteConfigNodesAsync()` :

```csharp
switch (nodeType)
{
    case "while":       → ExecuteWhileNodeAsync(...)
    case "for-each":    → ExecuteForEachNodeAsync(...)
    case "phase":       → ExecutePhaseNodeAsync(...)
    case "conditional": → ExecuteConditionalNodeAsync(...)
    case "set-variable":→ ExecuteSetVariableNode(...)
    default:            → ExecuteRegularNodeAsync(...)
}
```

**Ce qui manque** (identifie dans `spec/13-technical-dependencies.md`) :
1. **`parallel` node** — lance N children en parallele (`Task.WhenAll`)
2. **`branches` multi-way dans conditional** — actuellement binaire (`then`/`else`), v4 a besoin de N branches
3. **Checkpointing/pause-polling** — a chaque noeud, verifier si le workflow est en pause
4. **`sequence` node** — le workflow v4 utilise des `type: "sequence"` imbriques
5. **`system-prompt.md` file support dans `InferenceBlockExecutor`** — les inference blocks v4 ont des system prompts longs (200+ lignes) impraticables en inline JSON ; l'AgentBlockExecutor supporte deja le chargement depuis fichier

---

## Etape 1 : Ajouter `ExecuteSequenceNodeAsync`

### Pourquoi
Le workflow v4 utilise des noeuds `type: "sequence"` pour grouper des children. Actuellement, seul le niveau racine (`config.nodes`) est traite comme une sequence. Les noeuds enfants `sequence` ne sont pas reconnus par le switch.

### Quoi modifier

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`

**1. Ajouter le case dans `ExecuteConfigNodesAsync`** (apres le case `"conditional"`, avant `default`) :

```csharp
case "sequence":
    lastOutput = await ExecuteSequenceNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
    break;
```

**2. Creer la methode** (placer apres `ExecuteConditionalNodeAsync`) :

```csharp
/// <summary>
/// Executes a sequence node — runs child nodes sequentially, passing output through.
/// This is the named counterpart of the implicit behavior of ExecuteConfigNodesAsync
/// but for nested sequence groups within a workflow.
/// </summary>
private async Task<string?> ExecuteSequenceNodeAsync(
    Domain.Entities.ProjectSession session,
    JsonElement seqNode,
    Dictionary<string, object>? workflowConfig,
    string workingDir,
    string workflowId,
    string? activePhaseId,
    List<object> displayTree,
    string? previousOutput)
{
    var nodeId = seqNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "sequence" : "sequence";

    UpdateNodeById(displayTree, nodeId, "running");
    session.SetVariable("_executionTree", displayTree);
    AppendExecutionLog(session, "info", $"Sequence '{nodeId}': Starting");
    await _repository.SaveAsync(session);

    string? lastOutput = previousOutput;

    if (seqNode.TryGetProperty("children", out var children) && children.ValueKind == JsonValueKind.Array)
    {
        lastOutput = await ExecuteConfigNodesAsync(session, children, workflowConfig, workingDir, workflowId, nodeId, displayTree, lastOutput);
    }
    // Also support "nodes" property (alternative naming)
    else if (seqNode.TryGetProperty("nodes", out var nodes) && nodes.ValueKind == JsonValueKind.Array)
    {
        lastOutput = await ExecuteConfigNodesAsync(session, nodes, workflowConfig, workingDir, workflowId, nodeId, displayTree, lastOutput);
    }

    UpdateNodeById(displayTree, nodeId, "done");
    session.SetVariable("_executionTree", displayTree);
    AppendExecutionLog(session, "success", $"Sequence '{nodeId}': Completed");
    await _repository.SaveAsync(session);

    return lastOutput;
}
```

**3. Mettre a jour `BuildTreeNode`** pour supporter `children` en plus de `nodes` :

Dans la methode `BuildTreeNode`, ajouter AVANT le check pour `"nodes"` :

```csharp
// Support "children" key (used by sequence/parallel nodes in v4 workflows)
if (node.TryGetProperty("children", out var childNodes) && childNodes.ValueKind == JsonValueKind.Array)
{
    var children = new List<object>();
    foreach (var child in childNodes.EnumerateArray())
    {
        var childNode = BuildTreeNode(child);
        if (childNode != null) children.Add(childNode);
    }
    treeNode["children"] = children;
}
else if (node.TryGetProperty("nodes", out var nestedNodes) && nestedNodes.ValueKind == JsonValueKind.Array)
// ... existing code
```

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Build succeeded
```

Creer un test minimal en executant un workflow avec un noeud sequence imbrique.

---

## Etape 2 : Ajouter `ExecuteParallelNodeAsync`

### Pourquoi
Le workflow v4 a un noeud racine `type: "parallel"` avec deux children : le workflow principal et l'interaction-handler. Les children doivent s'executer en parallele via `Task.WhenAll`.

### Quoi modifier

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`

**1. Ajouter le case dans `ExecuteConfigNodesAsync`** :

```csharp
case "parallel":
    lastOutput = await ExecuteParallelNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
    break;
```

**2. Creer la methode** :

```csharp
/// <summary>
/// Executes children in parallel using Task.WhenAll.
/// Each child runs independently. When all complete, the parallel node is marked done.
/// If any child fails, the error is logged but other children continue.
///
/// IMPORTANT: The interaction-handler is typically one of the parallel children.
/// It should be cancelled when the main workflow completes. This is handled by
/// using a CancellationTokenSource that cancels when the first non-interaction child completes.
/// For now (MVP), we use simple Task.WhenAll without cancellation.
/// </summary>
private async Task<string?> ExecuteParallelNodeAsync(
    Domain.Entities.ProjectSession session,
    JsonElement parallelNode,
    Dictionary<string, object>? workflowConfig,
    string workingDir,
    string workflowId,
    string? activePhaseId,
    List<object> displayTree,
    string? previousOutput)
{
    var nodeId = parallelNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "parallel" : "parallel";

    UpdateNodeById(displayTree, nodeId, "running");
    session.SetVariable("_executionTree", displayTree);
    AppendExecutionLog(session, "info", $"Parallel '{nodeId}': Starting children in parallel");
    await _repository.SaveAsync(session);

    // Collect children from "children" or "nodes" property
    JsonElement childrenEl = default;
    var hasChildren = parallelNode.TryGetProperty("children", out childrenEl) && childrenEl.ValueKind == JsonValueKind.Array;
    if (!hasChildren)
        hasChildren = parallelNode.TryGetProperty("nodes", out childrenEl) && childrenEl.ValueKind == JsonValueKind.Array;

    if (!hasChildren)
    {
        AppendExecutionLog(session, "warning", $"Parallel '{nodeId}': No children found");
        UpdateNodeById(displayTree, nodeId, "done", "No children");
        session.SetVariable("_executionTree", displayTree);
        await _repository.SaveAsync(session);
        return previousOutput;
    }

    // Build task list — each child is an independent sub-workflow
    var tasks = new List<Task<string?>>();
    var childIds = new List<string>();

    foreach (var child in childrenEl.EnumerateArray())
    {
        if (child.ValueKind != JsonValueKind.Object) continue;

        var childId = child.TryGetProperty("id", out var cIdProp) ? cIdProp.GetString() ?? "child" : "child";
        childIds.Add(childId);

        // Capture for closure
        var capturedChild = child;
        var capturedPrevious = previousOutput;

        tasks.Add(Task.Run(async () =>
        {
            try
            {
                // Each child is dispatched as if it were a standalone node sequence
                var childType = capturedChild.TryGetProperty("type", out var ctProp) ? ctProp.GetString() : null;

                return childType switch
                {
                    "sequence" => await ExecuteSequenceNodeAsync(session, capturedChild, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, capturedPrevious),
                    "while" => await ExecuteWhileNodeAsync(session, capturedChild, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, capturedPrevious),
                    "for-each" => await ExecuteForEachNodeAsync(session, capturedChild, workflowConfig, workingDir, workflowId, displayTree, capturedPrevious),
                    "conditional" => await ExecuteConditionalNodeAsync(session, capturedChild, workflowConfig, workingDir, displayTree, capturedPrevious),
                    _ => await ExecuteRegularNodeAsync(session, childId, workflowConfig, workingDir, activePhaseId, displayTree, capturedPrevious, capturedChild)
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Parallel child '{ChildId}' failed in '{NodeId}'", childId, nodeId);
                AppendExecutionLog(session, "error", $"Parallel child '{childId}': {ex.Message}");
                return capturedPrevious;
            }
        }));
    }

    // Wait for all children to complete
    var results = await Task.WhenAll(tasks);

    // Use the output of the first child as the "main" output (convention: first child is main-workflow)
    var mainOutput = results.Length > 0 ? results[0] : previousOutput;

    UpdateNodeById(displayTree, nodeId, "done", $"All {tasks.Count} children completed");
    session.SetVariable("_executionTree", displayTree);
    AppendExecutionLog(session, "success", $"Parallel '{nodeId}': All {tasks.Count} children completed");
    await _repository.SaveAsync(session);

    return mainOutput;
}
```

### Avertissement — Concurrence

L'execution en parallele avec `session` partage (un seul objet `ProjectSession`) pose un risque de race condition. Toutes les methodes `session.SetVariable`, `UpdateNodeById`, `AppendExecutionLog`, et `_repository.SaveAsync` ne sont pas thread-safe.

**Solution MVP** : Accepter le risque pour la Phase 34-B (les saves concurrent ne posent pas de probleme grave car c'est du JSON sur disque — le dernier save gagne). Documenter le probleme et planifier un lock dans la Phase 34-D quand l'interaction-handler sera ajoute.

**Solution propre (Phase 34-D)** : Ajouter un `SemaphoreSlim(1,1)` dans `EntryPointExecutor` pour proteger les mutations de session :

```csharp
private readonly SemaphoreSlim _sessionLock = new(1, 1);

// Usage dans chaque methode qui modifie la session :
await _sessionLock.WaitAsync();
try { session.SetVariable(...); await _repository.SaveAsync(session); }
finally { _sessionLock.Release(); }
```

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
```

---

## Etape 3 : Ajouter le support `branches` multi-way dans conditional

### Pourquoi
Le workflow v4 utilise des noeuds decision avec N branches (pas juste `then`/`else`). Exemple du spec :

```json
{
  "type": "conditional",
  "condition": "{{_nodeResult_decide-action}}",
  "branches": {
    "pause": { "blockRef": "state-manager", "input": {"operation": "pause"} },
    "resume": { "blockRef": "state-manager", "input": {"operation": "resume"} },
    "rewind": { "blockRef": "state-manager", "input": {"operation": "rewind"} },
    "inject": { "blockRef": "state-manager", "input": {"operation": "inject"} }
  }
}
```

### IMPORTANT — Correction du spec

Le spec utilise `blockId` dans les noeuds, mais le code utilise `blockRef`. Le spec utilise `ifTrue`/`ifFalse`, mais le code utilise `then`/`else`. **Le code fait foi.** Les branches multi-way doivent utiliser le meme pattern que `then`/`else` — chaque branche a un `blockRef` ou des `nodes`.

### Quoi modifier

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`

**Dans `ExecuteConditionalNodeAsync`**, ajouter le support `branches` AVANT le fallback actuel. Inserer apres la ligne `var condResult = EvaluateCondition(resolvedCondition, session);` et AVANT `var branchName = condResult ? "then" : "else";` :

```csharp
// Multi-way branches: if "branches" property exists, use resolvedCondition as key
if (condNode.TryGetProperty("branches", out var branchesObj) && branchesObj.ValueKind == JsonValueKind.Object)
{
    AppendExecutionLog(session, "info", $"Conditional '{nodeId}': multi-way branch, key='{resolvedCondition}'");

    string? output = null;
    var branchKey = resolvedCondition.Trim().Trim('"'); // Remove surrounding quotes if any

    if (branchesObj.TryGetProperty(branchKey, out var selectedBranch) && selectedBranch.ValueKind == JsonValueKind.Object)
    {
        try
        {
            if (selectedBranch.TryGetProperty("blockRef", out var brBlockRef) && brBlockRef.ValueKind == JsonValueKind.String)
            {
                var branchId = selectedBranch.TryGetProperty("id", out var brIdProp) ? brIdProp.GetString() ?? branchKey : branchKey;
                output = await ExecuteBlockRefAsync(session, brBlockRef.GetString()!, selectedBranch, workingDir, displayTree, branchId, previousOutput);
                session.SetVariable($"_nodeResult_{branchId}", output ?? "");
            }
            else if (selectedBranch.TryGetProperty("nodes", out var brNodes) && brNodes.ValueKind == JsonValueKind.Array)
            {
                output = await ExecuteConfigNodesAsync(session, brNodes, workflowConfig, workingDir, nodeId, null, displayTree, previousOutput);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Multi-way branch '{BranchKey}' failed in '{NodeId}'", branchKey, nodeId);
            output = $"(error in branch '{branchKey}': {ex.Message})";
        }
    }
    else
    {
        // No matching branch — check for "default" branch
        if (branchesObj.TryGetProperty("default", out var defaultBranch) && defaultBranch.ValueKind == JsonValueKind.Object)
        {
            AppendExecutionLog(session, "info", $"Conditional '{nodeId}': no branch for '{branchKey}', using default");
            if (defaultBranch.TryGetProperty("blockRef", out var defBlockRef) && defBlockRef.ValueKind == JsonValueKind.String)
            {
                output = await ExecuteBlockRefAsync(session, defBlockRef.GetString()!, defaultBranch, workingDir, displayTree, "default", previousOutput);
            }
        }
        else
        {
            AppendExecutionLog(session, "warning", $"Conditional '{nodeId}': no branch for '{branchKey}' and no default");
        }
    }

    // Finalize
    output ??= previousOutput ?? "";
    var truncated = output.Length > 500 ? output[..500] + "..." : output;
    UpdateNodeById(displayTree, nodeId, "done", truncated);
    session.SetVariable("_executionTree", displayTree);
    session.SetVariable($"_nodeResult_{nodeId}", output);
    AppendExecutionLog(session, "success", $"{nodeId}: Multi-way branch completed");
    await _repository.SaveAsync(session);
    return output;
}

// Binary branches (existing behavior): then/else
var branchName = condResult ? "then" : "else";
// ... rest of existing code
```

### Verification

Le build doit passer. Tester avec un workflow contenant un noeud `branches`.

---

## Etape 4 : Ajouter le checkpointing / pause-polling

### Pourquoi
L'interaction-handler (Phase 34-D) peut mettre le workflow en pause. Le workflow doit verifier a chaque noeud si l'etat est "paused" et attendre.

### Quoi modifier

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`

**1. Ajouter une methode utilitaire `CheckPauseAsync`** :

```csharp
/// <summary>
/// Checks if the workflow is paused (via session variable _workflowStatus).
/// If paused, polls every 1 second until resumed or cancelled.
/// This enables the interaction-handler to pause/resume the workflow.
/// </summary>
private async Task CheckPauseAsync(Domain.Entities.ProjectSession session, string nodeId)
{
    const int pollIntervalMs = 1000;
    const int maxPauseMs = 300_000; // 5 minutes max pause
    var elapsed = 0;

    while (true)
    {
        // Re-read session from disk to get latest state (interaction-handler may have modified it)
        var freshSession = await _repository.GetByIdAsync(session.Id);
        if (freshSession == null) return;

        var status = freshSession.GetVariable("_workflowStatus")?.ToString();
        if (status != "paused") return;

        if (elapsed >= maxPauseMs)
        {
            _logger.LogWarning("Pause timeout reached ({MaxMs}ms) for node '{NodeId}'. Resuming.", maxPauseMs, nodeId);
            session.SetVariable("_workflowStatus", "running");
            await _repository.SaveAsync(session);
            return;
        }

        AppendExecutionLog(session, "info", $"Workflow paused at node '{nodeId}'. Waiting...");
        await _repository.SaveAsync(session);
        await Task.Delay(pollIntervalMs);
        elapsed += pollIntervalMs;
    }
}
```

**2. Inserer l'appel au debut de `ExecuteConfigNodesAsync`**, dans la boucle `foreach`, juste APRES l'extraction de `nodeId` et `nodeType`, et AVANT le switch :

```csharp
// Check for pause before each node execution
await CheckPauseAsync(session, nodeId);
```

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
```

Tester manuellement :
1. Demarrer un workflow
2. Pendant l'execution, faire `curl -X PUT http://localhost:5000/api/sessions/<id>/variables/_workflowStatus -d '"paused"'`
3. Verifier que le workflow est en pause dans les logs
4. Faire `curl -X PUT http://localhost:5000/api/sessions/<id>/variables/_workflowStatus -d '"running"'`
5. Verifier que le workflow reprend

---

## Etape 5 : Supporter `blockRef` (le bon nom) dans le workflow JSON

### Pourquoi
Le spec utilise `blockId` dans les noeuds, mais le code existant utilise `blockRef`. Le code DOIT rester avec `blockRef` (c'est le standard actuel). Mais le workflow v4 spec utilise `blockId`.

**Decision** : Supporter les DEUX dans `ExecuteRegularNodeAsync` pour robustesse, mais documenter que `blockRef` est le standard.

### Quoi modifier

Dans `ExecuteRegularNodeAsync`, le check actuel est :
```csharp
if (nodeConfig.Value.TryGetProperty("blockRef", out var blockRefProp))
```

Ajouter un fallback pour `blockId` :
```csharp
if (nodeConfig.Value.TryGetProperty("blockRef", out var blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
{
    // existing code
}
else if (nodeConfig.Value.TryGetProperty("blockId", out blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
{
    _logger.LogWarning("Node '{NodeId}' uses deprecated 'blockId' — use 'blockRef' instead", nodeId);
    // same execution logic as blockRef
}
```

Faire de meme dans `ExecuteConditionalNodeAsync` (pour les branches).

### Note importante

Ceci est un **shim temporaire** pour la migration. Le workflow v4 sera ecrit avec `blockRef` (pas `blockId`). Ce shim permet aux specs non mises a jour de fonctionner quand meme.

---

## Etape 6 : Ajouter le support `system-prompt.md` a `InferenceBlockExecutor`

### Pourquoi
Les inference blocks du workflow v4 (code-reviewer, security-reviewer, architecture-reviewer, ui-reviewer, accessibility-checker, plan-validator, step-validator, changelog-writer, summary-reporter) ont des system prompts longs (200+ lignes) qui sont impraticables en inline JSON dans `config.systemPrompt`. L'`AgentBlockExecutor` charge deja `system-prompt.md` depuis le dossier du bloc — l'`InferenceBlockExecutor` doit faire de meme.

### Quoi modifier
**Fichier** : `apps/backend/src/Maestro.Infrastructure/BlockExecutors/InferenceBlockExecutor.cs`

### Code a ajouter

Dans la methode `ExecuteAsync`, apres la ligne qui lit `config.systemPrompt` :

```csharp
// Existing code (line ~55-57):
string? systemPrompt = null;
if (block.Config != null && block.Config.TryGetValue("systemPrompt", out var sp))
    systemPrompt = sp?.ToString();

// NEW: If no inline systemPrompt, try loading from system-prompt.md file
if (string.IsNullOrEmpty(systemPrompt))
{
    var blockPath = GetBlockPath(block);
    if (blockPath != null)
    {
        var promptFile = Path.Combine(blockPath, "system-prompt.md");
        if (File.Exists(promptFile))
            systemPrompt = await File.ReadAllTextAsync(promptFile, ct);
    }
}
```

### Logique
1. D'abord essayer `config.systemPrompt` (inline) — compatibilite ascendante
2. Si absent, chercher `system-prompt.md` dans le dossier du bloc
3. Si aucun des deux n'existe, pas de system prompt (comportement actuel inchange)

### Verification

```bash
# Build le backend
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"

# Creer un inference block de test avec system-prompt.md
# (utiliser un des blocs existants ou creer un bloc temporaire)

# Verifier que le bloc fonctionne avec le fichier system-prompt.md
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run <test-inference-block> --input key=value"
```

### Impact
- **Zero breaking change** : les inference blocks existants avec `config.systemPrompt` inline continuent de fonctionner
- **Debloque** : Plans 06, 07, 08 peuvent utiliser `system-prompt.md` pour leurs inference blocks
- **Coherence** : Agent et Inference blocks supportent le meme mecanisme de chargement de prompt

---

## Resume des modifications

| # | Quoi | Lignes ~ | Risque |
|---|------|----------|--------|
| 1 | `ExecuteSequenceNodeAsync` + case | ~30 | Faible — nouvelle methode, pas de modification existante |
| 2 | `ExecuteParallelNodeAsync` + case | ~80 | Moyen — concurrence sur session state |
| 3 | `branches` multi-way dans conditional | ~50 | Faible — ajoute AVANT le code existant, ne modifie rien |
| 4 | `CheckPauseAsync` + appel | ~30 | Faible — polling non-intrusif |
| 5 | `blockId` fallback | ~10 | Faible — avertissement + fallback |
| 6 | `BuildTreeNode` support `children` | ~10 | Faible — ajout au tree builder |
| 7 | `system-prompt.md` dans `InferenceBlockExecutor` | ~15 | Faible — fallback file load, zero breaking change |

**Total** : ~225 lignes de C# ajoutees, 0 lignes modifiees (sauf les insertions dans le switch, BuildTreeNode, et InferenceBlockExecutor).

---

## Ordre d'execution recommande

1. **Etape 1** (sequence + BuildTreeNode `children` support) — prerequis pour tout le reste
2. **Etape 5** (blockRef/blockId fallback) — quick win
3. **Etape 6** (system-prompt.md dans InferenceBlockExecutor) — quick win, debloque plans 06/07/08
4. **Etape 3** (branches multi-way) — necessaire pour les decisions v4
5. **Etape 2** (parallel) — necessaire pour l'interaction-handler
6. **Etape 4** (checkpointing/pause) — necessaire pour l'interaction-handler

### Verification finale

```bash
# 1. Backend compile
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# 2. Backend tests passent
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : All tests passed

# 3. Verifier que le switch couvre tous les types
# Grep pour les case dans ExecuteConfigNodesAsync
powershell.exe -Command "Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\Sessions\EntryPointExecutor.cs' -Pattern 'case \"'"
# Resultat attendu : while, for-each, phase, conditional, set-variable, sequence, parallel

# 4. Verifier que InferenceBlockExecutor supporte system-prompt.md
powershell.exe -Command "Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\BlockExecutors\InferenceBlockExecutor.cs' -Pattern 'system-prompt.md'"
# Resultat attendu : au moins 1 match
```

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : code C# qui ne compile pas, comportement inattendu du switch/case dans ExecuteConfigNodesAsync, tests qui echouent apres modification, DLLs verrouillees, divergences entre la spec et le code reel.

Format par entree :
```
### [Plan A — INFRASTRUCTURE] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Anti-patterns

- **NE PAS modifier le comportement existant** de while, for-each, conditional, set-variable — seulement AJOUTER
- **NE PAS utiliser `lock` pour la concurrence** — utiliser `SemaphoreSlim` (async-compatible)
- **NE PAS creer de nouvelle classe** — tout reste dans EntryPointExecutor (refactoring futur)
- **NE PAS hardcoder "main-workflow" ou "interaction-handler"** dans le code parallel — les children sont generiques
- **NE PAS bloquer le thread** avec `Thread.Sleep` pour le pause-polling — utiliser `Task.Delay`
