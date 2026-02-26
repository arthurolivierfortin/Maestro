# Phase 44 — Analyse d'Isolation: Comment l'Agent Travaille Sans Detruire

## La Question Fondamentale

Le TUI Sentinel doit:
- LIRE le code source de maestro-code (composants, tests, theme)
- ECRIRE des tests (generer des fichiers de test)
- ECRIRE des corrections (modifier des composants)
- EXECUTER des commandes (vitest, node-pty capture)

Mais il ne doit PAS:
- Detruire l'historique git
- Supprimer des fichiers critiques
- Modifier le backend, le CLI, ou l'infrastructure
- Corrompre le systeme de sessions
- Se modifier lui-meme pendant qu'il tourne

---

## La Violation Architecturale: Direct Block Dispatch

### Le probleme fondamental

L'`AgentBlockExecutor` (lignes 781-866) contient une methode `ExecuteViaBlockDispatchAsync()` qui:
1. Resout le block-id via `IBlockDiscoveryService`
2. Obtient l'executor via `BlockExecutorRegistry`
3. Execute le block directement

**C'est une violation de TROIS principes Maestro:**

#### 1. CLI-First ("Toutes les operations passent par le CLI")

Le direct block dispatch contourne le CLI. L'agent appelle `file-read` directement via
l'executor, sans passer par l'infrastructure CLI qui applique les permissions.

```
ACTUEL (violé):
  Agent → AgentBlockExecutor → BlockDiscovery → Executor (DIRECT, pas de permissions)

CORRECT (CLI-First):
  Agent → CLI (typed interface) → PermissionChecker → BlockDiscovery → Executor
```

#### 2. L'agent est une boite noire ("Le type definit son interface, pas son implementation")

L'`AgentBlockExecutor` hardcode le routing de tool calls en C#. Il est devenu un
mini-CLI interne avec `NormalizeToolId()`, resolution de blocks, dispatch. Ce code
n'a rien a faire dans un block executor — c'est de la logique d'infrastructure.

#### 3. Seul l'agent peut faire des tool calls

Aujourd'hui, SEUL l'`AgentBlockExecutor` a le code de dispatch. Un block `inference`
qui retournerait `{"tool": "file-read", "args": {...}}` ne pourrait pas l'executer.
Pourtant, l'interface inference/agent est identique (prompt → response). N'importe quel
block devrait theoriquement pouvoir faire des tool calls si son output en contient.

### L'historique de cette violation

| Phase | Ce qui s'est passe |
|-------|-------------------|
| Pre-Phase 26 | L'agent utilisait `maestro_cli` (texte) pour tout. Lent mais securise. |
| Phase 26 | Ajout de `ExecuteViaBlockDispatchAsync()` comme "recommended path". Le code le labelle "generic block dispatch, no CLI string parsing, JSON stays structured". |
| Post-Phase 26 | Tous les system prompts modernes interdisent `maestro_cli` et utilisent les block-ids directement. |
| Resultat | Le chemin recommande (direct dispatch) n'a AUCUNE verification de permissions. Le chemin securise (CLI) est labelle "legacy" et interdit aux agents. |

### Les deux chemins dans le code

**`AgentBlockExecutor.cs`** — `ExecuteToolCall()` (ligne 705):

```
if (toolId == "maestro_cli"):
    → ExecuteViaCliAsync()        ← LEGACY, permissions via CliExecutor.cs
else:
    → ExecuteViaBlockDispatchAsync()  ← RECOMMANDE, ZERO permissions
```

**`CliExecutor.cs`** (lignes 47-75) verifie:
- `permissions.HasCommand(verb)` — commande autorisee?
- `permissions.HasTool(target)` — tool autorise?
- `permissions.HasBlock(target)` — block autorise?

Le direct dispatch ne fait AUCUNE de ces verifications.

---

## La Bonne Architecture: Interface CLI Typee

### Principe

Le tool dispatch n'appartient **ni** au block executor (violation boite noire) **ni**
au CLI texte (fragile, parsing string). Il appartient au **CLI en tant qu'infrastructure
generique**, mais avec une **interface typee**.

```
N'importe quel block retourne: {"tool": "file-read", "args": {"path": "/foo"}}
                                        ↓
                            IToolDispatcher (infrastructure generique)
                            ├─ Recoit l'appel TYPE (JSON natif, pas du texte)
                            ├─ Verifie permissions (ContextPermissions de la session)
                            ├─ Verifie allowedPaths / blockedPaths (FileAccessRule)
                            ├─ Resout le block-id via IBlockDiscoveryService
                            ├─ Execute via BlockExecutorRegistry
                            └─ Retourne resultat type
                                        ↓
                            Block recoit le resultat et continue
```

### Ce que ca change

| Avant (viole) | Apres (correct) |
|----------------|-----------------|
| `AgentBlockExecutor` a le code de dispatch | `IToolDispatcher` est une interface infrastructure |
| Seul l'agent peut faire des tool calls | N'importe quel block peut en faire |
| Pas de verification de permissions | Permissions TOUJOURS verifiees |
| `NormalizeToolId()` dans l'executor | Normalisation dans le dispatcher (infrastructure) |
| `maestro_cli` = legacy, direct dispatch = recommande | UN seul chemin: `IToolDispatcher` (type) |
| Ajouter un nouveau type de dispatch = modifier C# | Le dispatcher est generique et ne change pas |

### Interface proposee

```csharp
// Maestro.Application/Interfaces/IToolDispatcher.cs
public interface IToolDispatcher
{
    /// <summary>
    /// Dispatches a typed tool call with permission enforcement.
    /// Any block type (agent, inference, future) can use this.
    /// </summary>
    Task<ToolResult> DispatchAsync(
        ToolCall call,           // { toolId, args (Dictionary) }
        ExecutionContext context, // session permissions, workspace, paths
        CancellationToken ct
    );
}

public record ToolCall(string ToolId, Dictionary<string, object> Args);

public record ToolResult(
    bool Success,
    string Output,
    string? Error = null,
    bool PermissionDenied = false
);
```

### Implementation

```csharp
// Maestro.Infrastructure/ToolDispatch/ToolDispatcher.cs
public class ToolDispatcher : IToolDispatcher
{
    public async Task<ToolResult> DispatchAsync(ToolCall call, ExecutionContext ctx, CancellationToken ct)
    {
        // 1. Normalize tool ID (file-read, read-file, cat → file-read)
        var toolId = NormalizeToolId(call.ToolId);

        // 2. Check permissions (EXACTLY like CliExecutor does)
        var permissions = ctx.Session.GetEffectivePermissions();
        if (!permissions.HasTool(toolId))
            return ToolResult.PermissionDenied($"Tool '{toolId}' not allowed");

        // 3. For file operations: check allowedPaths / blockedPaths
        if (IsFileOperation(toolId) && call.Args.TryGetValue("path", out var path))
        {
            if (!permissions.IsPathAllowed(path.ToString()))
                return ToolResult.PermissionDenied($"Path '{path}' not allowed");
        }

        // 4. For shell-execute: check working directory
        if (toolId == "shell-execute" && call.Args.TryGetValue("cwd", out var cwd))
        {
            if (!permissions.IsPathAllowed(cwd.ToString()))
                return ToolResult.PermissionDenied($"Working directory '{cwd}' not allowed");
        }

        // 5. Resolve block and execute (generic, like before)
        var block = await _blockDiscovery.GetByIdAsync(toolId, ct);
        if (block == null)
            return ToolResult.Error($"Unknown tool: {toolId}");

        var executor = _executorRegistry.Get(block.BlockType);
        var result = await executor.ExecuteAsync(block, call.Args, ctx, ct);
        return ToolResult.Success(FormatOutput(result));
    }
}
```

### Migration

1. Creer `IToolDispatcher` + `ToolDispatcher` avec les permissions
2. `AgentBlockExecutor.ExecuteToolCall()` → appelle `_toolDispatcher.DispatchAsync()`
3. Supprimer `ExecuteViaBlockDispatchAsync()` de l'executor (c'est dans le dispatcher)
4. Supprimer `ExecuteViaCliAsync()` (le dispatcher remplace les deux)
5. `NormalizeToolId()` migre vers le dispatcher
6. Tout block type (agent, inference, futur) peut utiliser `IToolDispatcher`

`maestro_cli` peut etre entierement supprime — plus de legacy, un seul chemin.

---

## Etat Actuel de l'Isolation dans Maestro

### Ce qui EXISTE (code present)

| Mecanisme | Location | Status |
|-----------|----------|--------|
| Authority (Human/Agent/AI) | `Maestro.Domain/Authority.cs` | Defini |
| ContextPermissions | `Maestro.Domain/ContextPermissions.cs` | Defini, avec allowedCommands, allowedTools, allowedPaths |
| FileAccessRule | `Maestro.Domain/FileAccessRule.cs` | Defini (ReadOnly/Hidden/Excluded) |
| BlockPermission | `Maestro.Domain/BlockPermission.cs` | Defini (Allow/Deny/RequiresApproval) |
| WorkspaceIsolation | `Maestro.Domain/WorkspaceIsolation.cs` | Defini (Docker, resource limits) |
| Permission Inheritance | `ContainerSession.cs` | Implemente (intersection, plus restrictif gagne) |
| CLI Permission Check | `CliExecutor.cs` (lignes 47-75) | Applique (verifie HasCommand/HasTool/HasBlock) |
| SandboxManager V1 | `packages/maestro-cli/sandbox-manager.ts` | Implemente (git worktrees) |
| SandboxManager V2 | `packages/maestro-cli/sandbox-manager.ts` | Implemente (Docker containers) |

### Ce qui MANQUE (gaps critiques)

| Gap | Cause | Impact |
|-----|-------|--------|
| **Direct block dispatch contourne les permissions** | `AgentBlockExecutor.ExecuteViaBlockDispatchAsync()` (ligne 781) n'appelle pas `PermissionChecker` | Agents modernes n'ont AUCUNE restriction — ils accedent a tout |
| **Tool dispatch hardcode dans l'executor** | Routing, resolution, normalisation dans `AgentBlockExecutor` au lieu de l'infrastructure | Seul l'agent peut faire des tool calls; pas extensible |
| **`maestro_cli` interdit mais seul chemin securise** | System prompts disent "maestro_cli DOES NOT EXIST" | Le seul chemin avec permissions est inaccessible |
| **Sandbox non integre aux sessions** | Pas d'API endpoints | Sessions ne creent pas de sandbox automatiquement |
| **RequiresApproval non implemente** | Pas de queue d'approbation | Les blocks marquees "approval" s'executent quand meme |

### Le Probleme Bootstrap

```
Scenario dangereux:
  L'agent tourne depuis: node index.js code     (source: packages/maestro-code/App.ts)
  L'agent modifie:       packages/maestro-code/App.ts

  → L'agent modifie le code QU'IL EST EN TRAIN D'EXECUTER
  → Si le fix casse App.ts, le monitor crash
  → Si le fix casse le CLI, l'agent ne peut plus s'executer
```

---

## Les Trois Options d'Isolation

### Option A: Run from Source (index.js) + Git Worktree

```
Maestro Code (source, branch main)
    ↓ node index.js code
    ↓ cree session tui-sentinel
    ↓ SandboxManager.createWorktree()

Git Worktree (branch sentinel-qa-001)
    ← L'agent travaille ICI
    ← Lit/ecrit/teste dans cette copie isolee
    ← Le code source original est INTACT

Quand l'agent termine:
    → Rapport genere
    → Human review les changements dans la worktree
    → git merge sentinel-qa-001 (si approuve)
    → git worktree remove (cleanup)
```

**Avantages**: Deja implemente (SandboxManager V1), isolation filesystem, branche main intacte.
**Inconvenients**: Pas de permissions (l'agent PEUT sortir du worktree), bootstrap problem.
**Verdict**: Bon pour le dev. Pas suffisant pour la production.

### Option B: Run from Installed Version (npm install -g @maestro/cli)

```
Maestro CLI (installe globalement, version stable)
    ↓ maestro code
    ↓ cree session tui-sentinel

Le repo cible:
    ← L'agent travaille ICI
    ← La version installee est SEPAREE du code teste
```

**Avantages**: Separation complete runtime ≠ code teste.
**Inconvenients**: Necessite Phase 40 (distribution).
**Verdict**: L'objectif final.

### Option C: Run from Source + Worktree + IToolDispatcher (RECOMMANDE)

```
Maestro Code (source, branch main)
    ↓ node index.js code
    ↓ cree session tui-sentinel
    ↓ Template avec permissions RESTRICTIVES
    ↓ SandboxManager.createWorktree()

Git Worktree (branch sentinel-qa-001)
    ← Agent travaille dans packages/maestro-code/ SEULEMENT
    ← CHAQUE tool call passe par IToolDispatcher
    ← IToolDispatcher verifie ContextPermissions AVANT execution
    ← allowedPaths, blockedPaths, allowedTools respectes
    ← Pas d'acces a apps/, llm-provider/, .git/

Quand l'agent termine:
    → Rapport dans session variables (visible dans le monitor)
    → Human review: git diff sentinel-qa-001
    → Approve → merge
    → Reject → worktree remove
```

**Avantages**:
- Double isolation: worktree (filesystem) + IToolDispatcher (permissions)
- Architecturalement correct: un seul chemin de dispatch, dans l'infrastructure
- N'importe quel block type beneficie des permissions (pas juste l'agent)
- Les interfaces de permissions existent deja dans le Domain — il faut juste les brancher

**Inconvenients**:
- Necessite de creer `IToolDispatcher` et migrer `AgentBlockExecutor`
- L'agent tourne encore depuis le meme code (mais ne le modifie pas)

**Verdict**: Le meilleur compromis. Corrige la dette architecturale ET securise l'agent.

---

## Recommandation: Option C en Detail

### Le Template de Session

```json
{
  "id": "tui-sentinel",
  "name": "TUI Sentinel QA Session",
  "type": "project",

  "authority": {
    "type": "human",
    "identifier": "default",
    "displayName": "QA Engineer"
  },

  "permissions": {
    "allowedCommands": ["run", "list-tools", "describe"],
    "allowedTools": [
      "file-read",
      "file-edit",
      "file-write",
      "directory-list",
      "shell-execute",
      "step-complete"
    ],
    "allowedBlocks": [
      "tui-sentinel",
      "tui-discover",
      "tui-analyze",
      "tui-dialogue",
      "tui-test-atomic",
      "tui-test-integration",
      "tui-visual-capture",
      "tui-fix-iterate",
      "tui-report"
    ],
    "canCreateBlocks": false,
    "canCreateSessions": false,
    "canAccessFilesystem": true,
    "allowedPaths": [
      "packages/maestro-code/",
      "packages/tui/"
    ],
    "blockedPaths": [
      ".git/",
      "node_modules/",
      "apps/",
      "llm-provider/",
      "content/",
      "dev-scripts/"
    ]
  },

  "sandbox": {
    "type": "git-worktree",
    "branch": "sentinel-qa-{{timestamp}}",
    "autoCreate": true,
    "autoCleanup": false
  },

  "fileAccessRules": [
    { "pattern": "packages/maestro-code/**/*.ts", "access": "readWrite" },
    { "pattern": "packages/maestro-code/tests/**", "access": "readWrite" },
    { "pattern": "packages/tui/**/*.ts", "access": "readOnly" },
    { "pattern": "**", "access": "readOnly" }
  ],

  "entryPoints": {
    "qa": "tui-sentinel"
  }
}
```

### Ce Qui Doit Etre Implemente

**Phase 43-PRE: IToolDispatcher + Permission Enforcement** (~3 jours, backend C#)

1. **Creer `IToolDispatcher`** dans `Maestro.Application/Interfaces/`
   - Interface typee: `DispatchAsync(ToolCall, ExecutionContext, CancellationToken)`
   - ToolCall = `{ ToolId: string, Args: Dictionary<string, object> }`

2. **Implementer `ToolDispatcher`** dans `Maestro.Infrastructure/ToolDispatch/`
   - Normalise le tool ID (reprend `NormalizeToolId` de l'executor)
   - Verifie `permissions.HasTool(toolId)` (comme `CliExecutor` ligne 53)
   - Verifie `allowedPaths`/`blockedPaths` pour les operations fichier
   - Resout le block via `IBlockDiscoveryService`
   - Execute via `BlockExecutorRegistry`

3. **Migrer `AgentBlockExecutor`**
   - `ExecuteToolCall()` → appelle `_toolDispatcher.DispatchAsync()`
   - Supprimer `ExecuteViaBlockDispatchAsync()` (dans le dispatcher)
   - Supprimer `ExecuteViaCliAsync()` (le dispatcher remplace)
   - Supprimer `NormalizeToolId()` (dans le dispatcher)
   - Supprimer `GetCliExecutor()` (plus necessaire)

4. **Supprimer `maestro_cli` des system prompts**
   - Plus de "legacy" vs "recommended" — un seul chemin

5. **SandboxManager integration**
   - Quand le template a `sandbox.type: "git-worktree"`, creer automatiquement
     le worktree au demarrage de la session

**Estimation**: ~3 jours. C'est un refactoring qui corrige la dette architecturale
identifiee dans CLAUDE.md ("Known architectural debt: AgentBlockExecutor...bypassing
the block composition system").

### Le Workflow Complet

```
1. Utilisateur lance:
   $ maestro code
   > /qa

2. Maestro Code:
   a) Cree session avec template tui-sentinel
   b) SandboxManager cree git worktree → branch sentinel-qa-20260226
   c) Session demarre dans le worktree
   d) Agent s'execute (discovery → analysis → test → fix → report)
   e) CHAQUE tool call passe par IToolDispatcher → permissions verifiees
   f) Le monitor affiche le progres en temps reel

3. Agent termine:
   - Rapport dans session variables
   - Fitness score calcule
   - Liste des bugs trouves/corriges

4. Utilisateur review:
   $ git diff main..sentinel-qa-20260226
   $ git merge sentinel-qa-20260226  # si approuve
   $ git worktree remove .maestro/worktrees/sentinel-qa-20260226

5. OU via le monitor:
   - Bouton "Approve & Merge"
   - Bouton "Reject & Cleanup"
```

---

## Chemin vers Option B (Distribution)

Quand Phase 40 sera terminee:

```
$ npm install -g @maestro/cli    # Version stable installee
$ cd ~/my-project
$ maestro code                    # Lance depuis la version installee
> /qa                             # Teste le TUI du PROJET, pas de Maestro lui-meme

# OU pour self-improvement:
$ cd ~/maestro-source             # Le repo source de Maestro
$ maestro code
> /qa                             # L'installe teste le source
```

La transition de Option C → B est transparente: le template de session est le meme,
`IToolDispatcher` est le meme, seul le runtime change.

---

## Schema des Phases Revisees

```
Phase 43-PRE: IToolDispatcher + Permission Enforcement (3 jours)
  └─ Creer IToolDispatcher (interface typee pour tool dispatch)
  └─ Implementer ToolDispatcher (permissions + resolution + execution)
  └─ Migrer AgentBlockExecutor (supprimer direct dispatch + maestro_cli)
  └─ Integrer SandboxManager avec le lifecycle de session

Phase 43: TUI Infrastructure (1 semaine)
  └─ Focus management (FocusContext)
  └─ Frame capture pipeline (node-pty + @xterm/headless)
  └─ Component diagnostic interface
  └─ Fix scroll + keyboard conflicts

Phase 44: TUI Sentinel Agent (2 semaines)
  └─ 44-A: Block infrastructure (template, agent blocks, system prompts)
  └─ 44-B: Discovery + Analysis agents
  └─ 44-C: Dialogue + Atomic testing
  └─ 44-D: Integration + Visual capture
  └─ 44-E: Fix + Report + Self-improvement loop
  └─ 44-F: Foundry training + Publication
```
