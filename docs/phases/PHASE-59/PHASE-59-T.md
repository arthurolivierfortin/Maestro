# 59-T : Tests — Isolation agents, permissions, checkpoint cleanup

---

## Lecture obligatoire

- `docs/system/TESTING-PROTOCOL.md` — 6 couches de tests, matrice par type de changement
- `apps/backend/tests/Maestro.Domain.Tests/SessionTests.cs` — tests existants pour sessions (pattern a suivre)
- `apps/backend/tests/Maestro.Domain.Tests/ContainerSessionTests.cs` — tests GetParentContext() et GetEffectivePermissions() existants
- `apps/backend/tests/Maestro.Infrastructure.Tests/` — tests d'infrastructure existants (pattern)
- `docs/phases/PHASE-59/PHASE-59-A.md` — quoi tester pour les sessions enfants
- `docs/phases/PHASE-59/PHASE-59-B.md` — quoi tester pour l'I/O controle et le checkpoint cleanup
- `docs/phases/PHASE-59/PHASE-59-C.md` — quoi tester pour les permissions

---

## Ce que cette sous-phase fait

Creer les tests couvrant les 3 sous-phases precedentes. Les tests sont organises par couche du Testing Protocol.

---

## Couches applicables

| Couche | Obligatoire | Justification |
|--------|-------------|---------------|
| C1 — Type Check | OUI | Backend C# modifie |
| C2 — Tests unitaires | OUI | Nouvelle logique dans BlockRefHandler, ProjectSession, AgentBlockExecutor |
| C3 — Visual Gate (PTY) | NON | Pas de modification TUI |
| C4 — Real Demo Check | NON | Pas de modification TUI |
| C5 — Tests d'integration | OUI | Backend API, workflow multi-agents |
| C6 — E2E Dogfooding | OUI | Block-forge avec 2+ agents isoles |

---

## Tests unitaires (C2)

### Fichier : `apps/backend/tests/Maestro.Domain.Tests/ProjectSessionChildTests.cs` (CREER)

| Test | Description | Assertion |
|------|-------------|-----------|
| `CreateAsChild_SetsParentSessionId` | `CreateAsChild(name, parent, repoPath)` | `child.ParentSessionId == parent.Id` |
| `CreateAsChild_InheritsWorkspaceId` | Parent avec `ParentWorkspaceId` | `child.ParentWorkspaceId == parent.ParentWorkspaceId` |
| `CreateAsChild_HasEmptyVariables` | Session enfant creee | `child.Variables.Count == 0` |
| `CreateAsChild_InheritsPermissions` | Parent avec `ContextPermissions.Standard` | `child.Permissions` equals parent's effective permissions |
| `CreateAsChild_InheritsFileAccessRules` | Parent avec `FileAccessRule.Hidden("secrets.env")` | `child.FileAccessRules` contient la meme regle |
| `CreateAsChild_InheritsBlockPermissions` | Parent avec `BlockPermission.Deny("dangerous-tool")` | `child.BlockPermissions` contient la meme regle |
| `CreateAsChild_IsActive` | Session enfant creee | `child.Status == ContainerSessionStatus.Active` |
| `GetParentContext_ReturnsParent_WhenSet` | `child.SetParentSession(parent)` | `child.GetParentContext() == parent` |
| `GetParentContext_ReturnsNull_WhenNotSet` | Session sans parent | `session.GetParentContext() == null` |
| `GetEffectivePermissions_IntersectsWithParent` | Parent restrictif, enfant permissif | Resultat = intersection (plus restrictif) |

### Fichier : `apps/backend/tests/Maestro.Domain.Tests/BlockPermissionEnforcementTests.cs` (CREER)

| Test | Description | Assertion |
|------|-------------|-----------|
| `Matches_ExactBlockId_ReturnsTrue` | `BlockPermission.Deny("agents/test-designer")` matches `"agents/test-designer"` | `true` |
| `Matches_WildcardPattern_ReturnsTrue` | `BlockPermission.Deny("agents/*")` matches `"agents/test-designer"` | `true` |
| `Matches_DifferentBlock_ReturnsFalse` | `BlockPermission.Deny("agents/test-designer")` vs `"agents/code-reviewer"` | `false` |
| `Matches_GlobalWildcard_MatchesAll` | `BlockPermission.Deny("*")` matches anything | `true` |

### Fichier : `apps/backend/tests/Maestro.Infrastructure.Tests/BlockRefHandlerIsolationTests.cs` (CREER)

| Test | Description | Assertion |
|------|-------------|-----------|
| `AgentBlockRef_CreatesChildSession` | BlockRefHandler dispatches agent block | `_repository.SaveAsync` called with session where `ParentSessionId != null` |
| `NonAgentBlockRef_DoesNotCreateChildSession` | BlockRefHandler dispatches inference block | No child session created |
| `AgentBlockRef_PassesOnlyDeclaredInputs` | Node with `inputs: { prompt, workingDir }`, parent has 50+ vars | Child session only has `prompt` and `workingDir` |
| `AgentBlockRef_PropagatesOutputsToParent` | Agent completes with outputs | Parent session has `_nodeResult_{nodeId}` set |
| `AgentBlockRef_StoresChildSessionIdOnParent` | Agent creates child | Parent has `_childSession_{nodeId}` variable |
| `BlockPermission_Denied_ThrowsException` | Session has `BlockPermission.Deny("blocked-agent")` | `InvalidOperationException` thrown |
| `BlockPermission_Allowed_Continues` | Session has `BlockPermission.Allow("*")` | Execution proceeds normally |
| `BlockPermission_NoRules_DefaultAllowed` | Session has empty `BlockPermissions` | Execution proceeds normally |

### Fichier : `apps/backend/tests/Maestro.Infrastructure.Tests/CheckpointCleanupTests.cs` (CREER)

| Test | Description | Assertion |
|------|-------------|-----------|
| `ExecuteConfigNodes_ClearsCheckpointBeforeExecution` | Session has `_workflowCheckpoint` from previous run | After new execution starts, `_workflowCheckpoint` is empty/null |
| `ExecuteConfigNodes_ClearsWhileState` | Session has `_workflowCheckpoint_whileState` | After new execution starts, variable is cleared |
| `ExecuteConfigNodes_ClearsForeachIndex` | Session has `_workflowCheckpoint_foreachIndex` | After new execution starts, variable is cleared |
| `AgentPrepare_ClearsAgentDone` | Session has `_agentDone = "true"` from previous agent | After `PrepareExecutionAsync`, `_agentDone` is cleared |
| `AgentPrepare_ClearsAgentResult` | Session has `_agentResult = "old result"` | After `PrepareExecutionAsync`, `_agentResult` is cleared |

---

## Tests d'integration (C5)

### Fichier : `apps/backend/tests/Maestro.Integration.Tests/AgentIsolationIntegrationTests.cs` (CREER)

Ces tests utilisent le vrai backend (services reels, pas de mocks) avec des blocks de test simples.

| Test | Description | Assertion |
|------|-------------|-----------|
| `TwoSequentialAgents_EachHasOwnSession` | Workflow avec 2 agents sequentiels | 2 sessions enfants creees, chacune avec un `ParentSessionId` identique |
| `TwoSequentialAgents_VariablesIsolated` | Agent 1 set variable `_myCustomVar`, agent 2 execute | Agent 2 ne voit pas `_myCustomVar` |
| `TwoSequentialAgents_SecondAgentGetsCorrectInputs` | Agent 1 output → workflow → agent 2 input | Agent 2 recoit `_nodeResult_agent-1` comme input |
| `TwoSequentialAgents_CheckpointNotShared` | Agents avec memes nodeIds dans config.nodes | Agent 2 execute tous ses noeuds (pas de skip) |
| `FileAccessRule_Hidden_BlocksRead` | Session enfant avec `FileAccessRule.Hidden("secrets.env")` | File-read block throws ou retourne erreur |
| `FileAccessRule_ReadOnly_AllowsRead_BlocksWrite` | Session enfant avec `FileAccessRule.ReadOnly("config.json")` | file-read OK, file-write throws |
| `GetEffectivePermissions_InheritsFromParentSession` | Parent restrictif, enfant cree | `GetEffectivePermissions()` retourne l'intersection |
| `BlockPermission_Denied_BlocksExecution` | `BlockPermission.Deny("test-tool")` sur la session | BlockRefHandler throws `InvalidOperationException` |

### Strategie pour les blocks de test

Creer des blocks de test minimalistes dans `apps/backend/tests/Maestro.Integration.Tests/test-blocks/` :
- `test-agent-echo.block.json` — agent minimal qui retourne son input comme output. Config.nodes : un seul noeud set-variable qui met l'input dans `_agentResult`
- `test-inference-echo.block.json` — inference block minimal pour verifier le fallback non-agent

---

## E2E Dogfooding (C6)

### Scenario : Block-forge workflow avec isolation

1. Lancer les services (backend + LLM-Provider)
2. Creer une session avec le template `block-forge`
3. Invoquer l'entry point `start` avec un prompt de creation d'agent
4. Verifier que :
   - test-designer cree une session enfant (visible dans Spaces)
   - agent-creator cree une autre session enfant
   - Les 2 sessions enfants ont le meme `ParentSessionId`
   - Les variables de test-designer ne polluent pas agent-creator
   - Le workflow parent a les `_nodeResult_*` des deux agents
   - `_workflowCheckpoint` n'a pas cause de skip de noeuds

### Verification visuelle (Spaces page)

- Ouvrir la page Spaces dans maestro-code
- Les sessions enfants doivent etre visibles sous la session parent
- Chaque session enfant montre son propre `_agentResult`

> Note : ce test E2E sera effectue pendant le dogfooding de fin de phase, pas en tant que test automatise.

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/tests/Maestro.Domain.Tests/ProjectSessionChildTests.cs` | Creer — 10 tests unitaires pour CreateAsChild et GetParentContext |
| `apps/backend/tests/Maestro.Domain.Tests/BlockPermissionEnforcementTests.cs` | Creer — 4 tests unitaires pour Matches() |
| `apps/backend/tests/Maestro.Infrastructure.Tests/BlockRefHandlerIsolationTests.cs` | Creer — 8 tests unitaires pour l'isolation dans BlockRefHandler |
| `apps/backend/tests/Maestro.Infrastructure.Tests/CheckpointCleanupTests.cs` | Creer — 5 tests unitaires pour le cleanup checkpoint et agent |
| `apps/backend/tests/Maestro.Integration.Tests/AgentIsolationIntegrationTests.cs` | Creer — 8 tests d'integration |
| `apps/backend/tests/Maestro.Integration.Tests/test-blocks/test-agent-echo.block.json` | Creer — block agent minimal pour tests |
| `apps/backend/tests/Maestro.Integration.Tests/test-blocks/test-inference-echo.block.json` | Creer — block inference minimal pour tests |

---

## Verification

```bash
# 1. Type check (C1)
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# Resultat : 0 erreurs

# 2. Tests unitaires (C2)
dotnet test C:\Meastro\apps\backend\tests\Maestro.Domain.Tests\Maestro.Domain.Tests.csproj
# Resultat : tous passent, incluant les nouveaux tests

dotnet test C:\Meastro\apps\backend\tests\Maestro.Infrastructure.Tests\Maestro.Infrastructure.Tests.csproj
# Resultat : tous passent, incluant les nouveaux tests

# 3. Tests d'integration (C5)
dotnet test C:\Meastro\apps\backend\tests\Maestro.Integration.Tests\Maestro.Integration.Tests.csproj
# Resultat : tous passent

# 4. Compte des tests
dotnet test --list-tests C:\Meastro\apps\backend\tests\Maestro.Domain.Tests\Maestro.Domain.Tests.csproj 2>/dev/null | wc -l
dotnet test --list-tests C:\Meastro\apps\backend\tests\Maestro.Infrastructure.Tests\Maestro.Infrastructure.Tests.csproj 2>/dev/null | wc -l
dotnet test --list-tests C:\Meastro\apps\backend\tests\Maestro.Integration.Tests\Maestro.Integration.Tests.csproj 2>/dev/null | wc -l
# Verifier que le nombre a augmente par rapport au baseline

# 5. E2E (C6) — manuel pendant dogfooding
# Voir section E2E Dogfooding ci-dessus
```

---

## Anti-patterns

- Ne PAS ecrire des tests qui mockent tout — les tests d'integration (C5) doivent utiliser les vrais services avec des blocks de test simples. Les mocks cachent les bugs d'integration (ex: serialisation JSON, DI resolution)
- Ne PAS tester uniquement le happy path — tester explicitement les cas d'erreur : block denied, file hidden, checkpoint contamine, _agentDone residuel
- Ne PAS oublier les tests de regression — verifier que les workflows existants (sans isolation) continuent a fonctionner. Un test avec un block inference (non-agent) qui utilise la session parent normalement
- Ne PAS creer des blocks de test complexes — les blocks de test doivent etre les plus simples possible (echo, set-variable). La complexite est dans le workflow, pas dans les blocks
- Ne PAS skipper les tests d'integration sous pretexte que les tests unitaires passent — les bugs les plus dangereux (checkpoint contamination, serialisation JSON, DI lifecycle) ne sont visibles qu'en integration

---

## Checkpoint

```markdown
## 59-T : Tests
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**Tests unitaires (C2)** : X nouveaux tests, tous passent
  - ProjectSessionChildTests : X/X pass
  - BlockPermissionEnforcementTests : X/X pass
  - BlockRefHandlerIsolationTests : X/X pass
  - CheckpointCleanupTests : X/X pass
**Tests integration (C5)** : X nouveaux tests, tous passent
  - AgentIsolationIntegrationTests : X/X pass
**Tests existants** : 0 regressions (total : X pass)
**E2E (C6)** : block-forge avec 2 agents isoles — [PASS/FAIL] + notes
**Total nouveaux tests** : ~35
```
