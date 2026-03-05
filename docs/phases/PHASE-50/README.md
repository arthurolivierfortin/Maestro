# Phase 50 : Contracts + Second Assistant + Fondations Adapt

**Statut** : A FAIRE
**Prerequis** : Phase 49 COMPLETE (hardware-aware setup, capabilities model, metrics)
**Objectif** : Introduire le concept de **contract** (le role qu'un block remplit) avec les **capabilities** qui determinent quelles fonctionnalites de ce role sont actives. Creer un deuxieme maestro-assistant qui implemente le meme contrat. Nettoyer adapt-optimize.
**Duree max** : 3 jours

---

## Concept cle : Contracts + Capabilities

### Le modele

```
Contract (le role)                    Block (l'implementation)
──────────────────                    ──────────────────────────
maestro-assistant                     maestro-assistant-claude
  "Agent who assists the user           contract: "maestro-assistant"
   inside maestro-code"                 capabilities: [conversation, orchestration,
                                          structured-output, long-context, tool-calling]
  Required capabilities:                fitness: 0.95
    - conversation (minimum)
                                      maestro-assistant-mistral7b
  Feature → capability mapping:         contract: "maestro-assistant"
    workspace-creation → orchestration  capabilities: [conversation, orchestration,
    json-config → structured-output       tool-calling]
    multi-step-plans → long-context     fitness: 0.82
    tool-execution → tool-calling       (pas de structured-output → json-config desactive)

                                      maestro-assistant-phi3
                                        contract: "maestro-assistant"
                                        capabilities: [conversation]
                                        fitness: 0.55
                                        (seulement conversation, tout le reste desactive)
```

### Les deux concepts sont complementaires

| Concept | Ce que c'est | Exemple |
|---------|-------------|---------|
| **Contract** | Le role que le block remplit | `maestro-assistant`, `agent-creator`, `code-reviewer` |
| **Capability** | Ce que le block sait faire concretement | `conversation`, `structured-output`, `tool-calling`, `long-context` |

**Un contract sans capabilities** = on sait que 3 blocks font "maestro-assistant" mais pas leurs differences.
**Des capabilities sans contract** = on sait qu'un block fait du "tool-calling" mais pas quel role il remplit.
**Les deux ensemble** = on sait quels blocks remplissent un role ET quelles fonctionnalites sont actives pour chacun.

### Feature gating par capabilities

Le contract definit un mapping `feature → capability requise`. Si un block implemente le contract mais n'a pas la capability, la feature est desactivee :

```json
{
  "contract": "maestro-assistant",
  "description": "Agent who assists the user inside maestro-code",
  "requiredCapabilities": ["conversation"],
  "features": {
    "workspace-creation": { "requires": ["orchestration"] },
    "json-config-generation": { "requires": ["structured-output"] },
    "multi-step-plans": { "requires": ["long-context", "orchestration"] },
    "tool-execution": { "requires": ["tool-calling"] },
    "foundry-management": { "requires": ["orchestration", "tool-calling"] }
  }
}
```

Un block qui implemente `maestro-assistant` avec seulement `[conversation, tool-calling]` :
- conversation : OUI
- workspace-creation : NON (manque orchestration)
- json-config-generation : NON (manque structured-output)
- tool-execution : OUI
- foundry-management : NON (manque orchestration)

L'utilisateur voit clairement ce qu'il peut et ne peut pas faire avec ce block.

---

## Ce qui existe deja

| Module | Etat | Localisation |
|--------|------|-------------|
| `capabilities` sur BlockDefinition | Phase 49 | `packages/maestro-client/src/types.ts` |
| `adapt-optimize.ts` | @ts-nocheck, CJS | `packages/maestro-cli/adapt-optimize.ts` |
| `FitnessService` + `POST /api/fitness/calculate` | Backend stable | `apps/backend/src/Maestro.Infrastructure/Fitness/` |
| `maestro-assistant` | Workflow cloud | `content/system/blocks/workflows/` |
| Hardware detection | Phase 49 | `packages/maestro-code/services/hardware-detect.ts` |
| Setup flow | Phase 49 | `packages/maestro-code/components/ProviderSetupScreen.ts` |

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 50-A | Concept contract (schema, BlockDefinition, service resolution) | 1 jour |
| 50-B | Nettoyage adapt-optimize + SDK fitness | 0.5-1 jour |
| 50-C | Second maestro-assistant + selection par contract au setup | 1-1.5 jours |

---

## 50-A : Concept contract

### But
Definir le concept de contract dans le systeme. Un contract est une definition de role avec des capabilities requises et un mapping feature → capability.

### Lecture obligatoire
- `packages/maestro-client/src/types.ts` (BlockDefinition actuel, capabilities)
- `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs` (entite C#)
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` (decouverte)
- `apps/backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs` (paths)

### Taches

1. **Ajouter `contract` a BlockDefinition** :
   - C# : `public string? Contract { get; set; }` dans `BlockDefinition.cs`
   - TypeScript SDK : `contract?: string` dans `types.ts`
   - Un block sans contract = block utilitaire (tool, helper), pas interchangeable

2. **Creer le schema de contract definition** :
   ```
   content/system/contracts/maestro-assistant.contract.json
   {
     "id": "maestro-assistant",
     "name": "Maestro Assistant",
     "description": "Agent who assists the user inside maestro-code",
     "requiredCapabilities": ["conversation"],
     "features": {
       "workspace-creation": {
         "description": "Create and manage workspaces",
         "requires": ["orchestration"]
       },
       "json-config": {
         "description": "Generate JSON configuration files",
         "requires": ["structured-output"]
       },
       "multi-step-plans": {
         "description": "Create and execute multi-step plans",
         "requires": ["long-context", "orchestration"]
       },
       "tool-execution": {
         "description": "Execute CLI tools and commands",
         "requires": ["tool-calling"]
       }
     }
   }
   ```

3. **Service de resolution** (`packages/maestro-code/services/contract-resolver.ts`) :
   - `getBlocksForContract(contractId)` → tous les blocks qui declarent ce contract
   - `getActiveFeatures(block, contract)` → features actives selon les capabilities du block
   - `getSelectedBlock(contractId)` → le block choisi par l'utilisateur pour ce contract
   - Config dans `~/.maestro/config.json` : `{ "contracts": { "maestro-assistant": "maestro-assistant-claude" } }`

4. **Backend : decouverte par contract** :
   - Ajouter `GetByContractAsync(string contract)` a `IBlockDiscoveryService`
   - Endpoint : `GET /api/blocks?contract=maestro-assistant`

5. **Ajouter `contract: "maestro-assistant"` au block existant** :
   - `maestro-assistant-workflow.block.json` → `"contract": "maestro-assistant"`

6. **Demo data** : contracts dans les blocks demo

7. **Tests** :
   - Test : getBlocksForContract retourne les blocks avec le bon contract
   - Test : getActiveFeatures avec toutes les capabilities → toutes les features
   - Test : getActiveFeatures avec capabilities partielles → features filtrees
   - Test : block sans contract → pas retourne par getBlocksForContract
   - Test : getSelectedBlock lit la config utilisateur

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
cd apps/backend && dotnet build
```

### Anti-patterns
- NE PAS faire du contract un block — c'est un schema/definition, pas une entite executable
- NE PAS imposer un contract a tous les blocks — c'est optionnel (les tools n'en ont pas)
- NE PAS over-engineer le schema — un JSON simple suffit, pas de versioning pour l'instant
- NE PAS confondre contract et capabilities — le contract est le role, les capabilities sont les competences

---

## 50-B : Nettoyage adapt-optimize + SDK fitness

### But
Rendre `adapt-optimize.ts` compilable et ajouter les types fitness au SDK.

### Lecture obligatoire
- `packages/maestro-cli/adapt-optimize.ts`
- `apps/backend/src/Maestro.Application/DTOs/FitnessDto.cs`
- `packages/maestro-client/src/types.ts`
- `packages/maestro-client/src/domains/llm.ts`

### Taches

1. **Retirer `@ts-nocheck` de `adapt-optimize.ts`** :
   - `require()` → imports ESM
   - Corriger les erreurs de type

2. **Types fitness dans le SDK** :
   - `FitnessScore`, `CalculateFitnessRequest`, `AdaptResult`, `SubstitutionResult`

3. **Domaine fitness** (`packages/maestro-client/src/domains/fitness.ts`) :
   - `calculate(request)` → `POST /api/fitness/calculate`

4. **CLI adapter** : `calculateFitness(request)`

### Verification
```bash
cd packages/maestro-cli && npx tsc --noEmit
cd packages/maestro-client && npx tsc --noEmit
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
```

---

## 50-C : Second maestro-assistant + selection par contract au setup

### But
Creer `maestro-assistant-light` qui implemente le meme contract avec moins de capabilities. Le setup flow montre les blocks disponibles pour le contract `maestro-assistant` et l'utilisateur choisit.

### Lecture obligatoire
- `content/system/blocks/workflows/maestro-assistant-workflow.block.json`
- `content/system/contracts/maestro-assistant.contract.json` (cree en 50-A)
- `packages/maestro-code/components/ProviderSetupScreen.ts`
- `packages/maestro-code/services/contract-resolver.ts` (cree en 50-A)

### Taches

1. **Creer `maestro-assistant-light`** :
   - `contract: "maestro-assistant"`
   - `capabilities: ["conversation", "tool-calling"]` (pas de structured-output, pas de long-context)
   - System prompt adapte pour modeles petits (plus court, instructions directes)
   - `metadata.hardwareProfile: { minVram: 0, recommendedVram: 3072, tier: "light" }`

2. **Mettre a jour le setup flow** :
   - Apres la config provider, appeler `getBlocksForContract("maestro-assistant")`
   - Afficher les blocks compatibles avec le hardware
   - Pour chaque block, montrer :
     - Nom, fitness, modele, tier
     - Capabilities (ce qu'il sait faire)
     - Features actives/inactives selon le contract
   - Suggerer le meilleur (recommended) mais l'utilisateur choisit
   - Sauvegarder le choix dans `~/.maestro/config.json`

3. **L'utilisateur comprend les tradeoffs** :
   ```
   maestro-assistant-claude [Recommended]
     Capabilities: conversation, orchestration, structured-output,
                   long-context, tool-calling
     Features: ALL ACTIVE (5/5)

   maestro-assistant-light
     Capabilities: conversation, tool-calling
     Features: 2/5 active
       ✓ conversation  ✓ tool-execution
       ✗ workspace-creation  ✗ json-config  ✗ multi-step-plans
   ```

4. **Demo data** : les deux assistants avec contracts dans DemoApiClient

5. **Tests** :
   - Test : setup flow affiche les blocks pour le contract
   - Test : features actives/inactives selon capabilities
   - Test : choix sauvegarde dans config
   - Test : le block selectionne est utilise au demarrage

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
cd packages/maestro-code && npm run test:visual
cd packages/maestro-code && node tests/real-demo-check.cjs
```

### Anti-patterns
- NE PAS hardcoder les IDs des assistants — filtrer par contract
- NE PAS cacher les features desactivees — les montrer en grise pour que l'utilisateur comprenne
- NE PAS bloquer si un assistant a peu de features — c'est le choix de l'utilisateur

---

## Definition of Done

- [ ] Champ `contract` sur BlockDefinition (C# + TypeScript)
- [ ] Schema contract definition (`maestro-assistant.contract.json`)
- [ ] Service de resolution par contract + feature gating
- [ ] `adapt-optimize.ts` compile sans `@ts-nocheck`
- [ ] SDK TypeScript a les types fitness
- [ ] `maestro-assistant-light` existe avec `contract: "maestro-assistant"`
- [ ] Le setup flow montre les blocks par contract avec features actives/inactives
- [ ] L'utilisateur choisit son assistant
- [ ] Tous les tests passent
- [ ] E2E dogfooding score >= 3.5/5

### NOT in scope
- `contractRef` dans les workflows (Phase 52)
- Agent Creator (Phase 51)
- UI Catalog par contract (Phase 54)
- Production de variantes (Phase 53)

---

## Validation finale (checklist Testing Protocol)

### Couche 1 — Type Check
- [ ] `npx tsc --noEmit` (maestro-code) : 0 errors
- [ ] `npx tsc --noEmit` (maestro-cli) : 0 errors
- [ ] `npx tsc --noEmit` (maestro-client) : 0 errors
- [ ] `dotnet build` (backend) : 0 errors

### Couche 2 — Tests unitaires
- Tests avant : 129 (maestro-code)
- Tests apres : __
- Tests crees : (lister)
- [ ] Tous les tests passent

### Couche 3 — Visual Gate
- [ ] `npm run test:visual` : assertions passent

### Couche 4 — Real Demo Check
- [ ] `node tests/real-demo-check.cjs` : PASS

### Couche 5 — Integration
- [ ] `GET /api/blocks?contract=maestro-assistant` retourne les bons blocks

### Couche 6 — E2E Dogfooding
- [ ] Score >= 3.5/5
- [ ] Setup flow teste avec choix d'assistant par contract
- [ ] Features actives/inactives visibles
