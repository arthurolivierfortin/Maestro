# Phase 56-B : SDK + CLI + LLM-Provider enrichissement

**Statut** : DONE (2026-03-06)
**Effort estime** : 0.5 jour (fondations SDK/CLI existent deja)
**Prerequis** : Phase 56-A COMPLETE

---

## Objectif

Exposer le contract test via SDK et CLI. Enrichir LLM-Provider avec `ParametersBillions`. L'utilisateur peut lancer un contract test et voir les resultats depuis la ligne de commande.

---

## Etat actuel — Ce qui existe deja

| Composant | Existant | Manquant |
|-----------|----------|---------|
| SDK `client.fitness.*` | `calculate()`, `history()`, `stats()`, `leaderboard()`, `config()` | Rien |
| SDK `client.testing.*` | `listRuns()`, `createRun()`, `evaluate()`, `compare()` | Rien |
| SDK `client.contracts.*` | **N'existe pas** | `list()`, `get()`, `test()` |
| CLI `maestro test` | `start`, `runs`, `evaluate`, `compare` | Rien |
| CLI `maestro contract` | **N'existe pas** | `list`, `test` |
| SDK types | `FitnessScore`, `FitnessBreakdown`, `FitnessConfig` | `ContractTestResult`, `FeatureTestResult` |

---

## Tache 1 : LLM-Provider — ajouter ParametersBillions

### Contexte

Le champ `ParametersBillions` est utilise par `ModelProfile.ComputeCost` (= `log10(params * 1e9) * (FLOPs/1e9)`). Sans lui, `CreateGeneric()` assume 100B pour tous les modeles cloud, ce qui donne un compute cost identique pour Haiku et Opus.

### Fichiers

| Fichier | Modification |
|---------|-------------|
| `llm-provider/dotnet/src/LLMProvider.Domain/Entities/ModelInfo.cs` | Ajouter `ParametersBillions` (double?) |
| `llm-provider/dotnet/src/LLMProvider.Web/Endpoints/ModelsEndpoints.cs` | Mapper dans `ModelResponse` |
| `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` | Remplir pour les modeles configures |

### Valeurs connues

| Modele | ParametersBillions | Source |
|--------|--------------------|--------|
| Claude Opus | ~200 (estime) | Public estimates |
| Claude Sonnet | ~70 (estime) | Public estimates |
| Claude Haiku | ~20 (estime) | Public estimates |
| GPT-4 | ~1760 (estime, MoE) | Public estimates |
| GPT-4o | ~200 (estime) | Public estimates |
| Llama 3 8B | 8 | Official |
| Llama 3 70B | 70 | Official |
| Mistral 7B | 7 | Official |
| Qwen 2.5 1.5B | 1.5 | Official |

Le champ est **optionnel** (nullable). Les modeles sans cette info retournent null → le backend utilise un fallback raisonnable.

### Verification
```bash
curl http://localhost:5010/api/v1/models/ | jq '.models[] | {id, parametersBillions}'
```

---

## Tache 2 : SDK — ajouter domaine contracts

### Fichiers

| Fichier | Modification |
|---------|-------------|
| `packages/maestro-client/src/types.ts` | Ajouter types `ContractTestResult`, `FeatureTestResult`, `SingleTestResult`, `Contract` |
| `packages/maestro-client/src/domains/contracts.ts` | **NOUVEAU** — domaine contracts |
| `packages/maestro-client/src/client.ts` | Enregistrer domaine contracts |

### Types a ajouter

```typescript
// types.ts

export interface Contract {
  id: string;
  name: string;
  version: string;
  description: string;
  requiredCapabilities: string[];
  minimumFitness: number;
  features: Record<string, ContractFeature>;
}

export interface ContractFeature {
  description: string;
  requires: string[];
  weight: number;
  minimumScore: number;
  tests: ContractTest[];
}

export interface ContractTest {
  id: string;
  description: string;
  prompt?: string;
  turns?: { prompt: string; check?: any }[];
  check?: any;
}

export interface ContractTestResult {
  contractId: string;
  contractVersion: string;
  blockId: string;
  fitness: number;
  performanceScore: number;
  fitnessBreakdown: FitnessBreakdown | null;
  passed: boolean;
  meetsRequiredCapabilities: boolean;
  features: FeatureTestResult[];
  testResults: SingleTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  estimatedCostUsd: number;
  failureReasons: string[];
}

export interface FeatureTestResult {
  featureId: string;
  description: string;
  active: boolean;
  score: number;
  weight: number;
  minimumScore: number;
  meetsThreshold: boolean;
  testsPassed: number;
  testsTotal: number;
}

export interface SingleTestResult {
  testId: string;
  featureId: string;
  description: string | null;
  passed: boolean;
  skipped: boolean;
  checkType: string | null;
  response: string | null;
  failureReason: string | null;
  durationMs: number;
}
```

### Domaine contracts

```typescript
// domains/contracts.ts
export function createContractsDomain(http: HttpClient) {
  return {
    list: () => http.get<Contract[]>('/api/contracts'),
    get: (id: string) => http.get<Contract>(`/api/contracts/${id}`),
    test: (contractId: string, blockId: string) =>
      http.post<ContractTestResult>(`/api/contracts/${contractId}/test?blockId=${encodeURIComponent(blockId)}`),
  };
}
```

### Verification
```bash
cd packages/maestro-client && npx tsc --noEmit  # 0 errors
```

---

## Tache 3 : CLI — ajouter commande `contract`

### Fichiers

| Fichier | Modification |
|---------|-------------|
| `packages/maestro-cli/cli.ts` | Ajouter sous-commande `contract` |
| `packages/maestro-cli/api-client.ts` | Ajouter wrappers contracts |

### Commandes

#### `maestro contract list`
```
Contracts:
  maestro-assistant  v2.0.0  4 features, 24 tests
  test-designer      v1.0.0  3 features, 12 tests
  agent-creator      v1.0.0  4 features, 15 tests
  block-forge        v1.0.0  3 features, 10 tests
```

#### `maestro contract test <contractId> --block <blockId>`
```
Testing maestro-assistant against system:maestro-assistant...

Features:
  conversation     7/7   [████████████] 100%  PASS
  maestro-ops      7/7   [████████████] 100%  PASS
  orchestration    5/5   [████████████] 100%  PASS
  memory           5/5   [████████████] 100%  PASS

Results: 24/24 tests passed
Performance: 0.95
Fitness:     0.15  (Claude is expensive)
Cost:        $0.42
Duration:    45.2s

Breakdown:
  P (Performance):     0.95
  S (Specialization):  0.48
  W (Composability):   1.00
  C_norm (Economic):   2.30
  C_compute:          11.00
  C_hw (Hardware):     1.00
  Lambda:              0.30
```

#### `maestro contract test <contractId> --block <blockId> --json`
Retourne le JSON brut de `ContractTestResult`.

### Implementation

La commande est longue (le test peut prendre 30-60s) → afficher un spinner/progress pendant l'execution. Utiliser un timer simple avec `setInterval` pour afficher des dots.

### Verification
```bash
cd packages/maestro-cli && npx tsc --noEmit
node index.js contract list
node index.js contract test maestro-assistant --block system:maestro-assistant --json | jq '.fitness'
```

---

## Verification globale 56-B

```bash
# TypeScript
cd packages/maestro-client && npx tsc --noEmit    # 0 errors
cd packages/maestro-cli && npx tsc --noEmit        # 0 errors

# LLM-Provider
cd llm-provider/dotnet && dotnet build              # 0 errors

# Fonctionnel (services demarres)
node packages/maestro-cli/index.js contract list
node packages/maestro-cli/index.js contract test maestro-assistant --block system:maestro-assistant
```

---

## Definition of Done 56-B

- [ ] LLM-Provider `ModelResponse` inclut `parametersBillions` pour les modeles connus
- [ ] SDK `client.contracts.list()`, `.get()`, `.test()` fonctionnent
- [ ] Types `ContractTestResult`, `FeatureTestResult`, `SingleTestResult` dans le SDK
- [ ] CLI `maestro contract list` affiche les contracts avec nombre de features/tests
- [ ] CLI `maestro contract test` affiche features, score, fitness, cout, breakdown
- [ ] `npx tsc --noEmit` passe sur maestro-client et maestro-cli
- [ ] `dotnet build` passe sur LLM-Provider
