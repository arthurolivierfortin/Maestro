# 62-B : Tests E2E de l'arbre Workspace → Session → Child → Agent

**Statut** : A FAIRE
**Effort** : 1 jour
**Prerequis** : 62-A COMPLETE

---

## Objectif

Tester en profondeur la propagation des permissions et des couts a travers l'arbre Workspace → Session → Child Session. Ces tests prouvent que le container model fonctionne reellement, pas juste en isolation.

---

## Scenarios de test

### Groupe 1 : Propagation des permissions

#### Test 1.1 : Session herite des permissions du workspace
```
Workspace: AllowedBlocks = ["file-read", "file-write", "step-complete"]
  └─ Session creee dans ce workspace
       → GetEffectivePermissions().AllowedBlocks = ["file-read", "file-write", "step-complete"]
       → HasBlockPermission("shell-execute") = false
```

#### Test 1.2 : Child session = intersection avec parent
```
Session: AllowedBlocks = ["file-read", "file-write", "shell-execute", "step-complete"]
  └─ Child: AllowedBlocks = ["file-read", "step-complete"]
       → Effective = ["file-read", "step-complete"]
       → file-write refuse, shell-execute refuse
```

#### Test 1.3 : Child ne peut pas escalader
```
Session: AllowedBlocks = ["file-read"]
  └─ Child tente UpdatePermissions avec AllowedBlocks = ["file-read", "shell-execute"]
       → Effective = ["file-read"]  (intersection avec parent)
       → shell-execute refuse malgre la tentative
```

#### Test 1.4 : 3 niveaux de profondeur
```
Workspace: AllowedBlocks = ["*"]
  └─ Session: AllowedBlocks = ["file-read", "file-write", "shell-execute", "step-complete"]
       └─ Child: AllowedBlocks = ["file-read", "step-complete"]
            → Effective = ["file-read", "step-complete"]
            → Seuls file-read et step-complete passent CheckToolPermission
```

#### Test 1.5 : BlockPermission rules + AllowedBlocks combines
```
Session: AllowedBlocks = ["*"], BlockPermissions = [Deny("shell-execute")]
  └─ Child herite les BlockPermissions
       → file-read autorise (AllowedBlocks = ["*"])
       → shell-execute refuse (BlockPermission deny)
```

### Groupe 2 : Permissions dans le context d'execution

#### Test 2.1 : BuildExecutionContext propage AllowedBlocks
```
Session avec AllowedBlocks = ["file-read", "step-complete"]
  → BuildExecutionContext
       → context.Variables["_permissions_allowedBlocks"] = ["file-read", "step-complete"]
       → CheckToolPermission(context, "file-read") = Allowed
       → CheckToolPermission(context, "file-write") = Denied
```

#### Test 2.2 : BuildExecutionContext propage BlockPermissions
```
Session avec BlockPermissions = [Deny("shell-execute", "security")]
  → BuildExecutionContext
       → context.Variables["_permissions_blockRules"] = [Deny("shell-execute")]
       → CheckToolPermission(context, "shell-execute") = Denied avec message "security"
```

### Groupe 3 : Couts remontent dans l'arbre

**Note sur l'accumulation des couts** : dans le code actuel (`BlockRefHandler.AccumulateCosts`, lignes 611-621), les couts sont accumules sur la **session parent** — pas sur la child session. Les couts de la child sont dans `MultiNodeBlockExecutor.GetAccumulatedCosts()` lu depuis le context de la child, pas depuis la session. Les tests doivent verifier le parent, pas la child session.

#### Test 3.1 : Block execution → parent accumule le cout
```
Parent session: _accumulatedCost = 0
  └─ Child session (agent) execute un block avec cost = $0.05
       → MultiNodeBlockExecutor accumule dans le context de la child
       → BlockRefHandler.AccumulateCosts lit le result et accumule sur le parent
       → Parent: _accumulatedCost = $0.05
       → Verification sur le PARENT, pas sur la child session
```

#### Test 3.2 : Couts a travers 3 niveaux
```
Workspace
  └─ Session
       └─ Child execute 3 blocks ($0.01 + $0.02 + $0.03)
            → BlockRefHandler accumule $0.06 sur Session (le parent direct)
            → Si Session est elle-meme un child, son parent accumule aussi
            → Verifier la remontee sur chaque parent
```

### Groupe 4 : _toolMapping + permissions

#### Test 4.1 : Mapping redirige, permissions filtrent
```
Session: AllowedBlocks = ["file-write", "step-complete"]
         _toolMapping = {"file-write": "capture-file-write"}
  → Agent appelle file-write
       → CheckToolPermission("file-write") = Allowed
       → Mapping redirige vers capture-file-write
       → capture-file-write execute

  → Agent appelle shell-execute
       → CheckToolPermission("shell-execute") = Denied
       → Mapping jamais consulte
```

#### Test 4.2 : ContractTestRunner avec permissions restreintes
```
ContractTestRunner cree session de test:
  AllowedBlocks = ["file-read", "file-write", "file-edit", "shell-execute", "step-complete"]
  _toolMapping = {"file-write": "capture-file-write", ...}

  → Agent appelle file-write → autorise, redirige vers capture
  → Agent appelle json-validator → refuse ("not available")
```

### Groupe 5 : Agent toujours en child session

#### Test 5.1 : Agent avec AllowedBlocks=["*"] est en child session
```
Parent session: AllowedBlocks = ["*"]
  └─ Agent block execute via BlockRefHandler
       → Child session creee
       → Child session a ses propres variables (_agentDone, _conversationId)
       → Parent session n'a PAS ces variables
       → Resultat de l'agent stocke dans parent via _nodeResult_{nodeId}
```

---

## Implementation

### Fichier de test

Creer `apps/backend/tests/Maestro.Execution.Tests/ContainerIsolationE2ETests.cs`

### Pattern de test

Utiliser le pattern existant de `BlockRefHandlerIsolationTests.cs` :
- `ProjectSession.Create()` pour les sessions parent
- `ProjectSession.CreateAsChild()` pour les enfants
- `session.UpdatePermissions()` pour restreindre
- `session.SetBlockPermissions()` pour les regles explicites
- `BlockRefHandler.CheckBlockPermission()` pour les verifications statiques
- `ToolDispatcherBlockExecutor.CheckToolPermission()` pour les verifications de context

Pour les tests de couts, mocker `IBlockExecutor` qui retourne un `BlockExecutionResult` avec `EstimatedCostUsd` et verifier l'accumulation.

---

## Verification

- [ ] 15+ tests couvrant les 5 groupes
- [ ] Tous les tests passent
- [ ] 0 regression sur les tests existants
- [ ] Checkpoint mis a jour
