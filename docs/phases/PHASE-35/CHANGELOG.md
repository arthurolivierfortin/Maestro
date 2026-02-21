# Phase 35 — Dogfooding Changelog

**Date** : 2026-02-20 → 2026-02-21
**Branch** : main
**Sous-phases** : 35-PRE, 35-A, 35-B, 35-C, 35-D

---

## Statistiques globales

| Metrique | Valeur |
|----------|--------|
| Sessions executees | 27 |
| Sessions reussies | 16 (59%) |
| Sessions echouees | 9 (33%) |
| Sessions partielles | 2 (7%) |
| Cout total | ~$3.14 |
| Bugs Maestro trouves et corriges | 29 |
| Fichiers Cantante crees | 31 |
| Build Cantante | PASS (43 modules, 165 KB) |
| **Premier workflow E2E complet** | **Session 25** |

---

## 35-PRE + 35-A : Agent dispatch + DI (Fixes 1-5)

| # | Bug | Fichier | Fix |
|---|-----|---------|-----|
| 1 | `--template none` echoue | `headless.ts` | Skip template quand `template === 'none'` |
| 2 | Agent block dispatche comme workflow | `EntryPointExecutor.cs` | `isWorkflowWithNodes` check |
| 3 | Meme dans ExecuteBlockRefAsync | `EntryPointExecutor.cs` | `isWorkflowBlock` check |
| 4 | ObjectDisposedException tool dispatch | `AgentBlockExecutor.cs` | `_scopeFactory.CreateScope()` |
| 5 | DI circular deadlock | `AgentBlockExecutor.cs` | Lazy resolution `??=` |

## 35-B : Agent behavior (Fixes 6-12)

| # | Bug | Fichier | Fix |
|---|-----|---------|-----|
| 6 | Agent retourne vide sans recuperation | `AgentBlockExecutor.cs` | Empty response → nudge (max 2 retries) |
| 7 | Agent oublie `step-complete` | `AgentBlockExecutor.cs` | Iteration countdown quand remaining ≤ 3 |
| 8 | System prompt trop faible | `system-prompt.md` | Rewrite v2 : strict JSON, FORBIDDEN section |
| 9 | Agent hallucine multi-tool | `AgentBlockExecutor.cs` | Detection + WARNING dans tool result |
| 10 | Agent utilise noms hallucines | `AgentBlockExecutor.cs` | `NormalizeToolId()` — 15+ alias |
| 11 | Non-JSON nudge sans step-complete | `AgentBlockExecutor.cs` | Nudge inclut example JSON |
| 12 | BOM dans fichiers ecrits | `ToolBlockExecutor.cs` | `UTF8Encoding(false)` |

## 35-C : Infrastructure robustesse (Fixes 13-25)

| # | Bug | Fichier | Fix |
|---|-----|---------|-----|
| 13 | `"edit"` alias manquant | `AgentBlockExecutor.cs` | `"edit"` → `"file-write"` (v1) |
| 14 | Entry point → blockId incorrect | `headless.ts` | `workflowId: "dev"` → `"dev-orchestrator"` |
| 15 | Pas de `--block` flag CLI | `cli.ts` + `headless.ts` | Support `--block <id>` |
| 16 | Agent gaspille iterations a explorer | `headless.ts` | `projectStructure` tree dans inputs |
| 17 | System prompt ne mentionne pas projectStructure | `system-prompt.md` | Skip dir-list si projectStructure fourni |
| 18 | Processus orphelins apres crash | `cleanup-services.ps1` | Script nettoyage ports 5000/5010/5173 |
| 19 | LLM-Provider 500 → crash immediat | `LLMProviderGateway.cs` | Retry 1x avec 5s delay |
| 20 | Erreur LLM → session morte | `AgentBlockExecutor.cs` | Context reduction (KeepLastN/2) + retry |
| 21 | Pas de multi-model pour agent | `AgentBlockExecutor.cs` + config | `planningModel` + `planningIterations` |
| 22 | `--resume` CLI corrompu apres 4+ calls | `ClaudeCodeLLMProvider.cs` | `MaxResumeCount=4` |
| 23 | Fallback envoie tout l'historique | `ClaudeCodeLLMProvider.cs` | Truncation (1er + derniers 2 messages) |
| 24 | Prompts > 25KB depassent limite cmd | `ClaudeCodeLLMProvider.cs` | Stdin piping |
| 25 | `"edit"` → `file-write` perd edits partiels | `AgentBlockExecutor.cs` + `ToolBlockExecutor.cs` | Nouveau block `file-edit` |

## 35-D : For-each pipeline fix (Fixes 26-27)

| # | Bug | Fichier | Fix |
|---|-----|---------|-----|
| 26 | `set-variable` stocke JsonElement → for-each echoue | `EntryPointExecutor.cs` | Remplace `System.Text.Json` par `Newtonsoft JToken.Parse()` — JArray/JObject sont des types reference sans problemes de boxing |
| 27 | Agent wraps output dans `{"summary":"[...]"}` → JObject pas JArray | `EntryPointExecutor.cs` | Unwrap automatique : si JObject a un champ string contenant un JSON array, extraire et stocker comme `List<object>` |
| 28 | task-planner fait du file-edit au lieu de planifier | `task-planner/system-prompt.md` | Section FORBIDDEN : file-write, file-edit, shell-command explicitement interdits |
| 29 | project-preparer fait du file-edit | `project-preparer/system-prompt.md` | Section FORBIDDEN : file-write, file-edit, shell-command explicitement interdits |

---

## Nouveau block : `file-edit`

**Fichier** : `content/system/blocks/tools/file-edit.tool.block.json`
**Handler** : `ToolBlockExecutor.HandleFileEditAsync()`

Edition partielle de fichiers via find & replace exact.

| Input | Type | Description |
|-------|------|-------------|
| `path` | string | Chemin du fichier |
| `old_string` | string | Texte exact a trouver |
| `new_string` | string | Texte de remplacement |
| `workingDir` | string? | Repertoire de base |
| `replace_all` | bool? | Remplacer toutes les occurrences (defaut: false) |

**Comportement** : Echec si old_string introuvable ou ambigu (sauf replace_all). UTF-8 sans BOM.
**Tests isoles** : 5/5 (remplacement simple, not found, ambiguous, replace_all, file missing).

---

## Multi-model agent

```json
{ "model": "claude-sonnet-4-6", "planningModel": "claude-opus-4-6", "planningIterations": 2 }
```

Premieres N iterations → Opus (planification), reste → Sonnet (execution). Verifie session 17.

---

## Resilience LLM-Provider

| Fix | Avant | Apres |
|-----|-------|-------|
| Retry gateway | 500 → throw immediat | 500 → 5s delay → retry 1x |
| Context reduction | erreur LLM → crash | KeepLastN/2 → retry |
| Resume limiter | --resume indefini → corruption | MaxResumeCount=4 → fresh session |
| Truncated fallback | full history (32KB+) | 3 messages (task + derniers 2) |
| Stdin piping | prompt en -p argument (32KB max) | stdin pour prompts > 25KB |

---

## Sessions de dogfooding

### 35-B (Sessions 1-9, $0.54)

| # | Task | Cout | Resultat |
|---|------|------|----------|
| 1 | List structure | $0.013 | OK |
| 2 | Scaffold React 18 | $0.085 | ECHEC — hallucination |
| 3 | Scaffold React 18 (retry) | $0.034 | OK — 6 fichiers |
| 4 | Fix tsconfig jsx | $0.008 | OK |
| 5 | Accessible layout | $0.087 | OK — 14 iter gaspillees |
| 6 | File operations (IPC) | $0.081 | OK |
| 7 | Accessibility layer | $0.083 | OK |
| 8 | Vite build system | $0.034 | OK |
| 9 | Syntax highlighter | $0.115 | OK |

### 35-C (Sessions 10-19, $1.33)

| # | Task | Cout | Resultat |
|---|------|------|----------|
| 10 | Tab system | $0.070 | OK |
| 11 | Search & Replace | $0.341 | OK |
| 12 | File create/delete | $0.174 | OK |
| 13 | Theme system | $0.135 | OK |
| 14 | Terminal panel | $0.192 | OK |
| 15 | Minimap | - | ECHEC — --resume corruption |
| 16 | Minimap (retry) | $0.007 | ECHEC — timeout 600s |
| 17 | formatDate test | $0.007 | OK — multi-model verifie |
| 18 | Line numbers | $0.151 | OK |
| 19 | Command palette | $0.135 | PARTIEL — fichier cree, integration echec (edit alias) |

### 35-D (Sessions 20-25, debugging for-each)

| # | Task | Cout | Resultat |
|---|------|------|----------|
| 20 | Cantante - CommandPalette (file-edit) | ~$0.10 | ECHEC — for-each: source is JsonElement |
| 21 | Cantante - CommandPalette (retry 1) | ~$0.10 | ECHEC — NormalizeJsonElementToList ne convertit pas |
| 22 | Cantante - CommandPalette (retry 2) | ~$0.10 | ECHEC — code dans DLL mais branch pas executee |
| 23 | Cantante - CommandPalette (retry 3) | ~$0.10 | ECHEC — meme issue, System.Text.Json boxing defaillant |
| 24 | FormatDate (JsonElement diag) | ~$0.05 | ECHEC — stored JSON object (JObject, pas JArray) |
| 25 | FormatDate v2 (JObject unwrap) | $0.22 | **OK** — full workflow E2E! unwrap summary → List |
| 26 | Cantante - CommandPalette | ~$0.10 | ECHEC — planner went rogue (prose, not JSON array) |
| 27 | Cantante - CommandPalette v2 | $0.50 | **OK** — 4-step plan, full E2E, App.tsx modified! |

### Tendance

```
Session 2  : FAIL   hallucination totale (multi-tool, 0 fichiers)
Session 5  : OK     14 iterations gaspillees (directory exploration)
Sessions 6-9 : OK   efficient (10-21 calls)
Sessions 11-14 : OK bon (15-20 calls, builds passent)
Session 15 : FAIL   --resume corruption apres 4+ calls
Session 19 : PARTIEL edit alias → file-write = edits partiels perdus
Sessions 20-23 : FAIL for-each JsonElement (4 tentatives System.Text.Json)
Session 24 : DIAG   revele JObject wrapping (pas JArray)
Session 25 : OK     PREMIER WORKFLOW E2E COMPLET! $0.22
Session 26 : FAIL   planner retourne prose au lieu de JSON array
Session 27 : OK     CANTANTE E2E — 4 steps, App.tsx modifie! $0.50
```

---

## Lecons apprises

### 1. System.Text.Json `JsonElement` est dangereux dans les variables de session

`JsonElement` est un **value type** (struct). Quand il est boxe dans `Dictionary<string, object>` (variables de session), les checks `is JsonElement` et `ValueKind` deviennent **non fiables** entre les boundaries de methodes. Trois tentatives de fix avec System.Text.Json ont echoue malgre le code etant confirme dans le DLL compile.

**Solution** : Utiliser Newtonsoft `JToken.Parse()` — `JArray`/`JObject` sont des **reference types**, pas de problemes de boxing.

**Regle** : Ne JAMAIS stocker de `JsonElement` dans les variables de session. Toujours convertir en types natifs (`List<object>`, `Dictionary<string,object>`, `string`, etc.) AVANT stockage.

### 2. Les agents wrappent leur output

Le pattern `step-complete` avec `{"summary":"[...]"}` fait que `AgentBlockExecutor.args.ToString()` retourne un objet JSON, pas le array brut. C'est un pattern frequent chez les LLMs.

**Solution** : `set-variable` detecte automatiquement les JObject avec un champ string contenant un JSON array et l'unwrap.

### 3. "READ ONLY" dans un prompt ne suffit pas

Dire a un agent qu'il est "READ ONLY" ne l'empeche pas d'appeler `file-edit` ou `file-write`. L'agent executor dispatch TOUT tool call normalise, pas seulement ceux listes dans le prompt.

**Solution** : Section `FORBIDDEN` explicite dans le system prompt, listant les tools interdits par nom. Plus efficace que les descriptions positives.

### 4. Le planner doit etre contraint dans son format de sortie

Sans exemples CORRECT/WRONG explicites du format step-complete, l'agent Sonnet retourne du prose au lieu d'un JSON array quand la tache est complexe (session 26).

**Solution** : Exemples markdown dans le prompt montrant le format exact attendu ET le format interdit.

### 5. Le debugging de DLL .NET 10 requiert UTF-16

Les strings dans les assemblies .NET 10 sont encodees en UTF-16 (Unicode), pas UTF-8. `Select-String` avec `-Encoding UTF8` ne trouvera rien. Utiliser `[System.Text.Encoding]::Unicode.GetString()`.

### 6. Cout d'un workflow E2E

| Complexite | Steps | Cout | Repartition |
|------------|-------|------|-------------|
| Simple (1 fichier) | 1 | ~$0.22 | reviewer opus = 75% |
| Moyen (4 modifications) | 4 | ~$0.50 | implement = 50%, reviewer = 32% |

Le code-reviewer (Opus) est le poste le plus cher. Considerer Sonnet pour les reviews de code simple.

---

## Fichiers modifies — Liste complete

### Backend (C#)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — nudge, countdown, multi-tool detect, NormalizeToolId (`"edit"` → `"file-edit"`), context reduction (KeepLastN/2), multi-model (planningModel + planningIterations)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — UTF-8 sans BOM, HandleFileEditAsync (nouveau handler filesystem `"edit"`), case "edit" dans switch
- `apps/backend/src/Maestro.Infrastructure/LLMGateway/LLMProviderGateway.cs` — retry 500 (1x avec 5s delay)
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — dispatch fix (isWorkflowWithNodes), **set-variable rewrite: JToken.Parse() au lieu de JsonElement + JObject unwrap automatique**, defense-in-depth JArray/JValue dans for-each

### LLM-Provider (C#)
- `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs` — MaxResumeCount=4, TruncateHistory (1er + 2 derniers), stdin piping pour prompts > 25KB
- `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeProviderOptions.cs` — +MaxResumeCount config

### CLI / Headless (TypeScript)
- `packages/maestro-code/headless.ts` — --template none, --block flag, projectStructure tree dans inputs
- `packages/maestro-cli/cli.ts` — --block flag

### Blocks (JSON/Markdown)
- `content/system/blocks/tools/file-edit.tool.block.json` — **NOUVEAU** — edition partielle fichiers (find & replace)
- `content/system/blocks/agents/dev-orchestrator/dev-orchestrator.agent.block.json` — planningModel config
- `content/system/blocks/agents/dev-orchestrator/system-prompt.md` — v2 + file-edit docs + regles d'utilisation
- `content/system/blocks/agents/task-planner/system-prompt.md` — **section FORBIDDEN** (file-write, file-edit, shell-command), exemples CORRECT/WRONG du format step-complete
- `content/system/blocks/agents/project-preparer/system-prompt.md` — **section FORBIDDEN** (file-write, file-edit, shell-command)

### Scripts
- `dev-scripts/cleanup-services.ps1` — NOUVEAU — nettoyage ports 5000/5010/5173
- `dev-scripts/check-dll.ps1` — debug DLL (UTF-8, obsolete)
- `dev-scripts/check-dll2.ps1` — debug DLL (UTF-16, fonctionne)
- `dev-scripts/check-logs.ps1` — lecture execution logs via API
- `dev-scripts/check-logs2.ps1` — lecture execution logs v2
