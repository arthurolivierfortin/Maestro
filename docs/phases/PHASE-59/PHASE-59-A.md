# 59-A : Sessions enfants pour chaque blockRef agent

---

## Lecture obligatoire

- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` — point d'interception actuel pour les blockRef. C'est ici qu'on detecte les blocks de type agent et qu'on cree la session enfant
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/MultiNodeBlockExecutor.cs` — `ExecuteConfigNodesAsync()` charge la session par sessionId et execute les config.nodes dessus. Doit recevoir l'ID de la session enfant au lieu du parent
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — executor agent actuel. `PrepareExecutionAsync()` cree la conversation, `ExtractResultAsync()` lit `_agentResult`. Ne doit PAS etre modifie directement (ADR Phase 53)
- `apps/backend/src/Maestro.Domain/Entities/ProjectSession.cs` — factory methods `Create()` et `CreateInWorkspace()`. `ParentSessionId` existe deja (protected set). Besoin d'une factory pour sessions enfants
- `apps/backend/src/Maestro.Domain/Entities/Session.cs` — `ParentSessionId` declare (ligne 77). Deja present dans le modele
- `apps/backend/src/Maestro.Application/Interfaces/IProjectSessionRepository.cs` — `SaveAsync()` et `GetByIdAsync()` pour persister la session enfant
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — comprendre comment `ExecuteConfigNodesAsync` est appele et comment le sessionId est propage

---

## Ce que cette sous-phase fait

### 1. Ajouter une factory `CreateChildSession()` sur ProjectSession

Creer une methode statique `CreateAsChild()` dans `ProjectSession.cs` qui :
- Prend en parametres : `name`, `parentSession` (ProjectSession), `repositoryPath`
- Set `ParentSessionId = parentSession.Id`
- Set `ParentWorkspaceId = parentSession.ParentWorkspaceId`
- Herite des permissions du parent via `parentSession.GetEffectivePermissions()`
- Herite de `BlockSearchPaths`, `DefaultModel`, `ModelOverrides`, `FileAccessRules`, `BlockPermissions` du parent
- Cree la session en statut `Active` (pas `Created`, car elle est immediatement utilisee)
- Variables : dictionnaire VIDE (c'est le point cle de l'isolation)

### 2. Detecter les blocks agents dans BlockRefHandler

Dans `BlockRefHandler.ExecuteAsync()`, apres la resolution du block et avant le dispatch executor :
- Verifier si `block.BlockType == "agent"` (case-insensitive)
- Si oui, creer une session enfant via `ProjectSession.CreateAsChild()`
- Persister la session enfant via `_repository.SaveAsync(childSession)`
- Passer les inputs declares du blockRef node a la session enfant comme variables
- Modifier le `ExecutionContext` pour porter le `sessionId` de la session enfant
- Apres execution, extraire les outputs de la session enfant et les propager au parent

### 3. Modifier MultiNodeBlockExecutor pour utiliser la session enfant

Le changement principal est dans `BlockRefHandler`, pas dans `MultiNodeBlockExecutor`. L'executor recoit le `sessionId` via `ExecutionContext.Variables["sessionId"]` et charge la session correspondante. Si BlockRefHandler passe le sessionId de l'enfant dans le contexte, MultiNodeBlockExecutor l'utilisera automatiquement.

Point d'attention : `MultiNodeBlockExecutor.ExecuteConfigNodesAsync()` synchronise les variables session -> contexte (ligne 172-173). Pour la session enfant, c'est correct car seules les variables de l'enfant seront propagees.

### 4. Propager les resultats au parent

Apres que l'executor agent a termine :
- Lire le `BlockExecutionResult` (outputs)
- Stocker les outputs sur la session parent comme `_nodeResult_{nodeId}`
- Stocker l'ID de la session enfant comme `_childSession_{nodeId}` sur le parent (pour tracabilite)
- Ne PAS copier les variables internes de l'enfant vers le parent

### 5. Fallback pour blocks non-agents

Les blocks de type inference, workflow, tool, etc. continuent a utiliser la session parent comme aujourd'hui. Seuls les blocks de type "agent" creent une session enfant. Ceci preserve la compatibilite avec tous les workflows existants.

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Domain/Entities/ProjectSession.cs` | Ajouter factory `CreateAsChild(string name, ProjectSession parent, string? repositoryPath)` |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Modifier `ExecuteAsync()` — detecter block type agent, creer session enfant, passer sessionId enfant dans le contexte, propager outputs au parent |
| `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` | Ajouter methode pour enregistrer la relation parent-enfant dans les variables (optionnel, pour monitoring) |

---

## Verification

```bash
# 1. Build backend — 0 erreurs
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# Resultat : Build succeeded, 0 erreurs

# 2. Tests unitaires existants — 0 regressions
dotnet test C:\Meastro\apps\backend\tests\Maestro.Domain.Tests\Maestro.Domain.Tests.csproj
# Resultat : tous les tests passent

# 3. Tests execution existants — 0 regressions
dotnet test C:\Meastro\apps\backend\tests\Maestro.Infrastructure.Tests\Maestro.Infrastructure.Tests.csproj
# Resultat : tous les tests passent

# 4. Verification manuelle : invoquer un workflow avec un agent blockRef
# Apres execution :
curl http://localhost:5000/api/sessions/{parent-id}
# Verifier : la variable _childSession_{nodeId} contient un UUID valide

curl http://localhost:5000/api/sessions/{child-id}
# Verifier : parentSessionId == {parent-id}
# Verifier : variables ne contiennent PAS les variables du parent (isolation)
# Verifier : _agentResult present

# 5. Verification fallback : invoquer un workflow avec un inference blockRef
# Le block inference ne doit PAS creer de session enfant
# Verifier dans les logs : pas de "Creating child session" pour les blocks non-agents
```

---

## Anti-patterns

- Ne PAS modifier `AgentBlockExecutor` pour gerer la session enfant — l'isolation est dans `BlockRefHandler` (infrastructure), pas dans l'executor (contenu). L'executor recoit un `sessionId` dans le contexte et l'utilise sans savoir si c'est un parent ou un enfant
- Ne PAS copier les variables du parent vers la session enfant — c'est exactement le probleme qu'on resout. La session enfant commence VIDE (sauf les inputs declares du blockRef node)
- Ne PAS creer de session enfant pour les blocks non-agents (inference, workflow, tool) — ca casserait les workflows existants qui s'attendent a lire les variables sur la meme session
- Ne PAS laisser la session enfant en statut `Created` — elle doit etre `Active` pour que les executors puissent l'utiliser immediatement
- Ne PAS utiliser `SessionManager` pour creer la session — utiliser la factory `ProjectSession.CreateAsChild()` + `_repository.SaveAsync()` directement. BlockRefHandler a deja acces au repository

---

## Checkpoint

```markdown
## 59-A : Sessions enfants
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**Tests existants** : tous passent (0 regressions)
**CreateAsChild factory** : implementee dans ProjectSession
**Detection agent dans BlockRefHandler** : block.BlockType == "agent" detecte
**Session enfant creee** : parentSessionId set, variables vides
**SessionId enfant dans contexte** : ExecutionContext.Variables["sessionId"] = childSession.Id
**Outputs propages au parent** : _nodeResult_{nodeId} contient le resultat agent
**Fallback non-agents** : blocks inference/workflow/tool utilisent toujours la session parent
**Verification manuelle** : curl confirme parentSessionId et isolation
```
