# 62-C : System Prompt Dynamique — Tools injectes par la session

**Statut** : A FAIRE
**Effort** : 1-1.5 jours
**Prerequis** : 62-A et 62-B COMPLETE

---

## Objectif

Le system prompt des agents ne doit lister que les tools disponibles dans la session. L'injection des tools est de l'infrastructure (`AgentBlockExecutor`), pas un block. Les descriptions des tools viennent des `block.json` des tools — pas de duplication.

---

## Etat actuel

### System prompt statique

Chaque agent a un fichier `system-prompt.md` qui liste les tools en dur :

```markdown
## Tools

| Tool | Args |
|------|------|
| `file-read` | `path` |
| `file-write` | `path`, `content` |
| `shell-execute` | `command` |
| `step-complete` | `summary` + output fields |

### JSON format for each tool:
{"tool": "file-read", "args": {"path": "..."}}
```

Il y a 19 system prompts d'agents dans `content/system/blocks/agents/`.

### Tool block.json

Les block.json des tools contiennent deja les schemas dans le champ `inputs` :

```json
{
  "id": "capture-file-write",
  "inputs": [
    {"id": "path", "type": "string", "required": true, "description": "Path of the file to write"},
    {"id": "content", "type": "string", "required": true, "description": "Content to write"}
  ]
}
```

**Important** : le champ `inputs` n'est PAS charge dans `BlockDefinition` par le `FileSystemBlockDiscoveryService` — il reste dans le JSON brut. Il faut lire le fichier block.json directement pour obtenir les inputs.

### AgentBlockExecutor.PrepareExecutionAsync

Le flow actuel :
1. `LoadSystemPrompt(block)` — lit `system-prompt.md` ou `config.systemPrompt`
2. Cree une conversation avec ce prompt
3. Seed l'historique

---

## Plan d'implementation

### Etape 1 : Creer ToolSchemaGenerator (infrastructure C#)

**Fichier** : `Maestro.Infrastructure/BlockExecutors/ToolSchemaGenerator.cs`

Classe statique ou service qui :
1. Recoit une liste de tool IDs autorises
2. Pour chaque tool, charge le block.json depuis le disque
3. Lit le champ `inputs` du JSON brut (si present — voir gestion des cas limites ci-dessous)
4. Genere la section markdown pour le system prompt

**Acces au path du block** : `BlockDefinition` ne contient pas forcement de propriete `SourcePath`. Le `FileSystemBlockDiscoveryService` injecte le path du dossier dans `Config["path"]` lors du chargement. `ToolSchemaGenerator` recoit un `BlockDefinition` et lit `Config["path"]` pour localiser le `block.json` sur disque. Si cette propriete n'est pas disponible, il faudra soit l'ajouter a `BlockDefinition`, soit extraire `GetBlockPath()` de `LLMBlockExecutorBase` en helper statique. Verifier laquelle des deux approches est la plus propre avant d'implementer.

**Gestion des block.json sans `inputs`** : certains tool blocks peuvent ne pas avoir de champ `inputs` dans leur JSON (tools simples, tools legacy). `ToolSchemaGenerator` doit generer une entree minimale (nom + description, sans args) au lieu de crasher. Test unitaire dedie pour ce cas.

```csharp
public class ToolSchemaGenerator
{
    private readonly IBlockDiscoveryService _blockDiscovery;

    /// <summary>
    /// Generates the "Available Tools" markdown section for an agent's system prompt.
    /// Reads tool descriptions and input schemas from their block.json files.
    /// Only includes tools that are in the AllowedBlocks list.
    /// </summary>
    public async Task<string> GenerateToolsSectionAsync(
        List<string> allowedBlocks,
        CancellationToken ct = default)
    {
        // 1. If wildcard, discover all tool-type blocks
        // 2. Otherwise, fetch each allowed block by ID
        // 3. For each tool block, read its block.json for inputs
        // 4. Generate markdown with JSON schema per tool
        // 5. Always include step-complete (required for agent loop exit)
    }
}
```

**Format de sortie** (ce que l'agent voit dans son prompt) :

```markdown
You have access to these tools. Call ONE tool per response.

### file-read
Read a file from the filesystem.
```json
{"tool": "file-read", "args": {"path": "<string, required> Path of the file to read"}}
```

### file-write
Write content to a file.
```json
{"tool": "file-write", "args": {"path": "<string, required> Path of the file", "content": "<string, required> Content to write"}}
```

### step-complete
Signal that you have completed your task. MANDATORY to call when done.
```json
{"tool": "step-complete", "args": {"summary": "<string, required> Summary of what you did"}}
```
```

### Etape 2 : Modifier AgentBlockExecutor.PrepareExecutionAsync

**Fichier** : `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs`

Ajouter l'injection des tools apres le chargement du system prompt :

```csharp
protected override async Task<Dictionary<string, object>> PrepareExecutionAsync(
    BlockDefinition block, ExecutionContext context,
    Dictionary<string, object> inputs, CancellationToken ct)
{
    // ... existing code: clear agent state ...

    var systemPrompt = LoadSystemPrompt(block);

    // Phase 62-C: Inject available tools based on session permissions
    if (systemPrompt.Contains("{{available_tools}}"))
    {
        var allowedBlocks = context.Variables.TryGetValue("_permissions_allowedBlocks", out var ab)
            ? ab as List<string> ?? new List<string>()
            : new List<string> { "*" }; // Default session has wildcard

        var toolsSection = await _toolSchemaGenerator.GenerateToolsSectionAsync(allowedBlocks, ct);
        systemPrompt = systemPrompt.Replace("{{available_tools}}", toolsSection);
    }

    // ... existing code: create conversation, seed history ...
}
```

**DI** : Injecter `ToolSchemaGenerator` via le constructeur (lazy resolution comme les autres services pour eviter les problemes de DI circulaire).

**Interaction `_toolMapping` + generation du prompt** : quand `_toolMapping` est present (contract tests, sandboxing), `{{available_tools}}` est genere depuis les `AllowedBlocks` — les **noms originaux** (file-write, pas capture-file-write). L'agent voit `file-write` dans son prompt, appelle `file-write`, puis le `ToolDispatcherBlockExecutor` redirige vers `capture-file-write` via le mapping. Le `ToolSchemaGenerator` ne connait pas le mapping — il lit les block.json des tools originaux. C'est coherent : l'agent pense utiliser les vrais tools, le mapping est transparent.

**Le check `Contains("{{available_tools}}")` est temporaire** : il existe pour permettre la migration progressive pendant l'implementation de 62-C. A la fin de 62-C, les 19 prompts sont migres et tout agent sans marqueur est un bug, pas un cas supporte. Pas de legacy support.

### Etape 3 : Migrer les 19 system prompts existants

Pour chaque agent dans `content/system/blocks/agents/` :

1. **Identifier** la section qui liste les tools (varie selon l'agent — certains ont un tableau markdown, d'autres des JSON schemas inline)
2. **Retirer** la section statique des tools
3. **Inserer** `{{available_tools}}` a la place
4. **Garder** les instructions specifiques de l'agent (role, format THINK/ACTION, exemples, etc.)

**Avant** :
```markdown
# Role
You are an agent-creator...

## Tools
| Tool | Args |
|------|------|
| `file-read` | `path` |
| `file-write` | `path`, `content` |
...JSON schemas inline...

## Response Format
Use THINK/ACTION...
```

**Apres** :
```markdown
# Role
You are an agent-creator...

## Available Tools

{{available_tools}}

## Response Format
Use THINK/ACTION...
```

### Etape 4 : step-complete est toujours inclus

`step-complete` est le mecanisme de sortie de la boucle agentique. Il DOIT etre dans le prompt de chaque agent, meme si les permissions ne le listent pas explicitement.

`ToolSchemaGenerator` l'ajoute toujours a la fin de la section, avec ses champs specifiques (summary, blockId, fitness, etc.). Ces champs dependent du type d'agent — ils sont dans le `system-prompt.md` de l'agent, pas dans le block.json du tool.

**Option A** : le block.json de step-complete definit les inputs de base (summary), et le system-prompt.md de l'agent ajoute les champs specifiques apres `{{available_tools}}`.

**Option B** : `{{available_tools}}` genere tous les tools SAUF step-complete, et step-complete reste en dur dans le system-prompt.md de chaque agent (car ses champs varient par agent).

**Recommandation** : Option B. Le step-complete est specifique a chaque agent (agent-creator a `blockId`, `fitness`, `blockPath` ; test-designer a `testCount`, `coverage`). Le mettre dans `{{available_tools}}` forcerait a definir tous les champs possibles dans un seul block.json, ce qui est incoherent.

### Etape 5 : Gerer le cas AllowedBlocks = ["*"]

Quand la session a `AllowedBlocks = ["*"]` (permission totale) :

1. `ToolSchemaGenerator` appelle `_blockDiscovery.DiscoverAllAsync()` pour lister tous les blocks
2. Filtre par type "tool" (ou types qui sont des tools : tool, capture-file-write, etc.)
3. Genere les schemas pour tous les tools trouves

**Cache** : les schemas generes peuvent etre caches par session (les permissions ne changent pas pendant l'execution d'un agent).

---

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `Maestro.Infrastructure/BlockExecutors/ToolSchemaGenerator.cs` | **CREER** — genere la section tools du prompt |
| `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier PrepareExecutionAsync |
| `Maestro.Api/Program.cs` | Enregistrer ToolSchemaGenerator dans le DI |
| `content/system/blocks/agents/*/system-prompt.md` (x19) | Migrer : retirer tools statiques, inserer `{{available_tools}}` |

---

## Tests

### Tests unitaires

1. **ToolSchemaGenerator avec wildcard** — genere tous les tools de type "tool"
2. **ToolSchemaGenerator avec liste restreinte** — genere seulement les tools listes
3. **ToolSchemaGenerator avec tool inexistant** — ignore sans crash
4. **ToolSchemaGenerator avec block.json sans inputs** — genere une entree minimale (nom + description, pas d'args)
5. **ToolSchemaGenerator format** — le markdown genere contient le nom, la description, le JSON schema
6. **AgentBlockExecutor avec marqueur** — `{{available_tools}}` remplace par la section generee
7. **AgentBlockExecutor sans marqueur** — temporaire pendant migration, sera un bug apres 62-C
8. **step-complete exclu** — `{{available_tools}}` ne genere PAS step-complete (reste dans le prompt statique)

### Tests d'integration

8. **Agent avec permissions restreintes** — le system prompt ne contient que les tools autorises
9. **Agent avec _toolMapping** — les tools mappes apparaissent dans le prompt sous leur nom original (file-write, pas capture-file-write)
10. **Contract test** — l'agent ne voit que les tools mappes dans son prompt + step-complete

---

## Verification

- [ ] `ToolSchemaGenerator` cree et fonctionne
- [ ] `{{available_tools}}` resolu dans PrepareExecutionAsync
- [ ] Les 19 system prompts migres
- [ ] Agent avec AllowedBlocks=["*"] voit tous les tools
- [ ] Agent avec AllowedBlocks restreints voit seulement les tools autorises
- [ ] step-complete reste dans le prompt statique (pas genere par {{available_tools}})
- [ ] Contract tests fonctionnent avec le prompt dynamique
- [ ] `dotnet build` : 0 erreurs
- [ ] Tous les tests passent, 0 regression
- [ ] Checkpoint mis a jour
