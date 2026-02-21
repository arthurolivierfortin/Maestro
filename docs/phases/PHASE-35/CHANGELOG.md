# Phase 35 — Dogfooding Changelog

**Date** : 2026-02-21
**Branch** : main
**Sous-phases** : 35-PRE, 35-A, 35-B

---

## Infrastructure Fixes (AgentBlockExecutor)

### Fix 1 — Empty response nudge
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : Agent returns empty string after iteration 1, loop breaks silently.
**Fix** : Nudge agent with "call step-complete or next tool" (max 2 retries before giving up).

### Fix 2 — Iteration countdown
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : Agent forgets step-complete after context truncation, wastes iterations.
**Fix** : Inject countdown reminder when remaining iterations <= 3. Set success=true on max iterations if tool calls were made.

### Fix 3 — Multi-tool detection
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : LLM produces 2+ JSON tool calls per response, only first executed. Agent hallucinates second was done (Session 2: 0 files written despite claiming fixes).
**Fix** : Detect `{"tool":` patterns after first JSON, inject WARNING into tool result.

### Fix 4 — Tool name aliasing (`NormalizeToolId`)
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : Agent uses `bash`, `read-file`, `Read`, `write-file`, `file-edit` instead of correct block IDs.
**Fix** : `NormalizeToolId()` method mapping common aliases to actual block IDs (shell-execute, file-read, file-write, directory-list).

### Fix 5 — Non-JSON nudge with step-complete
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : After context truncation, agent enters loop of prose -> "send JSON" -> echo commands.
**Fix** : Non-JSON nudge now includes step-complete JSON example.

### Fix 6 — UTF-8 BOM removal
**Fichier** : `ToolBlockExecutor.cs`
**Probleme** : `System.Text.Encoding.UTF8` includes BOM (EF BB BF), breaks Vite/Node.js JSON parsers.
**Fix** : `GetEncodingFromString()` now uses `new UTF8Encoding(false)` (without BOM) as default.

### Fix 7 — System prompt v2
**Fichier** : `content/system/blocks/agents/dev-orchestrator/system-prompt.md`
**Probleme** : Original prompt too weak — agent hallucinated tools, forgot step-complete, used wrong format.
**Fix** : Complete rewrite with strict JSON-only response format, FORBIDDEN section, workflow pattern guide, step-complete emphasis.
**Note** : Modified directly, not through foundry workflow (pragmatic during dogfooding iteration).

## Infrastructure Fixes (35-PRE + 35-A)

### Fix 8 — `--template none` support
**Fichier** : `packages/maestro-code/headless.ts`
**Probleme** : `--template none` failed because template import was always attempted.
**Fix** : Skip template import when `template === 'none'`.

### Fix 9 — Agent dispatched as workflow
**Fichier** : `EntryPointExecutor.cs`
**Probleme** : Agent blocks dispatched through workflow path (walks config.nodes, finds none).
**Fix** : `isWorkflowWithNodes` check before workflow dispatch.

### Fix 10 — Same issue in ExecuteBlockRefAsync
**Fichier** : `EntryPointExecutor.cs`
**Probleme** : Same dispatch issue in the block-reference execution path.
**Fix** : `isWorkflowBlock` check.

### Fix 11 — ObjectDisposedException
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : Tool dispatch uses the parent scope which gets disposed during agent loop.
**Fix** : `_scopeFactory.CreateScope()` — each tool dispatch gets its own DI scope.

### Fix 12 — DI circular deadlock
**Fichier** : `AgentBlockExecutor.cs`
**Probleme** : Circular dependency between AgentBlockExecutor and BlockExecutorRegistry.
**Fix** : Lazy resolution with `??=` pattern.

---

## Fichiers modifies

| Fichier | Changements |
|---------|-------------|
| `AgentBlockExecutor.cs` | 6 fixes: nudge, countdown, multi-tool, aliases, non-JSON, DI scope |
| `ToolBlockExecutor.cs` | UTF-8 BOM fix |
| `EntryPointExecutor.cs` | Agent vs workflow dispatch (2 fixes) |
| `headless.ts` | `--template none` support |
| `system-prompt.md` | Complete rewrite v2 |
| `dev-scripts/fix-bom.ps1` | BOM cleanup utility |

## Metriques

| Metrique | Valeur |
|----------|--------|
| Sessions executees | 10 |
| Taux de succes | 9/10 (90%) |
| Cout total | $0.610 |
| Cout moyen par tache | $0.061 |
| Fichiers Cantante crees | 21 |
| Build Cantante | PASS (tsc + vite) |

## Agent improvement trend

| Session | Resultat | Commentaire |
|---------|----------|-------------|
| 2 | FAIL | Hallucination multi-tool, 0 fichiers ecrits |
| 5 | OK | 14 iterations gaspillees (oubli step-complete) |
| 6-9 | OK | Efficient (10-21 calls, aucun gaspillage) |
| 10 | OK | Tres efficient (15 calls, step-complete naturel) |
