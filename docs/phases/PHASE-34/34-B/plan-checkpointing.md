# Phase 34-B-4 : Checkpointing dans EntryPointExecutor

**Statut** : A faire
**Prerequis** : Phase 34-A COMPLETE (34 blocks v4 crees, Plan 13 infrastructure execute — sequence, parallel, branches, pause implantes dans EntryPointExecutor)
**Objectif** : Permettre la reprise d'un workflow apres crash ou pause en sauvegardant l'etat de progression a chaque noeud et en skippant les noeuds deja completes au redemarrage.

> **Contexte** : Les etapes 1-3 de 34-B (tool blocks playwright, utilitaires, state-manager) ont ete completees dans 34-A. Seule l'etape 4 (checkpointing) reste a faire.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** de chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-34/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier la logique existante** de while/for-each/conditional/parallel/sequence — AJOUTER le checkpointing autour
5. **Ne PAS introduire de logique specifique a une session** — le checkpointing est generique (n'importe quel workflow)
6. **Toujours compiler** apres chaque modification : `powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"`

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 34-B-4a | Sauvegarder le checkpoint a chaque noeud | 1h |
| 34-B-4b | Reprendre depuis un checkpoint au demarrage | 1h |
| 34-B-4c | Verifier le round-trip checkpoint/resume | 30min |

---

## 34-B-4a : Sauvegarder le checkpoint a chaque noeud

### Lecture obligatoire [OBLIGATOIRE]
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — comprendre le dispatch loop dans `ExecuteConfigNodesAsync` (ligne ~484), comment `_nodeResult_xxx` est stocke apres chaque noeud, et comment `SaveAsync` est appele
- `apps/backend/src/Maestro.Domain/Entities/ProjectSession.cs` — comprendre `SetVariable()` et `GetVariable()`
- `CLAUDE.md` — section "Generic vs Specific Separation" (le checkpointing ne doit rien savoir des phases ou du type de workflow)

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Ajouter une variable de session `_workflowCheckpoint`** dans `ExecuteConfigNodesAsync` de `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`. Apres chaque noeud execute avec succes (apres le switch/case et avant le `autoPhaseId` done), ecrire :
   ```csharp
   // Dans ExecuteConfigNodesAsync, apres l'execution reussie du noeud (apres le try/catch switch):
   var checkpoint = session.GetVariable("_workflowCheckpoint") as List<object> ?? new List<object>();
   checkpoint.Add(new Dictionary<string, object>
   {
       ["nodeId"] = nodeId,
       ["status"] = "completed",
       ["timestamp"] = DateTime.UtcNow.ToString("o"),
       ["previousOutput"] = lastOutput ?? ""
   });
   session.SetVariable("_workflowCheckpoint", checkpoint);
   // SaveAsync est deja appele juste apres (ligne ~572-573)
   ```

2. **Pour les noeuds `while`** : ajouter le numero d'iteration dans le checkpoint pour pouvoir reprendre au bon tour de boucle. Dans `ExecuteWhileNodeAsync`, avant l'appel recursif a `ExecuteConfigNodesAsync`, ecrire :
   ```csharp
   session.SetVariable("_workflowCheckpoint_whileState", new Dictionary<string, object>
   {
       ["nodeId"] = nodeId,
       ["iteration"] = iteration,
       ["maxIterations"] = safetyMaxIterations
   });
   ```

3. **Pour les noeuds `for-each`** : sauvegarder l'index courant. Dans `ExecuteForEachNodeAsync`, avant l'execution de chaque item :
   ```csharp
   session.SetVariable("_workflowCheckpoint_foreachIndex", new Dictionary<string, object>
   {
       ["nodeId"] = nodeId,
       ["currentIndex"] = currentIndex,
       ["totalItems"] = items.Count
   });
   ```

4. **Ne PAS toucher** aux methodes `CheckPauseAsync`, `ExecuteParallelNodeAsync`, `ExecuteConditionalNodeAsync`, `ExecuteSequenceNodeAsync` — elles n'ont pas besoin de checkpoint supplementaire car leur etat est derive des children.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | MODIFIER — Ajouter la sauvegarde de `_workflowCheckpoint` dans `ExecuteConfigNodesAsync` (apres le switch), `ExecuteWhileNodeAsync` (avant recursion), et `ExecuteForEachNodeAsync` (avant chaque item) |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Le backend compile
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# Commande 2 : Verifier que _workflowCheckpoint est bien ecrit par grep
powershell.exe -Command "Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\Sessions\EntryPointExecutor.cs' -Pattern '_workflowCheckpoint'"
# Resultat attendu : au moins 3 occurrences (dans ExecuteConfigNodesAsync, ExecuteWhileNodeAsync, ExecuteForEachNodeAsync)

# Commande 3 : Verifier que les tests backend passent toujours
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : aucune regression
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS creer un nouveau service ou classe pour le checkpointing — utiliser directement `session.SetVariable()` comme le font deja `_nodeResult_xxx` et `_executionTree`
- Ne PAS mettre le checkpoint dans un fichier separe du session JSON — tout passe par `SaveAsync()` qui serialise deja tout
- Ne PAS ajouter de logique conditionnelle ("si c'est un workflow de type projet, alors checkpointer") — le checkpointing est generique, toujours actif
- Ne PAS supprimer l'ancien `_nodeResult_xxx` storage — le checkpoint est un ajout, pas un remplacement

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-B-4a : Sauvegarde checkpoint
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Variables ajoutees** : _workflowCheckpoint, _workflowCheckpoint_whileState, _workflowCheckpoint_foreachIndex
**Occurrences dans le code** : X lignes ajoutees
**Backend build** : Build succeeded / FAIL
**Backend tests** : X passed / X failed
**Verification** : [copier le output de dotnet build]
```

---

## 34-B-4b : Reprendre depuis un checkpoint au demarrage

### Lecture obligatoire [OBLIGATOIRE]
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — relire `ExecuteConfigNodesAsync` (ligne ~484) pour comprendre le point d'entree du dispatch loop
- Le code ecrit en 34-B-4a (la variable `_workflowCheckpoint` et son format)

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Au debut de `ExecuteConfigNodesAsync`**, lire `_workflowCheckpoint` et construire un `HashSet<string>` des `nodeId` deja completes :
   ```csharp
   // Au debut de ExecuteConfigNodesAsync, apres la declaration de lastOutput :
   var checkpointList = session.GetVariable("_workflowCheckpoint") as List<object>;
   var completedNodeIds = new HashSet<string>();
   string? checkpointLastOutput = null;
   if (checkpointList != null)
   {
       foreach (var entry in checkpointList)
       {
           if (entry is Dictionary<string, object> dict && dict.TryGetValue("nodeId", out var nid))
           {
               completedNodeIds.Add(nid?.ToString() ?? "");
               if (dict.TryGetValue("previousOutput", out var po))
                   checkpointLastOutput = po?.ToString();
           }
       }
   }
   if (checkpointLastOutput != null && lastOutput == null)
       lastOutput = checkpointLastOutput;
   ```

2. **Dans la boucle `foreach` de `ExecuteConfigNodesAsync`**, avant le switch/case, verifier si le noeud est deja complete :
   ```csharp
   // Juste avant le try { switch (nodeType) ... }
   if (completedNodeIds.Contains(nodeId))
   {
       _logger.LogInformation("Skipping already-completed node '{NodeId}' (checkpoint resume)", nodeId);
       AppendExecutionLog(session, "info", $"Skipped '{nodeId}' (checkpoint resume)");
       // Restore the _nodeResult for this node (needed by downstream template resolution)
       var savedResult = session.GetVariable($"_nodeResult_{nodeId}");
       if (savedResult != null)
           lastOutput = savedResult.ToString();
       continue;
   }
   ```

3. **Pour les noeuds `while`** : dans `ExecuteWhileNodeAsync`, lire `_workflowCheckpoint_whileState` et demarrer a l'iteration sauvegardee :
   ```csharp
   // Apres var iteration = 0;
   var whileState = session.GetVariable("_workflowCheckpoint_whileState") as Dictionary<string, object>;
   if (whileState != null && whileState.TryGetValue("nodeId", out var wsId) && wsId?.ToString() == nodeId)
   {
       if (whileState.TryGetValue("iteration", out var wsIter) && wsIter is int resumeIter)
       {
           iteration = resumeIter;
           AppendExecutionLog(session, "info", $"Resuming while '{nodeId}' at iteration {iteration}");
       }
       // Clear the while state so it's not re-used on next normal execution
       session.SetVariable("_workflowCheckpoint_whileState", null);
   }
   ```

4. **Pour les noeuds `for-each`** : meme pattern — lire `_workflowCheckpoint_foreachIndex` et skipper les items deja traites.

5. **Nettoyage** : quand un workflow se termine normalement (dans `ExecuteWorkflowAsync`, apres le dernier noeud), supprimer les variables de checkpoint :
   ```csharp
   session.SetVariable("_workflowCheckpoint", null);
   session.SetVariable("_workflowCheckpoint_whileState", null);
   session.SetVariable("_workflowCheckpoint_foreachIndex", null);
   ```

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | MODIFIER — Ajouter la lecture de `_workflowCheckpoint` au debut de `ExecuteConfigNodesAsync`, le skip de noeuds completes dans la boucle foreach, la lecture de `_workflowCheckpoint_whileState` dans `ExecuteWhileNodeAsync`, la lecture de `_workflowCheckpoint_foreachIndex` dans `ExecuteForEachNodeAsync`, et le nettoyage a la fin du workflow |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Le backend compile
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# Commande 2 : Verifier que la logique de skip existe
powershell.exe -Command "Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\Sessions\EntryPointExecutor.cs' -Pattern 'completedNodeIds|checkpoint resume'"
# Resultat attendu : au moins 3 occurrences (declare, Contains check, log message)

# Commande 3 : Backend tests passent
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : aucune regression
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS re-executer les noeuds deja completes meme partiellement — un noeud est soit "completed" (skip) soit pas dans le checkpoint (execute)
- Ne PAS perdre les `_nodeResult_xxx` des noeuds skippes — ils sont deja en session variables, les lire et restaurer `lastOutput`
- Ne PAS oublier de nettoyer le checkpoint quand le workflow termine normalement — sinon le prochain workflow skipperait des noeuds par erreur
- Ne PAS traiter le checkpoint comme un cache persistant entre workflows differents — c'est lie a UNE execution, pas a un template

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-B-4b : Reprise checkpoint
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Skip logic ajoutee** : OUI/NON
**While resume** : OUI/NON
**ForEach resume** : OUI/NON
**Cleanup en fin de workflow** : OUI/NON
**Backend build** : Build succeeded / FAIL
**Backend tests** : X passed / X failed
**Verification** : [copier le output de dotnet build]
```

---

## 34-B-4c : Verifier le round-trip checkpoint/resume

### Lecture obligatoire [OBLIGATOIRE]
- Le code ecrit en 34-B-4a et 34-B-4b (les variables `_workflowCheckpoint*`)
- `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` — comprendre comment les variables sont exposees via l'API (GET /api/sessions/{id})

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Demarrer le backend** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet run --project src/Maestro.Api"
   ```

2. **Creer une session de test et lancer un workflow simple** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session create --type project --name 'Checkpoint Test' --repo 'C:\temp\test-repo' --template project-v4 --start"
   ```

3. **Verifier via l'API que `_workflowCheckpoint` est ecrit** pendant l'execution :
   ```bash
   # Utiliser curl pour lire la variable (remplacer <UUID> par l'ID de session)
   curl -s http://localhost:5000/api/sessions/<UUID>/variables/_workflowCheckpoint | python -m json.tool
   ```
   Le resultat doit etre un JSON array avec des entries `{nodeId, status, timestamp, previousOutput}`.

4. **Simuler un crash** : stopper le backend pendant l'execution (Ctrl+C ou `taskkill`).

5. **Relancer le backend et re-invoquer** le meme entry point sur la meme session :
   ```bash
   powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet run --project src/Maestro.Api"
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session invoke <UUID> dev --input task='test' repoPath='C:\temp\test-repo'"
   ```

6. **Verifier dans les logs** que les noeuds deja completes sont skippes :
   ```
   Skipped 'analyze-project' (checkpoint resume)
   Skipped 'design-architecture' (checkpoint resume)
   ```

> **Note** : Si le backend ou le LLM-Provider ne sont pas disponibles, documenter dans le checkpoint que la verification API n'a pas pu etre faite et fournir le build success + grep evidence comme preuve.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Ecrire le checkpoint 34-B-4 |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Backend compile et teste
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded

# Commande 2 : Grep pour les 3 composants du checkpointing
powershell.exe -Command "Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\Sessions\EntryPointExecutor.cs' -Pattern '_workflowCheckpoint' | Measure-Object"
# Resultat attendu : Count >= 8 (save + read + skip + while + foreach + cleanup)

# Commande 3 (si backend up) : Verifier que la variable existe dans l'API
curl -s http://localhost:5000/api/sessions/<UUID> | python -m json.tool | grep _workflowCheckpoint
# Resultat attendu : la variable apparait dans la reponse
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS declarer le test valide sans avoir verifie que le build compile — Build succeeded est le minimum
- Ne PAS inventer les resultats de curl — si le service n'est pas up, le dire clairement dans le checkpoint
- Ne PAS oublier de documenter les noeuds qui ont ete effectivement skippes dans les logs

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-B-4c : Verification round-trip
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Backend build** : Build succeeded / FAIL
**_workflowCheckpoint ecrit** : OUI / NON / NON VERIFIE (backend pas up)
**Skip fonctionne** : OUI / NON / NON VERIFIE (backend pas up)
**Cleanup fonctionne** : OUI / NON / NON VERIFIE
**Backend tests** : X passed / X failed
**Verification** : [copier les outputs pertinents]
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-34/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 34-B checkpointing complete — `_workflowCheckpoint` variable enables workflow resume after crash"
- Retirer : toute mention de "34-B etape 4 not done"
