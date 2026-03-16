# 59-C : Enforcement FileAccessRule + BlockPermission + GetParentContext()

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Domain/Entities/ContainerSession.cs` — `GetParentContext()` (abstract, ligne 251), `GetEffectivePermissions()` (ligne 274-286), `FileAccessRules` (ligne 87), `BlockPermissions` (ligne 92)
- `apps/backend/src/Maestro.Domain/Entities/ProjectSession.cs` — `GetParentContext()` actuel retourne `null` (ligne 66-71). Commentaire : "Full implementation with workspace lookup is done in the service layer"
- `apps/backend/src/Maestro.Domain/ValueObjects/FileAccessRule.cs` — `FileAccessPermission` enum : ReadWrite, ReadOnly, Hidden, Excluded. `FileAccessType` : File, Directory
- `apps/backend/src/Maestro.Domain/ValueObjects/BlockPermission.cs` — `BlockPermissionLevel` enum : Allowed, Denied, RequiresApproval. `Matches(blockId)` avec support wildcard
- `apps/backend/src/Maestro.Domain/ValueObjects/ContextPermissions.cs` — `GetEffectivePermissions()` utilise `Intersect()` en remontant la chaine parent
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — `BuildExecutionContext()` (ligne 430-444) construit l'ExecutionContext avec `_permissions_allowedPaths`. Point d'injection pour le check BlockPermission
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — ne doit PAS etre modifie (ADR)
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` — dispatch des noeuds. Le check BlockPermission doit etre AVANT le dispatch

---

## Ce que cette sous-phase fait

### Partie 1 : GetParentContext() fonctionnel

#### 1.1 Le probleme

`ProjectSession.GetParentContext()` retourne toujours `null`. Le commentaire dit "done in the service layer" mais ce service n'existe pas. En consequence, `GetEffectivePermissions()` retourne toujours les permissions de la session elle-meme, sans intersection avec le parent.

#### 1.2 La solution

Pour les sessions enfants creees par 59-A, le parent est une autre ProjectSession. La solution la plus simple et la plus propre :

**Option retenue : injection du parent au moment de la creation.**

Dans `ProjectSession.CreateAsChild()` (59-A), stocker une reference au parent directement. Probleme : `ProjectSession` est une entite persistee en JSON, et une reference circulaire casserait la serialisation.

**Solution concrette** : Ajouter un champ transient (non-persiste) `_parentSession` sur `ProjectSession` :
- Set dans `CreateAsChild()` au moment de la creation
- Set dans `BlockRefHandler` quand on charge une session enfant depuis le repository (lookup parent via `ParentSessionId`)
- `GetParentContext()` retourne `_parentSession` s'il est set, sinon retourne `null` (comportement actuel pour les sessions racines)

Ceci evite de toucher a la serialisation JSON et resout le probleme E2E pour les sessions enfants.

#### 1.3 Reconstitution depuis le repository

Quand `MultiNodeBlockExecutor.ExecuteConfigNodesAsync()` charge la session enfant via `Repository.GetByIdAsync()`, le `_parentSession` est null (pas persiste). Il faut ajouter une etape :
- Si `session.ParentSessionId != null`, charger le parent via `Repository.GetByIdAsync(session.ParentSessionId)`
- Set `session._parentSession = parentSession`
- Ainsi `GetEffectivePermissions()` fonctionne meme apres rechargement

Point d'injection : dans `BlockRefHandler` juste apres la creation de la session enfant (pas de rechargement necessaire, le parent est deja en memoire). Et dans `MultiNodeBlockExecutor` si la session est rechargee depuis le disque.

### Partie 2 : FileAccessRule enforcement

#### 2.1 Ou enforcer

Les `FileAccessRules` sont sur la session (`ContainerSession.FileAccessRules`). Elles doivent etre verifiees AVANT chaque operation fichier. Les executors de blocks natifs qui font du I/O fichier sont :

- `FileReadBlockExecutor` — lire un fichier
- `FileWriteBlockExecutor` / `FileEditBlockExecutor` — ecrire/modifier un fichier
- `DirectoryListBlockExecutor` — lister un repertoire
- `ShellBlockExecutor` — execute des commandes shell (verification indirecte)

Ces executors recoivent un `ExecutionContext` avec `Variables["_permissions_allowedPaths"]`. Il faut ajouter les `FileAccessRules` a ce contexte.

#### 2.2 Implementation

Ajouter une methode utilitaire `CheckFileAccess(session, filePath)` qui :
1. Normalise le chemin relatif au `workingDir`
2. Parcourt `session.FileAccessRules` pour trouver la premiere regle matchante
3. Retourne le `FileAccessPermission` applicable

Integrer dans `BlockRefHandler.BuildExecutionContext()` :
- Serialiser les `FileAccessRules` de la session (enfant, donc heritees du parent) dans `execContext.Variables["_fileAccessRules"]`
- Les executors natifs verifient avant l'operation

#### 2.3 Regles d'enforcement

| Permission | Read | Write | List | Visible |
|------------|------|-------|------|---------|
| ReadWrite  | oui  | oui   | oui  | oui     |
| ReadOnly   | oui  | NON   | oui  | oui     |
| Hidden     | NON  | NON   | NON  | NON     |
| Excluded   | NON  | NON   | NON  | NON     |

- `Hidden` : le fichier n'apparait pas dans les listings ET ne peut pas etre lu/ecrit
- `Excluded` : identique a Hidden (fichier n'existe pas pour l'agent)
- `ReadOnly` : peut lire mais pas ecrire/editer
- Si aucune regle ne matche : `ReadWrite` (defaut, pas de restriction)

### Partie 3 : BlockPermission enforcement

#### 3.1 Ou enforcer

Le check doit se faire dans `BlockRefHandler.ExecuteAsync()`, APRES la resolution du block et AVANT le dispatch executor. C'est le meme point que le cost limit check (Phase 59-PRE-2-A).

#### 3.2 Implementation

Dans `BlockRefHandler.ExecuteAsync()`, apres `var block = await _blockDiscovery.GetByIdAsync(...)` :

```csharp
// Check BlockPermission
var permission = CheckBlockPermission(session, blockRefId);
if (permission == BlockPermissionLevel.Denied)
    throw new InvalidOperationException($"Block '{blockRefId}' is denied by session permissions");
if (permission == BlockPermissionLevel.RequiresApproval)
{
    // Pour V1 : traiter RequiresApproval comme Denied avec un message plus explicite
    throw new InvalidOperationException(
        $"Block '{blockRefId}' requires approval. Approval workflow not yet implemented.");
}
```

La methode `CheckBlockPermission()` :
1. Parcourt `session.BlockPermissions` (de la session effective, enfant ou parent)
2. Utilise `BlockPermission.Matches(blockRefId)` pour trouver la premiere regle matchante
3. Retourne `Allowed` si aucune regle ne matche (defaut permissif)

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Domain/Entities/ProjectSession.cs` | Ajouter champ transient `_parentSession`, modifier `GetParentContext()` pour le retourner, ajouter methode `SetParentSession(ProjectSession parent)` |
| `apps/backend/src/Maestro.Domain/Entities/FoundrySession.cs` | Meme pattern : champ transient `_parentSession`, `GetParentContext()` le retourne (pour coherence, meme si les foundry sessions n'ont pas de parent en V1) |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Ajouter `CheckBlockPermission()` avant dispatch. Ajouter `_fileAccessRules` dans `BuildExecutionContext()`. Set `_parentSession` sur la session enfant au moment de la creation |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` | Apres `Repository.GetByIdAsync()`, si `session.ParentSessionId != null`, charger le parent et appeler `SetParentSession()` |

---

## Verification

```bash
# 1. Build backend — 0 erreurs
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# Resultat : Build succeeded

# 2. Tests existants — 0 regressions
dotnet test C:\Meastro\apps\backend\tests\Maestro.Domain.Tests\Maestro.Domain.Tests.csproj
dotnet test C:\Meastro\apps\backend\tests\Maestro.Infrastructure.Tests\Maestro.Infrastructure.Tests.csproj
# Resultat : tous passent

# 3. Verification GetParentContext()
# Creer une session enfant via workflow, puis :
curl http://localhost:5000/api/sessions/{child-id}
# Verifier : parentSessionId est set
# Note : GetParentContext() ne peut pas etre verifie par curl directement,
# mais son effet est visible via GetEffectivePermissions() :
# Si le parent a permissions restrictives, l'enfant doit les heriter

# 4. Verification BlockPermission
# Configurer une session avec BlockPermission Deny pour un block specifique
curl -X PUT http://localhost:5000/api/sessions/{session-id}/permissions \
  -H "Content-Type: application/json" \
  -d '{"blockPermissions": [{"blockPattern": "agents/test-designer", "permission": "Denied"}]}'
# Invoquer un workflow qui reference ce block
# Resultat attendu : erreur "Block 'agents/test-designer' is denied by session permissions"

# 5. Verification FileAccessRule
# Configurer une session avec FileAccessRule Hidden pour un fichier
curl -X PUT http://localhost:5000/api/sessions/{session-id}/permissions \
  -H "Content-Type: application/json" \
  -d '{"fileAccessRules": [{"path": "secrets.env", "permission": "Hidden"}]}'
# L'agent ne doit pas pouvoir lire ce fichier
# Resultat attendu : erreur ou fichier invisible dans directory-list
```

---

## Anti-patterns

- Ne PAS stocker une reference `ProjectSession` directement dans les proprietes serialisees — ca creerait une reference circulaire dans le JSON. Utiliser un champ transient (`[JsonIgnore]` ou non-property)
- Ne PAS faire un appel repository dans `GetParentContext()` — c'est une methode synchrone sur une entite de domaine. Le pattern correcte est : set la reference transient au moment du chargement (dans BlockRefHandler ou MultiNodeBlockExecutor), puis `GetParentContext()` retourne simplement le champ
- Ne PAS traiter `RequiresApproval` comme `Allowed` — en V1, bloquer l'execution avec un message clair. Le workflow d'approbation viendra plus tard
- Ne PAS ignorer les `FileAccessRules` du parent — avec `GetEffectivePermissions()` fonctionnel, les rules du parent sont automatiquement heritees. Mais les `FileAccessRules` ne font pas partie de `ContextPermissions` (elles sont sur `ContainerSession` directement). Il faut les propager explicitement dans `CreateAsChild()`
- Ne PAS ajouter le check BlockPermission dans chaque executor — le check est centralise dans `BlockRefHandler`, qui est le SEUL point de dispatch pour les blockRef. Un seul point de controle

---

## Checkpoint

```markdown
## 59-C : Permissions enforcement + GetParentContext
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**Tests existants** : tous passent (0 regressions)
**GetParentContext()** : retourne le parent via champ transient _parentSession
**GetEffectivePermissions()** : intersection parent/enfant fonctionne E2E
**BlockPermission Denied** : block refuse avec message explicite
**BlockPermission RequiresApproval** : traite comme Denied en V1 avec message
**FileAccessRule Hidden** : fichier invisible pour l'agent (read/write/list refuses)
**FileAccessRule ReadOnly** : lecture autorisee, ecriture refusee
**FileAccessRule Excluded** : fichier n'existe pas pour l'agent
**Parent chargement** : MultiNodeBlockExecutor charge le parent si ParentSessionId != null
```
