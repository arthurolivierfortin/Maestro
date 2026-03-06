# Phase 55 : Agent agent-creator — Implementation du contract agent-creator

**Statut** : A FAIRE
**Prerequis** : Phase 54 COMPLETE (contract test runner verifie avec FitnessScore)
**Objectif** : Creer l'agent `agent-creator` qui cree des blocks agents, les teste contre un contract, et itere jusqu'a ce que les tests passent. C'est le coeur du systeme de creation automatisee.
**Duree estimee** : 4-5 jours

---

## ATTENTION — Misconceptions a eviter

### Un agent Maestro N'EST PAS un inference block

(Meme avertissement que Phase 52 — repete intentionnellement car critique)

Un agent (`blockType: "agent"`) est un block **non-atomique** qui peut contenir des child blocks. Il a une **boucle agentique** : message → outil → resultat → decision → outil → ... → step-complete.

L'agent-creator ne "genere pas un JSON en un shot". Il :
1. Lit l'analyse et les tests (produits par test-designer)
2. Cree un premier brouillon du block (file-write)
3. Valide la structure (json-validator)
4. Si invalide → corrige et re-valide
5. Lance les tests d'acceptance (block-test-run)
6. Lit les resultats
7. Si des tests echouent → modifie le prompt ou la config
8. Re-teste
9. Repete jusqu'a ce que les tests passent ou maxIterations atteint
10. step-complete avec le resultat

C'est une **boucle create-test-fix**, pas un template filler.

### L'agent-creator est potentiellement composite

Contrairement au test-designer (atomique, tache simple), l'agent-creator fait des choses complexes :
- Generer du JSON block (necessite connaissance du schema)
- Ecrire des system prompts (necessite comprendre les conventions Maestro)
- Lancer et interpreter des tests

Il POURRAIT etre composite (`isAtomic: false`) avec des child blocks pour la generation et la validation. La decision se prendra pendant l'implementation — commencer atomique, rendre composite si necessaire.

### Claude copilot : phase isolee pour rester focus

Cette phase est probablement la plus complexe des 4. Le system prompt de l'agent-creator doit contenir :
- L'anatomie complete d'un block.json (20+ champs)
- Les conventions de system prompt Maestro
- L'adaptation par tier de modele
- Les outils disponibles et leurs schemas
- La boucle create-test-fix
- Des exemples reels

C'est un gros livrable. Ne pas le melanger avec d'autres taches.

---

## Le contract agent-creator (reference — defini en Phase 51)

```
Contract: agent-creator
├─ Feature: "Block Generation"
│    requires: [structured-output, tool-calling]
│    tests: cree un block.json valide avec tous les champs requis
│
├─ Feature: "Prompt Writing"
│    requires: [conversation, structured-output]
│    tests: ecrit un system-prompt.md adapte au role et au modele
│
├─ Feature: "Iterative Improvement"
│    requires: [tool-calling, structured-output]
│    tests: lit les resultats de test, identifie les problemes, corrige
│
├─ Feature: "Model Adaptation"
│    requires: [structured-output, tool-calling]
│    tests: adapte le prompt pour differents tiers (large/medium/small)
```

---

## Architecture de l'agent

### Outils accessibles

| Outil | Usage |
|-------|-------|
| `file-read` | Lire contracts, blocks existants, tests |
| `file-write` | Ecrire block.json, system-prompt.md |
| `json-validator` | Valider le JSON genere |
| `block-create` | Creer un block via POST /api/blocks |
| `block-test-run` | Lancer un test run via POST /api/block-tests/runs |
| `block-test-results` | Lire les resultats via GET /api/block-tests/runs/{id} |
| `directory-list` | Explorer les blocks/contracts existants |
| `shell-execute` | Lancer des commandes (ex: dotnet build pour validation) |
| `step-complete` | Signaler la fin du travail |

### Inputs / Outputs

**Inputs** :
- `description` (string, required) — Ce que l'agent doit faire
- `contractId` (string, optional) — Contract cible
- `targetModel` (string, optional) — Modele cible pour adaptation
- `testSuite` (string, optional) — Tests pre-generes par test-designer
- `baseBlockId` (string, optional) — Block existant a adapter (pour /adapt)

**Outputs** :
- `blockId` (string) — ID du block cree
- `blockPath` (string) — Chemin du block sur le filesystem
- `testResults` (string) — JSON des resultats de tests
- `fitness` (number) — Score de fitness

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 53-A | Block definition + system prompt (LE gros livrable) | 2.5 jours |
| 53-B | Tests, validation create-test-fix loop, iteration du prompt | 2 jours |

---

## 53-A : Block definition + system prompt

### Lecture obligatoire
- `docs/system/architecture/contracts.md` (Phase 51)
- `content/system/contracts/agent-creator.contract.json` (Phase 51)
- `content/system/blocks/agents/dev-orchestrator/` (reference agent composite)
- `content/system/blocks/agents/dev-orchestrator/system-prompt.md`
- `content/system/blocks/system/maestro-assistant/system-prompt.md` (prompt avance)
- `content/system/blocks/system/maestro-assistant-compact/` (variante light)
- `content/system/blocks/agents/test-writer/system-prompt.md` (conventions outils)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs`
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` (API creation)
- `apps/backend/src/Maestro.Api/Controllers/BlockTestController.cs` (API tests)

### Taches

1. **Creer `agent-creator.agent.block.json`** :
   - `blockType: "agent"`
   - Decision atomique vs composite pendant l'implementation
   - `config.model: "claude-sonnet-4-6"` (ou opus pour la premiere version)
   - `config.maxIterations: 25` (assez pour create-test-fix loop)
   - `contract: "agent-creator"`
   - `capabilities: ["conversation", "structured-output", "tool-calling"]`

2. **Ecrire `system-prompt.md`** — LE livrable le plus complexe :
   - Section 1 : Role ("Tu crees des agents Maestro qui passent leur contract")
   - Section 2 : Anatomie d'un block.json — TOUS les champs, avec exemples reels
     - Inclure un example complet d'un agent block (copie de dev-orchestrator ou test-writer)
   - Section 3 : Conventions system prompt Maestro
     - JSON only response
     - step-complete obligatoire
     - Format des tool calls
     - Max iterations awareness
   - Section 4 : Adaptation par tier de modele
     - Large (opus/sonnet): prompts nuances, instructions complexes
     - Medium (gpt-4o, mistral-large): structure claire, listes explicites
     - Small (7B, 3B): COURT, direct, exemples lourds, pas de nuance
   - Section 5 : La boucle create-test-fix
     1. Lire l'analyse et les tests
     2. Creer le block JSON (file-write)
     3. Valider la structure (json-validator)
     4. Ecrire le system prompt (file-write)
     5. Enregistrer le block (block-create)
     6. Lancer les tests (block-test-run)
     7. Lire les resultats (block-test-results)
     8. Si echec: identifier le probleme, modifier, re-tester
     9. step-complete quand tests passent
   - Section 6 : Mode adaptation (quand baseBlockId est fourni)
     - Lire le block existant
     - Adapter le prompt pour le modele cible
     - Ajuster maxIterations, maxTokens, temperature
     - NE PAS changer le contract ni les capabilities declarees
   - Section 7 : Outils disponibles (format JSON exact)
   - Section 8 : Anti-patterns
     - NE PAS generer un prompt generique "You are a helpful assistant"
     - NE PAS ignorer les resultats de test — lire et corriger
     - NE PAS re-generer from scratch a chaque iteration — corriger chirurgicalement
   - Section 9 : Exemples (description → block genere → prompt genere)

### Verification
```bash
python -m json.tool content/system/blocks/agents/agent-creator/agent-creator.agent.block.json
cd apps/backend && dotnet build
curl http://localhost:5000/api/blocks | grep agent-creator
```

---

## 53-B : Tests et validation de la boucle create-test-fix

### Taches

1. **Test manuel** : invoquer l'agent-creator pour creer un simple agent
   ```bash
   cd packages/maestro-cli
   node index.js session create --type project --name "Agent Creator Test" --repo C:\Meastro --start
   node index.js session invoke <id> default \
     --input description="An agent that reviews code quality" \
     --input contractId=code-reviewer
   ```

2. **Verifier la boucle** :
   - L'agent cree-t-il un block.json valide ?
   - L'agent ecrit-il un system-prompt.md ?
   - L'agent lance-t-il les tests ?
   - Quand un test echoue, l'agent corrige-t-il ?
   - L'agent finit-il avec step-complete ?

3. **Tester le mode adaptation** :
   ```bash
   node index.js session invoke <id> default \
     --input description="Adapt maestro-assistant for small models" \
     --input baseBlockId=system:maestro-assistant \
     --input targetModel=mistral-7b
   ```

4. **Valider contre le contract** :
   - Le block genere passe-t-il les tests du contract agent-creator ?
   - Score par feature

5. **Iterer le prompt** si necessaire

### Verification
```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
```

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] `agent-creator.agent.block.json` cree et decouvert
- [ ] `system-prompt.md` complet (9 sections, exemples, anti-patterns)
- [ ] L'agent cree un block valide a partir d'une description
- [ ] L'agent ecrit un system prompt adapte au role
- [ ] La boucle create-test-fix fonctionne (au moins 1 correction observee)
- [ ] Le mode adaptation fonctionne (baseBlockId → variante)
- [ ] L'agent passe son propre contract (agent-creator.contract.json)
- [ ] Tous les tests existants passent

### NOT in scope
- Workflow block-forge (Phase 56)
- TUI /create-agent (Phase 56)
- /adapt comme commande (Phase 57+)
- Production de variantes en batch
