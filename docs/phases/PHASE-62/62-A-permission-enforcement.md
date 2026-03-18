# 62-A : Permission Enforcement dans ToolDispatcherBlockExecutor

**Statut** : EN COURS
**Effort** : 0.5 jour
**Prerequis** : Aucun

---

## Objectif

Finaliser le check de permissions dans `ToolDispatcherBlockExecutor` pour que chaque tool call d'un agent soit filtre par les permissions de sa session. Fail-closed : si les permissions sont absentes du context, le tool est refuse.

---

## Ce qui est fait

1. **`CheckToolPermission()`** dans `ToolDispatcherBlockExecutor.cs` — 2 couches :
   - Layer 1 : `_permissions_blockRules` (BlockPermission rules, first match wins)
   - Layer 2 : `_permissions_allowedBlocks` (AllowedBlocks whitelist, fail-closed si absent)

2. **`BuildExecutionContext`** dans `BlockRefHandler.cs` propage :
   - `_permissions_allowedBlocks` depuis `session.GetEffectivePermissions().AllowedBlocks`
   - `_permissions_blockRules` depuis `session.BlockPermissions`

3. **Tests** : `ToolDispatcherPermissionTests.cs` cree avec 36 tests, mais certains doivent etre corriges apres le changement fail-closed.

---

## Ce qui reste

### 0. Lancer les tests existants d'abord

**Premiere action** : `dotnet test --filter ToolDispatcherPermissionTests` pour voir l'etat actuel. Les 36 tests existent deja — certains echouent apres le changement fail-closed. Il faut savoir lesquels avant de corriger.

### 1. Finaliser les tests fail-closed

Les tests suivants supposaient un default-allow quand les permissions ne sont pas dans le context. Ils doivent etre mis a jour pour :
- Fournir `allowedBlocks` explicitement dans chaque test qui attend un `Allowed`
- Verifier que les tests sans `allowedBlocks` retournent `Denied`

**Fichier** : `apps/backend/tests/Maestro.Execution.Tests/ToolDispatcherPermissionTests.cs`

### 2. Verifier les sessions existantes

Les sessions creees via `ProjectSession.Create()` ont `ContextPermissions.Full` par defaut, qui inclut `AllowedBlocks = ["*"]`. Verifier que :
- `BuildExecutionContext` propage bien `["*"]` dans le context
- `CheckToolPermission` avec `["*"]` retourne `Allowed` pour tous les tools
- Aucune session existante n'est cassee

**Test** : creer une session par defaut, construire le context, verifier que tout passe.

### 3. Configurer le ContractTestRunner

Le `ContractTestRunner` cree des sessions de test pour les agents. Ces sessions doivent avoir `AllowedBlocks` configure pour que les tools non-mappes soient refuses.

**Point important** : le ContractTestRunner cree un context manuellement (lignes 447-464 de `ContractTestRunner.cs`) qui ne passe PAS par `BuildExecutionContext`. Mais ce context est celui de l'appel initial — le tool-dispatcher nested dans les config.nodes de l'agent passe par `BlockRefHandler.BuildExecutionContext` avec la session du repository. Donc le fix est sur la **session** (via `session.UpdatePermissions()`), pas sur le context manuel. Ne PAS ajouter `_permissions_allowedBlocks` dans le context manuel — c'est `BuildExecutionContext` qui le fait.

**AllowedBlocks exacts a configurer** :

```csharp
AllowedBlocks = new List<string>
{
    "file-write",       // nom original (avant mapping)
    "file-read",        // nom original (avant mapping)
    "file-edit",        // nom original (avant mapping)
    "shell-execute",    // nom original (avant mapping)
    "step-complete"     // sortie de boucle agentique
}
```

**Important** : ce sont les noms **originaux** (pre-mapping), pas les noms des capture blocks. `CheckToolPermission` est appele AVANT le mapping `_toolMapping` dans `ToolDispatcherBlockExecutor.ExecuteAsync`. Donc quand l'agent appelle `file-write`, la permission est verifiee sur `file-write` (autorise), puis le mapping redirige vers `capture-file-write` (execution).

Si l'agent appelle `json-validator` (pas dans la liste) → `CheckToolPermission` refuse → l'agent recoit "not available" → pas de loop sur un tool reel non-mappe.

**Fichier** : `apps/backend/src/Maestro.Infrastructure/Testing/ContractTestRunner.cs`

**Modification** : dans la methode qui cree la session de test, appeler `session.UpdatePermissions()` avec un `ContextPermissions` qui liste les AllowedBlocks ci-dessus.

### 4. Build complet

- `dotnet build` : 0 erreurs
- `dotnet test` sur `Maestro.Execution.Tests` : tous les tests passent

---

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `Maestro.Infrastructure/BlockExecutors/ToolDispatcherBlockExecutor.cs` | Deja modifie — verifier |
| `Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Deja modifie — verifier |
| `Maestro.Execution.Tests/ToolDispatcherPermissionTests.cs` | Corriger les tests fail-closed |
| `Maestro.Infrastructure/Testing/ContractTestRunner.cs` | Configurer AllowedBlocks sur la session (pas le context) |

---

## Verification

- [ ] `dotnet test --filter ToolDispatcherPermissionTests` lance en premier (etat actuel documente)
- [ ] Tous les tests `ToolDispatcherPermissionTests` passent apres corrections
- [ ] Tous les tests `Maestro.Execution.Tests` passent (0 regression)
- [ ] `dotnet build` : 0 erreurs
- [ ] Session par defaut (ContextPermissions.Full) → tous les tools autorises
- [ ] Session restreinte → seuls les tools listes sont autorises
- [ ] ContractTestRunner → AllowedBlocks sur la session = noms originaux pre-mapping
- [ ] Checkpoint mis a jour
