# Phase 55-T : Tests

**Statut** : A FAIRE
**Effort estime** : 0.5 jour
**Prerequis** : Phase 55-A, 55-B, 55-C COMPLETE

---

## Objectif

Couvrir toutes les fonctionnalites ajoutees dans Phase 55 avec des tests a chaque couche applicable du Testing Protocol (`docs/system/TESTING-PROTOCOL.md`).

---

## Couches applicables

| Couche | Applicable | Justification |
|--------|:----------:|---------------|
| C1 — Type Check | **OUI** | Backend C# + SDK TypeScript + CLI TypeScript modifies |
| C2 — Tests unitaires | **OUI** | Nouveau service backend (BlockDependencyService), refactoring CLI |
| C3 — Visual Gate | NON | Pas de modification TUI dans cette phase |
| C4 — Real Demo Check | NON | Pas de modification TUI dans cette phase |
| C5 — Tests d'integration | **OUI** | 4 nouveaux endpoints API + SDK enrichi |
| C6 — E2E Dogfooding | NON | Pas de changement UX — infrastructure seulement |

---

## Lecture obligatoire

- `docs/system/TESTING-PROTOCOL.md` — le protocole complet, checklist de fin de phase
- `apps/backend/tests/Maestro.Execution.Tests/` — pattern de tests unitaires backend existant
- `packages/maestro-integration-tests/tests/level-1-api/blocks.test.ts` — pattern de tests d'integration API
- `packages/maestro-integration-tests/src/test-harness.ts` — le test harness (getTestClient)

---

## Couche 1 : Type Check

### Actions

Verifier que tout compile sans erreurs :

```bash
# Backend
cd apps/backend && dotnet build              # 0 errors

# SDK
cd packages/maestro-client && npx tsc --noEmit   # 0 errors

# CLI
cd packages/maestro-cli && npx tsc --noEmit       # 0 errors
```

Aucun `@ts-nocheck` autorise. Aucun `// @ts-ignore` sauf avec justification commentee.

---

## Couche 2 : Tests unitaires backend

### Fichier

`apps/backend/tests/Maestro.Infrastructure.Tests/BlockDependencyServiceTests.cs` — **NOUVEAU**

### Scenarios a tester

#### 2.1 — GetManifestAsync : block atomique

```
Input : block atomique (isAtomic=true, pas de config.nodes)
Attendu : BlockManifest avec Children = [], IsAtomic = true
```

#### 2.2 — GetManifestAsync : block composite simple

```
Input : block avec config.nodes = [{ blockRef: "block-a" }, { blockRef: "block-b" }]
Mock : block-a atomique, block-b atomique
Attendu : BlockManifest avec 2 children, chacun IsAtomic = true
```

#### 2.3 — GetManifestAsync : extraction modele

```
Input : block avec config.model = "claude-sonnet-4-6",
        config.nodes = [{ blockRef: "child", config: { model: "claude-haiku-4-5" } }]
Attendu : root.Model = "claude-sonnet-4-6", children[0].Model = "claude-haiku-4-5"
```

#### 2.4 — GetManifestAsync : deep nesting (while/conditional/for-each)

```
Input : block avec config.nodes = [
  { type: "conditional", then: { nodes: [{ blockRef: "then-block" }] }, else: { nodes: [{ blockRef: "else-block" }] } },
  { type: "for-each", nodes: [{ blockRef: "loop-block" }] },
  { type: "while", nodes: [{ blockRef: "while-block" }] }
]
Attendu : 4 children resolus (then-block, else-block, loop-block, while-block)
```

#### 2.5 — GetManifestAsync : detection de cycles

```
Input : block-a reference block-b, block-b reference block-a
Attendu : Pas d'exception (boucle infinie), manifest avec 1 child pour block-a (block-b), 0 pour block-b (cycle detecte)
```

#### 2.6 — GetManifestAsync : blockRef non resolu

```
Input : block avec config.nodes = [{ blockRef: "inexistant" }]
Mock : GetByIdAsync("inexistant") retourne null
Attendu : child avec BlockType = "unresolved", pas d'exception
```

#### 2.7 — GetRequiredModelsAsync : carte aplatie

```
Input : arbre avec 3 blocks, 2 modeles distincts
Attendu : Dictionary avec 2 entries, chacune avec les bons blockIds
```

#### 2.8 — GetRequiredModelsAsync : planningModel inclus

```
Input : block avec model = "sonnet" et planningModel = "opus"
Attendu : les 2 modeles apparaissent dans la carte
```

#### 2.9 — ValidateAsync : tout valide

```
Input : block avec tous les blockRefs resolus
Attendu : IsValid = true, MissingBlocks = [], CircularReferences = []
```

#### 2.10 — ValidateAsync : dependances manquantes

```
Input : block avec 1 blockRef resolu et 1 non resolu
Attendu : IsValid = false, MissingBlocks contient 1 entry avec le bon BlockRef, ReferencedBy, NodeId
```

#### 2.11 — ValidateAsync : references circulaires

```
Input : block-a → block-b → block-a
Attendu : IsValid = false, CircularReferences contient l'indication du cycle
```

#### 2.12 — GetDependentsAsync : reverse lookup

```
Input : 3 blocks dont 2 referencent block-x
Attendu : ["block-a", "block-b"] (les 2 qui referencent block-x)
```

### Pattern de test

```csharp
public class BlockDependencyServiceTests
{
    private readonly Mock<IFileSystemBlockDiscoveryService> _discoveryMock;
    private readonly BlockDependencyService _service;

    public BlockDependencyServiceTests()
    {
        _discoveryMock = new Mock<IFileSystemBlockDiscoveryService>();
        _service = new BlockDependencyService(_discoveryMock.Object, NullLogger<BlockDependencyService>.Instance);
    }

    [Fact]
    public async Task GetManifestAsync_AtomicBlock_ReturnsEmptyChildren()
    {
        // Arrange
        var block = new BlockDefinition { Id = "test", BlockType = "inference", IsAtomic = true };
        _discoveryMock.Setup(d => d.GetByIdAsync("test", null)).ReturnsAsync(block);

        // Act
        var manifest = await _service.GetManifestAsync("test");

        // Assert
        Assert.Empty(manifest.Children);
        Assert.True(manifest.IsAtomic);
    }
}
```

---

## Couche 5 : Tests d'integration API

### Fichier

`packages/maestro-integration-tests/tests/level-1-api/block-manifest.test.ts` — **NOUVEAU**

### Scenarios a tester

#### 5.1 — GET /api/blocks/{id}/manifest : block composite

```typescript
it('returns manifest with children for composite block', async () => {
  const client = getTestClient();
  const manifest = await client.blocks.manifest('maestro-assistant');

  expect(manifest.blockId).toBe('maestro-assistant');
  expect(manifest.children.length).toBeGreaterThan(0);
  expect(manifest.isAtomic).toBe(false);
});
```

#### 5.2 — GET /api/blocks/{id}/manifest : block atomique

```typescript
it('returns empty children for atomic block', async () => {
  const client = getTestClient();
  // Trouver un block atomique (inference, tool)
  const blocks = await client.blocks.list({ type: 'inference' });
  const atomicId = blocks[0]?.id;

  const manifest = await client.blocks.manifest(atomicId);

  expect(manifest.isAtomic).toBe(true);
  expect(manifest.children).toHaveLength(0);
});
```

#### 5.3 — GET /api/blocks/{id}/manifest : modele present

```typescript
it('includes model info in manifest', async () => {
  const client = getTestClient();
  const manifest = await client.blocks.manifest('maestro-assistant');

  // Le block ou un de ses children doit avoir un modele
  function hasModel(m: BlockManifest): boolean {
    return m.model !== null || m.children.some(hasModel);
  }
  expect(hasModel(manifest)).toBe(true);
});
```

#### 5.4 — GET /api/blocks/{id}/manifest/models : carte modeles

```typescript
it('returns model requirements map', async () => {
  const client = getTestClient();
  const models = await client.blocks.manifestModels('maestro-assistant');

  expect(Array.isArray(models)).toBe(true);
  expect(models.length).toBeGreaterThan(0);
  expect(models[0]).toHaveProperty('model');
  expect(models[0]).toHaveProperty('blockIds');
});
```

#### 5.5 — GET /api/blocks/{id}/manifest/validate : block valide

```typescript
it('validates all dependencies for known block', async () => {
  const client = getTestClient();
  const result = await client.blocks.validate('maestro-assistant');

  expect(result.isValid).toBe(true);
  expect(result.missingBlocks).toHaveLength(0);
});
```

#### 5.6 — GET /api/blocks/{id}/manifest : block inexistant → 404

```typescript
it('returns 404 for non-existent block', async () => {
  const client = getTestClient();

  await expect(client.blocks.manifest('non-existent-block-xyz'))
    .rejects.toThrow(); // 404
});
```

#### 5.7 — GET /api/blocks/{id}/children : enrichi avec model

```typescript
it('children endpoint includes model field', async () => {
  const client = getTestClient();
  const response = await fetch(`${BASE_URL}/api/blocks/maestro-assistant/children?recursive=true`);
  const data = await response.json();

  // Au moins un child doit avoir model non-null
  function findModel(children: any[]): boolean {
    return children.some(c => c.model || (c.children && findModel(c.children)));
  }
  expect(findModel(data.children)).toBe(true);
});
```

---

## Fichiers a creer

| Fichier | Type | Tests |
|---------|------|-------|
| `apps/backend/tests/Maestro.Infrastructure.Tests/BlockDependencyServiceTests.cs` | **NOUVEAU** | 12 tests unitaires |
| `packages/maestro-integration-tests/tests/level-1-api/block-manifest.test.ts` | **NOUVEAU** | 7 tests d'integration |

---

## Verification

```bash
# Couche 1 — Type Check
cd apps/backend && dotnet build              # 0 errors
cd packages/maestro-client && npx tsc --noEmit
cd packages/maestro-cli && npx tsc --noEmit

# Couche 2 — Tests unitaires backend
cd apps/backend && dotnet test               # tous passent, incluant les 12 nouveaux

# Couche 5 — Tests d'integration (services demarres)
cd packages/maestro-integration-tests && npm test
# Les 7 nouveaux tests passent
```

---

## Anti-patterns

- Ne PAS mocker le service dans les tests d'integration — les tests d'integration testent le vrai backend avec le vrai service. Seuls les tests unitaires utilisent des mocks
- Ne PAS tester seulement le happy path — les cas d'erreur (block inexistant, cycle, blockRef non resolu) sont les plus importants
- Ne PAS creer des blocks de test dans le filesystem pour les tests unitaires — utiliser des mocks de `IFileSystemBlockDiscoveryService`. Pour les tests d'integration, utiliser les blocks systeme existants (maestro-assistant, etc.)
- Ne PAS oublier de tester le deep nesting — c'est exactement le bug qui existait dans l'ancien `GetBlockChildrenAsync()`. Si le test ne couvre pas while/conditional/for-each, il ne valide rien

---

## Checkpoint

```markdown
## 55-T : Tests
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD

### Couche 1 — Type Check
- [ ] `dotnet build` : 0 errors
- [ ] `npx tsc --noEmit` maestro-client : 0 errors
- [ ] `npx tsc --noEmit` maestro-cli : 0 errors

### Couche 2 — Tests unitaires
- Tests avant : __
- Tests apres : __
- Tests crees :
  - BlockDependencyServiceTests (12 tests) :
    - GetManifestAsync_AtomicBlock_ReturnsEmptyChildren
    - GetManifestAsync_CompositeBlock_ResolvesChildren
    - GetManifestAsync_ExtractsModelFromConfig
    - GetManifestAsync_DeepNesting_ConditionalWhileForEach
    - GetManifestAsync_DetectsCycles
    - GetManifestAsync_UnresolvedBlockRef_ReturnsUnresolved
    - GetRequiredModelsAsync_FlattensCorrectly
    - GetRequiredModelsAsync_IncludesPlanningModel
    - ValidateAsync_AllResolved_ReturnsValid
    - ValidateAsync_MissingDeps_ReturnsInvalid
    - ValidateAsync_CircularRefs_ReturnsInvalid
    - GetDependentsAsync_FindsReferencingBlocks
- [ ] Tous les tests passent : __/__ (output colle)

### Couche 5 — Tests d'integration
- Tests crees :
  - block-manifest.test.ts (7 tests) :
    - returns manifest with children for composite block
    - returns empty children for atomic block
    - includes model info in manifest
    - returns model requirements map
    - validates all dependencies for known block
    - returns 404 for non-existent block
    - children endpoint includes model field
- [ ] Tous les tests passent : __/__ (output colle)
```
