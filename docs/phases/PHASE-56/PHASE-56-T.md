# Phase 56-T : Tests

**Statut** : DONE (2026-03-06)
**Effort estime** : 0.5 jour
**Prerequis** : Phase 56-A, 56-B, 56-C COMPLETE

---

## Objectif

Couvrir les fonctionnalites ajoutees dans Phase 56 avec des tests a chaque couche applicable.

---

## Couches applicables

| Couche | Applicable | Justification |
|--------|:----------:|---------------|
| C1 — Type Check | **OUI** | Backend C# + LLM-Provider + SDK TS + CLI TS + TUI TS |
| C2 — Tests unitaires | **OUI** | ModelPricingService, cost accumulation, ContractTestRunner |
| C3 — Visual Gate | **OUI** | CatalogScreen modifie ([T] test, breakdown display) |
| C4 — Real Demo Check | **OUI** | CatalogScreen modifie |
| C5 — Tests d'integration | **OUI** | SDK contracts domain, contract test endpoint |
| C6 — E2E Dogfooding | NON | Couvert par 56-C Tache 5 (validation E2E manuelle) |

---

## Couche 1 : Type Check

```bash
cd apps/backend && dotnet build                    # 0 errors
cd llm-provider/dotnet && dotnet build             # 0 errors
cd packages/maestro-client && npx tsc --noEmit     # 0 new errors
cd packages/maestro-cli && npx tsc --noEmit        # 0 new errors
cd packages/maestro-code && npx tsc --noEmit       # 0 new errors
```

---

## Couche 2 : Tests unitaires backend

### Fichier

`apps/backend/tests/Maestro.Infrastructure.Tests/ModelPricingServiceTests.cs` — **NOUVEAU**

### Scenarios

#### 2.1 — GetPricingAsync retourne les prix du cache
```
Input : modelId = "claude-sonnet-4-6"
Setup : Mock ILLMProviderService retourne CompatibleModel avec InputTokenPricePerMillion=3, OutputTokenPricePerMillion=15
Attendu : ModelPricing(3, 15, ~70)
```

#### 2.2 — GetPricingAsync retourne null pour modele inconnu
```
Input : modelId = "unknown-model"
Setup : Mock retourne liste vide
Attendu : null (pas d'exception)
```

#### 2.3 — EstimateCostAsync calcule correctement
```
Input : modelId = "claude-sonnet-4-6", 1000 prompt tokens, 500 completion tokens
Setup : Prix = $3/$15 per million
Attendu : (1000 * 3 / 1_000_000) + (500 * 15 / 1_000_000) = $0.0105
```

#### 2.4 — EstimateCostAsync avec modele local retourne 0
```
Input : modelId = "llama-3-8b" (local, prix = 0)
Attendu : $0.00
```

#### 2.5 — Cache est utilise (pas de re-fetch)
```
Setup : Premier appel fetch les modeles, deuxieme appel utilise le cache
Verify : GetCompatibleModelsAsync appele 1 seule fois
```

### Tests existants a verifier

- `ContractTestRunner` tests existants doivent toujours passer avec les nouvelles injections DI
- `BlockDependencyServiceTests` (Phase 55) non impactes

---

## Couche 2 bis : Tests unitaires TUI

### Fichier

`packages/maestro-code/tests/CatalogContractTest.test.ts` — **NOUVEAU** (defini dans 56-C)

### Scenarios

- Block sans contract : [T] → message "No contract"
- Block avec contract : [T] → appel API mock → affichage resultat
- API error : [T] → erreur → message inline
- Resultat affiche : fitness, features, cout presents dans le rendu

---

## Couche 3 : Visual Gate

```bash
cd packages/maestro-code && npm run test:visual
```

Si les golden files changent (CatalogScreen modifie), mettre a jour avec `--update`.

---

## Couche 4 : Real Demo Check

```bash
cd packages/maestro-code && node tests/real-demo-check.cjs
```

Le TUI doit se lancer sans crash apres les modifications du CatalogScreen.

---

## Couche 5 : Tests d'integration

### Fichier

`packages/maestro-integration-tests/tests/level-1-api/contract-test.test.ts` — **NOUVEAU**

### Scenarios

#### 5.1 — GET /api/contracts retourne la liste
```typescript
it('returns list of contracts', async () => {
  const client = getTestClient();
  const contracts = await client.contracts.list();
  expect(Array.isArray(contracts)).toBe(true);
  expect(contracts.length).toBeGreaterThan(0);
});
```

#### 5.2 — GET /api/contracts/:id retourne un contract
```typescript
it('returns contract by id', async () => {
  const client = getTestClient();
  const contract = await client.contracts.get('maestro-assistant');
  expect(contract.id).toBe('maestro-assistant');
  expect(contract.features).toBeDefined();
});
```

#### 5.3 — POST /api/contracts/:id/test execute un test (structure)
```typescript
// Note : ce test est LONG (30-60s) — le marquer slow
it('executes contract test and returns result with costs', async () => {
  const client = getTestClient();
  const result = await client.contracts.test('maestro-assistant', 'system:maestro-assistant');
  expect(result.fitness).toBeGreaterThan(0);
  expect(result.estimatedCostUsd).toBeGreaterThan(0);
  expect(result.totalTests).toBeGreaterThan(0);
  expect(result.features.length).toBeGreaterThan(0);
}, 120_000);
```

#### 5.4 — Provider models incluent les prix
```typescript
it('provider models include pricing info', async () => {
  const response = await fetch('http://localhost:5000/api/provider/models');
  const data = await response.json();
  // Au moins un modele cloud doit avoir des prix
  const withPricing = data.models?.filter((m: any) => m.inputTokenPricePerMillion != null);
  expect(withPricing.length).toBeGreaterThan(0);
});
```

---

## Verification globale 56-T

```bash
# C1
cd apps/backend && dotnet build
cd llm-provider/dotnet && dotnet build
cd packages/maestro-client && npx tsc --noEmit
cd packages/maestro-cli && npx tsc --noEmit
cd packages/maestro-code && npx tsc --noEmit

# C2 backend
cd apps/backend && dotnet test tests/Maestro.Infrastructure.Tests/ --filter "ModelPricingService"

# C2 TUI
cd packages/maestro-code && npx vitest run tests/CatalogContractTest.test.ts

# C3
cd packages/maestro-code && npm run test:visual

# C4
cd packages/maestro-code && node tests/real-demo-check.cjs

# C5 (services demarres)
cd packages/maestro-integration-tests && npm test
```

---

## Anti-patterns

- Ne PAS mocker le pricing service dans les tests d'integration — tester la vraie chaine
- Ne PAS creer un test d'integration pour le contract test complet sans timeout eleve (30-60s par test)
- Ne PAS oublier de tester le fallback (modele inconnu → prix par defaut)

---

## Checkpoint

```markdown
## 56-T : Tests
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD

### Couche 1 — Type Check
- [ ] `dotnet build` backend : 0 errors
- [ ] `dotnet build` LLM-Provider : 0 errors
- [ ] `npx tsc --noEmit` maestro-client : 0 new errors
- [ ] `npx tsc --noEmit` maestro-cli : 0 new errors
- [ ] `npx tsc --noEmit` maestro-code : 0 new errors

### Couche 2 — Tests unitaires
- ModelPricingServiceTests : __/5 pass
- CatalogContractTest : __/4 pass

### Couche 3 — Visual Gate
- [ ] `npm run test:visual` : pass

### Couche 4 — Real Demo Check
- [ ] `real-demo-check.cjs` : TUI se lance

### Couche 5 — Tests d'integration
- contract-test.test.ts : __/4 pass
```
