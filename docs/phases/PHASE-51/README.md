# Phase 51 : Contract System — Schema, documentation, verification, bareme

**Statut** : A FAIRE
**Prerequis** : Phase 50 COMPLETE (contracts, capabilities, feature gating, AssistantSelector)
**Objectif** : Faire du contract un systeme **verifiable et documente**. Definir clairement la distinction contract/features/capabilities, enrichir le schema avec des tests et baremes, ecrire les contracts concrets qui serviront de fondation aux phases suivantes.
**Duree estimee** : 3-4 jours

---

## Pourquoi cette phase est necessaire AVANT de creer des agents

### Le probleme actuel

Aujourd'hui, un contract c'est un fichier JSON avec :
```json
{
  "requiredCapabilities": ["conversation"],
  "features": { "conversation": { "requires": ["conversation"] } }
}
```

Ca ne veut rien dire concretement. Il n'y a :
- **Aucun test** : comment verifier qu'un block "passe" le contract ?
- **Aucun bareme** : quel score faut-il pour etre considere valide ?
- **Aucune distinction claire** entre contract, features, et capabilities dans la doc
- **Aucun contract riche** : maestro-assistant a 5 features vagues sans tests

Si on cree des agents (test-designer, agent-creator) sans contract system solide, on construit sur du sable.

### Ce que cette phase produit

1. **Documentation** : qu'est-ce qu'un contract, comment ca marche, distinction contract/features/capabilities
2. **Schema enrichi** : tests par feature, bareme, seuils de validation
3. **Contracts concrets** : maestro-assistant enrichi, test-designer, agent-creator, block-forge
4. **Infrastructure** : validation de contract, resolution avec tests, API enrichie

---

## La hierarchie : Contract > Features > Capabilities > Tests

### Definitions

```
CONTRACT = un role verifiable qu'un block peut remplir
  Exemple: "maestro-assistant", "code-reviewer", "test-designer"
  Plusieurs blocks peuvent implementer le meme contract.
  L'utilisateur choisit quelle implementation utiliser.

FEATURE = un groupement fonctionnel visible par l'utilisateur
  Exemple: "Conversation", "Maestro Operations", "Orchestration"
  C'est ce qui s'affiche +/- dans l'AssistantSelector.
  Une feature est active si le block a TOUTES les capabilities requises.

CAPABILITY = une competence atomique d'un block
  Exemple: "conversation", "tool-calling", "structured-output", "memory"
  C'est ce que le block SAIT FAIRE concretement.
  Declare dans le block.json capabilities[].

TEST = une verification concrete d'une feature
  Exemple: "basic-response", "create-session", "remember-preference"
  C'est ce qui prouve qu'un block remplit reellement la feature.
  Un test a un prompt, une verification, et un score.
```

### Relation

```
Contract: maestro-assistant
│
├─ Feature: "Conversation"
│    requires: [conversation]
│    tests:
│      - basic-response: "Hello" → reponse coherente, non-vide
│      - context-retention: "My name is X" puis "What's my name?" → contient X
│    seuil: 80% des tests passes
│
├─ Feature: "Maestro Operations"
│    requires: [structured-output, tool-calling, stability]
│    tests:
│      - create-session: "Create a dev session for Cantante" → JSON avec session-create tool call
│      - manage-workspace: "List my workspaces" → appel workspace-list correct
│      - navigate-pages: "Show me the Catalog" → commande de navigation correcte
│    seuil: 70% des tests passes
│
├─ Feature: "Orchestration"
│    requires: [orchestration, tool-calling, long-context]
│    tests:
│      - multi-step-plan: "Set up Cantante for dev" → plan en etapes, confirmation avant execution
│      - session-monitoring: "What's happening in session X?" → lecture variables, resume
│      - confirm-before-act: Action complexe → NE PAS executer sans confirmation
│    seuil: 70%
│
├─ Feature: "Memory"
│    requires: [memory, long-context]
│    tests:
│      - remember-preference: "I prefer dark theme" → rappel dans prochaine session
│      - recall-past-session: "What did we do last time?" → resume coherent
│    seuil: 60%
```

Un mistral-7b passe "Conversation" (1/4 features). Un sonnet passe 3/4. Un opus 4/4.

### Ce que ce N'EST PAS

- **Un contract n'est pas une liste de capabilities.** Les capabilities sont les ingredients, le contract est la recette.
- **Une feature n'est pas un boolean.** Une feature a un score (% de tests passes) et un seuil minimum.
- **Un test n'est pas un unit test vitest.** C'est une invocation reelle du block dans une session, avec verification du resultat.

---

## Schema enrichi du contract

```json
{
  "id": "maestro-assistant",
  "name": "Maestro Assistant",
  "version": "2.0.0",
  "description": "The primary conversational assistant in maestro-code...",

  "requiredCapabilities": ["conversation"],
  "minimumFitness": 0.3,

  "features": {
    "conversation": {
      "description": "Basic conversational interaction with the user",
      "requires": ["conversation"],
      "weight": 0.25,
      "minimumScore": 0.8,
      "tests": [
        {
          "id": "basic-response",
          "description": "Agent responds coherently to a greeting",
          "prompt": "Hello, what can you do?",
          "check": {
            "type": "non-empty",
            "minLength": 20
          }
        },
        {
          "id": "context-retention",
          "description": "Agent remembers context from previous turn",
          "turns": [
            { "prompt": "My name is Alice" },
            { "prompt": "What is my name?", "check": { "type": "contains", "value": "Alice" } }
          ]
        }
      ]
    },
    "maestro-operations": {
      "description": "Create and manage Maestro sessions, workspaces, and blocks",
      "requires": ["structured-output", "tool-calling", "stability"],
      "weight": 0.30,
      "minimumScore": 0.7,
      "tests": [
        {
          "id": "create-session",
          "description": "Agent correctly calls session creation tool",
          "prompt": "Create a dev session for Cantante",
          "check": {
            "type": "tool-call",
            "toolName": "session-create",
            "requiredArgs": ["name", "repo"]
          }
        },
        {
          "id": "list-workspaces",
          "description": "Agent calls workspace-list tool",
          "prompt": "List my workspaces",
          "check": {
            "type": "tool-call",
            "toolName": "workspace-list"
          }
        },
        {
          "id": "navigate-pages",
          "description": "Agent navigates to a specific page",
          "prompt": "Show me the Catalog",
          "check": {
            "type": "contains-any",
            "values": ["catalog", "Catalog", "/catalog"]
          }
        }
      ]
    },
    "orchestration": {
      "description": "Multi-step planning and session management",
      "requires": ["orchestration", "tool-calling", "long-context"],
      "weight": 0.30,
      "minimumScore": 0.7,
      "tests": [
        {
          "id": "multi-step-plan",
          "description": "Agent presents a plan before executing",
          "prompt": "Set up a complete development environment for Cantante with sessions for frontend and backend",
          "check": {
            "type": "contains-all",
            "values": ["workspace", "session"]
          }
        },
        {
          "id": "confirm-before-act",
          "description": "Agent asks for confirmation before executing",
          "prompt": "Delete all my test sessions",
          "check": {
            "type": "does-not-contain",
            "values": ["session-delete"],
            "description": "Agent should NOT execute deletion without confirmation"
          }
        }
      ]
    },
    "memory": {
      "description": "Remember user preferences and past interactions",
      "requires": ["memory", "long-context"],
      "weight": 0.15,
      "minimumScore": 0.6,
      "tests": [
        {
          "id": "remember-preference",
          "description": "Agent stores and recalls a preference",
          "turns": [
            { "prompt": "Remember that I always want verbose output" },
            { "prompt": "What are my preferences?", "check": { "type": "contains", "value": "verbose" } }
          ]
        }
      ]
    }
  },

  "scoring": {
    "method": "weighted-average",
    "description": "Score global = somme(feature.weight * feature.score). Feature.score = tests passes / tests total. Un block est valide pour le contract si score >= minimumFitness ET chaque feature active a score >= feature.minimumScore."
  }
}
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 51-A | Documentation : qu'est-ce qu'un contract, distinction avec capabilities/features | 1 jour |
| 51-B | Schema enrichi + validation backend + API | 1.5 jours |
| 51-C | Contracts concrets : maestro-assistant v2, test-designer, agent-creator, block-forge | 1.5 jours |

---

## 51-A : Documentation du contract system

### But
Ecrire la documentation de reference qui definit le systeme de contracts. Cette doc sera lue par les agents Maestro ET par les developpeurs humains.

### Taches

1. **Creer `docs/system/architecture/contracts.md`** — Document de reference :
   - Qu'est-ce qu'un contract (definition, exemples)
   - La hierarchie : Contract > Features > Capabilities > Tests
   - Ce qu'un contract N'EST PAS (pas une liste de capabilities, pas un boolean)
   - Comment un block "passe" un contract (tests, scores, seuils)
   - Comment un utilisateur choisit (AssistantSelector, features +/-)
   - Comment `/adapt` utilise les contracts (creer variantes, tester, publier)
   - Exemples concrets : maestro-assistant avec 4 features

2. **Mettre a jour `docs/system/architecture/blocks.md`** :
   - Ajouter section "Contract et capabilities" renvoyant vers contracts.md
   - Clarifier que capabilities est une liste atomique sur le block
   - Clarifier que contract est un pointeur vers une definition externe

3. **Mettre a jour les references** :
   - `CLAUDE.md` : ajouter `docs/system/architecture/contracts.md` dans la table des references
   - `docs/ROADMAP.md` : vision strategique mise a jour

### Verification
- La doc est lisible et non-ambigue
- Un developpeur qui lit SEULEMENT contracts.md comprend tout le systeme

---

## 51-B : Schema enrichi + validation backend + API

### But
Enrichir le format `.contract.json` avec des tests et un bareme. Ajouter la validation cote backend et enrichir l'API.

### Lecture obligatoire
- `content/system/contracts/maestro-assistant.contract.json` (format actuel)
- `packages/maestro-code/services/contract-resolver.ts` (resolution client-side)
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` (API blocks)
- `apps/backend/src/Maestro.Api/Controllers/BlockTestController.cs` (API tests existante)
- `apps/backend/src/Maestro.Domain/ValueObjects/FitnessScore.cs` (scoring)

### Taches

1. **Enrichir le schema contract** :
   - `features[].tests[]` : prompt, check (type + params), multi-turn support
   - `features[].weight` : poids dans le score global (somme = 1.0)
   - `features[].minimumScore` : seuil minimum pour cette feature
   - `scoring.method` : "weighted-average" (extensible)
   - `minimumFitness` : seuil global pour valider le contract
   - `version` : versioning des contracts

2. **Types de check** pour les tests :
   - `non-empty` : reponse non-vide, longueur minimum
   - `contains` / `contains-all` / `contains-any` : sous-chaines presentes
   - `does-not-contain` : sous-chaines absentes (pour "confirm before act")
   - `tool-call` : verifie qu'un tool call specifique est fait (toolName, requiredArgs)
   - `json-parseable` : la reponse contient du JSON valide
   - `regex` : match un pattern

3. **Contract discovery backend** :
   - `FileSystemContractDiscoveryService` qui scanne `content/system/contracts/*.contract.json`
   - GET `/api/contracts` — liste tous les contracts
   - GET `/api/contracts/{id}` — un contract par ID
   - GET `/api/contracts/{id}/validate?blockId=X` — verifie si un block passe le contract (futur)

4. **Mettre a jour contract-resolver.ts** :
   - Charger les tests depuis le contract (pas juste les features)
   - Supprimer les `EMBEDDED_CONTRACTS` en dur quand l'API fonctionne
   - Fallback toujours present pour le mode demo

5. **Tests** :
   - Schema validation : un contract sans `features` est invalide
   - Score calculation : weighted average avec seuils
   - API : GET /api/contracts retourne les contracts enrichis
   - Pas de regression sur les 141 tests existants

### Verification
```bash
cd apps/backend && dotnet build
curl http://localhost:5000/api/contracts
curl http://localhost:5000/api/contracts/maestro-assistant
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
```

---

## 51-C : Contracts concrets

### But
Ecrire les contracts enrichis qui serviront de fondation aux phases 52-54.

### Taches

1. **`maestro-assistant.contract.json` v2** :
   - 4 features : Conversation, Maestro Operations, Orchestration, Memory
   - Tests concrets par feature (voir schema ci-dessus)
   - Poids : operations 0.30, orchestration 0.30, conversation 0.25, memory 0.15

2. **`test-designer.contract.json`** (NOUVEAU) :
   - Feature: "Contract Analysis" — lit un contract, identifie les features a tester
   - Feature: "Test Generation" — produit des BlockTestRun configs par capability
   - Feature: "Test Quality" — les tests generes sont non-triviaux et executables
   - Tests concrets pour chaque feature

3. **`agent-creator.contract.json`** (NOUVEAU) :
   - Feature: "Block Generation" — cree un block.json valide avec tous les champs
   - Feature: "Prompt Writing" — ecrit un system-prompt.md adapte au modele
   - Feature: "Iterative Improvement" — lit les resultats de test, corrige, re-teste
   - Feature: "Model Adaptation" — adapte pour differents tiers de modele
   - Tests concrets pour chaque feature

4. **`block-forge.contract.json`** (NOUVEAU) :
   - Feature: "End-to-End Creation" — de la description au block publie
   - Feature: "Contract Compliance" — le block cree passe les tests du contract cible
   - Feature: "Adaptation" — cree des variantes pour differents modeles
   - Tests concrets

5. **Mettre a jour les EMBEDDED_CONTRACTS** dans contract-resolver.ts pour le mode demo

### Verification
```bash
# Tous les contracts sont du JSON valide
cd content/system/contracts && for f in *.contract.json; do python -m json.tool "$f" > /dev/null && echo "OK: $f" || echo "FAIL: $f"; done
# L'API les sert
curl http://localhost:5000/api/contracts | python -m json.tool
# Les tests existants passent
cd packages/maestro-code && npx vitest run
```

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] `docs/system/architecture/contracts.md` existe et definit clairement contract/features/capabilities/tests
- [ ] Schema contract enrichi avec tests[], weight, minimumScore, scoring
- [ ] 6 types de check : non-empty, contains, does-not-contain, tool-call, json-parseable, regex
- [ ] `FileSystemContractDiscoveryService` — GET /api/contracts fonctionne
- [ ] `maestro-assistant.contract.json` v2 — 4 features, 8+ tests
- [ ] `test-designer.contract.json` — 3 features avec tests
- [ ] `agent-creator.contract.json` — 4 features avec tests
- [ ] `block-forge.contract.json` — 3 features avec tests
- [ ] contract-resolver.ts mis a jour pour charger les tests
- [ ] Tous les tests passent (existants + nouveaux)

### NOT in scope
- Execution des tests de contract (c'est le job du test-designer, Phase 52)
- Creation d'agents (Phase 52-53)
- Workflow block-forge (Phase 54)
- TUI /create-agent (Phase 54)
- /adapt (Phase 55+)

---

## Validation finale

### Couche 1 — Type Check
- [ ] `dotnet build` (backend) : 0 errors
- [ ] `npx tsc --noEmit` (maestro-code) : 0 errors

### Couche 2 — Tests unitaires
- Tests avant : 141
- Tests apres : __
- [ ] Tous les tests passent

### Couche 3 — API
- [ ] GET /api/contracts retourne 4+ contracts
- [ ] GET /api/contracts/maestro-assistant retourne le contract enrichi avec tests

### Couche 4 — Documentation
- [ ] contracts.md est lisible et complet
- [ ] CLAUDE.md reference contracts.md
