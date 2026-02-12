# Phase 18 : Fusion Agent/Tool → Block + Refonte CLI

## Contexte

L'analyse de la Phase 17 a mis en lumière une violation architecturale majeure :
le principe fondateur de Maestro — **"Everything is a Block"** — n'est pas respecté
dans le backend. Trois systèmes parallèles coexistent :

| Système | Entité | Stockage | Controller | Discovery |
|---------|--------|----------|------------|-----------|
| Blocks | `BlockDefinition` | `*.block.json` | `BlocksController` | `FileSystemBlockDiscoveryService` |
| Agents | `AgentDefinition` | `*.agent.block.json` | `AgentsController` | `AgentRegistry` |
| Tools | `ToolDefinition` | `*.tool.json` | `ToolsController` | `ToolRegistry` |

**Problèmes :**
1. Agent et Tool ont chacun un `BlockId` — ce sont des **wrappers** autour de blocks
2. Trois systèmes de discovery/storage indépendants à maintenir
3. Les métriques sont dupliquées (block execute tracking + agent/tool metrics)
4. Le CLI expose 3 commandes distinctes (`block`, `agent`, `tool`) pour un concept unique
5. Le MCP server devrait exposer des blocks typés, pas 3 APIs séparées

**Objectif :** Fusionner Agent et Tool dans Block. Un seul système, une seule source de vérité.

**ADR :** `docs/phases/PHASE-18/ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT.md`

---

## 1. Architecture Cible

### 1.1 BlockDefinition étendu

Les propriétés spécifiques d'Agent et Tool migrent dans `Config` et `Metadata` du Block,
avec des accesseurs typés.

```
BlockDefinition
├── Id, Name, BlockType, Version, Description
├── IsAtomic, IsSystem, Overridable
├── Capabilities, Tags
├── Config                          ← Contient TOUT
│   ├── nodes[]                     (workflow)
│   ├── inputs / outputs            (schéma I/O, ex-Tool)
│   ├── agent                       (config agent)
│   │   ├── maxSteps, maxTokens, temperature, timeoutMs
│   │   ├── requireApproval, systemPrompt
│   │   └── availableTools[], availableAgents[]
│   └── tool                        (config tool spécifique)
│       └── (input/output schema shortcuts)
├── Metadata
│   ├── category, author, tags
│   ├── designation                 "agent" | "tool" | null
│   └── metrics                     ← Unifié
│       ├── totalRuns, successfulRuns, failedRuns
│       ├── successRate, avgExecutionTimeMs, avgTokenCost
│       ├── avgScore, overallScore
│       ├── lastRunAt
│       └── agent-specific          (si designation=agent)
│           ├── avgStepsPerRun, avgToolsUsedPerRun
│           ├── avgTaskCompletionScore, avgEfficiencyScore
│           └── toolUsage{}
└── CreatedAt, UpdatedAt
```

### 1.2 BlockType vs Designation

**BlockType** (`workflow`, `agent`, `tool`, `prompt`, etc.) = le type structurel du block.
Déjà existant, ne change pas.

**Designation** (nouveau champ `Metadata.designation`) = le rôle fonctionnel.
- `null` — block ordinaire
- `"agent"` — block promu comme agent (a config agent, métriques agent)
- `"tool"` — block promu comme tool (a schema I/O strict, métriques tool)

Un block de type `workflow` peut être designé `agent` ou `tool`.
Un block de type `tool` est implicitement designé `tool`.
Un block de type `agent` est implicitement designé `agent`.

La designation permet de filtrer : `GET /api/blocks?designation=agent` remplace `GET /api/agents`.

### 1.3 Métriques unifiées

Aujourd'hui :
- `BlocksController.Execute` → `RunTracker` (run-level)
- `AgentRegistry.RecordRun` → `AgentMetrics` (aggregate)
- `ToolRegistry.RecordRun` → `ToolMetrics` (aggregate)

Demain :
- `BlocksController.Execute` → `RunTracker` (run-level, inchangé)
- `BlocksController.RecordRun` → `Block.Metadata.metrics` (aggregate, unifié)

Un seul `RecordRun` endpoint sur `/api/blocks/{id}/runs` avec body adapté au type.

### 1.4 Fichiers de stockage

| Avant | Après |
|-------|-------|
| `my-agent.agent.block.json` | `my-agent.block.json` (avec `metadata.designation = "agent"`) |
| `my-tool.tool.json` | `my-tool.block.json` (avec `metadata.designation = "tool"`) |
| `my-workflow.block.json` | `my-workflow.block.json` (inchangé) |

Un seul format, un seul glob pattern, un seul discovery service.

---

## 2. Plan de migration Backend

### Étape 2.1 : Étendre BlockDefinition

**Fichier :** `backend/src/Maestro.Domain/Entities/BlockDefinition.cs`

Ajouter :
```csharp
// Propriétés calculées depuis Config/Metadata
public string? Designation => Metadata?.GetValueOrDefault("designation")?.ToString();
public string? Category => Metadata?.GetValueOrDefault("category")?.ToString();
public string? Author => Metadata?.GetValueOrDefault("author")?.ToString();

// Méthodes helper
public void SetDesignation(string designation);
public void SetCategory(string category);
public void RecordRun(BlockRunResult result);  // Unifié agent+tool
public BlockMetrics? GetMetrics();
```

**Fichier nouveau :** `backend/src/Maestro.Domain/ValueObjects/BlockMetrics.cs`
- Classe unifiée contenant les champs communs (TotalRuns, SuccessRate, etc.)
- Plus les champs agent-spécifiques (optionnels, nullables)
- Méthode `RecordRun` polymorphe selon le type

### Étape 2.2 : Étendre BlockDto

**Fichier :** `backend/src/Maestro.Application/DTOs/BlockDto.cs`

Ajouter :
```csharp
public string? Designation { get; set; }
public string? Category { get; set; }
public string? Author { get; set; }
public object? InputSchema { get; set; }   // Pour tools
public object? OutputSchema { get; set; }  // Pour tools
public object? AgentConfig { get; set; }   // Pour agents
public object? Metrics { get; set; }       // Pour tous
```

`FromDomain` extrait ces champs depuis `Config` et `Metadata`.

### Étape 2.3 : Étendre FileSystemBlockDiscoveryService

**Fichier :** `backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs`

Changements :
1. Ajouter scan des `*.agent.block.json` et `*.tool.json` (phase transitoire)
2. Les convertir en `BlockDefinition` avec la bonne `designation`
3. Terme : ils deviennent tous des `*.block.json`

### Étape 2.4 : Étendre BlocksController

**Fichier :** `backend/src/Maestro.Api/Controllers/BlocksController.cs`

Nouveaux endpoints :
```
GET  /api/blocks?designation=agent&category=dev    ← Remplace GET /api/agents
GET  /api/blocks?designation=tool&category=git     ← Remplace GET /api/tools
GET  /api/blocks/{id}/metrics                      ← Remplace GET /api/agents/{id}/metrics
POST /api/blocks/{id}/runs                         ← Remplace POST /api/agents/{id}/runs
GET  /api/blocks/{id}/tools                        ← Remplace GET /api/agents/{id}/tools
GET  /api/blocks/top?designation=agent&limit=10    ← Remplace GET /api/agents/top
POST /api/blocks/{id}/designate                    ← Promouvoir un block → agent/tool
```

Paramètre `designation` ajouté aux endpoints existants comme filtre optionnel.

### Étape 2.5 : Créer endpoints de compatibilité

**Fichiers :** `AgentsController.cs`, `ToolsController.cs`

Phase transitoire — ces controllers deviennent des **proxies** vers `BlocksController` :
```csharp
[ApiController]
[Route("api/agents")]
[Obsolete("Use /api/blocks?designation=agent instead")]
public class AgentsController : ControllerBase
{
    // Chaque endpoint redirige vers BlocksController avec designation=agent
    [HttpGet]
    public Task<IActionResult> GetAll([FromQuery] string? category)
        => _blocksService.GetAll(designation: "agent", category: category);
}
```

Cela permet aux clients existants (monitor, MCP) de continuer à fonctionner.

### Étape 2.6 : Outil de migration des fichiers

**Script :** `dev-scripts/migrate-agents-tools.ts`

Convertit les fichiers existants :
1. Scanne `*.agent.block.json` → les lit en `AgentDefinition` → écrit en `*.block.json` avec `metadata.designation = "agent"`
2. Scanne `*.tool.json` → les lit en `ToolDefinition` → écrit en `*.block.json` avec `metadata.designation = "tool"`
3. Préserve les métriques, config, et toutes les métadonnées
4. Mode dry-run par défaut, `--apply` pour exécuter

### Étape 2.7 : Supprimer les registries

**Supprimer :**
- `backend/src/Maestro.Infrastructure/Foundry/AgentRegistry.cs`
- `backend/src/Maestro.Infrastructure/Foundry/ToolRegistry.cs`

**Mettre à jour :**
- `Program.cs` — retirer les `AddSingleton<AgentRegistry>()` et `AddSingleton<ToolRegistry>()`
- Remplacer par les services blocks existants

---

## 3. Plan CLI : Commandes raccourcies ("shorthand")

### 3.1 Principe

L'utilisateur tape ce qui est **naturel**. Le CLI résout l'ambiguïté.

```bash
# Ces trois formes sont équivalentes :
tools list                    # Shorthand — "tools" = raccourci block
block list --type tool        # Explicite avec filtre type
block tools list              # Préfixe block + sous-commande

# Même chose pour agents :
agents list
block list --type agent
block agents list
```

### 3.2 Pourquoi c'est une bonne idée

| Avantage | Explication |
|----------|-------------|
| **Rapidité** | `tools list` = 10 chars vs `block list --type tool` = 21 chars |
| **Naturel** | L'utilisateur pense "je veux mes tools", pas "je veux filtrer mes blocks" |
| **Pas d'ambiguïté** | `tools` ne collisionne avec aucune autre commande top-level |
| **Cohérent** | Le même pattern s'applique à `workflows`, `agents`, `prompts`, etc. |
| **Progressif** | Débutant : `tools list`. Expert : `block list --type tool --category git` |

### 3.3 Résolution des commandes

Le CLI résout dans cet ordre :
1. **Commande exacte** — `session`, `block`, `status`, `model`, etc.
2. **Raccourci block type** — `tools`, `agents`, `workflows`, `prompts`
3. **Alias de compatibilité** — anciennes commandes dépréciées

```typescript
// cli.ts - Command resolution
const BLOCK_TYPE_SHORTCUTS: Record<string, string> = {
  'tools':     'tool',
  'tool':      'tool',
  'agents':    'agent',
  'agent':     'agent',
  'workflows': 'workflow',
  'workflow':  'workflow',
  'prompts':   'prompt',
  'prompt':    'prompt',
};

function resolveCommand(args: string[]): ResolvedCommand {
  const cmd = args[0];

  // 1. Exact match
  if (COMMANDS[cmd]) return { handler: COMMANDS[cmd], args: args.slice(1) };

  // 2. Block type shortcut
  if (BLOCK_TYPE_SHORTCUTS[cmd]) {
    const blockType = BLOCK_TYPE_SHORTCUTS[cmd];
    const verb = args[1] || 'list';  // Default to list
    return {
      handler: COMMANDS['block'],
      args: [verb, ...args.slice(2), '--type', blockType]
    };
  }

  // 3. Deprecated alias
  if (DEPRECATED_ALIASES[cmd]) {
    showDeprecationWarning(cmd, DEPRECATED_ALIASES[cmd]);
    return resolveCommand(DEPRECATED_ALIASES[cmd].split(' '));
  }
}
```

### 3.4 Mapping complet des raccourcis

```bash
# Block type shortcuts
tools list                  → block list --type tool
tools info <id>             → block info <id>
tools search <q>            → block search <q> --type tool
tools metrics <id>          → block metrics <id>
tools run <id>              → block run <id>
agents list                 → block list --type agent
agents info <id>            → block info <id>
agents metrics <id>         → block metrics <id>
workflows list              → block list --type workflow
workflows info <id>         → block info <id>
prompts list                → block list --type prompt

# Standalone tool/agent actions (passent par block)
tools create                → block create --type tool
agents create               → block create --type agent
```

### 3.5 Help contextuel

```
FOUNDRY
  block list [--type <t>] [--designation <d>]    List blocks
  block info <id>                                Block details
  block search <query>                           Search blocks
  block run <id>                                 Execute a block
  block metrics <id>                             Block metrics
  block children <id>                            Block hierarchy

  Shortcuts: tools, agents, workflows, prompts
    tools list = block list --type tool
    agents list = block list --type agent
```

---

## 4. Plan CLI : Taxonomie finale

### 4.1 Commandes principales

```
STATUS & MODELS                          ← Monitor: Home + Models
  status                                 Dashboard global
  status backend                         Santé du backend
  status provider                        Santé du LLM provider
  model list                             Modèles disponibles
  model info <name>                      Détail d'un modèle
  model switch <name>                    Changer le modèle actif
  model leaderboard                      Classement fitness
  model profile <name>                   Profil détaillé

SPACES                                   ← Monitor: Spaces
  session list [--status <s>]            Sessions
  session info <id>                      Détail session
  session create [--template <n>]        Créer une session
  session start/stop/pause/resume <id>   Lifecycle
  session invoke <id> [entry-point]      Invoquer un entry-point
  session vars <id> list|get|set         Variables
  session entry-points <id> list|add     Entry-points
  session exec <id> "<cmd>"              Exécuter commande
  session events <id>                    Événements
  session delete <id>                    Supprimer
  session template list|info <name>      Templates

  repo list                              Repos liés
  repo info <id>                         Détail repo
  repo bind <path>                       Lier un repo
  repo start/stop <id>                   Lifecycle

  workspace list                         Workspaces
  workspace info <id>                    Détail
  workspace create <name>               Créer
  workspace delete <id>                  Supprimer

FOUNDRY                                  ← Monitor: Foundry
  block list [--type <t>]                Tous les blocks
  block info <id>                        Détail
  block search <query>                   Recherche
  block children <id> [--recursive]      Hiérarchie
  block run <id> [--input k=v]           Exécuter
  block validate <id>                    Valider
  block metrics <id>                     Métriques
  block publish <id>                     Publier (ex-approve)

  Raccourcis par type:
    tools <verb>                         = block <verb> --type tool
    agents <verb>                        = block <verb> --type agent
    workflows <verb>                     = block <verb> --type workflow

CATALOG                                  ← Monitor: Catalog
  catalog list [--type <t>]              Parcourir le catalogue
  catalog info <id>                      Détail
  catalog search <query>                 Recherche

ADVANCED
  promote status                         État des promotions
  promote agent <id>                     Promouvoir (workspace → workspace)
  promote rollback <id>                  Revenir
  promote history                        Historique
  docs list|show|search                  Documentation
  config keybindings                     Configuration
  schema                                 Schéma JSON des commandes
```

### 4.2 Slash commands (shell interactif)

```
/help, help              Aide
/clear, clear            Effacer l'écran
/exit, exit              Quitter
/select [type] <id>      Sélectionner un contexte
/deselect                Désélectionner
/monitor [id]            Ouvrir le TUI monitor
/config                  Configuration
/history                 Historique
```

### 4.3 Aliases de compatibilité (silencieux + warning)

```
health          → status backend
llm             → status provider
blocks          → block list
info <id>       → block info <id>
children <id>   → block children <id>
search <q>      → block search <q>
run <id>        → block run <id>
execute <id>    → block run <id>
validate <id>   → block validate <id>
projects        → repo list
templates       → session template list
sessions        → session list
use <id>        → /select <id>
unuse           → /deselect
fitness *       → model leaderboard / model profile
```

---

## 5. Impact MCP Server

Le serveur MCP (`maestro-mcp/`) expose des tools pour les IDEs.

### Avant (3 APIs)
```
mcp_tool: maestro_list_agents   → GET /api/agents
mcp_tool: maestro_list_tools    → GET /api/tools
mcp_tool: maestro_list_blocks   → GET /api/blocks
mcp_tool: maestro_run_agent     → POST /api/agents/{id}/execute (n'existe pas encore)
mcp_tool: maestro_run_tool      → POST /api/tools/{id}/execute (n'existe pas encore)
```

### Après (1 API)
```
mcp_tool: maestro_list_blocks   → GET /api/blocks?designation=agent|tool|null
mcp_tool: maestro_run_block     → POST /api/blocks/{id}/execute
mcp_tool: maestro_block_info    → GET /api/blocks/{id}
mcp_tool: maestro_block_metrics → GET /api/blocks/{id}/metrics
```

Plus simple, plus cohérent, plus maintenable.
Les agents et tools ne sont que des filtres de recherche.

---

## 6. Ordre d'exécution

| # | Tâche | Risque | Estimation |
|---|-------|--------|-----------|
| 1 | ADR : Décision architecturale fusion | Faible | — |
| 2 | `BlockMetrics` value object | Faible | Nouveau fichier |
| 3 | Étendre `BlockDefinition` (designation, category, metrics) | Moyen | Touche domain |
| 4 | Étendre `BlockDto` + `FromDomain` | Faible | DTO |
| 5 | Étendre `FileSystemBlockDiscoveryService` (lire .agent.block.json / .tool.json) | Moyen | Discovery |
| 6 | Nouveaux endpoints `BlocksController` (designation filter, metrics, runs, top) | Moyen | API |
| 7 | Proxy `AgentsController` + `ToolsController` → BlocksController | Faible | Rétrocompat |
| 8 | Script migration fichiers | Faible | One-shot |
| 9 | CLI : résolution shorthand (tools/agents/workflows) | Faible | CLI |
| 10 | CLI : taxonomie finale + help organisé par monitor | Moyen | CLI |
| 11 | CLI : select/deselect (remplace use/unuse) | Faible | CLI |
| 12 | CLI : aliases de compatibilité avec warnings | Faible | CLI |
| 13 | MCP : migrer vers blocks-only API | Faible | MCP |
| 14 | Tests : backend build + tests existants passent | — | Validation |
| 15 | Nettoyage : supprimer `AgentRegistry`, `ToolRegistry`, anciens DTOs | Moyen | Suppression |

### Dépendances

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 14 → 15
                          ↘
                           8 (migration fichiers, après que discovery les lise)
                          ↗
9 → 10 → 11 → 12 (CLI, parallèle au backend)
13 (MCP, après 6)
```

---

## 7. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Monitor utilise `/api/agents` et `/api/tools` | Cassure UI | Étape 7 : proxy endpoints |
| Fichiers agents/tools existants perdus | Perte données | Étape 8 : migration avec backup |
| Métriques Agent plus riches que Tool | Perte info | `BlockMetrics` contient les deux, champs optionnels |
| `BlockType` confusion avec `designation` | Confusion dev | Doc claire : type = structure, designation = rôle |
| Performance : un seul discovery pour tout | Lenteur | Le cache existe déjà, ajout filtre en mémoire |

---

## 8. Critères de succès

- [x] `GET /api/blocks?designation=agent` retourne les agents (via BlocksController)
- [x] `GET /api/blocks?designation=tool` retourne les tools (via BlocksController)
- [x] Les anciens endpoints supprimés — FoundryController refactoré vers IBlockDiscoveryService
- [x] `tools list` dans le CLI = `block list --designation tool` (avec deprecation warning)
- [x] `agents list` dans le CLI = `block list --designation agent` (avec deprecation warning)
- [x] Un seul fichier `*.block.json` pour tout (workflow, agent, tool)
- [x] `FileSystemBlockDiscoveryService` est le seul système de discovery
- [x] MCP server déjà blocks-only (aucun changement nécessaire)
- [x] Tous les tests backend passent (93/93)
- [x] Le script de migration convertit tous les fichiers existants (31 agents + 4 tools)
- [x] AgentRegistry, ToolRegistry supprimés
- [x] AgentsController, ToolsController supprimés
- [x] FoundryController refactoré pour utiliser IBlockDiscoveryService
- [x] CLI tree tests passent (88/88)
