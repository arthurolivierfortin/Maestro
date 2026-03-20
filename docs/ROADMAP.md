# Maestro — Roadmap

**Derniere mise a jour** : 2026-03-18 (soir)
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

## Vision strategique (mise a jour 2026-03-17)

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
1. Contract System (schema, docs, verification, bareme)              <- Phase 51 done
2. Agent test-designer (lit un contract -> produit des tests)          <- Phase 52 done
3. Agent et Workflow = Multi-Node Blocks (plus de monolithe)           <- Phase 53 done
4. Re-verification Phase 52 (FitnessScore, tests dans contract)      <- Phase 54 done
4b. Decomposition NodeExecutionEngine (2431 -> 1815 lignes)           <- Phase 53-B done
4c. INodeHandler extraction + DispatchNodeAsync (1792 -> 786 lignes)  <- Phase 53-C done
5. Block Dependency Resolution (manifest, validation, reverse lookup)  <- Phase 55 done
6. Metrics Pipeline -- Fitness Accuracy (chaine de cout, ModelProfile)  <- Phase 56 done
7. Agent agent-creator (cree un block, teste, itere)                   <- Phase 57 done
8. Workflow block-forge + /create-agent TUI/CLI                        <- Phase 58 done
8b. Gouvernance couts + Providers API (limites, historique, TUI)        <- Phase 59-PRE done
8c. Cost Enforcement (hard stop, graceful shutdown, auto-resume)       <- Phase 59-PRE-2 done

=== V1 ===
9.  Agent Isolation (sessions enfants, I/O controle, permissions)      <- Phase 59
10. Model Playground (tester un modele directement dans le TUI)       <- Phase 60
11. Block-Forge Fiable (bugs, safety, validation contracts)           <- Phase 61
12. Container Isolation (permissions, arbre session/workspace, couts) <- Phase 62
13. TUI Chat-First (refonte navigation + permissions visuelles)       <- Phase 63 [EN COURS]
14. Agents Fonctionnels (prompt condense, foundry, live view)         <- Phase 64
15. /adapt = block-forge avec baseBlockId + contractRef               <- Phase 65
16. Production variantes (benchmark multi-modeles sur contracts)      <- Phase 66
17. Choix assistant au setup + Catalog par contract                    <- Phase 67
18. Onboarding + Packaging npm + SDK @maestro/sdk                      <- Phase 68
19. V1 Deploy + Beta testing                                           <- Phase 69

=== V2 ===
20. Self-improvement loop (Maestro s'ameliore lui-meme)               <- Phase 70
21. Catalogue communautaire (auth, publish, import par contract)      <- Phase 71
```

---

## Phases actives et a venir

---

### Phase 59 : Agent Isolation (sessions enfants, I/O controle, permissions)

**But** : Isoler chaque agent (blockRef) dans une session enfant avec I/O controle et permissions enforces. Prerequis pour que block-forge et /adapt fonctionnent de facon fiable avec plusieurs agents sequentiels.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 59-A | Sessions enfants pour chaque blockRef agent | 1-2 jours |
| 59-B | I/O controle (inputs -> outputs, rien d'autre) + _workflowCheckpoint cleanup | 1 jour |
| 59-C | Enforcement FileAccessRule + BlockPermission + GetParentContext() | 1-2 jours |
| 59-T | Tests : 2+ agents sequentiels, isolation verifiee | 0.5 jour |

**Gate** : 2+ agents sequentiels dans un workflow, chacun isole, permissions enforces, GetParentContext() E2E.

**Plan detaille** : `docs/phases/PHASE-59/README.md`

---

### Phase 60 : Model Playground

**But** : `/playground` dans le TUI pour tester un modele directement — choisir un provider/modele, envoyer un prompt, voir la reponse + tokens + cout. Utile pour verifier qu'un provider fonctionne avant de lancer un workflow.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 60-A | Backend : endpoint playground (prompt -> reponse + metriques) | 0.5 jour |
| 60-B | TUI : `/playground` slash command + UI interactive | 1-1.5 jours |
| 60-C | CLI : `maestro playground` + tests | 0.5 jour |

**Gate** : L'utilisateur peut tester n'importe quel modele disponible et voir tokens + cout en < 30s.

**Plan detaille** : `docs/phases/PHASE-60/README.md`

---

### Phase 61 : Block-Forge Fiable — COMPLETE

**But** : Rendre block-forge fiable en corrigeant les bugs bloquants, verifiant le provider, renforçant le pre-flight, et validant les contracts empiriquement. Aucun agent n'est cree dans cette phase.

**Plan detaille** : `docs/phases/PHASE-61/README.md`

---

### Phase 62 : Container Isolation — EN COURS

**But** : Solidifier la logique d'arbre Session/Workspace qui est la fondation de Maestro. Permissions, couts, metriques — tout passe par cet arbre. Le system prompt des agents doit refleter les permissions de la session (tools dynamiques, pas hardcodes). Si le bottleneck est fragile, tout ce qui est construit dessus est fragile.

**Raison** : Decouvert pendant Phase 63-C que (1) ToolDispatcherBlockExecutor n'enforçait aucune permission, et (2) les system prompts listent des tools en dur — incoherent avec le modele container.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 62-A | Permission enforcement dans ToolDispatcherBlockExecutor (fail-closed) | 0.5 jour |
| 62-B | Tests E2E de l'arbre Workspace → Session → Child → Agent | 1 jour |
| 62-C | System prompt dynamique (tools injectes par la session, pas hardcodes) | 1-1.5 jours |
| 62-D | API et CLI de gestion des permissions | 0.5-1 jour |
| 62-E | Discussion TUI (visibilite permissions, arbre, couts) | Discussion |
| 62-T | Tests + validation | 0.5 jour |

**Gate** : Permissions enforces fail-closed, tests E2E arbre complet, system prompt dynamique, API de gestion, 0 regression.

**Plan detaille** : `docs/phases/PHASE-62/README.md`

---

### Phase 63 : TUI Chat-First — EN COURS

**But** : Transformer le TUI multi-pages en paradigme chat-first (comme Claude Code). La page Agent devient l'ecran principal. Les autres pages deviennent des widgets inline accessibles via slash commands. FocusProvider resout le scroll bug. PermissionsPanel rend visible le modele container. Toutes les fonctionnalites preservees.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 63-A | FocusProvider + useManagedInput (resout le scroll bug) | 0.5 jour |
| 63-B | Widgets inline dans le ConversationLog | 1-1.5 jours |
| 63-C | Migration slash commands (6 pages → widgets) | 1-1.5 jours |
| 63-D | PermissionsPanel + integration widgets session/workspace/block | 0.5 jour |
| 63-T | Tests + validation (real-demo-check, test:visual) | 0.5 jour |

**Gate** : Chat-first fonctionne, 0 feature perdue, scroll bug resolu, permissions visibles, real-demo-check passe.

**Plan detaille** : `docs/phases/PHASE-63/README.md`

---

### Phase 64 : Agents Fonctionnels + Optimisation

**But** : Condenser le system prompt (informe par les donnees de 61-C), creer 2 agents fonctionnels via foundry (fitness > 0.5), ajouter une live execution view dans le TUI.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 64-A | `_toolMapping` + mock blocks (fondation) | DONE (ex 62-A) |
| 64-B | Resolution conflits providers | DONE (ex 62-B) |
| 64-C | Condenser system prompt + creer agents via foundry | EN COURS (6/9 tests) |
| 64-D | SSE streaming backend + migration TUI polling → SSE + live execution view | A faire |
| 64-T | Tests + validation | A faire |

**Gate** : 2 agents avec fitness > 0.5, system prompt < 500 lignes, live view fonctionnelle, SSE streaming operationnel (0 polling dans le TUI).

**Note** : Le SSE streaming (64-D) remplace les 22 timers/polling actuels du TUI par un EventSource par session. Ce meme mecanisme sera utilise par le SDK (Phase 68) — on construit une fois, TUI et SDK en profitent.

**Plan detaille** : `docs/phases/PHASE-64/README.md`

---

### Phase 65 : /adapt = block-forge avec baseBlockId + contractRef (ex Phase 64)

**But** : `/adapt` utilise block-forge pour creer des variantes d'un block optimisees pour un modele/hardware donne. La variante implemente le meme contract que l'original. `contractRef` dans les workflows.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 64-A | Workflow /adapt : invoque block-forge avec baseBlockId + targetModel | 2-3 jours |
| 64-B | `contractRef` dans les workflows (resolution runtime + verification capabilities) | 1-2 jours |
| 64-C | Integration TUI : `/adapt` dans AgentPanel, `[A]` dans CatalogScreen | 1 jour |

**Gate** : Variante creee implemente le meme contract, capabilities verifiees, `/adapt` et `[A]` fonctionnent.

**Plan detaille** : `docs/phases/PHASE-65/README.md`

---

### Phase 66 : Production variantes (benchmark multi-modeles sur contracts)

**But** : Utiliser `/adapt` pour creer ~30 implementations du contract `maestro-assistant` avec capabilities verifiees. Config providers cloud opensource.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 65-A | Configuration providers cloud opensource dans LLM-Provider .NET | 2-3 jours |
| 65-B | Execution de `/adapt` par profil hardware (capabilities verifiees par tier) | 3-5 jours |
| 65-C | Validation, tri, integration dans `content/system/blocks/` | 1-2 jours |

**Gate** : 15+ variantes fitness > 0.6, toutes contract `maestro-assistant`, capabilities verifiees.

**Plan detaille** : `docs/phases/PHASE-66/README.md`

---

### Phase 67 : Choix assistant au setup + Catalog par contract

**But** : L'utilisateur voit les implementations du contract `maestro-assistant` compatibles avec son hardware, avec features actives/inactives, et choisit. Le Catalog est organise par contract.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 66-A | Filtrage compatibilite + feature gating UI | 1 jour |
| 66-B | UI de choix au setup (par contract, features actives/inactives, recommended) | 1.5-2 jours |
| 66-C | Catalog organise par contract + changement d'implementation | 1 jour |
| 66-D | Dogfooding complet | 0.5 jour |

**Gate** : L'utilisateur comprend ce qu'il gagne/perd avec chaque choix.

**Plan detaille** : `docs/phases/PHASE-67/README.md`

---

### Phase 68 : Onboarding + Packaging npm + SDK

**But** : `npm install -g @maestro/cli && maestro init && maestro code`. Premiere experience utilisateur complete. Extraction du SDK `@maestro/sdk` pour que des apps externes (ex: Cantante) puissent utiliser les agents/workflows Maestro.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 67-A | Packaging npm, commande globale, sidecar auto-start | 3-4 jours |
| 67-B | `maestro init` + onboarding (provider + choix assistant par contract) | 2-3 jours |
| 67-C | Documentation : README, Getting Started, 3 exemples | 2-3 jours |
| 67-D | SDK `@maestro/sdk` : extraction de `@maestro/client`, lifecycle simplifie, SSE streaming, docs API | 2-3 jours |

**Note SDK** : Le SDK permet a des apps externes d'utiliser Maestro comme moteur d'agents. L'API REST et le SSE streaming (Phase 64-D) sont les fondations — le SDK est un wrapper TypeScript avec DX polie : `createSession → invoke → stream results` en 3 appels. Cantante sera le premier consommateur.

**Gate** : Un utilisateur externe installe, choisit son assistant, et accomplit une tache reelle. Une app externe (Cantante) peut invoquer un agent Maestro via le SDK et recevoir les resultats en streaming.

---

### Phase 69 : V1 Deploy + Beta testing

**But** : Deployer la V1, recruter 3-5 beta testeurs, iterer sur le feedback.

| Sous-phase | Objectif | Effort |
|------------|----------|--------|
| 68-A | Stabilisation finale, fix de bugs critiques | 2-3 jours |
| 68-B | Deploy npm public + documentation | 1-2 jours |
| 68-C | Beta testing (3-5 testeurs) + iterations | 3-5 jours |

**Gate** : 3 testeurs externes installent, choisissent leur assistant par contract, et accomplissent des taches reelles.

---

### Phase 70 (V2) : Self-Improvement — Maestro s'ameliore lui-meme

**But** : Research Team observe les metriques par contract/capability → `/adapt` cree des variantes ameliorees → Workspace Orchestrator gere la promotion. L'Agent Creator s'ameliore lui-meme.

**Plan detaille** : `docs/phases/PHASE-70/README.md`

---

### Phase 71 (V2) : Catalogue communautaire + Auth

**But** : Publier et importer des blocks. Catalogue organise par contract. Auth pour identification.

**Plan detaille** : `docs/phases/PHASE-71/README.md`

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
                             └→ 56 Metrics Pipeline -- Fitness Accuracy (DONE)
                                 └→ 57 Agent agent-creator (DONE)
                                     └→ 58 Workflow block-forge + /create-agent (DONE)
                                         ├→ 59-PRE Gouvernance couts + Providers API (DONE)
                                         │   └→ 59-PRE-2 Cost Enforcement (DONE)
                                         └→ 59 Agent Isolation (sessions enfants, permissions)
                                             └→ 60 Model Playground
                                             └→ 61 Block-Forge Fiable (bugs, safety, contracts)
                                                 └→ 62 Container Isolation (permissions, arbre, couts)
                                                     └→ 63 TUI Chat-First (refonte navigation, permissions visuelles) [EN COURS]
                                                         └→ 64 Agents Fonctionnels (prompt, foundry, live view)
                                                             └→ 65 /adapt = block-forge + contractRef
                                                                 └→ 66 Production ~30 variantes
                                                                     └→ 67 Choix au setup par contract
                                                                         └→ 68 Onboarding + Packaging npm
                                                                             └→ 69 V1 Deploy + Beta testing
                                                                                 └→ 70 Self-improvement loop (V2)
                                                                                     └→ 71 Catalogue communautaire (V2)
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
| Decomposition NodeExecutionEngine (2431 -> 1815 lignes) | 53-B | COMPLETE |
| INodeHandler extraction + DispatchNodeAsync (1792 -> 786 lignes) | 53-C | COMPLETE |
| Block Dependency Resolution (manifest, validation, reverse lookup) | 55 | COMPLETE |
| Metrics Pipeline -- chaine de cout, ModelProfile, fitness reel | 56 | COMPLETE |
| Agent agent-creator (boucle create-test-fix) | 57 | COMPLETE |
| Workflow block-forge + /create-agent TUI/CLI | 58 | COMPLETE |
| Gouvernance couts + Providers API (Anthropic, GitHub Models) | 59-PRE | COMPLETE |
| Cost Enforcement (hard stop, graceful shutdown, auto-resume) | 59-PRE-2 | COMPLETE |
| Agent Isolation (sessions enfants, I/O controle, permissions) | 59 | Planifie |
| Model Playground (tester un modele dans le TUI) | 60 | Planifie |
| Block-Forge Fiable (provider, bugs, safety, validation contracts) | 61 | COMPLETE |
| Container Isolation (permissions, arbre session/workspace, couts) | 62 | COMPLETE |
| TUI Chat-First (refonte navigation, permissions visuelles) | 63 | EN COURS |
| Agents Fonctionnels (prompt condense, foundry, live view) | 64 | EN COURS (6/9) |
| /adapt + contractRef dans workflows | 65 | Planifie |
| Production ~30 variantes pre-testees | 66 | Planifie |
| Fitness display dans le TUI (score par feature, +/- features) | 67 | Planifie |
| Backend contract filter `GET /api/blocks?contract=X` | 67 | Planifie |
| Choix assistant au setup par contract | 67 | Planifie |
| Onboarding + Packaging npm (maestro init, first-run) | 68 | Planifie |
| SDK `@maestro/sdk` (extraction client, SSE, lifecycle simplifie) | 68 | Planifie |
| V1 Deploy + Beta testing | 69 | Planifie |
| Self-improvement loop | 70 | Vision (V2) |
| Catalogue communautaire par contract | 71 | Vision (V2) |

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
12. **Infrastructure solide AVANT les modeles** — Ne jamais injecter des appels LLM couteux dans une infrastructure non verifiee. Fixer les bugs, verifier le provider, valider les contracts PUIS creer les agents.
