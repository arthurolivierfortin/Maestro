# Post-Mortem : Workflow v4 — "FAILED - Zero implementation after 3 iterations"

**Date** : 2026-02-20
**Session** : `5719f8d1-8d11-4daf-b58f-a0fdccca18f3` (CRUD-v4-final)
**Repo cible** : `C:\Meastro\test-repos\crud`
**Duree totale** : ~40 minutes
**Resultat** : Toutes les phases ont **complete du point de vue infrastructure**, mais **zero fichier cree ou modifie** sur le disque.

---

## 1. Resume de l'echec

Le workflow `maestro-agent-v4` a traverse les 7 phases (comprendre, planifier, implementer x3 iterations, verifier, reviewer, livrer) sans produire aucun changement dans le repo cible. Le noeud `do-commit` confirme : *"Zero tracked changes in git status. implementedSteps=0"*.

Le rapport final du workflow : **"FAILED - Zero implementation after 3 iterations"**

### Symptomes observes

| Symptome | Observation |
|----------|-------------|
| `implement-step` rapporte "Completed: 6 items" | Mais 0 fichiers crees sur disque |
| `_nodeResult_implement-step` | Contient du JSON de tool-call brut : `{"tool":"maestro_cli","args":{"command":"run file-read ..."}}` — un appel d'outil **non execute** traite comme output final |
| Review score | 0.1/1.0 — le reviewer a correctement detecte l'absence de code |
| `_phases` | Toutes les 7 phases restent `pending` malgre l'execution complete |
| Interaction handler | Erreur `"(no executor for 'workflow')"` |
| 3 iterations de la boucle while | Toutes avec `implementedSteps: 0` — l'iterer/retry n'a rien change |

---

## 2. Analyse des causes racines

### CAUSE RACINE #1 (CRITIQUE) : `LLMProviderGateway.SendAsync` detruit la structure conversationnelle

**Fichier** : `apps/backend/src/Maestro.Infrastructure/LLMGateway/LLMProviderGateway.cs` lignes 60-62
**Severite** : BLOQUANTE — rend la boucle agentique non-fonctionnelle

```csharp
prompt = string.Join("\n\n", request.Messages
    .Where(m => m.Role != "system")
    .Select(m => m.Content));
```

**Probleme** : Le gateway concatene TOUS les messages (user + assistant) en une seule chaine de texte, separee par `\n\n`. L'information des roles (qui a dit quoi) est **completement perdue**.

**Impact** : Apres l'iteration 1 de la boucle agentique dans `AgentBlockExecutor`, le LLM recoit un blob de texte ou il ne peut pas distinguer :
- Ses propres reponses precedentes (assistant)
- Les resultats d'outils (user)
- Le message initial de la tache (user)

**Chaine causale** :
1. Iteration 1 : OK — un seul message user, pas de confusion possible
2. Iteration 2+ : Le gateway envoie `"(tache initiale)\n\n{\"tool\":\"maestro_cli\",...}\n\nTool result for maestro_cli:\n<output>"` comme un seul `Prompt`. Le LLM (Claude Sonnet) recoit un mur de texte sans roles
3. Claude produit des reponses confuses ou mal formatees (texte melange avec JSON)
4. `nonJsonRetryCount` augmente apres 2 tentatives echouees → `break` a la ligne 293
5. Le fallback output (lignes 303-316) stocke la derniere reponse brute du LLM comme resultat
6. Le for-each marque l'item comme "done" sans verifier le contenu

**Ce que le LLM-Provider API accepte actuellement** :
```json
POST /api/v1/llm/complete
{
  "prompt": "flat text blob",      // <-- PAS de messages structures
  "systemPrompt": "...",
  "model": "claude-sonnet",
  "maxTokens": 8192
}
```

**Ce dont l'AgentBlockExecutor a besoin** :
```json
POST /api/v1/llm/chat/complete    // <-- Nouvel endpoint
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "{\"tool\":\"maestro_cli\",...}"},
    {"role": "user", "content": "Tool result for maestro_cli:\n..."}
  ],
  "model": "claude-sonnet",
  "maxTokens": 8192
}
```

---

### CAUSE RACINE #2 (MAJEURE) : Le `for-each` marque les items "done" inconditionnellement

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` lignes 1356-1373

```csharp
// For-each loop done — marks ALL items as done regardless of child block success
UpdateNodeById(displayTree, nodeId, "done", $"Completed: {items.Count} items");
```

**Probleme** : Le for-each marque chaque item comme "done" des que les noeuds enfants retournent, sans verifier si :
- Le bloc enfant a produit un output valide
- Le bloc enfant a execute des tool calls (pour les agents)
- Le fichier cible existe reellement sur disque

**Impact** : "Completed: 6 items" est un mensonge — les 6 items ont tous echoue silencieusement.

---

### CAUSE RACINE #3 (MODEREE) : Le guard "done with 0 tool calls" est contournable

**Fichier** : `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` ligne 212

```csharp
if (actualToolCallCount == 0 && iteration < maxIterations - 1)
```

**Probleme** : Le guard ne rejette le "done" premature que si `iteration < maxIterations - 1`. A la derniere iteration, un "done" avec 0 tool calls est accepte. Combine avec la cause #1 (le LLM ne suit plus le protocole apres iteration 1), l'agent brule ses 15 iterations en reponses confuses puis sort avec 0 tool calls.

**De plus** : Si le LLM ne produit JAMAIS de JSON valide (a cause du flattening), le chemin `!toolCalled` → `nonJsonRetryCount < 2` donne seulement 2 chances de retry, puis `break` a la ligne 293. L'agent sort apres 3 iterations (1 initiale + 2 retries) au lieu de 15, sans JAMAIS avoir execute un outil.

---

### CAUSE RACINE #4 (MODEREE) : `ResolveTemplate` retourne `"0"` pour les variables nulles

**Fichier** : `EntryPointExecutor.cs` ligne 2956

```csharp
if (value == null) return "0";
```

**Probleme** : Si `repoPath` n'est pas defini comme variable de session, `{{inputs.repoPath}}` devient la chaine `"0"`. Les inputs des blocs d'implementation deviennent :
```json
{
  "workingDir": "0",       // <-- Au lieu de "C:\Meastro\test-repos\crud"
  "step": "{...}"
}
```

**Impact** : Meme si la boucle agentique fonctionnait, le LLM recevrait `workingDir: "0"` et tenterait des operations sur des chemins comme `0/src/types/FileNode.ts`.

**Attenuation** : La session est creee avec `--repo`, donc `session.RepositoryPath` est set, et l'auto-injection a la ligne 125-131 devrait fonctionner. Mais cela depend de l'ordre d'execution et du timing de la premiere invocation. **A verifier**.

---

### CAUSE RACINE #5 (MINEURE) : Les phases ne sont jamais mises a jour

**Probleme** : La variable `_phases` reste a `pending` pour les 7 phases, malgre l'execution complete du workflow. Les noeuds du workflow (`phaseId: "comprendre"`, etc.) n'appellent jamais `UpdatePhaseStatus()` pour la variable `_phases`.

**Impact** : Le monitor TUI affiche des phases incorrectes. C'est un probleme de UX, pas fonctionnel.

---

### CAUSE RACINE #6 (MINEURE) : Interaction handler "no executor for workflow"

**Probleme** : Le bloc `interaction-handler-loop` est de type `workflow`, mais le `BlockExecutorRegistry` ne gere que `agent`, `inference`, `tool`, `script`. Les blocs `workflow` sont executes par `EntryPointExecutor`, pas par le registry.

**Impact** : L'interaction handler est silencieusement ignore. Pas critique pour le fonctionnement de base, mais le handler d'interaction (pause/resume/rewind) est absent.

---

## 3. Priorite de correction

| # | Cause | Severite | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | Gateway flattening | BLOQUANTE | 2-3 heures | Sans fix, AUCUN agent ne fonctionne apres iteration 1 |
| 2 | for-each "done" inconditionnel | MAJEURE | 1 heure | Cache les echecs, rend le debugging impossible |
| 3 | Guard "done" contournable | MODEREE | 30 min | Agent sort silencieusement avec 0 travail |
| 4 | ResolveTemplate retourne "0" | MODEREE | 30 min | Chemins corrompus si variable manquante |
| 5 | Phases non mises a jour | MINEURE | 1 heure | Monitor affiche des infos incorrectes |
| 6 | No executor for workflow | MINEURE | 2 heures | Interaction handler absent |

---

## 4. Plan de correction

### Principe : Tester chaque fix INDIVIDUELLEMENT

Le but est de NE PAS relancer le workflow complet (40 min + cout LLM) pour verifier chaque correction. Chaque fix doit etre testable en isolation.

---

### FIX 1 : Messages structures dans LLMProviderGateway (BLOQUANT)

**Approche** : Ajouter le support des messages structures dans la chaine Maestro → LLM-Provider.

**Option A (recommandee)** : Modifier `LLMProviderGateway` pour envoyer les messages dans un format structure que LLM-Provider peut consommer.

1. **Cote LLM-Provider** : Ajouter un endpoint `/api/v1/llm/chat/complete` qui accepte un array `messages` (avec roles) au lieu d'un flat `prompt`. Le `ClaudeCodeLLMProvider` peut alors passer les messages correctement a Claude.

2. **Cote Maestro** : Modifier `LLMProviderGateway.SendAsync` pour :
   - Si `request.Messages` n'est pas vide → appeler `/api/v1/llm/chat/complete` avec les messages structures
   - Sinon → garder le comportement actuel `/api/v1/llm/complete` pour les blocs inference (single-turn)

**Option B (rapide mais fragile)** : Encoder les roles dans le prompt flat avec des delimiteurs, puis les parser cote LLM-Provider. Ex: `[USER] ...\n[ASSISTANT] ...\n[USER] ...`. Fragile car le contenu des messages peut contenir ces delimiteurs.

**Comment tester sans relancer le workflow** :
```bash
# 1. Test unitaire C# : verifier que SendAsync preserve les messages
# 2. Test d'integration : agent simple (1 tool call) avec mock CLI
cd apps/backend && dotnet test --filter "AgentGateway"

# 3. Test E2E minimal : executer implement-single-step en isolation
node index.js run implement-single-step --input-json '{
  "step": "{\"id\":1,\"action\":\"create\",\"target\":\"src/test.ts\",\"description\":\"Create a hello world file\"}",
  "workingDir": "C:\\Meastro\\test-repos\\crud",
  "context": ""
}'
# Verifier : src/test.ts existe-t-il dans test-repos/crud ?
```

**Fichiers a modifier** :
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/LLMGateway/LLMProviderGateway.cs` | Ajouter `SendChatAsync` ou modifier `SendAsync` pour envoyer les messages structures |
| `apps/backend/src/Maestro.Application/Interfaces/ILLMGateway.cs` | Potentiellement ajouter une surcharge avec messages |
| LLM-Provider : `LLMProvider.Web/Controllers/LLMController.cs` | Ajouter endpoint `/api/v1/llm/chat/complete` |
| LLM-Provider : `LLMProvider.Application/...` | Etendre `ILLMProvider` pour supporter `messages[]` |
| LLM-Provider : `ClaudeCodeLLMProvider` | Reconstruire/modifier pour passer les messages a Claude Code CLI |

---

### FIX 2 : for-each doit propager le statut des enfants

**Modification** : Dans `ExecuteForEachNodeAsync`, apres execution des child nodes :
1. Verifier si le child output contient un indicateur d'echec (ex: `"error"` key dans outputs, ou `Success == false`)
2. Si un child echoue, marquer l'item comme `error` au lieu de `done`
3. Ajouter un compteur `successCount` vs `failCount` dans le message de completion

```csharp
// AVANT
UpdateNodeById(displayTree, nodeId, "done", $"Completed: {items.Count} items");

// APRES
var statusMsg = failCount > 0
    ? $"Completed: {successCount}/{items.Count} succeeded, {failCount} failed"
    : $"Completed: {items.Count} items";
var finalStatus = failCount == items.Count ? "error" : (failCount > 0 ? "warning" : "done");
UpdateNodeById(displayTree, nodeId, finalStatus, statusMsg);
```

**Comment tester** :
```bash
# Test unitaire : mock d'un for-each avec un child qui echoue
cd apps/backend && dotnet test --filter "ForEach"

# Test d'integration : workflow minimal avec un for-each de 2 items
# dont un echoue intentionnellement (block non-existant)
```

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`

---

### FIX 3 : Guard "done" JAMAIS contournable

**Modification** : Retirer la condition `iteration < maxIterations - 1`. Si l'agent n'a fait 0 tool calls, c'est TOUJOURS un echec.

```csharp
// AVANT
if (actualToolCallCount == 0 && iteration < maxIterations - 1)

// APRES
if (actualToolCallCount == 0)
{
    result.Logs.Add("Agent claimed 'done' with 0 tool calls. This is an error.");
    result.Success = false;
    result.Outputs["error"] = "Agent completed without making any tool calls. The task was not executed.";
    break;
}
```

**Comment tester** :
```bash
# Test unitaire : mock LLM qui repond "done" immediatement
cd apps/backend && dotnet test --filter "AgentDoneGuard"
```

**Fichier** : `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` ligne 212

---

### FIX 4 : `ResolveTemplate` retourne une chaine vide ou lance une erreur

**Modification** : Au lieu de retourner `"0"` pour les variables nulles, retourner une chaine vide `""` ET logger un warning.

```csharp
// AVANT
if (value == null) return "0";

// APRES
if (value == null)
{
    // Log warning (if logger available) — helps debug template resolution issues
    return "";  // Empty string, not "0" which corrupts paths
}
```

**Comment tester** :
```bash
# Test unitaire : ResolveTemplate avec une variable inexistante
cd apps/backend && dotnet test --filter "ResolveTemplate"
```

**Fichier** : `EntryPointExecutor.cs` ligne 2956

**Note** : Verifier que `""` ne casse pas les conditions `{{reviewApproved}} != true` — actuellement `"0" != "true"` → true, et `"" != "true"` → true, donc pas de regression.

---

### FIX 5 : Mise a jour des phases via les noeuds `phaseId`

**Modification** : Dans `ExecuteConfigNodesAsync`, quand un noeud a un `phaseId`, mettre a jour la variable `_phases` :

```csharp
// Avant d'executer le noeud
if (node.TryGetProperty("phaseId", out var phaseIdProp))
{
    UpdatePhaseStatus(session, phaseIdProp.GetString(), "running");
}

// Apres execution reussie du noeud
if (node.TryGetProperty("phaseId", out var phaseIdProp))
{
    UpdatePhaseStatus(session, phaseIdProp.GetString(), "done");
}
```

**Comment tester** :
```bash
# Verifier via curl apres un workflow minimal
curl -s http://localhost:5000/api/sessions/<id>/variables/_phases | python -m json.tool
```

**Fichier** : `EntryPointExecutor.cs`

---

### FIX 6 : Support basique des blocs workflow imbriques (REPORTE)

**Effort** : 2+ heures. Pas bloquant pour le workflow v4 principal.
**Decision** : Reporter a une sous-phase ulterieure. L'interaction handler n'est pas essentiel pour le premier test fonctionnel.

---

## 5. Protocole de test SANS relancer le workflow complet

### Etape A : Fix + Build (30 min)

Appliquer les fixes 1-5, builder :
```bash
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Doit donner 0 errors
```

### Etape B : Tests unitaires existants (5 min)

```bash
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Doit donner 93+ tests passed, 0 failed
```

### Etape C : Test isole du fix #1 — Agent single-step (10 min)

```bash
# Demarrer les services
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1

# Executer UN SEUL bloc agent en isolation
cd packages/maestro-cli
node index.js run implement-single-step --input-json '{
  "step": "{\"id\":1,\"action\":\"create\",\"target\":\"src/hello.ts\",\"description\":\"Create a file that exports a greeting function\"}",
  "workingDir": "C:\\Meastro\\test-repos\\crud",
  "context": ""
}'

# Verification : le fichier existe ?
powershell.exe -Command "Test-Path C:\Meastro\test-repos\crud\src\hello.ts"
# Doit etre True

# Cleanup
powershell.exe -Command "Remove-Item C:\Meastro\test-repos\crud\src\hello.ts -ErrorAction SilentlyContinue"
```

**Ce test valide** : le gateway preserve les messages, l'agent fait des tool calls, les fichiers sont ecrits.

### Etape D : Test isole du fix #2 — for-each avec echec (10 min)

Creer un workflow minimal avec un for-each qui contient un bloc inexistant. Verifier que le statut est `error` et non `done`.

### Etape E : Mini-workflow 2 phases (15 min)

Creer une session minimale qui execute :
1. `project-analyzer` sur `test-repos/crud` (deja teste et fonctionne)
2. `implement-single-step` sur un step trivial

Verifier que les deux phases produisent un output valide et que le fichier cible existe.

### Etape F : Workflow v4 complet (40 min — seulement si A-E passent)

Relancer le workflow complet sur `test-repos/crud` et verifier que :
- Les fichiers sont crees
- `git status` montre des changements
- `do-commit` produit un commit
- Review score > 0

---

## 6. Questions ouvertes

1. **Le `ClaudeCodeLLMProvider` gere-t-il les messages structures ?** — Les sources C# du provider n'ont pas ete trouvees (seulement le DLL compile). Il faudra peut-etre reconstruire ce provider.

2. **Quel est le contrat exact de Claude Code CLI pour les conversations multi-turn ?** — Claude Code CLI prend un `--prompt` (flat text). Pour les conversations multi-turn, il faudra soit :
   - Encoder les messages dans le prompt avec des delimiteurs clairs
   - Utiliser l'API Anthropic directement au lieu de Claude Code CLI pour les agents
   - Implementer un provider Anthropic API natif dans LLM-Provider

3. **Le plan genere etait-il correct ?** — Le planner a cree 6 etapes de config/docs au lieu de l'implementation CRUD demandee. Meme avec le fix du gateway, le planner pourrait generer des plans inadequats. Il faudra verifier le prompt du `task-planner`.

---

## 7. Lecons apprises

### Pour MEMORY.md

1. **La boucle agentique NECESSITE des messages structures** — un flat prompt est insuffisant pour les agents multi-turn. C'est un pre-requis absolu.

2. **"Completed: N items" dans un for-each est un mensonge potentiel** — le for-each ne verifie pas le contenu des enfants. Toujours verifier les outputs reels.

3. **Tester chaque bloc en ISOLATION avant le workflow complet** — `node index.js run <block-id>` evite de gaspiller 40 min + usage LLM pour decouvrir un bug d'infrastructure.

4. **L'API `/api/v1/llm/complete` est single-turn only** — elle ne supporte pas les conversations. L'ajout d'un endpoint `/chat/complete` est necessaire pour les agents.

---

## 8. Prochaines actions

| # | Action | Bloque par | Effort |
|---|--------|-----------|--------|
| 1 | Fix #1 : Messages structures (Gateway + LLM-Provider) | Rien | 2-3h |
| 2 | Fix #3 : Guard "done" strict | Rien | 30min |
| 3 | Fix #4 : ResolveTemplate retourne "" | Rien | 30min |
| 4 | Fix #2 : for-each propagation statut | Rien | 1h |
| 5 | Fix #5 : Phases mises a jour | Rien | 1h |
| 6 | Test isole implement-single-step (Etape C) | Fix #1 | 10min |
| 7 | Test mini-workflow (Etape E) | Fixes 1-5 | 15min |
| 8 | Workflow v4 complet (Etape F) | Etape E OK | 40min |

**Effort total estime** : 5-7 heures de travail + 40 min de workflow complet.
**Economie** : Evite N relances du workflow complet (N x 40min x cout LLM).
