# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-16
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
| 53-C | INodeHandler extraction + DispatchNodeAsync (1792 → 786 lignes, 3 handlers) | COMPLETE |
| 55 | Block Dependency Resolution (manifest, validation, reverse lookup) | COMPLETE |
| 56 | Metrics Pipeline — Fitness Accuracy (chaine de cout, ModelProfile) | COMPLETE |
| 57 | Agent agent-creator (block definition + system prompt + contract test fix) | COMPLETE |
| 58 | Workflow block-forge + /create-agent TUI/CLI (score dogfooding 3/5) | COMPLETE |
| 59-PRE | Gouvernance des Couts + Providers API (limites, historique, Anthropic, GitHub Models) | COMPLETE |
| 59-PRE-2 | Cost Enforcement (hard stop, graceful shutdown, auto-resume) | COMPLETE |

---

## Vision strategique (mise a jour 2026-03-16)

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
=== Phases completees ===
1. Contract System (schema, docs, verification, bareme)              ← Phase 51 ✓
2. Agent test-designer (lit un contract → produit des tests)          ← Phase 52 ✓
3. Agent et Workflow = Multi-Node Blocks (plus de monolithe)           ← Phase 53 ✓
4. Re-verification Phase 52 (FitnessScore, tests dans contract)      ← Phase 54 ✓
4b. Decomposition NodeExecutionEngine (2431 → 1815 lignes)           ← Phase 53-B ✓
4c. INodeHandler extraction + DispatchNodeAsync (1792 → 786 lignes)  ← Phase 53-C ✓
5. Block Dependency Resolution (manifest, validation, reverse lookup)  ← Phase 55 ✓
6. Metrics Pipeline — Fitness Accuracy (chaine de cout, ModelProfile)  ← Phase 56 ✓
7. Agent agent-creator (cree un block, teste, itere)                   ← Phase 57 ✓
8. Workflow block-forge + /create-agent TUI/CLI                        ← Phase 58 ✓
8b. Gouvernance couts + Providers API (limites, historique, TUI)        ← Phase 59-PRE ✓
8c. Cost Enforcement (hard stop, graceful shutdown, auto-resume)       ← Phase 59-PRE-2 ✓

=== V1 ===
9.  Agent Isolation (sessions enfants, I/O controle, permissions)      ← Phase 59
10. Model Playground (tester un modele directement dans le TUI)       ← Phase 60
11. Block-Forge V2 (provider rapide, agents fonctionnels E2E)         ← Phase 61
12. /adapt = block-forge avec baseBlockId + contractRef               ← Phase 62
13. Production variantes (benchmark multi-modeles sur contracts)      ← Phase 63
14. Choix assistant au setup + Catalog par contract                    ← Phase 64
15. Onboarding + Packaging npm (maestro init, first-run)              ← Phase 65
16. V1 Deploy + Beta testing                                           ← Phase 66

=== V2 ===
17. Self-improvement loop (Maestro s'ameliore lui-meme)               ← Phase 67
18. Catalogue communautaire (auth, publish, import par contract)      ← Phase 68
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

### Phase 53-C : INodeHandler Extraction + DispatchNodeAsync — COMPLETE

**Resultats** : NodeExecutionEngine 1792 → 786 lignes (-56.1%). 3 handlers extraits (ForEachNodeHandler, BlockRefHandler, SetVariableNodeHandler). DispatchNodeAsync = point de dispatch unique (elimine duplication + corrige 3 bugs dans parallel dispatch). Open/Closed : nouveau node type = nouvelle classe + DI, zero changement engine.

**Checkpoint** : `docs/phases/PHASE-53-C/checkpoint.md`

---

### Phase 54 : Re-verification Phase 52 — Contract Test Runner + FitnessScore — COMPLETE

**Resultats** : Test-suites supprimees (tests dans contract JSON). FitnessScore.Calculate() integre. SessionId regression fixee. E2E verifie : test-designer 3 iterations, 12 tests, fitness=0.0037 (P=0.3). 5 bugs E2E corriges (output serialization, blockType mismatch, checkpoint recursion, missing executors, shell config fallback).

**Checkpoint** : `docs/phases/PHASE-54/checkpoint.md`

---

### Phase 55 : Block Dependency Resolution — COMPLETE

**But** : Infrastructure fondamentale pour resoudre, valider et visualiser l'arbre de dependances des blocks multi-noeud. Prerequis pour la propagation des couts (Phase 56), /adapt, publication, et affichage catalog.

**Gate** : `maestro block deps maestro-assistant` affiche l'arbre complet avec modeles requis et validation OK.

**Plan detaille** : `docs/phases/PHASE-55/README.md`

---

### Phase 56 : Metrics Pipeline — Fitness Accuracy — COMPLETE

**But** : Rendre le fitness score reel. Reparer la chaine de cout, connecter ModelProfile a LLM-Provider, supprimer les tables de prix hardcodees.

**Gate** : Contract test retourne `EstimatedCostUsd > 0` et un fitness qui reflete le vrai cout du modele.

**Plan detaille** : `docs/phases/PHASE-56/README.md`

---

### Phase 57 : Agent agent-creator — COMPLETE

**Resultats** : Block definition (agent-creator.agent.block.json) + system prompt (994 lignes, 9 sections). Directory-list tool publie. ContractTestRunner fix (conversationHistory). Limite identifiee : contract tests inadequats pour blocks agentiques (verifient le texte de reponse, pas les fichiers crees).

**Checkpoint** : `docs/phases/PHASE-57/checkpoint.md`

---

### Phase 58 : Workflow block-forge + Integration TUI/CLI — COMPLETE

**Resultats** : Workflow block-forge assemble (5 nodes). TUI `/create-agent` + CLI `maestro create-agent`. 2 contracts (code-reviewer, test-generator). Dogfooding 3/5 — pipeline TUI fonctionne (~2s), mais workflow backend 15+ min via Claude Code CLI. Corrections : `globalThis.fetch` → `node:http`, `getApiUrl()` async, polling progression, timeout message, outputs structures backend.

**Checkpoint** : `docs/phases/PHASE-58/checkpoint.md`

---

### Phase 59-PRE : Gouvernance des Couts + Providers API — COMPLETE

**Resultats** : ICostTrackingService, JSONL historique, limites configurables (session/jour/semaine/mois), 4 API endpoints, CLI `maestro costs`, TUI status bar + Spaces cout, provider Anthropic API, provider GitHub Models. Slash command `/costs`.

**Checkpoint** : `docs/phases/PHASE-59-PRE/checkpoint.md`

---

### Phase 59-PRE-2 : Cost Enforcement — COMPLETE

**Resultats** : Config enforcement (block/warn) + autoResume par limite. Hard stop AVANT le prochain block. Session reste idle apres stop. Resume manuel + auto-resume detection.

**Plan detaille** : `docs/phases/PHASE-59-PRE-2/README.md`

---

### Phase 59 : Agent Isolation (sessions enfants, I/O controle, permissions)

**But** : Isoler chaque agent (blockRef) dans une session enfant avec I/O controle et permissions enforces. Prerequis pour que block-forge et /adapt fonctionnent de facon fiable avec plusieurs agents sequentiels.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 59-A | Sessions enfants pour chaque blockRef agent | 1-2 jours |
| 59-B | I/O controle (inputs → outputs, rien d'autre) + _workflowCheckpoint cleanup | 1 jour |
| 59-C | Enforcement FileAccessRule + BlockPermission + GetParentContext() | 1-2 jours |
| 59-T | Tests : 2+ agents sequentiels, isolation verifiee | 0.5 jour |

**Gate** : 2+ agents sequentiels dans un workflow, chacun isole, permissions enforces, GetParentContext() E2E.

**Plan detaille** : `docs/phases/PHASE-59/README.md`

---

### Phase 60 : Model Playground

**But** : `/playground` dans le TUI pour tester un modele directement — choisir un provider/modele, envoyer un prompt, voir la reponse + tokens + cout. Utile pour verifier qu'un provider fonctionne avant de lancer un workflow.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 60-A | Backend : endpoint playground (prompt → reponse + metriques) | 0.5 jour |
| 60-B | TUI : `/playground` slash command + UI interactive | 1-1.5 jours |
| 60-C | CLI : `maestro playground` + tests | 0.5 jour |

**Gate** : L'utilisateur peut tester n'importe quel modele disponible et voir tokens + cout en < 30s.

**Plan detaille** : `docs/phases/PHASE-60/README.md`

---

### Phase 61 : Block-Forge V2 (provider rapide, agents fonctionnels E2E)

**But** : Rendre block-forge utilisable en production. Utiliser un provider rapide (Anthropic API / GitHub Models), corriger l'isolation agents (Phase 59), valider les outputs structures (blockId, fitness), creer 2 agents fonctionnels avec fitness > 0.5.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 61-A | Provider rapide dans block-forge + correction outputs structures | 1-2 jours |
| 61-B | Creer code-reviewer + test-generator agents avec fitness > 0.5 | 1-2 jours |
| 61-C | Benchmark multi-modeles sur contracts + documentation resultats | 1 jour |
| 61-T | Tests E2E : workflow complet avec outputs valides | 0.5 jour |

**Gate** : 2 agents crees via `/create-agent` avec fitness > 0.5. Workflow < 5 min.

**Plan detaille** : `docs/phases/PHASE-61/README.md`

---

### Phase 62 : /adapt = block-forge avec baseBlockId + contractRef

**But** : `/adapt` utilise block-forge pour creer des variantes d'un block optimisees pour un modele/hardware donne. La variante implemente le meme contract que l'original. `contractRef` dans les workflows.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 62-A | Workflow /adapt : invoque block-forge avec baseBlockId + targetModel | 2-3 jours |
| 62-B | `contractRef` dans les workflows (resolution runtime + verification capabilities) | 1-2 jours |
| 62-C | Integration TUI : `/adapt` dans AgentPanel, `[A]` dans CatalogScreen | 1 jour |

**Gate** : Variante creee implemente le meme contract, capabilities verifiees, `/adapt` et `[A]` fonctionnent.

**Plan detaille** : `docs/phases/PHASE-62/README.md` (anciennement Phase 59)

---

### Phase 63 : Production variantes (benchmark multi-modeles sur contracts)

**But** : Utiliser `/adapt` pour creer ~30 implementations du contract `maestro-assistant` avec capabilities verifiees. Config providers cloud opensource.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 63-A | Configuration providers cloud opensource dans LLM-Provider .NET | 2-3 jours |
| 63-B | Execution de `/adapt` par profil hardware (capabilities verifiees par tier) | 3-5 jours |
| 63-C | Validation, tri, integration dans `content/system/blocks/` | 1-2 jours |

**Gate** : 15+ variantes fitness > 0.6, toutes contract `maestro-assistant`, capabilities verifiees.

**Plan detaille** : `docs/phases/PHASE-63/README.md` (anciennement Phase 60)

---

### Phase 64 : Choix assistant au setup + Catalog par contract

**But** : L'utilisateur voit les implementations du contract `maestro-assistant` compatibles avec son hardware, avec features actives/inactives, et choisit. Le Catalog est organise par contract.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 64-A | Filtrage compatibilite + feature gating UI | 1 jour |
| 64-B | UI de choix au setup (par contract, features actives/inactives, recommended) | 1.5-2 jours |
| 64-C | Catalog organise par contract + changement d'implementation | 1 jour |
| 64-D | Dogfooding complet | 0.5 jour |

**Gate** : L'utilisateur comprend ce qu'il gagne/perd avec chaque choix.

**Plan detaille** : `docs/phases/PHASE-64/README.md` (anciennement Phase 61)

---

### Phase 65 : Onboarding + Packaging npm

**But** : `npm install -g @maestro/cli && maestro init && maestro code`. Premiere experience utilisateur complete.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 65-A | Packaging npm, commande globale, sidecar auto-start | 3-4 jours |
| 65-B | `maestro init` + onboarding (provider + choix assistant par contract) | 2-3 jours |
| 65-C | Documentation : README, Getting Started, 3 exemples | 2-3 jours |

**Gate** : Un utilisateur externe installe, choisit son assistant, et accomplit une tache reelle.

---

### Phase 66 : V1 Deploy + Beta testing

**But** : Deployer la V1, recruter 3-5 beta testeurs, iterer sur le feedback.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 66-A | Stabilisation finale, fix de bugs critiques | 2-3 jours |
| 66-B | Deploy npm public + documentation | 1-2 jours |
| 66-C | Beta testing (3-5 testeurs) + iterations | 3-5 jours |

**Gate** : 3 testeurs externes installent, choisissent leur assistant par contract, et accomplissent des taches reelles.

---

### Phase 67 (V2) : Self-Improvement — Maestro s'ameliore lui-meme

**But** : Research Team observe les metriques par contract/capability → `/adapt` cree des variantes ameliorees → Workspace Orchestrator gere la promotion. L'Agent Creator s'ameliore lui-meme.

**Plan detaille** : `docs/phases/PHASE-67/README.md`

---

### Phase 68 (V2) : Catalogue communautaire + Auth

**But** : Publier et importer des blocks. Catalogue organise par contract. Auth pour identification.

**Plan detaille** : `docs/phases/PHASE-68/README.md`

---

## Chaine de dependances

```
50 Contracts + second assistant + fondations adapt (DONE)
 └→ 51 Contract System (schema, docs, verification, bareme) (DONE)
     └→ 52 Agent test-designer + Contract Test Runner (DONE)
         └→ 53 Agent = Multi-Node Blocks (DONE)
             └→ 54 Re-verification Phase 52 (FitnessScore, tests dans contract) (DONE)
                 └→ 53-B Decomposition NodeExecutionEngine (DONE)
                     └→ 53-C INodeHandler + DispatchNodeAsync (DONE)
                         └→ 55 Block Dependency Resolution (DONE)
                             └→ 56 Metrics Pipeline — Fitness Accuracy (DONE)
                                 └→ 57 Agent agent-creator (DONE)
                                     └→ 58 Workflow block-forge + /create-agent (DONE)
                                         ├→ 59-PRE Gouvernance couts + Providers API (DONE)
                                         │   └→ 59-PRE-2 Cost Enforcement (DONE)
                                         └→ 59 Agent Isolation (sessions enfants, permissions)
                                             └→ 60 Model Playground
                                             └→ 61 Block-Forge V2 (provider rapide, E2E)
                                                 └→ 62 /adapt = block-forge + contractRef
                                                     └→ 63 Production ~30 variantes
                                                         └→ 64 Choix au setup par contract
                                                             └→ 65 Onboarding + Packaging npm
                                                                 └→ 66 V1 Deploy + Beta testing
                                                                     └→ 67 Self-improvement loop (V2)
                                                                         └→ 68 Catalogue communautaire (V2)
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
| INodeHandler extraction + DispatchNodeAsync (1792 → 786 lignes) | 53-C | COMPLETE |
| Block Dependency Resolution (manifest, validation, reverse lookup) | 55 | COMPLETE |
| Metrics Pipeline — chaine de cout, ModelProfile, fitness reel | 56 | COMPLETE |
| Agent agent-creator (boucle create-test-fix) | 57 | COMPLETE |
| Workflow block-forge + /create-agent TUI/CLI | 58 | COMPLETE |
| Gouvernance couts + Providers API (Anthropic, GitHub Models) | 59-PRE | COMPLETE |
| Cost Enforcement (hard stop, graceful shutdown, auto-resume) | 59-PRE-2 | COMPLETE |
| Agent Isolation (sessions enfants, I/O controle, permissions) | 59 | Planifie |
| Model Playground (tester un modele dans le TUI) | 60 | Planifie |
| Block-Forge V2 (provider rapide, agents fonctionnels E2E) | 61 | Planifie |
| /adapt + contractRef dans workflows | 62 | Planifie |
| Production ~30 variantes pre-testees | 63 | Planifie |
| Fitness display dans le TUI (score par feature, +/- features) | 64 | Planifie |
| Backend contract filter `GET /api/blocks?contract=X` | 64 | Planifie |
| Choix assistant au setup par contract | 64 | Planifie |
| Onboarding + Packaging npm (maestro init, first-run) | 65 | Planifie |
| V1 Deploy + Beta testing | 66 | Planifie |
| Self-improvement loop | 67 | Vision (V2) |
| Catalogue communautaire par contract | 68 | Vision (V2) |

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
