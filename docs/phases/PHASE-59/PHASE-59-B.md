# 59-B : I/O controle + _workflowCheckpoint cleanup entre agents

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — `BuildBlockInputs()` (ligne 381) construit les inputs depuis le noeud JSON. Doit filtrer pour ne passer que les inputs declares
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — `ExtractResultAsync()` lit `_agentResult` et les `_agent*` prefixed vars du contexte. C'est la source des outputs a extraire de la session enfant
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` — `ExecuteConfigNodesAsync()` set les inputs comme variables session (ligne 159) et synchronise les variables session -> contexte apres execution (ligne 172-173)
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` — checkpoint mechanism (lignes 100-116, 206-214). `_workflowCheckpoint` est une List<object> qui accumule les nodeId completes. Doit etre nettoyee entre agents
- `apps/backend/src/Maestro.Domain/Entities/ContainerSession.cs` — `Variables` dictionnaire, `SetVariable()`, `RemoveVariable()`, `GetVariable()`

---

## Ce que cette sous-phase fait

### Partie 1 : I/O controle strict

#### 1.1 Filtrage des inputs vers la session enfant

Dans `BlockRefHandler`, quand on cree la session enfant (59-A), les inputs passes a l'enfant doivent etre UNIQUEMENT ceux declares dans le noeud blockRef JSON :

```json
{
  "id": "call-test-designer",
  "blockRef": "agents/test-designer",
  "inputs": {
    "prompt": "{{userPrompt}}",
    "workingDir": "{{workingDir}}"
  }
}
```

Seuls `prompt` et `workingDir` doivent etre copies sur la session enfant. Pas les 50+ variables du parent (`_workflowCheckpoint`, `_executionTree`, `_llmActivity`, `conversationHistory`, etc.).

Implementation : `BuildBlockInputs()` retourne deja un dictionnaire filtre depuis `node.inputs`. Ce dictionnaire est passe a `MultiNodeBlockExecutor` via `inputs`. Le changement est de s'assurer que la session enfant ne recoit QUE ces inputs comme variables initiales, pas les variables du parent.

#### 1.2 Filtrage des outputs depuis la session enfant

Quand l'agent termine, `AgentBlockExecutor.ExtractResultAsync()` retourne un `BlockExecutionResult` avec des `Outputs` (content, _agentResult, blockId, fitness, etc.). Ce resultat est deja correctement filtre par `SerializeBlockOutput()` dans `BlockRefHandler` (ligne 446-468).

Point d'attention : les outputs prefixes `_` sont stockes comme `_{key}_{blockRefId}` sur la session (ligne 133-134). Avec la session enfant, il faut stocker ces resultats sur la session PARENT, pas sur l'enfant.

#### 1.3 Variables systeme interdites dans l'enfant

La session enfant ne doit JAMAIS recevoir ces variables du parent :
- `_workflowCheckpoint`, `_workflowCheckpoint_whileState`, `_workflowCheckpoint_foreachIndex`
- `_executionTree`
- `_llmActivity`
- `_activeWorkflow`
- `_activeBlock`, `_activeBlockStatus`, `_activeBlockOutput`
- `conversationHistory` (sauf si declare explicitement dans inputs)
- `_accumulatedCost`, `_accumulatedPromptTokens`, `_accumulatedCompletionTokens`

### Partie 2 : Checkpoint cleanup entre agents

#### 2.1 Clear _workflowCheckpoint au debut de chaque config.nodes execution

Dans `MultiNodeBlockExecutor.ExecuteConfigNodesAsync()`, AVANT de lancer `Engine.ExecuteConfigNodesAsync()`, nettoyer :
- `_workflowCheckpoint` — remove de la session
- `_workflowCheckpoint_whileState` — remove de la session
- `_workflowCheckpoint_foreachIndex` — remove de la session

Ceci resout le bug immediat : quand le premier agent complete et laisse un checkpoint, le second agent skip des noeuds car les nodeIds correspondent (les templates agent ont souvent les memes nodeIds: `inference`, `parse-response`, `dispatch-tools`, etc.).

Avec les sessions enfants (59-A), ce nettoyage est naturellement resolu (session vide), mais on le fait quand meme pour les blocks non-agents qui partagent la session parent.

#### 2.2 Clear _agentDone et _agentResult au debut de l'execution agent

Dans `AgentBlockExecutor.PrepareExecutionAsync()`, nettoyer les variables agent du cycle precedent :
- `_agentDone` — set a "" ou remove
- `_agentResult` — set a "" ou remove
- `_agentIteration` — set a "0" ou remove

Sans cela, un second agent dans un workflow peut lire le `_agentDone = "true"` du premier agent et terminer immediatement son while loop.

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Modifier — s'assurer que seuls les inputs declares du noeud sont passes a la session enfant. Stocker les outputs `_` prefixes sur la session PARENT |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` | Modifier `ExecuteConfigNodesAsync()` — clear `_workflowCheckpoint`, `_workflowCheckpoint_whileState`, `_workflowCheckpoint_foreachIndex` sur la session AVANT de lancer le moteur |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier `PrepareExecutionAsync()` — clear `_agentDone`, `_agentResult`, `_agentIteration` au debut pour eviter la contamination inter-agents |

---

## Verification

```bash
# 1. Build backend — 0 erreurs
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# Resultat : Build succeeded

# 2. Tests existants — 0 regressions
dotnet test C:\Meastro\apps\backend\tests\Maestro.Infrastructure.Tests\Maestro.Infrastructure.Tests.csproj
# Resultat : tous passent

# 3. Verification I/O isolation
# Invoquer un workflow avec 2 agents sequentiels (block-forge: test-designer puis agent-creator)
# Apres execution de l'agent 1 :
curl http://localhost:5000/api/sessions/{child-1-id}
# Verifier : variables contiennent SEULEMENT les inputs declares + variables runtime de l'agent
# Verifier : PAS de _workflowCheckpoint, _executionTree, _llmActivity du parent

# Apres execution de l'agent 2 :
curl http://localhost:5000/api/sessions/{child-2-id}
# Verifier : variables ne contiennent PAS les variables de l'agent 1
# Verifier : PAS de _nodeResult_* de l'agent 1

# 4. Verification checkpoint cleanup
# Si les 2 agents utilisent le meme template (memes nodeIds dans config.nodes) :
# L'agent 2 NE DOIT PAS skip des noeuds a cause du checkpoint de l'agent 1
# Verifier dans les logs : pas de "Skipping already-completed node" pour l'agent 2

# 5. Verification _agentDone cleanup
# L'agent 2 NE DOIT PAS terminer immediatement
# Verifier dans les logs : l'agent 2 entre bien dans sa while loop
```

---

## Anti-patterns

- Ne PAS nettoyer les checkpoints dans `NodeExecutionEngine` — le nettoyage se fait dans `MultiNodeBlockExecutor.ExecuteConfigNodesAsync()` car c'est le point d'entree d'une nouvelle execution de config.nodes. Le moteur doit pouvoir resumer apres crash (son checkpoint est valide pour sa propre execution)
- Ne PAS supprimer `_workflowCheckpoint` globalement sur la session parent — seulement sur la session enfant (qui est vide de toute facon) ou au debut d'une execution config.nodes. Le checkpoint du workflow parent reste intact
- Ne PAS passer `previousOutput` de l'agent 1 comme variable a la session enfant de l'agent 2 — les outputs sont propages via `_nodeResult_{nodeId}` sur la session parent, et les inputs du noeud suivant les referencent via `{{_nodeResult_call-test-designer}}`
- Ne PAS modifier la signature de `BuildBlockInputs()` — cette methode est aussi utilisee pour les blocks non-agents. Ajouter la logique de filtrage dans le code specifique aux sessions enfants dans `ExecuteAsync()`
- Ne PAS oublier de clear `_agentDone` — c'est le bug le plus sournois, car le while loop du second agent voit `_agentDone == true` et sort immediatement. Impossible a diagnostiquer sans savoir qu'on cherche

---

## Checkpoint

```markdown
## 59-B : I/O controle + checkpoint cleanup
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**Tests existants** : tous passent (0 regressions)
**Inputs filtres** : session enfant recoit uniquement les inputs declares du noeud blockRef
**Variables systeme absentes** : _workflowCheckpoint, _executionTree, _llmActivity absentes de la session enfant
**Outputs propages au parent** : _nodeResult_{nodeId} et _{key}_{blockRefId} sur la session parent
**Checkpoint cleanup** : _workflowCheckpoint, _whileState, _foreachIndex nettoyes avant chaque config.nodes
**Agent cleanup** : _agentDone, _agentResult, _agentIteration nettoyes dans PrepareExecutionAsync
**Test 2 agents sequentiels** : agent 2 ne skip pas de noeuds, entre dans sa while loop normalement
```
