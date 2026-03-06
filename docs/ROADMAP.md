# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-06
**Version actuelle** : v0.1.0-alpha (tag sur main)

---

## Phases completees (v0.1.0-alpha)

| Phase | Titre | Statut |
|-------|-------|--------|
| 4-10 | Infrastructure de base (blocks, sessions, execution, CLI) | COMPLETE |
| 11 | LLM Output Safety (JSON extraction, write guard) | COMPLETE |
| 12 | Runtime, CLI JSON, Universal Repo Binding | COMPLETE |
| 13 | Training Research + Directory Restructuring | COMPLETE |
| 14 | Documentation System + Publishing Architecture | COMPLETE |
| 15 | TUI Migration blessed → Ink | COMPLETE |
| 16 | TypeScript Migration + Shared Layer | COMPLETE |
| 17 | Shared Theme + Contextual Navigation + Keybindings | COMPLETE |
| 18 | ADR Blocks Are The Universal Unit | COMPLETE |
| 19 | First Version Planning (vision document) | COMPLETE (doc only) |
| 20-22 | V1 Features | COMPLETE |
| 23-25 | V2 Features + Shared App Logic | COMPLETE |
| 26 | V3 Autonomous Dev Agent (coaching, Cantante) | COMPLETE |
| 26-B | Claude Code LLM Provider | COMPLETE |
| 27 | Infrastructure | COMPLETE |
| 28 | V3 Roadmap + Suggestions | COMPLETE (planning) |
| 29 | Purpose document (adapt/optimize) | COMPLETE (planning) |
| 30 | Autonomous Dev v3 (8 nodes, 7 sub-blocks, 3/3 tests) | COMPLETE |
| 31-PRESOL | Bug fixes (TUI leaks, phase display, json-validator, quality gates) | COMPLETE |
| 31 | Solidification des fondations (publish, audit, usage reel Cantante) | COMPLETE |
| 32 | CLI Polish + maestro init + aliases + review gate | COMPLETE |
| 33 | `maestro code` — TUI interactive + headless + tests (29/29) | COMPLETE |
| 33-B | Audit UX & Ameliorations CLI (32/32 tests) | COMPLETE |
| 33-C | Consolidation TUI Monorepo (40+4+32 tests) | COMPLETE |
| 33-D | Restructuration Monorepo (apps/, cleanup, docs) | COMPLETE |
| 34-E-PRE | Extraction Conversation + Context comme entites | COMPLETE |
| 35-PRE | Agent composite, tool dispatch JSON, dev-orchestrator | COMPLETE |
| 35 | Dogfooding — Maestro autonome sur Cantante (34 sessions, 41 fixes, 100% post-fix) | COMPLETE |
| 36 | Contexte, Memoire et Documentation (conversation/context/memory blocks, attached docs, TUI context panel) | COMPLETE |
| 37 | Maestro Runtime & SDK (@maestro/client, @maestro/sidecar, Jarvis, voice, CLI migration) | COMPLETE |
| 38 | Sandbox Foundry — git worktrees + Docker, session integration, batch testing (22 tests) | COMPLETE |
| 39 | `maestro adapt` + `maestro optimize` — manifest extraction, model substitution, temperature tuning (16 tests) | COMPLETE |
| 40-PRE | Maestro Code — L'App Unifiee (agent-first architecture, shared @maestro/tui, identity) | COMPLETE |
| 41-PRE | Spatial TUI (Page Registry, 2D grid, mascotte, command palette) | COMPLETE (remplace par Phase 42) |
| 42 | Restructuration maestro-code = Monitor + AgentPanel + keyboard fix | COMPLETE |
| 43 | Visual Gate — PTY Capture + Golden Files + Structural Assertions | COMPLETE |
| 44 | Dogfooding Pragmatique — Cantante + Jarvis (4/4 taches, 8 sessions, 100% succes) | COMPLETE |
| 46 | Unit Tests — 89 tests maestro-code | COMPLETE |
| 47 | Integration Tests — 31 tests, condition quote stripping fix | COMPLETE |
| 48 | Bug Fixes Dogfooding + dynamic blockRef + local agent | COMPLETE |
| 49 | Hardware-Aware Setup + Agent Capabilities + Provider Metrics (28 tests, E2E 4/5) | COMPLETE |
| 50 | Contracts + Second Assistant + Fondations Adapt (141 tests, E2E 5/5) | COMPLETE |
| 51 | Contract System — Schema, documentation, verification, bareme | COMPLETE |
| 52 | Agent test-designer + Contract Test Runner | COMPLETE |
| 53 | Agent et Workflow = Multi-Node Blocks (EntryPointExecutor 4272→196 lignes, 9 executors) | COMPLETE |
| 54 | Re-verification Phase 52 — FitnessScore, tests dans contract, E2E (fitness=0.0037) | COMPLETE |
| 53-B | Decomposition NodeExecutionEngine (2431 → 1815 lignes, 3 classes extraites) | COMPLETE |

---

## Vision strategique (mise a jour 2026-03-05)

> **Trois concepts fondamentaux** :
>
> **Contract** = un role verifiable qu'un block peut remplir (ex: `maestro-assistant`, `code-reviewer`).
> Le contract definit des **features** (groupements fonctionnels), chacune avec des **tests concrets**.
> Plusieurs blocks peuvent implementer le meme contract. L'utilisateur choisit lequel utiliser.
>
> **Feature** = un groupement fonctionnel visible par l'utilisateur (ex: "Conversation", "Maestro Operations").
> Une feature est active si le block a TOUTES les **capabilities** requises par cette feature.
> C'est ce qui s'affiche +/- dans l'AssistantSelector.
>
> **Capability** = une competence atomique d'un block (ex: `conversation`, `structured-output`, `tool-calling`).
> Les capabilities sont declarees dans le block.json. Elles determinent quelles features sont actives.
>
> La hierarchie : **Contract > Features > Capabilities > Tests**
> Voir `docs/system/architecture/contracts.md` pour la documentation complete.
>
> `/adapt` est un workflow qui utilise le workflow `block-forge` (test-designer + agent-creator)
> pour creer des variantes qui implementent le meme contract, optimisees pour un modele/hardware donne.

### Sequence logique

```
1. Contract System (schema, docs, verification, bareme)              ← Phase 51 ✓
2. Agent test-designer (lit un contract → produit des tests)          ← Phase 52 ✓
3. Agent et Workflow = Multi-Node Blocks (plus de monolithe)           ← Phase 53 ✓
4. Re-verification Phase 52 (FitnessScore, tests dans contract)      ← Phase 54 ✓
4b. Decomposition NodeExecutionEngine (2431 → 1815 lignes)           ← Phase 53-B ✓
5. Agent agent-creator (cree un block, teste, itere)                  ← Phase 55 (NEXT)
6. Workflow block-forge + /create-agent TUI/CLI                       ← Phase 56
7. /adapt = workflow block-forge avec baseBlockId                     ← Phase 57
8. Production ~30 variantes pre-testees avec /adapt                   ← Phase 58
9. Choix assistant au setup + Catalog par contract                    ← Phase 59
10. Catalogue communautaire organise par contract                     ← Phase 60
11. Premiere version deployable                                       ← Phase 61
12. Self-improvement loop                                             ← Phase 62+
```

---

## Phases actives et a venir

---

### Phase 50 : Contracts + Second Assistant + Fondations Adapt — COMPLETE

**Resultats** : Contract field sur BlockDefinition, feature gating par capabilities, AssistantSelector au first-run, SDK fitness, adapt-optimize type-safe. 141 tests, E2E 5/5.

**Checkpoint** : `docs/phases/PHASE-50/checkpoint.md`

---

### Phase 51 : Contract System — Schema, documentation, verification, bareme — COMPLETE

**But** : Faire du contract un systeme verifiable et documente. Definir la distinction contract/features/capabilities/tests. Enrichir le schema avec tests et baremes. Ecrire les contracts concrets.

**Aucun agent n'est cree dans cette phase.** C'est la fondation sur laquelle tout le reste repose.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 51-A | Documentation : contracts.md (hierarchie, exemples, ce que c'est / ce que c'est pas) | 1 jour |
| 51-B | Schema enrichi (tests[], weight, minimumScore, scoring) + backend API /api/contracts | 1.5 jours |
| 51-C | 4 contracts concrets : maestro-assistant v2, test-designer, agent-creator, block-forge | 1.5 jours |

**Gate** : GET /api/contracts retourne 4+ contracts enrichis avec tests. Documentation lisible.

---

### Phase 52 : Agent test-designer + Contract Test Runner — COMPLETE

**But** : Premier agent cree avec le nouveau contract system. Lit un contract, produit des tests d'acceptance executables. Puis : le test runner qui execute ces tests contre un block et calcule un score de fitness.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 52-A | Block definition + system prompt detaille (conventions, exemples, anti-patterns) | 2 jours |
| 52-B | Test manuel, validation contre son propre contract, iteration du prompt | 1.5 jours |
| 52-C | Contract Test Runner : execution reelle des tests, 8 check types, scoring par feature, tool block `contract-test` | 2.5 jours |

**Gate** : Le test-designer produit des tests valides. Le test runner les execute et retourne un score de fitness par feature.

**Problemes identifies** (a corriger en Phase 54) :
- ContractTestRunner utilise une formule simpliste au lieu de `FitnessScore.Calculate()`
- Les test-suites sont dans des fichiers separes au lieu d'etre dans les contracts
- Le dispatch de tools est monolithique dans `AgentBlockExecutor` (Phase 53)

---

### Phase 53 : Agent et Workflow = Multi-Node Blocks — COMPLETE

**Resultats** : EntryPointExecutor 4272→196 lignes (NodeExecutionEngine + SessionStateManager). AgentBlockExecutor 1400→124 lignes. ToolBlockExecutor 1400→78 lignes. 9 atomic executors, 3 agent-loop templates, 20 agents + 10 tools migres en config.nodes. Zero regression.

**Checkpoint** : `docs/phases/PHASE-53/checkpoint.md`
**ADR** : `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md`

---

### Phase 53-B : Decomposition NodeExecutionEngine — COMPLETE

**Resultats** : NodeExecutionEngine 2431 → 1815 lignes (-25.3%). Extracted: TemplateResolver (201), ConditionEvaluator (113), SessionHelper (292). ExecuteNodesAsync (legacy) supprime. All tests pass.

**Checkpoint** : `docs/phases/PHASE-53-B/checkpoint.md`

---

### Phase 54 : Re-verification Phase 52 — Contract Test Runner + FitnessScore — COMPLETE

**Resultats** : Test-suites supprimees (tests dans contract JSON). FitnessScore.Calculate() integre. SessionId regression fixee. E2E verifie : test-designer 3 iterations, 12 tests, fitness=0.0037 (P=0.3). 5 bugs E2E corriges (output serialization, blockType mismatch, checkpoint recursion, missing executors, shell config fallback).

**Checkpoint** : `docs/phases/PHASE-54/checkpoint.md`

---

### Phase 55 : Agent agent-creator — Implementation du contract agent-creator

**But** : Agent avec boucle create-test-fix. Cree des blocks, les teste contre un contract, itere jusqu'a ce que les tests passent.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 55-A | Block definition + system prompt complexe (anatomie block, conventions, adaptation) | 2.5 jours |
| 55-B | Test de la boucle create-test-fix, mode adaptation, validation contract | 2 jours |

**Gate** : L'agent cree un block valide qui passe les tests du contract cible. La boucle create-test-fix fonctionne.

**Plan detaille** : `docs/phases/PHASE-55/README.md`

---

### Phase 56 : Workflow block-forge + Integration TUI/CLI

**But** : Assembler test-designer et agent-creator dans un workflow. TUI `/create-agent` et CLI `maestro create-agent`. 2 contracts supplementaires. Dogfooding.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 56-A | Workflow block-forge + inference request-analyzer + 2 contracts (code-reviewer, test-generator) | 1.5 jours |
| 56-B | TUI /create-agent + CLI maestro create-agent + demo mode | 1.5 jours |
| 56-C | Dogfooding : 2 agents crees via /create-agent, comparaison vs creation manuelle | 1 jour |

**Gate** : 2 agents crees via /create-agent avec fitness > 0.5. Score experience >= 3/5.

---

### Phase 57 : /adapt = Workflow block-forge + Contract Resolution

**But** : `/adapt` utilise block-forge pour creer des variantes d'un block optimisees pour un modele/hardware donne. La variante implemente le meme contract que l'original. `contractRef` dans les workflows.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 57-A | Commande /adapt : invoque block-forge avec baseBlockId + targetModel | 2-3 jours |
| 57-B | `contractRef` dans les workflows (resolution runtime + verification capabilities) | 1-2 jours |
| 57-C | Integration TUI : `/adapt` dans AgentPanel, `[A]` dans CatalogScreen | 1 jour |

---

### Phase 58 : Production des variantes pre-testees

**But** : Utiliser `/adapt` pour creer ~30 implementations du contract `maestro-assistant` avec capabilities verifiees. Config providers cloud opensource.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 58-A | Configuration providers cloud opensource dans LLM-Provider .NET | 2-3 jours |
| 58-B | Execution de `/adapt` par profil hardware (capabilities verifiees par tier) | 3-5 jours |
| 58-C | Validation, tri, integration dans `content/system/blocks/` | 1-2 jours |

**Gate** : 15+ variantes fitness > 0.6, toutes contract `maestro-assistant`, capabilities verifiees.

---

### Phase 59 : Choix assistant au setup + Catalog par contract

**But** : L'utilisateur voit les implementations du contract `maestro-assistant` compatibles avec son hardware, avec features actives/inactives, et choisit.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 59-A | Filtrage compatibilite + feature gating UI | 1 jour |
| 59-B | UI de choix au setup (par contract, features actives/inactives, recommended) | 1.5-2 jours |
| 59-C | Catalog organise par contract + changement d'implementation | 1 jour |
| 59-D | Dogfooding complet | 0.5 jour |

**Gate** : L'utilisateur comprend ce qu'il gagne/perd avec chaque choix.

---

### Phase 60 : Catalogue communautaire + Auth

**But** : Publier et importer des blocks. Catalogue organise par contract.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 60-A | Auth + comptes utilisateurs (JWT, SQLite) | 3-5 jours |
| 60-B | Catalogue backend (publish/search/import par contract + capabilities) | 3-5 jours |
| 60-C | TUI integration (local + community, par contract, filtrage hardware) | 2-3 jours |

---

### Phase 61 : Premiere version deployable

**But** : `npm install -g @maestro/cli && maestro init && maestro code`.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 61-A | Packaging npm, commande globale, sidecar auto-start | 3-4 jours |
| 61-B | `maestro init` + onboarding (provider + choix assistant par contract) | 2-3 jours |
| 61-C | Documentation : README, Getting Started, 3 exemples | 2-3 jours |
| 61-D | Beta testing (3-5 testeurs) | 3-5 jours |

**Gate** : 3 testeurs externes installent, choisissent leur assistant par contract, et accomplissent des taches reelles.

---

### Phase 62+ : Self-Improvement — Maestro s'ameliore lui-meme

**But** : Research Team observe les metriques par contract/capability → `/adapt` cree des variantes ameliorees → Workspace Orchestrator gere la promotion. L'Agent Creator s'ameliore lui-meme.

---

## Chaine de dependances

```
50 Contracts + second assistant + fondations adapt (DONE)
 └→ 51 Contract System (schema, docs, verification, bareme) (DONE)
     └→ 52 Agent test-designer + Contract Test Runner (DONE)
         └→ 53 Agent = Multi-Node Blocks (DONE)
             └→ 54 Re-verification Phase 52 (FitnessScore, tests dans contract) (DONE)
                 └→ 53-B Decomposition NodeExecutionEngine (DONE)
                     └→ 55 Agent agent-creator (cree block, teste, itere) (NEXT)
                         └→ 56 Workflow block-forge + /create-agent TUI/CLI
                             └→ 57 /adapt = block-forge + contractRef
                                 └→ 58 Production ~30 variantes
                                     └→ 59 Choix au setup par contract
                                         └→ 60 Catalogue communautaire
                                             └→ 61 Premiere version deployable
                                                 └→ 62+ Self-improvement loop
```

## Features planifiees (TODOS)

| Feature | Phase cible | Statut |
|---------|-------------|--------|
| Concept contract + feature gating par capabilities | 50-A | COMPLETE |
| Nettoyage adapt-optimize + SDK fitness | 50-B | COMPLETE |
| Second maestro-assistant (meme contract) | 50-C | COMPLETE |
| Contract System (schema enrichi, docs, tests, bareme) | 51 | COMPLETE |
| Agent test-designer (contract -> tests d'acceptance) | 52-A/B | COMPLETE |
| Contract Test Runner (execution tests, scoring, tool block) | 52-C | COMPLETE |
| Agent = Multi-Node Blocks (response-parser, tool-dispatcher, agent-loop) | 53 | COMPLETE |
| Re-verification Phase 52 (FitnessScore, tests dans contract) | 54 | COMPLETE |
| Decomposition NodeExecutionEngine (2431 → 1815 lignes) | 53-B | COMPLETE |
| Agent agent-creator (boucle create-test-fix) | 55 | Planifie |
| Workflow block-forge + /create-agent TUI/CLI | 56 | Planifie |
| /adapt + contractRef dans workflows | 57 | Planifie |
| Production ~30 variantes pre-testees | 58 | Planifie |
| Fitness display dans le TUI (score par feature, +/- features) | 59 | Planifie |
| Backend contract filter `GET /api/blocks?contract=X` | 59 | Planifie |
| Choix assistant au setup par contract | 59 | Planifie |
| Catalogue communautaire par contract | 60 | Planifie |
| Premiere version deployable (npm) | 61 | Planifie |
| Self-improvement loop | 62+ | Vision |

## Principes

1. **Livrer avant de perfectionner** — V1 imparfaite > V2 jamais livree
2. **L'agent doit etre UTILE** — Pas juste fonctionnel. Utile au quotidien.
3. **Profondeur avant largeur** — Utiliser ce qui existe avant de construire du nouveau
4. **Pas de refactoring cosmetique** — Seuls les bugs et features bloquees justifient du refactoring
5. **Dogfooding profond** — 2h continu, taches d'orchestration, comparaison vs CLI manuel
6. **Max 3 jours par phase** — Decouper si necessaire
7. **Definition of Done AVANT de coder** — Chaque phase a un "NOT in scope" explicite
8. **Nous sommes nos premiers utilisateurs** — `/adapt` et block-forge servent d'abord a NOUS
9. **Contract > Features > Capabilities > Tests** — Le contract definit le role verifiable. Les features groupent les fonctionnalites. Les capabilities sont atomiques. Les tests prouvent que ca marche.
10. **Chaque agent a son contract** — Definir le contract AVANT d'implementer l'agent. TDD pour blocks.
11. **Tout est un block** — Si c'est dans le moteur d'execution, c'est un block. Le tool dispatch est un block, pas du code interne a l'agent.
