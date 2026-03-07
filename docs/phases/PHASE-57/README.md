# Phase 57 : Agent agent-creator — Implementation du contract agent-creator

**Statut** : EN COURS
**Prerequis** : Phase 56 COMPLETE (Metrics Pipeline — fitness reel)
**Objectif** : Creer l'agent `agent-creator` qui cree des blocks agents, les teste contre un contract, et itere jusqu'a ce que les tests passent. C'est le coeur du systeme de creation automatisee.
**Duree estimee** : 4-5 jours

---

## ATTENTION — Misconceptions a eviter

### Un agent Maestro N'EST PAS un inference block

Un agent (`blockType: "agent"`) est un block **non-atomique** qui peut contenir des child blocks. Il a une **boucle agentique** : message → outil → resultat → decision → outil → ... → step-complete.

L'agent-creator ne "genere pas un JSON en un shot". Il :
1. Lit le contract cible et les tests
2. Cree un premier brouillon du block (file-write)
3. Valide la structure (json-validator)
4. Si invalide → corrige et re-valide
5. Lance les tests d'acceptance (contract-test)
6. Lit les resultats
7. Si des tests echouent → modifie le prompt ou la config
8. Re-teste
9. Repete jusqu'a ce que les tests passent ou maxIterations atteint
10. step-complete avec le resultat

C'est une **boucle create-test-fix**, pas un template filler.

---

## Le contract agent-creator (reference — defini en Phase 51)

Fichier : `content/system/contracts/agent-creator.contract.json`

```
Contract: agent-creator
├─ Feature: "Block Generation" (weight: 0.30)
│    requires: [structured-output]
│    tests: cree un block.json valide avec tous les champs requis
│
├─ Feature: "Prompt Writing" (weight: 0.25)
│    requires: [conversation]
│    tests: ecrit un system-prompt.md adapte au role et au modele
│
├─ Feature: "Iterative Improvement" (weight: 0.25)
│    requires: [conversation, structured-output]
│    tests: lit les resultats de test, identifie les problemes, corrige
│
├─ Feature: "Model Adaptation" (weight: 0.20)
│    requires: [conversation, structured-output]
│    tests: adapte le prompt pour differents tiers (large/medium/small)
```

---

## Outils accessibles par l'agent

| Outil | Block ID | Usage |
|-------|----------|-------|
| `file-read` | `file-read` | Lire contracts, blocks existants, tests |
| `file-write` | `file-write` | Ecrire block.json, system-prompt.md |
| `directory-list` | `directory-list` | Explorer les blocks/contracts existants |
| `json-validator` | `json-validator` | Valider le JSON genere |
| `contract-test` | `contract-test` | Lancer les tests du contract et obtenir le fitness |
| `shell-execute` | `shell-execute` | Commandes systeme |
| `step-complete` | (response-parser) | Signaler la fin du travail |

**Note** : `block-create` n'est PAS necessaire — ecrire les fichiers sur disque via `file-write` suffit, le `FileSystemBlockDiscoveryService` les decouvre automatiquement.

### Inputs / Outputs

**Inputs** :
- `description` (string, required) — Ce que l'agent doit faire
- `contractId` (string, optional) — Contract cible
- `targetModel` (string, optional) — Modele cible pour adaptation
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
| 57-A | Block definition (JSON + config.nodes) + publication directory-list | 0.5 jour |
| 57-B | System prompt (LE gros livrable — 9 sections) | 1.5 jours |
| 57-C | Build, verification, test invocation, iteration du prompt | 2 jours |

---

## 57-A : Block definition + prerequis

### Taches

1. **Publier `directory-list`** : deplacer de `_drafts/tools/` vers `tools/directory-list/`
2. **Creer `agent-creator.agent.block.json`** :
   - Copier le pattern de config.nodes du `test-designer` (while loop, llm-call, parse-response, tool-dispatch)
   - `blockType: "agent"`
   - `config.model: "claude-sonnet-4-6"`
   - `config.maxIterations: 25`
   - `contract: "agent-creator"`
   - `capabilities: ["conversation", "structured-output", "tool-calling"]`
   - Inputs : description, contractId, targetModel, baseBlockId
   - Outputs : blockId, blockPath, testResults, fitness

### Verification
```bash
python -m json.tool content/system/blocks/agents/agent-creator/agent-creator.agent.block.json
dotnet build apps/backend/src/Maestro.Infrastructure/Maestro.Infrastructure.csproj -o /tmp/phase57-build
```

---

## 57-B : System prompt

### Lecture obligatoire (pour l'agent)
- `content/system/contracts/agent-creator.contract.json`
- `content/system/blocks/agents/test-designer/system-prompt.md` (reference prompt)
- `content/system/blocks/system/maestro-assistant/system-prompt.md` (prompt avance)
- `content/system/blocks/agents/test-designer/test-designer.agent.block.json` (reference block)
- `docs/system/architecture/contracts.md` (hierarchie contract > feature > capability > test)

### Taches

1. **Ecrire `system-prompt.md`** — 9 sections :
   - Section 1 : Role ("Tu crees des agents Maestro qui passent leur contract")
   - Section 2 : Anatomie d'un block.json — TOUS les champs, avec example complet
   - Section 3 : Conventions system prompt Maestro (JSON only, step-complete, tool format)
   - Section 4 : Adaptation par tier de modele (large/medium/small)
   - Section 5 : La boucle create-test-fix (etapes detaillees)
   - Section 6 : Mode adaptation (quand baseBlockId est fourni)
   - Section 7 : Outils disponibles (format JSON exact)
   - Section 8 : Anti-patterns
   - Section 9 : Exemples (description → block genere → prompt genere)

---

## 57-C : Verification et test de la boucle

### Taches

1. **Build + verification decouverte** :
   ```bash
   cd apps/backend && dotnet build
   curl http://localhost:5000/api/blocks | grep agent-creator
   ```

2. **Test manuel** : invoquer l'agent pour creer un simple agent
   ```bash
   cd packages/maestro-cli
   node index.js session create --type project --name "Agent Creator Test" --repo C:\Meastro --start
   node index.js session invoke <id> default \
     --input description="An agent that reviews code quality" \
     --input contractId=code-reviewer
   ```

3. **Verifier la boucle** :
   - L'agent cree-t-il un block.json valide ?
   - L'agent ecrit-il un system-prompt.md ?
   - L'agent lance-t-il les tests (contract-test) ?
   - Quand un test echoue, l'agent corrige-t-il ?
   - L'agent finit-il avec step-complete ?

4. **Valider contre son propre contract** :
   ```bash
   node index.js contract test agent-creator agent-creator
   ```

5. **Iterer le prompt** si necessaire

---

## Definition of Done

- [ ] `directory-list` publie (hors _drafts)
- [ ] `agent-creator.agent.block.json` cree et decouvert par l'API
- [ ] `system-prompt.md` complet (9 sections, exemples, anti-patterns)
- [ ] L'agent cree un block valide a partir d'une description
- [ ] L'agent ecrit un system prompt adapte au role
- [ ] La boucle create-test-fix fonctionne (au moins 1 correction observee)
- [ ] Le mode adaptation fonctionne (baseBlockId → variante)
- [ ] Tous les tests existants passent (dotnet build + tsc)

### NOT in scope
- Workflow block-forge (Phase 58)
- TUI /create-agent (Phase 58)
- /adapt comme commande (Phase 59)
- Production de variantes en batch (Phase 60)
