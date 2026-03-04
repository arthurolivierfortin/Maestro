# Phase 47 : Infrastructure de tests d'integration

**Statut** : EN_COURS
**Prerequis** : Phase 46 COMPLETE
**Objectif** : Combler le trou critique dans la pyramide de tests — creer des tests qui exercent le vrai backend, verifient la vraie execution de workflows, et attrapent les bugs comme "Conversation '' not found" AVANT le dogfooding.

---

## Contexte

Phase 46 a produit 89 tests unitaires. Tous passent. Le dogfooding a immediatement revele un bug bloquant : l'agent ne peut repondre a AUCUN message (`Conversation '' not found`). Les tests n'ont rien vu parce qu'ils testent des mocks qui parlent a des mocks.

**La pyramide actuelle :**
- Unit tests (89 maestro-code + 67 tui + ...) — mocks partout -> PASS
- Integration tests — **ZERO**
- Dogfooding — attrape tout mais trop tard

**La pyramide cible :**
- Unit tests — composants isoles, callbacks, rendering
- **Integration tests — vrai backend, vraie execution, mock LLM** <- cette phase
- Dogfooding — UX, polish, edge cases

## Strategie cout zero

- **`mock-response.json`** : mecanisme existant dans le backend — tout block avec un fichier `mock-response.json` dans son dossier retourne une reponse deterministe sans appeler le LLM.
- **Sidecar** (`@maestro/sidecar`) : spawne le backend comme processus enfant, auto-port, health check, cleanup.
- **MaestroClient SDK** (`@maestro/client`) : client TypeScript type avec toutes les methodes.
- **`skipLlm: true`** : option du sidecar pour ne pas demarrer le LLM-Provider (Level 1-2).

---

## Regles

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Zero cout LLM** pour les tests Level 1-3 (mock-response.json)
3. **Aucune modification du backend** sauf ajout de `mock-response.json`
4. **Un sidecar par suite de tests** (pas par test — startup coute 15-30s)
5. **Chaque test cree sa propre session** pour l'isolation
6. **Les tests doivent passer a chaque etape**
7. **Committer apres chaque sous-phase**

---

## Cas d'usage a verifier

### Level 1 — API Backend (pas de LLM, pas de workflow)

| # | Cas d'usage | Ce qu'on verifie |
|---|-------------|------------------|
| 1.1 | Creer une session | POST retourne un UUID, status correct |
| 1.2 | Get session par ID | Tous les champs presents |
| 1.3 | Lister les sessions | La session creee apparait |
| 1.4 | Supprimer une session | GET retourne 404 apres |
| 1.5 | Set variable string | GET retourne la meme valeur |
| 1.6 | Set variable objet JSON | GET retourne la structure correcte (pas de corruption JsonElement) |
| 1.7 | Set variable tableau | GET retourne le tableau intact |
| 1.8 | Supprimer variable | GET retourne 404 |
| 1.9 | Decouverte des blocks | List retourne >100 blocks |
| 1.10 | Filtrer blocks par type | `workflow` retourne seulement des workflows |
| 1.11 | Chercher un block par ID | `conversation` trouve |
| 1.12 | Importer template maestro-assistant | Variables, entry points, tous importes |
| 1.13 | Verifier entry points apres import | `message`, `new-conversation`, `clear-conversation` |
| 1.14 | Health check backend | Status healthy |

### Level 2 — Execution de workflows (pas de LLM, conversation block seulement)

| # | Cas d'usage | Ce qu'on verifie |
|---|-------------|------------------|
| 2.1 | Invoke `new-conversation` | `_activeConversation` passe de `""` a un UUID |
| 2.2 | Execution tree apres workflow | Tous les nodes en `done` |
| 2.3 | Execution log | Entrees info/success creees |
| 2.4 | `_nodeResult_X` propagation | Le resultat du node create est dans `_activeConversation` |
| 2.5 | Invoke `clear-conversation` | `_activeConversation` change a un nouveau UUID |
| 2.6 | Conditional — branche true | Quand `_activeConversation` a une valeur, le cleanup s'execute |
| 2.7 | Conditional — branche false | Quand `_activeConversation` est vide, la creation s'execute |
| 2.8 | Workflow termine | `_activeWorkflow` redevient `""` |

### Level 3 — Pipeline maestro-assistant complet (mock LLM)

| # | Cas d'usage | Ce qu'on verifie |
|---|-------------|------------------|
| 3.1 | **Premier message** | `ensure-conversation` -> `save-user-message` -> `load-history` -> `execute-agent` -> `save-assistant-response` — TOUS en `done` |
| 3.2 | **Conversation ID propagation** | `_activeConversation` non-vide apres le premier message |
| 3.3 | **Pas d'erreurs** | Aucun node `error` dans `_executionTree`, aucun `error` dans `_executionLog` |
| 3.4 | **Reponse de l'agent** | `_nodeResult_execute-agent` contient le texte mock |
| 3.5 | **Deuxieme message** | Conversation reutilisee (meme `_activeConversation`), pas re-creee |
| 3.6 | **Conditional reuse** | `ensure-conversation` prend la branche `then` au 2e message |
| 3.7 | **New-conversation puis message** | Apres `new-conversation`, le message suivant utilise la nouvelle conversation |
| 3.8 | **Message avec input** | Le `{{message}}` dans le workflow recoit bien le texte envoye |

---

## Architecture

```
packages/maestro-integration-tests/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    test-harness.ts       <- startTestBackend(), stopTestBackend(), importTemplate()
    poll.ts               <- pollUntil()
    assertions.ts         <- assertAllNodesDone(tree), assertNoErrors(log)
  tests/
    setup.ts              <- globalSetup vitest
    level-1-api/
      health.test.ts
      sessions.test.ts
      variables.test.ts
      blocks.test.ts
      templates.test.ts
    level-2-workflow/
      new-conversation.test.ts
      clear-conversation.test.ts
      variable-propagation.test.ts
    level-3-pipeline/
      first-message.test.ts
      second-message.test.ts
      new-then-message.test.ts
```

---

## Sous-phases

| Phase | Fichier | Description |
|-------|---------|-------------|
| 47-A | `47-A.md` | Scaffolding + Health Test |
| 47-B | `47-B.md` | Level 1 — Tests API |
| 47-C | `47-C.md` | Level 2 — Tests Workflow |
| 47-D | `47-D.md` | Level 3 — Tests Pipeline |
| 47-E | `47-E.md` | Documentation et finalisation |

---

## Definition of Done

1. `npm run test:api` passe — API backend verifie (14+ tests)
2. `npm run test:workflow` passe — execution de workflows verifiee (8+ tests)
3. `npm run test:pipeline` — soit passe (bug corrige) soit echoue sur le bug connu (bug confirme par tests)
4. Zero cout LLM pour tous les tests
5. Chaque test cree sa propre session (isolation)
6. Sidecar demarre/s'arrete proprement
7. Documentation a jour

## NOT in scope

- Corriger le bug `Conversation '' not found` — les tests doivent le TROUVER, pas le corriger
- Tests Level 4 avec vrai LLM (Phase 48)
- CI/CD — tests locaux d'abord
- Tests SignalR temps reel
- Tests de performance
- Refactoring du backend

## Fichiers critiques

| Fichier | Pourquoi |
|---------|----------|
| `packages/maestro-sidecar/src/sidecar.ts` | API du sidecar |
| `packages/maestro-client/src/client.ts` | SDK type |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Moteur d'execution |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | TryLoadMockResponse() |
| `content/system/blocks/workflows/maestro-assistant-workflow.block.json` | Le workflow avec le bug |
| `content/system/templates/sessions/maestro-assistant.session.json` | Template avec variables et entry points |
