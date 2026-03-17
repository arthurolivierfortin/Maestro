# 61-T : Tests + Verification Finale

**Effort** : 0.5 jour
**Prerequis** : 61-A, 61-B, 61-C COMPLETES
**Critere de passage** : 6 couches de tests passent, 0 regression

---

## Lecture obligatoire

- `docs/system/TESTING-PROTOCOL.md` — les 6 couches de tests obligatoires
- `apps/backend/tests/Maestro.Infrastructure.Tests/` — tests backend existants
- `packages/maestro-code/tests/` — tests TUI existants

---

## Couches applicables

| Couche | Applicable | Justification |
|--------|-----------|---------------|
| C1 — Type Check | OUI | Toujours obligatoire |
| C2 — Tests unitaires | OUI | maxIterations injection, loop detection, cost propagation |
| C3 — Visual Gate (PTY) | NON | Pas de modifications TUI dans cette phase |
| C4 — Real Demo Check | NON | Pas de modifications TUI dans cette phase |
| C5 — Tests d'integration | OUI | Backend modifie (MultiNodeBlockExecutor, NodeExecutionEngine) |
| C6 — E2E | OUI | Block-forge lance, execute, s'arrete proprement |

**Note** : C3 et C4 ne sont pas applicables car Phase 61 ne touche pas le TUI. La live execution view est en Phase 62-C.

---

## Tests unitaires a creer (C2)

### 1. maxIterations injection (C# backend)

Fichier : `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/MultiNodeBlockExecutorTests.cs`

```csharp
[Fact]
public async Task ExecuteConfigNodesAsync_InjectsMaxIterationsFromConfig()
{
    // Arrange: block with config.maxIterations = 12, session without maxIterations
    // Act: call ExecuteConfigNodesAsync
    // Assert: session.GetVariable("maxIterations") == "12"
}

[Fact]
public async Task ExecuteConfigNodesAsync_DoesNotOverrideExistingMaxIterations()
{
    // Arrange: session already has maxIterations = 8
    // Act: call ExecuteConfigNodesAsync with block config.maxIterations = 12
    // Assert: session.GetVariable("maxIterations") == "8"
}

[Fact]
public async Task PreFlightCheck_ThrowsWhenMaxIterationsUnresolved()
{
    // Arrange: block with maxIterations = "{{unresolved}}", no session variable
    // Act + Assert: throws InvalidOperationException with "Pre-flight FAILED"
}
```

### 2. Loop detection (C# backend)

Fichier : `apps/backend/tests/Maestro.Infrastructure.Tests/Sessions/LoopDetectionTests.cs`

```csharp
[Fact]
public void LoopDetection_StopsAfter5IdenticalToolCalls()
{
    // Simulate 5 consecutive identical tool calls
    // Assert: _agentDone = true after 5th
}

[Fact]
public void LoopDetection_WarnsAfter3IdenticalToolCalls()
{
    // Simulate 3 consecutive identical tool calls
    // Assert: warning in execution log
}

[Fact]
public void LoopDetection_DoesNotTriggerForMixedCalls()
{
    // Simulate alternating tool calls (read, write, read, test, read)
    // Assert: no warning, no stop
}

[Fact]
public void LoopDetection_ExcludesStepComplete()
{
    // Simulate 5 consecutive step-complete calls
    // Assert: no stop (step-complete is excluded)
}
```

### 3. Cost propagation (C# backend)

Fichier : `apps/backend/tests/Maestro.Infrastructure.Tests/Sessions/NodeHandlers/BlockRefHandlerCostTests.cs`

```csharp
[Fact]
public async Task AccumulateCosts_PropagatesChildCostsToParent()
{
    // Arrange: child session with _accumulatedCost = 0.05
    // Act: after agent execution in child session
    // Assert: parent _accumulatedCost includes child costs
}
```

---

## Test d'integration (C5)

### Block-forge minimal E2E

```bash
# 1. Services demares (prerequis)
curl http://localhost:5000/ && curl http://localhost:5010/api/v1/health/

# 2. Creer une session block-forge
cd C:\Meastro\packages\maestro-cli
node index.js session create --type project --name "61-T Integration" --template block-forge --repo C:\Meastro --start

# 3. Invoquer avec un contract simple
node index.js session invoke <id> default --input description="A simple echo agent" --input contractId="code-reviewer"

# 4. Verifier (apres quelques iterations ou completion) :
curl http://localhost:5000/api/sessions/<id>

# Criteres :
# - maxIterations log montre 12 (pas 50)
# - _accumulatedCost > $0
# - Workflow complete OU loop detection a stoppe l'agent OU pre-flight a bloque
# - _executionLog contient des entries structurees
# - Pas de crash ou d'exception non geree
```

### Test minimal sans workflow complet

Si le block-forge complet prend trop de temps :

```bash
# Lancer seulement l'agent-creator avec 1 input minimal
node index.js session create --type project --name "61-T Agent Test" --repo C:\Meastro --start
# Set les variables manuellement et invoquer un agent directement via curl
```

---

## E2E (C6) — 1 execution complete

Lancer block-forge via le TUI ou CLI et observer :
1. Pre-flight log avec estimation de cout
2. maxIterations = 12 dans les logs
3. L'agent execute des tool calls (file-read, file-write, contract-test)
4. Si l'agent boucle → loop detection l'arrete
5. Couts visibles sur la session parent

**Critere** : Au moins 1 execution qui demontre que l'infrastructure fonctionne (meme si le resultat n'est pas parfait — la qualite des agents est le travail de Phase 62).

---

## Verification finale

```bash
# C1 — Type Check
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# Resultat : 0 erreurs

# C2 — Tests unitaires backend
dotnet test C:\Meastro\apps\backend\tests\Maestro.Infrastructure.Tests\Maestro.Infrastructure.Tests.csproj
# Resultat : tous passent, X nouveaux

# C2 — Tests unitaires TUI (pas de nouveaux, mais 0 regressions)
cd C:\Meastro\packages\maestro-code && npx vitest run
# Resultat : tous passent

# C5 — Integration
# (voir section ci-dessus)

# C6 — E2E
# (voir section ci-dessus)
```

---

## Anti-patterns

- Ne PAS ecrire des tests qui mockent TOUT — les tests d'integration doivent verifier le flow reel
- Ne PAS sauter le test E2E (C6) — les tests unitaires ne suffisent pas
- Ne PAS considerer la phase comme DONE si les tests existants ont des regressions
- Ne PAS tester la loop detection avec de vrais appels LLM dans les tests unitaires — utiliser des mocks

---

## Checkpoint

```markdown
## 61-T : Tests + Verification Finale
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**C1 — Type Check** : PASS (0 erreurs backend + 0 erreurs TS)
**C2 — Tests unitaires** : X nouveaux, tous passent
  - maxIterations: X tests
  - loop detection: X tests
  - cost propagation: X tests
  - pre-flight bloquant: X tests
**C5 — Integration** : block-forge lance, maxIter=12, cost>$0
**C6 — E2E** : 1 execution complete
**Regressions** : 0
**Tests totaux ajoutes** : X
```
