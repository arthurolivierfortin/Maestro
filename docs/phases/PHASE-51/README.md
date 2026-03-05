# Phase 51 : Agent Creator — Logique de creation, contract testable, fondation /adapt

**Statut** : A FAIRE
**Prerequis** : Phase 50 COMPLETE (contracts, capabilities, feature gating, AssistantSelector)
**Objectif** : Creer la **logique de creation d'agents** sous forme de fichier executable et testable. Definir le contract `agent-creator` avec des acceptance tests par capability. Fournir la fondation directe pour `/adapt`.
**Duree estimee** : 5-7 jours

---

## Analyse profonde : Pourquoi cette phase est critique

### Le probleme fondamental

Aujourd'hui, creer un agent Maestro requiert :
1. Ecrire manuellement un `.block.json` (20+ champs, conventions specifiques)
2. Ecrire un `system-prompt.md` (format strict : JSON only, one tool call, step-complete)
3. Declarer le bon contract + capabilities
4. Tester manuellement dans une foundry session
5. Mesurer le fitness
6. Publier

C'est un processus **fragile, non-reproductible, et non-testable**. Personne ne peut verifier qu'un agent "fonctionne" sans le lancer manuellement.

### Ce que `/adapt` a besoin

`/adapt` doit pouvoir :
```
Entree: contract "maestro-assistant" + modele cible "mistral-7b" + profil hardware
  → Lire la definition du contract (features, capabilities requises)
  → Generer un block agent adapte (prompt plus court, temperature ajustee)
  → Tester CHAQUE capability declaree (pas juste "ca compile")
  → Mesurer le fitness
  → Publier si fitness > seuil
```

Pour ca, il faut :
1. **Un fichier de logique** qui definit les etapes de creation
2. **Des acceptance tests par contract** qui verifient chaque capability
3. **Une interface programmatique** (pas juste un workflow backend)

### Insight cle : le contract `agent-creator` N'EST PAS un agent

L'Agent Creator n'est pas un meta-agent qui tourne dans le backend. C'est un **module TypeScript** dans `packages/maestro-code/services/` qui :
- Contient la logique de creation (generation JSON, prompts, validation)
- Utilise l'API Maestro pour sauver les blocks
- Execute des acceptance tests pour verifier les capabilities
- Retourne un rapport (block cree, tests passes/echoues, fitness)

Pourquoi pas un workflow backend ?
- `/adapt` a besoin de creer des dizaines de variantes rapidement
- Un workflow backend = 1 session par variante = lent et lourd
- Un module TS = appel direct, pas de session, rapide, testable unitairement
- Le module peut etre appele par `/adapt`, par le TUI (`/create-agent`), et par les tests

---

## Architecture

### Fichiers a creer

```
packages/maestro-code/
  services/
    agent-creator.ts            ← Logique de creation (LE fichier central)
    agent-creator-templates.ts  ← Templates de system prompts par capability
    agent-creator-tests.ts      ← Acceptance tests par contract/capability

content/system/contracts/
    agent-creator.contract.json ← Contract definition de l'agent-creator lui-meme
    code-reviewer.contract.json ← Exemple de contract pre-defini

tests/
    agent-creator.test.ts       ← Tests unitaires du module
    agent-creator-acceptance.test.ts  ← Tests d'acceptance (mock API)
```

### Le module `agent-creator.ts` — LE fichier central

```typescript
/**
 * Agent Creator — Programmatic agent creation with contract-based validation.
 *
 * This module is the SINGLE source of truth for how agents are created in Maestro.
 * It is used by:
 *   - /adapt (create variants for different models)
 *   - /create-agent (TUI command)
 *   - maestro create-agent (CLI command)
 *   - Tests (acceptance tests per contract)
 *
 * The creation process:
 *   1. analyzeRequest()     — Parse description, identify/create contract
 *   2. designBlock()        — Generate block JSON + system prompt
 *   3. validateBlock()      — Structural validation (JSON schema, required fields)
 *   4. testCapabilities()   — Run acceptance tests per declared capability
 *   5. measureFitness()     — Calculate fitness score
 *   6. publishBlock()       — Save to filesystem via API
 */

interface AgentCreatorInput {
  description: string;              // "An agent that reviews Python code"
  contractId?: string;              // Target contract (optional, auto-detected)
  targetModel?: string;             // "mistral-7b" — adapts prompt for model
  hardwareProfile?: HardwareProfile; // Constraints (VRAM, RAM, etc.)
  capabilities?: string[];          // Override capabilities (optional)
  baseBlockId?: string;             // Clone from existing block (for /adapt)
}

interface AgentCreatorResult {
  block: GeneratedBlock;            // The created block definition
  contract: ContractDefinition;     // The contract it implements
  testResults: CapabilityTestResult[]; // Per-capability test results
  fitness: number;                  // Measured fitness score
  publishedPath?: string;           // Where it was saved (if published)
}

interface CapabilityTestResult {
  capability: string;               // "conversation", "tool-calling", etc.
  passed: boolean;
  score: number;                    // 0-100
  details: string;                  // What was tested and why it passed/failed
  testedAt: string;
}
```

### Les acceptance tests par capability

C'est l'innovation cle. Chaque capability a des **tests concrets** :

```typescript
// agent-creator-tests.ts

interface CapabilityTest {
  capability: string;
  name: string;
  description: string;
  // The test function: sends input to the agent, checks output
  run: (client: IMaestroCodeApiClient, blockId: string, sessionId: string) => Promise<CapabilityTestResult>;
}

const CAPABILITY_TESTS: CapabilityTest[] = [
  // ── conversation ──
  {
    capability: 'conversation',
    name: 'basic-response',
    description: 'Agent responds coherently to a greeting',
    run: async (client, blockId, sessionId) => {
      // 1. Invoke with input: "Hello, what can you do?"
      // 2. Check: response is valid JSON with tool call
      // 3. Check: step-complete summary is non-empty and coherent
      // 4. Score: length > 20 chars, no error indicators
    },
  },
  {
    capability: 'conversation',
    name: 'context-retention',
    description: 'Agent remembers context from previous turn',
    run: async (client, blockId, sessionId) => {
      // 1. Send "My name is Alice"
      // 2. Send "What is my name?"
      // 3. Check: response contains "Alice"
    },
  },

  // ── tool-calling ──
  {
    capability: 'tool-calling',
    name: 'file-read',
    description: 'Agent correctly calls file-read tool',
    run: async (client, blockId, sessionId) => {
      // 1. Send "Read the file C:/Meastro/README.md"
      // 2. Check: agent calls {"tool":"file-read","args":{"path":"..."}}
      // 3. Check: tool name is exact, args has required fields
    },
  },
  {
    capability: 'tool-calling',
    name: 'shell-execute',
    description: 'Agent correctly calls shell-execute tool',
    run: async (client, blockId, sessionId) => {
      // 1. Send "List the files in C:/Meastro"
      // 2. Check: agent uses directory-list OR shell-execute
    },
  },

  // ── structured-output ──
  {
    capability: 'structured-output',
    name: 'json-generation',
    description: 'Agent generates valid JSON when asked',
    run: async (client, blockId, sessionId) => {
      // 1. Send "Generate a JSON config with fields: name, version, debug"
      // 2. Check: response contains parseable JSON in output
      // 3. Check: JSON has the requested fields
    },
  },

  // ── long-context ──
  {
    capability: 'long-context',
    name: 'large-input-handling',
    description: 'Agent handles inputs > 2000 tokens without losing info',
    run: async (client, blockId, sessionId) => {
      // 1. Send a long prompt with a specific instruction buried in the middle
      // 2. Check: agent follows the buried instruction
    },
  },

  // ── orchestration ──
  {
    capability: 'orchestration',
    name: 'multi-step-plan',
    description: 'Agent creates a multi-step plan before executing',
    run: async (client, blockId, sessionId) => {
      // 1. Send "Set up a development workspace for Cantante"
      // 2. Check: agent presents a plan (mentions workspace create, session create)
      // 3. Check: agent does NOT execute without confirmation
    },
  },
];
```

### Les templates de system prompt

```typescript
// agent-creator-templates.ts

/**
 * Generates a system prompt adapted to the target model and capabilities.
 *
 * Key insight: different models need different prompts.
 * - Large models (opus, sonnet): can handle complex, nuanced prompts
 * - Medium models (gpt-4o, mistral-large): need clearer structure
 * - Small models (7B, 3B): need SHORT, direct, example-heavy prompts
 */

interface PromptGenerationInput {
  role: string;                    // "code reviewer", "test generator"
  capabilities: string[];          // Which capabilities this agent has
  modelTier: 'large' | 'medium' | 'small';
  tools: ToolDefinition[];         // Available tools
  constraints?: string[];          // Extra rules
}

function generateSystemPrompt(input: PromptGenerationInput): string {
  // 1. Header: role description (SHORT for small models)
  // 2. Response format: JSON only, one tool call (ALWAYS present)
  // 3. Available tools: filtered by capabilities
  // 4. Workflow: adapted to model tier
  //    - Large: nuanced strategy
  //    - Small: explicit step-by-step with examples
  // 5. Rules: confirmation, step-complete, etc.
}
```

---

## Le contract `agent-creator`

```json
{
  "id": "agent-creator",
  "name": "Agent Creator",
  "description": "Creates new agent blocks from descriptions. Generates block JSON, system prompts, and validates capabilities through acceptance tests.",
  "requiredCapabilities": ["block-generation"],
  "features": {
    "block-generation": {
      "description": "Generate valid agent block JSON + system prompt",
      "requires": ["block-generation"]
    },
    "contract-analysis": {
      "description": "Analyze a description and identify/create the appropriate contract",
      "requires": ["block-generation", "contract-analysis"]
    },
    "capability-testing": {
      "description": "Run acceptance tests to verify each declared capability works",
      "requires": ["block-generation", "capability-testing"]
    },
    "model-adaptation": {
      "description": "Adapt prompts and config for a specific target model",
      "requires": ["block-generation", "model-adaptation"]
    },
    "fitness-measurement": {
      "description": "Calculate fitness score for the created agent",
      "requires": ["block-generation", "fitness-measurement"]
    }
  }
}
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 51-A | Module agent-creator.ts + templates + structural validation | 2 jours |
| 51-B | Acceptance tests par capability (agent-creator-tests.ts) | 2 jours |
| 51-C | Integration TUI (/create-agent) + CLI + 2 contracts pre-definis | 1.5 jours |

---

## 51-A : Module agent-creator.ts

### But
Creer le fichier de logique central. Il doit pouvoir generer un agent block complet (JSON + system prompt) a partir d'une description, et le valider structurellement.

### Lecture obligatoire
- `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json` (anatomie)
- `content/system/blocks/system/maestro-assistant/system-prompt.md` (prompt structure)
- `content/system/blocks/system/maestro-assistant-compact/` (variante light)
- `content/system/blocks/agents/dev-orchestrator/` (composite agent)
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockRepository.cs` (SaveAsync)
- `packages/maestro-cli/adapt-optimize.ts` (withBlockVariant, strategyModelDowngrade)
- `content/system/contracts/maestro-assistant.contract.json`

### Taches

1. **Creer `services/agent-creator.ts`** :
   - `analyzeRequest(input: AgentCreatorInput)` → identifie le contract, deduit les capabilities
   - `designBlock(analysis)` → genere le block JSON complet
   - `generateSystemPrompt(design)` → genere le system prompt adapte au modele
   - `validateBlock(block)` → validation structurelle (tous les champs requis, format correct)
   - `createAgent(input)` → pipeline complet (analyze → design → validate → return)

2. **Creer `services/agent-creator-templates.ts`** :
   - Templates de prompts par tier de modele (large/medium/small)
   - Section tools filtree par capabilities
   - Section response format (toujours JSON, toujours step-complete)
   - Exemples adaptes au role

3. **Validation structurelle** (dans `validateBlock`) :
   - Tous les champs requis presents (id, name, blockType, version, isAtomic, config)
   - config.systemPromptFile ou systemPrompt present
   - config.nodes[0].config.model present (ou config.model pour atomic)
   - inputs/outputs ont id + type
   - metadata a category + designation + tags
   - Si contract declare → requiredCapabilities satisfaites

4. **Support `/adapt`** :
   - `createVariant(baseBlockId, targetModel, hardwareProfile)` — clone un block existant et adapte
   - Regenere le system prompt pour le modele cible (tier detection)
   - Ajuste maxIterations, maxTokens, temperature selon le modele
   - Ne change PAS le contract ni les capabilities (c'est /adapt qui verifie ensuite)

5. **Tests unitaires** (`tests/agent-creator.test.ts`) :
   - `analyzeRequest` identifie correctement le contract
   - `designBlock` genere un JSON valide avec tous les champs
   - `generateSystemPrompt` produit un prompt avec tools, format, rules
   - `validateBlock` rejette les blocks invalides (champ manquant, etc.)
   - `createVariant` clone et adapte correctement
   - Pas de regression sur les 141 tests existants

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run tests/agent-creator.test.ts
cd packages/maestro-code && npx vitest run
```

### Anti-patterns
- NE PAS en faire un workflow backend — c'est un module TS appele directement
- NE PAS hardcoder des prompts — utiliser les templates parametriques
- NE PAS generer de code — l'Agent Creator genere des BLOCKS (JSON + prompts)
- NE PAS ignorer le modele cible — un prompt pour opus ≠ un prompt pour phi-3

---

## 51-B : Acceptance tests par capability

### But
Creer le framework de tests qui verifie que chaque capability declaree par un agent fonctionne reellement. C'est CE QUI MANQUE aujourd'hui — on declare des capabilities mais personne ne les verifie.

### Lecture obligatoire
- `apps/backend/src/Maestro.Domain/Entities/BlockTestRun.cs` (modele de test existant)
- `apps/backend/src/Maestro.Api/Controllers/BlockTestController.cs` (API de test)
- `apps/backend/src/Maestro.Domain/ValueObjects/QualityScore.cs` (scoring)
- `content/system/contracts/maestro-assistant.contract.json` (ce qu'on teste)
- `packages/maestro-code/services/contract-resolver.ts` (feature gating)

### Taches

1. **Creer `services/agent-creator-tests.ts`** :
   - Interface `CapabilityTest` : capability, name, description, run()
   - `CAPABILITY_TESTS` : tableau de tous les tests
   - `runCapabilityTests(client, blockId, sessionId, capabilities)` → execute les tests pertinents
   - `generateTestReport(results)` → rapport lisible (markdown)

2. **Tests par capability** (au minimum) :

   **conversation** (2 tests) :
   - `basic-response` : greeting → reponse coherente en JSON
   - `context-retention` : 2 messages → le second reference le premier

   **tool-calling** (2 tests) :
   - `correct-tool-format` : demande une action → JSON avec tool + args correct
   - `step-complete-usage` : demande simple → utilise step-complete pour repondre

   **structured-output** (1 test) :
   - `json-in-output` : demande un JSON structure → le genere correctement

   **long-context** (1 test) :
   - `instruction-following` : prompt long avec instruction specifique → la suit

   **orchestration** (1 test) :
   - `plan-before-act` : demande une action complexe → presente un plan d'abord

3. **Scoring** :
   - Chaque test retourne `{ passed, score (0-100), details }`
   - Score global = moyenne ponderee (conversation: 0.3, tool-calling: 0.3, rest: proportionnel)
   - Fitness de capability = nombre de tests passes / nombre de tests total

4. **Integration avec `createAgent`** :
   - Apres `validateBlock`, optionnellement `testCapabilities`
   - Requiert un backend actif (session + invocation)
   - Mode "dry-run" : skip les tests, retourne capabilities non-verifiees
   - Mode "full" : cree une session temporaire, execute les tests, la supprime

5. **Tests unitaires** (`tests/agent-creator-acceptance.test.ts`) :
   - Mock API client pour simuler les reponses d'agent
   - Teste chaque CapabilityTest individuellement
   - Teste `runCapabilityTests` avec differents sets de capabilities
   - Teste `generateTestReport` produit du markdown valide

### Verification
```bash
cd packages/maestro-code && npx vitest run tests/agent-creator-acceptance.test.ts
cd packages/maestro-code && npx vitest run
```

### Note importante pour `/adapt`
`/adapt` utilisera `runCapabilityTests` pour verifier que la variante creee supporte toujours les capabilities du contract. Si un modele plus petit ne peut pas faire du `structured-output`, le test echouera et la capability sera retiree. L'utilisateur verra dans l'AssistantSelector :
```
maestro-assistant-mistral7b
  Features: 2/5 active
  + Conversation  + Tool Calling
  - Structured Output  - Long Context  - Orchestration
```

---

## 51-C : Integration TUI + CLI + contracts pre-definis

### But
Rendre le module accessible via le TUI et le CLI. Creer 2 contracts pre-definis pour demontrer le systeme.

### Taches

1. **Slash command `/create-agent`** dans le TUI :
   - L'utilisateur tape `/create-agent An agent that reviews Python code`
   - Le module `createAgent()` est appele
   - Le resultat est affiche dans la conversation (block cree, capabilities, fitness)
   - Le block apparait immediatement dans le Catalog

2. **CLI** : `maestro create-agent --description "..." [--contract <id>] [--model <model>]`
   - Appelle le meme module `createAgent()`
   - Affiche le rapport dans le terminal

3. **2 contracts pre-definis** :
   - `code-reviewer.contract.json` :
     ```json
     {
       "id": "code-reviewer",
       "requiredCapabilities": ["conversation", "tool-calling"],
       "features": {
         "code-reading": { "requires": ["tool-calling"] },
         "review-feedback": { "requires": ["conversation"] },
         "structured-report": { "requires": ["structured-output"] },
         "multi-file-review": { "requires": ["long-context", "tool-calling"] }
       }
     }
     ```
   - `test-generator.contract.json` :
     ```json
     {
       "id": "test-generator",
       "requiredCapabilities": ["conversation", "tool-calling"],
       "features": {
         "test-writing": { "requires": ["tool-calling"] },
         "coverage-analysis": { "requires": ["tool-calling", "conversation"] },
         "structured-results": { "requires": ["structured-output"] }
       }
     }
     ```

4. **DemoApiClient** : mock pour `/create-agent` en mode demo

5. **Tests** :
   - `/create-agent` dans le TUI affiche le bon feedback
   - Les 2 contracts sont charges correctement
   - computeActiveFeatures fonctionne avec les nouveaux contracts

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
cd packages/maestro-code && npm run test:visual
cd packages/maestro-code && node tests/real-demo-check.cjs
```

---

## Comment ca s'integre avec /adapt (Phase 52)

```
/adapt maestro-assistant --model mistral-7b

Phase 52 fait :
1. Lire le contract "maestro-assistant" (Phase 50)
2. Lire le block existant "system:maestro-assistant"
3. Appeler agent-creator.createVariant({
     baseBlockId: "system:maestro-assistant",
     targetModel: "mistral-7b",
     hardwareProfile: { vramMb: 6000, ... }
   })
   → Genere: "system:maestro-assistant-mistral7b" avec prompt adapte (Phase 51-A)

4. Appeler agent-creator-tests.runCapabilityTests(
     client, "system:maestro-assistant-mistral7b", sessionId,
     ["conversation", "tool-calling", "structured-output", "long-context", "orchestration"]
   )
   → Resultat: conversation PASS, tool-calling PASS, structured-output FAIL, ...
   → Capabilities verifiees: ["conversation", "tool-calling"] (Phase 51-B)

5. Mettre a jour le block avec les capabilities reellement verifiees
6. Calculer le fitness
7. Si fitness > seuil → publier
8. L'utilisateur voit le nouveau block dans l'AssistantSelector avec features ✓/✗
```

---

## Definition of Done

- [ ] `agent-creator.ts` : createAgent() genere un block valide (JSON + system prompt)
- [ ] `agent-creator.ts` : createVariant() clone et adapte un block existant
- [ ] `agent-creator-templates.ts` : prompts adaptes par tier (large/medium/small)
- [ ] `agent-creator-tests.ts` : 7+ acceptance tests couvrant 5 capabilities
- [ ] `agent-creator-tests.ts` : runCapabilityTests() retourne des resultats clairs
- [ ] Validation structurelle : rejette les blocks invalides
- [ ] TUI `/create-agent` fonctionnel
- [ ] 2 contracts pre-definis (code-reviewer, test-generator)
- [ ] Tous les tests passent (existants + nouveaux)
- [ ] Le module est DIRECTEMENT utilisable par /adapt sans adaptation

### NOT in scope
- `/adapt` comme commande TUI (Phase 52)
- `contractRef` dans les workflows (Phase 52)
- Production de variantes (Phase 53)
- Execution reelle des tests contre un backend (les tests sont definis, pas executes en CI)
- Self-improvement (Phase 57+)

---

## Validation finale

### Couche 1 — Type Check
- [ ] `npx tsc --noEmit` (maestro-code) : 0 errors
- [ ] `npx tsc --noEmit` (maestro-cli) : 0 errors

### Couche 2 — Tests unitaires
- Tests avant : 141
- Tests apres : __
- Tests crees : agent-creator.test.ts, agent-creator-acceptance.test.ts
- [ ] Tous les tests passent

### Couche 3 — Visual Gate
- [ ] `npm run test:visual` : assertions passent

### Couche 4 — Real Demo Check
- [ ] `node tests/real-demo-check.cjs` : PASS

### Couche 5 — Integration
- [ ] `createAgent({ description: "..." })` genere un block valide
- [ ] `createVariant(baseBlockId, model)` produit un block clone adapte
- [ ] `runCapabilityTests()` retourne des resultats par capability
