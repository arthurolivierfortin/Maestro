# Phase 61 : Block-Forge V2 — Provider rapide, agents fonctionnels E2E

**Statut** : A faire
**Prerequis** : Phase 59 COMPLETE (agent isolation), Phase 60 optionnel (playground utile pour debug)
**Objectif** : Rendre block-forge utilisable en production. Utiliser un provider rapide (Anthropic API / GitHub Models au lieu de Claude Code CLI), corriger les outputs structures (blockId, fitness), et creer 2 agents fonctionnels (code-reviewer, test-generator) avec fitness > 0.5.
**Duree estimee** : 3-5 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-61/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier l'architecture des blocks** — cette phase utilise l'infrastructure existante, pas la refactore
5. **Ne PAS ignorer les couts** — configurer des limites avant chaque test (Phase 59-PRE/59-PRE-2)
6. **Ne PAS declarer un agent "fonctionnel" sans fitness > 0.5 verifie** par le contract test runner

---

## Contexte

### Le probleme (identifie en Phase 58-C)

Block-forge fonctionne architecturalement mais n'est pas utilisable en production :
- **Trop lent** : 15+ minutes via Claude Code CLI (chaque appel LLM = 30-60s de round-trip)
- **Outputs casses** : blockId et fitness sont des textes bruts au lieu de valeurs structurees
- **Agents non isoles** : les variables du test-designer polluent l'agent-creator (corrige par Phase 59)
- **Cout invisible** : $0.000 car le tracking etait casse dans ce contexte (corrige par Phase 59-PRE)

### La solution

1. **Provider rapide** : utiliser Anthropic API directement (ou GitHub Models) au lieu de Claude Code CLI. Latence attendue : 2-5s par appel au lieu de 30-60s. Workflow total < 5 min.
2. **Outputs structures** : valider que ResponseParserBlockExecutor extrait correctement blockId, fitness, blockPath des arguments step-complete.
3. **Isolation** (Phase 59) : chaque agent dans sa session enfant.
4. **Benchmark** : comparer les resultats sur 2+ modeles par contract.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 61-A | Provider rapide dans block-forge + correction outputs structures | 1-2 jours |
| 61-B | Creer code-reviewer + test-generator agents avec fitness > 0.5 | 1-2 jours |
| 61-C | Benchmark multi-modeles sur contracts + documentation resultats | 1 jour |
| 61-T | Tests E2E : workflow complet avec outputs valides | 0.5 jour |

---

## 61-A : Provider rapide + outputs structures

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `content/system/blocks/agents/agent-creator/agent-creator.agent.block.json` | Modifier — configurer model vers provider rapide (Anthropic API / GitHub Models) |
| `content/system/blocks/agents/test-designer/test-designer.agent.block.json` | Modifier — idem |
| `content/system/blocks/workflows/block-forge/block-forge.workflow.block.json` | Verifier — variables passees entre nodes |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ResponseParserBlockExecutor.cs` | Verifier/corriger — extraction blockId, fitness des args step-complete |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Verifier — forward _agent* vars vers outputs |

### Verification

```bash
dotnet build apps/backend/src/Maestro.Api/Maestro.Api.csproj

# Lancer block-forge via CLI
node packages/maestro-cli/index.js session create --type project --name "BF-V2 Test" --template block-forge --repo C:\Meastro --start
node packages/maestro-cli/index.js session invoke <id> default --input description="An agent that reviews TypeScript code" --input contractId="code-reviewer"

# Verifier : termine en < 5 min
# Verifier : blockId est un ID valide (pas du texte)
# Verifier : fitness est un nombre (0.XX)
curl http://localhost:5000/api/sessions/<id>/variables
```

---

## 61-B : Creer 2 agents avec fitness > 0.5

### Taches

1. **code-reviewer** via `/create-agent` :
   - Description : "An agent that reviews TypeScript/JavaScript code for bugs, style, and best practices"
   - Contract : `code-reviewer`
   - Verifier : fitness > 0.5 sur au moins 2/4 features

2. **test-generator** via `/create-agent` :
   - Description : "An agent that generates vitest unit tests for TypeScript functions"
   - Contract : `test-generator`
   - Verifier : fitness > 0.5 sur au moins 2/3 features

3. **Iterer si necessaire** : relancer avec des descriptions differentes, tester avec differents modeles

### Verification

```bash
# Verifier les blocks crees
node packages/maestro-cli/index.js block list --contract code-reviewer
node packages/maestro-cli/index.js block list --contract test-generator

# Verifier le fitness
curl http://localhost:5000/api/blocks/<block-id>/fitness
# Resultat : fitness > 0.5
```

---

## 61-C : Benchmark multi-modeles

### Taches

1. **Comparer 2+ modeles** pour chaque contract :
   - claude-sonnet-4-6 (Anthropic API)
   - gpt-4o (GitHub Models)
   - Optionnel : modele local si disponible

2. **Documenter les resultats** :
   - Tableau : modele, contract, fitness, cout, temps, features actives
   - Identifier le meilleur modele par contract

3. **Creer `docs/phases/PHASE-61/benchmark-results.md`**

---

## 61-T : Tests

### Couches applicables

| Couche | Quand obligatoire |
|--------|-------------------|
| C1 — Type Check | Toujours |
| C5 — Tests d'integration | Workflow block-forge E2E avec outputs valides |
| C6 — E2E Dogfooding | 2 agents crees via /create-agent |

### Scenarios de test

1. **Workflow complet** : block-forge termine en < 5 min avec outputs structures valides
2. **blockId valide** : le block cree existe dans le catalog
3. **fitness valide** : nombre entre 0 et 1, > 0.5 pour au moins un agent
4. **Couts reels** : `costs summary` montre un cout > $0 apres l'execution
5. **Isolation** : les 2 agents du workflow (test-designer, agent-creator) ne partagent pas de variables

---

## Definition of Done

- [ ] Block-forge utilise un provider rapide (< 5 min pour un workflow complet)
- [ ] Outputs structures (blockId, fitness) sont des valeurs valides, pas du texte brut
- [ ] 2 agents crees : code-reviewer (fitness > 0.5) + test-generator (fitness > 0.5)
- [ ] Benchmark documente pour 2+ modeles
- [ ] Couts reels visibles apres execution
- [ ] Tests E2E passent
- [ ] 0 regression

### NOT in scope

- /adapt workflow (Phase 62)
- Production de ~30 variantes (Phase 63)
- Modification du contract system
- Nouveaux contracts (utiliser code-reviewer et test-generator existants)

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-61/checkpoint.md`

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 61 : Block-Forge V2 (provider rapide, 2 agents E2E, benchmark)"
- Mettre a jour : "Current Project State"
